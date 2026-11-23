import { SceneRuler } from './measure-39918d7e9b6c186b.js';
/* Small, offline WebGL renderer. All geometry is batched by layer.
 * Project geometry is in millimetres; GPU positions alone are converted to metres.
 */
'use strict';
class HouseGL {
 constructor(canvas, onPick, onStats) {
  this.canvas=canvas; this.onPick=onPick; this.onStats=onStats;this.layers=new Map();this.labels=[];this.hitTargets=[];this.hitSegments=[];
  this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:false})||canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});
  if(!this.gl)throw new Error('WebGL недоступен. Откройте страницу в браузере с включённым аппаратным ускорением.');
  const gl=this.gl;
  const vs=`attribute vec3 position;attribute vec3 normal;attribute vec3 tint;uniform mat4 vp;uniform vec3 offset;varying vec3 n;varying vec3 t;varying float h;void main(){vec3 p=position+offset;n=normal;t=tint;h=position.z;gl_Position=vp*vec4(p,1.0);}`;
  const fs=`precision highp float;varying vec3 n;varying vec3 t;varying float h;uniform vec4 color;uniform vec3 undersideColor;uniform float clipZ;uniform float lit;uniform float useTint;void main(){if(h>clipZ)discard;vec3 nn=normalize(n);float light=mix(1.0,0.60+0.28*abs(dot(nn,normalize(vec3(-0.3,-0.6,1.0))))+0.12*abs(nn.z),lit);vec3 material=mix(nn.z< -0.01?undersideColor:color.rgb,t,useTint);gl_FragColor=vec4(material*light,color.a);}`;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.u={};for(const name of ['vp','offset','color','undersideColor','clipZ','lit','useTint'])this.u[name]=gl.getUniformLocation(this.program,name);
  this.a={position:gl.getAttribLocation(this.program,'position'),normal:gl.getAttribLocation(this.program,'normal'),tint:gl.getAttribLocation(this.program,'tint')};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.941,.949,.925,1);
  this.yaw=-.66;this.pitch=.82;this.span=23500;this.target=[6800,7600,400];this.pan=[0,0];this.clipZ=Infinity;this.explode=0;this.frameCount=0;this.lastFrames=[];this.visibleLabels=true;this.pending=false;this.contextLost=false;this.walk=null;this.keys=new Set();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.onStats?.({error:'Графический контекст потерян. Перезагрузите страницу.'});});
  this.pointers=new Map();this.walkControls=new Map();this.inputEvents=new AbortController();const signal=this.inputEvents.signal;
  this.ruler=new SceneRuler(this);
  this.viewFit=this.fitAspect();
  this.resizeObserver=new ResizeObserver(()=>{if(canvas.clientWidth&&canvas.clientHeight){const fit=this.fitAspect();if(!this.walk)this.span=Math.max(500,Math.min(90000,this.span*fit/this.viewFit));this.viewFit=fit;}this.request();});this.resizeObserver.observe(canvas);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());if(canvas.id!=='scene'&&matchMedia('(any-pointer: coarse)').matches){const help=canvas.closest('.viewport')?.querySelector('.scene-help');if(help)help.textContent='1 палец — вращать · 2 — масштаб и перенос · касание — выбрать';}
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&![0,1,2].includes(e.button))return;e.preventDefault();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,button:e.button,started:e.timeStamp,touch:e.pointerType!=='mouse',moved:false});if(this.pointers.size>1)for(const p of this.pointers.values())p.moved=true;canvas.setPointerCapture(e.pointerId);if(e.pointerType==='mouse')canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',e=>{const p=this.pointers.get(e.pointerId);if(!p)return;const pair=()=>{const [a,b]=[...this.pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)};};const before=this.pointers.size>1?pair():null,dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.ox,p.y-p.oy)>(p.touch?8:4))p.moved=true;
   if(before){const after=pair();if(before.d>8&&after.d>8)this.zoom(before.d/after.d,before.x,before.y);if(!this.walk){this.pan[0]+=after.x-before.x;this.pan[1]+=after.y-before.y;}}
   else if(p.moved){if(this.walk){this.walk.heading+=dx*.004;this.walk.tilt=Math.max(-1.3,Math.min(1.3,this.walk.tilt-dy*.004));}else if(p.button===1||p.button===2||e.shiftKey){this.pan[0]+=dx;this.pan[1]+=dy;}else{this.yaw-=dx*.007;this.pitch=Math.max(.02,Math.min(Math.PI-.02,this.pitch+dy*.006));}}
   this.request();});
  const finish=e=>{const p=this.pointers.get(e.pointerId);if(!p)return;const tap=!p.moved&&(!p.touch||e.timeStamp-p.started<450)&&p.button===0&&this.pointers.size===1&&e.type==='pointerup';this.pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(tap)this.pick(e.clientX,e.clientY);};for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,finish);
  canvas.addEventListener('wheel',e=>{e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1;this.zoom(Math.exp(Math.max(-2,Math.min(2,e.deltaY*unit*.001))),e.clientX,e.clientY);},{passive:false});
  canvas.addEventListener('keydown',e=>{if(this.walk){if(e.key==='Escape'){if(!document.fullscreenElement)this.onExitWalk?.();return;}if(e.key.toLowerCase()==='e'){this.onInteract?.();e.preventDefault();return;}if(['w','a','s','d','ц','ф','ы','в','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(e.key.toLowerCase())||(this.walk.flight&&['pageup','pagedown'].includes(e.key.toLowerCase()))){this.keys.add(e.key.toLowerCase());e.preventDefault();this.request();}return;}let used=true;if(e.shiftKey&&e.key.startsWith('Arrow')){const delta={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-40],ArrowDown:[0,40]}[e.key];if(delta)this.pan=this.pan.map((v,i)=>v+delta[i]);}else if(e.key==='ArrowLeft')this.yaw-=.12;else if(e.key==='ArrowRight')this.yaw+=.12;else if(e.key==='ArrowUp')this.pitch=Math.max(.02,this.pitch-.12);else if(e.key==='ArrowDown')this.pitch=Math.min(Math.PI-.02,this.pitch+.12);else if(e.key==='+'||e.key==='=')this.zoom(.85);else if(e.key==='-')this.zoom(1/.85);else if(e.key.toLowerCase()==='r')this.home();else used=false;if(used){e.preventDefault();this.request();}});
  canvas.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));canvas.addEventListener('blur',()=>this.keys.clear());
  window.addEventListener('blur',()=>this.resetInput(),{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.resetInput();},{signal});
 }
 fitAspect(){return Math.max(1,this.canvas.clientHeight/Math.max(1,this.canvas.clientWidth));}
 resetInput(){this.keys.clear();const held=[...this.walkControls.keys()];this.walkControls.clear();this.onInputReset?.(held);const ids=[...this.pointers.keys()];this.pointers.clear();for(const id of ids)if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}
 zoom(factor,clientX,clientY){if(this.walk){this.walk.fov=Math.max(.65,Math.min(1.6,this.walk.fov*factor));}else{const old=this.span;this.span=Math.max(500,Math.min(90000,old*factor));if(Number.isFinite(clientX)&&Number.isFinite(clientY)){const b=this.canvas.getBoundingClientRect(),r=old/this.span,x=clientX-b.left-b.width/2,y=clientY-b.top-b.height/2;this.pan=[x-(x-this.pan[0])*r,y-(y-this.pan[1])*r];}}this.request();}
 home(preset=this.homePreset||'foundation'){this.walk=null;this.resetInput();this.homePreset=preset;this.yaw=-.66;this.pitch=preset==='foundation-stack'?1.38:.82;this.pan=[0,0];this.span=preset==='floor1'?22000:preset==='floor2'?22000:preset==='services3d'?30000:preset==='foundation-stack'?25000:preset==='masonry3d'?27000:preset==='stairs'?8800:preset==='detail'?3900:preset==='house'?27000:['roof','frame'].includes(preset)?22500:23500;this.viewFit=this.fitAspect();this.span=Math.min(90000,this.span*this.viewFit);this.target=preset==='floor1'?[7800,7900,1100]:preset==='floor2'?[7000,7900,4200]:preset==='services3d'?[7500,7000,1000]:preset==='foundation-stack'?[7200,7500,-3500]:preset==='masonry3d'?[6700,7600,3400]:preset==='stairs'?[4900,7900,1300]:preset==='detail'?[0,0,-450]:preset==='house'?[6700,7600,3400]:['roof','frame'].includes(preset)?[6500,7800,5500]:[6800,7600,-450];this.request();}
 clear(){this.ruler?.enable(false);this.walk=null;this.resetInput();const gl=this.gl;for(const l of this.layers.values()){if(l.buffer)gl.deleteBuffer(l.buffer);if(l.edgesBuffer)gl.deleteBuffer(l.edgesBuffer);if(l.tintBuffer)gl.deleteBuffer(l.tintBuffer);}this.layers.clear();this.labels=[];this.hitTargets=[];this.hitSegments=[];}
 dispose(){this.inputEvents.abort();this.resizeObserver?.disconnect();if(this.rafId)cancelAnimationFrame(this.rafId);this.clear();this.ruler?.dispose();for(const shader of this.gl.getAttachedShaders(this.program)||[])this.gl.deleteShader(shader);this.gl.deleteProgram(this.program);this.contextLost=true;if(this.labelRoot)this.labelRoot.replaceChildren();this.onPick=null;this.onStats=null;this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
 addLayer(id,color,opts={}){const l={id,color,visible:true,opacity:1,order:0,vertices:[],edges:[],offset:[0,0,0],...opts};this.layers.set(id,l);return l;}
 face(l,points,normal,objectId=null){
  // Clipped roof cells can start with repeated/collinear vertices. Find an
  // actual face normal; normalize(0) in GLSL otherwise produces black noise.
  if(points.length<3||points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))return;
  const clean=points.filter((p,i)=>!i||Math.hypot(...p.map((v,k)=>v-points[i-1][k]))>1e-7);
  if(clean.length>2&&Math.hypot(...clean[0].map((v,k)=>v-clean.at(-1)[k]))<1e-7)clean.pop();
  if(clean.length<3)return;const triangles=[];let best=null,bestArea=0;
  for(let i=1;i<clean.length-1;i++){const a=clean[0],b=clean[i],c=clean[i+1],u=b.map((v,k)=>v-a[k]),v=c.map((q,k)=>q-a[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],area=Math.hypot(...cross);if(area<=1e-6)continue;triangles.push([a,b,c]);if(area>bestArea){bestArea=area;best=cross;}}
  if(!triangles.length)return;let n=normal;if(!n||n.some(v=>!Number.isFinite(v))||Math.hypot(...n)<1e-12)n=best;const length=Math.hypot(...n);n=n.map(v=>v/length);
  for(const triangle of triangles)for(const p of triangle)l.vertices.push(p[0]/1000,p[1]/1000,p[2]/1000,...n);
  if(objectId)this.hitTargets.push({points:clean,id:objectId,layer:l.id});
 }
 line(l,a,b,id=null){l.edges.push(...a.map(v=>v/1000),0,0,1,...b.map(v=>v/1000),0,0,1);if(id)this.hitSegments.push({a,b,id,layer:l.id});}
 polyline(l,p,closed=false){for(let i=1;i<p.length;i++)this.line(l,p[i-1],p[i]);if(closed)this.line(l,p.at(-1),p[0]);}
 box(l,x0,y0,z0,x1,y1,z1,id=null,edges=true){const p=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];for(const [idx,n] of [[[0,3,2,1],[0,0,-1]],[[4,5,6,7],[0,0,1]],[[0,1,5,4],[0,-1,0]],[[1,2,6,5],[1,0,0]],[[2,3,7,6],[0,1,0]],[[3,0,4,7],[-1,0,0]]])this.face(l,idx.map(i=>p[i]),n,id);if(edges)for(const [a,b]of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])this.line(l,p[a],p[b]);}
 beam(l,a,b,width,height,id=null,widthAxis=null){const axis=b.map((v,i)=>v-a[i]),len=Math.hypot(...axis);if(len<.001)return;const d=axis.map(v=>v/len);let u=widthAxis|| (Math.abs(d[2])<.95?[-d[1],d[0],0]:[1,0,0]);const ul=Math.hypot(...u);u=u.map(v=>v/ul);let v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];const p=[];for(const end of [a,b])for(const [su,sv]of [[-1,-1],[1,-1],[1,1],[-1,1]])p.push(end.map((q,i)=>q+u[i]*su*width/2+v[i]*sv*height/2));for(const ids of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])this.face(l,ids.map(i=>p[i]),null,id);for(const [i,j]of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])this.line(l,p[i],p[j]);}
 prism(l,polygon,z0,z1,id=null){const tris=HouseGL.triangulate(polygon);for(const t of tris){this.face(l,t.map(i=>[...polygon[i],z1]),[0,0,1],id);this.face(l,[...t].reverse().map(i=>[...polygon[i],z0]),[0,0,-1],id);}for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];this.face(l,[[...a,z0],[...b,z0],[...b,z1],[...a,z1]],null,id);}this.polyline(l,polygon.map(p=>[...p,z0]),true);this.polyline(l,polygon.map(p=>[...p,z1]),true);}
 tube(l,a,b,r=6,sides=6,id=null){const d=b.map((v,i)=>v-a[i]);let len=Math.hypot(...d);if(len<.0001)return;for(let i=0;i<3;i++)d[i]/=len;let u=Math.hypot(d[0],d[1])>1e-8?[-d[1],d[0],0]:[1,0,0];len=Math.hypot(...u);u=u.map(x=>x/len);const v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];for(let i=0;i<sides;i++){const radial=t=>u.map((q,k)=>r*(q*Math.cos(t)+v[k]*Math.sin(t)));const p=radial(i/sides*2*Math.PI),q=radial((i+1)/sides*2*Math.PI);this.face(l,[a.map((x,k)=>x+p[k]),a.map((x,k)=>x+q[k]),b.map((x,k)=>x+q[k]),b.map((x,k)=>x+p[k])],null,id);}}
 rod(l,points,r=6,id=null){for(let i=1;i<points.length;i++)this.tube(l,points[i-1],points[i],r,6,id);}
 ring(l,x,y,z,r){const p=Array.from({length:32},(_,i)=>[x+r*Math.cos(i*Math.PI/16),y+r*Math.sin(i*Math.PI/16),z]);this.polyline(l,p,true);}
 label(text,p,id=null,color='#34463d'){this.labels.push({text,p,id,color});}
 commitLayer(l){const gl=this.gl;if(l.buffer)gl.deleteBuffer(l.buffer);if(l.edgesBuffer)gl.deleteBuffer(l.edgesBuffer);if(l.tintBuffer)gl.deleteBuffer(l.tintBuffer);const upload=a=>{if(!a.length)return null;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a instanceof Float32Array?a:new Float32Array(a),gl.STATIC_DRAW);return b;};l.rulerTriangles=new Float32Array(l.vertices);l.buffer=upload(l.rulerTriangles);l.tintBuffer=upload(l.faceTints||[]);l.faceTints=null;l.rulerEdges=new Float32Array(l.edges);l.featureSegments=null;l.edgesBuffer=upload(l.rulerEdges);l.count=l.vertices.length/6;l.edgeCount=l.edges.length/6;
  const points=l.count?l.rulerTriangles:l.rulerEdges;
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<points.length;i+=6)for(let axis=0;axis<3;axis++){
   low[axis]=Math.min(low[axis],points[i+axis]);high[axis]=Math.max(high[axis],points[i+axis]);
  }
  l.depthCentre=points.length?low.map((v,i)=>(v+high[i])/2):[0,0,0];
  l.vertices=null;l.edges=null;}
 commit(){for(const l of this.layers.values())this.commitLayer(l);this.request();}
 matrix(){if(this.walk)return this.walkMatrix();const w=this.canvas.clientWidth,h=this.canvas.clientHeight,aspect=w/Math.max(1,h),s=this.span/1000/2;const right=[Math.cos(this.yaw),-Math.sin(this.yaw),0],up=[Math.sin(this.yaw)*Math.cos(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch)],depth=[Math.sin(this.yaw)*Math.sin(this.pitch),Math.cos(this.yaw)*Math.sin(this.pitch),-Math.cos(this.pitch)];this.basis={right,up,depth};const t=this.target.map(v=>v/1000);const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);const sx=1/(s*aspect),sy=1/s,sz=1/150;const cx=this.pan[0]*2/Math.max(1,w),cy=-this.pan[1]*2/Math.max(1,h);return new Float32Array([right[0]*sx,up[0]*sy,depth[0]*sz,0,right[1]*sx,up[1]*sy,depth[1]*sz,0,right[2]*sx,up[2]*sy,depth[2]*sz,0,-dot(right,t)*sx+cx,-dot(up,t)*sy+cy,-dot(depth,t)*sz,1]);}
 project(p,offset=[0,0,0]){const m=this.vp,q=p.map((x,i)=>x/1000+(offset[i]||0));const cw=m[3]*q[0]+m[7]*q[1]+m[11]*q[2]+m[15];if(cw<=0)return [Infinity,Infinity,Infinity];return [((m[0]*q[0]+m[4]*q[1]+m[8]*q[2]+m[12])/cw+1)*this.canvas.clientWidth/2,(1-(m[1]*q[0]+m[5]*q[1]+m[9]*q[2]+m[13])/cw)*this.canvas.clientHeight/2,(m[2]*q[0]+m[6]*q[1]+m[10]*q[2]+m[14])/cw];}
 draw(){if(this.contextLost)return;this.stepWalk();const start=performance.now(),gl=this.gl,c=this.canvas,dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);this.vp=this.matrix();gl.uniformMatrix4fv(this.u.vp,false,this.vp);gl.uniform1f(this.u.clipZ,Number.isFinite(this.clipZ)?this.clipZ/1000:1000);let calls=0,triangles=0;
  const bind=b=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(this.a.position);gl.vertexAttribPointer(this.a.position,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(this.a.normal);gl.vertexAttribPointer(this.a.normal,3,gl.FLOAT,false,24,12);};
  const layers=[...this.layers.values()].filter(l=>l.visible&&l.opacity>.001&&(!l.dependsOn||(this.layers.get(l.dependsOn)?.visible&&this.layers.get(l.dependsOn)?.opacity>.001)));const drawLayer=(l,edges=false)=>{const b=edges?l.edgesBuffer:l.buffer;if(!b||!edges&&l.showFaces===false)return;bind(b);
   const tinted=!edges&&l.useTint&&l.tintBuffer;
   if(tinted){gl.bindBuffer(gl.ARRAY_BUFFER,l.tintBuffer);gl.enableVertexAttribArray(this.a.tint);gl.vertexAttribPointer(this.a.tint,3,gl.FLOAT,false,0,0);}
   else gl.disableVertexAttribArray(this.a.tint);
   gl.uniform1f(this.u.useTint,tinted?1:0);if(l.depthPriority){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(0,-l.depthPriority);}else if(l.depthBias){gl.enable(gl.POLYGON_OFFSET_FILL);const bias=typeof l.depthBias==='number'?l.depthBias:1;gl.polygonOffset(-bias,-bias);}else gl.disable(gl.POLYGON_OFFSET_FILL);gl.uniform3fv(this.u.offset,l.actualOffset);const material=l.renderColor||l.color,rgb=edges?material.map(x=>x*.6):material;gl.uniform3fv(this.u.undersideColor,(!edges&&l.undersideColor)||rgb);gl.uniform4fv(this.u.color,[...rgb,edges?Math.min(l.edgeAlpha??.55,l.opacity):l.opacity]);gl.uniform1f(this.u.lit,edges?0:1);gl.drawArrays(edges?gl.LINES:gl.TRIANGLES,0,edges?l.edgeCount:l.count);calls++;if(!edges)triangles+=l.count/3;};
  const depthDirection=this.walk?this.walkBasis().forward:this.basis.depth;
  const opaque=[],transparent=[];
  for(const l of layers){
   l.actualOffset=l.offset.map((v,i)=>v/1000+(i===2?(l.explodeOrder||0)*this.explode/1000:0));
   if(l.opacity>=.999)opaque.push(l);
   else{
    const depth=depthDirection.reduce((sum,v,i)=>sum+v*((l.depthCentre?.[i]??0)+l.actualOffset[i]),0);
    transparent.push({layer:l,depth});
   }
  }
  gl.depthMask(true);
  for(const l of opaque)drawLayer(l);
  gl.depthMask(false);
  for(const l of opaque)if(l.showEdges!==false)drawLayer(l,true);
  // With blending enabled, the far side of the view must be drawn first.
  transparent.sort((a,b)=>b.depth-a.depth||(a.layer.order||0)-(b.layer.order||0));
  for(const {layer} of transparent){
   drawLayer(layer);
   if(layer.showEdges!==false)drawLayer(layer,true);
  }
  gl.depthMask(true);
  this.frameCount++;const ms=performance.now()-start;this.lastFrames.push(ms);if(this.lastFrames.length>120)this.lastFrames.shift();this.drawCalls=calls;this.triangles=triangles;
  if(this.labelRoot){const visible=this.visibleLabels?this.labels.filter(l=>{const layer=l.layer&&this.layers.get(l.layer);return (!layer||layer.visible)&&l.p[2]<=this.clipZ;}):[];this.labelRoot.replaceChildren(...visible.map(l=>{const layer=l.layer&&this.layers.get(l.layer);const p=this.project(l.p,layer?.actualOffset);const b=document.createElement(l.id?'button':'span');b.className='world-label'+(l.kind==='room'?' room-label':'');b.textContent=l.text;if(l.kind==='room'){const a=this.project([l.p[0]-l.width_mm/2,l.p[1],l.p[2]]),c=this.project([l.p[0]+l.width_mm/2,l.p[1],l.p[2]]);b.style.maxWidth=Math.max(70,Math.min(180,Math.hypot(c[0]-a[0],c[1]-a[1])*.9))+'px';}b.style.left=p[0]+'px';b.style.top=p[1]+'px';b.style.color=l.color;if(p[0]<0||p[1]<0||p[0]>c.clientWidth||p[1]>c.clientHeight)b.hidden=true;if(l.id)b.onclick=()=>this.onPick?.(l.id);return b;}));}
  if(this.ruler.active)this.ruler.draw();
  this.onStats?.({ms,triangles,calls,frames:this.frameCount});if(this.walk&&(this.keys.size||this.walkControls.size))this.request();
 }
 request(){if(this.pending||this.contextLost)return;this.pending=true;this.rafId=requestAnimationFrame(()=>{this.pending=false;this.draw();});}
 pick(clientX,clientY){
  if(this.ruler.active){this.ruler.pick(clientX,clientY);return;}
  if(this.walk){this.pickPerspective(clientX,clientY);return;}
  const r=this.canvas.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;let nearest=null,lineHit=null;
  for(const t of this.hitTargets){const l=this.layers.get(t.layer);if(!l?.visible||l.opacity<.01||(l.dependsOn&&(!this.layers.get(l.dependsOn)?.visible||this.layers.get(l.dependsOn)?.opacity<.01)))continue;let points=t.points;if(Number.isFinite(this.clipZ)){const clipped=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ain=a[2]<=this.clipZ,bin=b[2]<=this.clipZ;if(ain)clipped.push(a);if(ain!==bin){const u=(this.clipZ-a[2])/(b[2]-a[2]);clipped.push(a.map((v,k)=>v+(b[k]-v)*u));}}points=clipped;}if(points.length<3)continue;const q=points.map(p=>this.project(p,l.actualOffset));if(HouseGL.inside([x,y],q)){const depth=q.reduce((s,p)=>s+p[2],0)/q.length;const priority=l.depthPriority||l.depthBias||0;if(!nearest||depth<nearest.depth-1e-7||Math.abs(depth-nearest.depth)<=1e-7&&priority>nearest.priority)nearest={id:t.id,depth,opacity:l.opacity,priority};}}
  for(const t of this.hitSegments){const l=this.layers.get(t.layer);if(!l?.visible||l.opacity<.01||(l.dependsOn&&(!this.layers.get(l.dependsOn)?.visible||this.layers.get(l.dependsOn)?.opacity<.01)))continue;let a=t.a,b=t.b;if(a[2]>this.clipZ&&b[2]>this.clipZ)continue;if((a[2]>this.clipZ)!==(b[2]>this.clipZ)){const u=(this.clipZ-a[2])/(b[2]-a[2]),cut=a.map((v,i)=>v+(b[i]-v)*u);if(a[2]>this.clipZ)a=cut;else b=cut;}
   const p=this.project(a,l.actualOffset),q=this.project(b,l.actualOffset),dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy,u=den?Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/den)):0,dist=Math.hypot(x-p[0]-u*dx,y-p[1]-u*dy),depth=p[2]+u*(q[2]-p[2]);
   if(dist<=6&&(!lineHit||depth<lineHit.depth-1e-6||(Math.abs(depth-lineHit.depth)<1e-6&&dist<lineHit.dist)))lineHit={id:t.id,depth,dist};
  }
  if(lineHit&&(!nearest||nearest.opacity<.3||lineHit.depth<nearest.depth))nearest=lineHit;
  if(nearest)this.onPick?.(nearest.id);
 }
 resetLayer(id,color,opts={}){const old=this.layers.get(id);if(old&&this.ruler.points.some(p=>p.layer===old))this.ruler.enable(this.ruler.active);if(old){if(old.buffer)this.gl.deleteBuffer(old.buffer);if(old.edgesBuffer)this.gl.deleteBuffer(old.edgesBuffer);if(old.tintBuffer)this.gl.deleteBuffer(old.tintBuffer);}this.hitTargets=this.hitTargets.filter(t=>t.layer!==id);this.hitSegments=this.hitSegments.filter(t=>t.layer!==id);return this.addLayer(id,color,{...(old?{visible:old.visible,opacity:old.opacity,explodeOrder:old.explodeOrder,order:old.order,depthPriority:old.depthPriority,depthBias:old.depthBias}:{}),...opts});}
 enterWalk(position,heading=0){this.resetInput();this.walk={position:[...position],heading,tilt:0,fov:1.15,lastTime:performance.now()};this.keys.clear();this.pan=[0,0];this.explode=0;this.clipZ=Infinity;this.request();}
 walkBasis(){const w=this.walk,h=w.heading,p=w.tilt;return {forward:[Math.sin(h)*Math.cos(p),Math.cos(h)*Math.cos(p),Math.sin(p)],right:[Math.cos(h),-Math.sin(h),0],up:[-Math.sin(h)*Math.sin(p),-Math.cos(h)*Math.sin(p),Math.cos(p)]};}
 walkMatrix(){const w=this.walk,{forward:f,right:r,up:u}=this.walkBasis(),p=w.position.map(v=>v/1000),aspect=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),scale=1/Math.tan(w.fov/2),near=.04,far=180,A=(far+near)/(near-far),B=2*far*near/(near-far),dot=a=>a.reduce((s,v,i)=>s+v*p[i],0);return new Float32Array([r[0]*scale/aspect,u[0]*scale,-f[0]*A,f[0],r[1]*scale/aspect,u[1]*scale,-f[1]*A,f[1],r[2]*scale/aspect,u[2]*scale,-f[2]*A,f[2],-dot(r)*scale/aspect,-dot(u)*scale,dot(f)*A+B,-dot(f)]);}
 stepWalk(){
  const w=this.walk;if(!w)return;
  const now=performance.now(),dt=Math.min(.05,(now-w.lastTime)/1000);w.lastTime=now;
  const held=new Set([...this.keys,...this.walkControls.values()]),has=(...keys)=>keys.some(k=>held.has(k));
  const f=+has('w','ц','arrowup')-has('s','ы','arrowdown'),r=+has('d','в','arrowright')-has('a','ф','arrowleft');
  const h=w.flight?+has('pageup')-has('pagedown'):0;
  const pitch=w.flight?w.tilt:0,forward=f*Math.cos(pitch);
  const direction=[Math.sin(w.heading)*forward+Math.cos(w.heading)*r,Math.cos(w.heading)*forward-Math.sin(w.heading)*r,f*Math.sin(pitch)+h];
  const length=Math.hypot(...direction);if(length<1e-6)return;
  const distance=dt*(w.flight?5200:2400)*(has('shift')?2:1);
  if(w.flight){w.position=w.position.map((p,i)=>p+direction[i]*distance/length);}
  else{
   const steps=Math.max(1,Math.ceil(distance/50));
   for(let j=0;j<steps;j++)for(const i of [0,1]){
    const next=[...w.position];next[i]+=direction[i]*distance/(length*steps);
    if(!this.walkCollider||this.walkCollider(next,w.position))w.position=next;
   }
  }
  this.onWalkMove?.(w);
 }
 pickPerspective(clientX,clientY){const box=this.canvas.getBoundingClientRect(),px=(clientX-box.left)/box.width*2-1,py=1-(clientY-box.top)/box.height*2,{forward:f,right:r,up:u}=this.walkBasis(),t=Math.tan(this.walk.fov/2),aspect=box.width/box.height,dir=f.map((v,i)=>v+r[i]*px*t*aspect+u[i]*py*t),origin=this.walk.position;let nearest=null;const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  for(const face of this.hitTargets){const l=this.layers.get(face.layer);if(!l?.visible||l.opacity<.05||l.id==='selection'||l.dependsOn&&!this.layers.get(l.dependsOn)?.visible)continue;const off=(l.actualOffset||[0,0,0]).map(v=>v*1000),points=face.points.map(p=>p.map((v,i)=>v+off[i]));for(let j=1;j<points.length-1;j++){const [a,b,c]=[points[0],points[j],points[j+1]],e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-8)continue;const inv=1/det,s=sub(origin,a),v=inv*dot(s,h);if(v<0||v>1)continue;const q=cross(s,e1),w=inv*dot(dir,q);if(w<0||v+w>1)continue;const dist=inv*dot(e2,q),priority=l.depthPriority||l.depthBias||0;if(dist>40&&(!nearest||dist<nearest.dist-.01||Math.abs(dist-nearest.dist)<=.01&&priority>nearest.priority))nearest={id:face.id,dist,priority};}}
  if(nearest)this.onPick?.(nearest.id);
 }
 async benchmark(n=90){const gaps=[];let prev=null;for(let i=0;i<n&&!this.contextLost;i++){await new Promise(resolve=>requestAnimationFrame(t=>{if(prev!==null)gaps.push(t-prev);prev=t;this.yaw+=.008;this.draw();resolve();}));}gaps.sort((a,b)=>a-b);const mean=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:Infinity;return {fps:1000/mean,p95:gaps[Math.floor(gaps.length*.95)]||0,triangles:this.triangles,drawCalls:this.drawCalls,frames:n,dpr:Math.min(devicePixelRatio||1,2),width:this.canvas.width,height:this.canvas.height};}
 static inside(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
 static triangulate(p){let ids=p.map((_,i)=>i),out=[];const area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0);if(area<0)ids.reverse();let guard=0;while(ids.length>3&&guard++<p.length*p.length){let cut=false;for(let k=0;k<ids.length;k++){const a=ids[(k+ids.length-1)%ids.length],b=ids[k],c=ids[(k+1)%ids.length],u=p[a],v=p[b],w=p[c];if((v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])<=0)continue;const has=ids.some(i=>i!==a&&i!==b&&i!==c&&HouseGL.inside(p[i],[u,v,w]));if(has)continue;out.push([a,b,c]);ids.splice(k,1);cut=true;break;}if(!cut)throw Error('Контур нельзя триангулировать');}if(ids.length===3)out.push(ids);return out;}
}
window.HouseGL=HouseGL;

export { HouseGL };
