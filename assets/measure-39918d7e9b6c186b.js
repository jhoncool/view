/* Model-space measurements in millimetres. All interaction distances are CSS pixels. */
class RulerHandles {
 constructor(host,move){
  this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  this.svg.setAttribute('class','ruler-overlay');this.svg.setAttribute('aria-label','Точки измерения');
  this.svg.innerHTML='<line/>'+['А','Б'].map((name,i)=>`<g data-handle="${i}" aria-label="Точка ${name}"><circle class="hit" r="16"/><circle class="dot" r="5"/><text x="10" y="-10">${name}</text></g>`).join('');
  host.append(this.svg);
  for(const el of this.svg.querySelectorAll('g')){
   let pointer=null;
   el.onpointerdown=e=>{if(pointer!==null||e.button!==0)return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;el.setPointerCapture(pointer);el.classList.add('moving');};
   el.onpointermove=e=>{if(pointer===e.pointerId)move(+el.dataset.handle,e);};
   el.onpointerup=e=>{if(pointer===e.pointerId){move(+el.dataset.handle,e);el.releasePointerCapture(pointer);}};
   el.onlostpointercapture=el.onpointercancel=()=>{pointer=null;el.classList.remove('moving');};
  }
 }
 draw(points,angleIndex=-1){
  const groups=this.svg.querySelectorAll('g'),line=this.svg.firstElementChild;
  groups.forEach((el,i)=>{const q=points[i];el.style.display=q?'':'none';
   if(q){el.querySelector('text').textContent=(i?'Б':'А')+(i===angleIndex?' · 90°':'');el.setAttribute('transform',`translate(${q[0]} ${q[1]})`);line.setAttribute('x'+(i+1),q[0]);line.setAttribute('y'+(i+1),q[1]);}});
  line.style.display=points[0]&&points[1]?'':'none';
 }
}
function rulerFraction(x,y,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
 return length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
}
// Operate in model coordinates. Screen coordinates only decide which edge the
// pointer indicates. A perpendicular to the extension of an edge is invalid.
function rulerPerpendicular(anchor,a,b){
 const direction=b.map((v,i)=>v-a[i]);
 const length2=direction.reduce((sum,v)=>sum+v*v,0);
 if(length2<1e-12)return null;
 const t=direction.reduce((sum,v,i)=>sum+(anchor[i]-a[i])*v,0)/length2;
 if(t<0||t>1)return null;
 const foot=a.map((v,i)=>v+t*direction[i]);
 return Math.hypot(...foot.map((v,i)=>v-anchor[i]))>1e-6?foot:null;
}
// The foundation model splits long straight walls at grid intersections.
// Keep the original vertices for ordinary snapping, but use the continuous
// portion of an axis-aligned edge as the support for a perpendicular.
function rulerStraightRuns(edges){
 const groups=new Map(),runs=new Map();
 for(const edge of edges){
  const [a,b]=edge,axes=a.map((v,i)=>v!==b[i]?i:-1).filter(i=>i>=0);
  if(axes.length!==1)continue;
  const axis=axes[0],key=axis+':'+a.filter((_,i)=>i!==axis).join(',');
  if(!groups.has(key))groups.set(key,{axis,intervals:[]});
  groups.get(key).intervals.push(a[axis]<b[axis]?{lo:a,hi:b,edge}:{lo:b,hi:a,edge});
 }
 for(const {axis,intervals} of groups.values()){
  intervals.sort((a,b)=>a.lo[axis]-b.lo[axis]);
  for(let i=0;i<intervals.length;){
   const start=i++,lo=intervals[start].lo;let hi=intervals[start].hi;
   while(i<intervals.length&&intervals[i].lo[axis]<=hi[axis]){
    if(intervals[i].hi[axis]>hi[axis])hi=intervals[i].hi;
    i++;
   }
   if(i-start>1){const run=[lo,hi];for(let j=start;j<i;j++)runs.set(intervals[j].edge,run);}
  }
 }
 return runs;
}
function rulerAngleIndex(points){
 if(points.length!==2)return -1;
 return points.findIndex((point,i)=>{
  if(!point.perpendicularEdge)return false;
  const foot=rulerPerpendicular(points[1-i].p,...point.perpendicularEdge);
  return foot&&Math.hypot(...foot.map((v,k)=>v-point.p[k]))<1e-5;
 });
}
const rulerAutoPerpendicularPx=16;
function rulerControls(){
 return '<button type="button" class="ruler-toggle" aria-pressed="false">Линейка</button><select hidden class="ruler-mode" aria-label="Режим линейки"><option value="free">Свободная</option><option value="snap">Привязка к краям</option><option value="perpendicular">Перпендикуляр к краю · 90°</option></select><button type="button" class="ruler-reset" hidden>Сбросить</button><output hidden aria-live="polite"></output>';
}
class SceneRuler {
 constructor(g){
  this.g=g;this.points=[];this.active=false;
  const host=g.canvas.parentElement;
  this.panel=document.createElement('div');this.panel.className='ruler-panel';this.panel.innerHTML=rulerControls();
  this.handles=new RulerHandles(host,(i,e)=>this.pick(e.clientX,e.clientY,i));host.append(this.panel);
  this.button=this.panel.querySelector('.ruler-toggle');this.mode=this.panel.querySelector('select');this.reset=this.panel.querySelector('.ruler-reset');this.output=this.panel.querySelector('output');
  this.button.onclick=()=>this.enable(!this.active);this.reset.onclick=()=>this.enable(true);
  this.mode.onchange=()=>{
   if(this.mode.value==='perpendicular'&&this.points.length===2&&rulerAngleIndex(this.points)<0){
    const b=this.points.pop(),[x,y]=g.project(b.p,b.layer.actualOffset);
    if(this.available(b.layer)&&Number.isFinite(x+y)){
     const hit=this.hit(x,y,this.points[0]);if(hit)this.points.push(hit);
    }
   }
   this.describe();this.draw();
  };
  this.enable(false);
 }
 enable(active){
  this.active=active;this.points=[];this.button.setAttribute('aria-pressed',String(active));
  this.output.hidden=this.reset.hidden=this.mode.hidden=!active;
  this.g.canvas.parentElement.classList.toggle('measuring',active);
  this.describe();
  this.draw();
 }
 dispose(){this.panel.remove();this.handles.svg.remove();}
 ray(x,y){
  const g=this.g,c=g.canvas,px=x-c.clientWidth/2,py=c.clientHeight/2-y;
  if(g.walk){
   const {forward,right,up}=g.walkBasis(),scale=2*Math.tan(g.walk.fov/2)/c.clientHeight;
   return {o:g.walk.position,d:forward.map((v,i)=>v+scale*(px*right[i]+py*up[i]))};
  }
  const {right,up,depth}=g.basis,scale=g.span/c.clientHeight;
  return {o:g.target.map((v,i)=>v+scale*((px-g.pan[0])*right[i]+(py+g.pan[1])*up[i])-150000*depth[i]),d:depth};
 }
 surface(x,y){
  const g=this.g;
  const {o,d}=this.ray(x,y);
  let face=null;
  for(const l of g.layers.values()){
   if(!this.available(l)||['guides','selection','dimensions','rebarChecks','rebarSelected','frame-checks','stairChecks'].includes(l.id))continue;
   const shift=(l.actualOffset||[0,0,0]).map(v=>v*1000),origin=o.map((v,i)=>v-shift[i]);
   const verts=l.rulerTriangles;
   for(let i=0;verts&&i<verts.length;i+=18){
    const ax=verts[i]*1000,ay=verts[i+1]*1000,az=verts[i+2]*1000;
    const ux=verts[i+6]*1000-ax,uy=verts[i+7]*1000-ay,uz=verts[i+8]*1000-az;
    const vx=verts[i+12]*1000-ax,vy=verts[i+13]*1000-ay,vz=verts[i+14]*1000-az;
    const hx=d[1]*vz-d[2]*vy,hy=d[2]*vx-d[0]*vz,hz=d[0]*vy-d[1]*vx,det=ux*hx+uy*hy+uz*hz;
    if(Math.abs(det)<1e-9)continue;
    const sx=origin[0]-ax,sy=origin[1]-ay,sz=origin[2]-az,u=(sx*hx+sy*hy+sz*hz)/det;
    if(u<0||u>1)continue;
    const qx=sy*uz-sz*uy,qy=sz*ux-sx*uz,qz=sx*uy-sy*ux,v=(d[0]*qx+d[1]*qy+d[2]*qz)/det;
    if(v<0||u+v>1)continue;
    const t=(vx*qx+vy*qy+vz*qz)/det;
    if(t<(g.walk?40:0)||face&&t>=face.t||origin[2]+t*d[2]>g.clipZ+.002)continue;
    face={t,layer:l,p:origin.map((a,k)=>a+t*d[k]),index:i};
   }
  }
  return face;
 }
 segments(layer){
  if(layer.featureSegments)return layer.featureSegments;
  const lines=layer.rulerEdges,segments=[];
  const vertex=(buf,i)=>[buf[i]*1000,buf[i+1]*1000,buf[i+2]*1000];
  for(let i=0;lines&&i<lines.length;i+=12)segments.push([vertex(lines,i),vertex(lines,i+6)]);
  // Polygon-only objects (including glass) have no outline buffer. Ignore
  // coplanar triangle diagonals and retain their actual boundary or crease.
  if(!segments.length){
   const v=layer.rulerTriangles,shared=new Map();
   for(let i=0;v&&i<v.length;i+=18){
    const normal=[v[i+3],v[i+4],v[i+5]];
    for(const [u,w] of [[i,i+6],[i+6,i+12],[i+12,i]]){
     const a=vertex(v,u),b=vertex(v,w),key=[a.join(','),b.join(',')].sort().join('/');
     const other=shared.get(key);
     if(!other)shared.set(key,{a,b,normal,boundary:true});
     else if(Math.abs(normal.reduce((sum,n,k)=>sum+n*other.normal[k],0))>.99999)other.boundary=false;
    }
   }
   for(const {a,b,boundary} of shared.values())if(boundary)segments.push([a,b]);
  }
  layer.featureSegments=segments;layer.rulerRuns=null;return segments;
 }
 candidate(x,y,layer,a,b,snap){
  const g=this.g,clip=g.clipZ;
  if(a[2]>clip&&b[2]>clip)return null;
  if((a[2]>clip)!==(b[2]>clip)){const t=(clip-a[2])/(b[2]-a[2]),cut=a.map((v,i)=>v+t*(b[i]-v));if(a[2]>clip)a=cut;else b=cut;}
  const off=layer.actualOffset,p=g.project(a,off),q=g.project(b,off);
  if(!Number.isFinite(p[0]+q[0]))return null;
  let t=rulerFraction(x,y,p,q),kind=snap?'край':'стержень';
  if(snap){const da=Math.hypot(p[0]-x,p[1]-y),db=Math.hypot(q[0]-x,q[1]-y);if(Math.min(da,db)<=7){t=da<db?0:1;kind='вершина';}}
  const sx=p[0]+t*(q[0]-p[0]),sy=p[1]+t*(q[1]-p[1]),miss=Math.hypot(sx-x,sy-y);
  if(miss>(snap?12:5))return null;
  const depth=p[2]+t*(q[2]-p[2]);
  if(g.walk){
   const f=g.walkBasis().forward,dist=end=>end.reduce((sum,v,i)=>sum+(v+(off?.[i]||0)*1000-g.walk.position[i])*f[i],0);
   const da=dist(a),db=dist(b);t=t*da/((1-t)*db+t*da);
  }
  return {layer,p:a.map((v,i)=>v+t*(b[i]-v)),kind,miss,depth,sx,sy,edge:[a,b],edgePixels:Math.hypot(p[0]-q[0],p[1]-q[1])};
 }
 visibleHit(hit){
  const cover=this.surface(hit.sx,hit.sy);
  return !cover||cover.layer.opacity<.3||hit.depth<=this.g.project(cover.p,cover.layer.actualOffset)[2]+1e-5;
 }
 hit(x,y,anchor){
  const g=this.g,face=this.surface(x,y),snap=this.mode.value!=='free',strict=this.mode.value==='perpendicular'&&anchor,candidates=[];
  const layers=new Set();
  if(snap){
   if(face)layers.add(face.layer);
   for(const [dx,dy] of [[-8,0],[8,0],[0,-8],[0,8]]){const nearby=this.surface(x+dx,y+dy);if(nearby)layers.add(nearby.layer);}
   for(const layer of layers)for(const edge of this.segments(layer)){
    const candidate=this.candidate(x,y,layer,...edge,true);
    if(candidate){
     if(anchor){layer.rulerRuns??=rulerStraightRuns(layer.featureSegments);candidate.edge=layer.rulerRuns.get(edge)||candidate.edge;}
     candidates.push(candidate);
    }
   }
  }
  for(const {a,b,layer:id} of g.hitSegments){
   const layer=g.layers.get(id);if(!this.available(layer))continue;
   const candidate=this.candidate(x,y,layer,a,b,snap);if(candidate)candidates.push(candidate);
  }
  // Top and bottom edges in the plan view can project a fraction of a pixel
  // apart. Resolve these screen-space ties in favour of the visible front edge.
  const pixelBand=distance=>Math.round(distance*2);
  candidates.sort((a,b)=>Number(b.kind==='вершина')-Number(a.kind==='вершина')||pixelBand(a.miss)-pixelBand(b.miss)||a.depth-b.depth||a.miss-b.miss);
  if(anchor&&snap){
   const projected=[];
   for(const hit of candidates){
    if(hit.edgePixels<1)continue;
    const foot=rulerPerpendicular(anchor.p,...hit.edge);
    if(!foot||foot[2]>g.clipZ+.002)continue;
    const [sx,sy,depth]=g.project(foot,hit.layer.actualOffset),distance=Math.hypot(sx-x,sy-y);
    if(!Number.isFinite(distance)||!strict&&distance>rulerAutoPerpendicularPx)continue;
    projected.push({hit,foot,sx,sy,depth,distance});
   }
   // At a corner several edges share the same pointer hit. Prefer the foot
   // nearest to the indicated position and test visibility at both locations.
   projected.sort((a,b)=>pixelBand(a.hit.miss)-pixelBand(b.hit.miss)||pixelBand(a.distance)-pixelBand(b.distance)||a.depth-b.depth||a.distance-b.distance);
   for(const p of projected){
    const result={layer:p.hit.layer,p:p.foot,kind:'край',perpendicularEdge:p.hit.edge,sx:p.sx,sy:p.sy,depth:p.depth};
    if(this.visibleHit(p.hit)&&this.visibleHit(result))return result;
   }
   if(strict)return null;
  }
  for(const candidate of candidates)if(this.visibleHit(candidate))return candidate;
  if(face)face.kind='поверхность';
  return face;
 }
 pick(clientX,clientY,index){
  if(!this.active||index===undefined&&this.points.length===2)return;
  const i=index??this.points.length,other=this.points[1-i],box=this.g.canvas.getBoundingClientRect();
  const slide=this.mode.value!=='free'&&rulerAngleIndex(this.points)===1-i;
  const hit=this.hit(clientX-box.left,clientY-box.top,slide?null:other);
  if(!hit){if(this.mode.value==='perpendicular'&&other)this.output.textContent='Укажите край, на который попадает перпендикуляр.';else if(index===undefined)this.output.textContent='Укажите видимую поверхность или стержень.';return;}
  if(slide){
   const p=rulerPerpendicular(hit.p,...other.perpendicularEdge);
   if(p&&this.available(other.layer)&&p[2]<=this.g.clipZ+.002){
    const [sx,sy,depth]=this.g.project(p,other.layer.actualOffset);
    if(Number.isFinite(sx+sy)&&this.visibleHit({sx,sy,depth})){other.p=p;}
    else if(this.mode.value==='perpendicular')return;
   }else if(this.mode.value==='perpendicular')return;
  }
  this.points[i]=hit;this.describe();this.draw();
 }
 describe(){
  const strict=this.mode.value==='perpendicular';
  this.output.removeAttribute('title');
  if(this.g.walk&&this.points.length<2){
   this.output.textContent=this.points.length?(strict?'Выберите край стены':'Укажите точку Б'):'Укажите точку А';
   return;
  }
  if(!this.points.length)this.output.textContent=strict?'Укажите точку А, затем край стены.':'Укажите точки А и Б. Концы отрезка можно перетаскивать.';
  else if(this.points.length===1)this.output.textContent=`А · ${this.points[0].kind}. ${strict?'Выберите край для перпендикуляра.':'Укажите точку Б.'}`;
  else{
   const [a,b]=this.points,delta=b.p.map((v,i)=>v-a.p[i]),format=v=>Math.round(v).toLocaleString('ru-RU');
   const angle=rulerAngleIndex(this.points);
   if(this.g.walk){
    this.output.textContent=`≈ ${format(Math.hypot(...delta))} мм${angle>=0?' · 90°':''} · в плане ${format(Math.hypot(...delta.slice(0,2)))} мм`;
    this.output.title=delta.map((v,i)=>'Δ'+'XYZ'[i]+' '+format(v)+' мм').join(' / ');return;
   }
   this.output.textContent=`По модели ≈ ${format(Math.hypot(...delta))} мм${angle>=0?' · 90°':''} · в плане ${format(Math.hypot(...delta.slice(0,2)))} мм · ${delta.map((v,i)=>'Δ'+'XYZ'[i]+' '+format(v)).join(' / ')} мм · А: ${a.kind}, Б: ${b.kind}`;
  }
 }
 available(l){const g=this.g;return l?.visible&&l.opacity>.001&&(!l.dependsOn||g.layers.get(l.dependsOn)?.visible&&g.layers.get(l.dependsOn).opacity>.001);}
 draw(){
  this.handles.draw(this.points.map(({layer,p})=>{
   if(!this.available(layer)||p[2]>this.g.clipZ+.002)return null;
   const q=this.g.project(p,layer.actualOffset);return Number.isFinite(q[0])?q:null;
  }),rulerAngleIndex(this.points));
 }
}

export { SceneRuler, RulerHandles, rulerFraction, rulerPerpendicular, rulerStraightRuns, rulerAngleIndex, rulerAutoPerpendicularPx, rulerControls };
