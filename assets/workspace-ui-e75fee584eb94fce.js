import { createPagesAssets } from './resource-loader-e11b69ad87b832cd.js';
import { RulerHandles, rulerFraction, rulerPerpendicular, rulerStraightRuns, rulerAngleIndex, rulerAutoPerpendicularPx, rulerControls } from './measure-39918d7e9b6c186b.js';
let HouseGL, FloorGeometry, RebarLayout, renderMaterialsPage, renderServicesPage, renderRoofPage, renderAuditPage, renderSheetsPage, scanRoofContacts, roofRafterStockReport;
const pagesAssets = createPagesAssets({
  'renderer': [() => import('./renderer-7039b61622eb0d89.js'), module => { HouseGL = module.HouseGL; }],
  'floor': [() => import('./floor-7edfc0e65e8f05fa.js'), module => { FloorGeometry = module.FloorGeometry; }],
  'rebar': [() => import('./rebar-7477b2dbfa23e7fc.js'), module => { RebarLayout = module.RebarLayout; }],
  'materials-ui': [() => import('./materials-ui-49789c7dacd37d5d.js'), module => { renderMaterialsPage = module.renderMaterialsPage; }],
  'services-ui': [() => import('./services-ui-5034fc9dd496883a.js'), module => { renderServicesPage = module.renderServicesPage; }],
  'roof-ui': [() => import('./roof-ui-207747455aa045a0.js'), module => { renderRoofPage = module.renderRoofPage; }],
  'audit-ui': [() => import('./audit-ui-44ad8c112bb42cfc.js'), module => { renderAuditPage = module.renderAuditPage; }],
  'sheets-ui': [() => import('./sheets-ui-c3b620b8d17ed707.js'), module => { renderSheetsPage = module.renderSheetsPage; }],
  'roof-audit-js': [() => import('./roof-contact-audit-266f230224d78966.js'), module => { ({ scanRoofContacts, roofRafterStockReport } = module.createRoofContactAudit({ MODEL, renderer, n, activeSlab, HouseShapes, cutRoofCell, clipDisplaySolid, clipSolidToFootprint, roofBeltInsulationPrisms, ventBodyBounds, vk2InsulationPrisms, wallDisplayPieces, frameAxes, frameDisplaySolids, framePieces, rafterRidgePurlin, roofFrameMember, roofCornerSupport, clipContactFace, contactCross, contactDot, contactSub, measureRoofContact, roofCommonFaces, roofContactArea, roofContactPrism, roofContactRect, roofContactReports, roofContactSolid, roofContactTolerance, roofConvexVolume })); }],
});
/* The scan is a visual underlay. Snap coordinates come from the dimensioned
 * model. Free points use the sheet registration and are approximate. */
let activeSheetRuler=null;
function embeddedDrawing(uri){
 let source=pagesAssets?.drawings.get(uri);
 if(!source&&uri?.startsWith('data:image/svg+xml;base64,')){
  const bytes=Uint8Array.from(atob(uri.split(',')[1]),c=>c.charCodeAt(0));
  source=new TextDecoder().decode(bytes);
 }
 if(!source)return null;
 const doc=new DOMParser().parseFromString(source,'image/svg+xml');
 const svg=document.importNode(doc.documentElement,true);
 svg.classList.add('typeset-sheet');
 return svg;
}
class SheetRuler {
 constructor(host,bar,key,{sites=[],crop=false,onChange=null,sourceImage=null}={}){
  this.host=host;this.bar=bar;this.rev=DATA.revisions[key];this.key=key;
  this.sites=sites;this.onChange=onChange;this.points=[];this.active=false;
  const [ox,oy,ax,ay,bx,by]=this.rev.registration;
  this.matrix=new DOMMatrix([ax,ay,bx,by,ox,oy]);this.inverse=this.matrix.inverse();
  const full=this.rev.viewBox,[,,width,height]=full;
  const outline=MODEL.foundation.slab.render_polygon_mm.map(p=>p.map(Number));
  const loop=points=>points.map((a,i)=>[a,points[(i+1)%points.length]]);
  this.segments=loop(outline);
  if(key.startsWith('house_1')){
   for(const wall of MODEL.floor1.walls){
    const bounds=wall.bounds_mm.map(Number),axis=wall.axis,start=bounds[axis],end=bounds[axis+2];
    const openings=MODEL.floor1.openings.filter(o=>o.wall_id===wall.id).map(o=>o.bounds_mm.map(Number)).sort((a,b)=>a[axis]-b[axis]);
    const panel=(lo,hi)=>{
     if(hi<=lo)return;
     const box=[...bounds];box[axis]=lo;box[axis+2]=hi;
     const [x,y,u,v]=box;this.segments.push(...loop([[x,y],[u,y],[u,v],[x,v]]));
    };
    let cursor=start;
    for(const o of openings){panel(cursor,Math.min(end,o[axis]));cursor=Math.max(cursor,o[axis+3]);}
    panel(cursor,end);
   }
  }else this.segments.push(...MODEL.foundation.plinth.boundary_edges_mm.map(edge=>edge.map(p=>p.map(Number))));
  this.bounds=key==='house_2:10'?[11800,2450,15200,16200]:[-800,-950,15400,16500];
  if(key==='house_2:10')this.segments=this.segments.filter(([a,b])=>a[0]>=11800&&b[0]>=11800);
  this.runs=rulerStraightRuns(this.segments);
  const left=(width-1600)/2;
  const regions={'house_1:4':[280,55,990,970],'house_1:6':[200,130,1100,920],'house_2:7':[102,67,855,825],'house_2:10':[900,105,615,690],'embeds:1':[96,85,863,820]};
  const [x,y,w,h]=regions[key];this.crop=[left+x,58+y,w,h];this.full=full;
  this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');this.svg.classList.add('sheet-art');
  this.svg.setAttribute('role','img');this.svg.setAttribute('aria-label','Редакция листа без дуги');
  const vector=embeddedDrawing(sourceImage||this.rev.image);
  this.svg.innerHTML=vector?'<g class="plan-sites"></g>':`<image x="0" y="0" width="${width}" height="${height}" href="${sourceImage||this.rev.image}"/><g class="plan-sites"></g>`;
  if(vector){vector.setAttribute('width',width);vector.setAttribute('height',height);this.svg.prepend(vector);}
  const scroll=document.createElement('div');scroll.className='sheet-scroll';host.before(scroll);scroll.append(host);this.scroll=scroll;
  host.append(this.svg);
  this.handles=new RulerHandles(host,(i,e)=>this.pick(e,i));
  bar.innerHTML=rulerControls()+'<button type="button" class="sheet-zoom"></button><button type="button" class="zoom-minus" aria-label="Уменьшить масштаб">−</button><button type="button" class="zoom-plus" aria-label="Увеличить масштаб">+</button>';
  this.toggle=bar.querySelector('.ruler-toggle');this.mode=bar.querySelector('select');this.reset=bar.querySelector('.ruler-reset');this.out=bar.querySelector('output');
  this.level=1;this.plus=bar.querySelector('.zoom-plus');this.minus=bar.querySelector('.zoom-minus');this.plus.onclick=()=>this.magnify(1.5);this.minus.onclick=()=>this.magnify(1/1.5);
  this.zoom=bar.querySelector('.sheet-zoom');this.zoom.onclick=()=>this.frame(!this.cropped);
  this.toggle.onclick=()=>this.enable(!this.active);this.reset.onclick=()=>{this.points=[];this.refresh();};
  this.mode.onchange=()=>{
   if(this.mode.value==='perpendicular'&&this.points.length===2&&rulerAngleIndex(this.points)<0){
    const [clientX,clientY]=this.screen(this.points.pop().p);
    this.pick({clientX,clientY},1);
   }
   this.refresh();
  };
  this.svg.onpointerdown=e=>{this.down=[e.clientX,e.clientY];};
  this.svg.onpointercancel=()=>{this.down=null;};
  this.svg.onpointerup=e=>{if(this.active&&this.down&&Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])<5&&this.points.length<2)this.pick(e,this.points.length);this.down=null;};
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(host);
  this.frame(crop);this.enable(false);
 }
 frame(crop){
  this.cropped=crop;const box=crop?this.crop:this.full;
  this.svg.setAttribute('viewBox',box.join(' '));this.svg.style.aspectRatio=box[2]+'/'+box[3];
  this.zoom.textContent=crop?'Весь лист':'Область плана';this.level=1;this.magnify(1);
 }
 magnify(factor){
  const old=this.level,s=this.scroll;
  const fx=(s.scrollLeft+s.clientWidth/2)/(this.host.offsetWidth||1),fy=(s.scrollTop+s.clientHeight/2)/(this.host.offsetHeight||1);
  this.level=Math.max(1,Math.min(3.375,old*factor));this.host.style.width=(100*this.level)+'%';
  this.plus.disabled=this.level>=3.375;this.minus.disabled=this.level<=1;
  if(old!==this.level){s.scrollLeft=fx*this.host.offsetWidth-s.clientWidth/2;s.scrollTop=fy*this.host.offsetHeight-s.clientHeight/2;}
  this.draw();
 }
 dispose(){this.observer.disconnect();}
 enable(active){this.active=active;this.toggle.setAttribute('aria-pressed',String(active));this.host.classList.toggle('measuring',active);this.mode.hidden=this.reset.hidden=this.out.hidden=!active;this.refresh();}
 sheetPoint(p){return new DOMPoint(...p).matrixTransform(this.matrix);}
 screen(p){const matrix=this.svg.getScreenCTM();if(!matrix)return [0,0];const pt=this.sheetPoint(p).matrixTransform(matrix);return [pt.x,pt.y];}
 pick(e,index){
  if(!this.active)return;
  const pixel=new DOMPoint(e.clientX,e.clientY).matrixTransform(this.svg.getScreenCTM().inverse()).matrixTransform(this.inverse);
  const [x,y,u,v]=this.bounds;if(pixel.x<x||pixel.x>u||pixel.y<y||pixel.y>v){this.out.textContent='Укажите точку внутри области плана.';return;}
  let point={p:[pixel.x,pixel.y],kind:'свободно'};
  const other=this.points[1-index];
  if(this.mode.value!=='free'){
   const slide=rulerAngleIndex(this.points)===1-index;
   const anchor=slide?null:other,strict=this.mode.value==='perpendicular'&&anchor;
   let best=null,normal=null;
   const consider=(p,kind,rank,radius,site)=>{
    const q=this.screen(p),dist=Math.hypot(e.clientX-q[0],e.clientY-q[1]);
    if(dist<=radius&&(!best||rank<best.rank||rank===best.rank&&dist<best.dist))best={p,kind,rank,dist,site};
   };
   for(const site of this.sites)consider([+site.x_mm,+site.y_mm],site.label,0,11,site);
   for(const edge of this.segments){
    const [a,b]=edge;
    consider(a,'вершина',1,7);consider(b,'вершина',1,7);
    const t=rulerFraction(e.clientX,e.clientY,this.screen(a),this.screen(b));
    const near=a.map((n,i)=>n+t*(b[i]-n));
    consider(near,'край',2,11);
    if(!anchor)continue;
    const q=this.screen(near),miss=Math.hypot(q[0]-e.clientX,q[1]-e.clientY);
    if(miss>11)continue;
    const support=this.runs.get(edge)||edge,foot=rulerPerpendicular(anchor.p,...support);
    if(!foot)continue;
    const f=this.screen(foot),distance=Math.hypot(f[0]-e.clientX,f[1]-e.clientY);
    if(!strict&&distance>rulerAutoPerpendicularPx)continue;
    if(!normal||miss<normal.miss||miss===normal.miss&&distance<normal.distance)
     normal={p:foot,kind:'край',perpendicularEdge:support,miss,distance};
   }
   if(strict&&!normal){this.out.textContent='Укажите край, на который попадает перпендикуляр.';return;}
   if(normal&&(strict||!best?.site))point=normal;
   else if(best)point=best;
   if(slide){
    const foot=rulerPerpendicular(point.p,...other.perpendicularEdge);
    if(foot)other.p=foot;
    else if(this.mode.value==='perpendicular')return;
   }
  }
  this.points[index]=point;this.refresh();
 }
 refresh(){
  const [a,b]=this.points;
  const strict=this.mode.value==='perpendicular',angle=rulerAngleIndex(this.points);
  this.out.textContent=a&&b?`А–Б ≈ ${fmt(Math.hypot(...a.p.map((n,i)=>n-b.p[i])),0)} мм${angle>=0?' · 90°':''} · А: ${a.kind}, Б: ${b.kind}`:a?(strict?'Выберите край для перпендикуляра.':'Укажите точку Б.'):(strict?'Укажите точку А, затем край стены.':'Укажите точки А и Б на плане.');
  this.draw();if(this.onChange)this.onChange(this.points);
 }
 draw(){
  if(!this.handles)return;
  const box=this.host.getBoundingClientRect();
  this.handles.draw(this.active?this.points.map(({p})=>{const [x,y]=this.screen(p);return [x-box.left,y-box.top];}):[],rulerAngleIndex(this.points));
 }
 markSites(){
  const group=this.svg.querySelector('.plan-sites');
  group.innerHTML=this.sites.map(s=>{
   const {x,y}=this.sheetPoint([+s.x_mm,+s.y_mm]);
   return `<circle cx="${x}" cy="${y}" r="4.7" fill="none" stroke="${s.proposal?'#b15519':'#00715c'}" stroke-width="1.6"/>`+(s.proposal?`<text x="${x+8}" y="${y-8}" fill="#9d4714" font-size="11">В1*</text>`:'');
  }).join('');
 }
}

// Archival sheets can contain several independently scaled views. The reader
// calibrates on a printed dimension within the view they intend to measure.
class ScanRuler {
 constructor(host,bar,img){
  this.host=host;this.img=img;this.bar=bar;this.points=[];this.scale=0;this.closed=false;this.wall=[];
  host.classList.add('measuring');
  this.handles=new RulerHandles(host,(i,e)=>this.pick(i,e));this.handles.draw([]);
  this.guide=document.createElementNS('http://www.w3.org/2000/svg','path');this.guide.setAttribute('class','scan-wall-guide');this.handles.svg.append(this.guide);
  bar.innerHTML='<label>Режим <select class="scan-mode"><option value="free">Свободная</option><option value="snap">Привязка к штрихам</option><option disabled value="perpendicular">Перпендикуляр к стене · 90°</option></select></label><label class="scan-length">Подписанный размер, мм <input type="number" min="0.001" step="any" inputmode="decimal"></label><button class="scan-apply" disabled>Применить масштаб</button><button class="scan-reset">Сбросить точки</button><button class="scan-wall-reset" hidden>Выбрать другую стену</button><button class="scan-calibrate" hidden>Задать масштаб заново</button><output aria-live="polite"></output>';
  this.mode=bar.querySelector('select');this.input=bar.querySelector('input');this.out=bar.querySelector('output');this.apply=bar.querySelector('.scan-apply');
  const calibrate=bar.querySelector('.scan-calibrate');
  const normal=this.mode.querySelector('[value=perpendicular]'),wallReset=bar.querySelector('.scan-wall-reset');
  this.mode.onchange=()=>{if(this.wall.length||this.mode.value==='perpendicular')this.points=[];this.wall=[];wallReset.hidden=this.mode.value!=='perpendicular';this.refresh();};
  wallReset.onclick=()=>{this.wall=[];this.points=[];this.refresh();};
  this.apply.onclick=()=>{
   const size=this.input.valueAsNumber,ref=this.distance();
   if(!(size>0&&Number.isFinite(size)&&ref>0))return;
   this.scale=size/ref;normal.disabled=false;this.points=[];this.input.closest('label').hidden=this.apply.hidden=true;calibrate.hidden=false;this.refresh();
  };
  calibrate.onclick=()=>{this.mode.value='free';normal.disabled=true;this.wall=[];wallReset.hidden=true;this.scale=0;this.points=[];this.input.value='';this.input.closest('label').hidden=this.apply.hidden=false;calibrate.hidden=true;this.refresh();};
  bar.querySelector('.scan-reset').onclick=()=>{this.points=[];this.refresh();};
  this.input.oninput=()=>this.refresh();
  img.onpointerdown=e=>{this.down=[e.clientX,e.clientY];};
  img.onpointercancel=()=>{this.down=null;};
  img.onpointerup=e=>{if(this.down&&this.points.length<2&&Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])<5)this.pick(this.points.length,e);this.down=null;};
  img.draggable=false;this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(host);
  img.decode().then(()=>{
   if(this.closed)return;
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);this.ink=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  }).catch(()=>{this.mode.querySelector('[value=snap]').disabled=true;});
  this.refresh();
 }
 dispose(){this.closed=true;this.observer.disconnect();this.ink=null;}
 distance(){const [a,b]=this.points;return a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;}
 pick(i,e){
  const img=this.img,r=img.getBoundingClientRect(),factor=img.naturalWidth/r.width;
  let x=(e.clientX-r.left)*factor,y=(e.clientY-r.top)*factor;
  if(!factor||x<0||y<0||x>img.naturalWidth||y>img.naturalHeight)return;
  if(this.mode.value==='snap'&&this.ink){
   const radius=Math.min(70,9*factor);let best=radius*radius;
   const ox=x,oy=y,w=img.naturalWidth,h=img.naturalHeight;
   for(let py=Math.max(0,Math.floor(oy-radius));py<Math.min(h,oy+radius+1);py++)for(let px=Math.max(0,Math.floor(ox-radius));px<Math.min(w,ox+radius+1);px++){
    const d=(px-ox)**2+(py-oy)**2;if(d<best&&this.ink[(py*w+px)*4]<135){best=d;x=px;y=py;}
   }
  }
  if(this.mode.value==='perpendicular'){
   if(this.wall.length<2){
    if(!this.wall.length||Math.hypot(x-this.wall[0][0],y-this.wall[0][1])>=5*factor)this.wall.push([x,y]);
   }else if(i===0){
    const foot=rulerPerpendicular([x,y],...this.wall);
    if(!foot){this.out.textContent='Перпендикуляр выходит за выбранный участок стены.';return;}
    this.points=[[x,y],foot];
   }else{
    const [a,b]=this.wall,t=rulerFraction(x,y,a,b),foot=a.map((v,k)=>v+t*(b[k]-v));
    const shifted=this.points[0].map((v,k)=>v+foot[k]-this.points[1][k]);
    if(shifted[0]<0||shifted[0]>img.naturalWidth||shifted[1]<0||shifted[1]>img.naturalHeight)return;
    this.points=[shifted,foot];
   }
  }else this.points[i]=[x,y];
  this.refresh();
 }
 draw(){
  const img=this.img,box=this.host.getBoundingClientRect(),r=img.getBoundingClientRect(),factor=r.width/img.naturalWidth;
  const screen=([x,y])=>[r.left-box.left+x*factor,r.top-box.top+y*factor];
  const wall=this.wall.map(screen),marks=wall.map(([x,y])=>`M${x-4} ${y}h8 M${x} ${y-4}v8`).join(' ');
  this.guide.setAttribute('d',marks+(wall.length===2?` M${wall[0]} L${wall[1]}`:''));
  this.handles.draw(this.points.map(screen),wall.length===2?1:-1);
 }
 refresh(){
  this.apply.disabled=!(this.input.valueAsNumber>0&&this.distance()>0);
  const measured=this.distance()*this.scale;
  this.out.textContent=this.scale?(this.points.length===2?`А–Б ≈ ${fmt(measured,0)} мм по скану. Концы можно перетаскивать.`:'Укажите две точки в той же проекции.'):'Укажите оба конца известного размера и введите число с листа.';
  if(this.mode.value==='perpendicular'){
   const steps=['Отметьте начало прямого участка стены.','Отметьте конец этого участка.','Укажите точку А, от которой измерять до стены.'];
   this.out.textContent=this.points.length===2?`А–Б ≈ ${fmt(measured,0)} мм по скану · 90°. Точка Б сдвигает мерку вдоль стены.`:steps[this.wall.length];
  }
  this.draw();
 }
}

'use strict';
let floorRenderer=null,floorScenario=null,floorSelectedRow=1,floorCourseLevel='lower';
function drawFloorOverview(g,l,visible){
 const frame=addLayer(g,'floor1Frame',{visible,explodeOrder:1,order:10}),brick=addLayer(g,'floor1Brick',{visible,explodeOrder:1,order:10}),lintel=addLayer(g,'floor1Lintels',{visible,explodeOrder:1,order:10});
 for(const s of FloorGeometry.solids(MODEL.floor1)){drawStairAwareBox(g,s.material==='frame'?frame:l,s.bounds,'wall:'+s.wall_id,false);}
 for(const s of MODEL.floor1.lintel_envelopes)g.box(lintel,...s.bounds_mm.map(Number),'floor-lintel:'+s.id,false);
 for(const s of MODEL.floor1.brick_envelopes){const [x0,y0,x1,y1]=s.bounds_mm.map(Number);g.box(brick,x0,y0,-130,x1,y1,3020,'floor-brick:'+s.id);}
}
function openFloorWall(id){const w=MODEL.floor1.walls.find(w=>w.id===id);if(!w)return;const oo=MODEL.floor1.openings.filter(o=>o.wall_id===id);showDialog('АР-3 / АР-5 / РАЗМЕРНЫЙ ВАРИАНТ',w.label,`<span class="status amber">derived · I002 / I010 / I014</span><p>${esc(w.note||'Привязка по осям и подписанным размерам. Полная порядовка этого участка — в разделе «Кладка».')}</p><p>Материал: ${w.material==='aac'?'газобетон':'каркасная перегородка'} · низ −0.130 · верх среза +3.020 м.</p><div class="formula">[X0,Y0,X1,Y1] = [${w.bounds_mm.join(', ')}] мм</div><details><summary>Формулы и источники границ</summary>${w.formulas.map((x,i)=>`<p class="hash">${['X0','Y0','X1','Y1'][i]} = ${esc(x)}</p>`).join('')}${w.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label)).join('<br>')}</details><p class="tiny muted">${esc(MODEL.floor1.opening_box_padding_note)}</p><h3 style="margin-top:20px">Проёмы</h3>${oo.length?oo.map(o=>`<p><b>${esc(o.label)}</b><br><span class="tiny muted">[X0,Y0,Z0,X1,Y1,Z1] = ${o.bounds_mm.join(', ')} мм</span><br>${esc(o.note)} ${o.source_fact_ids.map(i=>factBtn(i)).join(' ')}</p>`).join(''):'<p>На этом участке проёмов в модели нет.</p>'}${sheetBtn('house_1',4)}${sheetBtn('house_1',6)}${sheetBtn('house_2',16)}`);}
function floorCourseModel(){return MODEL[floorCourseLevel==='upper'?'floor2':'floor1'];}
function floorRowSVG(row){
 const model=floorCourseModel(),upper=floorCourseLevel==='upper',previous=floorScenario.rows[row.index-2];
 const color=p=>Math.min(p.bounds_mm[p.axis+3]-p.bounds_mm[p.axis],p.bounds_mm[5]-p.bounds_mm[2])<100?'#b06f52':p.cut?'#b99159':'#839b68';
 const outline=p=>p.polygon_mm.map(q=>q[0]+','+q[1]).join(' ');
 return `<svg class="plan-svg" viewBox="-1200 -17100 17400 18400" role="img" aria-label="${upper?'Мансарда':'Первый этаж'} · план ряда ${row.index}"><g transform="scale(1,-1)">${model.walls.map(w=>{const r=w.bounds_mm.map(Number);return `<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="${w.material==='frame'?'#bacdc6':'#dfe4d7'}"/>`;}).join('')}${row.pieces.map(p=>{const r=p.bounds_mm;return upper?`<polygon points="${outline(p)}" fill="${color(p)}" stroke="#fff" stroke-width="10"><title>${esc(p.stock_key)} · ${fmt(p.volume_m3,6)} м³ · фрагмент по скату</title></polygon>`:`<rect x="${r[0]}" y="${r[1]}" width="${r[3]-r[0]}" height="${r[4]-r[1]}" fill="${color(p)}" stroke="#fff" stroke-width="10"><title>${esc(p.wall_id)} · ${fmt(r[3]-r[0])}×${fmt(r[4]-r[1])}×${fmt(r[5]-r[2])} мм</title></rect>`;}).join('')}${!upper?model.brick_envelopes.map(w=>{const r=w.bounds_mm.map(Number);return `<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="#996f55"/>`;}).join(''):''}${$('floor-show-joints')?.checked&&previous?(upper?previous.pieces.map(p=>`<polygon points="${outline(p)}" fill="none" stroke="#3c719a" stroke-width="15" stroke-dasharray="50 25"/>`).join(''):previous.joints.filter(j=>Math.abs(j.top_mm-previous.top_mm)<.001).map(j=>`<path d="${j.axis===0?'M'+j.at_mm+','+j.cross0_mm+'V'+j.cross1_mm:'M'+j.cross0_mm+','+j.at_mm+'H'+j.cross1_mm}" stroke="#3c719a" stroke-width="22" stroke-dasharray="50 25"/>`).join('')):''}</g><text x="0" y="700" font-size="260" fill="#637354">${upper?'Мансарда':'1-й этаж'} · ряд ${row.index} · ${fmt(row.z_mm)}…${fmt(row.top_mm)} мм</text></svg>`;
}
function initFloorCourses(){
 const mount=document.createElement('div');mount.id='floor-courses';
 mount.innerHTML=`<div class="buttons-row"><button onclick="HouseApp.activateTab('model','masonry3d')">Кладка обоих этажей вместе в 3D ↗</button></div><div class="callout" id="floor-course-note"></div>
 <div class="card" style="margin-top:22px"><div class="row-controls floor-course-controls"><label>Этаж<select id="floor-course-level"><option value="lower">Первый этаж</option><option value="upper">Мансарда</option></select></label><label>Высота блока, мм<input id="floor-block-height" type="number" value="250" min="50" max="500" step="0.1"></label><label>Шов, мм<input id="floor-block-joint" type="number" value="2" min="1" max="3" step="0.1"></label><label>Первая постель, мм<input id="floor-block-bed" type="number" value="20" min="0" max="100" step="0.1"></label><label>Показать<select id="floor-row-display"><option value="ghost">Ряд + прозрачный этаж</option><option value="only">Только выбранный ряд</option><option value="upto">До выбранного ряда</option><option value="all">Весь этаж</option></select></label></div>
 <div class="viewport" id="floor-course-view"><canvas id="floor-course-canvas" tabindex="0" aria-label="3D-порядовка выбранного этажа"></canvas><div class="viewport-top"><span class="status amber" id="floor-course-status"></span></div><div class="view-tools"><button id="floor-iso">3D</button><button id="floor-top">Сверху</button><button id="floor-zoom-in">+</button><button id="floor-zoom-out">−</button><button id="floor-fullscreen" type="button" title="На весь экран" aria-label="На весь экран" aria-pressed="false">⛶</button></div><div class="scene-help">ЛКМ — вращать · Shift — сдвиг · колесо — масштаб</div></div>
 <div class="row-slider scene-course-controls" id="floor-row-controls"><label for="floor-row-select">Ряд этажа</label><input id="floor-row-select" type="range" min="1" max="13" value="1"><output id="floor-row-current" for="floor-row-select">1 / 13</output></div><div id="floor-row-summary" class="formula"></div><div class="buttons-row"><span id="floor-course-sources"></span></div></div>
 <div class="section-grid"><div class="card"><h3>План выбранного ряда</h3><label class="control"><input id="floor-show-joints" type="checkbox"> <span id="floor-previous-label">Швы предыдущего ряда</span></label><div id="floor-row-plan"></div><div id="floor-bond-summary" class="formula"></div><div class="legend"><span><i style="--c:#839b68"></i>Блок</span><span><i style="--c:#b99159"></i>Подрезка</span><span><i style="--c:#b06f52"></i>Менее 100 мм · проверить</span><span><i style="--c:#bacdc6"></i>Каркас</span></div></div><div class="card"><h3>Детали по стенам</h3><label>Выбрать стену<select id="floor-wall-list"></select></label><div id="floor-wall-details"></div></div></div>
 <div class="card" id="floor-course-dependencies"></div><h3 style="margin:35px 0 12px">Контроль отдельного прямого участка</h3>`;
 $('page-masonry').querySelector('.page-heading').insertAdjacentElement('afterend',mount);
 try{floorRenderer=new HouseGL($('floor-course-canvas'),id=>{if(id.startsWith('wall:')){$('floor-wall-list').value=id.slice(5);renderFloorDetails();}});floorRenderer.yaw=-.5;floorRenderer.pitch=.55;floorRenderer.target=[6800,7600,1400];floorRenderer.span=21000;}catch(e){$('floor-course-view').insertAdjacentHTML('beforeend',`<div class="render-error">${esc(e.message)}</div>`);}
 if(floorRenderer)initSceneFullscreen($('floor-course-view'),$('floor-fullscreen'),floorRenderer,$('floor-row-controls'));
 $('floor-course-level').onchange=e=>{
  floorCourseLevel=e.target.value;$('floor-row-select').value=1;floorSelectedRow=1;
  if(floorRenderer){floorRenderer.target=floorCourseLevel==='upper'?[7000,7900,5100]:[6800,7600,1400];floorRenderer.pan=[0,0];}
  updateFloorCourses(true);
 };
 for(const id of ['floor-block-height','floor-block-joint','floor-block-bed'])$(id).oninput=()=>updateFloorCourses(true);
 $('floor-row-select').oninput=()=>updateFloorCourses(false);$('floor-show-joints').onchange=()=>updateFloorCourses(false);$('floor-row-display').onchange=()=>updateFloorCourses(false);$('floor-wall-list').onchange=()=>renderFloorDetails();
 $('floor-iso').onclick=()=>{floorRenderer.yaw=-.5;floorRenderer.pitch=.55;floorRenderer.request();};$('floor-top').onclick=()=>{floorRenderer.yaw=0;floorRenderer.pitch=.00001;floorRenderer.request();};$('floor-zoom-in').onclick=()=>{floorRenderer.span*=.8;floorRenderer.request();};$('floor-zoom-out').onclick=()=>{floorRenderer.span*=1.25;floorRenderer.request();};
 updateFloorCourses(true);
}
function updateFloorCourses(rebuild){
 const inputs=['floor-block-height','floor-block-joint','floor-block-bed'].map($);if(inputs.some(e=>e.value===''||!e.validity.valid)){$('floor-row-summary').textContent='Проверьте параметры; новый результат не рассчитан.';return;}
 const upper=floorCourseLevel==='upper',model=floorCourseModel();
 if(rebuild||!floorScenario){
  const params={height:+inputs[0].value,joint:+inputs[1].value,bed:+inputs[2].value,length:625};floorScenario=upper?HouseShapes.upperCourses(model,params):FloorGeometry.courses(model,params);
  $('floor-course-note').innerHTML=upper?'<b>Мансарда · ряды под скатами</b>Газобетонные части подрезаны по условной оболочке кровли и исходным проёмам. Синим фоном показаны каркасные перегородки; они не считаются газоблоками. Верхние перемычки, пояса и пространственная перевязка не назначены. Это сценарий для проверки, не монтажная или закупочная ведомость.':`<b>Первый этаж · порядовка всех смоделированных стен</b>Учтены ${model.openings.length} выреза, зоны перемычек и кирпичных вентблоков. Высота блока250 мм — каталог; шов и постель — параметры сценария. Привязки санузла2/ВК-2 и подрезки требуют проверки; это не монтажная или закупочная ведомость.`;
  $('floor-course-status').textContent=upper?'Мансарда · условный верх · I016':'Первый этаж · сценарий · I014';
  $('floor-previous-label').textContent=upper?'Контуры предыдущего ряда':'Швы предыдущего ряда';
  $('floor-course-sources').innerHTML=upper?sheetBtn('house_1',5,'АР-4 · размеры')+sheetBtn('house_1',7,'АР-6 · марки')+sheetBtn('house_2',17,'КЖ-12 · перемычки'):sheetBtn('house_1',4,'АР-3 · размеры')+sheetBtn('house_1',6,'АР-5 · марки')+sheetBtn('house_2',16,'КЖ-11 · перемычки');
  const selected=$('floor-wall-list').value;$('floor-wall-list').innerHTML='<option value="all">Все стены</option>'+model.walls.filter(w=>w.material==='aac').map(w=>`<option value="${w.id}">${esc(w.label)}</option>`).join('');$('floor-wall-list').value=model.walls.some(w=>w.id===selected)?selected:'all';
  $('floor-course-dependencies').innerHTML=`<h3>Проверяемые зависимости · ${upper?'мансарда':'первый этаж'}</h3><div class="table-wrap"><table><thead><tr><th>Размер</th><th>Получилось</th><th>Подпись</th></tr></thead><tbody>${model.checks.map(c=>`<tr><td>${esc(c.label)}</td><td class="number ${+c.difference?'check-bad':''}">${c.value} мм</td><td class="number">${c.printed||'derived'}${+c.difference?' · Δ '+c.difference+' мм':''}</td></tr>`).join('')}</tbody></table></div><details><summary>Границы применения раскладки</summary><ul>${model.limitations.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p>Подрезки менее100 мм подсвечены для проверки; это порог интерфейса. Число уложенных частей не равно закупочному количеству целых блоков.</p></details>`;
 }
 floorSelectedRow=Math.max(1,Math.min(+$('floor-row-select').value,floorScenario.rows.length));$('floor-row-select').max=floorScenario.rows.length;$('floor-row-select').value=floorSelectedRow;const rr=floorScenario.rows[floorSelectedRow-1];$('floor-row-current').textContent=floorSelectedRow+' / '+floorScenario.rows.length;
 const small=rr.pieces.filter(p=>Math.min(p.bounds_mm[p.axis+3]-p.bounds_mm[p.axis],p.bounds_mm[5]-p.bounds_mm[2])<100).length;
 $('floor-row-summary').innerHTML=`${upper?'Мансарда':'Первый этаж'} · Ряд ${rr.index}: ${fmt(rr.z_mm)}…${fmt(rr.top_mm)} мм · ${rr.pieces.length} геометрических частей${rr.reinforced?' · армирование по кратности АР-2':''}<br><small>Весь сценарий: ${floorScenario.rows.length} рядов, ${floorScenario.stock_positions} ${upper?'условных позиций блока':'уложенных деталей'}, ${upper?floorScenario.fragment_count+' фрагментов по скатам, ':''}${fmt(floorScenario.net_block_geometry_m3,3)} м³ чистой геометрии. Не закупочная ведомость. В выбранном ряду ${small} частей менее100 мм — проверить.</small>${!upper?`<br><span class="check-bad">Во всём сценарии ${floorScenario.small_fragment_audit.count} малых частей; минимальная длина ${fmt(floorScenario.small_fragment_audit.min_length_mm)} мм, высота ${fmt(floorScenario.small_fragment_audit.min_height_mm)} мм.</span>`:''}`;
 $('floor-row-plan').innerHTML=floorRowSVG(rr);
 const ba=floorScenario.bond_audit;$('floor-bond-summary').innerHTML=upper?'Крыша подрезает верхние блоки; фрагменты с одинаковым stock_key относятся к одной условной позиции. Контуры предыдущего ряда помогают сравнить раскладку. Пространственная перевязка у скатов, углов и пересечений ещё не проверена.':`Смещение внутренних швов: минимум ${ba.minimum_observed_mm===null?'—':fmt(ba.minimum_observed_mm)+' мм'} при проверяемом пороге ${ba.minimum_required_mm} мм. Нарушений: ${ba.violations.length}.<br><small>${esc(ba.scope)}</small><br>${factBtn(ba.source_fact_id,'Приложение: минимум10 см · информационное')}`;
 renderFloorDetails();if(!floorRenderer)return;const g=floorRenderer;g.clear();
 const rest=g.addLayer('rest',[.76,.8,.65],{opacity:.13,showEdges:false,order:2}),chosen=g.addLayer('selected',[.64,.74,.46]),cuts=g.addLayer('cuts',[.82,.63,.36]),smallCuts=g.addLayer('smallCuts',[.69,.37,.23]),brick=g.addLayer('brick',[.57,.36,.25]),frame=g.addLayer('frame',[.47,.57,.54],{opacity:.3}),lintels=g.addLayer('lintels',[.60,.65,.60],{opacity:.3});const display=$('floor-row-display').value;
 for(const row of floorScenario.rows){if(display==='only'&&row.index!==floorSelectedRow||display==='upto'&&row.index>floorSelectedRow)continue;for(const p of row.pieces){const selected=display!=='ghost'||row.index===floorSelectedRow,l=selected?(Math.min(p.bounds_mm[p.axis+3]-p.bounds_mm[p.axis],p.bounds_mm[5]-p.bounds_mm[2])<100?smallCuts:p.cut?cuts:chosen):rest;if(upper)HouseShapes.prism(g,l,p,'wall:'+p.wall_id);else drawStairAwareBox(g,l,p.bounds_mm,'wall:'+p.wall_id,selected);}}
 if(display!=='only'){
  if(upper){for(const p of model.mesh_prisms.filter(p=>p.material==='frame')){const limit=display==='upto'?rr.top_mm:Infinity;for(const piece of courseContextBelow(p,limit))HouseShapes.prism(g,frame,piece,'wall:'+p.wall_id);}}
  else {for(const s of model.brick_envelopes){const [x0,y0,x1,y1]=s.bounds_mm.map(Number);g.box(brick,x0,y0,-130,x1,y1,display==='upto'?rr.top_mm:3020,null,false);}for(const s of FloorGeometry.solids(model).filter(x=>x.material==='frame')){const b=s.bounds,top=display==='upto'?Math.min(b[5],rr.top_mm):b[5];if(top>b[2])g.box(frame,...b.slice(0,5),top,null,false);}for(const l of model.lintel_envelopes){const b=l.bounds_mm.map(Number),top=display==='upto'?Math.min(b[5],rr.top_mm):b[5];if(top>b[2])g.box(lintels,...b.slice(0,5),top,null,false);}}
 }
 g.commit();g.request();
}
function courseContextBelow(piece,limit){
 if(!Number.isFinite(limit))return [piece];const plane=[0,0,limit],delta=plane.map((v,i)=>v-piece.top_plane[i]),out=[];
 for(const [top,foot]of [[piece.top_plane,HouseShapes.clip(piece.polygon_mm,delta)],[plane,HouseShapes.clip(piece.polygon_mm,delta.map(v=>-v))]]){const poly=HouseShapes.clip(foot,top.map((v,i)=>v-piece.bottom_plane[i]));if(poly.length>=3&&HouseShapes.area(poly)>1e-5)out.push({...piece,polygon_mm:poly,top_plane:top});}return out;
}
function renderFloorDetails(){
 if(!floorScenario)return;const model=floorCourseModel(),upper=floorCourseLevel==='upper',selected=$('floor-wall-list').value,row=floorScenario.rows[floorSelectedRow-1],walls=model.walls.filter(w=>w.material==='aac'&&(selected==='all'||w.id===selected));
 $('floor-wall-details').innerHTML=walls.map(w=>{const pp=row.pieces.filter(p=>p.wall_id===w.id);return `<details ${selected!=='all'?'open':''} style="margin-top:12px"><summary>${esc(w.label)} · ${pp.length} частей</summary><p>${esc(w.note||'Размерный план; верх по оболочке кровли — сценарий.')}</p>${upper?'<p class="tiny muted">Габариты фрагмента X/Y/Z не заменяют размер заготовки. Наклонный верх задан плоскостью, stock_key объединяет части одного блока.</p>':''}<div class="table-wrap"><table><thead><tr><th>Длина × ширина × высота, мм</th><th>Подрезка</th></tr></thead><tbody>${pp.map(p=>{const b=p.bounds_mm,ss=[b[3]-b[0],b[4]-b[1],b[5]-b[2]];if(p.axis===1)[ss[0],ss[1]]=[ss[1],ss[0]];return `<tr><td class="number">${ss.map(v=>fmt(v)).join(' × ')}${upper?'<br><small>'+esc(p.stock_key)+'</small>':''}</td><td>${p.cut?'да':'—'}</td></tr>`;}).join('')}</tbody></table></div><button class="source-button" ${upper?'data-upper-wall':'data-floor-wall'}="${w.id}">Привязки и формулы ↗</button></details>`;}).join('');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-floor-wall]');if(b)openFloorWall(b.dataset.floorWall);const u=e.target.closest('[data-upper-wall]');if(u)openUpperFloor(u.dataset.upperWall);});

'use strict';
let roofDetailRenderer=null,roofDetailState=null;
const ROOF_GROUPS={wood:{label:'Древесина',color:[.69,.62,.40]},metal:{label:'Металл / оклад',color:[.37,.46,.48]},cover:{label:'OSB / обрешётка',color:[.75,.76,.55]},concrete:{label:'Бетон / кладка',color:[.63,.68,.61]},membrane:{label:'Изоляционные плёнки',color:[.28,.38,.35]},insulation:{label:'Утепление',color:[.78,.70,.43]},finish:{label:'Покрытие / подшивка',color:[.42,.51,.43]},glass:{label:'Стекло · схема',color:[.39,.63,.67]}};
function disposeRoofDetailViewer(){roofDetailRenderer?.dispose();roofDetailRenderer=null;roofDetailState=null;}
function openRoofDetail3D(id,part){
 return prepareDialog(['renderer','facts','roof-index','roof-detail-'+id],()=>renderRoofDetail3D(id,part));
}
function renderRoofDetail3D(id,part){
 const d=MODEL.roof_details?.find(x=>x.id===id),node=MODEL.roof_nodes.find(n=>n.id===id);if(!d)return;
 const measured=['checked_geometric_trial_with_open_fastening','checked_geometric_trial_with_derived_seat_level'].includes(d.status);
 const hasRebar=d.components.some(p=>p.rebar);
 const contextControls=d.context_controls?`<label class="control"><input type="checkbox" id="roof-detail-context" ${d.context_visible===false?'':'checked'}> ${esc(d.context_label||'Плита и перегородка')}</label>${hasRebar?'<label class="control"><input type="checkbox" id="roof-detail-rebar"> Арматура</label>':''}`:'';
 const coverControls=d.cover_controls?'<label class="control"><input type="checkbox" id="roof-detail-cover" checked> Обрешётка и мембрана</label>':'';
 const style=d.cover_controls?(roofFrameState.style||'solid'):null;
 const styles=style?`<div class="roof-render-styles" role="group" aria-label="Стиль отображения">${Object.entries(roofRenderStyles).map(([id,label])=>`<button type="button" data-roof-detail-style="${id}" aria-pressed="${id===style}">${label}</button>`).join('')}</div>`:'';
 const options=parts=>parts.map(p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
 const choices=hasRebar?options(d.components.filter(p=>!p.rebar))+`<optgroup label="Арматура плиты">${options(d.components.filter(p=>p.rebar))}</optgroup>`:options(d.components);
 const sheets=d.additional_source_sheets??(measured&&node?[{source_id:'house_1',pdf_page:9,label:'АР-8 · расположение окна'}]:[]);
 const related=d.related_roof_detail?`<button data-roof-detail="${esc(d.related_roof_detail.id)}">${esc(d.related_roof_detail.label)}</button>`:'';
 const status=measured?'Примерка · I021':d.source_id==='house_1'?'Рекомендательный узел · I006':'Локальные размеры · без карты запилов';
 const viewport=`<div class="viewport roof-detail-viewport"><canvas id="roof-detail-canvas" tabindex="0" aria-label="Пространственный фрагмент узла ${esc(d.title)}"></canvas><div class="viewport-top"><span class="status amber">${status}</span></div><div class="view-tools"><button id="roof-detail-iso">3D</button><button id="roof-detail-front">${contextControls?'Спереди':'Сечение'}</button><button id="roof-detail-top">Сверху</button><button id="roof-detail-zoom-in">+</button><button id="roof-detail-zoom-out">−</button></div><div class="scene-help">ЛКМ — вращение · Shift — сдвиг · колесо — масштаб</div></div>`;
 const inspector='<div id="roof-detail-inspector" class="card"></div>';
 showDialog((pageInfo(d.source_id,d.pdf_page)?.sheet||'АР')+' / ЛОКАЛЬНЫЙ ФРАГМЕНТ',d.title,`<div class="callout">${measured?esc(d.notes[0]):`<b>Размерные сечения + условные длины фрагмента</b>${d.notes.map(esc).join('<br>')} Расход материала и рабочие длины заготовок по этому фрагменту не определяются.`}</div>${d.additional_input_fact_ids?`<div class="card"><h3>Независимые размеры исходного узла</h3>${d.additional_input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label+' · '+FACTS.get(id)?.value)).join('<br>')}</div>`:''}
 <div class="roof-detail-controls${contextControls||coverControls?' roof-detail-compact':''}" style="margin:18px 0">${styles}<label>Деталь<select id="roof-detail-part"><option value="all">Все детали узла</option>${choices}</select></label><label class="control"><input type="checkbox" id="roof-detail-isolate"> Только выбранная деталь</label>${contextControls}${coverControls}${d.membrane_patch_mm?'<label class="control"><input type="checkbox" id="roof-detail-membrane"> Мембрана</label>':''}${d.variants?`<label>${esc(d.variant_label||'Вариант узла')}<select id="roof-detail-variant">${d.variants.map(v=>`<option value="${v.id}">${esc(v.label)}</option>`).join('')}</select></label>`:''}</div>
 ${measured?`<div class="roof-detail-workspace">${viewport}${inspector}</div>`:`${viewport}
 <div class="roof-detail-layers">${Object.entries(ROOF_GROUPS).map(([id,m])=>`<label>${m.label}<input data-roof-opacity="${id}" type="range" min="0" max="100" value="${id==='cover'?50:id==='concrete'?40:100}" aria-label="Непрозрачность: ${m.label}"></label>`).join('')}</div><label class="control">Разнести материалы для просмотра <input id="roof-detail-explode" type="range" min="0" max="180" value="0" step="10"></label>${inspector}`}
 <div class="buttons-row"><span id="roof-detail-stat" class="tiny muted"></span>${related}${sheetBtn(d.source_id,d.pdf_page,'Полный исходный лист')}${sheets.map(s=>sheetBtn(s.source_id,s.pdf_page,s.label)).join('')}</div>
 ${node?`<h3 style="margin-top:20px">${measured?'Ряды стропил на КД-2':'Исходный узел рядом с моделью'}</h3><img src="${DATA.crops[id]}" alt="${esc(node.title)}">${sourceLinks(d.source_id,d.pdf_page)}`:''}`);
 const initialPart=d.components.some(p=>p.id===part)?part:(d.default_part||'all');
 roofDetailState={detail:d,part:initialPart,measured,style,variant:d.variants?.[0].id||null,opacities:Object.fromEntries(Object.keys(ROOF_GROUPS).map(k=>[k,measured?(k==='membrane'?.55:1):k==='cover'?.5:k==='concrete'?.4:1]))};
 $('roof-detail-part').value=initialPart;
 const select=partId=>{
  roofDetailState.part=partId;$('roof-detail-part').value=partId;
  if(measured&&($('roof-detail-isolate').checked||d.focus_parts))resetRoofDetailView();
  drawRoofDetail();
 };
 try{roofDetailRenderer=new HouseGL($('roof-detail-canvas'),id=>{if(id.startsWith('roof-part:'))select(id.slice(10));},s=>{if(s.error&&$('roof-detail-stat'))$('roof-detail-stat').textContent=s.error;});
  resetRoofDetailView();drawRoofDetail();
 }catch(e){$('roof-detail-inspector').textContent=e.message;}
 $('roof-detail-part').onchange=e=>select(e.target.value);$('roof-detail-isolate').onchange=()=>{if(measured)resetRoofDetailView();drawRoofDetail();};
 for(const id of ['context','rebar','cover','membrane'])if($('roof-detail-'+id))$('roof-detail-'+id).onchange=drawRoofDetail;
 if(d.context_view&&$('roof-detail-context'))$('roof-detail-context').onchange=()=>{resetRoofDetailView();drawRoofDetail();};
 document.querySelectorAll('[data-roof-detail-style]').forEach(button=>button.onclick=()=>{
  roofDetailState.style=button.dataset.roofDetailStyle;
  applyRoofDetailStyle();
 });
 if($('roof-detail-variant'))$('roof-detail-variant').onchange=e=>{roofDetailState.variant=e.target.value;drawRoofDetail();};
 document.querySelectorAll('[data-roof-opacity]').forEach(e=>e.oninput=()=>{roofDetailState.opacities[e.dataset.roofOpacity]=+e.value/100;for(const l of roofDetailRenderer.layers.values())l.opacity=roofDetailState.opacities[l.materialGroup];roofDetailRenderer.request();});
 if($('roof-detail-explode'))$('roof-detail-explode').oninput=e=>{roofDetailRenderer.explode=+e.target.value;roofDetailRenderer.request();};
 $('roof-detail-iso').onclick=()=>{if(measured)resetRoofDetailView();else{roofDetailRenderer.yaw=d.view.yaw;roofDetailRenderer.pitch=d.view.pitch;}roofDetailRenderer.request();};$('roof-detail-front').onclick=()=>{roofDetailRenderer.yaw=0;roofDetailRenderer.pitch=Math.PI/2;roofDetailRenderer.request();};$('roof-detail-top').onclick=()=>{roofDetailRenderer.yaw=0;roofDetailRenderer.pitch=.00001;roofDetailRenderer.request();};for(const [id,factor]of [['in',.8],['out',1.25]])$('roof-detail-zoom-'+id).onclick=()=>{roofDetailRenderer.span*=factor;roofDetailRenderer.request();};
}
function applyRoofDetailStyle(){
 const style=roofDetailState?.style,g=roofDetailRenderer;
 if(!style||!g)return;
 for(const layer of g.layers.values())styleRoofLayer(layer,style,layer.id.endsWith('-selected'));
 for(const button of document.querySelectorAll('[data-roof-detail-style]'))button.setAttribute('aria-pressed',String(button.dataset.roofDetailStyle===style));
 g.request();
}
function resetRoofDetailView(){
 const g=roofDetailRenderer,state=roofDetailState,d=state.detail;
 const focused=$('roof-detail-isolate').checked||d.focus_parts?.includes(state.part);
 const part=state.measured&&focused&&d.components.find(p=>p.id===state.part);
 const view=($('roof-detail-context')?.checked&&d.context_view)||d.view;
 g.target=[...view.target_mm];g.span=view.span_mm*g.fitAspect();g.pan=[0,0];
 if(part){
  const points=part.cad_mesh?.vertices_mm??part.solids.flat(2);
  const bounds=[0,1,2].map(i=>[Math.min(...points.map(p=>p[i])),Math.max(...points.map(p=>p[i]))]);
  g.target=bounds.map(([lo,hi])=>(lo+hi)/2);
  g.span=Math.max(500,Math.hypot(...bounds.map(([lo,hi])=>hi-lo))*1.25)*g.fitAspect();
 }
 g.yaw=view.yaw;g.pitch=view.pitch;
}
function drawRoofDetail(){
 if(!roofDetailRenderer||!roofDetailState)return;const g=roofDetailRenderer,state=roofDetailState,d=state.detail;g.clear();const layers=new Map();
 const layer=(group,selected,context=false)=>{const faded=context&&!selected,key=group+(selected?'-selected':faded?'-context':'');if(layers.has(key))return layers.get(key);const m=ROOF_GROUPS[group],l=g.addLayer(key,selected?[.81,.48,.23]:m.color,{opacity:faded ? .18 : state.opacities[group],showEdges:!faded,order:Object.keys(ROOF_GROUPS).indexOf(group),materialGroup:group,explodeOrder:{concrete:-2,membrane:-1,wood:0,metal:1,cover:2,insulation:-1,finish:3,glass:1}[group]});layers.set(key,l);return l;};
 const isolated=$('roof-detail-isolate').checked&&state.part!=='all',membrane=$('roof-detail-membrane');
 const context=$('roof-detail-context'),rebar=$('roof-detail-rebar'),cover=$('roof-detail-cover');
 if(context)context.disabled=isolated;
 if(rebar)rebar.disabled=isolated;
 if(cover)cover.disabled=isolated;
 if(membrane){
  membrane.disabled=isolated;
  if(membrane.checked&&!isolated){const l=layer('membrane',false);g.face(l,d.membrane_patch_mm);g.polyline(l,d.membrane_patch_mm,true);}
 }
 for(const original of d.components){const p={...original,...original.variant_geometry?.[state.variant]},selected=state.part===p.id;
  if(p.covered&&!cover?.checked&&!isolated)continue;
  if(!selected&&(isolated||p.context&&!context?.checked||p.rebar&&!rebar?.checked))continue;
  const l=layer(p.group,selected,p.context),object='roof-part:'+p.id,start=l.vertices.length;
  if(p.kind==='box')g.box(l,...p.bounds_mm,object);
  else if(p.kind==='prism')g.prism(l,p.polygon_mm,p.z0_mm,p.z1_mm,object);
  else if(p.kind==='rod_path')g.rod(l,p.points_mm,p.radius_mm,object);
  else if(p.kind==='beam')g.beam(l,p.a_mm,p.b_mm,p.width_mm,p.height_mm,object,p.width_axis||null);
  else if(p.kind==='cad_mesh')emitCadMesh(g,l,p.cad_mesh,object);
  else if(p.kind==='solid_faces')for(const faces of p.solids)for(const face of faces){
   g.face(l,face,null,object);g.polyline(l,face,true);
  }
  else if(p.kind==='xz_profile'){
   const profile=p.profile_xz_mm,[y0,y1]=p.y_bounds_mm;
   const side=(loop,y)=>loop.map(([x,z])=>[x,y,z]);
   const holes=(p.holes_xz_mm??[]).map(([x,z,radius])=>Array.from({length:24},(_,i)=>{
    const angle=2*Math.PI*i/24;
    return [x+radius*Math.cos(angle),z+radius*Math.sin(angle)];
   }));
   const triangles=HouseGL.triangulate(profile).map(indices=>indices.map(i=>profile[i]));
   const caps=holes.reduce((pieces,hole)=>pieces.flatMap(poly=>HouseShapes.subtract(poly,hole)),triangles);
   for(const cap of caps){
    g.face(l,side(cap,y0),[0,-1,0],object);
    g.face(l,side([...cap].reverse(),y1),[0,1,0],object);
   }
   for(const loop of [profile,...holes.map(hole=>[...hole].reverse())]){
    const a=side(loop,y0),b=side(loop,y1);
    a.forEach((vertex,i)=>{const j=(i+1)%a.length;g.face(l,[vertex,b[i],b[j],a[j]],null,object);});
    g.polyline(l,a,true);g.polyline(l,b,true);
   }
  }
  else if(p.kind==='rod')g.tube(l,p.a_mm,p.b_mm,p.radius_mm,10,object);
  else if(p.kind==='axis'){
   g.line(l,p.a_mm,p.b_mm,object);
   for(const [x,y,z] of [p.a_mm,p.b_mm]){
    const outward=12*Math.sign(y),radius=p.diameter_mm/2;
    g.line(l,[x,y,z],[x,y+outward,z],object);
    const ring=Array.from({length:20},(_,i)=>{
     const angle=i*Math.PI/10;
     return [x+radius*Math.cos(angle),y+outward,z+radius*Math.sin(angle)];
    });
    g.polyline(l,ring,true);
   }
  }
  else if(p.kind==='plane'){g.face(l,p.points_mm,null,object);g.polyline(l,p.points_mm,true);}
  if(state.style&&!selected){
   l.faceTints??=[];
   const tint=roofPartTint(p.id);
   for(let i=start;i<l.vertices.length;i+=6)l.faceTints.push(...tint);
  }
 }
 if(!state.measured&&!state.fitted){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const l of g.layers.values())for(let i=0;i<l.vertices.length;i+=6)for(let k=0;k<3;k++){const value=l.vertices[i+k]*1000;lo[k]=Math.min(lo[k],value);hi[k]=Math.max(hi[k],value);}if(lo.every(Number.isFinite)){g.target=lo.map((v,i)=>(v+hi[i])/2);g.span=Math.hypot(...hi.map((v,i)=>v-lo[i]))*1.1;}state.fitted=true;}
 g.commit();applyRoofDetailStyle();g.request();const p=d.components.find(p=>p.id===state.part);
 if(state.measured){
  const panel=$('roof-detail-inspector');
  if(!p){panel.innerHTML='<p>Выберите деталь в списке или в 3D.</p>';return;}
  const {axes,origin_mm,extents_mm,length_label='Длина',width_label='Ширина',height_label='Высота'}=p.dimensions;
  const size=extents_mm.map(([lo,hi])=>fmt(hi-lo,2));
  panel.innerHTML=`<h3>${esc(p.label)}</h3><figure class="frame-piece-card">
   <canvas id="roof-detail-piece-preview" width="480" height="264" aria-label="Эскиз детали с размерами"></canvas>
   <figcaption><dl>${[length_label,width_label,height_label].map((name,i)=>`<div><dt>${esc(name)}</dt><dd>${size[i]} <small>мм</small></dd></div>`).join('')}</dl></figcaption>
   </figure>${p.note?`<p class="tiny">${esc(p.note)}</p>`:''}`;
  const faces=p.cad_mesh?cadMeshFaces(p.cad_mesh):p.solids.flat();
  drawRoofPiecePreview($('roof-detail-piece-preview'),faces,axes,origin_mm,extents_mm,
   [length_label[0],width_label[0],height_label[0]],p.cad_mesh?.outlines_mm);
  return;
 }
 $('roof-detail-inspector').innerHTML=p?`<div class="eyebrow">ВЫБРАННАЯ ДЕТАЛЬ</div><h3>${esc(p.label)}</h3><p>${esc(p.note||'Сечение — по указанным фактам; длина и локальное положение — по условным параметрам фрагмента.')}</p>${p.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label+' · '+FACTS.get(id)?.value+' '+unit(FACTS.get(id)?.unit))).join('<br>')}`:`<h3>Что можно проверить здесь</h3><p>Поверните узел, измените прозрачность материалов и выберите деталь. Сечения и известный крепёж связаны с исходными записями. Условные длины, контактные запилы и расстановка неопределённого крепежа перечислены отдельно.</p>${d.derived_angles?`<div class="formula">Уклон демонстрационной диагонали = atan(tan(38°)/√2) ≈ ${fmt(d.derived_angles.hip_pitch_deg,6)}°</div>`:''}`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-roof-detail]');if(b)openRoofDetail3D(b.dataset.roofDetail,b.dataset.roofDetailPart);});

/* A height step can change sign along an edge. Split at the crossing so
 * its vertical closure is never a bow-tie polygon or an overlapping fan. */
function splitRoofReturn(p){
 const [a,b,c,d]=p,da=a[2]-d[2],db=b[2]-c[2];
 // At a valley tip the endpoints coincide. Use the open end to determine
 // which edge is above, independent of rounding or vertex order.
 const interval=(aa,bb,cc,dd)=>aa[2]-dd[2]+bb[2]-cc[2]>=0?[aa,bb,cc,dd]:[dd,cc,bb,aa];
 if(Math.min(da,db)<-1e-6&&Math.max(da,db)>1e-6){const t=da/(da-db),q=a.map((v,i)=>v+(b[i]-v)*t);return [interval(a,q,q,d),interval(q,b,c,q)];}
 return [interval(a,b,c,d)];
}
'use strict';
function atticLiningDepth(){
 return MODEL.floor2.attic_lining.normal_depth_mm;
}
function roofPacketDepth(){return DATA.roof_envelope?.packet_mm??MODEL.roof_frame.known_packet_above_rafter_mm;}
function roofWallOutline(){return DATA.roof_envelope?.wall_outline_mm??MODEL.roof_frame.wall_outline_mm;}
function roofShaftOpenings(){
 const bounds=DATA.roof_envelope?.shaft_openings_mm??
  Object.values(MODEL.roof_frame.shaft_clearances).map(shaft=>shaft.keepout_bounds_mm);
 return bounds.map(roofContactRect);
}
function drawAtticLining(g){
 const layer=addLayer(g,'atticLining',{opacity:0,dependsOn:'roof',explodeOrder:4,showEdges:false});
 const outline=roofWallOutline();
 const footprint=HouseGL.triangulate(outline).map(t=>t.map(i=>outline[i]));
 const depth=atticLiningDepth(),holes=roofShaftOpenings();
 for(const s of roofWindowSpecs()){
  const [a,b]=s.cell.plane,normalLength=Math.hypot(a,b,1);
  const framingDepth=roofPacketDepth()+n('timber.1.height');
  const k=framingDepth/normalLength,finishDrop=(depth-framingDepth)*normalLength;
  const throat=s.polygon.map(([x,y,z])=>[x+a*k,y+b*k,z-k]);
  // The lining clears the framing. AR-22 shows a horizontal head and a vertical sill.
  const inner=throat.map(([x,y,z],i)=>i<2?[x+a*finishDrop/(a*a+b*b),y+b*finishDrop/(a*a+b*b),z]:[x,y,z-finishDrop]);
  holes.push(inner.map(p=>p.slice(0,2)));
  for(const [outer,rim] of [[s.polygon,throat],[throat,inner]])for(let i=0;i<4;i++){
   const j=(i+1)%4;
   g.face(layer,[outer[i],outer[j],rim[j],rim[i]],null,'reveal:'+s.id);
  }
 }
 const junction=MODEL.roof_geometry.eave_junctions;
 const liningCuts=MODEL.floor2.timber_lining_cuts_mm??MODEL.floor2.west_plate_wall_heads.map(head=>head.beam_bounds_mm);
 for(const cap of junction.wall_caps){
  const [a,b,c]=cap.plane,drop=depth*Math.hypot(a,b,1);
  const cutFootprint=([x,y,z,X,Y,Z],top=[0,0,Z])=>
   HouseShapes.clip(HouseShapes.clip(roofContactRect([x,y,X,Y]),[a,b,c-drop-z]),
    [top[0]-a,top[1]-b,top[2]-c+drop]);
  const beamCuts=[...liningCuts.map(bounds=>cutFootprint(bounds)),
   ...(MODEL.floor2.sloped_lining_cuts||[]).map(({bounds_mm,top_plane})=>cutFootprint(bounds_mm,top_plane))]
   .filter(foot=>HouseShapes.area(foot)>.001);
  for(const triangle of footprint){
   const region=intersectConvex(cap.polygon_mm,triangle);
   if(region.length<3||HouseShapes.area(region)<.01)continue;
   let pieces=[region];
   for(const hole of [...holes,...beamCuts])pieces=pieces.flatMap(p=>HouseShapes.subtract(p,hole));
   for(const p of pieces)g.face(layer,p.map(q=>[...q,HouseShapes.z(cap.plane,q)-drop]),[a,b,-1],'ceiling:'+cap.id);
  }
 }
 for(const side of junction.side_cheeks){
  const up=MODEL.roof_geometry.cells.find(c=>c.id===side.upper_cell_id).plane;
  const low=MODEL.roof_geometry.source_facets.find(f=>f.id===side.lower_facet_id).plane;
  const face=side.polygon_mm.map((p,i)=>[p[0],p[1],p[2]-depth*Math.hypot(...(i<2?up:low).slice(0,2),1)]);
  for(const tri of footprint){
   const clipped=intersectConvex(face,tri);
   if(clipped.length>=3)g.face(layer,clipped,null,'ceiling:'+side.upper_cell_id);
  }
 }
}
function drawDimensionedRoof(g,l,visible){
 const model=MODEL.roof_geometry,returns=addLayer(g,'roofReturns',{visible:false,opacity:.3,order:16,explodeOrder:4,depthBias:2,showEdges:false});
 if(mode==='house')drawAtticLining(g);
 l.undersideColor=[.82,.74,.61]; // Exposed OSB under the roof covering.
 const below=(p,drop)=>[p[0],p[1],p[2]-drop];
 const skin=(polygon,plane,id)=>{
  const [a,b]=plane,drop=roofDeckDrop(plane);
  g.face(l,polygon,[-a,-b,1],id);
  g.face(l,polygon.map(p=>below(p,drop)).reverse(),[a,b,-1],id);
 };
 const rim=(a,b,plane,id)=>{const drop=roofDeckDrop(plane);g.face(l,[a,b,below(b,drop),below(a,drop)],null,id);};
 for(const cell of model.cells)for(const polygon of cutRoofCell(cell))skin(polygon,cell.plane,'roofcell:'+cell.id);
 const junction=model.eave_junctions;
 for(const surface of junction.under_eaves)skin(surface.polygon_mm,surface.plane,'roof:geometry');
 for(const s of roofWindowSpecs())s.polygon.forEach((p,i)=>rim(p,s.polygon[(i+1)%s.polygon.length],s.cell.plane,'roofcell:'+s.cell.id));
 const edges=model.edges.filter(e=>e.kind==='eave').map(e=>[e.a_mm,e.b_mm]);
 for(const step of model.height_steps)for(const [a,b] of splitRoofReturn(step.polygon_mm))edges.push([a,b]);
 for(const [a,b] of edges){const cell=model.cells.find(c=>[a,b].every(p=>Math.abs(HouseShapes.z(c.plane,p)-p[2])<.001));if(cell)rim(a,b,cell.plane,'roofcell:'+cell.id);}
 const cheek=addLayer(g,'roofCheeks',{visible,explodeOrder:4,showEdges:false});
 for(const side of junction.side_cheeks)for(const polygon of splitRoofReturn(side.polygon_mm))g.face(cheek,polygon,null,'roof:geometry');
 for(const edge of model.edges){const target=edge.kind==='height_step'?returns:l;g.line(target,edge.a_mm,edge.b_mm);}
 for(const step of model.height_steps)for(const polygon of splitRoofReturn(step.polygon_mm))g.face(returns,polygon,null,'roof:geometry');
 if(visible){const point=model.points.find(p=>p.id==='main_ridge_n');g.labels.push({text:'Конёк +9.390 · АР-8',p:[+point.x_mm,+point.y_mm,+point.z_mm+150],id:'roof:geometry',layer:'roof',color:'#476442'});}
}
function roofGeometrySVG(selected=null){const model=MODEL.roof_geometry,colors={main:'#90a77b',garage:'#c3c09a',bay:'#759486',dormer_n:'#bc9e6b',dormer_s:'#bc9e6b'};return `<svg class="plan-svg" viewBox="-1900 -17700 18000 20000" role="img" aria-label="Восстановленный план скатов АР-8"><g transform="scale(1,-1)">${model.cells.map(c=>`<polygon points="${c.polygon_mm.map(p=>p[0]+','+p[1]).join(' ')}" fill="${selected===c.id?'#d1a15b':colors[c.feature_id]}" stroke="none"><title>${esc(c.label)} · ${fmt(c.surface_area_m2,4)} м²</title></polygon>`).join('')}${model.edges.map(e=>`<path d="M${e.a_mm[0]},${e.a_mm[1]}L${e.b_mm[0]},${e.b_mm[1]}" stroke="${e.kind==='height_step'?'#a96e36':'#52634c'}" stroke-width="${e.kind==='eave'?35:23}" fill="none" ${e.kind==='height_step'?'stroke-dasharray="90 65"':''}/>`).join('')}</g><text x="2500" y="1500" font-size="250" fill="#637354">АР-8 · явный размерный вариант · I002 / I003 / I007</text></svg>`;}
function roofGeometryCard(){const m=MODEL.roof_geometry;return `<div class="card" id="roof-geometry-card" style="margin-top:22px"><div class="eyebrow">ПОВЕРХНОСТИ ПО РАЗМЕРАМ АР-8</div><h3>Пять частей кровли, плоские скаты и сверка</h3><p>Основная часть, гараж, восточный выступ и два слуховых окна собраны по подписанным цепям и отметкам. Это выбранный вариант с открытыми I002/I003/I007. Стропила и три мансардных окна показаны отдельными слоями с условными монтажными привязками.</p><div class="formula">Проекция: ${fmt(m.calculations.plan_area_m2,4)} м²<br>Поверхность оболочки: ${fmt(m.calculations.surface_area_m2,4)} м²<br>АР-1 / КД-4: 300,00 м² · разница ${fmt(m.calculations.area_residual_m2,4)} м²</div><p class="tiny muted">Площадь верхней оболочки до вычитания проходок. Коэффициенты запаса и слои покрытия по этому числу не назначаются; ведомость 300 м² сохраняется отдельно.</p><div class="buttons-row"><button data-entry-valley>Примыкание над входом в 3D</button><button data-roof-geometry>План, плоскости и все отклонения ↗</button>${sheetBtn('house_1',9,'АР-8 · первоисточник')}</div></div>`;}
function entryValleyPlan(){
 const roof=MODEL.roof_geometry,route=roof.eave_junctions.entry_valley_mm;
 const line=(a,b,style)=>`<line x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}" ${style}/>`;
 const colors={main:'#e1e5db',garage:'#d4dbcc',dormer_s:'#edddc3'};
 const back=roof.cells.filter(c=>colors[c.feature_id]).map(c=>`<polygon fill="${colors[c.feature_id]}" points="${c.polygon_mm.map(([x,y])=>x+','+-y).join(' ')}"/>`).join('');
 const edges=roof.edges.map(e=>line(e.a_mm,e.b_mm,'stroke="#7d8274" stroke-width="14"')).join('');
 return `<figure class="valley-plan"><svg viewBox="2350 -6150 8900 5150" role="img" aria-label="Ендова от конька гаража вниз под свес слухового окна, затем к наружному краю гаражного ската"><defs><marker id="runoff-tip" markerUnits="strokeWidth" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill="#176a82"/></marker></defs>${back}${edges}${route.slice(1).map((b,i)=>line(route[i],b,'stroke="#176a82" stroke-width="52" '+(i===1?'stroke-dasharray="90 65"':'marker-end="url(#runoff-tip)"'))).join('')}<g fill="#273e35" font-size="230"><text x="2750" y="-2600">Гараж</text><text x="6750" y="-3300">Слуховое окно</text></g></svg><figcaption>Вид сверху. Пунктир проходит под свесом. Стрелки показывают понижение по плоскостям модели.</figcaption></figure>`;
}
function showEntryValley(){
 return activateTab('model','house',renderEntryValley);
}
function renderEntryValley(){
 const g=renderer,route=MODEL.roof_geometry.eave_junctions.entry_valley_mm;
 const p=route[1];g.target=[p[0],p[1],p[2]+450];g.span=10300*g.fitAspect();g.pan=[0,0];g.pitch=.87;g.yaw=.84;
 const trace=g.addLayer('entryValley',[.24,.79,.85],{dependsOn:'roof',explodeOrder:4,showEdges:false});
 LAYER_META.entryValley=['Направление ендовы',trace.color];
 const above=q=>[q[0],q[1],q[2]+28];
 for(let i=1;i<route.length;i++)g.tube(trace,above(route[i-1]),above(route[i]),24,8);
 g.commitLayer(trace);renderLayerControls();g.request();
 $('scene-notice').innerHTML=`<b>Ендова между гаражом и слуховым окном над входом.</b> На АР-8 ендова продолжается пунктиром под свесом. В размерном варианте она понижается до карниза основного ската (+4,230 м), дальше гаражный скат идёт к наружному свесу. Возможность местного скопления снега проверяется отдельным расчётом. ${sheetBtn('house_1',9,'План АР-8')} ${sheetBtn('house_1',13,'Фасад АР-12')}${entryValleyPlan()}`;
 history.replaceState(null,'','#entry-valley');
 $('viewport').scrollIntoView({block:'center'});
}
document.addEventListener('click',e=>{if(e.target.closest('[data-entry-valley]'))showEntryValley();});
function openRoofGeometry(selected=null){
 const m=MODEL.roof_geometry,cell=m.cells.find(c=>c.id===selected);const perFeature=m.features.map(f=>({...f,area:m.cells.filter(c=>c.feature_id===f.id).reduce((s,c)=>s+c.surface_area_m2,0)}));
 showDialog('АР-8 / ПЛОСКОСТИ И ОТКРЫТЫЕ ЗАВИСИМОСТИ','Кровля: размерный вариант',`<div class="callout"><b>I002 / I003 / I007 · вариант, не согласование исходников</b>${esc(m.variant_note)}<br>Гаражная отметка +6.735 сохранена исходной; в выбранной общей западной плоскости получается +${fmt(m.points.find(p=>p.id==='garage_ridge_front').z_mm/1000,6)}.</div>
 <div class="section-grid"><div>${roofGeometrySVG(selected)}<div class="legend"><span><i style="--c:#90a77b"></i>Основная часть</span><span><i style="--c:#c3c09a"></i>Гараж</span><span><i style="--c:#759486"></i>Восточный выступ</span><span><i style="--c:#bc9e6b"></i>Слуховые выступы</span></div></div><div><h3>Независимая площадь варианта</h3><table><tbody>${perFeature.map(f=>`<tr><td>${esc(f.label)}</td><td class="number">${fmt(f.area,4)} м²</td></tr>`).join('')}<tr><td><b>Оболочка до отверстий</b></td><td class="number"><b>${fmt(m.calculations.surface_area_m2,4)} м²</b></td></tr><tr><td>Подпись АР-1 / КД-4</td><td class="number">300,00 м²</td></tr><tr><td>Разница</td><td class="number check-bad">${fmt(m.calculations.area_residual_m2,4)} м²</td></tr></tbody></table><p>Перекрывающиеся части считаются один раз: остаётся верхняя поверхность в каждой точке плана. Отверстия мансардных окон и проходки ещё не вычтены; проектные 300 м² не заменены новым закупочным числом.</p></div></div>
 ${cell?`<div class="card"><h3>Выбранная поверхность: ${esc(cell.label)}</h3><div class="formula">Z = ${fmt(cell.plane[0],9)} × X + ${fmt(cell.plane[1],9)} × Y + ${fmt(cell.plane[2],6)} мм<br>Видимая часть: ${fmt(cell.surface_area_m2,6)} м²</div></div>`:''}
 <h3 style="margin-top:25px">Исходные цепи и производные остатки</h3><div class="table-wrap"><table><thead><tr><th>Проверка</th><th>Вариант, мм</th><th>Подпись / ограничение, мм</th><th>Δ, мм</th></tr></thead><tbody>${m.checks.map(c=>`<tr><td>${esc(c.label)}<br><small>${esc(c.note)}</small></td><td class="number">${fmt(c.value,6)}</td><td class="number">${fmt(c.printed,6)}</td><td class="number check-bad">${fmt(c.difference,6)}</td></tr>`).join('')}</tbody></table></div>
 <h3 style="margin-top:25px">Уклоны, выведенные из габаритов и отметок</h3><table><thead><tr><th>Часть</th><th>Вариант</th><th>Подпись</th><th>Δ</th></tr></thead><tbody>${m.pitch_checks.map(c=>`<tr><td>${esc({main_west_east:'Основные запад/восток',main_north:'Основной север',main_south:'Основной юг',bay:'Восточный выступ',dormer:'Слуховые выступы'}[c.id])}</td><td class="number">${fmt(c.computed_deg,6)}°</td><td class="number">${c.printed_deg}°</td><td class="number check-bad">${fmt(c.difference_deg,6)}°</td></tr>`).join('')}</tbody></table><p>Плоскости задаются размерными цепями и отметками. Подпись 38° сохранена отдельно; она не используется для молчаливой подгонки высот.</p>
 <h3 style="margin-top:25px">Ендова над входом</h3><p>На АР-8 пунктир показывает продолжение ендовы под свесом слухового окна к скату гаража. Нижний скат и боковина под свесом видны в 3D. Лист задаёт уклон 38°. Для оценки снегового мешка у стенки нужны снеговой район, ветровой перенос и расчёт местной нагрузки.</p><h3>Высотные примыкания</h3><p>У выступов есть перепады между верхним скатом и соседней кровлей. Их геометрия доступна отдельным янтарным слоем. Вынос свеса не позволяет назначить вертикальную стену прямо по линии наружной поверхности: материал, положение обшивки и узел примыкания требуют рабочей привязки. Объём стен из этих поверхностей не считается.</p>
 <details><summary>Все опорные точки, формулы и источники</summary><div class="table-wrap"><table><thead><tr><th>Точка</th><th>X / Y / Z, мм</th><th>Происхождение</th></tr></thead><tbody>${m.points.map(p=>`<tr><td>${esc(p.id)}</td><td class="number">${[p.x_mm,p.y_mm,p.z_mm].map(v=>fmt(v,6)).join(' / ')}</td><td><details><summary>Формулы</summary>${p.formulas.map((v,i)=>`<p class="hash">${['X','Y','Z'][i]} = ${esc(v)}</p>`).join('')}${p.input_fact_ids.map(i=>factBtn(i,FACTS.get(i)?.label)).join('<br>')}</details></td></tr>`).join('')}</tbody></table></div></details>
 <div class="callout" style="margin-top:20px"><b>Ограничения</b>${m.limitations.map(esc).join('<br>')}</div>${sheetBtn('house_1',9)}${sheetBtn('house_2',22)}`);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-roof-geometry]'))openRoofGeometry();});

function drawUpperFloor(g,wallLayer,visible){
 const frame=addLayer(g,'upperFrame',{visible,explodeOrder:3,order:14});
 const belt=g.addLayer('roofBelt',[.53,.57,.58],{visible,explodeOrder:3,order:14});
 LAYER_META.roofBelt=['Монолитный пояс Мп 2',[.53,.57,.58]];
 belt.useTint=true;belt.faceTints=[];
 const addRun=(run,color)=>{
  const start=belt.vertices.length;
  const [x0,y0,x1,y1]=run.bounds_mm;
  if(run.cad_mesh)emitCadMesh(g,belt,run.cad_mesh,run.id);
  else if(run.top_limit_plane){
   for(const piece of roofBeltInsulationPrisms(run))HouseShapes.prism(g,belt,piece,run.id);
  }else g.box(belt,x0,y0,run.bottom_mm,x1,y1,run.top_mm,run.id);
  for(let i=start;i<belt.vertices.length;i+=6)belt.faceTints.push(...color);
 };
 for(const run of MODEL.floor2.roof_belt.runs)addRun(run,belt.color);
 for(const strip of MODEL.floor2.roof_belt.insulation)addRun(strip,[.71,.47,.28]);
 const z=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2];
 for(const mesh of MODEL.floor2.mesh_prisms)for(const piece of wallDisplayPieces(mesh)){
  const l=piece.material==='frame'?frame:wallLayer,p=piece.polygon_mm,id='upperwall:'+piece.wall_id;
  const low=p.map(q=>[...q,z(piece.bottom_plane,q)]),high=p.map(q=>[...q,z(piece.top_plane,q)]);
  drawUpperWallFace(g,l,high,[-piece.top_plane[0],-piece.top_plane[1],1],id);
  drawUpperWallFace(g,l,[...low].reverse(),[piece.bottom_plane[0],piece.bottom_plane[1],-1],id);
  for(let i=0;i<p.length;i++){const j=(i+1)%p.length;drawUpperWallFace(g,l,[low[i],low[j],high[j],high[i]],null,id);}
 }
}
function upperPlanSVG(selected=null){const m=MODEL.floor2;return `<svg class="plan-svg" viewBox="-1200 -17100 16700 18600" role="img" aria-label="План стен мансарды по привязкам"><g transform="scale(1,-1)">${m.walls.map(w=>{const [a,b,c,d]=w.bounds_mm.map(Number);return `<rect x="${a}" y="${b}" width="${c-a}" height="${d-b}" fill="${selected===w.id?'#d9a55e':w.material==='frame'?'#73998d':'#b9be9e'}"><title>${esc(w.label)}</title></rect>`;}).join('')}${m.openings.map(o=>{const [a,b,z,c,d]=o.bounds_mm.map(Number);return `<rect x="${a}" y="${b}" width="${c-a}" height="${d-b}" fill="#f8f9f3" stroke="#9c7945" stroke-width="17"><title>${esc(o.label)}</title></rect>`;}).join('')}</g></svg>`;}
function openUpperFloor(selected=null){
 const m=MODEL.floor2,w=m.walls.find(w=>w.id===selected),arch=m.openings.find(o=>o.arch).arch;
 showDialog('АР-4 / АР-6 / РАЗМЕРНЫЙ ПЛАН','Мансарда: план и условный верх',`<div class="callout"><b>I016 · верх стен пока условный</b>Перегородки в 3D доходят до подшивки, кладка под семью карнизными полосами доходит до низа Мп 2. Точные высоты стен, крепления и стыки отделки требуют рабочего решения. План и проёмы связаны с исходными размерами.</div>
 <div class="section-grid"><div>${upperPlanSVG(selected)}</div><div><h3>${w?esc(w.label):m.walls.length+' участка стен · '+m.openings.length+' проёмов'}</h3><p>Газобетон 400 и каркасные перегородки 200 показаны отдельными слоями. Конфликты локальных цепей не распределены между простенками.</p>${w?`<div class="formula">Границы XY: ${w.bounds_mm.join(' / ')} мм</div><details><summary>Все формулы и входные записи</summary>${w.formulas.map((v,i)=>`<p class="hash">${['X0','Y0','X1','Y1'][i]} = ${esc(v)}</p>`).join('')}${w.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label)).join('<br>')}</details>`:''}<p>Лестница и межэтажный проём представлены отдельными размерными вариантами КЖ-15/КЖ-7 с I019/I020. Отделка и точная мансардная площадь здесь не вычисляются.</p>${sheetBtn('house_1',5)}${sheetBtn('house_1',7)}${sheetBtn('house_2',20)}</div></div>
 <h3>Проверка исходных цепей</h3><div class="table-wrap"><table><thead><tr><th>Участок</th><th>Получается, мм</th><th>Подпись, мм</th><th>Δ, мм</th></tr></thead><tbody>${m.checks.map(c=>`<tr><td>${esc(c.label)}</td><td class="number">${fmt(c.value)}</td><td class="number">${fmt(c.printed)}</td><td class="number ${+c.difference?'check-bad':''}">${fmt(c.difference)}</td></tr>`).join('')}</tbody></table></div>
 <h3 style="margin-top:25px">Арочное окно ОК-9</h3><div class="formula">R1620 + хорда 3150 → подъём ${fmt(arch.rise_mm,6)} мм<br>АР-17: 1245 мм → разница ${fmt(arch.rise_residual_mm,6)} мм</div><p>Показан вариант по радиусу и ширине; исходная высота 1245 не заменена. Дуга разбита с отклонением не более 0,25 мм. У самого блока подписаны 3100×1195 мм и R1600. В просмотрщике дуга блока проходит через его габарит. Оба радиуса и противоречие высот зафиксированы в I016.</p>${factBtn('window.ОК-9.opening_radius','R1620 · АР-17')}${factBtn('window.ОК-9.opening_height','1245 · АР-17')}
 <h3 style="margin-top:25px">Проёмы и их высоты</h3><div class="table-wrap"><table><thead><tr><th>Проём</th><th>Границы X/Y/Z, мм</th><th>Источник</th></tr></thead><tbody>${m.openings.filter(o=>!w||o.wall_id===w.id).map(o=>`<tr><td>${esc(o.label)}</td><td class="number">${o.bounds_mm.join(' / ')}</td><td><details><summary>Формулы и подписи</summary>${o.formulas.map(esc).join('<br>')}${o.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label)).join('<br>')}</details></td></tr>`).join('')}</tbody></table></div><p class="tiny muted">Поперечное расширение выреза на 1 мм — параметр булевой операции, не монтажный зазор.</p>
 <div class="callout">${m.limitations.map(esc).join('<br>')}</div>`);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-upper-geometry]'))openUpperFloor();});

'use strict';
function compareMass(previous,current){return `<del>${fmt(previous,4)}</del> <strong class="updated">${fmt(current,4)}</strong>`;}
function foundationRebarAuditCard(){const a=MODEL.foundation_rebar_audit;return `<div class="card" id="rebar-audit-card" style="margin-top:22px"><div class="eyebrow">АРИФМЕТИКА КЖ-4 / ПО ВСЕМ ВОСЬМИ ПОЗИЦИЯМ</div><h3>От строк спецификации до итоговой массы стали</h3><div class="formula">Σ количество × масса единицы = <del>${fmt(a.totals.net_mass_kg,3)} кг</del> <strong class="updated">${fmt(MODEL.foundation.steel_takeoff.net_mass_kg)} кг</strong><br>С дополнительными ${a.extra_percent}% · ${revisedQuantity('foundation.Фм1.steel_kg_total')}<br>Архивная сверка произведений · <del>${fmt(a.totals.with_extra_kg,3)} кг</del> · разница ${fmt(a.totals.residual_kg,3)} кг</div><p>Пересчёт использует напечатанные массы единицы. Это сверка арифметики ведомости; полная карта стержней со стыками и анкеровкой ещё не построена. К готовому итогу 5% повторно не добавляются.</p><div class="buttons-row"><button data-rebar-audit>Все строки, классы и формулы ↗</button>${factBtn('foundation.Фм1.steel_extra_percent','5% · примечание КЖ-4')}</div></div>`;}
function openFoundationRebarAudit(){const a=MODEL.foundation_rebar_audit;showDialog('КЖ-4 / НЕЗАВИСИМЫЙ ПЕРЕСЧЁТ АРИФМЕТИКИ','Арматура Фм 1: сверка ведомости',`<p>Количества, единицы и массы единицы взяты из исходных строк. Расчёт ниже не заменяет геометрическую карту стержней и не уточняет округлённые массы проектировщика.</p><div class="table-wrap"><table><thead><tr><th>Поз.</th><th>Сталь</th><th>Количество</th><th>Масса единицы</th><th>Произведение, кг</th><th>Источник</th></tr></thead><tbody>${a.rows.map(r=>`<tr><td>${r.position}</td><td>${esc(r.grade)} Ø${r.diameter_mm}</td><td class="number">${revisedQuantity('foundation.Фм1.rebar.'+r.position+'.quantity')}</td><td class="number">${fmt(r.unit_mass)} ${unit(r.unit_mass_unit)}</td><td class="number"><del>${fmt(r.calculated_mass_kg,3)}</del> <strong class="updated">${fmt(MODEL.foundation.steel_takeoff.rows[r.position-1].net_mass_kg,3)}</strong></td><td><details><summary>Исходные значения</summary>${r.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label+' / '+FACTS.get(id)?.property)).join('<br>')}</details></td></tr>`).join('')}</tbody></table></div>
 <div class="callout"><b>I018 · класс позиции7</b>В строке7 напечатано А500 без С, в итоговой группе масс — А500С. Строка сохранена буквально; класс изделия автоматически не исправлен.</div><h3 style="margin-top:25px">Группы по классу и диаметру</h3><table><thead><tr><th>Группа / позиции</th><th>До5%, кг</th><th>×1,05, кг</th><th>Ведомость, кг</th><th>Δ исходной ведомости, кг</th></tr></thead><tbody>${a.groups.map(r=>`<tr><td>${esc(r.label)}<br><small>Поз.${r.positions.join(', ')}</small></td><td class="number">${compareMass(r.net_mass_kg,r.positions.reduce((v,p)=>v+Number(MODEL.foundation.steel_takeoff.rows[p-1].net_mass_kg),0))}</td><td class="number">${compareMass(r.with_extra_kg,MODEL.foundation.quantity_changes['foundation.Фм1.steel_kg_'+r.id].current)}</td><td class="number"><del>${fmt(r.printed_total_kg,1)}</del></td><td class="number">${fmt(r.residual_kg,3)}</td></tr>`).join('')}<tr><td><b>Всего</b></td><td class="number">${compareMass(a.totals.net_mass_kg,MODEL.foundation.steel_takeoff.net_mass_kg)}</td><td class="number">${compareMass(a.totals.with_extra_kg,MODEL.foundation.quantity_changes['foundation.Фм1.steel_kg_total'].current)}</td><td class="number"><del>${fmt(a.totals.printed_total_kg,1)}</del></td><td class="number">${fmt(a.totals.residual_kg,3)}</td></tr></tbody></table><p>Разницы сохранены. Напечатанные массы единицы имеют ограниченную точность; по этим произведениям исходный итог не исправляется.</p>
 <h3 style="margin-top:25px">Что показывает арифметика двух сеток</h3><div class="formula"><del>246,4 м² × 2 направления / 0,200 м = 2464 п.м.</del><br>По длинам стержней текущей раскладки · поз. 1 ${revisedQuantity('foundation.Фм1.rebar.1.quantity')} · поз. 2 ${revisedQuantity('foundation.Фм1.rebar.2.quantity')}</div><p>Равенство совпадает с обеими строками спецификации. Это наблюдение о числах, а не установленный метод расчёта проектировщика: конкретные концы, защитный слой, нахлёсты и зона150 в него не входят. Нельзя превратить эту формулу в рабочую раскладку.</p>${a.mesh_area_identities[0].input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label)).join('<br>')}
 <div class="callout" style="margin-top:20px"><b>Что пока требует привязки</b>Область и направление верхнего шага150 (I015), фактические стыки/анкеровка, краевые позиции и расстановка фиксаторов. Количества проекта и будущий расход по геометрии остаются отдельными величинами.</div>${sheetBtn('house_2',7)}${sheetBtn('house_2',8)}${sheetBtn('house_2',9)}`);}
document.addEventListener('click',e=>{if(e.target.closest('[data-rebar-audit]'))openFoundationRebarAudit();});

let foundationRebarState={layout:null,parameters:null,solid:false,family:'all',selected:null};
const REBAR_LAYER_IDS={1:'bottom',2:'top',3:'chair',4:'beamL',5:'beamPinExt',6:'beamsteel',7:'edgesteel',8:'beamPinInt'};
const REBAR_NAMES={1:'Нижняя сетка',2:'Верхняя сетка · поле 200',3:'Фиксаторы · шахматно',4:'Г-образные детали ростверка',5:'Наружные шпильки · пролёт',6:'Продольные трассы ростверка',7:'П-детали · гипотеза края',8:'Внутренние шпильки · пролёт'};
function ensureFoundationRebar(){const s=foundationRebarState;if(!s.layout){s.parameters={...MODEL.foundation_rebar_layout_summary.parameters};s.layout=RebarLayout.build(MODEL.foundation,DATA.facts,s.parameters);}return s.layout;}
function drawFoundationRebar(g,layers){
 const layout=ensureFoundationRebar(),s=foundationRebarState;
 layers[4]=addLayer(g,'beamL',{visible:false});layers[5]=addLayer(g,'beamPinExt',{visible:false});layers[8]=addLayer(g,'beamPinInt',{visible:false});
 for(const rod of layout.rods){const l=layers[rod.position];l.edgeAlpha=.98;for(let i=1;i<rod.points_mm.length;i++){const a=rod.points_mm[i-1],b=rod.points_mm[i];if(s.solid)g.tube(l,a,b,rod.diameter_mm/2);g.line(l,a,b,'rebar:'+rod.id);}}
 const marks=addLayer(g,'rebarChecks',{visible:mode==='rebar'});
 for(const omission of layout.omissions){const [x,y]=omission.at_mm;g.line(marks,[x-70,y-70,-60],[x+70,y+70,-60]);g.line(marks,[x-70,y+70,-60],[x+70,y-70,-60]);}
 const selected=g.addLayer('rebarSelected',[.95,.59,.16],{visible:mode==='rebar',order:21});
 if(s.selected){const rod=layout.rods.find(r=>r.id===s.selected);if(rod){selected.dependsOn=REBAR_LAYER_IDS[rod.position];g.rod(selected,rod.points_mm,Math.max(14,rod.diameter_mm));}}
}
function drawRebarSelection(){const s=foundationRebarState,g=renderer,l=g?.layers.get('rebarSelected');if(!l)return;l.vertices=[];l.edges=[];const rod=s.layout?.rods.find(r=>r.id===s.selected);l.visible=!!rod;if(rod){l.dependsOn=REBAR_LAYER_IDS[rod.position];g.rod(l,rod.points_mm,Math.max(14,rod.diameter_mm));}g.commitLayer(l);g.request();}
function selectRebarElement(id){const s=foundationRebarState;ensureFoundationRebar();s.selected=s.layout.rods.some(r=>r.id===id)?id:null;if(s.selected){const rod=s.layout.rods.find(r=>r.id===id);if(s.family!=='all'&&+s.family!==rod.position)s.family='all';}drawRebarSelection();renderRebarTools();renderRebarInspector();}
function renderRebarTools(){
 const root=$('rebar-tools');root.hidden=mode!=='rebar';if(root.hidden)return;
 const s=foundationRebarState,layout=ensureFoundationRebar(),rows=layout.rods.filter(r=>s.family==='all'||r.position===+s.family);
 root.innerHTML=`<label>Показать позицию<select id="rebar-family"><option value="all">Все 8 позиций</option>${layout.families.map(f=>`<option value="${f.position}" ${s.family===String(f.position)?'selected':''}>${f.position}. ${REBAR_NAMES[f.position]}</option>`).join('')}</select></label><label class="rebar-element-control">Элемент схемы<select id="rebar-element"><option value="">Выбрать в 3D или из ${rows.length} элементов</option>${rows.map(r=>`<option value="${r.id}" ${r.id===s.selected?'selected':''}>Поз.${r.position} · ${r.id}${r.axis==='X'||r.axis==='Y'?' · '+r.axis:''}</option>`).join('')}</select></label><label class="rebar-solid-control"><input type="checkbox" id="rebar-solid" ${s.solid?'checked':''}> Показать Ø · схемно</label><button data-rebar-layout>Параметры и сверка ↗</button>`;
 $('rebar-family').onchange=e=>{s.family=e.target.value;s.selected=null;for(const [pos,id]of Object.entries(REBAR_LAYER_IDS))renderer.layers.get(id).visible=s.family==='all'||+s.family===+pos;drawRebarSelection();foundationStudyTools();renderLayerControls();renderRebarTools();renderRebarInspector();renderer.request();};
 $('rebar-element').onchange=e=>selectRebarElement(e.target.value);
 $('rebar-solid').onchange=e=>{s.solid=e.target.checked;buildScene('rebar');};
}
function renderRebarInspector(){
 const s=foundationRebarState,layout=ensureFoundationRebar(),rod=layout.rods.find(r=>r.id===s.selected);
 if(!rod){$('inspector').innerHTML=`<div class="eyebrow">КЖ-2 / КЖ-3 / КЖ-4</div><h3>Арматура всей плиты</h3><span class="status amber">Сценарий · I015 / I017</span><p>${layout.rods.length} элементов схемы. Выберите позицию, отдельную линию в 3D или элемент из списка. Золотая подсветка — выбранная трасса.</p><div class="detail-list">${layout.families.map(f=>`<div class="detail-row"><span>Поз.${f.position}</span><b>${f.count} в сцене</b></div>`).join('')}</div><div class="callout"><b>Схема не заменяет рабочий раскрой</b>Фазы, высотные контакты, стыки и анкеровка не установлены. Позиция 7 по всему периметру — гипотеза; крюки5/8 не построены. На ${layout.omissions.length} случаях стоят метки проверки.</div><button data-rebar-layout>Все количества, параметры и пропуски ↗</button>${sheetBtn('house_2',7)}${sheetBtn('house_2',8)}${sheetBtn('house_2',9)}`;return;}
 const pre='foundation.Фм1.rebar.'+rod.position,family=layout.families.find(f=>f.position===rod.position);
 $('inspector').innerHTML=`<div class="eyebrow">ВЫБРАННЫЙ ЭЛЕМЕНТ / ${rod.id}</div><h3>Поз.${rod.position} · ${REBAR_NAMES[rod.position]}</h3><span class="status amber">Осевая схема</span><div class="detail-list"><div class="detail-row">Сталь<b>${esc(family.source_grade)} · Ø${rod.diameter_mm}${rod.source_issue_ids.length?' · '+rod.source_issue_ids.join(' / '):''}</b></div><div class="detail-row">Видимая линия<b>${fmt(rod.visible_axis_length_mm,3)} мм</b></div><div class="detail-row">Заготовка КЖ-4<b>${rod.source_blank_length_mm?fmt(rod.source_blank_length_mm)+' мм':'погонные метры'}</b></div><div class="detail-row">Количество проекта<b>${fmt(family.source_quantity)} ${unit(family.source_quantity_unit)}</b></div></div><p>${[5,8].includes(rod.position)?'Показан только прямой размерный пролёт; крюки и вся длина заготовки не восстановлены.':'Длина линии схемы хранится отдельно от длины рабочей заготовки; нахлёсты, анкеровка и радиусы гибов не добавлены.'}</p>${rod.position===4?`<p>Лапа: ${rod.foot_direction==='towards_plate_field'?'в поле плиты':'от оси ростверка'}. Направление сверено по изображению сечения; это интерпретация рисунка.</p>`:''}${factBtn(pre+'.diameter','Ø · КЖ-4')}${factBtn(pre+'.quantity','Количество · КЖ-4')}<button data-rebar-element-details>Координаты, формулы и источники ↗</button><div class="callout"><b>I015 / I017</b>Отступы осевых линий и фазы — параметры сценария. Нельзя считать их автоматически рабочим защитным слоем и положением стыков.</div>`;
}
function inspectRebarFamily(position){const layout=ensureFoundationRebar(),f=layout.families.find(f=>f.position===position),pre='foundation.Фм1.rebar.'+position;$('inspector').innerHTML=`<div class="eyebrow">КЖ-3 / КЖ-4 / ПОЗ.${position}</div><h3>${REBAR_NAMES[position]}</h3><span class="status amber">Схема с открытыми привязками</span><div class="detail-list"><div class="detail-row">По ведомости<b>${fmt(f.source_quantity)} ${unit(f.source_quantity_unit)}</b></div><div class="detail-row">В общей схеме<b>${f.count} элементов</b></div><div class="detail-row">Заготовка<b>${f.source_blank_length_mm?f.source_blank_length_mm+' мм':'погонные метры'}</b></div></div><p>${[5,8].includes(position)?'В общей схеме показан размерный пролёт без крюков. Рабочая форма по одной разнице длин не назначается.':'Геометрическая схема и исходная ведомость сохранены отдельно. Фазы, стыки и контакты ещё требуют рабочей привязки.'}</p>${factBtn(pre+'.quantity','Количество · КЖ-4')}${factBtn(pre+'.diameter','Диаметр · КЖ-4')}${f.source_blank_length_mm?factBtn(pre+'.length','Заготовка · КЖ-4'):''}<button data-rebar-layout>Параметры и сверка всех позиций ↗</button>${sheetBtn('house_2',8)}`;}
function rebarLayoutPlan(){const s=foundationRebarState,layout=ensureFoundationRebar(),pos=s.selected?layout.rods.find(r=>r.id===s.selected)?.position:s.family==='all'?1:+s.family;return `<svg class="plan-svg" viewBox="-1200 -17000 19500 19000" role="img" aria-label="План осевых линий арматуры"><g transform="scale(1,-1)"><polygon points="${MODEL.foundation.slab.render_polygon_mm.map(p=>p.join(',')).join(' ')}" fill="#f2f4e8" stroke="#9eae93" stroke-width="25"/>${layout.rods.filter(r=>r.position===pos).map(r=>`<polyline points="${r.points_mm.map(p=>p.slice(0,2).join(',')).join(' ')}" fill="none" stroke="${r.id===s.selected?'#d68d20':'#6f856b'}" stroke-width="${r.id===s.selected?65:14}"><title>${r.id}</title></polyline>`).join('')}${layout.omissions.map(o=>`<circle cx="${o.at_mm[0]}" cy="${o.at_mm[1]}" r="60" fill="#ba7b3b"/>`).join('')}</g><text x="0" y="1500" font-size="230" fill="#6c765d">Поз.${pos} · сценарий · оранжевые точки требуют узла</text></svg>`;}
function rebarComparisonTable(){const layout=ensureFoundationRebar();return `<div class="table-wrap"><table><thead><tr><th>Поз.</th><th>В сцене</th><th>КЖ-4</th><th>Δ</th></tr></thead><tbody>${layout.families.map(f=>{const value=f.source_quantity_unit==='m'?f.visible_axis_length_m:f.count;return `<tr><td>${f.position}<br><small>${REBAR_NAMES[f.position]}</small></td><td class="number updated">${fmt(value,3)} ${unit(f.source_quantity_unit)}</td><td class="number"><del>${fmt(f.source_quantity)} ${unit(f.source_quantity_unit)}</del></td><td class="number check-bad">${fmt(value-f.source_quantity,3)}</td></tr>`;}).join('')}</tbody></table></div>`;}
function openRebarLayout(elementOnly=false){
 const s=foundationRebarState,layout=ensureFoundationRebar(),rod=layout.rods.find(r=>r.id===s.selected);
 const reasons={chair_footprint_does_not_fit_scenario_inset:'Лапы фиксатора не помещаются с выбранным отступом',L_profile_needs_corner_or_end_detail:'Нужна деталь Г-стержня у угла/окончания',U_profile_at_corner_needs_working_detail:'Нужна деталь П-стержня у угла'};
 showDialog('КЖ-2…4 / ОБЩАЯ СХЕМА / I015 / I017 / I018',elementOnly&&rod?'Поз.'+rod.position+' · '+rod.id:'Армирование: схема и сверка',`<div class="callout"><b>I015 / I017 · сценарий, не рабочая карта раскроя</b>Показаны 8 позиций. По проекту связаны диаметры, типовые сечения и шаги. Фазы и часть положений ещё условны; неизвестные стыки/радиусы/анкеровка не заменяются предполагаемыми числами.</div>
 <div class="section-grid"><div>${rebarLayoutPlan()}${rod?`<h3>${esc(rod.id)} · координаты осевой линии</h3><div class="formula">${rod.points_mm.map(p=>p.map(v=>fmt(v,6)).join(' / ')).join('<br>')}<br>Σ√(ΔX²+ΔY²+ΔZ²) = ${fmt(rod.visible_axis_length_mm,6)} мм</div><details><summary>Правило вычисления координат</summary><p class="hash">${esc(layout.coordinate_rules[rod.geometry_rule_id].formula)}</p></details><p>Размеры/высоты этой схемы и рабочая длина заготовки — разные величины.</p><details><summary>Все входные записи</summary>${rod.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label+' / '+FACTS.get(id)?.property)).join('<br>')}</details>`:''}</div><div><h3>Количество сцены и ведомость</h3>${rebarComparisonTable()}<p>В погонных метрах сравниваются только непрерывные линии 1/2/6 без стыков и анкеровки. Для остальных позиций сравнивается число изображённых элементов; видимая линия 5/8 не включает крюки. Остатки не скрыты и не подогнаны.</p><p>Исходный итог: ${factBtn('foundation.Фм1.steel_kg_total','5748,9 кг · 5% уже учтены')}</p></div></div>
 <div class="callout"><b>I018 · класс позиции 7</b>В строке 7 напечатано А500, в группе итоговых масс — А500С. Оба написания сохранены; класс изделия автоматически не исправлен.</div><h3 style="margin-top:25px">Изменяемые параметры схемы</h3><p>Это варианты привязки осевых линий. Они не являются подписями проекта и не назначают рабочий защитный слой. Высотное разведение направлений сетки и контакты фиксаторов ещё не восстановлены.</p><form id="rebar-parameters" class="input-grid"><label>Фаза сетки X, мм<input name="phase_x_mm" type="number" min="0" max="199" step="1" value="${s.parameters.phase_x_mm}" required></label><label>Фаза сетки Y, мм<input name="phase_y_mm" type="number" min="0" max="199" step="1" value="${s.parameters.phase_y_mm}" required></label><label>Отступ линий сеток / поз.7, мм<input name="axis_inset_mm" type="number" min="1" max="150" step="1" value="${s.parameters.axis_inset_mm}" required></label><label>Позиция 7 · область<select name="edge_scope"><option value="entire_perimeter_hypothesis" ${s.parameters.edge_scope==='entire_perimeter_hypothesis'?'selected':''}>Весь периметр · гипотеза</option><option value="free_edge_hypothesis" ${s.parameters.edge_scope==='free_edge_hypothesis'?'selected':''}>Свободные края · гипотеза</option></select></label><div><button type="submit">Показать этот сценарий</button></div></form>
 <details style="margin-top:20px"><summary>Прочие условные положения</summary><div class="formula">Фиксаторы: X=${s.parameters.chair_phase_x_mm}, Y=${s.parameters.chair_phase_y_mm} мм; соседние ряды смещены на400 мм при шаге800.<br>Фаза поперечных деталей: ${s.parameters.beam_station_phase_mm} мм.<br>Отступ окончания продольной линии: ${s.parameters.beam_end_inset_mm} мм.<br>Фаза P7 вдоль периметра: ${s.parameters.edge_station_phase_mm} мм.<br>Z линий сеток: ${layout.z_convention.bottom_mm} / ${layout.z_convention.top_mm} мм; направлений по диаметрам здесь не разнесено.<br>Z лап фиксатора: ${layout.z_convention.chair_foot_mm} мм = Z нижней линии + ${s.parameters.chair_base_lift_mm} мм; добавка — условный параметр, контакты схемные.</div></details>
 <details><summary>Участки проверки: ${layout.omissions.length}</summary><table><thead><tr><th>Поз.</th><th>X / Y, мм</th><th>Причина</th></tr></thead><tbody>${layout.omissions.map(o=>`<tr><td>${o.position}</td><td class="number">${o.at_mm.map(v=>fmt(v,3)).join(' / ')}</td><td>${reasons[o.reason]||esc(o.reason)}</td></tr>`).join('')}</tbody></table><p>Эти случаи не заполнены выдуманным гибом; их метки вынесены в отдельный слой3D.</p></details>
 <div class="callout" style="margin-top:20px">${layout.limitations.map(esc).join('<br>')}</div>${sheetBtn('house_2',7)}${sheetBtn('house_2',8)}${sheetBtn('house_2',9)}`);
 $('rebar-parameters').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;const values=new FormData(form);s.parameters={...s.parameters,phase_x_mm:+values.get('phase_x_mm'),phase_y_mm:+values.get('phase_y_mm'),axis_inset_mm:+values.get('axis_inset_mm'),edge_scope:values.get('edge_scope')};s.layout=RebarLayout.build(MODEL.foundation,DATA.facts,s.parameters);s.selected=null;$('source-dialog').close();activateTab('model');buildScene('rebar');};
}
document.addEventListener('click',e=>{if(e.target.closest('[data-rebar-layout]'))openRebarLayout();if(e.target.closest('[data-rebar-element-details]'))openRebarLayout(true);});

'use strict';
let serviceDetailRenderer=null,serviceDetailState=null;
const SERVICE_GROUPS={slab:{label:'Плита',color:[.65,.71,.61]},base:{label:'Подготовка / щебень',color:[.63,.63,.53]},sleeve:{label:'Стальная гильза',color:[.37,.46,.48]},pipe:{label:'Труба · наружная поверхность',color:[.64,.37,.22]},seal:{label:'Место герметизации',color:[.27,.55,.62]}};
function disposeServiceDetailViewer(){serviceDetailRenderer?.dispose();serviceDetailRenderer=null;serviceDetailState=null;}
function serviceDetailButtons(){return `<div class="card"><div class="eyebrow">ЛОКАЛЬНЫЕ РАЗРЕЗЫ</div><h3>Посмотреть проход изнутри</h3><p>Полые гильзы, плита и основание. Известные размеры отделены от условных длин фрагментов.</p><div class="buttons-row">${MODEL.service_details.map(d=>`<button data-service-detail="${d.id}">${esc(d.title)} ↗</button>`).join('')}</div></div>`;}
function openServiceDetail(id){
 return prepareDialog(['renderer','facts','service-details'],()=>renderServiceDetail(id));
}
function renderServiceDetail(id){
 const d=MODEL.service_details.find(d=>d.id===id);if(!d)return;
 const groups=id==='electric'?['sleeve']:Object.keys(SERVICE_GROUPS);
 showDialog(d.sheet+' / ЛОКАЛЬНЫЙ УЗЕЛ',d.title,`<div class="callout"><b>${d.issue_ids.join(' / ')} · известные размеры и открытые вопросы</b>${d.notes.map(esc).join('<br>')}</div>
 <div class="roof-detail-controls" style="margin:18px 0"><label>Элемент<select id="service-detail-part"><option value="all">Весь узел</option>${groups.map(k=>`<option value="${k}">${SERVICE_GROUPS[k].label}</option>`).join('')}</select></label><label class="control"><input id="service-detail-isolate" type="checkbox"> Только выбранный элемент</label><label class="control"><input id="service-detail-section" type="checkbox" checked> Открыть половину сечения</label>${d.variants?`<label>Диаметр воды · I008<select id="service-detail-variant">${d.variants.map(v=>`<option value="${v.id}">${esc(v.label)}</option>`).join('')}</select></label>`:''}</div>
 <div class="viewport roof-detail-viewport"><canvas id="service-detail-canvas" tabindex="0" aria-label="3D-узел прохода через плиту"></canvas><div class="viewport-top"><span class="status amber">Верх плиты = 0 · локальная схема</span></div><div class="view-tools"><button id="service-detail-iso">3D</button><button id="service-detail-front">Сечение</button><button id="service-detail-top">Сверху</button><button id="service-detail-reset">↺</button></div><div class="scene-help">ЛКМ — вращение · Shift — сдвиг · колесо — масштаб</div></div>
 <div class="roof-detail-layers">${groups.map(k=>`<label>${SERVICE_GROUPS[k].label}<input data-service-opacity="${k}" type="range" min="0" max="100" value="${k==='slab'?35:k==='base'?20:k==='seal'?65:100}"></label>`).join('')}</div><div id="service-detail-inspector" class="card"></div>
 <div class="buttons-row"><span id="service-detail-stat" class="tiny muted"></span>${sheetBtn(d.source_id,d.pdf_page,'Исходный лист')}</div>
 <details style="margin:20px 0"><summary>Условные длины и локальная система</summary><p>${esc(d.local_origin)} Все числа ниже — параметры просмотра. Длина гильзы и трубы для закупки не определена.</p><div class="hash">${Object.entries(d.conditional_parameters).map(([k,v])=>esc(({fragment_half_width_mm:'Половина ширины фрагмента, мм',sleeve_below_plate_mm:'Условное продолжение гильзы под плитой, мм',pipe_top_mm:'Верх фрагмента трубы, мм',pipe_below_sleeve_mm:'Продолжение трубы под гильзой, мм',pipe_sample_run_mm:'Проекция демонстрационного выпуска, мм',bend_radius_mm:'Демонстрационный радиус, мм',seal_display_depth_mm:'Глубина цветного указателя уплотнения, мм',circular_display_sides:'Стороны аппроксимации окружности',display_length_mm:'Длина видимого отрезка, мм'})[k])+': '+v).join('<br>')}</div></details>
 <h3>Источник рядом с моделью</h3><img src="${DATA.crops['service-'+id]}" alt="Исходный узел прохода">`);
 serviceDetailState={detail:d,part:'all',variant:d.variants?.[0].id||null,opacities:{slab:.35,base:.2,sleeve:1,pipe:1,seal:.65}};
 try{serviceDetailRenderer=new HouseGL($('service-detail-canvas'),id=>{if(id.startsWith('service-part:')){$('service-detail-part').value=id.slice(13);serviceDetailState.part=id.slice(13);drawServiceDetail();}},s=>{if(s.error&&$('service-detail-stat'))$('service-detail-stat').textContent=s.error;});resetServiceDetail();drawServiceDetail();}catch(e){$('service-detail-inspector').textContent=e.message;}
 $('service-detail-part').onchange=e=>{serviceDetailState.part=e.target.value;drawServiceDetail();};$('service-detail-isolate').onchange=drawServiceDetail;$('service-detail-section').onchange=drawServiceDetail;
 if($('service-detail-variant'))$('service-detail-variant').onchange=e=>{serviceDetailState.variant=e.target.value;drawServiceDetail();};
 document.querySelectorAll('[data-service-opacity]').forEach(e=>e.oninput=()=>{const k=e.dataset.serviceOpacity;serviceDetailState.opacities[k]=+e.value/100;const l=serviceDetailRenderer.layers.get(k);if(l)l.opacity=+e.value/100;serviceDetailRenderer.request();});
 $('service-detail-iso').onclick=()=>{serviceDetailRenderer.yaw=-.55;serviceDetailRenderer.pitch=1.05;serviceDetailRenderer.request();};$('service-detail-front').onclick=()=>{serviceDetailRenderer.yaw=0;serviceDetailRenderer.pitch=Math.PI/2;serviceDetailRenderer.request();};$('service-detail-top').onclick=()=>{serviceDetailRenderer.yaw=0;serviceDetailRenderer.pitch=.00001;serviceDetailRenderer.request();};$('service-detail-reset').onclick=resetServiceDetail;
}
function resetServiceDetail(){const r=serviceDetailRenderer;if(!r)return;r.yaw=-.55;r.pitch=1.05;r.pan=[0,0];r.target=serviceDetailState.detail.id==='electric'?[0,0,0]:[200,0,-450];r.span=serviceDetailState.detail.id==='electric'?650:2000;r.request();}
function drawServiceDetail(){
 const g=serviceDetailRenderer,s=serviceDetailState;if(!g||!s)return;const d=s.detail,p=d.conditional_parameters,section=$('service-detail-section').checked;g.clear();
 const layers={};for(const [id,m]of Object.entries(SERVICE_GROUPS)){if($('service-detail-isolate').checked&&s.part!=='all'&&s.part!==id)continue;layers[id]=g.addLayer(id,s.part===id?[.84,.55,.20]:m.color,{opacity:s.opacities[id],order:id==='slab'?4:id==='base'?5:2});}
 const id=k=>'service-part:'+k,allowed=a=>!section||Math.sin(a)>=-1e-8;
 // Annulus with open, selectable inner wall: no solid cylinder masquerading as a sleeve.
 const shell=(key,r0,r1,z0,z1)=>{
  const l=layers[key];if(!l)return;
  const at=(r,t,z)=>[r*Math.cos(t),r*Math.sin(t),z];
  for(let i=0;i<(section?16:32);i++){
   const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
   g.face(l,[at(r1,a,z0),at(r1,b,z0),at(r1,b,z1),at(r1,a,z1)],null,id(key));
   if(r0!==null){
    g.face(l,[at(r0,b,z0),at(r0,a,z0),at(r0,a,z1),at(r0,b,z1)],null,id(key));
    for(const z of [z0,z1])g.face(l,[at(r0,a,z),at(r0,b,z),at(r1,b,z),at(r1,a,z)],null,id(key));
   }
   for(const z of [z0,z1])g.line(l,at(r1,a,z),at(r1,b,z));
   if(i%4===0)g.line(l,at(r1,a,z0),at(r1,a,z1));
  }
  if(section&&r0!==null)for(const t of [0,Math.PI])g.face(l,[at(r0,t,z0),at(r1,t,z0),at(r1,t,z1),at(r0,t,z1)],null,id(key));
 };
 if(d.id==='electric'){shell('sleeve',null,d.sleeve_outer_diameter_mm/2,-200,200);}
 else{
  const outer=d.sleeve_outer_diameter_mm/2,inner=d.sleeve_inner_diameter.value_mm/2,variant=d.variants?.find(v=>v.id===s.variant),pipe=(variant?.pipe_diameter_mm||d.pipe_diameter_mm)/2;
  // A square source-thickness fragment with a circular opening; radial sectors cover it without filling the sleeve.
  const plate=(key,z0,z1)=>{const l=layers[key];if(!l)return;for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;if(!allowed((a+b)/2))continue;const at=(t,r,z)=>[r*Math.cos(t),r*Math.sin(t),z],far=t=>p.fragment_half_width_mm/Math.max(Math.abs(Math.cos(t)),Math.abs(Math.sin(t)));for(const z of [z0,z1])g.face(l,[at(a,outer,z),at(a,far(a),z),at(b,far(b),z),at(b,outer,z)],null,id(key));g.face(l,[at(a,far(a),z0),at(b,far(b),z0),at(b,far(b),z1),at(a,far(a),z1)],null,id(key));g.face(l,[at(b,outer,z0),at(a,outer,z0),at(a,outer,z1),at(b,outer,z1)],null,id(key));if(section&&(i===0||i===15)){const t=i===0?a:b;g.face(l,[at(t,outer,z0),at(t,far(t),z0),at(t,far(t),z1),at(t,outer,z1)],null,id(key));}g.line(l,at(a,far(a),z0),at(b,far(b),z0));g.line(l,at(a,far(a),z1),at(b,far(b),z1));}};
  plate('slab',-d.slab_thickness_mm,0);let z=-d.slab_thickness_mm;for(const h of [d.blinding_thickness_mm,...d.gravel_thicknesses_mm]){plate('base',z-h,z);z-=h;}
  const bottom=-d.slab_thickness_mm-p.sleeve_below_plate_mm;shell('sleeve',inner,outer,bottom,d.sleeve_above_plate_mm);shell('seal',pipe,inner,d.sleeve_above_plate_mm-p.seal_display_depth_mm,d.sleeve_above_plate_mm);
  if(layers.pipe){
   const z0=bottom-p.pipe_below_sleeve_mm,run=p.pipe_sample_run_mm,bend=p.bend_radius_mm;
   shell('pipe',null,pipe,z0,p.pipe_top_mm);
   const slope=d.id==='sewer'?d.outlet_slope:0;
   const ring=(x,z,angle)=>Array.from({length:33},(_,j)=>{
    const t=j*Math.PI/16,radial=pipe*Math.cos(t);
    return [x+radial*Math.cos(angle),pipe*Math.sin(t),z+radial*Math.sin(angle)];
   });
   let previous=ring(0,z0,0);
   const join=next=>{
    for(let j=0;j<(section?16:32);j++)g.face(layers.pipe,[previous[j],previous[j+1],next[j+1],next[j]],null,id('pipe'));
    previous=next;
   };
   for(let i=1;i<=16;i++){
    const angle=i*Math.PI/32;
    join(ring(bend*(1-Math.cos(angle)),z0-bend*Math.sin(angle),angle));
    if(d.id==='sewer'&&i===8)g.polyline(layers.pipe,previous.slice(0,section?17:33));
   }
   join(ring(bend+run,z0-bend-run*slope,Math.PI/2-Math.atan(slope)));
  }
 }
 g.commit();g.request();
 const keys=s.part==='all'?d.input_fact_ids:d.input_fact_ids.filter(i=>s.part==='sleeve'?/sleeve_/.test(i):s.part==='pipe'?/pipe_|elbow|slope/.test(i):s.part==='seal'?/seal_/.test(i):s.part==='slab'?/slab_thickness/.test(i):/blinding|gravel/.test(i));
 $('service-detail-inspector').innerHTML=`<div class="eyebrow">${s.part==='all'?'УЗЕЛ ЦЕЛИКОМ':'ВЫБРАННЫЙ ЭЛЕМЕНТ'}</div><h3>${s.part==='all'?esc(d.title):SERVICE_GROUPS[s.part].label}</h3><p>Гильза: Ø${d.sleeve_outer_diameter_mm}${d.sleeve_wall_mm?'×'+d.sleeve_wall_mm:' · стенка неизвестна'} мм.${d.sleeve_inner_diameter?` Внутренний диаметр = ${d.sleeve_outer_diameter_mm} − 2 × ${d.sleeve_wall_mm} = ${d.sleeve_inner_diameter.value_mm} мм (derived).`:''}</p><p class="check-bad">Длина гильзы и абсолютная отметка трубы не заданы. Видимые отрезки — условные параметры; закупочного количества труб здесь нет.</p>${d.id==='sewer'?'<p>Две части дуги по 45°, радиус условный. Прямой выпуск показан с i=0,02; сопряжение его оси с коленом условное. Раструбы не восстановлены.</p>':''}${d.id==='water'?'<p class="check-bad">I008 · выбор Ø63 / 65 / Ø32 меняет только сценарий просмотра, а не проектную базу.</p>':''}${keys.map(i=>factBtn(i,FACTS.get(i)?.label+' · '+FACTS.get(i)?.value+' '+unit(FACTS.get(i)?.unit))).join('<br>')}`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-service-detail]');if(b)openServiceDetail(b.dataset.serviceDetail);});

'use strict';
const stairState={stairVariant:'upper_aligned',slabVariant:'lower_chain',finishMm:20,showFinish:false};
const activeStair=()=>MODEL.stairs.variants.find(v=>v.id===stairState.stairVariant);
const activeSlab=()=>MODEL.slab2.variants.find(v=>v.id===stairState.slabVariant);
const activeStairCoordination=()=>MODEL.stairs.coordination.find(v=>v.stair_variant===stairState.stairVariant&&v.slab_variant===stairState.slabVariant);
function drawStairInterior(g,s,hole){
 const landing=s.landing.bounds_mm.map(Number),upper=s.flights.find(f=>f.id==='upper');
 const walls=addLayer(g,'stairPartitions',{showEdges:false,explodeOrder:1});
 const rear=MODEL.floor2.walls.find(w=>w.id==='upper-stair-west').bounds_mm.map(Number);
 // AR-9: the stairwell wall stands on the intermediate landing above the boiler room.
 const closure=[...rear.slice(0,2),landing[5],...rear.slice(2),Number(MODEL.slab2.top_mm)];
 g.box(walls,...closure,'stair:landing-wall',false);
 g.stairBarriers=[closure];
 // Close the return at the inner string of the upper flight above room 9.
 // The under-flight wall reaches the soffit across the strip between it and the flight.
 const wc=MODEL.floor1.walls.find(w=>w.id==='wc2-frame').bounds_mm.map(Number);
 const yInner=Number(upper.y_bounds_mm[0]),soffit=stairWallEnvelopes()[1].plane;
 const eastWall=MODEL.floor1.walls.find(w=>w.id==='bearing3').bounds_mm.map(Number);
 const foot=[[wc[0],wc[3]],[eastWall[0],wc[3]],[eastWall[0],yInner],[wc[0],yInner]];
 HouseShapes.prism(g,walls,{polygon_mm:foot,bottom_plane:[0,0,0],top_plane:soffit},'stair:wc-return');
 g.stairWcReturn={foot,top:soffit};
 // The passage to room 9 crosses axis E below the upper flight. Close the
 // space above its clear height, from the flight's soffit to the slab.
 const [minX,,,maxX]=MODEL.floor1.openings.find(o=>o.id==='o-wc2-access').bounds_mm.map(Number);
 const [,minY,,maxY]=MODEL.floor1.walls.find(w=>w.id==='bearingЕ').bounds_mm.map(Number);
 const apron={polygon_mm:[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]],
  bottom_plane:soffit,top_plane:[0,0,Number(MODEL.slab2.bottom_mm)]};
 const bearingLayer=['house','floor1'].includes(mode)?g.layers.get('walls1'):walls;
 HouseShapes.prism(g,bearingLayer,apron,'stair:wc-apron');
 g.stairWcApron=apron;
 const metal=addLayer(g,'stairGuards',{showEdges:false}),wood=g.addLayer('stairHandrail',[.61,.42,.24],{showEdges:false});
 LAYER_META.stairHandrail=['Дубовый поручень',wood.color];g.guardRuns=[];
 const rail=(a,b,base,posts=true)=>{
  const topA=a[2]+1000,topB=b[2]+1000,id='stair:handrail';
  g.tube(wood,[a[0],a[1],topA],[b[0],b[1],topB],26,12,id);
  if(!posts)return;
  const spans=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/110);
  for(let i=0;i<=spans;i++){
   const t=i/spans,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=base(x);
   g.box(metal,x-8,y-8,z,x+8,y+8,topA+(topB-topA)*t,'stair:balusters',false);
  }
  g.guardRuns.push({a,b});
 };
 for(const f of s.flights){
  const upperFlight=f.id==='upper',steps=f.steps.map(step=>step.bounds_mm.map(Number)),y=Number(f.y_bounds_mm[0])+(upperFlight?35:65);
  const first=steps[0],last=steps.at(-1),xA=upperFlight?first[0]+35:first[3]-35,xB=upperFlight?last[3]-35:last[0]+35;
  rail([xA,y,first[2]],[xB,y,last[2]],x=>steps.find(r=>r[0]<=x&&x<=r[3])[2],upperFlight);
  if(!upperFlight)for(const step of [first,steps[4],last]){
   const x=(step[0]+step[3])/2,z=first[2]+(last[2]-first[2])*(x-xA)/(xB-xA)+982;
   g.tube(metal,[x,y-65,z],[x,y,z],10,8,'stair:handrail');
  }
 }
 const floor=n('level.floor_2.elevation')*1000,wallEnd=Number(MODEL.floor2.walls.find(w=>w.id==='upper-bearingГ').bounds_mm[2]);
 const x=hole[2]+35,y=hole[1]-35;
 rail([wallEnd,y,floor],[x,y,floor],()=>floor);
 rail([x,y,floor],[x,yInner-25,floor],()=>floor);
}
function drawIntermediateSlab(g,l){
 const m=MODEL.slab2,v=activeSlab(),z0=+m.bottom_mm,z1=+m.top_mm;
 for(const r of v.disjoint_rectangles_mm){const [x0,y0,x1,y1]=r.map(Number);g.face(l,[[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]],[0,0,-1],'slab2');g.face(l,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],[0,0,1],'slab2');}
 for(const edge of v.boundary_edges_mm){const [a,b]=edge.map(p=>p.map(Number));g.face(l,[[...a,z0],[...b,z0],[...b,z1],[...a,z1]],null,'slab2');for(const z of [z0,z1])g.line(l,[...a,z],[...b,z]);}
}
function drawStaircase(g,visible){
 const s=activeStair(),slab=activeSlab();
 const layers={lower:g.addLayer('stairsLower',[.60,.66,.56],{visible,explodeOrder:1,order:11}),upper:g.addLayer('stairsUpper',[.66,.71,.61],{visible,explodeOrder:1,order:11}),landing:g.addLayer('stairLanding',[.68,.70,.57],{visible,explodeOrder:1,order:11}),brick:g.addLayer('stairBrick',[.65,.44,.29],{visible,opacity:.25,explodeOrder:1,order:12}),finish:g.addLayer('stairFinish',[.69,.56,.32],{visible:visible&&stairState.showFinish,explodeOrder:1,order:12}),checks:g.addLayer('stairChecks',[.75,.43,.17],{visible:mode==='stairs',order:13,explodeOrder:1})};
 for(const f of s.flights){const l=layers[f.id],p=f.profile_xz_mm,[y0,y1]=f.y_bounds_mm.map(Number),tris=HouseGL.triangulate(p);
  for(const t of tris){g.face(l,t.map(i=>[p[i][0],y0,p[i][1]]),[0,-1,0],'stairs'+(f.id==='lower'?'Lower':'Upper'));g.face(l,[...t].reverse().map(i=>[p[i][0],y1,p[i][1]]),[0,1,0],'stairs'+(f.id==='lower'?'Lower':'Upper'));}
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],step=i%2===0&&i<2*f.tread_count?i/2+1:null,object=step?'stair:'+f.id+':'+step:'stairs'+(f.id==='lower'?'Lower':'Upper');g.face(l,[[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]]],null,object);for(const y of [y0,y1])g.line(l,[a[0],y,a[1]],[b[0],y,b[1]]);if(step)g.line(l,[a[0],y0,a[1]],[a[0],y1,a[1]]);}
  if(stairState.finishMm>0)for(const step of f.steps){const r=step.bounds_mm.map(Number);g.box(layers.finish,r[0],r[1],r[2],r[3],r[4],r[5]+stairState.finishMm,'stair:'+f.id+':'+step.step_index);}
 }
 g.box(layers.landing,...s.landing.bounds_mm.map(Number),'stairLanding');
 for(const p of s.brick_piers)g.box(layers.brick,...p.bounds_mm.map(Number),'stairBrick');
 const r=s.landing.bounds_mm.map(Number);if(stairState.finishMm>0)g.box(layers.finish,r[0],r[1],r[5],r[3],r[4],r[5]+stairState.finishMm,'stairLanding');
 const x3=+MODEL.axis_view_variant.x['3'],y0=r[1],y1=r[4];
 for(const chain of ['lower','upper']){const x=x3+n('stairs.Лм1.plan.'+chain+'_end_right_of_3');g.line(layers.checks,[x,y0,0],[x,y1,0]);}
 const hole=slab.opening.bounds_mm.map(Number);g.polyline(layers.checks,[[hole[0],hole[1],3205],[hole[2],hole[1],3205],[hole[2],hole[3],3205],[hole[0],hole[3],3205]],true);
 if(['house','stairs','floor2','floor1'].includes(mode))drawStairInterior(g,s,hole);
 for(const r of activeStairCoordination().landing_under_slab_patches_mm){const [x0,y0,x1,y1]=r.map(Number);g.face(layers.checks,[[x0,y0,1632],[x1,y0,1632],[x1,y1,1632],[x0,y1,1632]],[0,0,1],'stairChecks');}
 if(mode==='stairs'){
  g.labels.push({text:'Площадка +1.630 · КЖ-15',p:[r[0]+150,r[4]+150,1630],id:'stairLanding',layer:'stairLanding',color:'#916b36'});
  g.labels.push({text:'Проём 3820×2420 · I019',p:[hole[2]+50,hole[3],3350],id:'slab2',layer:'slab2',color:'#916b36'});
 }
}
function renderStairTools(){const mount=$('stair-tools');if(!mount)return;mount.hidden=mode!=='stairs';if(mount.hidden)return;
 mount.innerHTML=`<label>Выравнивание маршей<select id="stair-variant">${MODEL.stairs.variants.map(v=>`<option value="${v.id}" ${v.id===stairState.stairVariant?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label><label>Проём перекрытия<select id="slab-variant">${MODEL.slab2.variants.map(v=>`<option value="${v.id}" ${v.id===stairState.slabVariant?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label><label>Отделка, мм · сценарий<input id="stair-finish-mm" type="number" min="0" max="100" step="1" value="${stairState.finishMm}"></label><label class="control"><input type="checkbox" id="stair-finish" ${stairState.showFinish?'checked':''}> Отделка · сценарий ${stairState.finishMm} мм</label><button data-stair-slab>Расчёт и источники ↗</button><p class="tiny muted">I019: 10/40 мм сохранены в источниках. Толщина площадки и высота кирпичных простенков условны. Отделка не взята из защитного размера 20.</p>`;
 $('stair-variant').onchange=e=>{stairState.stairVariant=e.target.value;buildScene('stairs');};$('slab-variant').onchange=e=>{stairState.slabVariant=e.target.value;buildScene('stairs');};$('stair-finish-mm').onchange=e=>{const value=+e.target.value;if(Number.isFinite(value)&&value>=0&&value<=100){stairState.finishMm=value;buildScene('stairs');}};$('stair-finish').onchange=e=>{stairState.showFinish=e.target.checked;const l=renderer.layers.get('stairFinish');l.visible=e.target.checked;renderLayerControls();renderer.request();};
}
function stairPlanSVG(){const st=activeStair(),sl=activeSlab(),r=sl.opening.bounds_mm.map(Number);return `<svg class="plan-svg" viewBox="2350 -10100 5800 4200" role="img" aria-label="Вариант отверстия и двух маршей"><g transform="scale(1,-1)"><rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="#e3e8da" stroke="#a97a3a" stroke-width="20"/>${st.flights.flatMap(f=>f.steps).map(p=>{const a=p.bounds_mm.map(Number);return `<rect x="${a[0]}" y="${a[1]}" width="${a[3]-a[0]}" height="${a[4]-a[1]}" fill="#a5b497" stroke="#5b6f50" stroke-width="12"/>`;}).join('')}${(()=>{const a=st.landing.bounds_mm.map(Number);return `<rect x="${a[0]}" y="${a[1]}" width="${a[3]-a[0]}" height="${a[4]-a[1]}" fill="#c5b17d" stroke="#8c753e" stroke-width="15"/>`;})()}</g><text x="3000" y="-9600" font-size="180" fill="#756136">Площадка +1.630 · два исходных выравнивания</text><text x="4500" y="-6250" font-size="170" fill="#756136">Окончания +480 / +520 от оси 3 · I019</text></svg>`;}
function openStairSlab(){const st=activeStair(),sl=activeSlab(),q=MODEL.slab2,s=MODEL.stairs;const fmtCheck=c=>`<tr><td>${esc(c.label||c.id)}</td><td>${fmt(c.value)} ${unit(c.unit)}</td><td>${fmt(c.printed)} ${unit(c.unit)}</td><td class="${Math.abs(+c.difference)>.0001?'check-bad':'check-good'}">${fmt(c.difference)}</td></tr>`;
 const treads=st.flights.flatMap(f=>f.steps.map(p=>({flight:f.label,...p}))),bare=st.bare_levels_mm.map(Number),finished=bare.map((z,i)=>i===0?n('level.floor_1.elevation')*1000:i===bare.length-1?n('level.floor_2.elevation')*1000:z+stairState.finishMm),risers=finished.slice(1).map((z,i)=>z-finished[i]);
 const coord=activeStairCoordination();
 showDialog('КЖ-7 / КЖ-15 / РАСЧЁТНЫЕ ВАРИАНТЫ','Лестница, проём и перекрытие',`<div class="callout"><b>I019 / I020 · размеры не подогнаны</b>${s.limitations.map(esc).join('<br>')}<br>${q.limitations.map(esc).join('<br>')}</div>
 ${stairPlanSVG()}<div class="buttons-row">${sheetBtn('house_2',12,'КЖ-7 · проём и контур')}${sheetBtn('house_2',20,'КЖ-15 · лестница')}${sheetBtn('house_2',13,'КЖ-8 · ведомость')}</div>
 <h3>Активные варианты</h3><p>${esc(st.label)}<br>${esc(sl.label)}</p><div class="callout"><b>Совмещение площадки с перекрытием</b>В выбранном варианте ${fmt(coord.landing_under_slab_area_m2,6)} м² площадки находятся под Пм1. По геометрии расстояние от бетонного верха площадки до низа перекрытия ${fmt(coord.vertical_distance_bare_landing_to_slab_bottom_mm)} мм; со сценарием отделки — ${fmt(+coord.vertical_distance_bare_landing_to_slab_bottom_mm-stairState.finishMm)} мм. Участок выделен янтарным. Это открытая привязка, не проверка соответствия нормативам. От конца верхнего марша до восточного края отверстия: ${fmt(coord.upper_end_to_opening_east_mm)} мм.</div><div class="table-wrap"><table><thead><tr><th>Сверка</th><th>Вариант</th><th>Подпись</th><th>Разница</th></tr></thead><tbody>${[...st.checks,...sl.checks].map(fmtCheck).join('')}</tbody></table></div>
 <div class="card"><h3>Бетон и исходные ведомости</h3><p>Пм1: геометрия ${fmt(sl.flat_volume_m3,6)} м³; ведомость ${factBtn('slab.Пм1.concrete.quantity','29,0 м³')}. Площадь ${fmt(sl.net_area_m2,6)} м² против ${factBtn('slab.Пм1.area.quantity','120,3 м²')}.</p><p class="check-bad">Даже 120,3 × 0,180 = 21,654 м³, а не 29,0. Состав расхождения не установлен (I020); добавлением запаса его не закрываем.</p><p>Лм1: геометрический вариант ${fmt(st.concrete_geometry_m3,6)} м³ против ${factBtn('stairs.Лм1.concrete.quantity','1,5 м³')}; разница ${fmt(st.concrete_residual_m3,6)} м³. В расчёт входит условная толщина площадки160 и интерпретация сопряжений, поэтому он не заменяет ведомость.</p><p>Кирпич ${factBtn('stairs.Лм1.brick.quantity','1,4 м³')} и сталь ${factBtn('stairs.Лм1.steel_kg_total','198,1 кг')} — исходные количества. Геометрия простенков не пересчитана для закупки, арматура лестницы здесь не разложена.</p></div>
 <h3>Ступени и чистовые отметки</h3><p>По 9 проступей на марш: 2700/300. Бетон: первая +0.145, площадка +1.630, верх перекрытия +3.200. Подступенки по бетону: ${st.bare_risers_mm.join(' / ')} мм.</p><p class="check-bad">Сценарий отделки ${stairState.finishMm} мм даёт чистовые подступенки: ${risers.map(v=>fmt(v)).join(' / ')} мм, между чистыми полами0/+3.300. Это проверка гипотезы отделки, не подписанная спецификация. Размер20 у арматуры хранится отдельно как защитный.</p>
 <div class="table-wrap"><table><thead><tr><th>Марш / ступень</th><th>Бетон, мм</th><th>Со сценарием отделки, мм</th><th>Источник / формула</th></tr></thead><tbody>${treads.map(p=>`<tr><td>${esc(p.flight)} / ${p.step_index}</td><td>${fmt(p.bounds_mm[2])}</td><td>${fmt(+p.bounds_mm[2]+stairState.finishMm)}</td><td><details><summary>derived</summary><span class="hash">${esc(p.formula_elevation)}</span><br>${p.input_fact_ids.map(id=>factBtn(id)).join(' ')}</details></td></tr>`).join('')}</tbody></table></div>
 <div class="card"><h3>Местный вид В</h3><p>${factBtn('stairs.Лм1.viewВ.top','Верх +2.125')} / ${factBtn('stairs.Лм1.viewВ.bottom','Низ +1.965')}. Этот участок не назначен площадкой +1.630: соответствие в общей лестнице не установлено.</p>${factBtn('stairs.Лм1.section.top_rebar_cover','Размер20 у арматуры')}${factBtn('stairs.Лм1.plan.landing_top','Площадка на плане')}</div>`);
}
function inspectStairPart(id){if(!['slab2','stairsLower','stairsUpper','stairLanding','stairBrick','stairFinish','stairChecks'].includes(id)&&!id.startsWith('stair:'))return false;
 const m=activeStair(),sl=activeSlab();
 let title='Лестница и отверстие',text='Размерные варианты КЖ-7/15, исходные цепи и ведомости сохранены.',ids=[];
 if(id.startsWith('stair:')){const [,flight,num]=id.split(':'),p=m.flights.find(f=>f.id===flight)?.steps.find(s=>s.step_index===+num);if(p){title=(flight==='lower'?'Нижний':'Верхний')+' марш · ступень '+num;text=`Бетонный верх ${fmt(p.bounds_mm[2])} мм. Проступь300, ширина1100. Формула: ${p.formula_elevation}. Отделка${stairState.finishMm} — отдельный сценарий.`;ids=p.input_fact_ids;}}
 else if(id==='slab2'){title='Пм1 · контур и отверстия';text=`Площадь варианта ${fmt(sl.net_area_m2,6)} м², бетон ${fmt(sl.flat_volume_m3,6)} м³; ведомость120.3 м²/29.0 м³. Выбран ${sl.label}. Край/проходы имеют открытые условия I020.`;ids=['slab.Пм1.area.quantity','slab.Пм1.concrete.quantity','slab.Пм1.plan.edge_offset','slab.Пм1.section.thickness'];}
 else if(id==='stairBrick'){title='Кирпичные простенки';text='Толщина250 по плану. Высота и контакт с площадкой — параметры изображения. Для закупки сохранены1.4 м³ источника.';ids=['stairs.Лм1.plan.brick_pier_thickness','stairs.Лм1.brick.quantity'];}
 else if(id==='stairLanding'){title='Площадка +1.630';text='Отметка плана сохранена. Горизонтальная толщина160 условна; местный видВ+2.125/+1.965 ещё не связан с конкретной площадкой.';ids=['stairs.Лм1.plan.landing_top','stairs.Лм1.viewВ.top','stairs.Лм1.viewВ.bottom'];}
 else if(id==='stairFinish'){title='Отделка · пользовательский сценарий';text=`Толщина${stairState.finishMm} мм не взята из защитного размера20 у арматуры. Сценарий нужен для проверки одинаковых подступенков между чистыми полами0/+3.300.`;ids=['level.floor_1.elevation','level.floor_2.elevation','stairs.Лм1.section.top_rebar_cover'];}
 else{title=id==='stairsLower'?'Нижний марш':id==='stairsUpper'?'Верхний марш':'Расхождения и контрольные линии';text='9 проступей300, подступенки165, нормальная толщина160 по рисунку. Выбранное выравнивание сохраняет исходный альтернативный конец40 мм в таблице. Концевые контакты и арматура не утверждены.';ids=['stairs.Лм1.section.tread','stairs.Лм1.section.riser','stairs.Лм1.section.waist_thickness'];}
 $('inspector').innerHTML=`<div class="eyebrow">КЖ-7 / КЖ-15</div><h3>${esc(title)}</h3><span class="status amber">Вариант · I019 / I020</span><p>${esc(text)}</p><p class="check-bad">Геометрические количества не заменяют исходные ведомости.</p>${ids.map(i=>factBtn(i,FACTS.get(i)?.label)).join('<br>')}<div class="buttons-row"><button data-stair-slab>Сверка, отметки и источники ↗</button>${sheetBtn('house_2',20,'Лестница · КЖ-15')}${sheetBtn('house_2',12,'Перекрытие · КЖ-7')}</div>`;return true;
}
document.addEventListener('click',e=>{if(e.target.closest('[data-stair-slab]'))openStairSlab();});

'use strict';
const roofFrameState={family:'all',selected:null,selectedPly:null,counter:false,battens:false,coverHidden:false,showWalls:false,dimensions:false,style:'matte',advanced:false};
const roofCoverLayers=['roof','roofCheeks','roofReturns','atticLining','entryValley'];
const exposedFrameLayers=['rafters','diagonals','purlins','posts','mauerlat','roof-cleats','ties','tie-shims','ridge-plates','beds','window-headers','counter','battens','eave-rails','eave-connectors','dormer-transfer'].map(family=>'frame-'+family);
const roofCoverModes=['house','frame','roof'];
function syncRoofCoverButton(){
 const button=$('roof-cover-toggle');
 button.hidden=!roofCoverModes.includes(mode);
 button.textContent=roofFrameState.coverHidden?'Показать покрытие':'Скрыть покрытие';
 button.setAttribute('aria-label',button.textContent+' крыши');
 button.setAttribute('aria-pressed',String(roofFrameState.coverHidden));
}
function applyRoofCover(g){
 if(!roofCoverModes.includes(mode))return;
 const revealTimber=mode!=='frame';
 if(roofFrameState.coverHidden){
  g.roofCoverVisibility??=new Map([...roofCoverLayers,...(revealTimber?exposedFrameLayers:[])].map(id=>[id,g.layers.get(id)?.visible]));
  for(const id of roofCoverLayers){const layer=g.layers.get(id);if(layer)layer.visible=false;}
  if(revealTimber)for(const id of exposedFrameLayers)g.layers.get(id).visible=true;
 }else if(g.roofCoverVisibility){
  for(const [id,visible] of g.roofCoverVisibility)if(g.layers.has(id))g.layers.get(id).visible=visible??false;
  g.roofCoverVisibility=null;
 }
 syncRoofCoverButton();
 renderLayerControls();
 g.request();
 if(revealTimber&&roofFrameState.coverHidden)return loadSceneRoofFrame(g);
}
const ROOF_FRAME_STYLE={rafters:{label:'Стропила · поз.1',color:[.69,.53,.36]},diagonals:{label:'Диагонали · поз.2–6',color:[.59,.43,.28]},purlins:{label:'Прогоны и опорные бруски',color:[.63,.48,.32]},posts:{label:'Стойки',color:[.64,.61,.43]},mauerlat:{label:'Мауэрлат · схема21',color:[.64,.49,.34]},ties:{label:'Затяжки · сценарий мест',color:[.72,.56,.37]},'tie-shims':{label:'Прокладки затяжек',color:[.45,.51,.55]},beds:{label:'Лежни',color:[.60,.55,.34]},counter:{label:'Контробрешётка · схема',color:[.74,.65,.43]},battens:{label:'Обрешётка · условный шаг300',color:[.72,.72,.53]},'window-headers':{label:'Обрамления окон',color:[.69,.52,.34]}};
const roofRenderStyles={matte:'Матовый',solid:'Материалы',random:'Разноцветный',wire:'Каркасный'};
ROOF_FRAME_STYLE['roof-cleats']={label:'Опорные бруски',color:[.67,.54,.38]};
ROOF_FRAME_STYLE['ridge-plates']={label:'Стальные накладки',color:ROOF_FRAME_STYLE['tie-shims'].color};
ROOF_FRAME_STYLE['eave-rails']={label:'Карнизные балки',color:ROOF_FRAME_STYLE['roof-cleats'].color};
ROOF_FRAME_STYLE['eave-connectors']={label:'Стальной крепёж крыши',color:[.48,.55,.58]};
ROOF_FRAME_STYLE['dormer-transfer']={label:'Стальная рама у северного окна',color:[.39,.50,.56]};
const frameTints=[[.45,.67,.57],[.74,.51,.36],[.47,.64,.78],[.68,.54,.73],[.78,.64,.39],[.52,.70,.73],[.79,.52,.50],[.49,.62,.44],[.64,.64,.79]];
function roofPartTint(id){
 let hash=2166136261;
 for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return frameTints[(hash>>>0)%frameTints.length];
}
function styleRoofLayer(layer,style,selected=false){
 layer.renderColor=selected?null:style==='matte'?[.78,.79,.76]:style==='wire'?[.29,.43,.37]:null;
 layer.showFaces=style!=='wire';
 layer.showEdges=style!=='solid';
 layer.edgeAlpha=style==='matte'?.35:style==='wire'?.9:.45;
 layer.useTint=!selected&&style==='random';
}
function applyRoofRenderStyle(){
 const style=roofFrameState.style;
 for(const family of Object.keys(ROOF_FRAME_STYLE))styleRoofLayer(renderer.layers.get('frame-'+family),style);
 for(const button of document.querySelectorAll('[data-frame-style]'))button.setAttribute('aria-pressed',String(button.dataset.frameStyle===style));
 renderer.request();
}
function roofFrameDisplayMembers(){
 const frame=MODEL.roof_frame;
 if(!frame)return [];
 const transfer=frame.north_dormer_transfer;
 if(!transfer)return frame.members;
 return [...frame.members.filter(m=>!transfer.former_member_ids.includes(m.id)),...transfer.members];
}
const roofFrameMembers=()=>[...roofFrameDisplayMembers(),...(renderer?.frameWindowScenario||[])];
const roofFrameMember=id=>roofFrameMembers().find(m=>m.id===id);
const roofPartKey=(id,ply)=>ply===null?id:`${id}@${ply+1}`;
function roofPartTitle(m){
 if(m.end_batten_seat||m.deck_edge_support)return m.label;
 if(m.diagonal_cleat)return m.label+' · стропило '+m.diagonal_cleat.rafter_id.split('-').at(-1);
 if(m.vk2_edge_support)return (m.family==='rafters'?'Крайнее стропило':'Контрбрусок')+' · проходка ВК‑2';
 if(m.family==='counter')return `Контрбрусок № ${m.id.split('-').at(-1)}`;
 if(m.family==='battens')return `Обрешётка · фрагмент № ${m.id.split('-').at(-1)}`;
 const place={main:'основная крыша',garage:'гараж',bay:'восточный выступ',dormer_n:'северное слуховое окно',dormer_s:'слуховое окно над входом'};
 if(m.facet_id){
  const edge=m.facet_id.lastIndexOf('_');
  return `Стропило № ${m.id.split('-').at(-1)} · ${place[m.facet_id.slice(0,edge)]}, ${m.facet_id.slice(edge+1)}`;
 }
 if(m.family==='ties')return `Затяжка · пара ${+m.id.split('-')[1]+1}, доска ${m.id.includes('--')?1:2}`;
 if(m.family==='window-headers')return `${m.label} · деталь ${+m.id.split(':').at(-1)+1}`;
 if(['diagonals','posts','beds'].includes(m.family)){
  const index=m.id.match(/-(\d+)$/);
  if(index)return `${m.label} · ${index[1]}`;
 }
 return m.label;
}
function selectedRoofPieces(m){const all=framePieces(m);return roofFrameState.selectedPly===null?all:all.slice(roofFrameState.selectedPly,roofFrameState.selectedPly+1);}
const counterBattenLayout=m=>MODEL.roof_frame?.counter_batten_cuts?.rows[m.id];
const framePieceLabel=(m,i)=>(counterBattenLayout(m)?'отрезок ':'брус ')+(i+1);
function frameStockPieces(m){
 const result=[],plies=m.plies||1;
 for(let i=0;i<plies;i++){
  const a=[...m.a_mm],b=[...m.b_mm];
  a[2]+=i*m.height_mm;b[2]+=i*m.height_mm;
  result.push({id:m.id+'-piece'+(i+1),assembly_id:m.id,a_mm:a,b_mm:b,width_mm:m.width_mm,height_mm:m.height_mm,width_axis:m.width_axis||null});
 }
 return result;
}
function framePieces(m){
 const layout=counterBattenLayout(m);
 if(!layout)return frameStockPieces(m);
 const {axis,ranges_mm,fixing_stations_mm}=layout;
 const start=contactDot(axis,m.a_mm);
 const atStation=station=>m.a_mm.map((v,i)=>v+axis[i]*(station-start));
 return ranges_mm.map(([lo,hi],i)=>({id:m.id+'-piece'+(i+1),assembly_id:m.id,a_mm:atStation(lo),b_mm:atStation(hi),
  width_mm:m.width_mm,height_mm:m.height_mm,width_axis:m.width_axis||null,station_range_mm:[lo,hi],
  fixing_offsets_mm:fixing_stations_mm?.[i]?.map(station=>station-lo)}));
}
const frameSolidCache=new Map();
function frameAxes(p){
 const d=p.b_mm.map((v,i)=>v-p.a_mm[i]),len=Math.hypot(...d);if(len<1e-6)return [];
 for(let i=0;i<3;i++)d[i]/=len;let u=p.width_axis|| (Math.abs(d[2])<.95?[-d[1],d[0],0]:[1,0,0]);u=u.map(v=>v/Math.hypot(...u));
 return [d,u,[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]]];
}
function frameBeamFaces(p){
 const axes=frameAxes(p);if(!axes.length)return [];
 const [,u,v]=axes,points=[];
 for(const end of [p.a_mm,p.b_mm])for(const [su,sv]of [[-1,-1],[1,-1],[1,1],[-1,1]])points.push(end.map((q,i)=>q+u[i]*su*p.width_mm/2+v[i]*sv*p.height_mm/2));
 return [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(ids=>ids.map(i=>points[i]));
}
function windowVoidPlanes(s,headerWidth=0){
 const dot=(a,b)=>a.reduce((v,q,i)=>v+q*b[i],0),raw=[-s.cell.plane[0],-s.cell.plane[1],1],normal=raw.map(v=>v/Math.hypot(...raw)),planes=[];
 for(const [axis,half]of [[s.u,s.width/2+17.5],[s.v,s.height/2+17.5+headerWidth]]){planes.push([...axis,half-dot(axis,s.centre)]);planes.push([...axis.map(v=>-v),half+dot(axis,s.centre)]);}
 // Only the roof build-up is opened; beams far below it remain distinct.
 planes.push([...normal,400-dot(normal,s.centre)]);planes.push([...normal.map(v=>-v),50+dot(normal,s.centre)]);
 return planes;
}
function subtractFrameVoid(faces,planes){
 let inside=faces;const outside=[];
 for(const plane of planes){if(!inside.length)break;const part=clipDisplaySolid(inside,plane.map(v=>-v));if(part.length)outside.push(part);inside=clipDisplaySolid(inside,plane);}
 return outside;
}
function subtractFrameOverlap(faces,obstacle){
 const timber=roofContactSolid('','',faces);
 return measureRoofContact(timber,obstacle)?.volume_mm3?subtractFrameVoid(faces,obstacle.sides.map(s=>s.plane)):[faces];
}
// KD-2 draws the short rafters terminating at the diagonals. The condition
// requires an endpoint within the run of the diagonal. On the two adjacent
// slopes the model endpoint can fall anywhere inside the diagonal's width.
function rafterDiagonalEndPlanes(member){
 if(member.family!=='rafters')return [];
 const planes=[];
 for(const diagonal of MODEL.roof_frame.members){
  if(diagonal.family!=='diagonals')continue;
  const adjacent=diagonal.valley_facets||diagonal.hip_facets;
  if(adjacent&&!adjacent.includes(member.facet_id))continue;
  const [x,y]=diagonal.a_mm,dx=diagonal.b_mm[0]-x,dy=diagonal.b_mm[1]-y;
  const length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
  const side=([px,py])=>nx*(px-x)+ny*(py-y);
  const endpointLimit=adjacent?diagonal.width_mm/2:.01;
  for(const [end,other] of [[member.a_mm,member.b_mm],[member.b_mm,member.a_mm]]){
   if(Math.abs(side(end))>endpointLimit||Math.abs(side(other))<diagonal.width_mm/2)continue;
   const station=((end[0]-x)*dx+(end[1]-y)*dy)/length;
   if(station<=0||station>length+1e-6)continue;
   const zn=diagonal.a_mm[2]+(diagonal.b_mm[2]-diagonal.a_mm[2])*station/length;
   if(Math.abs(end[2]-zn)>=(diagonal.height_mm+member.height_mm)/2)continue;
   const sign=Math.sign(side(other));
   const relief=member.diagonal_end_clearance_mm?.[diagonal.id]??0;
   planes.push({diagonalId:diagonal.id,plane:[sign*nx,sign*ny,0,-sign*(nx*x+ny*y)-diagonal.width_mm/2-relief]});
  }
 }
 return planes;
}
function frameBeamWithPlumbEnds(piece,cuts){
 if(!cuts.length)return frameBeamFaces(piece);
 const [along,width,height]=frameAxes(piece);
 const extended={...piece};
 const planes=cuts.map(({end,axis,coordinate_mm})=>{
  const direction=end==='a_mm'?-1:1;
  const extension=(Math.abs(width[axis])*piece.width_mm+Math.abs(height[axis])*piece.height_mm)/(2*Math.abs(along[axis]));
  extended[end]=piece[end].map((value,i)=>value+along[i]*direction*extension);
  return frameCutPlane(axis,coordinate_mm,-Math.sign(along[axis]*direction));
 });
 return planes.reduce((faces,plane)=>clipDisplaySolid(faces,plane),frameBeamFaces(extended));
}
// KD-2 locates these purlins along the straight ridges. KD-3 shows the
// bearing at the ridge. Purlins 8 and 10 are stacked in the model.
const ridgePurlinIds={
 'roof.points.main_ridge_s':'purlin-7',
 'roof.points.garage_ridge_front':'purlin-8',
 'roof.points.dormer_s_ridge_front':'purlin-9',
 'roof.points.bay_ridge_left':'purlin-10',
 'roof.points.dormer_n_ridge_front':'purlin-11',
};
function rafterRidgePurlin(member){
 return member.family==='rafters'&&member.ridge_cut?roofFrameMember(ridgePurlinIds[member.ridge_cut.input_geometry_ids[0]]):null;
}
function rafterPurlinSeatVoids(member,piece){
 const purlin=rafterRidgePurlin(member)||(member.crossing_purlin_id?roofFrameMember(member.crossing_purlin_id):null);
 if(!purlin)return [];
 const axis=member.ridge_cut?.axis??member.grid_axis;
 const centre=purlin.a_mm[axis],station=piece.a_mm[1-axis];
 const [along,,up]=frameAxes(piece);
 const slope=along[2]/along[axis];
 const undersideAt=coordinate=>piece.a_mm[2]+slope*(coordinate-piece.a_mm[axis])-piece.height_mm/(2*up[2]);
 const downhill=slope>0?0:3;
 const voids=[];
 for(const part of framePieces(purlin)){
  const top=part.a_mm[2]+part.height_mm/2;
  if(top>=undersideAt(centre)||station+piece.width_mm/2<=Math.min(part.a_mm[1-axis],part.b_mm[1-axis])||
    station-piece.width_mm/2>=Math.max(part.a_mm[1-axis],part.b_mm[1-axis]))continue;
  for(const fragment of frameDisplaySolids(purlin).filter(f=>f.axis_piece_id===part.id)){
   const solid=roofContactSolid(part.id,purlin.family,fragment.faces);
   const underside=undersideAt(solid.bounds[axis+downhill]);
   if(underside>=top||underside<=top-part.height_mm||top>=underside+piece.height_mm/up[2])continue;
   const cap=solid.sides.find(({plane})=>Math.abs(plane[2]+1)<1e-9&&Math.abs(plane[3]-top)<1e-6);
   if(cap)voids.push({solid,cap});
  }
 }
 return voids;
}
function cutRafterPurlinSeat(faces,{solid,cap}){
 const rafter=roofContactSolid('', 'rafters',faces);
 if(!measureRoofContact(rafter,solid)?.volume_mm3)return [faces];
 const seat=rafter.sides.reduce((face,{plane})=>clipContactFace(face,plane),cap.face);
 if(roofContactArea(seat,[0,0,1])<=roofContactTolerance)return [faces];
 const planes=[cap.plane,...solid.sides.filter(side=>side!==cap).map(side=>side.plane)];
 return subtractFrameVoid(faces,planes);
}
function frameCutPlane(axis,coordinate,side){
 const plane=[0,0,0,-side*coordinate];plane[axis]=side;return plane;
}
function frameDisplaySolids(member,{uncutSeat=false}={}){
 if(member.status==='support_line_diagram_not_wall_top_profile'||member.family==='eave-connectors')return [];
 const key=uncutSeat?member.id+'-uncut-seat':member.id;if(frameSolidCache.has(key))return frameSolidCache.get(key);
 if(member.fitted_envelope_faces_mm){
  // Use the undrilled timber envelope for conservative contact checks.
  const result=member.fitted_envelope_faces_mm.map(faces=>({assembly_id:member.id,axis_piece_id:member.id+'-piece1',
   roof_cell_id:null,faces,status:member.status}));
  frameSolidCache.set(key,result);return result;
 }
 if(member.eave_beam_faces_mm){
  const result=member.eave_beam_faces_mm.map(faces=>({assembly_id:member.id,axis_piece_id:member.id+'-piece1',roof_cell_id:null,faces}));
  frameSolidCache.set(key,result);return result;
 }
 const seat=member.end_batten_seat??member.deck_edge_support;
 if(seat){
  const axisPiece=frameStockPieces(member)[0].id;
  const result=(seat.faces_by_fragment_mm??[seat.faces_mm]).map(faces=>({
   assembly_id:member.id,axis_piece_id:axisPiece,roof_cell_id:seat.roof_cell_id??null,faces,status:member.status
  }));
  frameSolidCache.set(key,result);return result;
 }
 if(member.shim_fit||member.ridge_plate_fit||member.ridge_bearing_shim||member.post_base_plate||member.eave_cleat||member.diagonal_cleat||member.ridge_bearing_cap){
  const [piece]=framePieces(member);
  const beam=frameBeamFaces(piece);
  let faces=beam;
  if(member.eave_cleat)faces=clipDisplaySolid(beam,[0,0,1,-member.eave_cleat.bearing_top_mm]);
  if(member.diagonal_cleat){
   const [a,b,c]=member.diagonal_cleat.top_plane;
   faces=clipDisplaySolid(beam,[a,b,-1,c]);
  }
  if(member.ridge_bearing_cap){
   const {cap_planes_mm:planes,axial_contact:stop}=member.ridge_bearing_cap;
   faces=planes.reduce((body,[a,b,c])=>clipDisplaySolid(body,[a,b,-1,c]),faces);
   if(stop){
    const {y_mm:y,side_sign:side,relief_mm:depth,bounds_xz_mm:[x0,z0,x1,z1]}=stop;
    const core=clipDisplaySolid(faces,frameCutPlane(1,y+side*depth,side));
    const contact=[frameCutPlane(1,y+side*depth,-side),frameCutPlane(0,x0,1),frameCutPlane(0,x1,-1),
     frameCutPlane(2,z0,1),frameCutPlane(2,z1,-1)].reduce((body,plane)=>clipDisplaySolid(body,plane),faces);
    const result=[core,contact].map(body=>({
     assembly_id:member.id,axis_piece_id:piece.id,roof_cell_id:null,faces:body,status:member.status
    }));
    frameSolidCache.set(key,result);return result;
   }
  }
  const result=[{assembly_id:member.id,axis_piece_id:piece.id,roof_cell_id:null,faces,status:member.status}];
  frameSolidCache.set(key,result);return result;
 }
 const result=[];
 const ends=rafterDiagonalEndPlanes(member);
 const secondary=member.family==='battens'||member.family==='counter';
 const ridgeSeat=member.garage_ridge_seat;
 const stockSpan=member.stock_span_mm??ridgeSeat?.stock_span_mm;
 const seats=[...(member.plate_seats||[])];
 if(ridgeSeat)seats.push(ridgeSeat);
 // A full-width eave rafter can meet a valley toe at one corner even
 // when its axis stops short of the valley. Keep its full end elsewhere.
 const valleyToes=member.eave_cut?MODEL.roof_frame.members.filter(m=>m.valley_facets?.includes(member.facet_id)&&!ends.some(end=>end.diagonalId===m.id))
  .flatMap(m=>frameDisplaySolids(m).map(p=>roofContactSolid(p.axis_piece_id,m.family,p.faces))):[];
 if(member.valley_support){
  const valley=roofFrameMember(member.valley_support.diagonal_id);
  valleyToes.push(...frameDisplaySolids(valley).map(p=>roofContactSolid(p.axis_piece_id,valley.family,p.faces)));
 }
 const cells=MODEL.roof_geometry.cells;
 const sourceCell=secondary?cells.find(c=>'roof.cells.'+c.id===member.input_geometry_ids[0]):null;
 for(const axisPiece of frameStockPieces(member)){
  if(member.family==='beds'){
   // The beds lie on the slab. Roof-cell boundaries do not split a sill.
   result.push({assembly_id:member.id,axis_piece_id:axisPiece.id,roof_cell_id:null,
    faces:frameBeamFaces(axisPiece),status:'slab_bearing_bed'});
   continue;
  }
  const purlinSeatVoids=rafterPurlinSeatVoids(member,axisPiece);
  const endCuts=member.purlin_end_cuts||[];
  const plumbEnd=member.ridge_cut||member.valley_foot_cut||endCuts.find(cut=>cut.purlin_id==='purlin-7');
  const plumbEnds=[plumbEnd,member.eave_cut,...endCuts.filter(cut=>cut.plumb)].filter(Boolean);
  let beam=ends.reduce((faces,end)=>clipDisplaySolid(faces,end.plane),frameBeamWithPlumbEnds(axisPiece,plumbEnds));
  for(const cut of endCuts){
   if(!plumbEnds.includes(cut)){
    const opposite=axisPiece[cut.end==='a_mm'?'b_mm':'a_mm'][cut.axis];
    beam=clipDisplaySolid(beam,frameCutPlane(cut.axis,cut.coordinate_mm,Math.sign(opposite-cut.coordinate_mm)));
   }
   beam=clipDisplaySolid(beam,frameCutPlane(cut.split_axis,cut.split_coordinate_mm,cut.split_side));
  }
  if(stockSpan){
   const [along]=frameAxes(axisPiece);
   const a=contactDot(along,axisPiece.a_mm);
   const [start,stop]=stockSpan;
   beam=clipDisplaySolid(beam,[...along,-a-start]);
   beam=clipDisplaySolid(beam,[...along.map(v=>-v),a+stop]);
  }
  if(member.bearing_fit){
   const {bottom_mm,top_mm}=member.bearing_fit;
   beam=clipDisplaySolid(clipDisplaySolid(beam,[0,0,1,-bottom_mm]),[0,0,-1,top_mm]);
  }
  if(member.diagonal_post_head){
   const [a,b,c]=member.diagonal_post_head.plane;
   beam=clipDisplaySolid(beam,[a,b,-1,c]);
  }
  if(member.bearing_block){
   const [a,b,c]=member.bearing_block.top_plane;
   beam=clipDisplaySolid(beam,[a,b,-1,c]);
  }
  if(member.purlin_side_cut){
   const {axis,side,coordinate_mm}=member.purlin_side_cut;
   beam=clipDisplaySolid(beam,frameCutPlane(axis,coordinate_mm,side));
  }
  if(member.vk1_end_cut_mm!==undefined)beam=clipDisplaySolid(beam,[0,1,0,-member.vk1_end_cut_mm]);
  if(member.eave_hanger_end_cut){
   const {axis,station_mm,side,metal_allowance_mm}=member.eave_hanger_end_cut;
   beam=clipDisplaySolid(beam,frameCutPlane(axis,station_mm+side*metal_allowance_mm,side));
  }
  if(member.hip_corner_fit)for(const {plane:[a,b,c]} of MODEL.roof_geometry.source_facets.filter(f=>member.hip_facets.includes(f.id))){
   beam=clipDisplaySolid(beam,[a,b,-1,c-roofPacketDepth()*Math.hypot(a,b,1)]);
  }
  if(!beam.length)continue;
  const points=beam.flat(),lo=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  for(const cell of cells){
   // Keep each layer on its own slope. Two distinct slopes meet at a
   // miter; coplanar cells at the garage transition can still share a run.
   if(sourceCell&&cell.plane.some((v,i)=>Math.abs(v-sourceCell.plane[i])>1e-6))continue;
   if([0,1].some(i=>Math.min(...cell.polygon_mm.map(p=>p[i]))>hi[i]+.001||Math.max(...cell.polygon_mm.map(p=>p[i]))<lo[i]-.001))continue;
   let faces=beam;const foot=cell.polygon_mm,orientation=foot.reduce((s,a,i)=>{const b=foot[(i+1)%foot.length];return s+a[0]*b[1]-b[0]*a[1];},0)>0?1:-1;
   for(let i=0;i<foot.length&&faces.length;i++){const a=foot[i],b=foot[(i+1)%foot.length],dx=b[0]-a[0],dy=b[1]-a[1];faces=clipDisplaySolid(faces,[-dy*orientation,dx*orientation,0,(dy*a[0]-dx*a[1])*orientation]);}
   // KD-3 shows both tie ends following the top of the rafters. Keep the
   // visual bevel out of the counter battens; the stock axis is unchanged.
   const drop=member.family==='ties'||member.valley_packet_fit?roofPacketDepth()*Math.hypot(...cell.plane.slice(0,2),1):roofDeckDrop(cell.plane);
   faces=clipDisplaySolid(faces,[cell.plane[0],cell.plane[1],-1,cell.plane[2]-drop]);if(!faces.length)continue;
   let pieces=[faces];
   for(const {rect_mm:[x0,y0,x1,y1],top_mm:z} of uncutSeat?[]:seats){
    pieces=pieces.flatMap(f=>subtractFrameVoid(f,[[1,0,0,-x0],[-1,0,0,x1],[0,1,0,-y0],[0,-1,0,y1],[0,0,-1,z]]));
   }
   for(const s of roofWindowSpecs()){
    if(!['rafters','counter','battens'].includes(member.family))continue;
    const pp=pieces.flat(2);if(!pp.length)break;
    if([0,1,2].some(i=>Math.max(...pp.map(p=>p[i]))<s.b[i]-400||Math.min(...pp.map(p=>p[i]))>s.b[i+3]+400))continue;
    if(member.family==='rafters'&&s.location.room_id!=='19')continue;
    const headerWidth=member.family==='rafters'?n('timber.1.width'):0;
    pieces=pieces.flatMap(f=>subtractFrameVoid(f,windowVoidPlanes(s,headerWidth)));
   }
   for(const seat of purlinSeatVoids)pieces=pieces.flatMap(f=>cutRafterPurlinSeat(f,seat));
   for(const toe of valleyToes)pieces=pieces.flatMap(f=>subtractFrameOverlap(f,toe));
   // Non-structural boards stop at the shaft clearance. The primary
   // rows are laid out in the frame model to avoid cutting their section.
   if(secondary){
    for(const shaft of MODEL.floor1.brick_envelopes){
     const [,,z0,,,z1]=ventBodyBounds(shaft);
     const [x0,y0,x1,y1]=MODEL.roof_frame.shaft_clearances[shaft.id].keepout_bounds_mm;
     if(x0>=hi[0]||x1<=lo[0]||y0>=hi[1]||y1<=lo[1])continue;
     const voidPlanes=[[1,0,0,-x0],[-1,0,0,x1],[0,1,0,-y0],[0,-1,0,y1],[0,0,1,-z0],[0,0,-1,z1]];
     pieces=pieces.flatMap(f=>subtractFrameVoid(f,voidPlanes));
    }
    // At intersecting slopes a layer can reach the masonry head of the
    // adjacent roof. Stop against the same envelope used for the wall.
    for(const wall of masonryRoofHeadSolids()){
     if([0,1].some(i=>wall.bounds[i]>=hi[i]||wall.bounds[i+3]<=lo[i]))continue;
     pieces=pieces.flatMap(f=>subtractFrameOverlap(f,wall));
    }
   }
   for(const faces of pieces)result.push({assembly_id:member.id,axis_piece_id:axisPiece.id,roof_cell_id:cell.id,faces,status:'display_clipped_to_roof_and_window_voids_not_stock_cut'});
  }
 }
 const layout=counterBattenLayout(member);
 if(!layout){frameSolidCache.set(key,result);return result;}
 // Preserve the fitted stock ends, openings and bearing faces. Add only
 // the transverse cuts at the measured stations along the original row.
 const {axis}=layout,reverse=axis.map(v=>-v),parts=framePieces(member);
 const cut=result.flatMap(fragment=>{
  const values=fragment.faces.flat().map(p=>contactDot(axis,p));
  const start=Math.min(...values),end=Math.max(...values);
  return parts.flatMap(p=>{
   const [lo,hi]=p.station_range_mm;
   if(end<=lo+1e-7||start>=hi-1e-7)return [];
   let faces=fragment.faces;
   if(start<lo-1e-7)faces=clipDisplaySolid(faces,[...axis,-lo]);
   if(end>hi+1e-7)faces=clipDisplaySolid(faces,[...reverse,hi]);
  if(!faces.length)return [];
  const fit=layout.garage_fit;
  if(p.id!==fit?.piece_id)return [{...fragment,axis_piece_id:p.id,faces}];
  const [, ,up]=frameAxes(p),down=up.map(v=>-v);
  const underside=contactDot(up,p.a_mm)-p.height_mm/2;
  const reliefStart=fit.station_mm-fit.span_mm/2,reliefEnd=fit.station_mm+fit.span_mm/2;
  const slope=fit.relief_depth_mm/fit.ramp_mm;
  const rise=axis.map((v,i)=>down[i]+slope*v),fall=axis.map((v,i)=>down[i]-slope*v);
  const voidPlanes=[[...axis,-reliefStart],[...reverse,reliefEnd],[...down,underside+fit.relief_depth_mm],
   [...rise,underside-slope*reliefStart],[...fall,underside+slope*reliefEnd]];
  return subtractFrameVoid(faces,voidPlanes).map(faces=>({...fragment,axis_piece_id:p.id,faces}));
  });
 });
 frameSolidCache.set(key,cut);return cut;
}
function roofFrameWallRegions(){
 const outline=roofWallOutline(),xs=[...new Set(outline.map(([x])=>x))].sort((a,b)=>a-b),regions=[];
 for(let i=1;i<xs.length;i++){
  const x0=xs[i-1],x1=xs[i],ys=scanSegments(outline,0,(x0+x1)/2);
  for(let j=0;j<ys.length;j+=2){
   const y0=ys[j],y1=ys[j+1];regions.push([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
  }
 }
 return regions;
}
function cadMeshFaces({vertices_mm:points,triangles}){
 return triangles.map(triangle=>triangle.map(i=>points[i]));
}
function emitCadMesh(g,layer,mesh,id){
 for(const face of cadMeshFaces(mesh))g.face(layer,face,null,id);
 for(const edge of mesh.outlines_mm)g.polyline(layer,edge);
}
const interiorCadFaces=new WeakMap();
function frameInteriorCadFaces(mesh,wallRegions){
 if(interiorCadFaces.has(mesh))return interiorCadFaces.get(mesh);
 const bounds=points=>[0,1].map(i=>Math.min(...points.map(p=>p[i]))).concat([0,1].map(i=>Math.max(...points.map(p=>p[i]))));
 const meshBounds=bounds(mesh.vertices_mm);
 const meets=(a,b)=>[0,1].every(i=>a[i]<=b[i+2]&&b[i]<=a[i+2]);
 const footprints=polygons=>polygons.filter(polygon=>meets(bounds(polygon),meshBounds)).map(polygon=>{
  const winding=Math.sign(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0));
  return polygon.map(([x,y],i)=>{
   const [qx,qy]=polygon[(i+1)%polygon.length],dx=qx-x,dy=qy-y,len=Math.hypot(dx,dy);
   return len>1e-6?[-dy,dx,0,dy*x-dx*y].map(v=>v*winding/len):null;
  }).filter(Boolean);
 });
 const wallPlanes=footprints(wallRegions);
 const roofPlanes=MODEL.roof_geometry.eave_junctions.wall_caps.flatMap(cap=>{
  const [a,b,c]=cap.plane;
  return footprints([cap.polygon_mm]).map(planes=>[...planes,[a,b,-1,c-roofDeckDrop(cap.plane)]]);
 });
 // Clip only the visible mesh surfaces. A cap across the cut could fill a
 // bolt hole or the gap between the fitted steel and the timber.
 const clip=(face,sets)=>sets.map(planes=>planes.reduce(clipContactFace,face)).filter(f=>f.length>=3);
 const faces=cadMeshFaces(mesh).flatMap(face=>clip(face,wallPlanes)).flatMap(face=>clip(face,roofPlanes));
 interiorCadFaces.set(mesh,faces);
 return faces;
}
function frameDisplayFaces(member,wallRegions,partId=null){
 if(member.cad_mesh)return wallRegions?frameInteriorCadFaces(member.cad_mesh,wallRegions):cadMeshFaces(member.cad_mesh);
 const solids=frameDisplaySolids(member).filter(p=>!partId||p.axis_piece_id===partId);
 if(!wallRegions)return solids.flatMap(({faces})=>faces);
 const junction=MODEL.roof_geometry.eave_junctions;
 return solids.flatMap(({faces,roof_cell_id})=>{
  const pieces=wallRegions.map(region=>clipSolidToFootprint(faces,region)).filter(p=>p.length);
  if(!junction.under_eaves.some(e=>e.upper_cell_id===roof_cell_id))return pieces.flat();
  const caps=junction.wall_caps.filter(c=>c.upper_cell_id===roof_cell_id);
  return pieces.flatMap(piece=>caps.flatMap(cap=>{
   const [a,b,c]=cap.plane;
   return clipDisplaySolid(clipSolidToFootprint(piece,cap.polygon_mm),[a,b,-1,c-roofDeckDrop(cap.plane)]);
  }));
 });
}
function emitPerforatedBasePlate(g,layer,member,id){
 const spec=MODEL.roof_frame.stair_base_plate;
 const [x0,y,z]=member.a_mm,[x1]=member.b_mm,x=(x0+x1)/2;
 const half=(x1-x0)/2,radius=spec.hole_diameter_mm/2;
 const halfPitch=(spec.hole_rows_xz_mm[1][0]-spec.hole_rows_xz_mm[0][0])/2;
 const left=y-member.width_mm/2,right=y+member.width_mm/2;
 const at=(p,side)=>[p[0]+x,side,p[1]+z];
 for(const [height,columns] of spec.hole_rows_xz_mm){
  columns.forEach((column,i)=>{
   const a=i?(columns[i-1]+column)/2:-half,b=i+1<columns.length?(column+columns[i+1])/2:half;
   const cell=roofContactRect([a,height-halfPitch,b,height+halfPitch]);
   const hole=Array.from({length:12},(_,j)=>[column+radius*Math.cos(j*Math.PI/6),height+radius*Math.sin(j*Math.PI/6)]);
   for(const patch of HouseShapes.subtract(cell,hole)){
    g.face(layer,patch.map(p=>at(p,left)),[0,-1,0],id);
    g.face(layer,patch.map(p=>at(p,right)).reverse(),[0,1,0],id);
   }
   for(let j=0;j<hole.length;j++){
    const p=hole[j],q=hole[(j+1)%hole.length];
    g.face(layer,[at(q,left),at(p,left),at(p,right),at(q,right)],null,id);
   }
   g.polyline(layer,hole.map(p=>at(p,left)),true);
   g.polyline(layer,hole.map(p=>at(p,right)),true);
  });
 }
 for(const face of frameDisplayFaces(member,null))if(!face.every(p=>p[1]===face[0][1])){
  g.face(layer,face,null,id);g.polyline(layer,face,true);
 }
}
function emitFrameMember(g,l,m,wallRegions,ply=null){
 const pieces=framePieces(m);
 if(pieces.length>1&&ply===null){pieces.forEach((_,i)=>emitFrameMember(g,l,m,wallRegions,i));return;}
 const id=m.family==='window-headers'?m.id:'frame-member:'+roofPartKey(m.id,ply);
 const partId=ply===null?null:pieces[ply].id;
 const start=l.vertices.length;
 if(m.cad_mesh&&!wallRegions)emitCadMesh(g,l,m.cad_mesh,id);
 else if(m.post_base_plate)emitPerforatedBasePlate(g,l,m,id);
 else for(const face of frameDisplayFaces(m,wallRegions,partId)){g.face(l,face,null,id);g.polyline(l,face,true);}
 if(mode==='frame'&&l.id!=='frame-selected'){
  l.faceTints??=[];
  const tint=roofPartTint(id);
  for(let i=start;i<l.vertices.length;i+=6)l.faceTints.push(...tint);
 }
}
function drawWindowFrameScenario(g,visible,wallRegions){
 const layer=g.layers.get('frame-window-headers')||g.addLayer('frame-window-headers',[.69,.52,.34],{visible,showEdges:mode!=='house',order:17,explodeOrder:4});LAYER_META['frame-window-headers']=['Обрамления окон · условный вариант',layer.color];g.frameWindowScenario=[];
 if(!MODEL.roof_frame)return;
 for(const s of roofWindowSpecs()){
  const raw=[-s.cell.plane[0],-s.cell.plane[1],1],normal=raw.map(v=>v/Math.hypot(...raw)),halfW=s.width/2+17.5,halfH=s.height/2+17.5,stock=n('timber.1.width'),height=n('timber.1.height');
  const point=(u,v)=>s.centre.map((q,i)=>q+s.u[i]*u+s.v[i]*v-normal[i]*(MODEL.roof_frame.known_packet_above_rafter_mm+height/2));
  // The headers bear against the existing full-length rafters on both sides.
  const offsets=MODEL.roof_frame.members.filter(m=>m.family==='rafters'&&m.facet_id===s.cell.facet_id&&
   [s.point(0,-halfH),s.point(0,halfH)].every(p=>p[0]>=Math.min(m.a_mm[0],m.b_mm[0])&&p[0]<=Math.max(m.a_mm[0],m.b_mm[0])))
   .map(m=>(m.grid_coordinate_mm-s.centre[1])*s.u[1]);
  const left=Math.max(...offsets.filter(u=>u<-halfW))+stock/2,right=Math.min(...offsets.filter(u=>u>halfW))-stock/2;
  const add=(a,b,widthAxis)=>{
   const id='frame-window:'+s.id+':'+g.frameWindowScenario.length;
   const member={id,family:'window-headers',label:'Обрамление окна · помещение '+s.location.room_id,a_mm:a,b_mm:b,width_mm:stock,height_mm:height,width_axis:widthAxis,
    axis_length_mm:Math.hypot(...contactSub(b,a)),window_id:s.id,status:'conditional_window_framing_not_engineered_header',
    note:'Обрамление 50×200 мм — вариант отображения. Несущая способность, крепёж и размеры рабочих перемычек требуют согласования.',
    input_fact_ids:['timber.1.width','timber.1.height','window.ОК-11.block_width'],input_geometry_ids:[]};
   emitFrameMember(g,layer,member,wallRegions);
   g.frameWindowScenario.push(member);
  };
  for(const side of [-1,1]){
   const v=side*(halfH+stock/2);
   add(point(left,v),point(right,v),s.v);
   if(s.location.room_id==='19'){
    const u=side*(halfW+stock/2);
    // The west plan puts a full rafter exactly on one edge of this opening.
    // Keep that rafter as the side of the frame without duplicating its wood.
    if(!offsets.some(offset=>Math.abs(offset-u)<.001))add(point(u,-halfH),point(u,halfH),s.u);
   }
  }
 }
}
function frameFamilyWanted(family){if(roofFrameState.family!=='all')return roofFrameState.family===family;if(family==='counter')return roofFrameState.counter;if(family==='battens')return roofFrameState.battens;return true;}
const frameContextLayers=['walls2','upperFrame','slab2','roofBelt','vents','ventCaps'];
function showFrameContext(show){
 roofFrameState.showWalls=show;
 for(const id of frameContextLayers){const l=renderer.layers.get(id);l.visible=show;l.opacity=id==='roofBelt'?1:id==='slab2'?.34:.24;}
 renderLayerControls();renderer.request();
 const toggle=$('frame-context');if(toggle)toggle.checked=show;
}
function focusFramePoint(point,span,{yaw=-.66,pitch=.82}={}){
 const g=renderer;
 if(g.walk){g.walk=null;g.resetInput();renderExperienceTools();}
 g.target=[...point];g.span=span*g.fitAspect();g.pan=[0,0];g.pitch=pitch;g.yaw=yaw;g.request();
 $('viewport').scrollIntoView({block:'nearest'});
}
function framePieceExtents(m,p,wallRegions=null){
 if(m.family==='eave-connectors')return [[0,m.axis_length_mm],[-m.width_mm/2,m.width_mm/2],[-m.height_mm/2,m.height_mm/2]];
 const axes=frameAxes(p),points=frameDisplayFaces(m,wallRegions,p.id).flat();
 if(!points.length)return null;
 return axes.map(axis=>{
  const q=points.map(v=>contactDot(contactSub(v,p.a_mm),axis));
  return [Math.min(...q),Math.max(...q)];
 });
}
function framePiecePreview(m,p,extents){
 const faces=frameDisplayFaces(m,mode==='house'?roofFrameWallRegions():null,p.id);
 const letters=m.post_base_plate?['Ш','Т','В']:m.bearing_block?['В','Ш','Г']:['Д','Ш','В'];
 drawRoofPiecePreview($('frame-piece-preview'),faces,frameAxes(p),p.a_mm,extents,letters,m.cad_mesh?.outlines_mm);
}
function drawRoofPiecePreview(canvas,faces,axes,origin,extents,letters=['Д','Ш','В'],outlines=null){
 const ctx=canvas?.getContext('2d');if(!ctx)return;
 const local=q=>axes.map(axis=>contactDot(contactSub(q,origin),axis));
 const geometry=faces.map(face=>face.map(local)),edges=outlines?.map(edge=>edge.map(local));
 const [[x0,x1],[y0,y1],[z0,z1]]=extents;
 const measures=letters?[
  [[x0,y0,z1],[x1,y0,z1],[0,-25]],
  [[x1,y0,z0],[x1,y1,z0],[12,25]],
  [[x1,y0,z0],[x1,y0,z1],[31,0]],
 ]:[];
 let yaw=.55,tilt=.48,drag;
 canvas.tabIndex=0;
 canvas.setAttribute('aria-label','3D-вид детали. Тяните или нажимайте стрелки для поворота');
 canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY};
  canvas.setPointerCapture(event.pointerId);
 });
 canvas.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  rotate((event.clientX-drag.x)*.012,(event.clientY-drag.y)*.012);
  drag.x=event.clientX;drag.y=event.clientY;
 });
 canvas.addEventListener('lostpointercapture',()=>{drag=null;});
 canvas.addEventListener('keydown',event=>{
  const delta={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]}[event.key];
  if(delta){event.preventDefault();rotate(...delta);}
 });
 function rotate(x,y){yaw+=x;tilt=Math.max(-1.45,Math.min(1.45,tilt+y));paint();}
 function paint(){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
 const project=([x,y,z])=>[cy*x-sy*y,st*(sy*x+cy*y)-ct*z];
 const front=[sy*ct,cy*ct,st];
 const projected=geometry.flatMap(face=>face.map(project));
 if(!projected.length)return;
 for(const [a,b] of measures)projected.push(project(a),project(b));
 const bounds=[0,1].map(i=>[Math.min(...projected.map(q=>q[i])),Math.max(...projected.map(q=>q[i]))]);
 const scale=Math.min(...bounds.map(([lo,hi],i)=>(i?canvas.height-108:canvas.width-112)/Math.max(1,hi-lo)));
 const plot=q=>project(q).map((v,i)=>(v-(bounds[i][0]+bounds[i][1])/2)*scale+(i?canvas.height:canvas.width)/2);
 function depth(face){return face.reduce((v,q)=>v+contactDot(q,front),0)/face.length;}
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.lineJoin='round';
 for(const face of geometry.sort((a,b)=>depth(a)-depth(b))){
  const points=face.map(plot);ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  const a=contactSub(face[1],face[0]),b=contactSub(face.at(-1),face[0]),normal=contactCross(a,b);
  const shade=Math.abs(contactDot(normal,[.20,.55,.81]))/(Math.hypot(...normal)||1);
  ctx.fillStyle=`hsl(36 17% ${58+25*shade}%)`;ctx.fill();
  if(!outlines){ctx.strokeStyle='#615e52';ctx.lineWidth=.9;ctx.stroke();}
 }
 if(edges){
  ctx.strokeStyle='#615e52';ctx.lineWidth=.6;
  for(const edge of edges){
   ctx.beginPath();
   edge.map(plot).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
   ctx.stroke();
  }
 }
 ctx.strokeStyle='#a55230';ctx.fillStyle='#884c32';ctx.lineWidth=1.5;ctx.font='600 16px system-ui';
 function measure(a,b,[dx,dy],label){
  const from=plot(a),to=plot(b),p=[from[0]+dx,from[1]+dy],q=[to[0]+dx,to[1]+dy];
  ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...p);ctx.lineTo(...q);ctx.lineTo(...to);ctx.stroke();
  ctx.fillText(label,(p[0]+q[0])/2+5,(p[1]+q[1])/2-5);
 }
 measures.forEach(([a,b,offset],i)=>measure(a,b,offset,letters[i]));
 }
 paint();
}
function drawFrameSelection(g,layer,m){
 const wallRegions=mode==='house'?roofFrameWallRegions():null;
 emitFrameMember(g,layer,m,wallRegions,roofFrameState.selectedPly);
 g.labels=g.labels.filter(l=>l.kind!=='frame-size');
 // Measures are associated with one piece. An assembly has a different
 // section depending on how its plies are placed.
 const pieces=selectedRoofPieces(m);
 if(pieces.length!==1||mode!=='frame')return;
 const [p]=pieces,extents=framePieceExtents(m,p);
 if(!extents){g.line(layer,p.a_mm,p.b_mm);return;}
 if(!roofFrameState.dimensions)return;
 const [d,u,v]=frameAxes(p),[[lo,hi],[wl,wh],[hl,hh]]=extents;
 const side=wh+120,top=hh+90;
 const point=(length,width,height)=>p.a_mm.map((q,i)=>q+d[i]*length+u[i]*width+v[i]*height);
 g.line(layer,point(lo,side,top),point(hi,side,top));
 for(const t of [lo,hi])g.line(layer,point(t,wh,hh),point(t,side+40,top));
 g.labels.push({text:`${fmt(hi-lo,1)} мм вдоль детали · ${m.width_mm} × ${m.height_mm} мм`,p:point((lo+hi)/2,side,top),layer:layer.id,kind:'frame-size'});
}
const roofFrameZones={
 garage:{label:'Гараж и затяжки',point:[3265,2250,5150],span:8200},
 eave:{label:'Мауэрлат гаража',point:[125,890,3890],span:2700},
 southeast:{label:'Юго-восточный карниз',point:[12540,2780,4240],span:2700},
 southHipFoot:{label:'Диагональ № 3 · нижняя опора',get point(){return MODEL.roof_frame.south_hip_connection.view_target_mm;},
  span:1360,context:true,yaw:-2.,pitch:1.16},
 ridge:{label:'Главный конёк',point:[6665,9355,8800],span:5100},
 valley:{label:'Ендова над входом',point:[6400,4800,5300],span:6700},
 shafts:{label:'Шахты ВК-2 и ВК-3',point:[3150,7880,6870],span:6100},
 bed:{label:'Стойка и лежень',point:[6665,10025,3300],span:2700},
};
function focusFrameZone(zone){
 if(zone.context)showFrameContext(true);
 focusFramePoint(zone.point,zone.span,zone);
}
function roofCornerSupport(member){
 const ids=member.corner_plate_ids;
 if(!ids)return null;
 const plates=ids.map(roofFrameMember);
 const belt=MODEL.floor2.roof_belt;
 const run=belt.runs.find(r=>r.id===plates[0].support_id);
 const strip=belt.insulation.find(r=>r.run_id===run.id);
 const top=plates[0].datum_mm+plates[0].height_mm;
 const [, , up]=frameAxes(framePieces(member)[0]);
 const solids=frameDisplaySolids(member,{uncutSeat:true});
 const seatFaces=frameDisplaySolids(member).flatMap(({faces})=>
  roofContactSolid(member.id,member.family,faces).sides.filter(({plane})=>
   Math.abs(plane[2]-1)<1e-9&&Math.abs(plane[3]+top)<1e-5));
 const depth=(faces)=>faces.length?Math.max(0,...faces.flat().map(p=>(top-p[2])*up[2])):0;
 const platesDepth=plates.map(plate=>{
  const supports=frameDisplaySolids(plate).map(({faces})=>roofContactSolid(plate.id,plate.family,faces));
  const intersects=supports.flatMap(solid=>solids.flatMap(part=>
   solid.sides.reduce((shape,{plane})=>clipDisplaySolid(shape,plane),part.faces)));
  const bearingArea=supports.reduce((area,solid)=>area+seatFaces.reduce((sum,{face})=>
   sum+roofContactArea(solid.sides.reduce((polygon,{plane})=>clipContactFace(polygon,plane),face),[0,0,1]),0),0);
  return {id:plate.id,normal_cut_mm:depth(intersects),horizontal_bearing_mm2:bearingArea};
 });
 const stripBounds=run.bounds_mm.map((v,i)=>i<2?Math.min(v,strip.bounds_mm[i]):Math.max(v,strip.bounds_mm[i]));
 const stripDepth=depth(solids.flatMap(({faces})=>clipSolidToFootprint(faces,roofContactRect(stripBounds))));
 return {id:member.id,belt_id:run.id,bearing_top_mm:top,plates:platesDepth,full_strip_normal_cut_mm:stripDepth};
}

function roofContactInspector(member){
 if(member.hold_down_fit){
  const holes=member.screw_holes;
  const anchors=MODEL.roof_frame.south_hip_connection.anchor_screen;
  const anchorCheck=anchors&&['hip-3-hold-down','hip-3-hold-down-shoe','hip-3-hold-down-anchor','hip-3-hold-down-anchor-2'].includes(member.id)
   ?`<p data-south-hip-anchors>Два анкера М12 с шагом ${fmt(anchors.axis_spacing_mm)} мм. В расчётной пробе до ${fmt(anchors.maximum_tension_kn,2)} кН растяжения и до ${fmt(anchors.maximum_local_shear_kn,3)} кН сдвига от местного кручения на анкер.</p>`:'';
  return `<p>${holes?`В боковой полке ${holes.count} отверстий Ø${fmt(holes.diameter_mm)} мм под винты CSA 5 × 60. `:''}Проверочная сборка на Мп 2. Для монтажа остаются расчёт рабочих нагрузок и сверка арматуры.</p>${anchorCheck}`;
 }
 if(member.family==='eave-connectors')return '<p>Посадка и зазоры сверены в сборке FreeCAD. Размеры карточки даны по габаритам детали в сцене.</p>';
 const ids=new Set(selectedRoofPieces(member).map(p=>p.id));
 const report=scanRoofContacts();
 const matches=report.pairs.filter(row=>row.ids.some(id=>ids.has(id)));
 const cuts=report.seat_cuts.filter(row=>ids.has(row.beam_id));
 const hipPath=report.nw_diagonal_load_path;
 const hipLeg=report.north_hip_batten_screen?.rows.find(row=>row.member_id===member.id);
 const hipUplift=hipLeg?.reactions?.find(seat=>['diagonal-1','diagonal-2'].includes(seat.load_to_id)&&seat.snow_kn+seat.known_gravity_kn<0);
 const hipPathText=hipPath?.member_id===member.id?`<p class="tiny" data-nw-diagonal-path>У прогона 7 контакт ${fmt(hipPath.ridge.face_area_mm2,1)} мм².
  ${hipPath.ridge.upward_projected_area_mm2<.01?'Горизонтальная площадка отсутствует.':
   'Проекция опорных граней на план '+fmt(hipPath.ridge.upward_projected_area_mm2,1)+' мм².'}
  Под диагональю есть опирание на мауэрлат 10 и стойку 18.
  <button data-frame-point="${[...(hipPath.ridge.face_centre_xy_mm??member.b_mm.slice(0,2)),roofFrameMember('purlin-7').b_mm[2]].join(',')}">К торцу прогона в 3D</button></p>`:'';
 const hipLegText=hipUplift?`<p class="tiny" data-hip-rafter-load>Справочный снег и учтённый вес дают отрыв в стыке с диагональю
  ${fmt(-hipUplift.snow_kn-hipUplift.known_gravity_kn,1)} кН при расстоянии ${fmt(hipLeg.support_span_mm,1)} мм между опорами в плане.
  Для выбора крепежа нужно проверить рабочую схему опирания.</p>`:
  hipLeg?.status==='requires_other_support_scheme'&&hipLeg.supports.length===1?`<p class="tiny" data-hip-rafter-load>В сцене найден один опорный стык. Для расчёта стропила нужно уточнить вторую опору.</p>`:'';
 const cleatFits=report.hip_cleat_fits.filter(row=>row.rafter_id===member.id||row.diagonal_id===member.id);
 const ridge=report.ridge_plate_screen;
 const ridgeRow=ridge.rows.find(row=>row.member_ids.includes(member.id));
 const ridgeBlocked=ridgeRow?.blocked_example;
 const ridgePlace=ridgeRow?.plate_fit||ridgeBlocked;
 const obstructionId=ridgeBlocked?.overlaps[0].id;
 const obstruction=MODEL.floor2.walls.find(w=>w.id===obstructionId)?.label??obstructionId;
 const gable=report.north_gable_ridge;
 const recess=gable&&[...gable.rafter_ids,...gable.plate_ids].includes(member.id)
  ?`<p class="tiny" data-gable-ridge-recess>Для наружной накладки в сцене показан карман ${fmt(gable.recess_bounds_mm[3]-gable.recess_bounds_mm[0])} × ${fmt(gable.recess_bounds_mm[5]-gable.recess_bounds_mm[2])} мм глубиной ${fmt(gable.recess_depth_mm)} мм. Крепёж и порядок закрытия фронтона требуют проверки.</p>`:'';
 const ridgeCheck=ridgeRow?`<p class="tiny" data-ridge-plate-screen>${ridgeRow.member_ids.length===1?'На этой оси у конька одна стропильная нога. Для неё требуется отдельный узел к прогону.':
  ridgeRow.side_face_offset_mm?`У стропил на этой оси боковые грани смещены на ${fmt(ridgeRow.side_face_offset_mm)} мм с каждой стороны.
  Плоским накладкам не хватает прилегания. Узел крепления требует расчёта. <button data-frame-point="${ridgeRow.point_mm.join(',')}">К месту в 3D</button>`:
  `Две накладки ${fmt(ridge.height_mm)} × ${fmt(ridge.length_mm)} мм. ${ridgeRow.plate_fit?'В пробной посадке каждая полностью прилегает к обеим доскам.':ridgeBlocked?`В примерке мешает ${esc(obstruction)}.`:'В проверенном положении полная посадка не подтверждена.'}
  ${ridgePlace?`<button data-frame-point="${ridgePlace.point_mm.join(',')}">К месту в 3D</button>`:''}
  При забивке поперёк доски гвоздь ${fmt(ridge.nail_length_mm)} мм выступил бы за неё на ${fmt(ridgeRow.nail_beyond_board_mm)} мм с учётом примерочной накладки ${fmt(ridge.display_thickness_mm)} мм. Схема крепежа требует уточнения.`}</p>`:'';
 const anchorScreen=report.plate_anchor_screen;
 const plate=anchorScreen.rows.find(row=>row.member_id===member.id);
 const post=report.post_bearings.find(row=>row.post_id===member.id);
 const postBearing=post?`<p class="tiny" data-post-bearing>${[['Верхняя опора',post.upper],['Нижняя опора',post.lower]].map(([title,seat])=>{
  const offset=Math.hypot(...(seat.centre_offset_xy_mm??[]));
  return `${title} · ${fmt(seat.projected_area_mm2,1)} мм² в плане (${fmt(seat.section_fraction*100,1)}% сечения)${offset>.01?`, центр площадки смещён на ${fmt(offset,2)} мм`:''}`;
 }).join('<br>')}</p>`:'';
 const lintel=member.lintel_screen;
 const lintelCheck=lintel?`<p class="tiny" data-ridge-post-lintel>Под стойкой находится ПР‑2. От низа плиты Пм 1 до верха перемычки ${fmt(lintel.wall_above_lintel_mm)} мм.
  Если 1 кН по оси стойки целиком приходит на перемычку, реакции южной и северной опор составляют ${fmt(lintel.cases[1].south_reaction_kn,3)} и ${fmt(lintel.cases[1].north_reaction_kn,3)} кН.
  Распределение через плиту, кручение и анкеровка арматуры требуют расчёта. ${sheetBtn('house_2',16,'КЖ‑11 · ПР‑2')}</p>`:'';
 const loadChain=report.ridge_support_chain;
 const mainRidge=loadChain.main;
 const lowerRidge=loadChain.lower;
 const span=report.vk2_span_screen.rows.find(row=>row.member_id===member.id);
 const battenSnow=report.vk2_batten_loads?.rows.find(row=>row.member_id===member.id);
 const gravity=battenSnow?.gravity_response?.results.find(c=>c.id==='factored_gravity_and_reference_snow');
 const gravityCheck=gravity?`<p class="tiny" data-vk2-gravity>Вес наружных слоёв и древесины вместе со справочным снегом ·
  мауэрлат ${fmt(gravity.mauerlat_kn,2)} кН, прогон 7 — ${fmt(gravity.ridge_kn,2)} кН.
  Давление на мауэрлат ${fmt(gravity.mauerlat_average_pressure_mpa,2)} МПа.
  Утепление кровли, подшивка и ветер требуют отдельного учёта.</p>`:'';
 const driftCheck=report.vk2_batten_loads?.vk2_snow_drift?.rows.find(row=>row.member_id===member.id)?.max_mauerlat;
 const driftText=driftCheck?`<p class="tiny" data-vk2-snow-drift>Снеговой мешок у ВК‑2 и учтённый собственный вес.
  Максимум на мауэрлате ${fmt(driftCheck.mauerlat_kn,2)} кН и ${fmt(driftCheck.mauerlat_average_pressure_mpa,2)} МПа.
  Для этого случая нужно ${fmt(driftCheck.required_bearing_length_mm,1)} мм опирания, в модели ${fmt(span.mauerlat_contact_mm2/member.width_mm,1)} мм.</p>`:'';
 const snowReactions=battenSnow?.results?.find(row=>row.id==='factored');
 const snowUplift=battenSnow?.loads.filter(load=>load.equivalent_roof_area_m2<0).length;
 const snowBearing=battenSnow?.mauerlat_bearing_screen;
 const fullSpan=span?.cases.find(c=>c.id==='full');
 const eaveSpan=span?.cases.find(c=>c.id==='eave');
 const spanCheck=span?`<p class="tiny" data-vk2-span-screen>Свес от центра опоры в плане ${fmt(span.eave_overhang_plan_mm,1)} мм.
  При пробной вертикальной нагрузке 1 кН/м по горизонтальной проекции всего стропила реакция на мауэрлате ${fmt(fullSpan.mauerlat_reaction_kn,2)} кН,
  на прогоне 7 ${fmt(fullSpan.ridge_reaction_kn,2)} кН. При нагрузке только на свес реакция прогона ${fmt(eaveSpan.ridge_reaction_kn,2)} кН.
  В этом случае требуется удержание от отрыва. Рабочие нагрузки и крепёж требуют расчёта.</p>
  ${snowReactions?`<p class="tiny" data-vk2-batten-loads>Через обрешётку в справочной снеговой схеме ${fmt(snowReactions.reference_pressure_kn_m2,3)} кН/м²
  мауэрлат получает ${fmt(snowReactions.mauerlat_kn,2)} кН, прогон 7 — ${fmt(snowReactions.ridge_kn,2)} кН.
  ${snowUplift?`Отрыв в местах крепления обрешётки · ${snowUplift}.`:''}
  ${snowBearing?.average_pressure_mpa>snowBearing?.reference_resistance_mpa?
   `Для одного снега при принятых свойствах древесины требуется ${fmt(snowBearing.required_full_width_length_mm,1)} мм опирания на мауэрлат. В модели ${fmt(snowBearing.full_width_contact_length_mm,1)} мм.`:''}</p>`:''}`:'';
 const lvlCheck=member.lvl_trial&&snowBearing?`<p class="tiny" data-lvl-rafter-trial>Примерка цельного ЛВЛ-бруса ${esc(member.lvl_trial.product)}.
  Площадка на мауэрлате ${fmt(snowBearing.horizontal_contact_mm2,1)} мм², давление от справочного снега ${fmt(snowBearing.average_pressure_mpa,2)} МПа при ориентире ${fmt(snowBearing.reference_resistance_mpa,2)} МПа.
  Высота древесины у запила ${fmt(span.mauerlat_notch.remaining_height_mm,1)} мм. Номинальное напряжение изгиба от этой нагрузки ${fmt(snowReactions.notch_nominal_bending_mpa,2)} МПа.</p>`:'';
 const ridgeReactions=member.id==='purlin-7'&&mainRidge
  ?`<p class="tiny" data-ridge-reactions>Между центрами площадок ${fmt(mainRidge.span_mm,2)} мм. В схеме с точечными опорами при 1 кН на южном торце реакция на северной опоре составляет ${fmt(mainRidge.loads[0].north_reaction_kn,3)} кН.</p>`
  :['purlin-19','post-2'].includes(member.id)&&lowerRidge
   ?`<p class="tiny" data-ridge-reactions>В схеме с точечными опорами из 1 кН по оси стойки поз. 13 прогон № 19 передаёт ${fmt(lowerRidge.loads[0].south_reaction_kn,3)} кН к оси Г и ${fmt(lowerRidge.loads[0].north_reaction_kn,3)} кН к оси Е.</p>`:'';
 const tightest=plate?.anchors.reduce((lowest,a)=>a.socket_headroom_mm!==null&&
  (!lowest||a.socket_headroom_mm<lowest.socket_headroom_mm)?a:lowest,null);
 const coveredAnchors=plate?.anchors.filter(a=>!a.socket_fits_final_frame);
 const anchors=plate?`<p class="tiny" data-plate-anchor-screen>Проверка места под Ø${fmt(anchorScreen.diameter_mm)} при проектном шаге ${fmt(anchorScreen.spacing_mm)} мм.
  ${plate.anchors.length?`${plate.anchors.length} пробных осей. ${plate.axis?'Y':'X'} от оси ${plate.axis?'А':'1'} · ${plate.anchors.map(a=>fmt(a.top_point_mm[plate.axis],2)).join(' · ')} мм.
  Шайба Ø${fmt(anchorScreen.washer_probe.diameter_mm)} × ${fmt(anchorScreen.washer_probe.height_mm)} мм помещается на всех осях.
  ${coveredAnchors.length?`Места, где собранный каркас мешает головке Ø${fmt(anchorScreen.socket_probe.diameter_mm)} × ${fmt(anchorScreen.socket_probe.height_mm)} мм · ${coveredAnchors.map(a=>`<button data-frame-point="${a.top_point_mm.join(',')}">${plate.axis?'Y':'X'} ${fmt(a.top_point_mm[plate.axis],2)} мм</button>`).join(' ')}`:
   `Торцевая головка Ø${fmt(anchorScreen.socket_probe.diameter_mm)} × ${fmt(anchorScreen.socket_probe.height_mm)} мм помещается.${tightest?` <button data-frame-point="${tightest.top_point_mm.join(',')}">Наименьший просвет в 3D</button>`:''}`}
  До боковой грани бетона ${fmt(plate.near_concrete_side_mm)} мм от оси.${plate.cage_section_status==='section_1_1'?'':' Сечение пояса принято по типовому разрезу.'}`:'На этом участке пробный ряд не помещается.'}
  Рабочая раскладка анкеров и арматуры требует расчёта.</p>`:'';
 const bedScreen=report.bed_anchor_screen;
 const bed=bedScreen.rows.find(row=>row.member_id===member.id);
 const uplift=report.bed_uplift_bounds;
 const bedUplift=uplift.rows.find(row=>row.bed_id===member.id);
 const postUplift=uplift.rows.flatMap(row=>row.posts).find(row=>row.post_id===member.id);
 const bedAnchorRule={
  single_post_axis:'Ряд пробных осей через центр стойки.',
  bed_centreline:'Пробные оси вдоль середины бруса.',
  partition_clearance:'Пробный ряд смещён от перегородок для доступа инструмента.'
 };
 const upliftCheck=postUplift?`<p class="tiny" data-bed-uplift>При отдельном отрыве ${fmt(uplift.one_post_uplift_kn)} кН у стойки в группе анкеров нужно минимум ${fmt(postUplift.minimum_anchor_group_tension_kn,3)} кН на растяжение по равновесию.</p>`:
  bedUplift?`<p class="tiny" data-bed-uplift>Нижняя граница растяжения группы при отдельном отрыве ${fmt(uplift.one_post_uplift_kn)} кН.
  ${bedUplift.posts.map(p=>`${esc(roofPartTitle(roofFrameMember(p.post_id)))} · ${fmt(p.minimum_anchor_group_tension_kn,3)} кН`).join('<br>')}</p>`:'';
 const bedAnchors=bed?`<div class="tiny" data-bed-anchor-screen><p>Лежень · Ø${fmt(bedScreen.diameter_mm)} через ${fmt(bedScreen.spacing_mm)} мм по КД‑3.
  ${bed.anchors.length?`${bedAnchorRule[bed.anchor_line_rule]} Рабочие отверстия требуют проверки по арматуре и усилиям.`:
   bed.maximum_axis_span_mm<bedScreen.spacing_mm?`Две оси не помещаются в этой длине. Максимум между осями ${fmt(bed.maximum_axis_span_mm)} мм по габариту отверстий.`:
    'Продольный ряд с таким шагом не проходит между стойками.'}</p>
  ${bed.anchors.map(anchor=>{
   const nearest=anchor.nearest_concrete_edge[report.slab];
   const slab=activeSlab();
   const edge=[slab.opening,...slab.holes].find(h=>h.id===nearest.feature_id)?.label??'Наружный край плиты';
   const overhead=MODEL.floor2.walls.find(w=>w.id===anchor.overhead?.id);
   return `<p>X = ${fmt(anchor.top_point_mm[0])} мм · ${esc(edge)} · ${fmt(nearest.axis_distance_mm,1)} мм от оси.
    ${anchor.tool_blocking_ids?.length?'Инструмент задевает соседние детали. ':overhead&&anchor.overhead.gap_mm<roofContactTolerance?'Сверху примыкает перегородка. ':''}<button data-frame-point="${anchor.top_point_mm.join(',')}">К месту в 3D</button></p>`;
  }).join('')}</div>`:'';
 const angleScreen=report.post_bed_connectors;
 const angles=member.base_plate_ids||(member.id==='post-4'&&MODEL.roof_frame.east_post14_base_detail)
  ?null:angleScreen.rows.find(row=>row.post_id===member.id);
 const angleCheck=angles?`<div class="tiny" data-post-bed-connector><p>Примерка ${angleScreen.catalogue.model} по схеме ${angleScreen.catalogue.pattern}.
  На один уголок четыре CNA 4 × 40 в стойку и шесть в лежень. Заход в древесину при полной посадке 38 мм.</p>
  ${angles.sides.map(side=>{
   const timber=side.adjacent_timber_ids.map(id=>roofFrameMember(id.replace(/-piece1$/,''))).map(roofPartTitle).map(esc);
   const outside=side.bed_nails.filter(nail=>nail.wood_depth_mm<roofContactTolerance).length;
   const issues=[...(!side.full_bed_foot?[`До торца лежня ${fmt(side.bed_extension_mm)} мм при полке ${fmt(angleScreen.catalogue.flange_mm)} мм.`]:[]),
    ...(timber.length?[`Мешает ${timber.join(', ')}.`]:[]),...(outside?[`Гвозди за торцом лежня · ${outside} из ${side.bed_nails.length}.`]:[])];
   return `<p>${side.side==='west'?'С западной стороны':'С восточной стороны'} · ${issues.join(' ')||'Полки прилегают к стойке и лежню.'}
    ${side.partition_ids.length?'Полки входят в объём перегородки. ':''}<button data-frame-point="${side.point_mm.join(',')}">К месту в 3D</button></p>`;
  }).join('')}</div>`:'';
 const basePlates=member.base_plate_ids?`<p class="tiny" data-post-base-plates>Предложены две накладки NP20/80/240 на боковых гранях. Усилия и рабочий крепёж требуют расчёта.
  ${member.base_plate_ids.map(id=>`<button data-frame-stock-member="${esc(id)}">${id.endsWith('-north')?'Северная':'Южная'}</button>`).join(' ')}</p>`:'';
 const basePlate=report.stair_base_plates.rows.find(row=>row.plate_id===member.id);
 const basePlateCheck=basePlate?`<p class="tiny" data-base-plate-nails>Проверены ${basePlate.post.nails.length} оси в стойке и ${basePlate.bed.nails.length} в лежне.
  Заход пробных CNA 4 × 40 · ${fmt(Math.min(...[...basePlate.post.nails,...basePlate.bed.nails].map(n=>n.wood_depth_mm)))} мм.
  Площадь прилегания за вычетом отверстий · ${fmt(basePlate.post.nominal_net_contact_mm2,1)} мм² к стойке, ${fmt(basePlate.bed.nominal_net_contact_mm2,1)} мм² к лежню.
  ${basePlate.partition_ids.length?'В перегородке предусмотрено место под накладку.':''}</p>`:'';
 const parts=report.parts.filter(p=>ids.has(p.id));
 const conflicts=matches.filter(row=>row.volume_mm3).length;
 const ties=report.tie_interfaces.filter(row=>row.tie_id===member.id||row.rafter_id===member.id);
 const tieFastenerScreen=report.tie_fastener_screen;
 const fasteners=tieFastenerScreen.rows.filter(row=>row.rafter_id===member.id||row.tie_ids.includes(member.id))
  .flatMap(row=>row.bolts);
 const fastening=fasteners.length?`<p class="tiny" data-tie-fastener-screen>Пробных болтов М${tieFastenerScreen.bolt.diameter_mm} × ${tieFastenerScreen.bolt.length_mm} · ${fasteners.length}.
  ${fasteners.every(b=>b.passes_all_five_layers&&b.washers_fully_on_wood&&!b.insertion_blocking_ids.length)
    ?'Шайбы полностью на древесине. По оси с севера есть место для установки.':'Примерка выявила ограничения установки.'}</p>
  <p><button data-roof-detail="tie">Стык с М16 в 3D</button></p>`:'';
 const joints=ties.map(row=>{
  const title=member.family==='ties'?'Стропило · '+row.side:roofPartTitle(roofFrameMember(row.tie_id));
  return `<p class="tiny">${esc(title)} · зазор между деревянными гранями ${fmt(row.gap_mm,2)} мм · стальная прокладка ${fmt(row.shim_thickness_mm,2)} мм
    ${row.point_mm?`<button data-frame-point="${row.point_mm.join(',')}">К месту в 3D</button>`:''}</p>`;
 }).join('');
 return `<p>${parts.reduce((sum,p)=>sum+p.fragments,0)} видимых фрагментов · ${conflicts} пересечений · ${matches.length-conflicts} контактов по граням</p>${anchors}${bedAnchors}${ridgeCheck}${recess}${driftText}${spanCheck}${lvlCheck}${gravityCheck}${hipPathText}${hipLegText}${postBearing}${lintelCheck}${upliftCheck}${basePlates}${basePlateCheck}${angleCheck}${ridgeReactions}${fastening}${joints}${matches.length||!ties.length?roofContactRows(matches,cuts,cleatFits):''}`;
}
function roofContactRows(rows,cuts=[],cleatFits=[]){
 if(!rows.length)return '<p class="tiny muted">У показанной геометрии нет контактов по граням или пересечений.</p>';
 const members=new Map(roofFrameMembers().map(m=>[m.id,m]));
 const walls=new Map([...MODEL.floor2.walls,...MODEL.floor2.roof_belt.runs,...MODEL.floor2.roof_belt.insulation].map(w=>[w.id,w.label]));
 const label=id=>{
  const match=id.match(/^(.*)-piece(\d+)$/),m=match&&members.get(match[1]);
  return m?roofPartTitle(m)+((counterBattenLayout(m)?.ranges_mm.length??m.plies??1)>1?' · '+framePieceLabel(m,+match[2]-1):''):walls.get(id)||id;
 };
 const garageBelt=MODEL.floor2.roof_belt.runs.find(run=>run.id==='mp2-garage-east');
 return `<div class="frame-audit-list">${rows.map(row=>{
  const bounds=row.overlap_bounds_mm;
  const cut=cuts.find(c=>row.ids.includes(c.beam_id)&&row.ids.includes(c.support_id));
  const fit=cleatFits.find(c=>row.ids.includes(c.rafter_id+'-piece1')&&row.ids.includes(c.diagonal_id+'-piece1'));
  const fitDetails=fit?`<p class="tiny" data-hip-cleat-fit>${fit.installed_id?'Брусок в сцене':'Проверка бруска 50 × 60 × 550 мм'}.
  Площадь под стропилом ${fmt(fit.rafter_area_mm2,1)} мм², у диагонали ${fmt(fit.diagonal_area_mm2,1)} мм².
  ${fit.flank_height_mm>0?`Высота контакта в проекции ${fmt(fit.flank_height_mm,2)} мм.${fit.flank_height_mm<n('roof.diagonal.nail_diameter')?' Она меньше диаметра гвоздя по КД‑2.':''}`:''}
  ${fit.overlaps.length?'Пересечения · '+fit.overlaps.map(o=>esc(label(o.id))+' '+fmt(o.volume_mm3/1000,2)+' см³').join(', ')+'.':''}
  ${fit.neighboring_rafters.length?'Касается также · '+fit.neighboring_rafters.map(id=>esc(label(id))).join(', ')+'.':''}</p>`:'';
  const hanger=fit?.hanger_geometry;
  const below=hanger?.rafter_bottom_below_diagonal_mm;
  const hangerDetails=hanger?`<p class="tiny" data-hip-hanger-check>Сверка LSSU170/50. Уклон стропила ${fmt(hanger.rafter_slope_deg,3)}°, поворот от перпендикуляра ${fmt(hanger.skew_deg,3)}°.
  ${hanger.skew_exceeds_catalogue?'Поворот превышает каталожные 45°.':''}
  ${below===null?'':`Низ стропила на оси торца ${below<0?'выше':'ниже'} низа диагонали на ${fmt(Math.abs(below),2)} мм.`}
  В таблице сопротивлений ETA указана ширина 47 мм. Для доски 50 мм применимость данных открыта.</p>`:'';
  const cutDetails=cut?`<p class="tiny">Глубина подрезки ${fmt(cut.cut_depth_mm,2)} мм. Площадка ${fmt(cut.area_mm2,1)} мм².
  Высота древесины на углах площадки ${cut.edge_height_range_mm.map(h=>fmt(h,2)).join('–')} мм.
  ${cut.edge_height_range_mm[0]<roofContactTolerance?'На границе площадки у торца луч выходит за пределы детали.':''}</p>`:'';
  const wallCheck=bounds&&row.family.includes('wall')
   ?`<p class="tiny">Отметки пересечения от +${fmt(bounds[2]/1000,3)} до +${fmt(bounds[5]/1000,3)} м.${
     row.ids.includes('upper-garage-east')?` Вдоль стены Y = ${fmt(bounds[1],1)}…${fmt(bounds[4],1)} мм. Торец пояса Мп 2 на Y = ${fmt(garageBelt.bounds_mm[3])} мм.`:''}</p>`:'';
  return `<details><summary>${esc(row.ids.map(label).join(' / '))}</summary><p class="tiny">${row.volume_mm3?'Пересечение '+fmt(row.volume_mm3/1000,2)+' см³':'Касание '+fmt(row.area_mm2,2)+' мм²'} <button data-frame-point="${row.point_mm.join(',')}">К месту в 3D</button></p>${cutDetails}${fitDetails}${hangerDetails}${wallCheck}</details>`;
 }).join('')}</div>`;
}
function openRoofContacts(){return prepareDialog(['roof-audit-js'],renderRoofContacts);}
function renderRoofContacts(){
 const report=scanRoofContacts();
 const transfer=MODEL.roof_frame.north_dormer_transfer;
 const active=id=>!transfer?.former_member_ids.includes(id.replace(/-piece\d+$/,''));
 const parts=report.parts.filter(p=>active(p.member));
 const pairs=report.pairs.filter(p=>p.ids.every(active));
 const overlaps=pairs.filter(p=>p.volume_mm3),contacts=pairs.filter(p=>!p.volume_mm3);
 const missing=parts.filter(p=>!p.fragments);
 const coreParts=parts.filter(p=>!['battens','counter'].includes(p.family));
 const coreOverlaps=overlaps.filter(p=>p.family.every(f=>!['battens','counter'].includes(f)));
 const withoutSupport=parts.filter(p=>p.family==='beds'&&!contacts.some(row=>row.ids.includes(p.id)&&row.ids.includes('Пм1')));
 const bearing=report.eave_interfaces.filter(({masonry})=>!masonry.volume_mm3&&Math.abs(masonry.area_mm2-masonry.expected_mm2)<.1).length;
 const rows=type=>{
  const entries={core:coreOverlaps,all:overlaps,contacts}[type];
  return !entries.length&&type!=='contacts'?'<p class="tiny muted">Объёмных пересечений в этом наборе деталей нет.</p>':roofContactRows(entries);
 };
 const transferCheck=transfer?`<p>Рама у спальни № 18 проверена в FreeCAD. Проверено близких пар · ${transfer.verified_pairs}. <button data-roof-detail="${esc(transfer.detail_id)}">Рама над проходом</button></p>`:'';
 showDialog('КД-2–4 / СВЕРКА МОДЕЛИ','Пересечения и касания',`<p>${parts.length} деталей и фрагментов, из них ${coreParts.length} без обрешётки и контрбруска. Обнаружено ${overlaps.length} пересечений (${coreOverlaps.length} без этих двух слоёв) и ${contacts.length} пар с контактом по граням.</p>${transferCheck}<p>Верх кладки по осям 3 и Г в сцене подогнан к подшивке и диагоналям. Рабочие отметки требуют проверки.</p><p>Участки Мп 2 с полной подошвой на кладке в модели · ${bearing} из ${report.eave_interfaces.length}. Несущая способность требует расчёта. Допуск геометрической проверки ${fmt(report.tolerance_mm,2)} мм.</p><p>Лежни без контакта с Пм1: ${withoutSupport.map(p=>esc(p.member)).join(', ')||'нет'}. Детали без видимого объёма: ${missing.map(p=>esc(p.member)).join(', ')||'нет'}.</p><label>Показать<select id="frame-audit-type"><option value="core">Пересечения без обрешётки и контрбруска</option><option value="all">Все пересечения</option><option value="contacts">Касания</option></select></label><div id="frame-audit-results">${rows('core')}</div>`);
 $('frame-audit-type').onchange=e=>{$('frame-audit-results').innerHTML=rows(e.target.value);};
}
function drawGlobalRoofFrame(g,visible){
 const house=mode==='house';
 // KD-3 shows a closed eave. The house view displays the timber inside the
 // wall perimeter; the structural view also shows its tails under the eaves.
 const wallRegions=house&&MODEL.roof_frame?roofFrameWallRegions():null;
 const layers={};
 for(const [family,m] of Object.entries(ROOF_FRAME_STYLE)){
  const shown=house?['posts','beds','purlins','dormer-transfer'].includes(family):visible&&frameFamilyWanted(family);
  const id='frame-'+family;
  layers[family]=g.layers.get(id)||g.addLayer(id,m.color,{visible:shown,showEdges:!house,order:16,explodeOrder:4});
 }
 drawWindowFrameScenario(g,visible,wallRegions);
 g.framePending=!MODEL.roof_frame;
 if(g.framePending)return;
 for(const m of roofFrameDisplayMembers())emitFrameMember(g,layers[m.family],m,wallRegions);
 const checks=g.addLayer('frame-checks',[.82,.41,.16],{visible,order:18,explodeOrder:4});
 for(const p of MODEL.roof_frame.contact_checks){const point=MODEL.roof_geometry.points.find(n=>n.id===p.roof_point_id);g.line(checks,[+point.x_mm,+point.y_mm,p.purlin_top_mm],[+point.x_mm,+point.y_mm,p.rafter_lower_reference_mm],'frame:checks');}
 for(const m of MODEL.roof_frame.members.filter(m=>['13','15','16','18','19','20'].includes(m.position))){const p=m.a_mm.map((v,i)=>(v+m.b_mm[i])/2);for(const k of [0,1]){const a=[...p],b=[...p];a[k]-=180;b[k]+=180;g.line(checks,a,b,'frame-member:'+m.id);}}
 const l=g.addLayer('frame-selected',[.91,.40,.12],{visible:true,order:20,explodeOrder:4});
 const selected=roofFrameMember(roofFrameState.selected);
 if(selected){l.dependsOn='frame-'+selected.family;drawFrameSelection(g,l,selected);}
}
function loadSceneRoofFrame(g){
 if(!g.framePending)return;
 const request=sceneRequest;
 return withResources(['roof-frame'],()=>{
  if(request!==sceneRequest||!g.framePending)return;
  for(const [id,layer] of g.layers)if(id.startsWith('frame-')){
   layer.vertices=[];layer.edges=[];
  }
  drawGlobalRoofFrame(g,false);
  if(mode==='house')architecturalPriorities(g);
  for(const [id,layer] of g.layers)if(id.startsWith('frame-'))g.commitLayer(layer);
  describeWindowFraming(g);
  indexSceneObjects(g);renderLayerControls();g.request();
 });
}
function highlightRoofFrame(){
 const g=renderer,l=g?.layers.get('frame-selected');if(!l)return;
 const m=roofFrameMember(roofFrameState.selected);
 l.vertices=[];l.edges=[];g.hitTargets=g.hitTargets.filter(t=>t.layer!==l.id);g.labels=g.labels.filter(t=>t.kind!=='frame-size');
 l.dependsOn=m&&!roofFrameState.isolate?'frame-'+m.family:null;
 if(m)drawFrameSelection(g,l,m);
 g.commitLayer(l);g.request();
}
function selectRoofFrameMember(key){
 const [id,ply]=key.split('@');
 if(roofFrameState.isolate&&roofFrameState.isolate!==id){roofFrameState.isolate=null;applyRoofFrameVisibility();}
 roofFrameState.selected=id||null;roofFrameState.selectedPly=ply?+ply-1:null;
 const m=roofFrameMember(id);
 if(mode==='frame'&&m&&!roofFrameState.isolate&&!renderer.layers.get('frame-'+m.family)?.visible){
  roofFrameState.family=m.family;
  applyRoofFrameVisibility();$('frame-family').value=roofFrameState.family;
 }
 const input=$('frame-member');
 if(input){
  if(!Array.from(input.options).some(o=>o.value===key)){$('frame-search').value='';$('frame-search').oninput();}
  input.value=key;
 }
 highlightRoofFrame();inspectRoofFrameMember(id);
}
function roofFramePartOptions(){
 const selected=roofPartKey(roofFrameState.selected,roofFrameState.selectedPly);
 const option=(key,label)=>`<option value="${esc(key)}" ${key===selected?'selected':''}>${esc(label)}</option>`;
 return roofFrameMembers().map(m=>{
  const title=roofPartTitle(m);
  const pieces=framePieces(m);
  if(pieces.length===1)return option(m.id,title);
  return option(m.id,title+(counterBattenLayout(m)?' · весь ряд':' · сборка'))+
   pieces.map((_,i)=>option(roofPartKey(m.id,i),title+' · '+framePieceLabel(m,i))).join('');
 }).join('');
}
function renderRoofFrameTools(){const mount=$('frame-tools');if(!mount)return;mount.hidden=mode!=='frame';if(mount.hidden)return;
 mount.innerHTML=`<div class="frame-primary-tools">
  <div class="roof-render-styles" role="group" aria-label="Стиль отображения">${Object.entries(roofRenderStyles).map(([id,label])=>`<button type="button" data-frame-style="${id}" aria-pressed="${id===roofFrameState.style}">${label}</button>`).join('')}</div>
  <label class="frame-search"><span class="sr-only">Найти деталь</span><input id="frame-search" type="search" placeholder="Найти деталь"></label>
  <label class="frame-part-picker"><span class="sr-only">Выбрать деталь</span><select id="frame-member"><option value="">Выбрать деталь</option>${roofFramePartOptions()}</select></label>
 </div>
 <details id="frame-advanced" ${currentTab!=='roof'||roofFrameState.advanced?'open':''}><summary>Слои и проверка</summary><div class="frame-advanced-tools">
  <label>Группа<select id="frame-family"><option value="all">Весь каркас</option>${Object.entries(ROOF_FRAME_STYLE).map(([id,m])=>`<option value="${id}" ${id===roofFrameState.family?'selected':''}>${m.label}</option>`).join('')}</select></label>
  <label>Участок<select id="frame-zone"><option value="">Весь каркас</option>${Object.entries(roofFrameZones).map(([id,z])=>`<option value="${id}">${esc(z.label)}</option>`).join('')}</select></label>
  <label class="control"><input id="frame-context" type="checkbox" ${roofFrameState.showWalls?'checked':''}> Стены, пояс, плита и шахты</label>
  <label class="control"><input id="frame-counter" type="checkbox" ${roofFrameState.counter?'checked':''}> Контробрешётка</label>
  <label class="control"><input id="frame-battens" type="checkbox" ${roofFrameState.battens?'checked':''}> Обрешётка</label>
  <label class="control"><input id="frame-dimensions" type="checkbox" ${roofFrameState.dimensions?'checked':''}> Размеры на сцене</label>
  <button data-roof-contacts>Проверка контактов</button><button id="frame-flight">${renderer.walk?.flight?'Выйти из полёта':'Свободный полёт'}</button><button data-roof-frame>Сверка с ведомостью</button>
 </div></details>`;
 mount.querySelectorAll('[data-frame-style]').forEach(b=>b.onclick=()=>{roofFrameState.style=b.dataset.frameStyle;applyRoofRenderStyle();});
 $('frame-advanced').ontoggle=e=>{if(currentTab==='roof')roofFrameState.advanced=e.target.open;};
 applyRoofRenderStyle();
 const search=$('frame-search'),memberList=$('frame-member'),options=[...memberList.options];
 search.oninput=()=>{
  const term=search.value.trim().toLocaleLowerCase('ru');
  const selection=roofFrameState.selected?roofPartKey(roofFrameState.selected,roofFrameState.selectedPly):'';
  memberList.replaceChildren(options[0],...options.slice(1).filter(o=>o.textContent.toLocaleLowerCase('ru').includes(term)||o.value.toLowerCase().includes(term)||o.value===selection));
  memberList.value=selection||'';
 };
 $('frame-context').onchange=e=>showFrameContext(e.target.checked);
 $('frame-dimensions').onchange=e=>{roofFrameState.dimensions=e.target.checked;highlightRoofFrame();};
 if(roofFrameState.selected)highlightRoofFrame();
 $('frame-zone').onchange=e=>{
  const zone=roofFrameZones[e.target.value];
  if(zone)focusFrameZone(zone);
  else{renderer.home('frame');renderer.request();}
 };
 $('frame-flight').onclick=()=>renderer.walk?.flight?exitTour():startTour('15',true);
 $('frame-family').onchange=e=>{roofFrameState.family=e.target.value;applyRoofFrameVisibility();};$('frame-member').onchange=e=>selectRoofFrameMember(e.target.value);
 for(const k of ['counter','battens'])$('frame-'+k).onchange=e=>{roofFrameState[k]=e.target.checked;applyRoofFrameVisibility();};
}
function applyRoofFrameVisibility(){for(const f of Object.keys(ROOF_FRAME_STYLE)){const l=renderer.layers.get('frame-'+f);if(l)l.visible=!roofFrameState.isolate&&frameFamilyWanted(f);}
 const selected=renderer.layers.get('frame-selected'),member=roofFrameMember(roofFrameState.selected);
 if(selected)selected.dependsOn=roofFrameState.isolate||!member?null:'frame-'+member.family;
 renderLayerControls();renderer.request();}
function inspectRoofFrameMember(id){
 const m=roofFrameMember(id);if(!m)return renderRoofFrameInspector();
 const eaveFittings=m.cad_mesh?roofFrameMembers().filter(p=>
  p.family==='eave-connectors'&&p.input_geometry_ids.includes('roof_frame.members.'+m.id)):[];
 const block=m.bearing_block;
 const fittedSeat=m.end_batten_seat??m.deck_edge_support;
 const seatScrews=fittedSeat?.tested_screw_lengths_into_base_mm;
 const sideFixing=fittedSeat?.side_fastening;
 const counterLayout=counterBattenLayout(m);
 const selected=selectedRoofPieces(m),reference=selected[0];
 const fixings=selected.length===1?reference.fixing_offsets_mm:null;
 const garageCounter=counterLayout?.garage_fit;
 const garageCounterScrew=reference.id===garageCounter?.piece_id?garageCounter.fastener:null;
 const fastener=garageCounterScrew??MODEL.roof_frame.counter_batten_cuts?.fastener_screen;
 const extents=selected.length===1?framePieceExtents(m,reference,mode==='house'?roofFrameWallRegions():null):null;
 const visible=extents?extents.map(([lo,hi])=>fmt(hi-lo,2)).join(' × '):null;
 const dimensions=extents?extents.map(([lo,hi])=>fmt(hi-lo,2)):[];
 const measureCard=visible?`<figure class="frame-piece-card">
  <canvas id="frame-piece-preview" width="480" height="264" aria-label="Эскиз выбранной детали с размерами"></canvas>
  <figcaption><span class="sr-only" data-frame-size>${visible} мм</span><dl>${(m.post_base_plate?['Ширина','Толщина','Высота']:block?['Высота','Ширина','Глубина']:['Длина','Ширина','Высота']).map((title,i)=>`<div><dt>${title}</dt><dd>${dimensions[i]} <small>мм</small></dd></div>`).join('')}</dl></figcaption>
 </figure>`:selected.length===1?'<p class="tiny muted">Осевая схема · объём в этой привязке отсутствует.</p>':
  `<p class="tiny muted">${counterLayout?'Выберите отрезок, чтобы увидеть его размеры.':'Выберите один брус в сборке, чтобы увидеть его габарит.'}</p>`;
 const actions=mode==='frame'?`<div class="frame-piece-actions"><button data-frame-member-focus="${esc(m.id)}">Приблизить</button><button data-frame-isolate="${esc(m.id)}">${roofFrameState.isolate===m.id?'Вернуть каркас':'Изолировать'}</button></div>`:'';
 const vk2Details=MODEL.roof_frame.vk2_support_details;
 const vk2Detail=vk2Details?.rafter_id===m.id?`<div data-vk2-connector-check>
  <p class="tiny">Проверочный ЛВЛ 90 × 200 мм</p>
  <div class="frame-piece-actions"><button data-roof-detail="${esc(vk2Details.full_detail_id)}">Стропило целиком</button><button data-roof-detail="${esc(vk2Details.eave_detail_id)}">Карнизный узел</button><button data-roof-detail="${esc(vk2Details.ridge_detail_id)}">Коньковый узел</button></div>
 </div>`:'';
 const ok11Part=m.id==='batten-101'?'batten-101-south':m.id;
 const windowDetail=['batten-101','rafter-76','rafter-77','diagonal-9'].includes(m.id)
  ?`<div class="buttons-row"><button data-roof-detail="ok11-frame" data-roof-detail-part="${esc(ok11Part)}">Каркас вокруг ОК-11 в 3D</button></div>`:'';
 const postDetail=m.id==='post-1'?'<div class="buttons-row"><button data-roof-detail="post12-shoe">Стальная опора в 3D</button></div>':'';
 const eastPostBaseDetail=['post-4','bed-post-4'].includes(m.id)?MODEL.roof_frame.east_post14_base_detail:null;
 const eastPostHeadDetail=['post-4','purlin-10'].includes(m.id)?MODEL.roof_frame.east_post14_head_detail:null;
 const northTransfer=MODEL.roof_frame.north_dormer_transfer;
 const northTransferDetail=m.family==='dormer-transfer'||northTransfer?.route_members.includes(m.id)?northTransfer?.detail_id:null;
 const southFrontonDetail=['purlin-9','mauerlat-dormer-s-west','mauerlat-dormer-s-east'].includes(m.id);
 const mauerlatDetail=MODEL.roof_frame.mauerlat_steel_details?.[m.id];
 const garageDetail=MODEL.roof_frame.garage_saddle_details?.[m.id];
 const upperValleyDetail=['diagonal-pos4','purlin-8'].includes(m.id)?MODEL.roof_frame.garage_valley_upper_detail:null;
 const eastValleyDetail=['diagonal-9','purlin-10'].includes(m.id)?MODEL.roof_frame.east_bay_valley_upper_detail:null;
 const lowerValleyDetail=m.id==='diagonal-pos4'?MODEL.roof_frame.garage_valley_pivot_detail:null;
 const shortRafterDetail=m.id==='rafter-47'?MODEL.roof_frame.garage_rafter47_detail:null;
 const bearing=m.slab_bearings?.[activeSlab().id];
 const lower=m.floor1_projection;
 const fit=m.bearing_fit;
 const central=m.central_bearing;
 const westPlate=m.west_bearing;
 const garageSeat=m.garage_ridge_seat;
 const garageValley=m.garage_valley_fit;
 const vk1=m.vk1_fit;
 const vk3=m.vk3_fit;
 const vk2=m.vk2_edge_support;
 const corner=roofCornerSupport(m);
 const hip=m.hip_corner_fit;
 const hipSeat=hip?corner.plates.find(p=>p.id===m.plate_seats[0].plate_id):null;
 const head=m.diagonal_post_head;
 const bay=m.bay_support;
 const bayValley=m.bay_valley_bearing;
 const valleySupport=m.valley_support;
 const gable=m.gable_fit;
 const dormerGable=m.dormer_gable_fit;
 const dormerBearing=m.dormer_bearing;
 const northernSupport=dormerBearing?.conditional_support||m.position==='dormer-post';
 const valleyFit=m.valley_packet_fit;
 const northCorner=m.north_corner_fit;
 const extension=m.eave_extension;
 const warning=m.post_base_plate?'Крепёж требует расчёта':northernSupport?'Опора на Пм 1 требует расчёта':vk1||m.vk1_end_cut_mm?'Проходка ВК‑1 требует согласования':vk3?'Проходка ВК‑3 требует согласования':vk2?'Дополнительная опора требует расчёта':valleySupport||bayValley?.console_id||block?.diagonal_id||m.dormer_valley_support_id?'Предложенная опора требует расчёта':bayValley?.post_id?'Вынос требует расчёта':westPlate||garageSeat||garageValley?'Опора и крепёж требуют расчёта':central?'Опоры прогона требуют расчёта':block?'Крепёж бруска требует расчёта':corner?'Угловая опора требует решения':bay?'Отметка мауэрлата требует сверки':extension||m.status==='garage_outboard_rafter'?'Вынос требует расчёта':gable?'Болтовое соединение требует расчёта':dormerGable?'Грань южного фронтона требует сверки':northCorner?'Положение крайнего ряда требует согласования':head?'Опора на Пм 1 требует расчёта':bearing?.area_mm2===0?'Лежень вне Пм 1':dormerBearing||m.dormer_upper_bearing_id||valleyFit?'Соединение требует расчёта':fit?.shim_id||m.ridge_bearing_shim?'Опорная прокладка требует проверки':fit?'Длина по ведомости требует сверки':'';
 $('inspector').innerHTML=`<div class="eyebrow">${roofFrameState.selectedPly===null?'ВЫБРАННАЯ ДЕТАЛЬ':framePieceLabel(m,roofFrameState.selectedPly)}</div><h3>${esc(roofPartTitle(m))}</h3>${m.lvl_trial?'<span class="status amber">ЛВЛ-брус на проверке</span>':warning?`<span class="status amber">${warning}</span>`:''}${measureCard}${actions}${vk2Detail}${windowDetail}${postDetail}
 ${mauerlatDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(mauerlatDetail)}">Стальная опора выноса в 3D</button></div>`:''}
 ${garageDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(garageDetail)}">Опора стропила в 3D</button></div>`:''}
 ${upperValleyDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(upperValleyDetail)}">Стык ендовы с прогоном 8 в 3D</button></div>`:''}
 ${eastValleyDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(eastValleyDetail)}">Опора ендовы у прогона № 10</button></div>`:''}
 ${eastPostBaseDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(eastPostBaseDetail)}">Стык стойки № 14 с лежнем</button></div>`:''}
 ${eastPostHeadDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(eastPostHeadDetail)}">Крепление стойки № 14 к прогону</button></div>`:''}
 ${northTransferDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(northTransferDetail)}">Рама над проходом спальни № 18</button></div>`:''}
 ${southFrontonDetail?'<div class="frame-piece-actions"><button data-roof-detail="south-fronton-hold-down">Крепление у южного фронтона</button><button data-roof-detail="south-fronton-pr4">Опирание над входом</button></div>':''}
 ${m.id==='rafter-89'?'<div class="frame-piece-actions"><button data-roof-detail="rafter-89-lvl">Стропило ЛВЛ и три опоры в 3D</button></div>':''}
 ${lowerValleyDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(lowerValleyDetail)}">Нижняя опора ендовы · проверка</button></div>`:''}
 ${shortRafterDetail?`<div class="frame-piece-actions"><button data-roof-detail="${esc(shortRafterDetail)}">Торец стропила у ендовы в 3D</button></div>`:''}
 ${garageCounter?`<div class="frame-piece-actions"><button data-roof-detail="${esc(garageCounter.detail_id)}">Крепление контрбруска в 3D</button></div>`:''}
 <details class="frame-piece-source"><summary>${m.post_base_plate||m.lvl_trial||counterLayout||fittedSeat||m.fastener_fit?'Размеры в модели и источники':block||m.shim_fit?'Размеры в модели и исходные листы':'Размеры по проекту и источник'}</summary>
 <div class="detail-list"><div class="detail-row">Сечение<b>${fmt(m.width_mm,2)} × ${fmt(m.height_mm,2)} мм</b></div><div class="detail-row">Длина оси в модели<b>${fmt(reference.station_range_mm?reference.station_range_mm[1]-reference.station_range_mm[0]:m.axis_length_mm,3)} мм</b></div>${(m.stock_length_mm??fit?.source_length_mm)?`<div class="detail-row">Длина по ведомости<b>${fmt(m.stock_length_mm??fit.source_length_mm)} мм</b></div>`:''}</div>
 ${counterLayout?`<p>${garageCounter?`У опоры перекрёстный вентиляционный разрыв ${fmt(garageCounter.gap_mm,1)} мм.`:`Вентиляционные разрывы по ${MODEL.roof_frame.counter_batten_cuts.nominal_gap_mm} мм.`} Шаг обрешётки ${MODEL.roof_frame.counter_batten_cuts.roof_batten_step_mm} мм.</p>`:''}
 ${fixings&&fastener?`<p data-counter-fixings>Проверочные оси ${garageCounterScrew?'шурупов HBS EVO':'гвоздей'} Ø${fmt(fastener.diameter_mm,1)} × ${fmt(fastener.length_mm)} мм. От торца А вдоль бруска · ${fixings.map(v=>fmt(v,1)).join(' / ')} мм. Рабочее количество зависит от расчёта усилий.</p>`:''}
 ${m.fastener_fit?`<ul class="tiny" data-member-fastener-fit>${m.fastener_fit.map(f=>`<li>${f.is_nail?'Гвозди':'Винты'} Ø${fmt(f.diameter_mm,1)} × ${fmt(f.length_mm)} мм · ${f.count} шт. Заход с учётом запаса от ${fmt(f.engagement_mm,1)} мм.</li>`).join('')}</ul>`:''}
 ${fittedSeat?`<p>${m.deck_edge_support?'Площадь нижней посадки':'Площадь прилегания'} ${fmt(fittedSeat.measured_contact_mm2,1)} мм². Рабочее крепление требует расчёта.</p>${seatScrews?`<p>Пробные винты Ø5,6 × 160 мм. Заход в ендову ${seatScrews.map(v=>fmt(v,2)).join(' / ')} мм.</p>`:''}${sideFixing?`<p>Пробное боковое крепление · ${sideFixing.count} винта Ø${fmt(sideFixing.nominal_diameter_mm)} × ${fmt(sideFixing.nominal_length_mm)} мм. Минимальный заход в стропило ${fmt(sideFixing.minimum_rafter_engagement_mm,2)} мм.</p>`:''}${m.deck_edge_support?sheetBtn('house_1',12,'АР‑11 · слои кровли'):sheetBtn('house_2',22,'КД‑2 · план диагоналей')}`:''}
 ${m.post_base_plate?`<div class="buttons-row">${sheetBtn('house_2',23,'КД‑3 · исходный узел')}<a href="${esc(MODEL.roof_frame.stair_base_plate.catalogue_url)}" target="_blank" rel="noopener">Каталог NP20/80/240</a></div>`:''}
 ${m.lvl_trial?`<p>По КД‑4 ${m.lvl_trial.source_section_mm.join(' × ')} мм. В сцене цельный брус без нахлёста. Длина заводской заготовки ${fmt(m.lvl_trial.catalogue_blank_mm)} мм.</p><a href="${esc(m.lvl_trial.source_url)}" target="_blank" rel="noopener">Сортамент Ultralam R</a>`:''}
 ${bearing?`<p>Контакт с Пм 1 в модели · ${fmt(bearing.area_mm2,1)} из ${fmt(bearing.sole_area_mm2,1)} мм² подошвы.${bearing.plan_gap_mm?` До плиты в плане ${fmt(bearing.plan_gap_mm,1)} мм.`:''}</p>${sheetBtn('house_2',12,'КЖ-7 · Пм 1')}`:''}
 ${lower?`<p>Проекция подошвы на первый этаж · ${fmt(lower.area_mm2)} мм².</p>
 ${lower.hits.length?`<ul class="tiny">${lower.hits.map(hit=>`<li>${esc(hit.label)} · ${fmt(hit.area_mm2)} мм²</li>`).join('')}</ul>`:'<p>Под проекцией нет стены.</p>'}
 <p class="tiny">Передача нагрузки через плиту требует расчёта.</p>
 ${sheetBtn('house_1',4,'АР‑3 · первый этаж')}${lower.hits.some(hit=>hit.collection==='lintel_envelopes')?sheetBtn('house_2',16,'КЖ‑11 · перемычки'):''}`:''}
 ${m.dormer_upper_bearing_id?`<p>${esc(m.coordinate_rule)}</p>`:''}
 ${m.shim_fit?`<p>Примерочная деталь. Толщина получена из размера 75 мм на КД‑3. Рабочее соединение требует расчёта.</p>${sheetBtn('house_2',23,'КД‑3 · затяжка')}`:''}
 ${m.eave_cleat||m.eave_cleat_id?`<div class="buttons-row"><button data-roof-detail="eave">Карнизный стык в 3D</button>${sheetBtn('house_2',23,'КД‑3 · сечение 1–1')}</div>`:''}
 ${m.diagonal_cleat||m.diagonal_cleat_id?`<div class="buttons-row">${sheetBtn('house_2',22,'КД‑2 · узел 1 и сечение а–а')}</div>`:''}
 ${m.eave_hanger_end_cut?`<p>Отступ торца под подвес ${fmt(m.eave_hanger_end_cut.metal_allowance_mm,1)} мм.</p>
 <button data-frame-stock-member="${esc(m.eave_hanger_end_cut.beam_id)}">Карнизная балка</button>`:''}
 ${eaveFittings.length?`<div class="buttons-row">${eaveFittings.map(p=>`<button data-frame-stock-member="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</div>`:''}
 ${fit?.shim_id?`<p>Между прогонами ${fmt(fit.clear_height_mm)} мм. Под стойкой показана опорная прокладка ${fmt(fit.shim_thickness_mm)} мм.</p>
 <button data-frame-stock-member="${esc(fit.shim_id)}">Прокладка под стойкой</button>`:
 fit?`<p>Высота между опорами в сцене ${fmt(fit.clear_height_mm)} мм. Расхождение с ведомостью ${fmt(Math.abs(fit.source_excess_mm))} мм. ${fit.kd2_x_mm===undefined?esc(m.coordinate_rule):`Ось по КД-2 X = ${fmt(fit.kd2_x_mm)} мм, в сцене X = ${fmt(m.a_mm[0])} мм по АР-8.`}</p>`:''}
 ${m.ridge_cap_id?`<button data-frame-stock-member="${esc(m.ridge_cap_id)}">Вкладыш под диагоналями</button>`:''}
 ${m.ridge_bearing_cap?.axial_contact?`<p>Торцевой упор в прогон 7 · 120 × 30 мм. Остальная торцевая поверхность отступает на 3 мм.</p>`:''}
 ${central?`<p>Под стойкой 13. Ось X = ${fmt(m.a_mm[0])} мм, низ +${fmt(m.datum_mm/1000,3)} м. Просвет до ВК-2 ${fmt(central.shaft_clearance_mm)} мм. Торец у Г укорочен на ${fmt(central.south_end_trim_mm)} мм для просвета до стропила.</p>${sheetBtn('house_2',22,'КД-2 · прогон 19')}${sheetBtn('house_2',12,'КЖ-7 · ВК-2')}`:''}
 ${westPlate?`<p>Низ бруса в 3D · +${(westPlate.bottom_mm/1000).toFixed(3).replace('.',',')} м. ${esc(m.coordinate_rule)}</p>${sheetBtn('house_2',22,'КД-2 · выноска позиции 21')}${sheetBtn('house_1',westPlate.axis===1?10:5,westPlate.axis===1?'АР-9 · разрез у лестницы':'АР-4 · стена по оси Г')}`:''}
 ${garageSeat?`<p>Горизонтальная площадка по верху прогона 8 на +${fmt(garageSeat.top_mm/1000,3)} м. Глубина подрезки поперёк сечения до ${fmt(garageSeat.depth_normal_mm,2)} мм.</p>${sheetBtn('house_2',23,'КД-3 · сечение гаражного конька')}`:''}
 ${m.stock_span_mm?`<p>После отвесного запила нижний торец ограничен длиной заготовки 3400 мм по КД-4.</p>`:''}
 ${garageValley?`<p>Брус сдвинут вдоль ендовы на ${fmt(garageValley.advance_mm,2)} мм до оси мауэрлата. Глубина запила поперёк сечения до ${fmt(garageValley.depth_normal_mm,2)} мм.</p>`:''}
 ${bayValley?.post_id?`<p>От оси стойки 18 до нижнего торца ${fmt(bayValley.axis_overhang_mm,1)} мм вдоль бруса.</p>`:''}
 ${valleySupport?`<p>Подошва на мауэрлате над Мп 2. При выносе внутрь от опоры требуется крепление от поворота.</p>${sheetBtn('house_2',15,'КЖ-10 · Мп 2')}`:''}
 ${vk1?`<p>Просвет до ВК‑1 в 3D · ${fmt(vk1.clearance_mm)} мм.</p><p>${esc(m.coordinate_rule)}</p>${sheetBtn('house_1',20,'АР-19 · ВК-1')}`:''}
 ${vk3?`<p>Просвет до ВК‑3 в 3D · ${fmt(vk3.clearance_mm)} мм. Ось ряда по цепи КД‑2 · ${fmt(vk3.source_axis_mm)} мм. Ось в сцене · ${fmt(vk3.model_axis_mm)} мм.</p>${sheetBtn('house_1',22,'АР-21 · ВК-3')}`:''}
 ${vk2?`<p>Ось дополнительного ряда у северной границы ВК‑2 · ${fmt(vk2.axis_mm)} мм. Просвет до кирпича ${fmt(vk2.clearance_mm)} мм.</p>${sheetBtn('house_1',21,'АР-20 · ВК-2')}`:''}
 ${block?`<p>Высоты по краям ${block.edge_heights_mm.map(h=>fmt(h,2)).join(' и ')} мм. Подошва на продольном брусе, наклонная грань под ${block.diagonal_id?'ендовой':'стропилом'}.</p>`:''}
 ${hipSeat?`<p>Нижний конец поднят на ${fmt(hip.eave_raise_mm,1)} мм. Глубина запила поперёк бруса ${fmt(hipSeat.normal_cut_mm,2)} мм. Площадка опирания на боковой мауэрлат ${fmt(hipSeat.horizontal_bearing_mm2,1)} мм². Отметка у конька сохранена.</p>`:''}
 ${bay?`<p>Верх пояса по КЖ-10 и низ бруса в сцене · +${fmt(bay.belt_top_mm/1000,3)} м. Верх бруса · +${fmt(bay.beam_top_mm/1000,3)} м. КД-2 указывает +${fmt(bay.plan_elevation_mm/1000,3)} м без уточнения грани.</p>`:''}
 ${extension?`<p>За торцом Мп 2 · ${fmt(extension.length_mm)} мм до кромки ската по АР-8. В кладке на этом участке предусмотрен показанный в 3D просвет ${fmt(extension.clearance_mm)} мм.</p>${sheetBtn('house_1',9,'АР-8 · кромка ската')}`:''}
 ${head?`<p>${esc(m.coordinate_rule)} Высота по оси до скоса · ${fmt(head.top_at_axis_mm-m.a_mm[2],1)} мм.</p>${sheetBtn('house_2',12,'КЖ-7 · Пм 1')}`:''}
 ${m.family==='ties'?`<p>По КД-3 между наружными гранями пары ${fmt(2*m.width_mm+n('roof.tie.clear_gap'))} мм.</p>${sheetBtn('house_2',23,'КД-3 · затяжка')}`:''}
 ${gable?`<p>Ось первой пары по цепи КД-2 · Y = ${fmt(m.joint_row_mm)} мм. Просвет от доски до фронтона ${fmt(gable.wall_gap_mm,1)} мм.</p>`:''}
 ${dormerGable?`<p>Ось ряда по КД-2 · Y = ${fmt(m.grid_coordinate_mm)} мм. До кладки по плану АР-4 в сцене ${fmt(dormerGable.plan_clearance_mm)} мм. По цепи разреза АР-10 расчётный просвет ${fmt(dormerGable.section_clearance_mm)} мм.</p>${sheetBtn('house_1',5,'АР-4 · план')}${sheetBtn('house_1',11,'АР-10 · разрез')}`:''}
 ${dormerBearing?`<p>Низ +${fmt(dormerBearing.bottom_mm/1000,3)} м. Подошва ${northTransferDetail?'на стальной раме':northernSupport?'на добавленной стойке':'на стойке 17'} · ${fmt(dormerBearing.post_area_mm2)} мм², на фронтоне · ${fmt(dormerBearing.wall.horizontal_area_mm2)} мм².</p>${northTransferDetail?'':`<p>${esc(m.coordinate_rule)}</p>`}${sheetBtn('house_1',5,'АР-4 · фронтон')}`:''}
 ${valleyFit?`<p>Ось ниже кровельной поверхности на ${fmt(valleyFit.axis_drop_mm,2)} мм по вертикали. Верх бруса подогнан к плоскости под контрбрусками.</p>`:''}
 ${northCorner?`<p>Ось по КД-2 X = ${fmt(northCorner.source_axis_mm)} мм. В сцене ряд смещён на ${fmt(northCorner.inward_shift_mm)} мм к середине ската, на X = ${fmt(northCorner.model_axis_mm)} мм. Шаг до соседнего ряда ${fmt(northCorner.neighbour_spacing_mm)} мм.</p><p>Глубина запила поперёк доски ${fmt(m.plate_seats[0].depth_normal_mm,2)} мм.</p>`:''}
 <p>${esc(northTransfer?.route_members.includes(m.id)?'Фронтон и стальная рама над проходом служат опорами в проверочной сборке. Крепление на раме и проверка реакций остаются открытыми.':m.note)}</p>${m.family==='rafters'&&m.plate_seats?`<p>Длина площадки в модели ${m.plate_seats.map(s=>fmt(s.bearing_mm,2)).join(' / ')} мм. Расчётная длина опирания и крепёж остаются открытыми.</p>`:''}${m.ridge_cut&&m.family==='rafters'?'<p>Торец в 3D доведён до вертикальной плоскости конька. Узел опирания на прогон требует проверки.</p>':''}<div class="hash">${esc(m.id)}<br>А = ${reference.a_mm.map(v=>fmt(v,3)).join(' / ')}<br>Б = ${reference.b_mm.map(v=>fmt(v,3)).join(' / ')} мм</div>
 <div class="buttons-row">${sheetBtn('house_2',22,'КД-2 · план')}${m.hold_down_fit?'':sheetBtn('house_2',24,'КД-4 · ведомость')}${m.hold_down_fit||m.support_id||m.plate_seats?sheetBtn('house_2',15,'КЖ-10 · Мп 2'):''}${m.hold_down_fit||m.plate_seats?sheetBtn('house_2',23,'КД-3 · сечения'):''}</div>${m.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label)).join('<br>')}
 </details>${mode==='frame'?'<details data-frame-member-contact><summary>Контакты детали</summary><div></div></details>':''}`;
 if(visible)framePiecePreview(m,reference,extents);
 const contacts=$('inspector').querySelector('[data-frame-member-contact]');if(contacts)contacts.addEventListener('toggle',()=>{
  if(contacts.open&&!contacts.lastElementChild.innerHTML)withResources(['roof-audit-js'],()=>{
   if(contacts.isConnected)contacts.lastElementChild.innerHTML=roofContactInspector(m);
  });
 });
}
function renderRoofFrameInspector(){
 $('inspector').innerHTML='<h3>Деталь каркаса</h3><p class="muted">Выберите деталь в сцене или в списке. Здесь появятся её эскиз и размеры.</p><span class="status amber">Монтажные узлы на проверке</span>';
}
function openRoofFrame(){return prepareDialog(['roof-frame','roof','structure','facts','roof-audit-js'],renderRoofFrame);}
function roofRafterStockSection(){
 const report=roofRafterStockReport();
 const additional=report.rows.filter(r=>r.additional_vk2_row).flatMap(r=>r.pieces)
  .reduce((sum,p)=>sum+p.volume_mm3,0)/1e9;
 const long=report.rows.flatMap(row=>row.pieces.filter(p=>p.length_mm>report.nominal_stock_mm).map(piece=>{
  const m=roofFrameMember(row.member_id),label=roofPartTitle(m);
  const range=piece.one_blank_mm?`Цельный ЛВЛ · заготовка ${fmt(piece.one_blank_mm)} мм`:
   piece.lap_centre_from_start_mm?.map(v=>fmt(v,1)).join('–');
  const clear=piece.clear_intervals_mm.map(v=>fmt(v,1)).join(' / ');
  return `<tr><td>${mode==='frame'?'<button class="link-button" data-frame-stock-member="'+esc(m.id)+'">'+esc(label)+'</button>':esc(label)}
  ${row.additional_vk2_row?'<small>Добавленный ряд ВК‑2</small>':''}</td><td>${fmt(row.station_mm)}</td>
  <td>${fmt(piece.length_mm,1)}</td><td>${clear||'—'}</td><td>${range||'Две заготовки не вмещаются'}</td></tr>`;
 }));
 return `<details data-rafter-stock-report><summary>Стропила после подрезки · ${report.long_piece_count} длиннее ${fmt(report.nominal_stock_mm/1000,1)} м</summary>
 <p>${report.rows.length} стропил, ${report.piece_count} связных деталей. Сумма длин вдоль волокон ${fmt(report.piece_length_sum_mm/1000,3)} м.
 Объём древесины после запилов ${fmt(report.net_volume_m3,4)} м³ с учётом примерочного ЛВЛ-бруса, из них ${fmt(additional,4)} м³ у дополнительного ряда возле ВК‑2.
 По КД‑4 ${fmt(report.source_length_m)} м и ${fmt(report.source_volume_m3,3)} м³.
 Обрамления окон учитываются отдельно.</p>
 <p>Расстояния между контактами измерены вдоль волокон между гранями мауэрлатов, прогонов и диагоналей.
 Для пиломатериала границы в последнем столбце показывают, где центр нахлёста помещается по длине двух заготовок.
 Для проверки использованы ${fmt(report.nominal_stock_mm)} мм по ГОСТ 24454‑80 и ${fmt(report.check_lap_mm)} мм по сечению а–а.
 КД‑4 также даёт ${fmt(Math.min(...report.source_laps_mm))} мм на лицевом виде. Места стыков и крепёж требуют расчёта.</p>
 <div class="table-wrap"><table><thead><tr><th>Стропило</th><th>Ось Y, мм</th><th>Длина, мм</th><th>Между контактами, мм</th><th>Заготовка или центр нахлёста от начала детали, мм</th></tr></thead><tbody>${long.join('')}</tbody></table></div></details>`;
}
function roofBedStockSection(){
 const line=MODEL.roof_frame.comparisons.find(row=>row.position==='bed');
 const beds=roofFrameDisplayMembers().filter(m=>m.family==='beds');
 const total=beds.reduce((sum,bed)=>sum+bed.axis_length_mm/1000,0);
 const additional=beds.reduce((sum,bed)=>sum+(bed.additional_to_kd4?bed.axis_length_mm/1000:0),0);
 const rows=beds.map(bed=>{
  const label=esc(roofPartTitle(bed));
  const walls=bed.floor1_projection.hits.filter(hit=>hit.collection==='walls');
  const below=walls.map(w=>esc(w.label)).join(', ')||'Пролёт плиты';
  return `<tr><td>${mode==='frame'?'<button class="link-button" data-frame-stock-member="'+esc(bed.id)+'">'+label+'</button>':label}${bed.additional_to_kd4?' <small>Сверх КД‑4</small>':''}</td><td>${fmt(bed.axis_length_mm)}</td><td>${below}</td></tr>`;
 });
 return `<details data-bed-stock-report><summary>Лежни · ${fmt(total-additional,2)} м в текущей сцене${additional>0?` и ${fmt(additional,2)} м сверх КД‑4`:''}</summary>
  <p>КД‑4 задаёт ${fmt(+line.source_quantity)} м суммарно. Длины отдельных брусьев предложены для 3D.</p>
  <div class="table-wrap"><table><thead><tr><th>Лежень</th><th>Длина, мм</th><th>Под проекцией на первый этаж</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></details>`;
}
function renderRoofFrame(){const m=MODEL.roof_frame;showDialog('ОБЩИЙ КАРКАС / КД-2–4','Геометрия, ведомость и открытые контакты',`<div class="callout"><b>I021 · схема не принята для строительства</b>${m.limitations.map(esc).join('<br>')}</div><div class="buttons-row">${sheetBtn('house_2',22,'План КД-2')}${sheetBtn('house_2',23,'Сечения КД-3')}${sheetBtn('house_2',24,'Ведомость КД-4')}</div>
 <h3>Проёмы и окончания в отображении</h3><p>Мауэрлат показан под опорными скатами. Во фронтонах сплошная линия по периметру прерывается. Видимые брусья обрезаны границей и поверхностью кровли; в спальнях два проёма лежат между парными стропилами КД-2. В ванной рядовое стропило заканчивается на условных перемычках, доходящих до соседних стропил. Оранжевые обрамления50×200 — отдельный условный вариант из сечения стропил. Рабочие усиления, крепёж и передача нагрузок не назначены. Таблица ниже содержит исходные осевые длины и количества по ведомости.</p><h3>Количество геометрии и ведомость</h3><p>Осевая длина считается по концам. Сумма объёмов брусьев = Σ(L×b×h×число досок); узловые пересечения и запилы не вычитаются. Это диагностическое сравнение, исходная ведомость не меняется. Длины стоек 18, лежней и шаг обрешётки 300 мм требуют рабочей проверки.</p><div class="table-wrap"><table><thead><tr><th>Поз.</th><th>Сборок / деталей</th><th>Оси, м</th><th>Σ брусьев, м³</th><th>Количество источника</th><th>Объём источника, м³</th></tr></thead><tbody>${m.comparisons.map(r=>`<tr><td>${esc(r.position)}</td><td>${r.diagram_assemblies} / ${r.diagram_piece_count}</td><td>${fmt(r.diagram_axis_length_m,3)}</td><td>${fmt(r.diagram_prism_sum_m3,4)}</td><td>${r.source_quantity===null?'—':esc(r.source_quantity)+' '+unit(r.source_unit)}</td><td>${factBtn('timber.'+r.position+'.listed_volume',r.source_listed_volume_m3)}</td></tr>`).join('')}</tbody></table></div>
 ${roofRafterStockSection()}
 ${roofBedStockSection()}
 <h3>Опирание стропил на прогоны</h3><p>Прогоны 8 и 10 показаны двумя брусьями по высоте. У боковых граней прямых коньковых прогонов видны геометрические площадки с подрезкой. Расчёт опирания и соединения брусьев остаётся открытым. Неизвестная толщина покрытия остаётся null.</p><div class="table-wrap"><table><thead><tr><th>Прогон</th><th>Низ стропила по оси, мм</th><th>Просвет по оси, мм</th></tr></thead><tbody>${m.contact_checks.map(c=>`<tr><td>${c.position}</td><td>${fmt(c.rafter_lower_reference_mm,3)}</td><td>${fmt(c.axis_clearance_mm,3)}</td></tr>`).join('')}</tbody></table></div>
 <h3>Совмещение и непривязанные параметры</h3>${m.alignment_checks.map(c=>`<p class="check-bad">${esc(c.id)}: ${fmt(c.diagram_mm)} против ${fmt(c.kd_mm)} мм, остаток ${fmt(c.difference_mm)} мм. ${esc(c.formula)}</p>`).join('')}<p>Западная цепь КД-2 включает интервал ${fmt(m.west_row_closure.source_gap_mm)} мм. Первый гаражный ряд получился в ${fmt(m.west_row_closure.garage_eave_offset_mm)} мм от карниза АР-8.</p><p>Северная цепь КД-2 замыкается по осям. Между стропилами у ВК-1 ${factBtn('roof.frame.plan.north_shaft_rafter_span','830 мм')}. Восточная кромка ската по АР-8 смещена на ${fmt(Math.abs(m.north_row_closure.difference_to_ar8_mm))} мм относительно КД-2.</p><p>Позиции 12–17 имеют исходные длины, часть мест определена по плану. Стойки 18 показаны на лежнях. КД-4 задаёт 7 п.м. на обе стойки, длины поштучно остаются открытыми.</p>
 <p>${m.extra_source_fact_ids.map(i=>factBtn(i,FACTS.get(i)?.label)).join('<br>')}</p>`);}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-frame-open]')){if(currentTab==='roof')$('roof-scene-mount').scrollIntoView();else activateTab('model','frame');}
 if(e.target.closest('[data-roof-frame]'))openRoofFrame();
 if(e.target.closest('[data-roof-contacts]'))openRoofContacts();
 const stockMember=e.target.closest('[data-frame-stock-member]');
 if(stockMember){
  $('source-dialog').close();
  const m=roofFrameMember(stockMember.dataset.frameStockMember);
  selectRoofFrameMember(m.id);
  const span=m.post_base_plate?m.height_mm*2.35:m.axis_length_mm*1.25;
  if(m.hold_down_fit)focusFrameZone(roofFrameZones.southHipFoot);
  else focusFramePoint(m.a_mm.map((v,i)=>(v+m.b_mm[i])/2),span);
 }
 const closeup=e.target.closest('[data-frame-point]');
 if(closeup){
  $('source-dialog').close();showFrameContext(true);
  const point=closeup.dataset.framePoint.split(',').map(Number);
  const marker=renderer.resetLayer('frame-contact-marker',[.87,.28,.12],{visible:true,order:26});
  for(let i=0;i<3;i++){
   const a=[...point],b=[...point];a[i]-=85;b[i]+=85;renderer.line(marker,a,b);
  }
  renderer.commitLayer(marker);focusFramePoint(point,1600);
 }
 const memberFocus=e.target.closest('[data-frame-member-focus]');
 if(memberFocus){
  const m=roofFrameMember(memberFocus.dataset.frameMemberFocus),selected=selectedRoofPieces(m);
  const [p]=selected.length===1?selected:frameStockPieces(m);
  const length=p.station_range_mm?Math.hypot(...contactSub(p.b_mm,p.a_mm)):m.axis_length_mm;
  if(m.hold_down_fit)focusFrameZone(roofFrameZones.southHipFoot);
  else focusFramePoint(p.a_mm.map((v,i)=>(v+p.b_mm[i])/2),Math.max(1200,length*1.25));
 }
 const isolate=e.target.closest('[data-frame-isolate]');
 if(isolate){const id=isolate.dataset.frameIsolate;roofFrameState.isolate=roofFrameState.isolate===id?null:id;applyRoofFrameVisibility();inspectRoofFrameMember(id);}
});

/* Measure the convex solids emitted by the viewer, in model millimetres. */
const roofContactTolerance = .01;
const roofContactReports = new Map();
const contactSub = (a,b) => a.map((v,i)=>v-b[i]);
const contactDot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const contactCross = ([x,y,z],[a,b,c]) => [y*c-z*b,z*a-x*c,x*b-y*a];
const roofContactRect=([x0,y0,x1,y1])=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];

function roofContactSolid(id,family,faces){
 const points=faces.flat();
 const centre=[0,1,2].map(i=>points.reduce((sum,p)=>sum+p[i],0)/points.length);
 const bounds=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...points.map(p=>p[i]))));
 const sides=[];
 for(const face of faces){
  const ring=face.map((p,i)=>contactCross(contactSub(p,face[0]),contactSub(face[(i+1)%face.length],face[0])));
  const normal=ring.reduce((a,b)=>a.map((v,i)=>v+b[i]),[0,0,0]);
  const length=Math.hypot(...normal);
  if(length<1e-6)continue;
  const sign=contactDot(normal,contactSub(centre,face[0]))<0?-1:1;
  const inward=normal.map(v=>v*sign/length);
  sides.push({face,plane:[...inward,-contactDot(inward,face[0])]});
 }
 return {id,family,faces,centre,bounds,sides};
}

function roofContactPrism(id,family,foot,bottom,top){
 const low=foot.map(p=>[...p,HouseShapes.z(bottom,p)]),high=foot.map(p=>[...p,HouseShapes.z(top,p)]);
 const faces=[low,high,...foot.map((_,i)=>{const j=(i+1)%foot.length;return [low[i],low[j],high[j],high[i]];})];
 return roofContactSolid(id,family,faces);
}

function roofContactArea(face,normal){
 let twice=0;
 for(let i=1;i+1<face.length;i++)twice+=contactDot(contactCross(contactSub(face[i],face[0]),contactSub(face[i+1],face[0])),normal);
 return Math.abs(twice)/2;
}

function roofConvexVolume(faces,origin){
 let volume=0;
 for(const face of faces)for(let i=1;i+1<face.length;i++){
  volume+=Math.abs(contactDot(contactSub(face[0],origin),contactCross(contactSub(face[i],origin),contactSub(face[i+1],origin))))/6;
 }
 return volume;
}

function clipContactFace(face,plane){
 const output=[];
 for(let i=0;i<face.length;i++){
  const a=face[i],b=face[(i+1)%face.length];
  const x=contactDot(plane.slice(0,3),a)+plane[3],y=contactDot(plane.slice(0,3),b)+plane[3];
  if(x>=-1e-7)output.push(a);
  if((x>=-1e-7)!==(y>=-1e-7))output.push(a.map((v,j)=>v+(b[j]-v)*x/(x-y)));
 }
 return output;
}

function* roofCommonFaces(a,b){
 for(const first of a.sides)for(const second of b.sides){
  const normal=first.plane.slice(0,3);
  if(contactDot(normal,second.plane.slice(0,3))>-.99999999||Math.abs(first.plane[3]+second.plane[3])>roofContactTolerance)continue;
  const polygon=b.sides.reduce((face,{plane})=>clipContactFace(face,plane),first.face);
  const area=roofContactArea(polygon,normal);
  if(area>roofContactTolerance**2)yield {normal,polygon,area};
 }
}

function measureRoofContact(a,b,projectStation){
 const tolerance=roofContactTolerance;
 const spans=[0,1,2].map(i=>Math.min(a.bounds[i+3],b.bounds[i+3])-Math.max(a.bounds[i],b.bounds[i]));
 if(spans.some(v=>v < -tolerance))return null;
 if(spans.every(v=>v>tolerance)){
  const intersection=b.sides.reduce((faces,side)=>clipDisplaySolid(faces,side.plane),a.faces);
  const vertices=intersection.flat();
  if(vertices.length){
   const points=[0,1,2].map(i=>vertices.reduce((sum,p)=>sum+p[i],0)/vertices.length);
   // Require a point inside both solids by the model tolerance before
   // reporting a positive volume. This suppresses floating-point slivers.
   if([...a.sides,...b.sides].every(({plane})=>contactDot(plane.slice(0,3),points)+plane[3]>tolerance)){
    const volume=roofConvexVolume(intersection,points);
    if(volume>0){
     const bounds=[0,1,2].map(i=>Math.min(...vertices.map(p=>p[i])))
      .concat([0,1,2].map(i=>Math.max(...vertices.map(p=>p[i]))));
     return {volume_mm3:volume,area_mm2:0,point_mm:points,overlap_bounds_mm:bounds};
    }
   }
  }
 }
 let area=0,point=null,stationMin=Infinity,stationMax=-Infinity;
 for(const {polygon,area:overlap} of roofCommonFaces(a,b)){
  area+=overlap;
  point=polygon[0];
  if(projectStation)for(const vertex of polygon){
   const station=projectStation(vertex);
   stationMin=Math.min(stationMin,station);
   stationMax=Math.max(stationMax,station);
  }
 }
 if(!area)return null;
 const hit={volume_mm3:0,area_mm2:area,point_mm:point};
 if(projectStation)hit.station_range_mm=[stationMin,stationMax];
 return hit;
}

/* Roof-cut courses: convex prisms preserve slopes and source opening voids.
 * Stock keys group the fragments of one block split by roof-cell boundaries.
 */
'use strict';
const HouseShapes=(()=>{
 const z=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2];
 function clip(poly,plane){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=z(plane,a),fb=z(plane,b),ia=fa>=-1e-7,ib=fb>=-1e-7;if(ia)out.push(a);if(ia!==ib){const t=fa/(fa-fb);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out.filter((p,i)=>!i||Math.hypot(...p.map((v,k)=>v-out[i-1][k]))>1e-6);}
 const diff=(a,b)=>a.map((v,i)=>v-b[i]);
 const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
 function prism(g,l,piece,id){const p=piece.polygon_mm,lo=p.map(q=>[...q,z(piece.bottom_plane,q)]),hi=p.map(q=>[...q,z(piece.top_plane,q)]);g.face(l,hi,null,id);g.face(l,[...lo].reverse(),null,id);for(let i=0;i<p.length;i++){const j=(i+1)%p.length;g.face(l,[lo[i],lo[j],hi[j],hi[i]],null,id);g.line(l,lo[i],lo[j]);g.line(l,hi[i],hi[j]);g.line(l,lo[i],hi[i]);}}
 function upperCourses(model,{length=625,height=250,joint=2,bed=20}={}){
  if(![length,height,joint,bed].every(Number.isFinite)||height<50||height>500||length<100||joint<1||joint>3||bed<0||bed>100)throw Error('Проверьте параметры кладки.');
  const base=model.display_parameters.base_mm,maxTop=Math.max(...model.mesh_prisms.flatMap(p=>p.polygon_mm.map(q=>z(p.top_plane,q)))),rows=[];
  const walls=new Map(model.walls.map(w=>[w.id,w]));let index=0;
  for(let bottom=base+bed;bottom<maxTop-1e-6;bottom+=height+joint){index++;const top=Math.min(maxTop,bottom+height),pieces=[],stocks=new Set();
   for(const mesh of model.mesh_prisms){if(mesh.material!=='aac')continue;const wall=walls.get(mesh.wall_id),axis=wall.axis,cross=1-axis,bounds=wall.bounds_mm.map(Number),start=bounds[axis],end=bounds[axis+2],module=length+joint,phase=index%2?0:module/2;
    for(let at=start-phase;at<end-1e-6;at+=module){let poly=mesh.polygon_mm;poly=clip(poly,axis===0?[1,0,-Math.max(start,at)]:[0,1,-Math.max(start,at)]);poly=clip(poly,axis===0?[-1,0,Math.min(end,at+length)]:[0,-1,Math.min(end,at+length)]);if(poly.length<3||area(poly)<1e-4)continue;
     const lows=[[mesh.bottom_plane,clip(poly,diff(mesh.bottom_plane,[0,0,bottom]))],[[0,0,bottom],clip(poly,diff([0,0,bottom],mesh.bottom_plane))]];
     // Equal planes belong to one partition to avoid duplicate volumes.
     if(mesh.bottom_plane[0]===0&&mesh.bottom_plane[1]===0){lows.splice(0,lows.length,[mesh.bottom_plane[2]>=bottom?mesh.bottom_plane:[0,0,bottom],poly]);}
     for(const [lo,pp]of lows){if(pp.length<3||area(pp)<1e-4)continue;const highs=[[mesh.top_plane,clip(pp,diff([0,0,top],mesh.top_plane))],[[0,0,top],clip(pp,diff(mesh.top_plane,[0,0,top]))]];
      if(mesh.top_plane[0]===0&&mesh.top_plane[1]===0)highs.splice(0,highs.length,[mesh.top_plane[2]<=top?mesh.top_plane:[0,0,top],pp]);
      for(const [hi,foot]of highs){const polygon=clip(foot,diff(hi,lo));if(polygon.length<3||area(polygon)<1e-4)continue;const heights=polygon.map(q=>z(hi,q)-z(lo,q));if(Math.max(...heights)<1e-5)continue;const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),zs=polygon.map(p=>z(lo,p)),ze=polygon.map(p=>z(hi,p)),stock=`upper:${index}:${wall.id}:${Math.round(at*1000)}`,id=stock+':'+pieces.length;
       pieces.push({id,stock_key:stock,roof_cap_id:mesh.roof_cap_id||mesh.roof_cell_id,wall_id:wall.id,axis,polygon_mm:polygon,bottom_plane:lo,top_plane:hi,bounds_mm:[Math.min(...xs),Math.min(...ys),Math.min(...zs),Math.max(...xs),Math.max(...ys),Math.max(...ze)],cut:at<start||at+length>end||Math.min(...heights)<height-.01,volume_m3:area(polygon)*heights.reduce((s,v)=>s+v,0)/heights.length/1e9});stocks.add(stock);
      }
     }
    }
   }
   rows.push({index,z_mm:bottom,top_mm:top,pieces,stock_positions:stocks.size});
  }
  // Integrate every polygon by triangles: vertex-average is valid per triangle.
  let volume=0;for(const row of rows)for(const p of row.pieces){let pv=0;for(const tri of HouseGL.triangulate(p.polygon_mm)){const pp=tri.map(i=>p.polygon_mm[i]);pv+=area(pp)*pp.reduce((s,q)=>s+z(p.top_plane,q)-z(p.bottom_plane,q),0)/3/1e9;}p.volume_m3=pv;volume+=pv;}
  return {status:'conditional_roof_cut_course_scenario',accepted_for_construction:false,parameters:{length,height,joint,bed,base,top:maxTop},rows,fragment_count:rows.reduce((s,r)=>s+r.pieces.length,0),stock_positions:rows.reduce((s,r)=>s+r.stock_positions,0),net_block_geometry_m3:volume,bond_audit:{status:'not_verified_at_roof_cuts_and_junctions'},limitations:['Профиль оболочки до кровли — параметр просмотра, не рабочая высота кладки.','Сетка625×250, шов/постель, крайние подрезки и углы требуют монтажной проверки.','Пояса, верхние перемычки и запилы не назначены этим сценарием.','Части одного stock_key могут лежать в нескольких ячейках кровли; это одна условная позиция блока, не несколько закупочных блоков.']};
 }
 function subtract(poly,cut){let inside=poly,out=[];const orientation=cut.reduce((s,a,i)=>{const b=cut[(i+1)%cut.length];return s+a[0]*b[1]-b[0]*a[1];},0)>0?1:-1;for(let i=0;i<cut.length&&inside.length>=3;i++){const a=cut[i],b=cut[(i+1)%cut.length],dx=b[0]-a[0],dy=b[1]-a[1],plane=[-dy*orientation,dx*orientation,(dy*a[0]-dx*a[1])*orientation],outside=clip(inside,plane.map(v=>-v));if(outside.length>=3&&area(outside)>1e-5)out.push(outside);inside=clip(inside,plane);}return out;}
 return {z,clip,area,prism,upperCourses,subtract};
})();
window.HouseShapes=HouseShapes;

/* Sanitary fixtures are an explicit interior scenario, not PDF dimensions.
 * Shared material batches keep their draw-call cost independent of item count. */
'use strict';
function drawSanitaryFixtures(g){
 const names={toilet:'Унитаз',basin:'Раковина с тумбой',sink:'Кухонная мойка',bathtub:'Ванна',shower:'Душевая зона'};g.fixtureBounds=[];
 for(const floor of [1,2]){
  const visible=['house','services3d','floor'+floor].includes(mode),order=floor===1?1:3;
  const ceramic=g.addLayer('fixtures'+floor,[.92,.93,.89],{visible,explodeOrder:order,showEdges:false}),metal=g.addLayer('fixtureMetal'+floor,[.50,.57,.59],{visible,explodeOrder:order,showEdges:false}),water=g.addLayer('fixtureWater'+floor,[.28,.60,.68],{visible,explodeOrder:order,opacity:.45,order:28,showEdges:false}),wood=g.addLayer('fixtureCabinet'+floor,[.56,.43,.29],{visible,explodeOrder:order,showEdges:false});
  for(const f of MODEL.experience.sanitary_fixtures||[]){const room=MODEL.experience.rooms.find(r=>r.id===f.room_id);if(room.floor!==floor)continue;const id='fixture:'+f.id,z0=room.elevation_mm,map=p=>fixturePoint(f,z0,p),face=(l,p)=>g.face(l,p.map(map),null,id),box=(l,x0,y0,z0,x1,y1,z1)=>{const p=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];for(const a of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])face(l,a.map(i=>p[i]));},tube=(l,a,b,r=12)=>g.tube(l,map(a),map(b),r,10,id);
   const ellipse=(x,y,z,rx,ry)=>Array.from({length:24},(_,i)=>[x+rx*Math.cos(i*Math.PI/12),y+ry*Math.sin(i*Math.PI/12),z]),join=(l,a,b)=>{for(let i=0;i<a.length;i++){const j=(i+1)%a.length;face(l,[a[i],a[j],b[j],b[i]]);}},disk=(l,p)=>{for(let i=1;i<p.length-1;i++)face(l,[p[0],p[i],p[i+1]]);};
   if(f.type==='toilet'){
    join(ceramic,ellipse(0,0,0,100,140),ellipse(0,30,280,130,165));
    join(ceramic,ellipse(0,60,250,125,145),ellipse(0,70,430,210,270));
    const rim=ellipse(0,70,445,210,270),inner=ellipse(0,70,445,150,200);join(ceramic,ellipse(0,70,430,210,270),rim);join(ceramic,rim,inner);join(ceramic,inner,ellipse(0,70,315,80,115));disk(water,ellipse(0,70,320,80,115));
    box(ceramic,-180,-340,430,180,-150,780);box(ceramic,-190,-345,780,190,-145,800);box(metal,-35,-280,800,35,-230,805);
   }else if(f.type==='basin'||f.type==='sink'){
    const w=f.size_mm[0],d=f.size_mm[1];box(wood,-w/2+20,-d/2+20,0,w/2-20,d/2-20,730);
    join(ceramic,ellipse(0,10,765,w*.34,d*.28),ellipse(0,10,850,w/2,d/2));join(ceramic,ellipse(0,10,850,w/2,d/2),ellipse(0,10,850,w*.36,d*.31));join(ceramic,ellipse(0,10,850,w*.36,d*.31),ellipse(0,10,775,w*.22,d*.15));join(ceramic,ellipse(0,10,775,w*.22,d*.15),ellipse(0,10,775,27,27));join(metal,ellipse(0,10,775,27,27),ellipse(0,10,775,17,17));disk(water,ellipse(0,10,780,w*.22,d*.15));
    tube(metal,[0,-d*.34,840],[0,-d*.34,1060],16);tube(metal,[0,-d*.34,1060],[0,0,1060],14);tube(metal,[0,0,1060],[0,0,1020],14);box(metal,-70,d/2-14,650,70,d/2+2,665);
   }else if(f.type==='bathtub'){
    const rx=f.size_mm[0]/2,ry=f.size_mm[1]/2;join(ceramic,ellipse(0,0,0,rx*.85,ry*.92),ellipse(0,0,580,rx,ry));join(ceramic,ellipse(0,0,580,rx,ry),ellipse(0,0,580,rx-65,ry-65));join(ceramic,ellipse(0,0,580,rx-65,ry-65),ellipse(0,0,280,rx-120,ry-140));join(ceramic,ellipse(0,0,280,rx-120,ry-140),ellipse(0,-ry*.64,280,27,27));join(metal,ellipse(0,-ry*.64,280,27,27),ellipse(0,-ry*.64,280,17,17));disk(water,ellipse(0,0,420,rx-90,ry-100));tube(metal,[0,-ry+100,580],[0,-ry+100,800],16);tube(metal,[0,-ry+100,800],[0,-ry+300,800],14);
   }else if(f.type==='shower'){
    const a=f.size_mm[0]/2,b=f.size_mm[1]/2;box(ceramic,-a,-b,0,a,b,25);for(const [x0,y0,x1,y1]of [[-a,-b,a,-b+45],[-a,b-45,a,b],[-a,-b,-a+45,b],[a-45,-b,a,b]])box(ceramic,x0,y0,25,x1,y1,80);box(metal,-45,-45,25,45,45,30);
    face(water,[[-a,-b,80],[a,-b,80],[a,-b,2000],[-a,-b,2000]]);face(water,[[-a,-b,80],[-a,b,80],[-a,b,2000],[-a,-b,2000]]);
    for(const [x,y]of [[-a,-b],[a,-b],[-a,b]])tube(metal,[x,y,80],[x,y,2000],10);tube(metal,[0,-b+50,850],[0,-b+50,2000],16);tube(metal,[0,-b+50,2000],[0,-b+250,2000],14);box(metal,-100,-b+150,2000,100,-b+350,2025);
   }
   const [w,d,h]=f.size_mm,foot=[[-w/2,-d/2,0],[w/2,-d/2,0],[w/2,d/2,0],[-w/2,d/2,0]].map(map),bounds=[Math.min(...foot.map(p=>p[0])),Math.min(...foot.map(p=>p[1])),z0,Math.max(...foot.map(p=>p[0])),Math.max(...foot.map(p=>p[1])),z0+h];g.fixtureBounds.push({id,room_id:room.id,floor,bounds_mm:bounds});
   expInfo(g,id,{title:names[f.type]+' · '+room.name,status:f.status,facts:f.input_fact_ids,note:f.note+` Условный габарит ${f.size_mm.join('×')} мм.`});
  }
 }
}

/* The sauna and appliances are owner-requested interior options. Their meshes,
 * clearances and service ports describe this scene only. */
'use strict';
function cookerPort(){
 const c=MODEL.experience.cooker,[x,y]=c.centre_xy_mm,[w,d]=c.size_mm;
 return [x+w/4,y-d/2,460];
}
function drawCookerGas(g,gas,route){
 const walls=MODEL.floor1.walls.filter(w=>w.id.startsWith('ext'));
 const runs=[15,0,1,2,3,4,5,6].map(i=>{
  const r=facadeRun(walls,extNormals,i);return {...r,line:r.face+r.sign*85};
 });
 const startY=8100,z=2690,port=cookerPort(),first=runs[0],last=runs.at(-1);
 const points=[[Number(first.wall.bounds_mm[2])+36,startY,850],[Number(first.wall.bounds_mm[2])+36,startY,z],[first.line,startY,z]];
 for(let i=1;i<runs.length;i++){
  const a=runs[i-1],b=runs[i],corner=[0,0,z];corner[a.cross]=a.line;corner[b.cross]=b.line;points.push(corner);
 }
 const kitchenWall=Number(last.wall.bounds_mm[3]);
 points.push([port[0],last.line,z],[port[0],kitchenWall+15,z],[port[0],kitchenWall+15,port[2]],port);
 route(gas,'pipe:gas-cooker',points,12,'Газ · от котельной до кухонной плиты',[],MODEL.experience.service_scenario.indoor.gas_note,{network:'gas',floor:1});
 // Short stand-offs connect the long visible facade lengths to the facing.
 for(const [i,run] of runs.entries()){
  const a=points[i+2],b=points[i+3],length=Math.abs(b[run.axis]-a[run.axis]);
  const count=Math.ceil(length/1800);
  for(let j=0;j<count;j++){
   const clamp=a.map((v,k)=>v+(b[k]-v)*(j+.5)/count),foot=[...clamp];foot[run.cross]=run.face;
   g.tube(gas,foot,clamp,8,8,'pipe:gas-cooker');
  }
 }
}
function drawAppliances(g){
 const show=['house','floor1','services3d'].includes(mode);
 if(!show)return;
 const body=addLayer(g,'appliances',{explodeOrder:1,showEdges:false}),trim=addLayer(g,'applianceTrim',{explodeOrder:1,showEdges:false});
 const block=(l,id,x,y,z,X,Y,Z)=>g.box(l,x,y,z,X,Y,Z,id,false);
 const [hx,hy]=MODEL.experience.service_scenario.indoor.heater_xy_mm,tank='pipe:heater';
 const z0=750,z1=1430,r=175;
 const cap=z=>Array.from({length:32},(_,i)=>[hx+r*Math.cos(i*Math.PI/16),hy+r*Math.sin(i*Math.PI/16),z]);
 g.tube(body,[hx,hy,z0],[hx,hy,z1],r,32,tank);g.face(body,cap(z0).reverse(),[0,0,-1],tank);g.face(body,cap(z1),[0,0,1],tank);
 block(trim,tank,hx-45,hy-r-5,991,hx+45,hy-r+8,1100);
 block(trim,tank,hx-75,hy+145,1050,hx+75,hy+183,1110);
 expInfo(g,tank,{title:'Накопительный водонагреватель · котельная',status:'user_design_scenario',facts:[],note:'Настенный бак. Подвод холодной воды и выход горячей расположены снизу. Ёмкость и мощность подлежат подбору.'});
 const c=MODEL.experience.cooker,[x,y]=c.centre_xy_mm,[w,d,h]=c.size_mm,id='appliance:cooker';
 block(body,id,x-w/2,y-d/2,5,x+w/2,y+d/2,h);
 block(trim,id,x-233,y+d/2,160,x+233,y+d/2+8,595);
 block(trim,id,x-195,y+d/2+10,632,x+195,y+d/2+29,653);
 for(const dx of [-145,145])for(const dy of [-145,145]){
  const p=[x+dx,y+dy,h+3];g.tube(trim,p,[p[0],p[1],h+16],65,16,id);
  for(const [ax,ay] of [[85,0],[0,85]])g.tube(trim,[p[0]-ax,p[1]-ay,h+18],[p[0]+ax,p[1]+ay,h+18],7,8,id);
 }
 const port=cookerPort();g.tube(trim,port,[port[0],port[1]+15,port[2]],17,10,id);
 expInfo(g,id,{title:'Газовая плита · кухня',status:c.status,facts:['room.2.name'],note:'Вариант расстановки. Подвод газа подходит к задней стороне плиты.'});
 g.interiorObstacles.push([x-w/2,y-d/2,5,x+w/2,y+d/2,h],[hx-r,hy-r,z0,hx+r,hy+r,z1]);
}
function drawSauna(g){
 const room=MODEL.experience.rooms.find(r=>r.id===MODEL.experience.sauna.room_id);
 const [[x0,y0],[x1],[,y1]]=room.polygon_mm,door=MODEL.floor1.openings.find(o=>o.id==='d-sauna').bounds_mm.map(Number);
 const id='sauna:lining',bench='sauna:benches',heater='sauna:electric-heater';
 const timber=addLayer(g,'saunaWood',{explodeOrder:1,showEdges:false}),seat=addLayer(g,'saunaBenches',{explodeOrder:1,showEdges:false}),metal=addLayer(g,'saunaStove',{explodeOrder:1,showEdges:false}),stone=addLayer(g,'saunaStones',{explodeOrder:1,showEdges:false});
 const box=(l,key,x,y,z,X,Y,Z)=>g.box(l,x,y,z,X,Y,Z,key,false);
 const plankWall=(alongX,lo,hi,cross,sign,base=8)=>{
  const count=Math.ceil((hi-lo)/105),pitch=(hi-lo)/count;
  for(let i=0;i<count;i++){
   const v=lo+i*pitch+1.3,V=lo+(i+1)*pitch-1.3,c=cross+sign*3,C=cross+sign*17;
   const a=Math.min(c,C),b=Math.max(c,C);
   if(alongX)box(timber,id,v,a,base,V,b,2310);else box(timber,id,a,v,base,b,V,2310);
  }
 };
 plankWall(true,x0+18,x1-18,y0,1);plankWall(false,y0,y1,x0,1);plankWall(false,y0,y1,x1,-1);
 plankWall(true,x0+18,door[0],y1,-1);plankWall(true,door[3],x1-18,y1,-1);plankWall(true,door[0],door[3],y1,-1,door[5]+6);
 const end=x1-720;
 for(const [z,y,depth,count] of [[860,y0+23,480,6],[435,y0+505,280,4]]){
  const pitch=depth/count;
  for(let i=0;i<count;i++)box(seat,bench,x0+26,y+i*pitch,z-35,end,y+(i+1)*pitch-5,z);
  for(const x of [x0+66,end-85])for(const cy of [y+24,y+depth-66])box(timber,bench,x,cy,3,x+48,cy+45,z-35);
  box(timber,bench,x0+30,y+depth-53,z-97,end-4,y+depth-16,z-35);
 }
 for(const z of [1080,1210])box(seat,bench,x0+35,y0+20,z,end,y0+51,z+86);
 const cx=x1-310,cy=y0+325;
 box(metal,heater,cx-180,cy-161,105,cx+180,cy+161,715);
 for(const x of [cx-129,cx+94])box(metal,heater,x,cy-125,4,x+35,cy+125,105);
 for(let i=0;i<5;i++)box(stone,heater,cx-131,cy+161,260+i*58,cx+131,cy+167,272+i*58);
 for(let i=0;i<12;i++){
  const x=cx-123+(i%4)*80+8*Math.sin(i),y=cy-91+Math.floor(i/4)*89,z=720+8*Math.cos(i),r=43+4*Math.sin(2*i);
  const ring=Array.from({length:7},(_,j)=>[x+r*Math.cos(j*2*Math.PI/7+i),y+r*.86*Math.sin(j*2*Math.PI/7+i),z]);
  for(const [j,a] of ring.entries())g.face(stone,[a,ring[(j+1)%7],[x-6,y+4,z+30+(i%3)*5]],null,heater);
 }
 for(const [key,title] of [[id,'Вагонка'],[bench,'Двухъярусный полок'],[heater,'Электрическая каменка с камнями']])
  expInfo(g,key,{title:title+' · сауна',status:MODEL.experience.sauna.status,facts:room.source_fact_ids,note:'Вариант обстановки сауны № 6. Модель каменки, мощность и монтажные размеры подлежат подбору.'});
 g.interiorObstacles.push([x0,y0,0,end,y0+785,860],[cx-180,cy-161,4,cx+180,cy+161,760]);
}

/* Indoor services are a proposed layout. Fixture ports and the fixture meshes
 * use the same local coordinates; VK-1 supplies the positions at the slab. */
'use strict';
const indoorPipeLayers=['fixtureDrains','coldDistribution','hotDistribution','gasDistribution'];
const servicePipeLayers=['sewer3d','water3d','sleeves3d','septic3d',...indoorPipeLayers];
const fixtureNames={toilet:'Унитаз',sink:'Мойка',basin:'Раковина',bathtub:'Ванна',shower:'Душ'};
const pipeCircuits={all:servicePipeLayers,waste:['fixtureDrains','sewer3d','septic3d'],cold:['water3d','coldDistribution'],hot:['hotDistribution'],gas:['gasDistribution']};
function plumbingControls(){
 const options=MODEL.experience.sanitary_fixtures.map(f=>{const room=MODEL.experience.rooms.find(r=>r.id===f.room_id);return `<option value="${esc(f.id)}">${room.floor} этаж · ${esc(room.name)} · ${fixtureNames[f.type]}</option>`;});
 return `<div class="service-scenario-controls"><label>Показать сеть<select id="pipe-circuit"><option value="all">Все трубы</option><option value="waste">Канализация</option><option value="cold">Холодная вода</option><option value="hot">Горячая вода</option><option value="gas">Газ к плите</option></select></label><label>Приблизить прибор<select id="pipe-fixture"><option value="">Дом целиком</option>${options.join('')}</select></label></div>`;
}
function bindPlumbingControls(g){
 const circuit=$('pipe-circuit'),focus=$('pipe-fixture');if(!circuit)return;
 circuit.value=g.pipeCircuit||'all';focus.value=g.pipeFocus||'';
 circuit.onchange=()=>{g.pipeCircuit=circuit.value;for(const id of servicePipeLayers)g.layers.get(id).visible=pipeCircuits[circuit.value].includes(id);g.request();renderLayerControls();};
 focus.onchange=()=>{g.pipeFocus=focus.value;const f=MODEL.experience.sanitary_fixtures.find(f=>f.id===focus.value);if(!f){g.home('services3d');return;}
  const room=MODEL.experience.rooms.find(r=>r.id===f.room_id);g.target=[...f.centre_xy_mm,room.elevation_mm+200];g.span=3200*g.fitAspect();g.pan=[0,0];g.request();};
}
function fixturePoint(f,z0,p){
 const angle=f.rotation_deg*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
 return [f.centre_xy_mm[0]+p[0]*co-p[1]*si,f.centre_xy_mm[1]+p[0]*si+p[1]*co,z0+p[2]];
}
function fixturePorts(f,z0){
 const [w,d]=f.size_mm;let waste,mixer;
 switch(f.type){
 case 'toilet': waste=[0,0,0];mixer=[-w*.38,-240,555];break;
 case 'shower': waste=[0,0,25];mixer=[0,-d/2+50,850];break;
 case 'bathtub': waste=[0,-d*.32,280];mixer=[0,-d/2+100,580];break;
 default: waste=[0,10,775];mixer=[0,-d*.34,840];
 }
 const at=p=>fixturePoint(f,z0,p),cold=at([mixer[0]+(f.type==='toilet'?0:9),mixer[1],mixer[2]]);
 return {waste:at(waste),cold,hot:f.type==='toilet'?null:at([mixer[0]-9,mixer[1],mixer[2]])};
}
// Sweep a continuous ring through each socket bend. Independent open-ended
// cylinders otherwise leave triangular gaps outside even a simple elbow.
function drawPipeRun(g,layer,input,radius,id){
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const p=input.filter((v,i)=>!i||dist(v,input[i-1])>.001);if(p.length<2)return;
 const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),samples=[p[0]];
 for(let i=1;i<p.length-1;i++){
  const a=p[i-1],b=p[i],c=p[i+1],ab=dist(a,b),bc=dist(b,c),bend=Math.min(radius*1.8,ab*.35,bc*.35);
  const start=mix(b,a,bend/ab),end=mix(b,c,bend/bc);samples.push(start);
  for(let j=1;j<=4;j++){const t=j/4;samples.push(mix(mix(start,b,t),mix(b,end,t),t));}
 }
 samples.push(p.at(-1));
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(v=>v/Math.hypot(...a));
 let across=null,prev=null;const sides=12;
 for(let i=0;i<samples.length;i++){
  const point=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],direction=unit(b.map((v,k)=>v-a[k]));
  if(!across)across=Math.abs(direction[2])<.9?[0,0,1]:[1,0,0];
  const side=unit(cross(direction,across));across=unit(cross(side,direction));
  const ring=Array.from({length:sides},(_,k)=>{const t=2*Math.PI*k/sides;return point.map((v,j)=>v+radius*(across[j]*Math.cos(t)+side[j]*Math.sin(t)));});
  if(prev)for(let k=0;k<sides;k++){const j=(k+1)%sides;g.face(layer,[prev[k],prev[j],ring[j],ring[k]],null,id);}
  else g.face(layer,ring.slice().reverse(),direction.map(v=>-v),id);
  if(i===samples.length-1)g.face(layer,ring,direction,id);
  prev=ring;
 }
 // Socket with a visible shoulder on the downstream end of a waste branch.
 if(radius>=24){const a=p.at(-2),b=p.at(-1),len=dist(a,b),neck=mix(b,a,Math.min(1.05*radius,len*.22)/len);g.tube(layer,neck,b,radius*1.13,sides,id);}
}
function drawIndoorPlumbing(g,visible,waterEntry,route){
 const config=MODEL.experience.service_scenario.indoor;
 const waste=g.resetLayer('fixtureDrains',[.57,.40,.29],{visible,showEdges:false}),cold=g.resetLayer('coldDistribution',[.18,.50,.73],{visible,showEdges:false}),hot=g.resetLayer('hotDistribution',[.79,.26,.20],{visible,showEdges:false}),gas=g.resetLayer('gasDistribution',[.91,.65,.13],{visible,showEdges:false});
 if(!['house','floor1','floor2','services3d'].includes(mode))return;
 const floors=mode==='floor1'?[1]:mode==='floor2'?[2]:[1,2];
 const rooms=new Map(MODEL.experience.rooms.map(r=>[r.id,r]));
 const fixtures=MODEL.experience.sanitary_fixtures.map(f=>{const room=rooms.get(f.room_id);return {f,room,ports:fixturePorts(f,room.elevation_mm)};});
 const shafts=new Map(MODEL.services.filter(s=>s.id.startsWith('К1-')).map(s=>[s.id,s]));
 const zSlab=Number(MODEL.slab2.bottom_mm),zFloor=n('level.floor_2.elevation')*1000;
 const stacked=new Map(),stackBranches=new Map(),slope=experience.sewerSlope/100;
 for(const {f,room,ports} of fixtures){
  const stack=config.fixture_stacks[f.id],site=shafts.get(stack),xy=[Number(site.x_mm),Number(site.y_mm)];
  if(!floors.includes(room.floor))continue;
  const prefix='pipe:fixture:'+f.id,large=f.type==='toilet',radius=(large?Number(site.diameter):config.waste_branch_mm)/2;
  let outlet=ports.waste;
  if(!large){
   const trapDepth=f.type==='shower'?80:f.type==='bathtub'?110:150;
   const z=room.elevation_mm,localY=f.type==='shower'?0:f.type==='bathtub'?-f.size_mm[1]*.32:10,base=outlet[2]-z;
   const trap=[[0,localY,base],[0,localY,base-trapDepth],[0,localY-55,base-trapDepth],[0,localY-95,base-trapDepth+42],[0,localY-160,base-trapDepth+42]].map(p=>fixturePoint(f,z,p));
   route(waste,prefix+':trap',trap,radius,'Сифон · '+room.name,room.source_fact_ids,'Визуальный вариант гидрозатвора.',{fixture_id:f.id,network:'trap',floor:room.floor});outlet=trap.at(-1);
  }
  // Turn along the wet wall before entering the stack. The level of each
  // upstream vertex uses the remaining plan length, not the XY distance.
  const key=room.floor+':'+stack,branch=stackBranches.get(key)||0;stackBranches.set(key,branch+1);
  const start=outlet.slice(0,2),dx=Math.abs(start[0]-xy[0]),dy=Math.abs(start[1]-xy[1]);
  // If a leg is shorter than the socket, sweep directly into the joint.
  const landing=Math.min(dx,dy)<radius?[start,xy]:[start,[start[0],xy[1]],xy];
  const length=landing.reduce((sum,p,i)=>i?sum+Math.hypot(p[0]-landing[i-1][0],p[1]-landing[i-1][1]):sum,0);
  const serviceLevel=room.floor===2?zSlab-265:-265;
  const preferred=serviceLevel-branch*135;
  const joinZ=Math.min(preferred,serviceLevel-length*slope,outlet[2]-length*slope-45);
  if(room.floor===2)stacked.set(stack,Math.max(stacked.get(stack)??-Infinity,joinZ));
  let z=joinZ;
  const graded=landing.map(p=>[...p,0]);
  for(let i=graded.length-1;i>=0;i--){graded[i][2]=z;if(i)z+=Math.hypot(landing[i][0]-landing[i-1][0],landing[i][1]-landing[i-1][1])*slope;}
  route(waste,prefix+':waste',[outlet,...graded],radius,fixtureNames[f.type]+' · слив в '+stack,site.input_fact_ids,'От прибора к стояку. Подключение, диаметр внутренней ветви и отметки показаны как вариант.',{fixture_id:f.id,network:'waste',stack,floor:room.floor});
 }
 // The indoor riser meets the vertical portion of the existing VK-1 pipe
 // at zero. Ground-floor branches join that same line below the finished floor.
 for(const [stack,z] of stacked){if(!floors.includes(2))continue;const s=shafts.get(stack),xy=[Number(s.x_mm),Number(s.y_mm)];route(waste,'pipe:riser:'+stack,[[...xy,z],[...xy,0]],Number(s.diameter)/2,'Стояк · '+stack,s.input_fact_ids,'Положение прохода по ВК-1. Продолжение стояка до подключений мансарды условное.',{network:'stack',stack});}
 const [hx,hy]=config.heater_xy_mm,inlet=[hx-60,hy,750],outlet=[hx+60,hy,750];
 const waterFacts=MODEL.services.find(s=>s.id==='В1-1').input_fact_ids;
 const waterRoute=(layer,id,p,d,title,meta)=>route(layer,'pipe:'+id,p,d/2,title,waterFacts,config.routing_note,meta);
 const walls=floor=>Object.fromEntries(MODEL['floor'+floor].walls.map(w=>[w.id,w.bounds_mm.map(Number)]));
 const ground=walls(1),upper=walls(2);
 const boilerWall=ground.bearingЕ[1],tee=[hx-170,boilerWall-35,145];
 if(floors.includes(1)){
  // The alternative VK-1 entry is on the other side of the exterior door.
  // Cross below its threshold in the lowered boiler-room floor.
  const [ex,ey]=waterEntry,back=tee[1],entry=[[ex,ey,0]];
  if(ey<ground.boiler[3]-1000)entry.push([ex+35,ey,0],[ex+35,ey,-448],[ex+35,back,-448],[ex+35,back,145]);
  else entry.push([ex,ey,145],[ex,back,145]);
  waterRoute(cold,'indoor-inlet',[...entry,tee],config.water_riser_mm,'Холодная вода · от ввода В1',{network:'cold'});
  waterRoute(cold,'heater-inlet',[tee,[tee[0],tee[1],580],[inlet[0],tee[1],580],[inlet[0],hy,580],inlet],config.water_riser_mm,'Подвод холодной воды к водонагревателю',{network:'cold'});
  drawCookerGas(g,gas,route);
 }
 for(const [net,layer,label,feed] of [['cold',cold,'ХВС',tee],['hot',hot,'ГВС',outlet]]){
  const warm=net==='hot',offset=warm?66:35,rx=config.water_riser_xy_mm[0]+(warm?260:0),ry=config.water_riser_xy_mm[1]+(warm?30:0);
  const boilerY=boilerWall-offset,feedZ=warm?220:145;
  const low=warm?-75:-35,high=zFloor+low;
  if(floors.includes(1)){
   const lead=warm?[feed,[feed[0],hy,feedZ],[feed[0],boilerY,feedZ]]:[feed];
   waterRoute(layer,net+'-feed',[...lead,[rx,boilerY,feedZ],[rx,boilerY,low],[rx,ry,low]],config.water_riser_mm,label+' · вдоль стены котельной',{network:net,floor:1});
  }
  if(floors.includes(1)){
   // Mount the exposed pair on the boiler-room wall. The shorter pipework
   // at the tank and the concealed floor runs use their own connections.
   const end=ground.boiler[0],length=end-feed[0],count=Math.ceil(length/850);
   for(let i=0;i<count;i++){
    const x=feed[0]+length*(i+.5)/count;
    g.tube(layer,[x,boilerWall,feedZ],[x,boilerY,feedZ],6,8,'pipe:'+net+'-feed');
   }
  }
  waterRoute(layer,net+'-riser',[[rx,ry,floors.includes(1)?low:zSlab],[rx,ry,floors.includes(2)?high:zSlab]],config.water_riser_mm,label+' · пристенный стояк',{network:net});
  for(const floor of floors){
   const z=floor===1?low:high;
   const trunk=(id,xy)=>waterRoute(layer,net+'-'+id,xy.map(p=>[...p,z]),config.water_riser_mm,label+' · магистраль вдоль стен',{network:net,floor});
   // Each branch takes off perpendicular to a wall run and rises at the
   // back of the appliance. The two short tails reach its actual mixer ports.
   const branch=(id,from,via=[])=>{
    const {f,room,ports}=fixtures.find(t=>t.f.id===id),end=ports[net];if(!end)return;
    const localX=f.type==='toilet'?-f.size_mm[0]*.38:warm?-75:75,localY=-f.size_mm[1]/2-25+offset;
    const behind=fixturePoint(f,0,[localX,localY,z]),valve=end[2]-65;
    const align=fixturePoint(f,0,[f.type==='toilet'?localX:warm?-9:9,localY,valve]);
    const path=[from,...via.map(p=>[...p,z]),behind,[behind[0],behind[1],valve],align,[end[0],end[1],valve],end];
    waterRoute(layer,net+'-'+f.id,path,config.water_branch_mm,label+' · '+fixtureNames[f.type]+' · '+room.name,{network:net,fixture_id:f.id,floor});
   };
   if(floor===1){
    const east=ground['hall-west'][0]-offset,showerY=ground['wet-north'][3]+offset,north=ground.guest[1]-offset;
    trunk('shower-main',[[rx,ry],[east,ry],[east,north]]);
    const wc1=fixtures.find(t=>t.f.id==='wc1-toilet').f;
    branch('wc1-toilet',[rx,ry,z],[[wc1.centre_xy_mm[0]-wc1.size_mm[0]*.38,ry]]);
    branch('shower',[east,showerY,z]);branch('shower-basin',[east,north,z]);
    const cornerGap=warm?26:18; // Keep the turn clear of the K1 sleeve near this corner.
    const west=ground.boiler[2]+cornerGap,south=ground['wc2-frame'][3]+cornerGap,wcEast=ground.bearing3[0]-offset;
    trunk('wc-main',[[rx,boilerY],[west,boilerY],[west,south],[wcEast,south]]);
    const basin=fixtures.find(t=>t.f.id==='wc2-basin').f;
    branch('wc2-basin',[west,basin.centre_xy_mm[1]+(warm?75:-75),z]);branch('wc2-toilet',[wcEast,south,z]);
    const livingX=ground.bearing3[2]+offset,livingY=ground['tambour-north'][3]+offset;
    const kitchenX=ground['tambour-east'][2]+cornerGap,kitchenY=ground.ext7[3]+cornerGap;
    trunk('kitchen-main',[[wcEast,south],[livingX,south],[livingX,livingY],[kitchenX,livingY],[kitchenX,kitchenY]]);
    const sink=fixtures.find(t=>t.f.id==='kitchen-sink').f;
    branch('kitchen-sink',[kitchenX,kitchenY,z],[[sink.centre_xy_mm[0]+(warm?-75:75),kitchenY]]);
   }else{
    const west=upper['upper-bath-east'][2]+offset,east=upper['upper-wc-east'][0]-offset;
    const bathEnd=fixtures.find(t=>t.f.id==='bath').f.centre_xy_mm[0]+(warm?-75:75);
    trunk('bath-main',[[rx,ry],[bathEnd,ry]]);
    trunk('upper-wc-main',[[rx,ry],[east,ry]]);
    branch('upper-wc-toilet',[west,ry,z]);branch('upper-wc-basin',[east,ry,z]);
    for(const id of ['bath','bath-basin']){
     const x=fixtures.find(t=>t.f.id===id).f.centre_xy_mm[0]+(warm?-75:75);
     branch(id,[x,ry,z]);
    }
   }
  }
 }
}

/* Window and door assemblies. The opening belongs to the wall. The smaller
 * block and its divisions are read separately from АР-16/17. Profile
 * thicknesses, clearances for the moving leaves and hardware are illustrative. */
'use strict';
function openingSpec(model,o,floor){
 const wall=model.walls.find(w=>w.id===o.wall_id),b=o.bounds_mm.map(Number),axis=wall.axis,cross=1-axis;
 const width=b[axis+3]-b[axis],height=b[5]-b[2];
 const doorMark=o.label.match(/^Дверь\s*(\d+)/)?.[1],type=o.label.match(/ОК-\d+/)?.[0];
 const prefix=doorMark?'door.'+doorMark:'window.'+type;
 const blockWidth=n(prefix+'.block_width'),blockHeight=n(prefix+'.block_height');
 const lo=b[axis]+(width-blockWidth)/2,bottom=b[2]+(doorMark?0:(height-blockHeight)/2);
 return {id:'leaf:'+o.id,opening:o,wall,floor,b,axis,cross,width,height,door:!!doorMark,type,prefix,blockWidth,blockHeight,
  range:[lo,lo+blockWidth,bottom,bottom+blockHeight,(b[cross]+b[cross+3])/2],swing:MODEL.experience.door_swings[o.id],
  openable:!o.arch,gate:doorMark==='3'};
}

function openingPoint(s,u,v,z){
 const cross=s.range[4]+v;
 return s.axis===0?[u,cross,z]:[cross,u,z];
}

// A circular segment specified by its chord and rise. Sampling by angle keeps
// the sides smooth near a steep springing. Both end points lie on the sill.
function archCurve(s,lo,hi,base,rise){
 const half=(hi-lo)/2,r=(half*half+rise*rise)/(2*rise),middle=(lo+hi)/2;
 const angle=Math.asin(half/r),count=96;
 return Array.from({length:count+1},(_,i)=>{
  const t=angle*(1-2*i/count);
  return openingPoint(s,middle+r*Math.sin(t),0,base+rise-r+Math.cos(t)*r);
 });
}

function archWindow(g,frame,s){
 const [lo,hi,bottom,top]=s.range,profile=60;
 const outer=archCurve(s,lo,hi,bottom,top-bottom);
 const inner=archCurve(s,lo+profile,hi-profile,bottom+profile,top-bottom-2*profile);
 const face=(points,v)=>g.face(frame,points.map(p=>p.map((x,i)=>i===s.cross?x+v:x)),null,s.id);
 for(let i=0;i<outer.length;i++){
  const j=(i+1)%outer.length,ring=[outer[i],outer[j],inner[j],inner[i]];
  face(ring,-35);face(ring,35);
  for(const arc of [outer,inner]){
   const a=arc[i],b=arc[j],side=(p,v)=>p.map((x,k)=>k===s.cross?x+v:x);
   g.face(frame,[side(a,-35),side(b,-35),side(b,35),side(a,35)],null,s.id);
  }
 }
 const mid=(lo+hi)/2,sill=bottom+profile;
 for(const i of [24,48,72])g.beam(frame,openingPoint(s,mid,0,sill),inner[i],16,16,s.id);
 const inset=archCurve(s,mid-(hi-lo)*.28,mid+(hi-lo)*.28,sill,(top-sill)*.46);
 for(let i=1;i<inset.length;i++)g.beam(frame,inset[i-1],inset[i],16,16,s.id);
 s.archGlass=inner;
 // Facade trim follows the separate R1620/chord opening variant (I016).
 const b=s.b,hole=archCurve(s,b[s.axis],b[s.axis+3],b[2],s.opening.arch.rise_mm);
 s.archPolygon=[hole.at(-1),hole[0],...hole];
}

function windowPanels(s){
 const [lo,hi,bottom,top]=s.range,transom=FACTS.get(s.prefix+'.transom_height');
 const split=transom?bottom+n(s.prefix+'.lower_height'):top;
 const widths=[];
 for(let i=1;FACTS.has(s.prefix+'.panel_width_'+i);i++)widths.push(n(s.prefix+'.panel_width_'+i));
 if(!widths.length)widths.push(s.blockWidth);
 const panels=[];
 let left=lo;
 for(const [i,width] of widths.entries()){
  const right=left+width,balcony=s.type==='ОК-7',fixed=balcony&&(i===0||i===3);
  const normal=(s.floor===1?extNormals:upperNormals)[Number(s.wall.id.match(/\d+$/)[0])-1];
  const reverseElevation=(s.axis===0?-normal[1]:normal[0])<0;
  const hingeHigh=(s.type==='ОК-5'&&i===1)||(balcony&&i===2)||(widths.length===1&&(['ОК-2','ОК-3','ОК-10'].includes(s.type)!==reverseElevation));
  panels.push({left,right,bottom,top:split,hinge:fixed?null:s.type==='ОК-4'?'bottom':hingeHigh?'high':'low',
   columns:balcony&&!fixed?1:2,rows:balcony?(fixed?5:1):s.type==='ОК-8'?5:['ОК-3','ОК-5','ОК-6'].includes(s.type)?4:s.type==='ОК-4'?2:3});
  if(transom)panels.push({left,right,bottom:split,top,hinge:null,columns:balcony?2:4,rows:1});
  left=right;
 }
 return panels;
}

function drawOpenings(g){
 for(const floor of [1,2]){
  const model=MODEL['floor'+floor],visible=mode==='house'||mode==='floor'+floor;
  const frame=addLayer(g,'openingFrames'+floor,{visible,explodeOrder:floor===1?1:3});
  for(const o of model.openings){
   if(o.id.startsWith('o-'))continue;
   const s=openingSpec(model,o,floor),[lo,hi,bottom,top,centre]=s.range;
   g.openings.push(s);
   const box=(u0,z0,u1,z1)=>g.box(frame,...(s.axis===0?[u0,centre-35,z0,u1,centre+35,z1]:[centre-35,u0,z0,centre+35,u1,z1]),s.id,false);
   const facts=[...o.source_fact_ids,s.prefix+'.block_width',s.prefix+'.block_height'];
   if(o.arch){archWindow(g,frame,s);facts.push(s.prefix+'.block_radius',s.prefix+'.opening_radius');}
   else{
    box(lo,bottom,lo+60,top);box(hi-60,bottom,hi,top);box(lo+60,top-60,hi-60,top);
    if(!s.door){
     box(lo+60,bottom,hi-60,bottom+60);
     s.panels=windowPanels(s);
     for(const suffix of ['lower_height','transom_height','panel_width_1','panel_width_2','panel_width_3','panel_width_4']){
      if(FACTS.has(s.prefix+'.'+suffix))facts.push(s.prefix+'.'+suffix);
     }
    }
   }
   expInfo(g,s.id,{title:o.label,status:'source_opening_conditional_leaf',facts,sheets:[['house_1',s.door?(floor===1?6:7):18]],
    note:`Проём ${fmt(s.width)}×${fmt(s.height)} мм. Блок ${fmt(s.blockWidth)}×${fmt(s.blockHeight)} мм. ${o.arch?'Форма выреза и габарит блока проверяются раздельно (I016).':s.door?'Марка и открывание по плану.':'Деление блока по АР-17.'} Профили, фурнитура и угол открывания условны. ${o.note||''}`});
  }
 }
 redrawLeaves(g,false);
}

function drawLeafPanel(g,s,wood,glass,p,crossSign,kind){
 const [lo,hi,base,top]=s.range,door=kind==='door'||kind==='entry'||kind==='gate';
 const left=p.left+(p.left===lo?60:1),right=p.right-(p.right===hi?60:1);
 const low=p.bottom+(p.bottom!==base?1:door?(s.gate?0:s.wall.id.startsWith('ext')?16:8):60);
 const high=p.top-(p.top===top?60:1);
 const pivot=p.hinge==='high'?right:left;
 const open=experience.open.has(s.id)&&p.hinge!==null;
 const angle=open?Math.PI*.48:0,sign=(p.hinge==='high'?-1:1)*crossSign;
 const map=(u,v,z)=>{
  if(s.gate&&open)return openingPoint(s,u,high-z,high+v);
  if(p.hinge==='bottom'&&open){
   const tilt=crossSign*Math.PI/12;
   return openingPoint(s,u,v*Math.cos(tilt)+(z-low)*Math.sin(tilt),low+(z-low)*Math.cos(tilt)-v*Math.sin(tilt));
  }
  const offset=u-pivot;
  return openingPoint(s,pivot+offset*Math.cos(angle)-v*sign*Math.sin(angle),v*Math.cos(angle)+offset*sign*Math.sin(angle),z);
 };
 if(kind==='window')s.panelBarriers.push({a:map(left,0,low),b:map(right,0,low),top:high});
 const box=(u0,z0,u1,z1,v0=-22,v1=22)=>{
  const a=[[u0,v0,z0],[u1,v0,z0],[u1,v1,z0],[u0,v1,z0],[u0,v0,z1],[u1,v0,z1],[u1,v1,z1],[u0,v1,z1]].map(b=>map(...b));
  for(const ids of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])g.face(wood,ids.map(i=>a[i]),null,s.id);
 };
 if(kind==='door'||kind==='gate'){
  box(left,low,right,high);
  for(let z=low+250;z<high-200;z+=500)box(left+70,z,right-70,z+15,-27,-22);
 }else{
  const rim=kind==='entry'?85:40,gl=left+rim,gr=right-rim,gb=low+rim,gt=high-rim;
  box(left,low,gl,high);box(gr,low,right,high);box(gl,low,gr,gb);box(gl,gt,gr,high);
  for(let i=1;i<p.columns;i++){const x=gl+(gr-gl)*i/p.columns;box(x-8,gb,x+8,gt,-10,10);}
  for(let i=1;i<p.rows;i++){const z=gb+(gt-gb)*i/p.rows;box(gl,z-8,gr,z+8,-10,10);}
  g.face(glass,[[gl,0,gb],[gr,0,gb],[gr,0,gt],[gl,0,gt]].map(b=>map(...b)),null,s.id);
 }
 if(kind==='entry'&&p.hinge==='low')box(right-18,low,right+6,high,-30,-22);
 if(door&&!s.gate){
  const handle=p.hinge==='high'?left+35:right-95;
  box(handle,low+950,handle+60,low+980,-42,-20);
 }
}

function redrawLeaves(g,commit=true){
 for(const floor of [1,2]){
  const visible=mode==='house'||mode==='floor'+floor,order=floor===1?1:3;
  const wood=g.resetLayer('openingLeaves'+floor,[.39,.27,.19],commit?{}:{visible,explodeOrder:order});
  const glass=g.resetLayer('glass'+floor,[.45,.66,.71],{...(commit?{}:{visible,opacity:.35,explodeOrder:order}),order:22,showEdges:false});
  for(const s of g.openings){
   if(s.floor!==floor||s.roofWindow)continue;
   if(s.archGlass){g.face(glass,s.archGlass,null,s.id);continue;}
   s.panelBarriers=[];
   if(!s.door){
    const normal=(floor===1?extNormals:upperNormals)[Number(s.wall.id.match(/\d+$/)[0])-1];
    for(const panel of s.panels)drawLeafPanel(g,s,wood,glass,panel,-normal[s.cross],'window');
    continue;
   }
   const [lo,hi,bottom,top]=s.range,mid=(lo+hi)/2;
   const p={left:lo,right:hi,bottom,top,hinge:s.swing?.hinge_end||'low',columns:2,rows:3};
   if(p.hinge==='both'){
    drawLeafPanel(g,s,wood,glass,{...p,right:mid,hinge:'low'},s.swing.cross_sign,'entry');
    drawLeafPanel(g,s,wood,glass,{...p,left:mid,hinge:'high'},s.swing.cross_sign,'entry');
   }else if(s.prefix==='door.2'){
    // АР-16 specifies a transom but does not give its height separately.
    const split=top-(top-bottom)*.16;
    drawLeafPanel(g,s,wood,glass,{...p,bottom:split,hinge:null,rows:1},0,'window');
    drawLeafPanel(g,s,wood,glass,{...p,top:split},s.swing.cross_sign,'door');
   }else drawLeafPanel(g,s,wood,glass,p,s.swing?.cross_sign||1,s.gate?'gate':'door');
  }
  if(commit){g.commitLayer(wood);g.commitLayer(glass);}
 }
 if(commit){drawRoofWindows(g,true);indexSceneObjects(g);if(experience.selected)selectSceneObject(experience.selected);g.request();}
}

/* Facing and glued profiles share the same finished wall plane. Dimensions
 * of the profiles come from AR-18; their placement is a display scenario. */
'use strict';
function facadeProfile(points){
 const p=points.filter((q,i)=>!i||Math.hypot(q[0]-points[i-1][0],q[1]-points[i-1][1])>1e-6);
 if(p.length>1&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-6)p.pop();
 if(p.length<3||HouseShapes.area(p)<.001)return [];
 const signed=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
 return signed<0?p.reverse():p;
}
function facadeRectangle(u0,z0,u1,z1){return [[u0,z0],[u1,z0],[u1,z1],[u0,z1]];}
function facadeRun(walls,normals,i){
 const wall=walls[i],axis=wall.axis,cross=1-axis,sign=normals[i][cross];
 const inner=n('wall.external.xps_thickness')+n('wall.external.air_gap'),brick=n('wall.external.facing_thickness');
 const faceAt=(j,depth)=>{const w=walls[j],c=1-w.axis,b=w.bounds_mm.map(Number),s=normals[j][c];return (s>0?b[c+2]:b[c])+s*depth;};
 const end=(j,depth)=>{const pt=[];pt[axis]=faceAt(j,depth);pt[cross]=faceAt(i,depth);return pt;};
 const prev=(i+walls.length-1)%walls.length,next=(i+1)%walls.length;
 const foot=facadeProfile([end(prev,inner),end(next,inner),end(next,inner+brick),end(prev,inner+brick)]);
 const outer=[faceAt(prev,inner+brick),faceAt(next,inner+brick)].sort((a,b)=>a-b);
 return {wall,axis,cross,sign,foot,outer,face:faceAt(i,inner+brick),inner:faceAt(i,inner),backing:[]};
}
function facadeExtrusion(run,profile,back,front){
 const at=(q,v)=>run.axis===0?[q[0],v,q[1]]:[v,q[0],q[1]];
 const a=profile.map(q=>at(q,back)),b=profile.map(q=>at(q,front));
 return [[...a].reverse(),b,...a.map((p,i)=>{const j=(i+1)%a.length;return [p,a[j],b[j],b[i]];})];
}
function facadeUnderDeck(faces){
 const points=faces.flat();if(!points.length)return [];
 const min=[0,1].map(k=>Math.min(...points.map(p=>p[k]))),max=[0,1].map(k=>Math.max(...points.map(p=>p[k])));
 const solids=[];
 for(const cap of MODEL.roof_geometry.eave_junctions.wall_caps){
  if([0,1].some(k=>cap.polygon_mm.every(p=>p[k]<=min[k]+1e-7)||cap.polygon_mm.every(p=>p[k]>=max[k]-1e-7)))continue;
  const [a,b,c]=cap.plane,clipped=clipDisplaySolid(clipSolidToFootprint(faces,cap.polygon_mm),[a,b,-1,c-roofDeckDrop(cap.plane)]);
  if(clipped.length)solids.push(clipped);
 }
 return solids;
}
function drawFacingBand(g,layer,run,z0,z1,holes,id,roofCut){
 const u=run.foot.map(p=>p[run.axis]);let profiles=[facadeRectangle(Math.min(...u),z0,Math.max(...u),z1)];
 for(const hole of holes)profiles=profiles.flatMap(poly=>HouseShapes.subtract(poly,hole));
 for(const profile of profiles){
  const faces=clipSolidToFootprint(facadeExtrusion(run,profile,run.inner,run.face),run.foot);
  for(const solid of roofCut?facadeUnderDeck(faces):[faces])for(const face of solid){
   g.face(layer,face,null,id);
   if(face.every(p=>Math.abs(p[run.cross]-run.face)<1e-5)){
    const uv=facadeProfile(face.map(p=>[p[run.axis],p[2]]));if(uv.length)run.backing.push(uv);
   }
  }
 }
}
function wallDecoration(g,layer,run,profile,depth,id,upper){
 const back=run.face,front=back+run.sign*depth;
 for(const surface of run.backing){
  const patch=facadeProfile(intersectConvex(profile,surface));if(!patch.length)continue;
  const faces=facadeExtrusion(run,patch,back,front);
  for(const solid of upper?facadeUnderDeck(faces):[faces])for(const f of solid)g.face(layer,f,null,id);
 }
}
function drawFacade(g){
 const enabled=mode==='house',facing=addLayer(g,'facade',{visible:enabled,showEdges:false}),trim=addLayer(g,'mouldings',{visible:enabled,showEdges:false});
 const hoodWidth=n('decor.Д-9.profile_height'),hoodDepth=n('decor.Д-9.profile_depth'),beltHeight=n('decor.Д-6.profile_height');
 const blockWidth=n('decor.Д-1.width'),blockHeight=n('decor.Д-1.profile_height');
 const deckBottom=Number(MODEL.slab2.bottom_mm),deckTop=Number(MODEL.slab2.top_mm),ridge=n('level.roof.ridge.elevation')*1000;
 for(const floor of [1,2]){
  const upper=floor===2,walls=MODEL['floor'+floor].walls.filter(w=>w.id.startsWith(upper?'upper-ext':'ext'));
  for(const [i,w] of walls.entries()){
   const run=facadeRun(walls,upper?upperNormals:extNormals,i),openings=g.openings.filter(s=>s.wall.id===w.id);
   const holes=openings.map(s=>s.archPolygon?facadeProfile(s.archPolygon.map(p=>[p[s.axis],p[2]])):facadeRectangle(s.b[s.axis],s.b[2],s.b[s.axis+3],s.b[5]));
   if(upper)drawFacingBand(g,facing,run,deckBottom,deckTop,[],'display-junction:'+w.id,false);
   drawFacingBand(g,facing,run,upper?deckTop:Number(w.base_mm),upper?ridge:Number(w.top_mm),holes,'facade:'+w.id,upper);
   expInfo(g,'facade:'+w.id,{title:'Облицовка · '+w.label,facts:['wall.external.facing_thickness','wall.external.air_gap','wall.external.xps_thickness'],sheets:[['house_1',12]],note:'По цокольному узлу АР-11 лицевой кирпич толщиной 120 мм опирается на наружную часть фундамента через гидроизоляцию. За кирпичом показаны воздушный зазор 30 мм, утеплитель 50 мм и газобетон 400 мм.'});
   if(!upper){
    const [lo,hi]=run.outer,id='decor:cornice:'+w.id,margin=hoodWidth+10;
    const exclusions=openings.map(s=>facadeRectangle(s.b[s.axis]-margin,s.b[2]-margin,s.b[s.axis+3]+margin,s.b[5]+margin));
    const decorate=(rect,depth)=>{let pieces=[rect];for(const exc of exclusions)pieces=pieces.flatMap(p=>HouseShapes.subtract(p,exc));for(const p of pieces)wallDecoration(g,trim,run,p,depth,id,false);};
    decorate(facadeRectangle(lo,deckBottom-beltHeight,hi,deckBottom),n('decor.Д-6.profile_depth'));
    const end=Math.min(lo+blockWidth,hi),starts=[[lo,end],[Math.max(end,hi-blockWidth),hi]];
    for(const [start,stop] of starts)if(stop>start)for(let z=0;z+blockHeight<=deckBottom-beltHeight;z+=blockHeight+20)decorate(facadeRectangle(start,z,stop,z+blockHeight),n('decor.Д-1.profile_depth'));
    expInfo(g,id,{title:'Угловые панели и межэтажный пояс',facts:['decor.Д-1.width','decor.Д-1.profile_height','decor.Д-1.profile_depth','decor.Д-6.profile_height','decor.Д-6.profile_depth'],note:'Каждая накладка опирается тыльной стороной на лицевой кирпич. Раскладка по фасаду условная.'});
   }
   for(const s of openings){
    const id='decor:opening:'+s.opening.id,a=s.axis,b=s.b,left=b[a],right=b[a+3];
    const panel=p=>wallDecoration(g,trim,run,p,hoodDepth,id,upper);
    if(s.archPolygon){
     const inner=s.archPolygon.slice(2),outer=archCurve(s,left-hoodWidth,right+hoodWidth,b[2],s.opening.arch.rise_mm+hoodWidth);
     for(let j=1;j<inner.length;j++)panel([[inner[j-1][a],inner[j-1][2]],[inner[j][a],inner[j][2]],[outer[j][a],outer[j][2]],[outer[j-1][a],outer[j-1][2]]]);
    }else{
     panel(facadeRectangle(left-hoodWidth,b[2],left,b[5]));panel(facadeRectangle(right,b[2],right+hoodWidth,b[5]));
     panel(facadeRectangle(left-hoodWidth,b[5],right+hoodWidth,b[5]+hoodWidth));
    }
    expInfo(g,id,{title:'Обрамление · '+s.opening.label,facts:['decor.Д-9.profile_height','decor.Д-9.profile_depth'],note:'Профиль Д-9 повторяет наружную грань стены и границу проёма.',sheets:[['house_1',19]]});
   }
  }
 }
 for(const e of MODEL.roof_geometry.edges.filter(e=>e.kind==='eave'))drawEaveMoulding(g,trim,e);
 for(const step of MODEL.roof_geometry.height_steps){
  if(step.max_height_difference_mm<=100)continue;
  for(const [a,b,lowB,lowA] of splitRoofReturn(step.polygon_mm)){
   if(Math.abs(a[0]-b[0])>.001&&Math.abs(a[1]-b[1])>.001)continue;
   const middle=a.map((v,i)=>(v+b[i])/2);
   const lower=MODEL.roof_geometry.cells.find(cell=>
    [lowA,lowB].every(p=>Math.abs(HouseShapes.z(cell.plane,p)-p[2])<.001)&&
    cell.polygon_mm.some((v,i)=>{const w=cell.polygon_mm[(i+1)%cell.polygon_mm.length],t=rulerFraction(...middle.slice(0,2),v,w);
     return Math.hypot(v[0]+t*(w[0]-v[0])-middle[0],v[1]+t*(w[1]-v[1])-middle[1])<.001;}));
   if(lower)drawEaveMoulding(g,trim,{a_mm:a,b_mm:b},lower.plane);
  }
 }
 expInfo(g,'decor:eaves',{title:'Карнизы и фронтонные молдинги',facts:['roof.osb.thickness','decor.Д-6.profile_height'],note:'Карниз показан под нижней гранью настила своего ската. Положение и сечение свеса схематичны.',sheets:[['house_1',19],['house_2',24]]});
}

/* Interactive house assembly. PDF values, derived display geometry and user
 * routing proposals remain separate in the exported model and inspector. */
'use strict';
const experience={objectMode:false,dimensions:false,roomLabels:true,waterCorner:true,showPipes:true,selected:null,open:new Set(),scope:'both',courseDisplay:'all',row:1,courseCache:null,section:8,tourRoom:'entry',sewerDepth:1500,sewerSlope:2};
const EXPERIENCE_MODES=['house','floor1','floor2','foundation','services3d','foundation-stack','masonry3d'];
const extNormals=[[0,-1],[1,0],[0,-1],[1,0],[0,-1],[-1,0],[0,-1],[1,0],[0,-1],[1,0],[0,1],[1,0],[0,1],[-1,0],[0,1],[-1,0]];
const upperNormals=[[0,-1],[1,0],[0,-1],[1,0],[0,-1],[1,0],[0,1],[1,0],[0,1],[-1,0],[0,1],[-1,0]];
function experienceMeta(){Object.assign(LAYER_META,{
 roofWindowFrames:['Мансардные окна · рамы',[.26,.22,.19]],roofWindowLeaves:['Мансардные окна · створки',[.32,.27,.22]],roofWindowGlass:['Мансардные окна · стекло',[.41,.62,.69]],
 groundTextile:['1 · Геотекстиль 300 г/м²',[.38,.41,.36]],polyethylene:['4 · Армированный полиэтилен',[.39,.47,.48]],
 roomFloors:['Полы и назначения комнат',[.79,.74,.62]],openingFrames1:['Рамы · первый этаж',[.28,.23,.19]],openingFrames2:['Рамы · мансарда',[.28,.23,.19]],
 openingLeaves1:['Двери и створки · первый этаж',[.39,.27,.19]],openingLeaves2:['Двери и створки · мансарда',[.39,.27,.19]],glass1:['Стекло · первый этаж',[.45,.66,.71]],glass2:['Стекло · мансарда',[.45,.66,.71]],
 facade:['Кирпичная облицовка · визуальный вариант',[.47,.36,.28]],mouldings:['Молдинги и русты · схема АР-18',[.91,.88,.78]],vents:['Вентиляционные шахты ВК-1…3',[.50,.35,.25]],ventCaps:['Оголовки шахт · схема',[.25,.19,.16]],
 fixtureDrains:['Канализация · приборы и стояки',[.57,.40,.29]],coldDistribution:['Холодная вода · к приборам',[.18,.50,.73]],hotDistribution:['Горячая вода · к смесителям',[.79,.26,.20]],gasDistribution:['Газ · от котельной до плиты',[.91,.65,.13]],
 appliances:['Плита и водонагреватель',[.83,.83,.77]],applianceTrim:['Детали оборудования',[.27,.29,.28]],
 saunaWood:['Сауна · обшивка',[.64,.42,.25]],saunaBenches:['Сауна · полки',[.86,.66,.43]],saunaStove:['Сауна · электрокаменка',[.32,.33,.33]],saunaStones:['Сауна · камни и решётка',[.20,.22,.23]],
 sewer3d:['К1 · канализационный отвод Ø110',[.71,.31,.16]],water3d:['В1 · ввод воды Ø32',[.15,.48,.74]],sleeves3d:['Гильзы · длина условная',[.45,.51,.50]],septic3d:['Септик · место по пожеланию',[.57,.64,.49]],
 dimensions:['Размеры · derived',[.75,.39,.12]],courseFull:['Кладка · целые части',[.67,.74,.51]],courseCuts:['Кладка · подрезки',[.76,.55,.30]],courseFrame:['Каркасные перегородки',[.44,.59,.54]],
 });}
function expInfo(g,id,info){g.objectInfo??=new Map();g.objectInfo.set(id,{status:'derived_display_geometry',...info});}
function describeWindowFraming(g){
 for(const p of g.frameWindowScenario||[])expInfo(g,p.id,{title:'Обрамление мансардного окна · условный вариант',status:p.status,facts:['timber.1.width','timber.1.height'],note:'Схемные перемычки и боковые доски 50×200 вокруг проходки. Расчёт усиления, крепёж и рабочие запилы не назначены.'});
}
const objectStatusLabels={
 user_design_scenario:'Вариант инженерной сети',
 interior_layout_scenario_not_source_dimensions:'Вариант интерьера',
 display_threshold_not_construction_detail:'Вариант отделки',
 display_junction_not_structural_design:'Вариант примыкания',
 conditional_window_framing_not_engineered_header:'Вариант обрамления окна',
 source_opening_conditional_leaf:'Размер проёма по проекту',
 source_block_conditional_roof_location:'Размер блока по проекту',
 source_name_area_display_zone:'Название и площадь по проекту', derived_exposed_slab_to_plinth_faces:'Площадь открытой плиты по модели'
};
function polygonAt(g,l,poly,z,id){for(const tri of HouseGL.triangulate(poly))g.face(l,tri.map(i=>[...poly[i],z]),[0,0,1],id);}
function addExperience(g){
 experienceMeta();for(const floor of [1,2])for(const [prefix,title,color]of [['fixtures','Сантехника',[.92,.93,.89]],['fixtureMetal','Сантехника · металл',[.50,.57,.59]],['fixtureWater','Сантехника · вода и стекло',[.28,.60,.68]],['fixtureCabinet','Тумбы под раковины',[.56,.43,.29]]])LAYER_META[prefix+floor]=[title+' · '+floor+' этаж',color];g.objectInfo=new Map();g.roomZoneOutlines=[];describeWindowFraming(g);g.openings=[];if(g.layers.has('roof'))g.layers.get('roof').depthBias=4;
 const architectural=['house','floor1','floor2'].includes(mode),foundation=['foundation','foundation-stack','services3d'].includes(mode);
 if(g.layers.has('stairPartitions'))expInfo(g,'stair:wc-apron',{title:'Заполнение над проходом в санузел № 9',status:'display_junction_not_structural_design',note:'В модели заполнение между низом верхнего марша и перекрытием закрывает вид с лестницы в санузел. Проход из холла следует плану. Способ заполнения и примыкания требуют уточнения по I019.',sheets:[['house_1',4],['house_1',6],['house_1',10],['house_2',20]]});
 const textile=addLayer(g,'groundTextile',{visible:foundation,explodeOrder:-5}),poly=addLayer(g,'polyethylene',{visible:foundation,explodeOrder:-2.5});
 polygonAt(g,textile,core,-1250,'groundTextile');polygonAt(g,poly,core,-850,'polyethylene');
 expInfo(g,'groundTextile',{title:'Геотекстиль под щебнем',note:'300 г/м² — поверхностная плотность, не толщина. В 3D показана плоскость −1.250.',facts:['foundation.Фм1.geotextile_density'],sheets:[['house_2',8]]});
 expInfo(g,'polyethylene',{title:'Армированный полиэтилен',note:'Между щебнем5–10 и В10. Толщина в источнике не назначена; показана плоскость.',sheets:[['house_2',8]]});
 if(architectural){drawWallJunctions(g);drawRoomZones(g);drawOpenings(g);drawDoorThresholds(g);drawRoofWindows(g);drawFacade(g);drawVents(g);drawSanitaryFixtures(g);}
 if(mode==='services3d')drawSanitaryFixtures(g);
 g.interiorObstacles=[];
 if(mode==='house'&&MODEL.roof_frame){
  g.interiorObstacles.push(...roofFrameDisplayMembers().filter(m=>m.family==='posts'||m.id.startsWith('transfer-column-')).map(m=>frameSceneBox(m.id)).filter(Boolean));
 }
 drawAppliances(g);if(['house','floor1'].includes(mode))drawSauna(g);
 drawServiceRoutes(g,foundation||(architectural&&experience.showPipes));
 if(mode==='house')g.labels=[];
 if(['roof','frame'].includes(mode))drawRoofWindows(g);
 if(mode==='frame')drawVents(g);
 if(mode==='foundation-stack'){
  experience.section=8;g.labels=[];
  for(const l of g.layers.values())l.visible=foundationLayers.some(([id])=>id===l.id);
  foundationLayers.forEach(([id,title,size,purpose,z,mid],i)=>{
   const l=g.layers.get(id);l.explodeOrder=i-6;
   g.labels.push({text:(i+1)+' · '+title,p:[6935,-400,mid],layer:id,kind:'stack'});
  });
  g.explode=1100;
 }
 if(mode==='services3d'){g.pipeCircuit='all';g.pipeFocus='';for(const l of g.layers.values())l.visible=['slab','beams','services','guides','appliances','applianceTrim',...servicePipeLayers].includes(l.id)||l.id.startsWith('fixture');for(const l of g.layers.values())if(/^(fixtures|fixtureCabinet|fixtureWater|fixtureMetal)[12]$/.test(l.id))l.opacity=.32;g.layers.get('slab').opacity=.10;g.layers.get('beams').opacity=.14;}
 if(mode==='masonry3d')drawCombinedCourses(g);
 if(architectural)architecturalPriorities(g);indexSceneObjects(g);drawDimensions(g);
}
function drawBoilerFinish(g,floorLayer,room,id){
 const tiles=addLayer(g,'boilerTiles',{showEdges:false}),walls=addLayer(g,'boilerPlaster',{showEdges:false});
 const [x0,y0]=room.polygon_mm[0],[x1,y1]=room.polygon_mm[2],z=room.elevation_mm;
 polygonAt(g,floorLayer,room.polygon_mm,z-2,id);
 // AR-16 type 4. Tile module and grout width are choices for the visualization.
 for(let x=x0;x<x1;x+=300)for(let y=y0;y<y1;y+=300){
  const left=x+1.5,right=Math.min(x+300,x1)-1.5,bottom=y+1.5,top=Math.min(y+300,y1)-1.5;
  g.face(tiles,[[left,bottom,z],[right,bottom,z],[right,top,z],[left,top,z]],[0,0,1],id);
 }
 const sides=[['ext16',0,x0,1],['boiler',0,x1,-1],['bearingГ',1,y0,1],['bearingЕ',1,y1,-1]];
 for(const solid of FloorGeometry.solids(MODEL.floor1)){
  const side=sides.find(([wall])=>wall===solid.wall_id);
  if(!side)continue;
  const [wall,axis,face,sign]=side,b=solid.bounds,along=1-axis;
  if(Math.abs(b[axis+(sign>0?3:0)]-face)>.01)continue;
  // Reuse masonry cutouts (windows, doors, and the underside of the landing).
  for(const piece of stairWallPatches(b,wall)){
   const edge=piece.polygon_mm.filter(p=>Math.abs(p[axis]-face)<.01).map(p=>p[along]);
   const lo=Math.max(Math.min(...edge),along?y0:x0),hi=Math.min(Math.max(...edge),along?y1:x1);
   if(hi<=lo)continue;
   const points=[lo,hi].map(t=>axis?[t,face]:[face,t]);
   const at=(p,h)=>[p[0]+(axis?0:2*sign),p[1]+(axis?2*sign:0),h];
   const lower=p=>b[2]===Number(MODEL.floor1.walls.find(w=>w.id===wall).base_mm)?z:HouseShapes.z(piece.bottom_plane,p);
   g.face(walls,[at(points[0],lower(points[0])),at(points[1],lower(points[1])),
    ...points.reverse().map(p=>at(p,HouseShapes.z(piece.top_plane,p)))],axis?[0,sign,0]:[sign,0,0],'wall:'+wall);
  }
 }
}
function drawUpperRoomFloor(g,l,room,id){
 const holes=[roofContactRect(activeSlab().opening.bounds_mm.map(Number))];
 if(mode==='house'&&MODEL.roof_frame){
  // Lay the finish around sills on the slab. Their tops meet the finish at +3.300.
  for(const member of roofFrameDisplayMembers().filter(m=>m.family==='beds'||m.post_base_plate)){
   const [x0,y0,z0,x1,y1,z1]=frameSceneBox(member.id);
   if(z0<room.elevation_mm&&room.elevation_mm<=z1)holes.push(roofContactRect([x0,y0,x1,y1]));
  }
 }
 for(const t of HouseGL.triangulate(room.polygon_mm)){
  const patches=holes.reduce((parts,hole)=>parts.flatMap(p=>HouseShapes.subtract(p,hole)),[t.map(i=>room.polygon_mm[i])]);
  for(const p of patches)
   g.face(l,p.map(q=>[...q,room.elevation_mm]),[0,0,1],id);
 }
}
function drawRoomZones(g){const l=addLayer(g,'roomFloors',{order:9,showEdges:false});for(const room of MODEL.experience.rooms){if(mode==='floor1'&&room.floor!==1||mode==='floor2'&&room.floor!==2)continue;const id='room:'+room.id;if(room.polygons_mm){for(const ring of room.polygons_mm)g.roomZoneOutlines.push({points:ring.map(p=>[...p,room.elevation_mm]),id,layer:l.id});}else if(room.id==='10')drawBoilerFinish(g,l,room,id);else if(room.floor===2)drawUpperRoomFloor(g,l,room,id);else polygonAt(g,l,room.polygon_mm,room.elevation_mm,id);expInfo(g,id,{title:`${room.number}. ${room.name}`,status:room.polygons_mm?'derived_exposed_slab_to_plinth_faces':'source_name_area_display_zone',facts:room.source_fact_ids,note:room.note});if(experience.roomLabels&&mode!=='house')g.labels.push({text:`${room.number} · ${room.name.replace('Санузел','С/у').replace('Теплогенераторная','Котельная').replace(' · под лестницей','')}\n${fmt(room.area_m2,2)+' м²'}`,p:[...room.point_mm,room.elevation_mm+40],id,layer:'roomFloors',kind:'room',width_mm:Math.max(...room.polygon_mm.map(p=>p[0]))-Math.min(...room.polygon_mm.map(p=>p[0]))});}}
function toggleOpening(id){const s=renderer.openings?.find(s=>s.id===id);if(!s?.openable)return;if(experience.open.has(id))experience.open.delete(id);else experience.open.add(id);if(s.roofWindow){drawRoofWindows(renderer,true);indexSceneObjects(renderer);renderer.request();if(experience.selected)selectSceneObject(experience.selected);}else redrawLeaves(renderer);renderExperienceTools();}
function drawVents(g){
 const masonry=addLayer(g,'vents',{visible:mode==='house',order:19});
 const cap=addLayer(g,'ventCaps',{visible:mode==='house',order:20});
 for(const body of MODEL.floor1.brick_envelopes){
  const number=body.id.slice(4),prefix='vent.ВК-'+number,id='vent:'+number;
  const [x0,y0,x1,y1]=body.bounds_mm.map(Number),top=n(prefix+'.top_elevation')*1000;
  const facts=['body_width','body_depth','top_elevation'].map(key=>prefix+'.'+key);
  g.box(masonry,x0,y0,3020,x1,y1,top-200,id);
  g.box(cap,x0-70,y0-70,top-50,x1+70,y1+70,top,id);
  for(const x of [x0,x1-100])for(const y of [y0,y1-100])g.box(cap,x,y,top-200,x+100,y+100,top-50,id,false);
  if(number==='2'){
   for(const prism of vk2InsulationPrisms())HouseShapes.prism(g,masonry,prism,id);
   facts.push(prefix+'.above_roof_insulation_thickness');
  }
  expInfo(g,id,{title:'Вентиляционная шахта ВК-'+number,facts,
   note:body.note||'Кирпичное тело и отметка по проекту. Колпак и просветы оголовка показаны схематично.',
   sheets:[['house_1',19+Number(number)]]});
 }
}
function drawServiceRoutes(g,visible){const config=MODEL.experience.service_scenario,sewer=g.resetLayer('sewer3d',[.71,.31,.16],{visible,order:25,showEdges:false}),water=g.resetLayer('water3d',[.15,.48,.74],{visible,order:25,showEdges:false}),sleeves=g.resetLayer('sleeves3d',[.45,.51,.50],{visible,order:24,opacity:.35,showEdges:false}),tank=g.resetLayer('septic3d',[.57,.64,.49],{visible,order:26,opacity:.65});g.servicePaths=[];
 const [collectorX,outletY]=config.sewer_outlet_point_mm,slope=experience.sewerSlope/100;
 const route=(l,id,points,radius,title,facts,note,meta={})=>{points=points.filter((p,i)=>!i||Math.hypot(...p.map((v,k)=>v-points[i-1][k]))>.001);drawPipeRun(g,l,points,radius,id);g.servicePaths.push({id,points_mm:points,diameter_mm:radius*2,status:'illustrative_route_not_engineering_design',...meta});expInfo(g,id,{title,facts,note,status:'user_design_scenario'});};
 const points=MODEL.services.filter(s=>s.id.startsWith('К1')),sites=new Map(points.map(s=>[s.id,s]));
 // The drawing locates the K1-5 junction at the south plate edge. The two
 // short junctions have no dimension; use a labelled 45° plan scenario.
 const southEdge=Math.min(...core.map(p=>p[1]));
 const junctionY=s=>{if(s.id==='К1-1')return +sites.get('К1-3').y_mm;if(s.id==='К1-5')return southEdge;return +s.y_mm-Math.abs(+s.x_mm-collectorX);};
 // Even at the steepest slider setting the foot of every riser must
 // turn below its sleeve. Report the applied outlet depth in the controls.
 const minimum=points.map(s=>{const y=junctionY(s),run=y-outletY+Math.hypot(Number(s.x_mm)-collectorX,Number(s.y_mm)-y);return run*slope-config.sleeve_display_bottom_mm+Number(s.diameter);});
 g.minimumSewerDepth=Math.max(900,Math.ceil(Math.max(...minimum)));
 experience.sewerDepth=Math.max(experience.sewerDepth,g.minimumSewerDepth);
 const outlet=[collectorX,outletY,-experience.sewerDepth],zAt=y=>outlet[2]+(y-outletY)*slope;
 for(const s of points){
  const x=+s.x_mm,y=+s.y_mm,jy=junctionY(s),junction=[collectorX,jy,zAt(jy)],run=Math.hypot(x-collectorX,y-jy);
  const foot=[x,y,junction[2]+run*slope],path=[[x,y,0],foot];
  if(run>0)path.push(junction);
  route(sewer,'pipe:'+s.id,path,Number(s.diameter)/2,s.id+' · канализационный отвод',s.input_fact_ids,'XY и Ø110 по ВК-1. У К1-5 ветвь подходит к южному краю плиты. Углы коротких ответвлений, уклон и глубина — параметры просмотра.');
  const outer=Number(s.sleeve)/2;g.tube(sleeves,[x,y,config.sleeve_display_bottom_mm],[x,y,config.sleeve_display_top_mm],outer,12,'sleeve:'+s.id);expInfo(g,'sleeve:'+s.id,{title:'Гильза '+s.id,facts:s.input_fact_ids,note:'Диаметр из листа ВК-1. Длина400 мм и Z−850…−450 — условное изображение, не размер заготовки.'});
 }
 const startY=+sites.get('К1-2').y_mm;
 route(sewer,'pipe:collector',[[collectorX,startY,zAt(startY)],outlet],55,'К1 · общий выпуск',['service.К1-1.pipe_diameter'],`Вариант трассы под фундаментом. Уклон ${experience.sewerSlope}% — параметр; ось выпуска −${experience.sewerDepth} мм. Колена и ветви показаны по топологии ВК-1.`);
 const septic=config.septic_point_mm,dx=septic[0]-outlet[0],dy=septic[1]-outlet[1];
 const fraction=1-Math.min(1300/Math.abs(dx),900/Math.abs(dy));
 const inlet=[outlet[0]+dx*fraction,outlet[1]+dy*fraction,outlet[2]-Math.hypot(dx,dy)*fraction*slope],lid=inlet[2]+450;
 route(sewer,'pipe:septic',[outlet,inlet],55,'К1 · к септику спереди справа',[],'Выпуск доходит до ближней стенки септика. Место и глубина установки показаны условно.');
 g.box(tank,septic[0]-1300,septic[1]-900,lid-2000,septic[0]+1300,septic[1]+900,lid,'septic',false);g.ring(tank,septic[0],septic[1],lid+10,350);expInfo(g,'septic',{title:'Септик · спереди справа',note:'По пожеланию владельца. Габарит 2600×1800×2000 мм и положение ввода в стенке — параметры просмотра.',status:'user_design_scenario'});
 const source=MODEL.services.find(s=>s.id==='В1-1'),xy=experience.waterCorner?MODEL.experience.water_proposal.point_mm:[+source.x_mm,+source.y_mm],start=config.water_source_point_mm,wp=[start,[start[0],xy[1],start[2]],[...xy,start[2]],[...xy,0]];
 route(water,'pipe:water',wp,16,'В1 · ввод воды'+(experience.waterCorner?' · угол Е':' · исходная точка'),source.input_fact_ids,`Ø32 из ВК-1. ${experience.waterCorner?'Перенос: X(1)+250; Y(Е)−250 — решение владельца от 18.11.2026.':'XY по исходному листу.'} Источник слева сверху. Z−1700 и наружная трасса условны. I008: Ø63/65/32 сохранены отдельно.`);
 g.tube(sleeves,[...xy,-850],[...xy,-450],50,12,'sleeve:water');expInfo(g,'sleeve:water',{title:'Гильза В1 · Ø100',facts:source.input_fact_ids,note:'Длина400 мм условна. Местный узел с Ø100×4 — КЖ-2; это не согласование I008.'});
 drawIndoorPlumbing(g,visible,xy,route);
 g.labels=g.labels.filter(l=>l.kind!=='service-route');if(visible&&['foundation','foundation-stack','services3d'].includes(mode)){for(const [text,p,id,layer]of [['К1 → септик · спереди справа',[...septic.slice(0,2),lid+100],'septic','septic3d'],['В1 ← вода слева сверху',start,'pipe:water','water3d'],[experience.waterCorner?'В1 · перенос к Е':'В1 · исходная точка',[...xy,100],'pipe:water','water3d']])g.labels.push({text,p,id,layer,kind:'service-route'});}
}
function indexSceneObjects(g){const objects=new Map();for(const hit of g.hitTargets.concat(g.roomZoneOutlines||[])){if(hit.layer==='selection'||hit.layer==='dimensions')continue;let o=objects.get(hit.id);if(!o){o={id:hit.id,layer:hit.layer,bounds:[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],faces:[]};objects.set(hit.id,o);}o.faces.push(hit);for(const p of hit.points)for(let i=0;i<3;i++){o.bounds[i]=Math.min(o.bounds[i],p[i]);o.bounds[i+3]=Math.max(o.bounds[i+3],p[i]);}}
 for(const o of objects.values()){const id=o.id;let info=g.objectInfo.get(id);
  if(!info&&id.startsWith('frame-member:transfer-')){
   const part=roofFrameMember(id.slice(13));
   if(part)info={title:part.label,note:part.note,status:part.status,roofDetail:MODEL.roof_frame.north_dormer_transfer.detail_id,
    sheets:[['house_2',22],['house_1',5]]};
  }
  if(!info){let wall;if(id.startsWith('wall:'))wall=MODEL.floor1.walls.find(w=>w.id===id.slice(5));if(id.startsWith('upperwall:'))wall=MODEL.floor2.walls.find(w=>w.id===id.slice(10));if(wall)info={title:wall.label,facts:wall.input_fact_ids,note:(['bearing3','boiler'].includes(wall.id)?'Верх под маршами/площадкой условно обрезан по вычисленной нижней плоскости лестницы. Эта сопрягающая оболочка не меняет исходный прямоугольный объём стен/таблицу блоков; I019 остаётся открытым. ':'')+(wall.note||'Границы derived из размерного графа. Мансардный верх — сценарий оболочки.')};else if(id.startsWith('roofcell:')){const cell=MODEL.roof_geometry.cells.find(c=>c.id===id.slice(9));info={title:cell?.label||id,note:'Плоскость по АР-8. Размеры рамки объекта вычислены по вершинам; это не длина стропила.',sheets:[['house_1',9]]};}else info={title:LAYER_META[o.layer]?.[0]||id,note:'Габарит выбранной геометрии вычислен в локальных осях X/Y/Z; фактические размеры изделия смотреть в источнике.'};}Object.assign(o,info);o.facts=(o.facts||[]).filter(i=>FACTS.has(i));}g.sceneObjects=objects;}
function selectSceneObject(id){const g=renderer,o=g.sceneObjects.get(id);if(!o)return;experience.selected=id;const sel=g.resetLayer('selection',[.95,.52,.12],{showEdges:true,order:80,dependsOn:o.layer});for(const face of o.faces)g.polyline(sel,face.points,true);sel.explodeOrder=g.layers.get(o.layer)?.explodeOrder||0;sel.offset=[...(g.layers.get(o.layer)?.offset||[0,0,0])];g.commitLayer(sel);drawDimensions(g,true);
 const b=o.bounds,d=b.slice(3).map((v,i)=>v-b[i]);$('inspector').innerHTML=`<div class="eyebrow">ОБЪЕКТ В 3D</div><h3>${esc(o.title)}</h3><span class="status amber">${objectStatusLabels[o.status]||'Геометрия модели'}</span><div class="formula">${constructionViewer?'Габариты в модели':'Габарит в модели · X × Y × Z'}<br>${d.map(v=>fmt(v,2)).join(' × ')} мм</div>${constructionViewer&&o.faces.length&&d.every(v=>v>0)?'<canvas id="object-preview" width="480" height="264"></canvas>':''}<p>${esc(o.note?.includes('X/Y/Z')&&constructionViewer?'':o.note||'')}</p><div class="buttons-row">${g.openings?.find(s=>s.id===id)?.openable?`<button id="selected-open">${experience.open.has(id)?'Закрыть':'Открыть'}</button>`:''}<button id="selected-isolate">Только этот объект</button><button id="selected-show-all">Вернуть вид</button><button id="selected-focus">Приблизить</button>${o.roofDetail?`<button data-roof-detail="${esc(o.roofDetail)}">Рама над проходом</button>`:id==='frame-member:post-1'?'<button data-roof-detail="post12-shoe">Стальная опора в 3D</button>':''}</div>${o.facts.slice(0,15).map(i=>factBtn(i,FACTS.get(i)?.label)).join('<br>')}${(o.sheets||[]).map(([s,p])=>sheetBtn(s,p)).join('')}`;
 const preview=$('object-preview');
 if(preview)drawRoofPiecePreview(preview,o.faces.map(face=>face.points),[[1,0,0],[0,1,0],[0,0,1]],b.slice(0,3),d.map(value=>[0,value]),null);
 $('selected-open')?.addEventListener('click',()=>toggleOpening(id));$('selected-isolate').onclick=()=>{experience.savedVisibility??=new Map([...g.layers.values()].map(l=>[l.id,l.visible]));for(const l of g.layers.values())l.visible=['selection','dimensions'].includes(l.id);const only=g.resetLayer('object-isolated',g.layers.get(o.layer).color,{visible:true,order:70});for(const face of o.faces)g.face(only,face.points,null,id);g.layers.get('selection').dependsOn=null;g.commitLayer(only);g.request();};$('selected-show-all').onclick=()=>{if(experience.savedVisibility){for(const [id,visible]of experience.savedVisibility)if(g.layers.has(id))g.layers.get(id).visible=visible;experience.savedVisibility=null;}if(g.layers.has('object-isolated'))g.layers.get('object-isolated').visible=false;g.request();renderLayerControls();};$('selected-focus').onclick=()=>{if(g.walk)return;g.target=b.slice(0,3).map((v,i)=>(v+b[i+3])/2);g.span=Math.max(2000,Math.max(...d)*2);g.pan=[0,0];g.request();};if($('scene-object-list'))$('scene-object-list').value=id;g.request();}
function drawDimensions(g,commit=false){g.labels=g.labels.filter(l=>l.kind!=='dimension');const l=g.resetLayer('dimensions',[.75,.39,.12],{visible:experience.dimensions,order:70,showEdges:true});if(experience.dimensions){const o=g.sceneObjects?.get(experience.selected),allPoints=[...core.map(p=>[...p,-1250]),...MODEL.roof_geometry.cells.flatMap(c=>c.polygon_mm)],b=o?.bounds||[0,1,2].map(i=>Math.min(...allPoints.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...allPoints.map(p=>p[i])))),offset=350,definitions=[[[b[0],b[1]-offset,b[2]],[b[3],b[1]-offset,b[2]],'X'],[[b[0]-offset,b[1],b[2]],[b[0]-offset,b[4],b[2]],'Y'],[[b[3]+offset,b[1],b[2]],[b[3]+offset,b[1],b[5]],'Z']];l.explodeOrder=o?g.layers.get(o.layer)?.explodeOrder||0:0;for(const [a,c,axis]of definitions){g.line(l,a,c);const value=Math.hypot(...c.map((v,i)=>v-a[i]));for(const p of [a,c]){const q=[...p],r=[...p],index=axis==='X'?1:0;q[index]-=100;r[index]+=100;g.line(l,q,r);}g.labels.push({text:`${axis}: ${fmt(value,2)} мм · derived`,p:a.map((v,i)=>(v+c[i])/2),layer:'dimensions',kind:'dimension'});}}if(commit)g.commitLayer(l);g.request();}
function ensureCombinedCourses(){if(!experience.courseCache)experience.courseCache={lower:FloorGeometry.courses(MODEL.floor1),upper:HouseShapes.upperCourses(MODEL.floor2)};return experience.courseCache;}
function drawCombinedCourses(g){const courses=ensureCombinedCourses();for(const l of g.layers.values())l.visible=false;const full=addLayer(g,'courseFull'),cuts=addLayer(g,'courseCuts'),frame=addLayer(g,'courseFrame',{opacity:.35}),guide=g.layers.get('guides');if(guide)guide.visible=true;g.labels=[];
 const selected=experience.scope==='both'?['lower','upper']:[experience.scope];let global=0;for(const name of ['lower','upper']){const model=MODEL[name==='lower'?'floor1':'floor2'];for(const row of courses[name].rows){global++;if(!selected.includes(name)||experience.courseDisplay==='one'&&global!==experience.row||experience.courseDisplay==='upto'&&global>experience.row)continue;for(const p of row.pieces){const id='course:'+name+':'+p.id,l=p.cut?cuts:full;if(name==='lower')drawStairAwareBox(g,l,p.bounds_mm,id,true);else for(const part of wallDisplayPieces(p))HouseShapes.prism(g,l,part,id);expInfo(g,id,{title:`${name==='lower'?'1-й этаж':'Мансарда'} · ряд ${row.index} · ${p.wall_id}`,note:'Расчётный сценарий. Подрезки, углы, пояса и перемычки требуют проверки. Не закупочное количество.',facts:model.walls.find(w=>w.id===p.wall_id)?.input_fact_ids||[]});}}
 if(selected.includes(name)){if(name==='lower'){for(const solid of FloorGeometry.solids(MODEL.floor1).filter(p=>p.material==='frame'))g.box(frame,...solid.bounds,'wall:'+solid.wall_id,false);}else for(const p of MODEL.floor2.mesh_prisms.filter(p=>p.material==='frame'))for(const part of wallDisplayPieces(p))HouseShapes.prism(g,frame,part,'upperwall:'+p.wall_id);}}
}
function renderExperienceTools(){const mount=$('experience-tools');if(!mount||!renderer)return;syncSceneControls();renderCombinedCourseTools();mount.hidden=!EXPERIENCE_MODES.includes(mode);if(mount.hidden)return;const walk=!!renderer.walk,objects=[...(renderer.sceneObjects?.values()||[])].filter(o=>renderer.layers.get(o.layer)?.visible);mount.innerHTML=`<div class="experience-actions"><button id="start-tour" class="${walk&&!renderer.walk.flight?'active':''}">${walk&&!renderer.walk.flight?'Выйти из румтура':'Румтур · войти в дом'}</button><button id="start-flight" class="${renderer.walk?.flight?'active':''}">${renderer.walk?.flight?'Выйти из полёта':'Свободный полёт'}</button><button id="object-mode" class="${experience.objectMode?'active':''}">Выбор объекта ${experience.objectMode?'включён':''}</button><label><input type="checkbox" id="show-3d-dimensions" ${experience.dimensions?'checked':''}> Размеры в 3D</label><label><input type="checkbox" id="room-labels" ${experience.roomLabels&&mode!=='house'?'checked':''}> Названия комнат</label></div>
 ${walk?`<div class="tour-navigation"><button id="tour-previous">←</button><label>Помещение<select id="tour-room">${tourOptions()}</select></label><button id="tour-next">→</button><button id="tour-interact">Открыть / закрыть рядом · E</button><p>Удерживайте стрелки на сцене — идти, тяните по сцене — смотреть. С клавиатуры: WASD / стрелки, Shift — быстрее, Esc — выйти. Двери открываются нажатием. Высота глаз1.65 м; лестничная отделка20 мм — сценарий.</p></div>`:''}
 ${experience.objectMode?`<label>Найти элемент<select id="scene-object-list"><option value="">Выберите или нажмите на модель</option>${objects.slice(0,900).map(o=>`<option value="${esc(o.id)}" ${o.id===experience.selected?'selected':''}>${esc(o.title)}</option>`).join('')}</select></label>`:''}
 ${['house','floor1','floor2'].includes(mode)?'<div class="buttons-row"><button id="open-all">Открыть все створки</button><button id="close-all">Закрыть все створки</button><button id="toggle-house-pipes">Трубы</button></div>':''}
 ${mode==='services3d'?plumbingControls():''}
 ${['foundation','foundation-stack','services3d'].includes(mode)?foundationStackHTML():''}
 ${['foundation','foundation-stack','services3d','house'].includes(mode)?`<div class="service-scenario-controls"><label>Ввод В1<select id="water-placement"><option value="corner-E" ${experience.waterCorner?'selected':''}>Принято · у оси Е</option><option value="source" ${!experience.waterCorner?'selected':''}>Исходная точка ВК-1</option></select></label><label>Глубина оси выпуска, мм · сценарий<input id="sewer-depth" type="number" min="900" max="4000" step="1" value="${experience.sewerDepth}"></label><label>Уклон К1, % · сценарий<input id="sewer-slope" type="number" min="0" max="10" step="0.1" value="${experience.sewerSlope}"></label><p class="tiny muted">Синим показана холодная вода, красным — горячая. Магистрали ХВС и ГВС идут вдоль стен, подводки поднимаются за приборами. Коричневым показаны сливы, жёлтым — предложенный газопровод по фасаду от котельной к плите. На ВК-1 обозначены проходы через фундамент. Разводка внутри дома и водонагреватель показаны как вариант. <span id="sewer-depth-note">При этом уклоне отводы проходят под гильзами при глубине выпуска от ${fmt(renderer.minimumSewerDepth)} мм.</span> <button data-sheet="embeds:1">Сверить схему ↗</button></p></div>`:''}
 ${['floor1','floor2'].includes(mode)?`<div class="room-key">${MODEL.experience.rooms.filter(r=>r.floor===(mode==='floor1'?1:2)).map(r=>`<button data-room-inspect="${r.id}"><b>${r.number} · ${esc(r.name)}</b><span>${r.source_area_m2?revisedQuantity('room.'+r.id+'.area'):fmt(r.area_m2,2)+' м²'}</span></button>`).join('')}</div>`:''}`;
 bindPlumbingControls(renderer);
 mount.querySelectorAll('[data-room-inspect]').forEach(b=>b.onclick=()=>selectSceneObject('room:'+b.dataset.roomInspect));
 $('start-tour').onclick=()=>walk&&!renderer.walk.flight?exitTour():startTour(walk?experience.tourRoom:'entry',false);$('start-flight').onclick=()=>renderer.walk?.flight?exitTour():enterFlight();$('object-mode').onclick=()=>{experience.objectMode=!experience.objectMode;renderExperienceTools();};$('show-3d-dimensions').onchange=e=>{experience.dimensions=e.target.checked;drawDimensions(renderer,true);};$('room-labels').onchange=e=>{experience.roomLabels=e.target.checked;if(mode==='house'&&e.target.checked){buildScene('floor1');}else rebuildExperience();};$('scene-object-list')?.addEventListener('change',e=>{if(e.target.value)selectSceneObject(e.target.value);});
 for(const [id,open]of [['open-all',true],['close-all',false]])$(id)?.addEventListener('click',()=>{for(const s of renderer.openings||[])if(s.openable){if(open)experience.open.add(s.id);else experience.open.delete(s.id);}redrawLeaves(renderer);});
 const pipes=$('toggle-house-pipes');
 if(pipes){
  syncHousePipeButton();
  pipes.onclick=()=>{
   experience.showPipes=!servicePipeLayers.some(id=>renderer.layers.get(id)?.visible);
   for(const id of servicePipeLayers)renderer.layers.get(id).visible=experience.showPipes;
   renderer.request();renderLayerControls();syncHousePipeButton();
  };
 }
 $('water-placement')?.addEventListener('change',e=>{experience.waterCorner=e.target.value==='corner-E';refreshServiceGeometry();});
 for(const id of ['sewer-depth','sewer-slope'])$(id)?.addEventListener('change',e=>{if(!e.target.validity.valid||!e.target.value)return;experience[id==='sewer-depth'?'sewerDepth':'sewerSlope']=+e.target.value;refreshServiceGeometry();$('sewer-depth').value=experience.sewerDepth;$('sewer-depth-note').textContent='При этом уклоне отводы проходят под гильзами при глубине выпуска от '+fmt(renderer.minimumSewerDepth)+' мм.';});
 mount.querySelectorAll('[data-stack-step]').forEach(b=>b.onclick=()=>{experience.section=+b.dataset.stackStep;applyFoundationStack();});$('stack-show-all')?.addEventListener('click',()=>{experience.section=8;applyFoundationStack();});
 $('stack-only')?.addEventListener('click',()=>applyFoundationStack(true));
 $('tour-room')?.addEventListener('change',e=>startTour(e.target.value));for(const [id,delta]of [['tour-previous',-1],['tour-next',1]])$(id)?.addEventListener('click',()=>{const rooms=tourStops(),i=rooms.findIndex(r=>r.id===experience.tourRoom);startTour(rooms[(i+delta+rooms.length)%rooms.length].id);});$('tour-interact')?.addEventListener('click',interactNearby);
}
function syncHousePipeButton(){
 const button=$('toggle-house-pipes');
 if(button)button.textContent=servicePipeLayers.some(id=>renderer.layers.get(id)?.visible)?'Скрыть трубы':'Показать трубы';
}
function refreshServiceGeometry(){
 const g=renderer,marker=g.layers.get('services');
 if(marker){drawServiceMarkers(g,marker.visible);g.commitLayer(g.layers.get('services'));}
 const visibility=new Map(servicePipeLayers.map(id=>[id,g.layers.get(id).visible]));drawServiceRoutes(g,visibility.get('sewer3d'));for(const [id,shown] of visibility){const l=g.layers.get(id);l.visible=shown;g.commitLayer(l);}indexSceneObjects(g);if(experience.selected?.startsWith('pipe:')&&g.sceneObjects.has(experience.selected))selectSceneObject(experience.selected);g.request();renderLayerControls();}
function renderCombinedCourseTools(){
 const mount=$('combined-courses');
 mount.hidden=mode!=='masonry3d';
 if(mount.hidden)return;
 const {lower,upper}=ensureCombinedCourses(),count=lower.rows.length+upper.rows.length;
 if(!mount.firstElementChild){
  mount.innerHTML=`
   <label>Этажи<select id="combined-floor"><option value="both">Оба этажа</option><option value="lower">Первый этаж</option><option value="upper">Мансарда</option></select></label>
   <label>Ряды<select id="combined-display"><option value="all">Все сразу</option><option value="upto">До выбранного</option><option value="one">Один ряд</option></select></label>
   <label><span>Сквозной номер ряда · <output id="combined-row-current" for="combined-row"></output></span><input type="range" id="combined-row" min="1" max="${count}"></label>
   <p>1-й этаж: ${lower.rows.length} рядов · ${lower.stock_positions} позиций. Мансарда: ${upper.rows.length} рядов · ${upper.stock_positions} условных позиций (${upper.fragment_count} фрагментов по скатам). Синим — каркас, охрой — подрезки.</p>
   <p class="tiny muted">625×250 / шов2 / постель20 мм — сценарий. Верх мансарды следует оболочке крыши. Верхние перемычки/пояса и пространственная перевязка ещё требуют привязки; раскладка не является рабочей ведомостью.</p>`;
  for(const [id,key,event] of [['combined-floor','scope','change'],['combined-display','courseDisplay','change'],['combined-row','row','input']]){
   $(id).addEventListener(event,e=>{experience[key]=key==='row'?e.target.valueAsNumber:e.target.value;rebuildExperience();});
  }
 }
 $('combined-floor').value=experience.scope;
 $('combined-display').value=experience.courseDisplay;
 $('combined-row').value=experience.row;
 $('combined-row-current').value=`${experience.row} / ${count}`;
}
function rebuildExperience(){const g=renderer,state={yaw:g.yaw,pitch:g.pitch,span:g.span,target:[...g.target],pan:[...g.pan],walk:g.walk?{...g.walk,position:[...g.walk.position]}:null,explode:g.explode,clipZ:g.clipZ};buildScene(mode);Object.assign(g,state);if(g.walk){configureWalk();showTourRoof(g);}g.request();renderExperienceTools();}
function tourStops(){return [{id:'entry',label:'Перед входной дверью'},...MODEL.experience.rooms.map(r=>({id:r.id,label:`${r.floor} этаж · ${r.number}. ${r.name}`}))];}
function tourOptions(){return tourStops().map(s=>`<option value="${s.id}" ${s.id===experience.tourRoom?'selected':''}>${esc(s.label)}</option>`).join('');}
function showTourRoof(g){
 if(mode!=='house')return;
 for(const family of ['rafters','diagonals','purlins','ties','tie-shims','ridge-plates','mauerlat','roof-cleats','window-headers']){
  const id='frame-'+family;
  g.layers.get(id).visible=true;
  g.roofCoverVisibility?.set(id,true);
 }
 renderLayerControls();
 return loadSceneRoofFrame(g);
}
function startTour(roomId='entry',flight=renderer.walk?.flight||false){
 if(mode!=='house'&&!(flight&&mode==='frame'))return buildScene('house',()=>startTour(roomId,flight));
 if(mode==='house'&&renderer.framePending){
  const request=sceneRequest;
  return withResources(['roof-frame'],()=>{
   if(request!==sceneRequest)return;
   renderScene('house');
   return startTour(roomId,flight);
  });
 }
 const entering=!renderer.walk;
 const room=MODEL.experience.rooms.find(r=>r.id===roomId),entry=MODEL.experience.tour_entry;
 experience.tourRoom=room?.id||'entry';
 const eye=room?[...room.point_mm,room.elevation_mm+1650]:[...entry.point_mm],target=room?room.tour_target_mm:entry.target_mm;
 renderer.enterWalk(eye,target?Math.atan2(target[0]-eye[0],target[1]-eye[1]):room.number===11?0:Math.PI/2);
 renderer.walk.flight=flight;
 if(target)renderer.walk.tilt=Math.atan2(target[2]-eye[2],Math.hypot(target[0]-eye[0],target[1]-eye[1]));
 configureWalk();renderer.layers.get('guides').visible=false;
 for(const id of ['bottom','top','chair','beamsteel','edgesteel','services'])if(renderer.layers.has(id))renderer.layers.get(id).visible=false;
 renderer.visibleLabels=false;$('scene-title').textContent=room?`${room.name} · ${fmt(room.area_m2,2)+' м²'}`:'Перед входной дверью';
 renderExperienceTools();if(mode==='frame')renderRoofFrameTools();renderer.canvas.focus({preventScroll:true});renderer.request();
 if(entering)return showTourRoof(renderer);
}
function enterFlight(){
 if(!renderer.walk)return startTour('entry',true);
 renderer.walk.flight=true;renderer.resetInput();renderExperienceTools();
 renderer.canvas.focus({preventScroll:true});renderer.request();
}
function exitTour(){renderer.walk=null;renderer.resetInput();renderer.visibleLabels=true;buildScene(mode);}
function walkFloor(x,y,old){const s=activeStair(),landing=s.landing.bounds_mm.map(Number);if(old>1000&&x>=landing[0]&&x<=landing[3]&&y>=landing[1]&&y<=landing[4])return 1650;for(const flight of s.flights){if(flight.id==='upper'&&old<1000)continue;for(const step of flight.steps){const b=step.bounds_mm.map(Number);if(x>=b[0]&&x<=b[3]&&y>=b[1]&&y<=b[4])return b[2]+20;}}if(old>2500){const [x0,y0,x1,y1]=activeSlab().opening.bounds_mm.map(Number);return x>x0&&x<x1&&y>y0&&y<y1?0:3300;}if(x<6335&&y<6250||x<4215&&y>6650&&y<9070)return -400;return 0;}
function configureWalk(){const g=renderer;g.onExitWalk=exitTour;g.onInteract=interactNearby;const solids=FloorGeometry.solids(MODEL.floor1),envelopes=stairWallEnvelopes();g.walkCollider=(p,old)=>{if(p[0]<-4000||p[0]>19000||p[1]<-6000||p[1]>18500)return false;const oldFoot=old[2]-1650,floor=walkFloor(p[0],p[1],oldFoot);if(Math.abs(floor-oldFoot)>430)return false;p[2]=floor+1650;for(const e of envelopes)if(HouseGL.inside(p,e.foot)){const ceiling=HouseShapes.z(e.plane,p);if(floor<ceiling&&p[2]>ceiling-40)return false;}const radius=105,z=floor+950;
 if(floor<3020){for(const s of solids){const b=s.bounds;const top=wallTopAt(s.wall_id,Math.max(b[0]+.001,Math.min(b[3]-.001,p[0])),Math.max(b[1]+.001,Math.min(b[4]-.001,p[1])),b[5]);if(p[0]>b[0]-radius&&p[0]<b[3]+radius&&p[1]>b[1]-radius&&p[1]<b[4]+radius&&floor+150>b[2]&&floor+150<top)return false;}}
 else {for(const mesh of MODEL.floor2.mesh_prisms){if(HouseGL.inside(p,mesh.polygon_mm)&&z>HouseShapes.z(mesh.bottom_plane,p)&&z<HouseShapes.z(mesh.top_plane,p))return false;}const roof=MODEL.roof_geometry.eave_junctions.wall_caps.find(c=>HouseGL.inside(p,c.polygon_mm));if(roof&&p[2]>HouseShapes.z(roof.plane,p)-atticLiningDepth()*Math.hypot(...roof.plane.slice(0,2),1))return false;}
 for(const b of [...(g.fixtureBounds||[]).map(item=>item.bounds_mm),...g.interiorObstacles,...g.stairBarriers]){if(p[0]>b[0]-radius&&p[0]<b[3]+radius&&p[1]>b[1]-radius&&p[1]<b[4]+radius&&floor+150>b[2]&&floor+150<b[5])return false;}
 if(g.stairWcReturn&&HouseGL.inside(p,g.stairWcReturn.foot)&&floor+150<HouseShapes.z(g.stairWcReturn.top,p))return false;
 const apron=g.stairWcApron;
 if(apron&&floor<apron.top_plane[2]&&HouseGL.inside(p,apron.polygon_mm)&&p[2]>HouseShapes.z(apron.bottom_plane,p)-40)return false;
 for(const {a,b} of g.guardRuns){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  const base=a[2]+(b[2]-a[2])*t;
  if(floor+150<base+1000&&p[2]>base&&Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)<radius+10)return false;
 }
 for(const s of g.openings){
  for(const {a,b,top} of s.panelBarriers||[]){
   if(p[2]<=a[2]||floor+150>=top)continue;
   const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
   if(Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<radius+22)return false;
  }
  if(!s.door||experience.open.has(s.id))continue;const b=s.b;const top=wallTopAt(s.wall.id,Math.max(b[0]+.001,Math.min(b[3]-.001,p[0])),Math.max(b[1]+.001,Math.min(b[4]-.001,p[1])),b[5]);if(p[0]>b[0]-radius&&p[0]<b[3]+radius&&p[1]>b[1]-radius&&p[1]<b[4]+radius&&floor+150>b[2]&&floor+150<top)return false;}return true;};}
function interactNearby(){if(!renderer.walk)return;const p=renderer.walk.position;const near=(renderer.openings||[]).filter(s=>s.openable).map(s=>({s,d:Math.hypot((s.b[0]+s.b[3])/2-p[0],(s.b[1]+s.b[4])/2-p[1],(s.b[2]+s.b[5])/2-p[2])})).sort((a,b)=>a.d-b.d)[0];if(near?.d<2200)toggleOpening(near.s.id);else toast('Рядом нет створки. Подойдите к двери или окну.');}
function handleExperiencePick(id){if(id.startsWith('fixture:')||id.startsWith('sauna:')||id.startsWith('appliance:')||id.startsWith('frame-window:')){selectSceneObject(id);return true;}if(id.startsWith('leaf:')&&!experience.objectMode){toggleOpening(id);return true;}if(experience.objectMode||id.startsWith('room:')||id.startsWith('pipe:')||id.startsWith('sleeve:')||id.startsWith('vent:')||id.startsWith('decor:')||id.startsWith('facade:')||id.startsWith('course:')||['groundTextile','polyethylene','septic'].includes(id)){selectSceneObject(id);return true;}return false;}
let roofWindowCache=null;
function roofWindowSpecs(){if(roofWindowCache)return roofWindowCache;const locations=MODEL.experience.roof_windows||[];roofWindowCache=locations.map((location,index)=>{const [x,y]=location.centre_xy_mm,cell=MODEL.roof_geometry.cells.find(c=>HouseGL.inside([x,y],c.polygon_mm));if(!cell)return null;const [a,b,c]=cell.plane,gradient=Math.hypot(a,b),u=gradient>1e-6?[-b/gradient,a/gradient,0]:[1,0,0],v=gradient>1e-6?[-a/gradient,-b/gradient,-gradient]:[0,1,0],len=Math.hypot(...v);for(let i=0;i<3;i++)v[i]/=len;const centre=[x,y,a*x+b*y+c],width=n('window.ОК-11.block_width'),height=n('window.ОК-11.block_height'),point=(du,dv)=>centre.map((q,i)=>q+u[i]*du+v[i]*dv),polygon=[point(-width/2-17.5,-height/2-17.5),point(width/2+17.5,-height/2-17.5),point(width/2+17.5,height/2+17.5),point(-width/2-17.5,height/2+17.5)];return {id:'leaf:roof-'+(index+1),location,floor:2,wall:{id:'roof-window'},roofWindow:true,openable:true,door:false,cell,centre,u,v,width,height,point,polygon,b:[0,1,2].map(i=>Math.min(...polygon.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...polygon.map(p=>p[i])))),opening:{label:'Мансардное окно ОК-11 · '+(index+1)}};}).filter(Boolean);return roofWindowCache;}
function cutRoofCell(cell){
 let pieces=[cell.polygon_mm.map(p=>p.slice(0,2))];
 for(const hole of roofShaftOpenings())pieces=pieces.flatMap(poly=>HouseShapes.subtract(poly,hole));
 for(const s of roofWindowSpecs())pieces=pieces.flatMap(poly=>HouseShapes.subtract(poly,s.polygon.map(p=>p.slice(0,2))));
 return pieces.map(poly=>poly.map(p=>[...p,HouseShapes.z(cell.plane,p)]));
}
function drawRoofWindows(g,commit=false){
 const visible=['house','roof','frame'].includes(mode),options=commit?{}:{visible,explodeOrder:4};
 const frames=g.resetLayer('roofWindowFrames',[.26,.22,.19],{...options,dependsOn:'roof'});
 const leaves=g.resetLayer('roofWindowLeaves',[.32,.27,.22],{...options,dependsOn:'roof'});
 const glass=g.resetLayer('roofWindowGlass',[.41,.62,.69],{...options,...(commit?{}:{opacity:.4}),order:22,showEdges:false,dependsOn:'roof'});
 for(const s of roofWindowSpecs()){
  if(!g.openings.some(o=>o.id===s.id))g.openings.push(s);
  const raw=[-s.cell.plane[0],-s.cell.plane[1],1],normal=raw.map(v=>v/Math.hypot(...raw));
  const point=(u,v,z)=>s.centre.map((q,i)=>q+s.u[i]*u+s.v[i]*v+normal[i]*z);
  const angle=experience.open.has(s.id)?Math.PI/4:0;
  // АР-22, item 10: the sash pivots about its middle transverse axis.
  const sash=(u,v,z)=>point(u,v*Math.cos(angle)-z*Math.sin(angle),20+v*Math.sin(angle)+z*Math.cos(angle));
  const rectangle=(w,h,at,z)=>[[-w,-h],[w,-h],[w,h],[-w,h]].map(([u,v])=>at(u/2,v/2,z));
  const ring=(layer,outer,inner)=>{
   for(let i=0;i<4;i++){const j=(i+1)%4;g.face(layer,[outer[i],outer[j],inner[j],inner[i]],null,s.id);}
  };
  const rim=(layer,w,h,section,at,bottom,top)=>{
   const outer=rectangle(w,h,at,top),inner=rectangle(w-2*section,h-2*section,at,top);
   const under=rectangle(w,h,at,bottom),reveal=rectangle(w-2*section,h-2*section,at,bottom);
   ring(layer,outer,inner);ring(layer,under,reveal);ring(layer,outer,under);ring(layer,inner,reveal);
  };
  ring(frames,s.polygon,rectangle(s.width,s.height,point,0));
  rim(frames,s.width,s.height,55,point,-30,30);
  const w=s.width-110,h=s.height-110;
  rim(leaves,w,h,45,sash,-20,20);
  g.face(glass,rectangle(w-90,h-90,sash,0),null,s.id);
  expInfo(g,s.id,{title:s.opening.label,status:'source_block_conditional_roof_location',
   facts:[...s.location.input_fact_ids,'roof.fakro.part10.description'],
   note:s.location.note+' Среднеповоротная створка и узел примыкания показаны на АР-22.',
   sheets:[['house_1',7],['house_1',9],['house_2',22],['house_1',14],['house_1',18],['house_1',23]]});
 }
 if(commit)for(const layer of [frames,leaves,glass])g.commitLayer(layer);
}
function stairWallEnvelopes(){const s=activeStair(),out=[];for(const f of s.flights){const rule=f.geometry_rule,origin=Number(rule.origin_x_mm),run=Number(f.plan_run_mm),direction=rule.direction_x,ratio=n('stairs.Лм1.section.riser')/n('stairs.Лм1.section.tread'),a=ratio/direction,c=Number(rule.base_mm)-n('stairs.Лм1.section.riser')-a*origin-rule.normal_thickness_mm*Math.sqrt(1+ratio*ratio),x0=Math.min(origin,origin+direction*run),x1=Math.max(origin,origin+direction*run),[y0,y1]=f.y_bounds_mm.map(Number);out.push({foot:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],plane:[a,0,c]});}const b=s.landing.bounds_mm.map(Number);out.push({foot:[[b[0],b[1]],[b[3],b[1]],[b[3],b[4]],[b[0],b[4]]],plane:[0,0,b[2]]});return out;}
function stairWallCuts(wall){
 const envelopes=stairWallEnvelopes();
 if(wall!=='boiler')return envelopes;
 const [lower,upper]=envelopes;
 // The boiler partition continues through the gap between the two flights.
 // Its short end at the landing follows the upper string, including in the collision mesh.
 const y0=lower.foot[2][1],y1=upper.foot[0][1],x0=upper.foot[0][0],x1=upper.foot[1][0];
 return [...envelopes,{foot:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],plane:upper.plane}];
}
function intersectConvex(poly,foot){let out=poly;for(let i=0;i<foot.length;i++){const a=foot[i],b=foot[(i+1)%foot.length],dx=b[0]-a[0],dy=b[1]-a[1];out=HouseShapes.clip(out,[-dy,dx,dy*a[0]-dx*a[1]]);}return out;}
function stairWallPatches(bounds,wall){const rect=[[bounds[0],bounds[1]],[bounds[3],bounds[1]],[bounds[3],bounds[4]],[bounds[0],bounds[4]]];let pieces=[{polygon_mm:rect,bottom_plane:[0,0,bounds[2]],top_plane:[0,0,bounds[5]]}];if(wall==='wc2-frame'){pieces[0].top_plane=stairWallEnvelopes()[1].plane;return pieces;}if(!['bearing3','boiler'].includes(wall))return pieces;for(const envelope of stairWallCuts(wall)){const next=[];for(const p of pieces){for(const polygon of HouseShapes.subtract(p.polygon_mm,envelope.foot))next.push({...p,polygon_mm:polygon});const inside=intersectConvex(p.polygon_mm,envelope.foot);if(inside.length<3)continue;const delta=envelope.plane.map((v,i)=>v-p.top_plane[i]),oldPart=HouseShapes.clip(inside,delta),cutPart=HouseShapes.clip(inside,delta.map(v=>-v));for(const [foot,top]of [[oldPart,p.top_plane],[cutPart,envelope.plane]]){const polygon=HouseShapes.clip(foot,top.map((v,i)=>v-p.bottom_plane[i]));if(polygon.length>=3&&HouseShapes.area(polygon)>1e-5&&polygon.some(q=>HouseShapes.z(top,q)>HouseShapes.z(p.bottom_plane,q)+1e-5))next.push({...p,polygon_mm:polygon,top_plane:top});}}pieces=next;}return pieces;}
function wallTopAt(wall,x,y,top){if(wall==='wc2-frame')return Math.min(top,HouseShapes.z(stairWallEnvelopes()[1].plane,[x,y]));if(!['bearing3','boiler'].includes(wall))return top;for(const e of stairWallCuts(wall))if(HouseGL.inside([x,y],e.foot))top=Math.min(top,HouseShapes.z(e.plane,[x,y]));return top;}
function drawStairAwareBox(g,l,bounds,id,edges=false){const wall=id?.startsWith('wall:')?id.slice(5):id?.startsWith('course:lower:')?id.split(':')[3]:null;if(!['bearing3','boiler','wc2-frame'].includes(wall)){g.box(l,...bounds,id,edges);return;}for(const piece of stairWallPatches(bounds,wall))HouseShapes.prism(g,l,piece,id);}
function inspectExperienceLayer(id){const ids=['roomFloors','openingFrames1','openingFrames2','openingLeaves1','openingLeaves2','glass1','glass2','roofWindowFrames','roofWindowLeaves','roofWindowGlass','facade','mouldings','vents','ventCaps','saunaWood','saunaBenches','saunaStove','saunaStones','appliances','applianceTrim',...servicePipeLayers,'courseFull','courseCuts','courseFrame'];if(!ids.includes(id)&&!/^fixture/.test(id))return false;const object=[...(renderer.sceneObjects?.values()||[])].find(o=>o.layer===id||o.faces.some(f=>f.layer===id));if(object)selectSceneObject(object.id);else $('inspector').innerHTML=`<h3>${esc(LAYER_META[id]?.[0]||id)}</h3><p>Слой пуст в этом режиме. Выберите соответствующий этаж или общий вид дома.</p>`;return true;}

/* Layer display and dimensioned service plan for the current slab revision. */
const foundationLayers=[
 ['groundTextile','Геотекстиль','300 г/м²','На уплотнённом основании','−1,250 м',-1250],
 ['gravel20','Щебень 20–40','200 мм','Крупная фракция основания','−1,250…−1,050 м',-1150],
 ['gravel5','Щебень 5–10','200 мм','Мелкая фракция над крупной','−1,050…−0,850 м',-950],
 ['polyethylene','Армированный полиэтилен','Плёнка','Между щебнем и подготовкой','−0,850 м',-850],
 ['blinding','Бетонная подготовка В10','50 мм','Основание под гидроизоляцию','−0,850…−0,800 м',-825],
 ['membrane','Рулонная гидроизоляция','1 слой','Между подготовкой и плитой','−0,800 м',-800],
 ['slab','Плита В25','300 мм','Внутри расположены нижняя и верхняя сетки','−0,800…−0,500 м',-650],
 ['beams','Ростверки В25','370 мм','Над плитой по контуру несущих стен','−0,500…−0,130 м',-315]
];
function foundationStudyTools(){
 const host=$('foundation-study');
 host.hidden=!['foundation','foundation-stack','services3d','rebar'].includes(mode);
 if(host.hidden)return;
 host.innerHTML='<button data-study="foundation">В сборе</button><button data-study="foundation-stack">Слои в разрезе</button><button data-study="bottom">Нижняя сетка</button><button data-study="top">Верхняя сетка</button><button data-study="anchors">Размеры закладных</button>';
 host.querySelectorAll('button').forEach(b=>{
  const key=b.dataset.study,mesh=['bottom','top'].includes(key),family=key==='bottom'?'1':'2';
  b.setAttribute('aria-pressed',String(mesh?mode==='rebar'&&foundationRebarState.family===family:mode===key));
  b.onclick=()=>{
   if(key==='anchors'){openServicePlan(experience.waterCorner);return;}
   if(mesh){foundationRebarState.family=family;foundationRebarState.selected=null;buildScene('rebar');return;}
   buildScene(key);
  };
 });
}
function foundationStackHTML(){
 return `<div class="foundation-stack"><b>Сборка фундамента снизу вверх</b><div class="stack-steps">${foundationLayers.map(([id,title,size,purpose,z],i)=>{
  const color=renderer.layers.get(id).color.map(v=>Math.round(v*255)).join(',');
  return `<button data-stack-step="${i+1}" style="--layer-color:rgb(${color})" aria-pressed="${experience.section===i+1}" class="${experience.section===i+1?'active':''}"><b>${i+1}. ${title} · ${size}</b><small>${z}</small></button>`;
 }).join('')}</div><p>${foundationLayers[experience.section-1][3]}. Отметки даны для собранного фундамента.</p><div class="buttons-row"><button id="stack-only">Только выбранный слой</button><button id="stack-show-all">Показать все восемь</button>${sheetBtn('house_2',8,'Сечения КЖ-3')}</div></div>`;
}
function applyFoundationStack(only=false){
 if(mode!=='foundation-stack'){
  const step=experience.section;
  buildScene('foundation-stack');experience.section=step;
 }
 foundationLayers.forEach(([id],i)=>{renderer.layers.get(id).visible=only?i+1===experience.section:i<experience.section;});
 const current=foundationLayers[experience.section-1];
 inspect(current[0]);renderExperienceTools();renderLayerControls();renderer.request();
}
function servicePlacement(s,corner){
 if(s.id!=='В1-1'||!corner)return s;
 const w=DATA.water_proposal??MODEL.experience.water_proposal,[x,y]=w.point_mm;
 return {...s,x_mm:x,y_mm:y,anchor_x:w.anchor_x,anchor_y:w.anchor_y,offset_x_mm:w.offset_x_mm,offset_y_mm:w.offset_y_mm,formula:w.formula,proposal:true};
}
function openServicePlan(corner=true,first='К1-1'){
 const drawing=corner?DATA.revisions['embeds:1'].image:DATA.images['embeds:1'];
 return prepareDialog(['foundation','services','facts'],()=>renderServicePlan(corner,first),drawing);
}
function renderServicePlan(corner,first){
 const sites=MODEL.services.map(s=>servicePlacement(s,corner));
 const options=sites.map(s=>`<option value="${s.id}">${esc(s.label)}${s.id==='В1-1'?(s.proposal?' · перенос к Е':' · ВК-1'):''}</option>`).join('');
 showDialog('ФУНДАМЕНТ / ВК-1','Размеры закладных',`<div class="service-measure-inputs">${['А','Б'].map((name,i)=>`<label>Точка ${name}<select data-site="${i}"><option disabled value="">На плане</option>${options}</select></label>`).join('')}</div><div class="plan-ruler-tools"></div><div class="binding-layout"><div class="sheet-canvas"></div><div class="binding-summary" id="service-distances"></div></div><p class="tiny muted">Показана ${corner?'редакция ВК-1 с принятым вводом В1 у оси Е':'исходная ВК-1 с вводом В1 у оси Г'}. Привязки даны до центров гильз. Высотные отметки труб неизвестны. Для осей X использована сумма частей 13 870 мм, на листе также указан общий размер 13 865 мм.</p><button data-sheet="embeds:1" data-edition="revision">Открыть полный ВК-1 и PDF</button>`);
 const body=$('dialog-body'),selectors=[...body.querySelectorAll('[data-site]')];
 const point=s=>({p:[+s.x_mm,+s.y_mm],site:s,kind:s.label});
 function update(points){
  const [a,b]=points;
  selectors.forEach((el,i)=>{el.value=points[i]?.site?.id||'';});
  const summary=$('service-distances');
  if(!a||!b){summary.textContent='Выберите две точки на плане или из списков.';return;}
  const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1];
  const bindings=points.map(({site:s,p},i)=>{
   const name=i?'Б':'А';
   if(!s)return `<article><b>${name} · Точка на плане</b><p>X ≈ ${fmt(p[0],0)} мм<br>Y ≈ ${fmt(p[1],0)} мм</p></article>`;
   return `<article><b>${name} · ${esc(s.label)}${s.proposal?' · перенос к Е':''}</b><p>От оси ${s.anchor_x} · ${fmt(Math.abs(s.offset_x_mm))} мм ${s.offset_x_mm>=0?'вправо':'влево'}<br>От оси ${s.anchor_y} · ${fmt(Math.abs(s.offset_y_mm))} мм ${s.offset_y_mm>=0?'к И':'к А'}</p>${s.proposal?'Решение владельца от 18.11.2026':factBtn('service.'+s.id+'.offset_from_'+s.anchor_x,'Привязка X')+' '+factBtn('service.'+s.id+'.offset_from_'+s.anchor_y,'Привязка Y')}</article>`;
  }).join('');
  const edge=Math.min(...core.map((p,i)=>{const q=core[(i+1)%core.length],t=rulerFraction(...a.p,p,q);return Math.hypot(...p.map((n,k)=>n+t*(q[k]-n)-a.p[k]));}));
  const selectedCenters=!!(a.site&&b.site);
  summary.innerHTML=`<small>Между А и Б в плане</small><p><strong>${selectedCenters?'':'≈ '}${fmt(Math.hypot(dx,dy),selectedCenters?2:0)} мм</strong></p><p>ΔX ${fmt(dx,0)} мм · ΔY ${fmt(dy,0)} мм</p>${bindings}<article>От А до ближайшего края плиты<br><b>${fmt(edge,1)} мм</b></article>`;
 }
 const ruler=new SheetRuler(body.querySelector('.sheet-canvas'),body.querySelector('.plan-ruler-tools'),'embeds:1',{crop:true,sites,onChange:update,sourceImage:corner?null:DATA.images['embeds:1']});
 activeSheetRuler=ruler;ruler.mode.value='snap';ruler.markSites();ruler.enable(true);
 const start=sites.find(s=>s.id===first)||sites[0];ruler.points=[point(start),point(sites.find(s=>s!==start))];ruler.refresh();
 selectors.forEach((el,i)=>el.onchange=()=>{
  const s=sites.find(s=>s.id===el.value);if(!s)return;
  ruler.enable(true);
  if(i===1&&!ruler.points[0])ruler.points[0]=point(sites.find(site=>site!==s));
  ruler.points[i]=point(s);ruler.refresh();
 });
}
function loadComparisonHTML(){
 const q=MODEL.foundation.load_comparison;
 return `<div class="card"><h3>Нагрузка от собственного веса</h3><p>${esc(q.assumptions)} Плита Пм1, два пояса, лестница и перемычки добавляют ${fmt(q.upper_RC_volume_m3)} м³ железобетона. Для Пм1 взято 29 м³ из ведомости, открыто расхождение I020.</p><div class="table-wrap"><table><thead><tr><th>Контур</th><th>Вес Фм 1, кН</th><th>Фм 1 / площадь, кПа</th><th>С учтённым ж/б дома, кПа</th></tr></thead><tbody>${q.rows.map((r,i)=>`<tr><td>${r.label}</td>${[r.fm1_kN,r.fm1_kPa,r.partial_kPa].map(v=>i?'<td class="updated">'+fmt(v,2)+'</td>':'<td><del>'+fmt(v,2)+'</del></td>').join('')}</tr>`).join('')}</tbody></table></div><p>Вне суммы остались стены, крыша, отделка, площадки, люди, оборудование и снег. Это частичный сбор вертикальных нагрузок на уровне низа плиты. Давление у края, осадки, изгиб, продавливание и армирование требуют расчёта взаимодействия дома с грунтом.</p><details><summary>Формула и исходные объёмы</summary><p>${esc(q.formula)}</p>${q.upper_source_fact_ids.map(i=>factBtn(i,FACTS.get(i).label+' · '+moneyless(i))).join('<br>')}</details></div>`;
}

/* Display-only junctions. Source solids, quantities and course scenarios stay
 * separate from these architectural skins and material rendering priorities. */
function ventBodyBounds(body){const b=body.bounds_mm.map(Number);return [b[0],b[1],Number(MODEL.slab2.bottom_mm),b[2],b[3],n('vent.ВК-'+body.id.slice(4)+'.top_elevation')*1000-200];}
function vk2InsulationPrisms(){
 const shaft=MODEL.roof_frame?.shaft_clearances.vent2??DATA.roof_envelope.vk2_shaft;
 const cell=MODEL.roof_geometry.cells.find(c=>c.facet_id==='main_запад');
 const top=n('vent.ВК-2.top_elevation')*1000-200;
 const outer=roofContactRect(shaft.insulated_bounds_mm),inner=roofContactRect(shaft.shaft_bounds_mm);
 return HouseShapes.subtract(outer,inner).map(foot=>({polygon_mm:foot,bottom_plane:cell.plane,top_plane:[0,0,top]}));
}
function wallFaceOutsideVents(points){
 if(mode!=='house')return [points];
 const axis=[0,1,2].find(i=>Math.max(...points.map(p=>p[i]))-Math.min(...points.map(p=>p[i]))<1e-6);
 if(axis===undefined)return [points];
 const value=points[0][axis],uv=[0,1,2].filter(i=>i!==axis);let polygons=[points.map(p=>uv.map(i=>p[i]))];
 for(const body of MODEL.floor1.brick_envelopes){const b=ventBodyBounds(body);if(![b[axis],b[axis+3]].some(v=>Math.abs(v-value)<1e-5))continue;const cut=[[b[uv[0]],b[uv[1]]],[b[uv[0]+3],b[uv[1]]],[b[uv[0]+3],b[uv[1]+3]],[b[uv[0]],b[uv[1]+3]]];polygons=polygons.flatMap(p=>HouseShapes.subtract(p,cut));}
 return polygons.map(poly=>poly.map(p=>{const q=[];q[axis]=value;q[uv[0]]=p[0];q[uv[1]]=p[1];return q;}));
}
function drawUpperWallFace(g,layer,points,normal,id){for(const poly of wallFaceOutsideVents(points))g.face(layer,poly,normal,id);}
// The AR-8 planes are the exterior skin. Keep the visible solids behind the
// OSB shown on KD-4, including at hips and below the dormer overhangs.
function roofDeckDrop(plane){return n('roof.osb.thickness')*Math.hypot(plane[0],plane[1],1);}
function wallEavePieces(piece){
 const cap=MODEL.roof_geometry.eave_junctions.wall_caps.find(c=>c.id===(piece.roof_cap_id||piece.roof_cell_id));
 if(!cap)return [piece];
 const fit=MODEL.floor2.masonry_frame_fit?.[piece.wall_id];
 // The two attic masonry heads use the lining instead of the membrane.
 // Their masonry bearings remain governed by the pockets on the wall solids.
 const depth=fit?.roof_normal_depth_mm??(piece.material==='aac'?roofPacketDepth():n('roof.osb.thickness'));
 const [a,b,c]=cap.plane;
 const parts=wallAtLimit(piece,piece.polygon_mm,[a,b,c-depth*Math.hypot(a,b,1)],true);
 return fit?wallBelowDiagonals(parts,fit):parts;
}
let masonryRoofHeads;
function masonryRoofHeadSolids(){
 return masonryRoofHeads??=MODEL.floor2.mesh_prisms.filter(p=>p.material==='aac')
  .flatMap(wallEavePieces).map(p=>roofContactPrism(p.wall_id,'wall',p.polygon_mm,p.bottom_plane,p.top_plane));
}
// These frame partitions and posts occupy the same bay on the aligned
// AR-4 / KD-2 model. Keep the architectural wall volume between timbers.
const atticPartitionTimber={
 'upper-15-north':['purlin-19'],
 'upper-17-16-west':['post-4','bed-post-4','purlin-10'],
 'upper-17-south':['support18-e','bed-support18-e'],
 'upper-18-south':['support18-w','bed-support18-w'],
 'upper-wc-east':['post-1','bed-post-1','purlin-7'],
};
// On KD-2 these runs continue through the gables and across axes G and E.
const masonryTimberPassages={
 'upper-ext1':['purlin-8'],
 'upper-ext3':['purlin-9'],
 'upper-ext6':['purlin-10'],
 'upper-ext9':['purlin-11'],
 'upper-bearingГ':['purlin-8'],
 'upper-bearingЕ':['purlin-7'],
};
const frameSceneBoxes=new Map();
function frameSceneBox(id){
 if(!frameSceneBoxes.has(id)){
  const points=frameDisplaySolids(roofFrameMember(id)).flatMap(({faces})=>faces.flat());
  const low=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),high=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
  frameSceneBoxes.set(id,points.length?low.concat(high):null);
 }
 return frameSceneBoxes.get(id);
}
function wallAtLimit(piece,foot,height,top){
 const face=top?'top_plane':'bottom_plane',opposite=top?'bottom_plane':'top_plane',sign=top?1:-1;
 const delta=height.map((v,i)=>sign*(v-piece[face][i]));
 if(foot.every(p=>HouseShapes.z(delta,p)>=-1e-6))return [{...piece,polygon_mm:foot}];
 const unchanged=HouseShapes.clip(foot,delta);
 let limited=HouseShapes.clip(foot,delta.map(v=>-v));
 limited=HouseShapes.clip(limited,height.map((v,i)=>sign*(v-piece[opposite][i])));
 const parts=[];
 if(HouseShapes.area(unchanged)>.001)parts.push({...piece,polygon_mm:unchanged});
 if(HouseShapes.area(limited)>.001&&limited.some(p=>sign*(HouseShapes.z(height,p)-HouseShapes.z(piece[opposite],p))>.001)){
  parts.push({...piece,polygon_mm:limited,[face]:height});
 }
 return parts;
}
function roofBeltInsulationPrisms(strip){
 const piece={polygon_mm:roofContactRect(strip.bounds_mm),bottom_plane:[0,0,strip.bottom_mm],top_plane:[0,0,strip.top_mm]};
 return strip.top_limit_plane?wallAtLimit(piece,piece.polygon_mm,strip.top_limit_plane,true):[piece];
}
function wallOutsideBox(piece,[x0,y0,z0,x1,y1,z1],upper=[0,0,z1]){
 const foot=piece.polygon_mm;
 if(foot.every(p=>HouseShapes.z(piece.top_plane,p)<=z0+1e-6)||foot.every(p=>HouseShapes.z(piece.bottom_plane,p)>=z1-1e-6))return [piece];
 const rect=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],inside=intersectConvex(foot,rect);
 if(HouseShapes.area(inside)<=.001)return [piece];
 return [...HouseShapes.subtract(foot,rect).map(p=>({...piece,polygon_mm:p})),
  ...wallAtLimit(piece,inside,[0,0,z0],true),...wallAtLimit(piece,inside,upper,false)];
}
let atticDiagonalUndersides;
function wallBelowDiagonals(parts,fit=null){
 if(!MODEL.roof_frame)return parts;
 atticDiagonalUndersides??=MODEL.roof_frame.members.filter(m=>m.family==='diagonals').flatMap(m=>
  frameDisplaySolids(m).flatMap(({faces})=>roofContactSolid(m.id,m.family,faces).sides.flatMap(({plane:[a,b,c,d],face})=>{
   if(c<=1e-6)return [];
   const foot=face.map(p=>p.slice(0,2)).filter(([x,y],i,ring)=>{
    const [u,v]=ring[(i+ring.length-1)%ring.length];
    return Math.hypot(x-u,y-v)>1e-6;
   });
   const winding=foot.reduce((area,[x,y],i)=>{
    const [u,v]=foot[(i+1)%foot.length];
    return area+x*v-y*u;
   },0);
   if(Math.abs(winding)<=.002)return [];
   if(winding<0)foot.reverse();
   return [{foot,height:[-a/c,-b/c,-d/c],id:m.id}];
  })));
 const clearance=fit?.detail_clearance_mm??0;
 for(const {id,foot,height} of atticDiagonalUndersides){
  if(fit&&id!==fit.diagonal_id)continue;
  let recess=foot;
  if(clearance){
   const x=foot.map(p=>p[0]),y=foot.map(p=>p[1]);
   recess=roofContactRect([Math.min(...x)-clearance,Math.min(...y)-clearance,Math.max(...x)+clearance,Math.max(...y)+clearance]);
   for(let i=0;i<foot.length;i++){
    const [ax,ay]=foot[i],[bx,by]=foot[(i+1)%foot.length],dx=bx-ax,dy=by-ay;
    recess=HouseShapes.clip(recess,[-dy,dx,dy*ax-dx*ay+clearance*Math.hypot(dx,dy)]);
   }
  }
  const limit=[height[0],height[1],height[2]-clearance];
  parts=parts.flatMap(piece=>{
   const inside=intersectConvex(piece.polygon_mm,recess);
   if(HouseShapes.area(inside)<=.001||inside.every(p=>HouseShapes.z(piece.top_plane,p)<=HouseShapes.z(limit,p)+1e-6))return [piece];
   return [...HouseShapes.subtract(piece.polygon_mm,recess).map(p=>({...piece,polygon_mm:p})),
    ...wallAtLimit(piece,inside,limit,true)];
  });
 }
 return parts;
}
function wallDisplayPieces(piece,{ridgeRecess=true,transferPockets=true}={}){
 let parts=wallEavePieces(piece);
 if(['frame','house','floor2'].includes(mode)){
  for(const shaft of MODEL.floor1.brick_envelopes){
   const bounds=ventBodyBounds(shaft);
   parts=parts.flatMap(part=>wallOutsideBox(part,bounds));
  }
 }
 if(!MODEL.roof_frame||!['frame','house'].includes(mode))return parts;
 if(transferPockets&&piece.wall_id==='upper-18-south'){
  for(const pocket of MODEL.roof_frame.north_dormer_transfer?.partition_pockets_mm??[]){
   parts=parts.flatMap(part=>wallOutsideBox(part,pocket));
  }
 }
 const junctions=piece.material==='frame'?atticPartitionTimber:masonryTimberPassages;
 const timber=[...(junctions[piece.wall_id]??[])];
 if(piece.wall_id==='upper-15-north')timber.push(...MODEL.roof_frame.members
  .filter(m=>m.post_base_plate?.side==='south').map(m=>m.id));
 if(piece.wall_id==='upper-wc-east')timber.push(...MODEL.roof_frame.members
  .filter(m=>m.ridge_bearing_cap?.wall_id===piece.wall_id).map(m=>m.id));
 for(const id of timber){
  const member=roofFrameMember(id),box=frameSceneBox(id);
  if(!box)continue;
  const ridge=member.ridge_wall_clearance;
  const cap=member.ridge_bearing_cap;
  const bayPurlinGap=id==='purlin-10'&&piece.wall_id==='upper-17-16-west'?25:0;
  const clearance=cap?5:ridge?.around_mm??member.dormer_bearing?.partition_clearance_mm??member.central_bearing?.clearance_mm??bayPurlinGap;
  const recess=box.map((v,i)=>v+(i<3?-clearance:clearance));
  if(ridge?.wall_ids.includes(piece.wall_id))recess[2]=box[2]-ridge.below_mm;
  if(cap)recess[2]=box[2]-25;
  parts=parts.flatMap(p=>wallOutsideBox(p,recess,member.diagonal_post_head?.plane));
 }
 const gable=MODEL.roof_frame.north_gable_ridge;
 if(ridgeRecess&&gable?.wall_id===piece.wall_id&&gable.recess_depth_mm>0){
  parts=parts.flatMap(p=>wallOutsideBox(p,gable.recess_bounds_mm));
 }
 // The frame partitions stop below the deeper timber wherever it projects
 // under the lining. The masonry and concrete bearings have their own detail.
 if(piece.material!=='frame')return parts;
 parts=wallBelowDiagonals(parts);
 if(['upper-wc-east','upper-wc-north'].includes(piece.wall_id)){
  for(const diagonal_id of ['diagonal-1','diagonal-2'])parts=wallBelowDiagonals(parts,{diagonal_id,detail_clearance_mm:25});
 }
 if(piece.wall_id==='upper-17-south'){
  parts=wallBelowDiagonals(parts,{diagonal_id:'diagonal-9',detail_clearance_mm:25});
 }
 return parts;
}
function drawDoorThresholds(g){
 const l=addLayer(g,'doorThresholds',{order:21,showEdges:false});LAYER_META.doorThresholds=['Пороги и примыкания дверей · визуальный вариант',[.65,.65,.58]];l.color=[.65,.65,.58];
 for(const s of g.openings.filter(s=>s.door&&!s.gate)){
  if(mode!=='house'&&mode!=='floor'+s.floor)continue;
  const [lo,hi,bottom,,centre]=s.range,external=s.wall.id.startsWith(s.floor===1?'ext':'upper-ext'),b=s.b,a=s.axis,c=s.cross;
  if(s.opening.id==='d-entry'){
   const walls=MODEL.floor1.walls.filter(w=>w.id.startsWith('ext')),run=facadeRun(walls,extNormals,walls.indexOf(s.wall));
   const id='threshold:'+s.opening.id,face=run.face,back=centre+35,nose=face-30;
   // The solid base ends flush with the finished wall. Only the bevelled
   // cover has a projecting lip; the main door swings clear of its top.
   g.box(l,lo,face,Number(s.wall.base_mm),hi,back,bottom,id,false);
   const section=[[nose,bottom-4],[back,bottom-4],[back,bottom+8],[nose+8,bottom+8],[nose,bottom+2]];
   const left=section.map(([y,z])=>[lo,y,z]),right=section.map(([y,z])=>[hi,y,z]);
   g.face(l,left,null,id);g.face(l,right.slice().reverse(),null,id);
   left.forEach((p,i)=>{const j=(i+1)%left.length;g.face(l,[p,left[j],right[j],right[i]],null,id);});
   expInfo(g,id,{title:'Декоративный порог входной двери',status:'display_threshold_not_construction_detail',facts:['door.1.block_width'],note:'Накладка с фаской в ширину дверного блока. Вынос 30 мм и высота 8 мм — условные размеры отделки.'});
   continue;
  }
  let c0=centre-100,c1=centre+100;if(external){const wr=s.wall.bounds_mm.map(Number),normal=(s.floor===1?extNormals:upperNormals)[+s.wall.id.match(/\d+$/)[0]-1];c0=wr[c]-(normal[c]<0?205:0);c1=wr[c+2]+(normal[c]>0?205:0);}
  const top=bottom+(external?12:4),base=bottom-(external?50:25),bounds=a===0?[lo+60,c0,base,hi-60,c1,top]:[c0,lo+60,base,c1,hi-60,top],id='threshold:'+s.opening.id;
  g.box(l,...bounds,id,false);expInfo(g,id,{title:'Порог · '+s.opening.label,status:'display_threshold_not_construction_detail',facts:s.prefix?[s.prefix+'.opening_height'].filter(id=>FACTS.has(id)):[],note:'Визуальное примыкание к полу: наружный порог +12 мм, внутренний +4 мм; зазор под полотном условный. Не рабочий узел гидроизоляции или отделки.'});
 }
}
function wallJunctionPatches(){
 const z0=Number(MODEL.slab2.bottom_mm),z1=Number(MODEL.slab2.top_mm),rect=b=>[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],out=[];
 for(const upper of MODEL.floor2.walls.filter(w=>w.id.startsWith('upper-ext'))){const ub=upper.bounds_mm.map(Number);let polygons=[];
  for(const lower of MODEL.floor1.walls.filter(w=>w.id.startsWith('ext'))){const b=lower.bounds_mm.map(Number),p=intersectConvex(rect(ub),rect(b));if(p.length>=3&&HouseShapes.area(p)>.01)polygons.push(p);}
  for(const box of activeSlab().disjoint_rectangles_mm)polygons=polygons.flatMap(p=>HouseShapes.subtract(p,rect(box.map(Number))));
  // External wall rectangles meet at corners: emit each footprint once.
  for(const polygon of polygons){let pieces=[polygon];for(const old of out)pieces=pieces.flatMap(p=>HouseShapes.subtract(p,old.polygon_mm));for(const p of pieces)out.push({wall:upper,polygon_mm:p,bottom_plane:[0,0,z0],top_plane:[0,0,z1]});}
 }
 return out;
}
function drawWallJunctions(g){
 const layer=g.addLayer('wallJunctions',[.83,.83,.68],{visible:true,explodeOrder:1});LAYER_META.wallJunctions=['Замыкания стен под мансардой · сценарий',layer.color];g.wallJunctions=wallJunctionPatches();
 for(const p of g.wallJunctions){const id='display-junction:'+p.wall.id;HouseShapes.prism(g,layer,p,id);expInfo(g,id,{title:'Замыкание стены под мансардой',status:'display_junction_not_structural_design',facts:['level.slab.Pm1_bottom.elevation','level.slab.Pm1_top.elevation'],note:'Только визуальное замыкание между +3.020 и +3.200 там, где в варианте Пм1 нет перекрытия. Не назначает армопояс, материал рабочего узла или расход. I016/I020 остаются открытыми.'});}
}
function architecturalPriorities(g){
 // Equal-depth materials get a deterministic result, including at grazing
 // tour angles. Spaced depth units cover float32 rounding of coincident roof
 // caps; the slope factor stays zero to avoid pulling steep faces forwards.
 const order=['groundTextile','gravel20','gravel5','polyethylene','blinding','membrane','slab','beams','frame-mauerlat','frame-purlins','frame-ties','frame-rafters','frame-diagonals','frame-posts','frame-beds','frame-window-headers','walls1','walls2','floor1Frame','upperFrame','wallJunctions','slab2','floor1Lintels','floor1Brick','stairsLower','stairsUpper','stairLanding','stairBrick','stairFinish','stairPartitions','stairGuards','stairHandrail','atticLining','roomFloors','boilerTiles','boilerPlaster','doorThresholds','fixtures1','fixtures2','fixtureCabinet1','fixtureCabinet2','fixtureMetal1','fixtureMetal2','vents','ventCaps','facade','mouldings','roofCheeks','roofReturns','roof','openingFrames1','openingFrames2','openingLeaves1','openingLeaves2','roofWindowFrames','roofWindowLeaves'];
 for(const [i,id]of order.entries())if(g.layers.has(id))g.layers.get(id).depthPriority=(i+1)*16;
}
function clipSolidToFootprint(faces,polygon){
 for(let i=0;i<polygon.length&&faces.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1];
  if(Math.hypot(dx,dy)>.0001)faces=clipDisplaySolid(faces,[-dy,dx,0,dy*a[0]-dx*a[1]]);
 }
 return faces;
}
function clipDisplaySolid(faces,plane){
 const value=p=>plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]+plane[3],out=[],cuts=[];
 if(!faces.length||!faces.some(f=>f.some(p=>value(p)>1e-7)))return [];
 if(faces.every(f=>f.every(p=>value(p)>=-1e-7)))return faces;
 for(const face of faces){const poly=[];for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],fa=value(a),fb=value(b),ia=fa>=-1e-7,ib=fb>=-1e-7;if(ia)poly.push(a);if(ia!==ib){const t=fa/(fa-fb),q=a.map((v,k)=>v+(b[k]-v)*t);poly.push(q);if(!cuts.some(p=>Math.hypot(...p.map((v,k)=>v-q[k]))<1e-5))cuts.push(q);}}if(poly.length>=3)out.push(poly);}
 if(cuts.length>=3){const centre=[0,1,2].map(i=>cuts.reduce((s,p)=>s+p[i],0)/cuts.length),n=plane.slice(0,3).map(v=>-v),len=Math.hypot(...n);for(let i=0;i<3;i++)n[i]/=len;const u=cuts[0].map((v,i)=>v-centre[i]),ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),angle=p=>{const q=p.map((v,i)=>v-centre[i]);return Math.atan2(dot(q,v),dot(q,u));};out.push(cuts.sort((a,b)=>angle(a)-angle(b)));}
 return out;
}
function drawEaveMoulding(g,layer,edge,lowerPlane){
 const a=edge.a_mm,b=edge.b_mm,d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);if(length<1e-6)return;for(let i=0;i<3;i++)d[i]/=length;let u=[-d[1],d[0],0];const ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]],points=[];
 for(const end of [a,b])for(const [su,sv]of [[-1,-1],[1,-1],[1,1],[-1,1]])points.push(end.map((q,i)=>q+u[i]*su*60+v[i]*sv*75));
 const indices=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 for(const cell of MODEL.roof_geometry.cells){if([a,b].some(p=>Math.abs(HouseShapes.z(cell.plane,p)-p[2])>.001))continue;
  const down=roofDeckDrop(cell.plane)+Math.max(0,...points.map(p=>p[2]-HouseShapes.z(cell.plane,p))),shifted=points.map(p=>[p[0],p[1],p[2]-down]);let faces=indices.map(ids=>ids.map(i=>shifted[i]));const foot=cell.polygon_mm,orientation=foot.reduce((s,a,i)=>{const b=foot[(i+1)%foot.length];return s+a[0]*b[1]-b[0]*a[1];},0)>0?1:-1;
  for(let i=0;i<foot.length&&faces.length;i++){const a=foot[i],b=foot[(i+1)%foot.length],dx=b[0]-a[0],dy=b[1]-a[1];faces=clipDisplaySolid(faces,[-dy*orientation,dx*orientation,0,(dy*a[0]-dx*a[1])*orientation]);}
  if(lowerPlane){const [sx,sy,z]=lowerPlane;faces=clipDisplaySolid(faces,[-sx,-sy,1,-z]);}
  for(const face of faces)g.face(layer,face,null,'decor:eaves');
 }
}

/* The same scene and panels are used on desktop, touch devices and fullscreen. */
let closeFullscreenScene=null;

function initSceneFullscreen(viewport,button,scene,courseControls){
 const controlsPosition=document.createComment('Masonry controls');
 courseControls.before(controlsPosition);
 const bottomTools=document.createElement('div');
 bottomTools.className='scene-bottom-tools';
 bottomTools.append(scene.ruler.panel);
 viewport.append(bottomTools);
 let pagePosition,requesting=false;
 const isExpanded=()=>viewport.classList.contains('expanded');
 const isFullscreen=()=>document.fullscreenElement===viewport||isExpanded();
 function sync(){
  const full=isFullscreen(),label=full?'Свернуть сцену':'На весь экран';
  button.setAttribute('aria-pressed',String(full));
  button.setAttribute('aria-label',label);
  button.title=label;
  if(viewport.contains(courseControls)!==full){
   if(full)bottomTools.prepend(courseControls);
   else controlsPosition.after(courseControls);
  }
  if(full)closeFullscreenScene=close;
  else if(closeFullscreenScene===close)closeFullscreenScene=null;
  scene.resetInput();
  scene.request();
 }
 async function close(){
  if(isExpanded()){
   viewport.classList.remove('expanded');
   document.documentElement.classList.remove('scene-expanded');
   window.scrollTo(...pagePosition);
   sync();
  }else if(document.fullscreenElement===viewport){
   try{await document.exitFullscreen();}catch{sync();}
  }
 }
 button.onclick=async()=>{
  if(requesting)return;
  if(isFullscreen())return close();
  requesting=true;
  try{
   if(document.fullscreenEnabled&&viewport.requestFullscreen){
    try{
     await viewport.requestFullscreen({navigationUI:'hide'});
     if(!viewport.closest('.page.active'))await close();
     return;
    }catch{/* Use the in-page view if the browser denies fullscreen. */}
   }
   if(!viewport.closest('.page.active'))return;
   pagePosition=[scrollX,scrollY];
   viewport.classList.add('expanded');
   document.documentElement.classList.add('scene-expanded');
   sync();
  }finally{requesting=false;}
 };
 viewport.addEventListener('fullscreenchange',sync);
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&isExpanded()&&!document.querySelector('dialog[open]')){
   close();
   e.preventDefault();
   e.stopPropagation();
  }
 },true);
}

function syncSceneControls(){
 if(!renderer)return;
 syncRoofCoverButton();
 $('show-inspector').textContent=mode==='frame'?'Деталь':'Объект';
 const walk=!!renderer.walk,touch=matchMedia('(any-pointer: coarse)').matches;
 $('viewport').classList.toggle('is-walking',walk);$('walk-overlay').hidden=!walk;
 $('compact-mode').value=mode;
 if(MODEL.experience&&!$('viewport-room').options.length)$('viewport-room').innerHTML=tourOptions();
 $('viewport-room').value=experience.tourRoom;
 for(const key of ['pageup','pagedown'])document.querySelector('[data-walk-key="'+key+'"]').hidden=!renderer.walk?.flight;
 document.querySelector('.walk-look-hint').hidden=!!renderer.walk?.flight;
 $('scene-help').hidden=!!renderer.walk?.flight;
 $('scene-help').textContent=walk?(touch?'Удерживайте стрелку и осматривайтесь вторым пальцем':'WASD / стрелки — идти · тяните мышью — смотреть · E — открыть'):(touch?'1 палец — вращать · 2 — масштаб и перенос · касание — выбрать':'Тяните для вращения · Shift или ПКМ — перенос · колесо — приблизить к курсору');
 const resetTitle=walk?'Вернуться к началу комнаты':'Сбросить камеру';
 $('view-reset').setAttribute('aria-label',resetTitle);$('view-reset').title=resetTitle;
 for(const id of ['view-iso','view-top','view-front'])$(id).hidden=walk;
}
function initSceneControls(){
 if(!renderer)return;
 $('roof-cover-toggle').onclick=()=>{
  roofFrameState.coverHidden=!roofFrameState.coverHidden;
  if(mode==='house'&&roofFrameState.coverHidden&&renderer.framePending){
   const request=sceneRequest;
   withResources(['roof-frame'],()=>{if(request===sceneRequest&&roofFrameState.coverHidden)renderScene('house');});
  }else applyRoofCover(renderer);
 };
 const viewport=$('viewport'),panel=$('panel-dialog'),compact=matchMedia('(max-width: 1100px)');
 $('compact-mode').innerHTML=[...document.querySelectorAll('.preset[data-mode]')].map(b=>`<option value="${b.dataset.mode}">${esc(b.textContent.replace('↗','').trim())}</option>`).join('');
 $('compact-mode').onchange=e=>buildScene(e.target.value);
 let restorePanel=null;
 const closePanel=()=>{if(panel.open)panel.close();};
 const showPanel=(id,title)=>{if(!compact.matches)return;if(panel.open)return;const node=document.querySelector(id),placeholder=document.createComment('panel position');node.before(placeholder);restorePanel=()=>{placeholder.replaceWith(node);restorePanel=null;};$('panel-body').append(node);$('panel-title').textContent=title;panel.showModal();};
 panel.addEventListener('close',()=>restorePanel?.());
 $('show-layers').onclick=()=>showPanel('.layers-panel','Слои и режимы');$('show-inspector').onclick=()=>showPanel('#inspector',mode==='frame'?'Деталь каркаса':'Выбранный объект');$('panel-close').onclick=closePanel;
 panel.addEventListener('click',e=>{if(e.target.closest('[data-mode]'))closePanel();});
 compact.addEventListener('change',()=>{closePanel();renderer?.resetInput();});
 const touch=matchMedia('(any-pointer: coarse)');touch.addEventListener('change',syncSceneControls);
 $('viewport-room').onchange=e=>startTour(e.target.value);$('viewport-exit-tour').onclick=exitTour;$('viewport-interact').onclick=interactNearby;
 // A touch released after its panel disappears can synthesize a click on the
 // newly exposed page. Discard that click until a fresh press starts.
 let cancelledWalkClick=false;
 document.addEventListener('pointerdown',()=>{cancelledWalkClick=false;},true);
 document.addEventListener('click',e=>{if(cancelledWalkClick){cancelledWalkClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
 // WebKit can deliver a compatibility click after a press or drag. Treat a
 // toolbar action as a tap only when the press and release match the button.
 let buttonPress=null,blockedButton=null;
 viewport.addEventListener('pointerdown',e=>{
  blockedButton=null;
  if(buttonPress){buttonPress.dragged=true;return;}
  const button=e.target.closest('.view-tools button,.walk-top button,.walk-interact');
  if(e.pointerType==='touch'&&button)buttonPress={button,id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp,dragged:!e.isPrimary};
 },true);
 viewport.addEventListener('pointermove',e=>{
  if(buttonPress?.id===e.pointerId&&Math.hypot(e.clientX-buttonPress.x,e.clientY-buttonPress.y)>8)buttonPress.dragged=true;
 },true);
 for(const type of ['pointerup','pointercancel'])viewport.addEventListener(type,e=>{
  if(buttonPress?.id!==e.pointerId)return;
  const p=buttonPress;buttonPress=null;
  if(type==='pointercancel'||p.dragged||e.timeStamp-p.time>=450||!p.button.contains(document.elementFromPoint(e.clientX,e.clientY)))blockedButton=p.button;
 },true);
 viewport.addEventListener('click',e=>{
  if(e.detail&&blockedButton?.contains(e.target)){blockedButton=null;e.preventDefault();e.stopImmediatePropagation();}
 },true);
 renderer.onInputReset=ids=>{if(buttonPress){blockedButton=buttonPress.button;buttonPress=null;}if(ids.length)cancelledWalkClick=true;viewport.querySelectorAll('[data-walk-key]').forEach(b=>{b.classList.remove('held');for(const id of ids)if(b.hasPointerCapture(id))b.releasePointerCapture(id);});};
 viewport.querySelectorAll('[data-walk-key]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{if(!renderer.walk||e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);renderer.walkControls.set(e.pointerId,b.dataset.walkKey);b.classList.add('held');renderer.request();});
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
  const end=e=>{renderer.walkControls.delete(e.pointerId);if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);b.classList.remove('held');};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,end);
 });
 // Clear held controls when a dialog, a tab or a different app takes focus.
 document.addEventListener('focusin',e=>{if(!viewport.contains(e.target))renderer?.resetInput();});
 initSceneFullscreen(viewport,$('fullscreen'),renderer,$('combined-courses'));
 for(const event of ['selectstart','contextmenu','gesturestart','gesturechange','gestureend']){
  viewport.addEventListener(event,e=>{if(!e.target.closest('input,select,textarea'))e.preventDefault();},{passive:false});
 }
 syncSceneControls();
}

'use strict';
const DATA=JSON.parse(document.getElementById('project-data').textContent),MODEL=DATA.model;
const constructionViewer=document.body.classList.contains('construction-viewer');
const FACTS=new Map((DATA.facts||[]).map(f=>[f.id,f]));
let core=MODEL.foundation?.slab.render_polygon_mm.map(p=>p.map(Number));
function acceptData({model,roof_detail,...data}){
 Object.assign(MODEL,model);
 Object.assign(DATA,data);
 if(data.facts)for(const fact of data.facts)FACTS.set(fact.id,fact);
 if(model?.foundation)core=MODEL.foundation.slab.render_polygon_mm.map(p=>p.map(Number));
 if(roof_detail)(MODEL.roof_details??=[]).push(roof_detail);
}
function withResources(keys,action,drawing){
 const pending=pagesAssets?.load(keys,DATA.chunks,acceptData,drawing);
 return pending?pending.then(action,error=>{
  console.error(error);toast('Не удалось загрузить данные. Повторите действие.');return false;
 }):action();
}
let dialogRequest=0;
function prepareDialog(keys,action,drawing){
 const request=++dialogRequest;
 return withResources(keys,()=>{if(request===dialogRequest)action();},drawing);
}
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=id=>Number(FACTS.get(id)?.value),fmt=(v,max=6)=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:max}),raw=id=>esc(FACTS.get(id)?.raw_value??FACTS.get(id)?.value??'—');
const unit=u=>({mm:'мм',cm:'см',m:'м',m2:'м²',m3:'м³',kg:'кг',count:'шт.',rows:'ряды','kg/m':'кг/п.м.','g/m2':'г/м²',deg:'°',mm_range:'мм'}[u]||u||'');
const moneyless=id=>{const f=FACTS.get(id);return f?`${fmt(f.value)} ${unit(f.unit)}`:'не задано';};
const sheetKey=(s,p)=>s+':'+p;
const pageInfo=(s,p)=>DATA.sheets.find(x=>x.source_id===s&&x.pdf_page===p);
const factBtn=(id,label)=>`<button class="link-button" data-fact="${esc(id)}">${esc(label||FACTS.get(id)?.source.sheet||'Источник')} ↗</button>`;
const sheetBtn=(s,p,label,edition)=>`<button class="source-button" data-sheet="${s}:${p}"${edition?' data-edition="'+edition+'"':''}>${esc(label||pageInfo(s,p)?.sheet||'Лист')}${edition==='revision'?' · без дуги':''} <span>↗</span></button>`;
const heading=(k,title,sub,status='Из исходных PDF')=>`<div class="page-heading"><div><div class="eyebrow">${k}</div><h2>${title}</h2><p>${sub}</p></div><span class="status green">${esc(status)}</span></div>`;
let toastTimer;function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4500);}
function showDialog(kicker,title,body){dialogRequest++;activeSheetRuler?.dispose();activeSheetRuler=null;disposeRoofDetailViewer();disposeServiceDetailViewer();$('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;$('dialog-body').innerHTML=`<div class="dialog-content">${body}</div>`;if(!$('source-dialog').open)$('source-dialog').showModal();$('dialog-body').scrollTop=0;}
function scanFile(i){return DATA.print_sheets[sheetKey(i.source_id,i.pdf_page)].scan;}
function printLinks(edition){
 const download=location.protocol==='file:'&&edition.offline_pdf?edition.offline_pdf:edition.pdf;
 return `<div class="dialog-links"><a class="sheet-pdf" href="${download}" download="${edition.filename}">Скачать лист А3 · стр. ${edition.folio}</a><a href="${edition.pdf}" target="_blank" rel="noopener">Открыть векторный PDF ↗</a></div>`;
}
function sourceLinks(s,p){
 const key=sheetKey(s,p);
 return printLinks(DATA.print_sheets[key])+sheetBtn(s,p,'Посмотреть исходный скан','scan');
}
function openSheet(s,p,version){
 const i=pageInfo(s,p);if(!i)return;
 const key=sheetKey(s,p),revision=DATA.revisions[key];
 version??=revision?'revision':'source';
 const revised=revision&&version==='revision',registered=revised&&revision.registration,scan=version==='scan',art=revised?revision.image:DATA.images[key];
 const resources=registered?['foundation',...(s==='house_1'?['floor1']:[]),...(s==='embeds'?['services']:[])]:[];
 return prepareDialog(resources,()=>renderSheet(i,version,{key,revision,revised,registered,scan,art}),scan?null:art);
}
function renderSheet(i,version,{key,revision,revised,registered,scan,art}){
 const {source_id:s,pdf_page:p}=i;
 const choices=revision?[['revision',s==='embeds'?'Текущий лист · В1 у Е':'Текущий лист'],['source','Исходная оцифровка']]:[['source','Чертёж с наборным текстом']];
 choices.push(['scan','Исходный скан']);
 const tabs=choices.map(([id,label])=>`<button data-sheet="${key}" data-edition="${id}" aria-pressed="${id===version}">${label}</button>`).join('');
 const editions=`<div class="sheet-editions" role="group" aria-label="Версия листа">${tabs}</div>`;
 const edition=revised?revision:DATA.print_sheets[key];
 const links=scan?`<div class="dialog-links"><a href="${scanFile(i)}" target="_blank" rel="noopener">Открыть скан 300 dpi ↗</a><a href="${DATA.scans[key]}" download="${s}-page-${p}-preview.webp">Скачать превью скана</a></div>`:printLinks(edition);
 const vector=!registered&&!scan&&embeddedDrawing(art);
 const content=registered?`<p>${esc(revision.note)}</p><div class="plan-ruler-tools"></div><div class="sheet-canvas"></div><p class="tiny muted">Свободные измерения приблизительны. Привязка использует геометрию модели. Для разбивки сверяйте подписанные размеры и оси.</p>`:`${revised?'<p>'+esc(revision.note)+'</p>':''}<div class="scan-tools"><button type="button" data-scan-ruler>Линейка по листу</button></div><div class="scan-canvas"><img ${vector?'hidden':`src="${scan?scanFile(i):art}"`} alt="${scan?'Скан':'Оцифровка'} · ${esc(i.title)}"></div>`;
 showDialog(`${i.sheet||'ПРИЛОЖЕНИЕ'} / PDF ${p} / ${esc(choices.find(([id])=>id===version)?.[1]||choices[0][1])}`,i.title,editions+links+content);
 if(registered){const body=$('dialog-body');activeSheetRuler=new SheetRuler(body.querySelector('.sheet-canvas'),body.querySelector('.plan-ruler-tools'),key,{sites:s==='embeds'?MODEL.services.map(site=>servicePlacement(site,true)):[]});}
 else{
  const body=$('dialog-body'),host=body.querySelector('.scan-canvas'),img=host.querySelector('img'),start=body.querySelector('[data-scan-ruler]');
  if(scan){img.onerror=()=>{img.onerror=null;img.src=DATA.scans[key];};}
  if(vector){vector.classList.add('sheet-art');vector.setAttribute('width','100%');vector.removeAttribute('height');host.append(vector);}
  start.onclick=()=>{if(vector){vector.remove();img.src=art;img.hidden=false;}activeSheetRuler=new ScanRuler(host,start.parentElement,img);};
 }
}
function openFact(id){return prepareDialog(['facts','foundation','issues'],()=>renderFact(id));}
function renderFact(id){const f=FACTS.get(id);if(!f)return;const s=f.source,issue=f.issue_id?DATA.issues.find(x=>x.id===f.issue_id):null;showDialog('ПРОИСХОЖДЕНИЕ ЗНАЧЕНИЯ',f.label,`<div class="fact-meta"><div>Исходная запись<b>${MODEL.foundation.quantity_changes[id]?revisedQuantity(id):esc(f.raw_value??'расчёт')+' '+unit(f.unit)}</b><span>${esc(f.value)}</span></div><div>Проверка<b>${f.verification==='visually_verified'?'Сверено с листом':'Расчёт'}</b><span>${f.verification==='visually_verified'?'С изображением; расчёт проектировщика не подтверждён независимо.':'Вычисление / интерпретация, не подпись на чертеже.'}</span></div><div>Лист и страница<b>${esc(s.sheet||'Приложение')}</b><span>${esc(s.filename)} · PDF ${s.pdf_page}</span></div></div>${f.note?`<p>${esc(f.note)}</p>`:''}${issue?`<div class="callout"><b>${issue.id} · ${esc(issue.title)}</b>${esc(issue.detail)}</div>`:''}<p class="tiny muted">Область: ${esc(s.location)}</p>${sourceLinks(s.source_id,s.pdf_page)}<img src="${DATA.images[sheetKey(s.source_id,s.pdf_page)]}" alt="Оцифровка исходного листа ${esc(s.sheet)}">`);}
function openNode(id){return prepareDialog(['roof-index'],()=>renderNode(id));}
function renderNode(id){const a=MODEL.roof_nodes.find(x=>x.id===id);if(!a)return;showDialog(a.reference,a.title,`<p>${esc(a.note)}</p><img src="${DATA.crops[id]}" alt="${esc(a.title)}">${sourceLinks(a.source_id,a.pdf_page)}${sheetBtn(a.source_id,a.pdf_page,'Открыть полный лист')}`);}
$('source-dialog').addEventListener('close',()=>{dialogRequest++;activeSheetRuler?.dispose();activeSheetRuler=null;disposeRoofDetailViewer();disposeServiceDetailViewer();});$('dialog-close').onclick=()=>$('source-dialog').close();$('source-dialog').addEventListener('click',e=>{if(e.target===$('source-dialog'))$('source-dialog').close();});
document.addEventListener('click',e=>{if(e.target.closest('[data-print-foundation]')){const link=document.createElement('a');link.href=DATA.foundation_plan_pdf;link.download='foundation-plan-A3.pdf';link.click();return;}const plan=e.target.closest('[data-anchor-plan]');if(plan){openServicePlan(currentTab==='model'?experience.waterCorner:true,plan.dataset.anchorPlan);return;}if(e.target.closest('[data-foundation-geometry]')){openFoundationGeometry();return;}const f=e.target.closest('[data-fact]'),s=e.target.closest('[data-sheet]'),r=e.target.closest('[data-node]');if(f)openFact(f.dataset.fact);else if(s){const [id,p]=s.dataset.sheet.split(':');openSheet(id,Number(p),s.dataset.edition);}else if(r)openNode(r.dataset.node);});
if($('issue-count'))$('issue-count').textContent=DATA.issue_count??DATA.issues.length;
let renderer=null,masonryRenderer=null,mode='foundation',currentTab='model';
const C={base:[.53,.41,.30],gravel:[.78,.64,.43],blinding:[.79,.79,.72],membrane:[.19,.35,.42],slab:[.65,.70,.70],beams:[.49,.56,.55],bottom:[.04,.34,.55],top:[.83,.31,.07],chair:[.76,.55,.24],beamsteel:[.46,.35,.26],services:[.25,.50,.61],walls1:[.83,.83,.68],walls2:[.78,.80,.65],slab2:[.68,.73,.63],roof:[.36,.22,.18],guide:[.65,.71,.62]};
const LAYER_META={
 stairsLower:['Лестница · нижний марш',[.60,.66,.56]],stairsUpper:['Лестница · верхний марш',[.66,.71,.61]],stairLanding:['Площадка · верх по плану',[.68,.70,.57]],stairBrick:['Простенки · условная высота',[.65,.44,.29]],stairFinish:['Отделка · сценарий',[.69,.56,.32]],stairChecks:['Лестница / проём · I019',[.75,.43,.17]],
 gravel20:['Щебень 20–40',C.base],gravel5:['Щебень 5–10',C.gravel],blinding:['Подготовка В10',C.blinding],membrane:['Гидроизоляция',C.membrane],slab:['Плита 300 мм',C.slab],beams:['Ростверки',C.beams],bottom:['Нижняя сетка · поз.1',C.bottom],top:['Верхняя сетка · поз.2',C.top],chair:['Фиксаторы · поз.3',C.chair],beamsteel:['Арматура ростверка',C.beamsteel],edgesteel:['П-детали · поз.7',C.top],services:['Маркеры закладных XY',C.services],walls1:['1-й этаж · размерный вариант',C.walls1],floor1Frame:['Каркасные перегородки 1-го этажа',[.47,.57,.54]],floor1Brick:['Кирпичные вентблоки 1-го этажа',[.57,.36,.25]],floor1Lintels:['Зоны перемычек 1-го этажа',[.60,.65,.60]],slab2:['Перекрытие Пм 1',C.slab2],walls2:['2-й этаж · эскиз',C.walls2],roof:['Крыша · эскиз',C.roof]};
LAYER_META.roof=['Кровля · размерный вариант АР-8',C.roof];
LAYER_META.atticLining=['Подшивка мансарды и оконные откосы',[.94,.92,.87]];
LAYER_META.stairGuards=['Лестница · металлические стойки',[.25,.28,.26]];
LAYER_META.stairPartitions=['Ограждающие стены лестницы',[.47,.60,.55]];
LAYER_META.boilerPlaster=['Котельная · светлая отделка стен',[.89,.87,.81]];
LAYER_META.boilerTiles=['Котельная · керамическая плитка',[.73,.75,.72]];
LAYER_META.roofCheeks=['Боковины под свесами · вариант',[.47,.36,.28]];
LAYER_META.roofReturns=['Перепады кровли · геометрия',[.73,.49,.27]];
LAYER_META.walls2=['Мансарда · план / условный верх',C.walls2];
LAYER_META.upperFrame=['Каркас 200 · план / условный верх',[.47,.60,.55]];
LAYER_META.beamL=['Г-детали · поз.4',[.35,.49,.58]];
LAYER_META.beamPinExt=['Наружные шпильки · поз.5',[.55,.40,.55]];
LAYER_META.beamPinInt=['Внутренние шпильки · поз.8',[.27,.57,.51]];
LAYER_META.rebarChecks=['Метки участков на проверку',[.76,.44,.20]];
function addLayer(g,id,opts={}){return g.addLayer(id,LAYER_META[id]?.[1]||C.guide,opts);}
function scanSegments(poly,axis,value){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],t=1-axis;if((a[axis]<=value&&b[axis]>value)||(b[axis]<=value&&a[axis]>value))result.push(a[t]+(value-a[axis])/(b[axis]-a[axis])*(b[t]-a[t]));}return result.sort((a,b)=>a-b);}
function meshPlan(g,l,poly,z,step=200,tubes=false,axes=[0,1]){for(const axis of axes){const start=Math.ceil(Math.min(...poly.map(p=>p[axis]))/step)*step,end=Math.max(...poly.map(p=>p[axis]));for(let v=start;v<end;v+=step){const values=scanSegments(poly,axis,v);for(let i=0;i+1<values.length;i+=2){const lo=values[i],hi=values[i+1];if(hi<=lo)continue;const a=axis===0?[v,lo,z]:[lo,v,z],b=axis===0?[v,hi,z]:[hi,v,z];if(tubes)g.tube(l,a,b,6);else g.line(l,a,b);}}}}
function beamSegment(g,l,a,b,width,z0,z1,id='beams'){if(Math.abs(a[1]-b[1])<.01)g.box(l,Math.min(a[0],b[0])-width/2,a[1]-width/2,z0,Math.max(a[0],b[0])+width/2,a[1]+width/2,z1,id);else if(Math.abs(a[0]-b[0])<.01)g.box(l,a[0]-width/2,Math.min(a[1],b[1])-width/2,z0,a[0]+width/2,Math.max(a[1],b[1])+width/2,z1,id);}
function addGuides(g,detail=false){const l=g.addLayer('guides',C.guide,{order:0,showEdges:true});const r=detail?1800:22000,step=detail?400:2000,z=detail?-1300:-1300;for(let x=detail?-r:-2000;x<r;x+=step)g.line(l,[x,detail?-r:-2000,z],[x,r,z]);for(let y=detail?-r:-2000;y<r;y+=step)g.line(l,[detail?-r:-2000,y,z],[r,y,z]);}
for(const [family,m] of Object.entries(ROOF_FRAME_STYLE))LAYER_META['frame-'+family]=[m.label,m.color];LAYER_META['frame-checks']=['Контакты каркаса · I021',[.82,.41,.16]];
function drawServiceMarkers(g,visible){
 const services=g.resetLayer('services',C.services,{visible});
 g.labels=g.labels.filter(l=>l.layer!=='services');
 for(const s of MODEL.services){const site=servicePlacement(s,experience.waterCorner),x=+site.x_mm,y=+site.y_mm;g.ring(services,x,y,-470,+s.sleeve/2);g.ring(services,x,y,-468,150);g.line(services,[x-250,y,-460],[x+250,y,-460]);g.line(services,[x,y-250,-460],[x,y+250,-460]);g.labels.push({text:s.label+(site.proposal?' · у Е':'')+(s.id==='electric'?' Ø50':s.diameter?' Ø'+s.diameter:''),p:[x,y,-380],id:'service:'+s.id,color:s.id==='electric'?'#9d7331':s.id==='В1-1'?'#386f91':'#9b6037',layer:'services'});}
}
function overview(g){
 addGuides(g);
 if(constructionViewer&&mode==='stairs'){
  const slab=addLayer(g,'slab2',{opacity:.3,explodeOrder:2,order:11});
  drawIntermediateSlab(g,slab);drawStaircase(g,true);
  return;
 }
 const slabBottom=n('foundation.Фм1.bottom_elevation')*1000,slabTop=n('foundation.Фм1.top_elevation')*1000;
 const gravel20=addLayer(g,'gravel20',{explodeOrder:-4,order:0}),gravel5=addLayer(g,'gravel5',{explodeOrder:-3,order:1}),blinding=addLayer(g,'blinding',{explodeOrder:-2,order:2}),membrane=addLayer(g,'membrane',{explodeOrder:-1,order:3}),slab=addLayer(g,'slab',{opacity:1,order:4}),beams=addLayer(g,'beams',{opacity:1,order:5});
 g.prism(gravel20,core,-1250,-1050,'gravel20');g.prism(gravel5,core,-1050,-850,'gravel5');g.prism(blinding,core,-850,-800,'blinding');for(const tri of HouseGL.triangulate(core))g.face(membrane,tri.map(i=>[...core[i],-800]),[0,0,1],'membrane'); // symbolic plane; no invented membrane thickness
 g.prism(slab,core,slabBottom,slabTop,'slab');
 for(const r of MODEL.foundation.plinth.disjoint_rectangles_mm){const [x0,y0,x1,y1]=r.map(Number);g.box(beams,x0,y0,slabTop,x1,y1,-130,'beams',false);}
 for(const edge of MODEL.foundation.plinth.boundary_edges_mm){for(const z of [-500,-130])g.line(beams,[...edge[0].map(Number),z],[...edge[1].map(Number),z]);}
 const bottom=addLayer(g,'bottom',{showEdges:true}),top=addLayer(g,'top',{showEdges:true}),chair=addLayer(g,'chair',{visible:false}),beamsteel=addLayer(g,'beamsteel',{visible:false}),edge=addLayer(g,'edgesteel',{visible:false});
 if(!constructionViewer||['foundation','foundation-stack','rebar','services3d'].includes(mode))drawFoundationRebar(g,{1:bottom,2:top,3:chair,6:beamsteel,7:edge});
 drawServiceMarkers(g,!['house','floor1'].includes(mode));
 if(constructionViewer&&['foundation','foundation-stack','rebar'].includes(mode)){addExperience(g);return;}
 const walls1=addLayer(g,'walls1',{visible:['house','floor1'].includes(mode),explodeOrder:1,order:10}),walls2=addLayer(g,'walls2',{visible:['house','floor2'].includes(mode),explodeOrder:3,order:13}),slab2=addLayer(g,'slab2',{visible:mode==='house',explodeOrder:2,order:11}),roof=addLayer(g,'roof',{visible:['house','roof'].includes(mode),explodeOrder:4,order:15});
 drawFloorOverview(g,walls1,['house','floor1'].includes(mode));
 drawUpperFloor(g,walls2,['house','floor2'].includes(mode));
 slab2.visible=['house','floor2','stairs'].includes(mode);if(mode==='stairs')slab2.opacity=.3;
 drawIntermediateSlab(g,slab2);drawStaircase(g,['house','floor1','floor2','stairs'].includes(mode));
 drawDimensionedRoof(g,roof,['house','roof'].includes(mode));drawGlobalRoofFrame(g,mode==='frame');

 g.label('А',[0,-1600,-800]);g.label('И',[1065,17200,-800]);g.label('1',[-1000,-400,-800]);g.label('6',[13870,-400,-800]);
 addExperience(g);
}
function section(g,kind){
 addGuides(g,true);const ext=kind==='section-external',internal=kind==='section-internal',edgeMode=kind==='section-edge';
 const base=addLayer(g,'gravel20',{explodeOrder:-4}),fine=addLayer(g,'gravel5',{explodeOrder:-3}),blind=addLayer(g,'blinding',{explodeOrder:-2}),slab=addLayer(g,'slab',{opacity:.16,order:4}),top=addLayer(g,'top'),bottom=addLayer(g,'bottom'),chairs=addLayer(g,'chair'),beamsteel=addLayer(g,'beamsteel'),edgesteel=addLayer(g,'edgesteel'),beams=addLayer(g,'beams',{opacity:.13,order:5});
 const beamL=addLayer(g,'beamL',{visible:ext||internal}),pins=addLayer(g,ext?'beamPinExt':'beamPinInt',{visible:ext||internal});
 const x0=-1200,x1=1200,y0=-900,y1=900;
 for(const [l,z0,z1]of [[base,-1250,-1050],[fine,-1050,-850],[blind,-850,-800],[slab,-800,-500]])g.box(l,x0,y0,z0,x1,y1,z1,l===slab?'slab':l===blind?'blinding':'base');
 const poly=[[x0+50,y0+50],[x1-50,y0+50],[x1-50,y1-50],[x0+50,y1-50]];meshPlan(g,bottom,poly,-750,200,true);meshPlan(g,top,poly,-550,edgeMode?150:200,true,edgeMode?[0]:[0,1]);
 for(const [x,y]of [[-600,-400],[200,-400],[-200,400],[600,400]]){g.rod(chairs,[[x-65,y-250,-740],[x-65,y,-740],[x-65,y,-580],[x+65,y,-580],[x+65,y,-740],[x+65,y+250,-740]],4);}
 if(ext||internal){const w=n('foundation.Фм1.'+(ext?'external_beam_width':'internal_beam_width')),xc=ext?x1-w/2:0;
  g.box(beams,xc-w/2,y0,-500,xc+w/2,y1,-130,'beams');
  for(const x of [xc-w/2+60,xc+w/2-60])for(const z of [-220,-420])g.tube(beamsteel,[x,y0+60,z],[x,y1-60,z],4);
  for(let y=y0+100;y<y1;y+=200)for(const sgn of [-1,1]){const x=xc+sgn*(w/2-60);g.rod(beamL,[[x+(ext?-200:sgn*200),y,-750],[x,y,-750],[x,y,-160]],6);}
  const span=ext?530:330;for(let y=y0+100;y<y1;y+=400)for(const z of [-220,-420])g.rod(pins,[[xc-span/2+35,y,z-25],[xc-span/2,y,z],[xc+span/2,y,z],[xc+span/2-35,y,z-25]],4);
  g.label(`${w} мм`,[xc,0,-70],'foundation.Фм1.'+(ext?'external_beam_width':'internal_beam_width'));g.label('−0,130',[xc,y1+140,-130],'foundation.Фм1.beam_top_elevation');
  g.label('4Ø8 · поз.6',[xc,450,-300],'foundation.Фм1.beam_longitudinal_count');
 }else{beams.visible=false;beamsteel.visible=false;}
 if(edgeMode){for(let y=y0+100;y<y1;y+=200)g.rod(edgesteel,[[x1-450,y,-750],[x1-50,y,-750],[x1-50,y,-530],[x1-450,y,-530]],4);g.label('Верхняя арматура: ш.150',[0,0,-360],'foundation.Фм1.upper_mesh_edge_spacing');}else edgesteel.visible=false;
 g.label('300 мм',[x1+170,0,-650],'foundation.Фм1.slab_thickness');g.label('Верх плиты −0,500',[0,y1+150,-500],'foundation.Фм1.top_elevation');g.label('Низ плиты −0,800',[0,y1+150,-800],'foundation.Фм1.bottom_elevation');g.label('Ø12 · ш.200',[250,50,-920],'foundation.Фм1.lower_mesh_spacing');g.label('Фиксатор поз.3',[-600,-400,-580],'foundation.Фм1.rebar.3.length');
}
function lap(g){
 const left=addLayer(g,'bottom'),right=addLayer(g,'top'),guides=g.addLayer('guides',C.guide);
 const lapLength=n('foundation.Фм1.lap_length'),gap=n('foundation.Фм1.lap_min_stagger');
 const spacing=n('foundation.Фм1.lower_mesh_spacing'),radius=n('foundation.Фм1.rebar.1.diameter')/2,z=-450;
 // КЖ-2 dimensions the clear interval between two 600 mm overlap zones.
 const intervals=[[-gap/2-lapLength,-gap/2],[gap/2,gap/2+lapLength]];
 for(let row=0;row<3;row++){
  const [start,end]=intervals[row%2],y=(row-1)*spacing;
  g.tube(left,[-1300,y,z],[end,y,z],radius,12,'lap');
  g.tube(right,[start,y+18,z],[1300,y+18,z],radius,12,'lap');
 }
 const dimension=(start,end,y,label,fact)=>{
  g.line(guides,[start,y,z],[end,y,z]);
  for(const x of [start,end])g.line(guides,[x,y-50,z],[x,y+50,z]);
  g.label(label,[(start+end)/2,y-80,z],fact);
 };
 for(const [start,end] of intervals)dimension(start,end,-480,lapLength+' мм','foundation.Фм1.lap_length');
 dimension(intervals[0][1],intervals[1][0],450,'min '+gap+' мм','foundation.Фм1.lap_min_stagger');
}
const descriptions={
 'services3d':['ВК-1 / ПОЛЬЗОВАТЕЛЬСКИЙ ВАРИАНТ','Вода, канализация и газ','Трассы · сценарий','Сливы от приборов сходятся к К1. Синим показана холодная вода от В1, красным — горячая вода от условного водонагревателя. Жёлтая линия соединяет котельную с плитой по фасаду. Маршруты и оборудование показаны как вариант.'],
 'foundation-stack':['КЖ-3 / СНИЗУ ВВЕРХ','Как собран фундамент','Размеры слоёв / разнос условный','Восемь шагов сборки от геотекстиля до ростверков. Нажимайте на шаг, чтобы видеть накопление слоёв. Плёнки показаны плоскостями, отметки относятся к собранному виду.'],
 'masonry3d':['ОБА ЭТАЖА / СЦЕНАРИЙ','Кладка дома целиком','Подрезки и профиль на проверке','Первый этаж и мансарда одновременно. Верхние ряды режутся по плоскостям кровли и проёмам. Профиль, перевязка, перемычки и пояса мансарды требуют рабочего решения; количества не являются закупочной ведомостью.'],
 frame:['КД-2 / КД-3 / КД-4','Деревянный каркас кровли','Схема · I021','Стропила, диагонали, прогоны, стойки, мауэрлаты и затяжки показаны отдельными группами. Неизвестные фазы/посадки, ориентация пар8/10 и часть опор открыты. Исходные длины и количества сохранены; объёмы геометрии не заменяют ведомость.'],
 stairs:['КЖ-7 / КЖ-15 / АР-3–4','Лестница и отверстие Пм1','Варианты · I019 / I020','Два марша по 9 проступей, площадка +1.630 и отверстие3820×2420. Источник имеет расхождения10/40 мм; варианты доступны под сценой. Бетонные отметки отделены от сценария отделки. Площадка/контакты/кирпичные опоры имеют условные параметры. Ведомости не пересчитаны по этому изображению.'],
 rebar:['КЖ-2 / КЖ-3 / КЖ-4','Арматура всей плиты','Сценарий · I015 / I017','Восемь позиций показаны отдельными слоями. Сетки и края привязаны к размерному варианту контура; фазы и отступы линий — параметры схемы. Зона 150, контакты, рабочие стыки и анкеровка ещё не назначены. Нажмите на линию или выберите элемент из списка.'],
 foundation:['ФУНДАМЕНТ / Фм 1','Плита с прямым краем','Вариант без дуги','Восточный край плиты параллелен оси 6 на всём участке террасы. Для закладных откройте привязки в плане, для сеток выберите просвечивание бетона.'],
 floor1:['АР-3 / АР-5 / КЖ-11','Первый этаж с проёмами','Размерный вариант','Стены и проёмы восстановлены по размерным привязкам. Открыты I002/I010/I014; санузел 2 и ВК-2 имеют гипотезы. Показан срез до +3.020. Порядовка всех смоделированных стен — в разделе «Кладка».'],
 house:['ЕДИНЫЙ ДОМ / 4 УРОВНЯ','Дом по слоям','Смешанная точность','Фундамент, первый этаж и кровля — размерные варианты с открытыми расхождениями. План мансарды размерный; её верх условно ограничен кровлей. Перекрытие и лестница — размерные варианты с открытыми I019/I020. Исходные ведомости отделены от геометрических расчётов; нажмите на элемент для проверки.'],
 floor2:['АР-4 / АР-6 / АР-17','Мансарда: план и проёмы','Условный верх · I016','23 участка стен и 10 проёмов по привязкам. Верх оболочки условно ограничен кровлей без искусственного зазора: это параметр изображения, не рабочая высота кладки. По оболочке не считаются расход материалов и мансардная площадь. Нажмите на стену для формул и сверки.'],
 roof:['АР-8 / ПОВЕРХНОСТИ КРОВЛИ','Кровля по размерным цепям','Размерный вариант','Основная часть, гараж, восточный выступ и два слуховых окна: плоские скаты по подписанным размерам и отметкам. Открыты I002/I003/I007. Нажмите на скат: увидите его плоскость, площадь и отклонения. Три мансардных окна показаны в помещениях по АР-6. Их точные монтажные привязки открыты.'],
 'section-field':['КЖ-3 / СЕЧЕНИЕ 1–1','Плита и основание','Размеры сечения','Демонстрационный фрагмент 2400 × 1800 мм. Толщины, отметки, Ø12 и шаг 200 — по КЖ-3; длина фрагмента условна. Пересечения стержней и форма гибов показаны схематично. Это не карта раскроя всего фундамента.'],
 'section-external':['КЖ-3 / СЕЧЕНИЕ 2–2','Наружный ростверк','Размеры сечения','Ширина 600, подъём 370, плита 300 мм. Поз.4 ш.200; поз.5 ш.400; продольные — 4Ø8 поз.6. Длина демонстрационного фрагмента условна; формы гибов и контакт стержней упрощены. Гидрошнур, XPS и отмостка — на исходном узле.'],
 'section-edge':['КЖ-3 / СЕЧЕНИЕ 3–3','Край плиты','Размеры сечения','Локальное сечение края: верхняя арматура поз.2 с шагом 150, нижняя поз.1 — 200, П-детали поз.7 — 200 мм. Шаг 150 показан одним набором стержней; направление в полном плане и граница зоны пока не установлены. Расширять эту схему на всю плиту нельзя.'],
 'section-internal':['КЖ-3 / СЕЧЕНИЕ 4–4','Внутренний ростверк','Размеры сечения','Ширина 400, подъём 370, плита 300 мм. Поз.4 ш.200; поз.8 ш.400; продольные — 4Ø8 поз.6. Длина демонстрационного фрагмента условна. Отступы 60/90 и расстояние 200 показаны как на сечении; гибы упрощены.'],
 lap:['КЖ-2 / ДЕТАЛЬ СТЫКОВКИ','Стыки арматуры Ø12','Размеры детали','Нахлёст 600 мм, просвет между соседними участками нахлёста min 250 мм. Визуальный зазор между парными стержнями условен, для читаемости. Общие длины показанных стержней не являются длинами заготовок.']
};
const sceneSheets={
 house:[['house_1',4,'revision'],['house_1',5],['house_1',13]],
 floor1:[['house_1',4,'revision'],['house_1',6],['house_2',16]],floor2:[['house_1',5],['house_1',7]],
 masonry3d:[['house_1',4],['house_1',5],['house_2',1]], services3d:[['embeds',1],['house_2',7]],
 'foundation-stack':[['house_2',8]],foundation:[['house_2',7,'revision'],['house_2',8]],
 stairs:[['house_2',20],['house_2',12]],roof:[['house_1',9],['house_1',23]],frame:[['house_2',22],['house_2',23],['house_2',24]],
 rebar:[['house_2',7,'revision'],['house_2',8],['house_2',9]],lap:[['house_2',7]],
 'section-field':[['house_2',8]],'section-external':[['house_2',8]],'section-edge':[['house_2',8]],'section-internal':[['house_2',8]]
};
const overviewModes=['house','floor1','floor2','foundation','roof','frame','stairs','rebar','services3d','foundation-stack','masonry3d'];
function sceneResources(scene){
 const keys=['renderer','facts'];
 if(constructionViewer&&scene==='stairs')return [...keys,'services','floor1','floor2','structure','roof'];
 keys.push('foundation');
 if(!constructionViewer||['foundation','foundation-stack','services3d','rebar'].includes(scene))keys.push('rebar');
 if(!overviewModes.includes(scene))return keys;
 keys.push('services','experience');
 if(constructionViewer&&['foundation','foundation-stack','rebar'].includes(scene))return keys;
 keys.push('floor1','floor2','structure','roof','floor');
 if(scene==='frame'||!constructionViewer&&scene==='house')keys.push('roof-frame');
 return keys;
}
let sceneRequest=0;
function buildScene(newMode,afterScene){
 const request=++sceneRequest;
 return withResources(sceneResources(newMode),()=>{
  if(request!==sceneRequest||currentTab!=='model'&&(currentTab!=='roof'||!['frame','roof'].includes(newMode)))return false;
  if(!renderer&&!initMainRenderer())return false;
  renderScene(newMode);
  if(constructionViewer)syncConstructionScene();
  if(MODEL.foundation)renderModelSummary();
  afterScene?.();
  return true;
 });
}
function renderScene(newMode){if(location.hash==='#entry-valley'&&renderer.layers.has('entryValley'))history.replaceState(null,'','#model');experience.savedVisibility=null;renderer.visibleLabels=true;mode=newMode;renderer.clear();renderer.roofCoverVisibility=null;renderer.explode=0;renderer.clipZ=Infinity;$('explode').value=0;$('explode-value').textContent='0 мм';$('cut').value=11000;$('cut-value').textContent='выкл.';
 if(overviewModes.includes(mode))overview(renderer);else if(mode==='lap')lap(renderer);else section(renderer,mode);if(mode==='roof'){for(const l of renderer.layers.values())l.visible=['roof','roofCheeks','roofWindowFrames','roofWindowLeaves','roofWindowGlass'].includes(l.id);renderer.labels=renderer.labels.filter(l=>l.layer==='roof');}renderer.commit();renderer.home(['house','foundation','floor1','floor2','roof','rebar','stairs','frame','services3d','foundation-stack','masonry3d'].includes(mode)?mode:'detail');

 if(mode==='floor2'){for(const l of renderer.layers.values())if(!servicePipeLayers.includes(l.id))l.visible=['walls2','upperFrame','roofBelt','guides','slab2','stairsLower','stairsUpper','stairLanding','stairBrick','stairGuards','stairHandrail','stairPartitions','roomFloors','doorThresholds','openingFrames2','openingLeaves2','glass2','fixtures2','fixtureMetal2','fixtureWater2','fixtureCabinet2'].includes(l.id);renderer.labels=renderer.labels.filter(l=>l.kind==='room');}
 if(mode==='frame'){for(const l of renderer.layers.values())l.visible=['roof','frame-selected','frame-checks','roofWindowFrames','roofWindowLeaves','roofWindowGlass'].includes(l.id)||(l.id.startsWith('frame-')&&frameFamilyWanted(l.id.slice(6)));renderer.layers.get('roof').opacity=.10;renderer.labels=[];renderer.home('frame');showFrameContext(roofFrameState.showWalls);}
 if(mode==='stairs'){for(const l of renderer.layers.values())l.visible=['slab2','stairsLower','stairsUpper','stairLanding','stairBrick','stairGuards','stairHandrail','stairPartitions','stairChecks','guides'].includes(l.id)||(l.id==='stairFinish'&&stairState.showFinish);renderer.labels=renderer.labels.filter(l=>['stairLanding','slab2'].includes(l.layer));}
 if(mode==='roof'){renderer.target=[6500,7800,5500];renderer.span=22500*renderer.fitAspect();renderer.request();}
 if(mode==='rebar'){for(const l of renderer.layers.values())l.visible=['guides','slab','beams','rebarChecks','rebarSelected',...Object.values(REBAR_LAYER_IDS).filter(id=>foundationRebarState.family==='all'||id===REBAR_LAYER_IDS[foundationRebarState.family])].includes(l.id);renderer.layers.get('slab').opacity=.12;renderer.layers.get('beams').opacity=.12;renderer.request();}
 const [k,title,status,notice]=descriptions[mode];$('scene-kicker').textContent=k;$('scene-title').textContent=title;$('scene-status').textContent=status;$('scene-status').className='status '+(['house','foundation','floor1','floor2','roof','rebar','stairs','frame','services3d','foundation-stack','masonry3d'].includes(mode)?'amber':'green');$('scene-notice').innerHTML=esc(notice)+' '+sceneSheets[mode].map(([source,page,edition])=>sheetBtn(source,page,null,edition)).join('')+(['house','roof'].includes(mode)?' <button data-entry-valley>Примыкание над входом в 3D</button>':'');document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));foundationStudyTools();applyRoofCover(renderer);renderLayerControls();renderRebarTools();renderStairTools();renderRoofFrameTools();renderExperienceTools();$('explode').value=renderer.explode;$('explode-value').textContent=renderer.explode+' мм';if(mode==='frame')inspectRoofFrameMember(roofFrameState.selected);else if(mode==='rebar')renderRebarInspector();else inspect(mode==='stairs'?'stairsLower':mode==='floor2'?'walls2':mode==='roof'?'roof':mode==='floor1'?'walls1':['house','foundation'].includes(mode)?'slab':mode==='lap'?'lap':mode==='services3d'?'services':mode==='masonry3d'?'courseFull':mode==='section-field'?'slab':mode==='section-edge'?'edgesteel':'beams');}
function renderLayerControls(){if(!renderer)return;$('layers').innerHTML=[...renderer.layers.values()].filter(l=>LAYER_META[l.id]&&(currentTab!=='roof'||l.id.startsWith('frame-')||l.id.startsWith('roof')||frameContextLayers.includes(l.id))).map(l=>`<div class="layer"><label class="layer-label"><input data-layer-visible="${l.id}" type="checkbox" ${l.visible?'checked':''}><span class="layer-swatch" style="background:rgb(${l.color.map(v=>v*255).join(',')})"></span>${LAYER_META[l.id][0]}<button data-layer-info="${l.id}" aria-label="Сведения о слое ${esc(LAYER_META[l.id][0])}">ⓘ</button></label><input aria-label="Непрозрачность ${esc(LAYER_META[l.id][0])}" title="Непрозрачность" data-layer-opacity="${l.id}" type="range" min="0" max="100" value="${Math.round(l.opacity*100)}"></div>`).join('');}
$('layers').addEventListener('input',e=>{
 const {layerVisible,layerOpacity}=e.target.dataset;
 const layer=renderer.layers.get(layerVisible||layerOpacity);
 if(layerVisible){
  layer.visible=e.target.checked;
  if(layerVisible.startsWith('frame-')&&layer.visible)loadSceneRoofFrame(renderer);
  if(servicePipeLayers.includes(layerVisible))syncHousePipeButton();
 }
 if(layerOpacity)layer.opacity=+e.target.value/100;
 renderer.request();
});
$('layers').addEventListener('click',e=>{const b=e.target.closest('[data-layer-info]');if(b){e.preventDefault();inspect(b.dataset.layerInfo);}});
function inspect(id){
 const layerInfo=foundationLayers.find(([key])=>key===id);
 if(layerInfo&&mode==='foundation-stack'){const [key,title,size,purpose,z]=layerInfo;$('inspector').innerHTML=`<div class="eyebrow">СЛОЙ ${foundationLayers.indexOf(layerInfo)+1} ИЗ 8</div><h3>${title}</h3><p>${purpose}.</p><div class="formula">${size}<br>${z}</div>${sheetBtn('house_2',8,'Сечение КЖ-3')}`;return;}
 if(id==='roofBelt'||id.startsWith('mp2-')){openSheet('house_2',15);return;}if(['roofCheeks','entryValley'].includes(id)){openRoofGeometry();return;}if(inspectExperienceLayer(id))return;if(EXPERIENCE_MODES.includes(mode)&&renderer?.objectInfo?.has(id)){selectSceneObject(id);return;}if(id.startsWith('frame-')){withResources(['roof-frame'],renderRoofFrameInspector);return;}if(inspectStairPart(id))return;if(['beamL','beamPinExt','beamPinInt'].includes(id)){inspectRebarFamily(({beamL:4,beamPinExt:5,beamPinInt:8})[id]);return;}if(id==='rebarChecks'){openRebarLayout();return;}
 if(id.startsWith('service:')){const source=MODEL.services.find(a=>a.id===id.slice(8));if(!source)return;const s=servicePlacement(source,experience.waterCorner);$('inspector').innerHTML=`<div class="eyebrow">ЗАКЛАДНЫЕ / ПРИМЕРНАЯ СХЕМА</div><h3>${s.label}</h3><span class="status amber">Только XY · Z не задан</span><div class="detail-list"><div class="detail-row">Труба<b>${s.diameter?'Ø'+s.diameter+' мм':'кабель не задан'}</b></div><div class="detail-row">Стальная гильза<b>Ø${s.sleeve} мм</b></div><div class="detail-row">X / Y, условно<b>${s.x_mm} / ${s.y_mm}</b></div></div><p>${s.proposal?esc(MODEL.experience.water_proposal.formula)+' · решение владельца от 18.11.2026':esc(s.formula)}</p><button data-anchor-plan="${s.id}">Размеры до осей и другой гильзы ↗</button><p>Координаты рассчитаны по частям осей X. Общая цепочка имеет расхождение 5 мм.</p><div class="callout">Маркер не задаёт длину гильзы, отметку оси трубы или трассу. Отметка −0.500 в рамке не принята за Z трубы.</div><button data-service-detail="${s.id==='electric'?'electric':s.id==='В1-1'?'water':'sewer'}">Разобрать местный узел в 3D ↗</button>${sheetBtn('embeds',1,'ВК-1 · PDF 1')}`;return;}
 const records={
 slab:{title:'Монолитная плита Фм 1',k:'КЖ-3 / КЖ-4',props:[['Толщина','foundation.Фм1.slab_thickness'],['Верх','foundation.Фм1.top_elevation'],['Низ','foundation.Фм1.bottom_elevation'],['Бетон В25','foundation.concrete.quantity']],note:'В объём Фм 1 входят плита и ростверки над ней.',pages:[8,9]},
 beams:{title:'Ростверк над плитой',k:'КЖ-3 / СЕЧЕНИЯ 2–2 И 4–4',props:[['Наружный','foundation.Фм1.external_beam_width'],['Внутренний','foundation.Фм1.internal_beam_width'],['Подъём','foundation.Фм1.beam_height_above_slab'],['Верх','foundation.Фм1.beam_top_elevation']],note:'Армирование различается по сечению: шпилька поз.5 снаружи, поз.8 внутри. Ростверки собраны без двойных пересечений, с разрывами у ворот/дверей. Геометрический баланс пока не совпал с ведомостью (I013).',pages:[8,9]},
 bottom:{title:'Нижняя сетка · поз.1',k:'КЖ-3 / КЖ-4',props:[['Стержни Ø12 А500С','foundation.Фм1.rebar.1.quantity'],['Шаг в поле','foundation.Фм1.lower_mesh_spacing'],['Защитный слой на сечении','foundation.Фм1.rebar_cover']],note:'Два направления. 2464 п.м. — количество строки поз.1 из спецификации; не количество стержней. Контур и стыки определяют реальный раскрой.',pages:[7,8,9]},
 top:{title:'Верхняя сетка · поз.2',k:'КЖ-3 / СЕЧЕНИЯ 1–1 И 3–3',props:[['Стержни Ø12 А500С','foundation.Фм1.rebar.2.quantity'],['Шаг в поле','foundation.Фм1.upper_mesh_field_spacing'],['Шаг у края по 3–3','foundation.Фм1.upper_mesh_edge_spacing']],note:'Не переносить ш.200 автоматически на зону сечения 3–3. Границы локальной зоны ещё не восстановлены.',pages:[7,8,9]},
 chair:{title:'Фиксатор · поз.3',k:'КЖ-2 / КЖ-4',props:[['Ø8 А240 · количество','foundation.Фм1.rebar.3.quantity'],['Длина заготовки','foundation.Фм1.rebar.3.length'],['Шаг, шахматно','foundation.Фм1.chair_spacing']],note:'Эскиз детали: верх 130, высота 160, лапы 250 мм. Обзорное размещение иллюстративно; источником количества остаётся ведомость.',pages:[7,8,9]},
 beamsteel:{title:'Арматура ростверка',k:'КЖ-3 / КЖ-4',props:[['Продольные поз.6','foundation.Фм1.beam_longitudinal_count'],['Ø8 А500С всего','foundation.Фм1.rebar.6.quantity'],['Поз.4 · шаг','foundation.Фм1.beam_vertical_spacing'],['Поз.4 · длина','foundation.Фм1.rebar.4.length']],note:'Шпильки поз.5/8: ш.400, в зависимости от сечения. Точное положение и гибы сверять по КЖ-3/4.',pages:[8,9]},
 edgesteel:{title:'П-детали · поз.7',k:'КЖ-3 / КЖ-4',props:[['Ø8 · количество','foundation.Фм1.rebar.7.quantity'],['Длина заготовки','foundation.Фм1.rebar.7.length'],['Шаг','foundation.Фм1.edge_link_spacing']],note:'Эскиз 400 + 220 + 400 = 1020 мм. Применение показано в сечении 3–3. В строке7 класс А500, в итоговой группе А500С; открыто I018.',pages:[8,9]},
 blinding:{title:'Бетонная подготовка',k:'КЖ-3 / КЖ-4',props:[['Толщина В10','foundation.Фм1.blinding_thickness'],['Объём В10','foundation.blinding.quantity']],note:'В10 учтён в пределах действующего контура плиты.',pages:[8,9]},
 base:{title:'Подготовка основания',k:'КЖ-3 / КЖ-4',props:[['Щебень 5–10 · слой','foundation.Фм1.gravel_5_10_thickness'],['Щебень 20–40 · слой','foundation.Фм1.gravel_20_40_thickness'],['Коэффициент уплотнения','foundation.Фм1.gravel_compaction'],['Низ основания','foundation.Фм1.base_elevation']],note:'По 63,4 м³ каждой фракции в ведомости; геотекстиль 460,0 м². В разделе «Материалы» дан чистый объём каждой фракции под плитой без наружных выносов. Дренаж по КЖ-3 решается по условиям площадки.',pages:[8,9]},
 lap:{title:'Стык Ø12 А500С',k:'КЖ-2 / ДЕТАЛЬ СТЫКОВКИ',props:[['Нахлёст','foundation.Фм1.lap_length'],['Между участками нахлёста, min','foundation.Фм1.lap_min_stagger']],note:'Нахлёст и разбежка — разные размеры. Общие длины стержней на демонстрации условны.',pages:[7]},
 services:{title:'Вода, канализация, кабель',k:'ВК-1 / 06.26',props:[],note:'Пять стояков Ø110 в гильзах Ø200, вода Ø32 в гильзе Ø100, предполагаемый кабельный ввод в гильзе Ø50. Высоты и полная трасса не заданы. Нажмите на маркер.',pages:[]},
 walls1:{title:'Первый этаж',k:'АР-3 / АР-5',props:[['Несущая кладка','wall.external.aac_thickness'],['Чистый пол','level.floor_1.elevation'],['Низ перекрытия','level.slab.Pm1_bottom.elevation']],note:`${MODEL.floor1?.walls.length} участков стен и ${MODEL.floor1?.openings.length} вырезов, включая вход на лестницу и проход под ней по АР-3/5. Открыты I002/I010/I014 и гипотезы санузла 2/ВК-2. Порядовка всех смоделированных стен доступна в разделе «Кладка»; проблемные подрезки выделены.`,ar:[4,6]},
 walls2:{title:'Мансарда: план и условный верх',k:'АР-4 / АР-6 / I016',props:[['Чистый пол','level.floor_2.elevation'],['Минимальная высота общих данных','level.floor_2.height_min'],['Максимальная высота общих данных','level.floor_2.height_max']],note:'План и 10 проёмов связаны с размерными цепями. Верх в обзоре получен по кровле без искусственного зазора. Это не профиль рабочей кладки и не основание для закупки. Открыты локальные остатки и несовпадение аркиОК-9.',ar:[5,7,18]},
 upperFrame:{title:'Каркасные перегородки мансарды',k:'АР-4 / АР-6 / I016',props:[['Толщина','plan.floor_2.anchors.frame_thickness']],note:'Размещены по чистым размерам помещений, двери отделены от проёмов. Высота до кровли условная, детали каркаса и крепления в этой оболочке не назначены.',ar:[5,7]},
 slab2:{title:'Межэтажное перекрытие',k:'АР-9 / КЖ-7 / КЖ-8',props:[['Низ','level.slab.Pm1_bottom.elevation'],['Верх','level.slab.Pm1_top.elevation']],note:'Толщина 180 мм следует из отметок. Контур и отверстия — в КЖ-7; обзорный контур схематичен.',pages:[12,13]},
 roof:{title:'Мансардная кровля',k:'АР-8 / КД-2…4',props:[['Подписанный уклон','roof.pitch'],['Верхний конёк','level.roof.ridge.elevation'],['OSB-3','roof.osb.thickness']],note:'Скаты восстановлены как явный размерный вариант. Площадь оболочки и отклонения доступны при выборе ската. Исходные 300 м² сохраняются отдельно. В каталоге доступны 14 узлов. Режим каркаса показывает сечения и условные посадки деревянных элементов.',pages:[22,23,24],ar:[9,12,23]},
 roofReturns:{title:'Геометрические перепады у выступов',k:'АР-8 / ПРОИЗВОДНАЯ ГЕОМЕТРИЯ',props:[],note:'Янтарные поверхности соединяют кровли разной высоты. Они не задают положение и материал стен слуховых окон: нужно учесть свес и рабочий узел примыкания. Их объём в расходе кладки отсутствует.',ar:[9]}
 };
 const a=records[id]||records[id.startsWith('gravel')?'base':id==='membrane'?'base':'slab'];$('inspector').innerHTML=`<div class="eyebrow">ВЫБРАННЫЙ ЭЛЕМЕНТ</div><h3>${a.title}</h3><span class="badge">${a.k}</span><div class="detail-list">${a.props.map(([title,id])=>`<div class="detail-row"><span>${title}</span><b>${MODEL.foundation.quantity_changes[id]?`<button class="link-button" data-fact="${esc(id)}">${revisedQuantity(id)} ↗</button>`:factBtn(id,moneyless(id))}</b></div>`).join('')}</div><p>${a.note}</p>${(a.pages||[]).map(p=>sheetBtn('house_2',p)).join('')}${(a.ar||[]).map(p=>sheetBtn('house_1',p)).join('')}${['walls2','upperFrame'].includes(id)?'<button data-upper-geometry>План и ограничения ↗</button>':''}${['roof','roofReturns'].includes(id)?'<button data-roof-geometry>Плоскости и отклонения ↗</button>':''}${id==='services'?sheetBtn('embeds',1,'Схема закладных'):''}${['slab','beams'].includes(id)?'<button class="source-button" data-foundation-geometry>Контур и сверка объёмов ↗</button>':''}<div class="callout"><b>Как читать модель</b>${['house','foundation','floor1','floor2','roof','rebar','stairs','frame','services3d','foundation-stack','masonry3d'].includes(mode)?'Фундамент и первый этаж восстановлены по привязкам как варианты на проверке. Кровля — плоские скаты по АР-8 с открытыми цепями; профиль верха стен мансарды условный. Все расчётные и исходные количества разделены.':'Восстановлены локальные размеры сечения. Длина фрагмента и упрощения стержней не используются для расхода.'}</div>`;
}
function picked(id){
 if(renderer.walk){
  if(id.startsWith('leaf:'))toggleOpening(id);
  else if(id.startsWith('frame-member:'))selectRoofFrameMember(id.slice(13));
  return;
 }
 if(mode==='frame'&&id.startsWith('frame-window:')){selectRoofFrameMember(id);return;}if((EXPERIENCE_MODES.includes(mode)||(['frame','roof'].includes(mode)&&(id.startsWith('leaf:')||id.startsWith('frame-window:'))))&&handleExperiencePick(id))return;if(id.startsWith('frame-member:')){selectRoofFrameMember(id.slice(13));return;}if(id==='frame:checks'){openRoofFrame();return;}if(id.startsWith('rebar:')){selectRebarElement(id.slice(6));return;}if(id.startsWith('upperwall:')){openUpperFloor(id.slice(10));return;}if(id==='roof:geometry'||id.startsWith('roofcell:')){openRoofGeometry(id.startsWith('roofcell:')?id.slice(9):null);return;}if(id.startsWith('wall:')){openFloorWall(id.slice(5));return;}if(id.startsWith('floor-lintel:')){openSheet('house_2',16);return;}if(id.startsWith('floor-brick:')){openSheet('house_1',id.endsWith('vent1')?20:id.endsWith('vent2')?21:22);return;}if(id==='geometry:foundation'){openFoundationGeometry();return;}if(id.startsWith('sheet:')){const [,s,p]=id.split(':');openSheet(s,+p);}else if(FACTS.has(id))openFact(id);else inspect(id);}
function initMainRenderer(){
 try{
  renderer=new HouseGL($('scene'),picked,s=>{if(s.error){$('render-error').hidden=false;$('render-error').textContent=s.error;}});
  renderer.labelRoot=$('world-labels');
  initSceneControls();
  return true;
 }catch(error){$('render-error').hidden=false;$('render-error').textContent=error.message;console.error(error);return false;}
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>buildScene(b.dataset.mode));
$('xray').onclick=()=>{if(!renderer)return;const anyOpaque=['slab','beams'].some(i=>renderer.layers.get(i)?.opacity>.5);for(const i of ['slab','beams']){const l=renderer.layers.get(i);if(l){l.opacity=anyOpaque?.16:1;l.visible=true;}}renderLayerControls();renderer.request();};
$('isolate-foundation').onclick=()=>buildScene('foundation');
$('explode').oninput=e=>{if(!renderer)return;renderer.explode=+e.target.value;$('explode-value').textContent=e.target.value+' мм';renderer.request();};
$('cut').oninput=e=>{if(!renderer)return;renderer.clipZ=+e.target.value===11000?Infinity:+e.target.value;$('cut-value').textContent=Number.isFinite(renderer.clipZ)?(renderer.clipZ/1000).toFixed(3)+' м':'выкл.';renderer.request();};
$('view-iso').onclick=()=>{if(renderer){renderer.yaw=-.66;renderer.pitch=.82;renderer.request();}};$('view-top').onclick=()=>{if(renderer){renderer.yaw=0;renderer.pitch=.00001;if(mode==='floor1'){renderer.span=20000*renderer.fitAspect();renderer.target=[8500,8000,1200];renderer.pan=[0,0];}if(mode==='floor2'){renderer.span=19000*renderer.fitAspect();renderer.target=[7000,8000,4000];renderer.pan=[0,0];}renderer.request();}};$('view-front').onclick=()=>{if(renderer){renderer.yaw=0;renderer.pitch=Math.PI/2;renderer.request();}};$('view-reset').onclick=()=>renderer?.walk?startTour(experience.tourRoom):location.hash==='#entry-valley'?buildScene('house'):renderer?.home(['house','foundation','floor1','floor2','roof','rebar','stairs','frame','services3d','foundation-stack','masonry3d'].includes(mode)?mode:'detail');
$('zoom-in').onclick=()=>renderer?.zoom(.8);$('zoom-out').onclick=()=>renderer?.zoom(1.25);
function revisedQuantity(id){
 const r=MODEL.foundation.quantity_changes[id];if(!r)return moneyless(id);
 const current=r.current===null?(id==='building.footprint_area'?'требует уточнения':'по отдельной раскладке'):fmt(r.current,8)+' '+unit(r.unit);
 return `<del>${esc(r.previous)} ${unit(r.unit)}</del> <strong class="updated" title="${esc(r.basis)}">${current}</strong>`;
}
function renderModelSummary(){
 for(const button of document.querySelectorAll('.summary-strip [data-fact]')){
  const id=button.dataset.fact,r=MODEL.foundation.quantity_changes[id];
  button.querySelector('strong').innerHTML=`<del>${esc(r.previous)}</del> <b class="updated">${fmt(r.current,3)}</b> <em>${unit(r.unit)}</em>`;
 }
}
let masonryState={rows:[],inputs:null,selected:1};
function layoutWall({length,blockLength=625,blockHeight=250,joint=2,bed=20,base=-130,top=3020}){
 // Integer micrometres avoid cumulative binary-decimal drift in row arithmetic.
 const U=v=>Math.round(v*1000),W=U(length),L=U(blockLength),H=U(blockHeight),J=U(joint),B=U(bed),Z=U(base),T=U(top);if(W<=0||L<=0||H<=0||J<0||B<0||T<=Z+B)throw Error('Проверьте параметры сценария.');let rows=[],z=Z+B,index=1;
 while(z<T&&index<=100){const height=Math.min(H,T-z),pieces=[];let x=0,first=true;while(x<W&&pieces.length<1000){const stock=first&&index%2===0?L/2:L;const len=Math.min(stock,W-x);if(len<=0)break;pieces.push({x_mm:x/1000,length_mm:len/1000,cut:len<L});x+=len;if(x<W){const gap=Math.min(J,W-x);x+=gap;}first=false;}rows.push({index,z_mm:z/1000,height_mm:height/1000,top_mm:(z+height)/1000,pieces,reinforced:index===1||index%4===0,partial:height<H,closed_mm:(pieces.reduce((s,p)=>s+U(p.length_mm),0)+Math.max(0,pieces.length-1)*J)/1000});z+=height+J;index++;}
 return rows;
}
function masonryPage(){
 const wallChoices=DATA.facts.filter(f=>f.entity.startsWith('room.')&&f.source.pdf_page===4&&f.property.startsWith('plan_segment_'));
 const options=wallChoices.map(f=>`<option value="${esc(f.id)}" ${f.value==='5070'?'selected':''}>${esc(f.label)} · ${f.value} мм</option>`).join('');
 $('page-masonry').innerHTML=heading('04 / ОБА ЭТАЖА / ПО РЯДАМ','Газоблок: первый этаж и мансарда','Выберите этаж, ряд и способ отображения. План, 3D и детали мансарды подрезаны по скатам; формат блока, шов и постель — параметры сценария. Ниже сохранён контроль прямого участка.')+
 `<div class="callout"><b>Сценарий прямого участка · не монтажная порядовка этажа</b>Длина 625 мм есть в информационном приложении. Высота 250 мм — из каталога ЛСР; шов 2 мм и постель 20 мм — явно выбранные параметры сценария. Выбранный подписанный отрезок не считается стеной без проёмов автоматически. Углы, проёмы, перемычки и перевязка примыканий в этом расчёте отсутствуют.</div>
 <div class="card" style="margin-top:24px"><div class="row-controls"><label>Подписанный участок АР-3<select id="wall-choice">${options}</select></label><label>Высота блока, мм<input id="block-height" type="number" value="250" min="50" max="500" step="0.1"></label><label>Клеевой шов, мм<input id="block-joint" type="number" value="2" min="1" max="3" step="0.1"></label><label>Первая постель, мм<input id="block-bed" type="number" value="20" min="0" max="100" step="0.1"></label></div><div class="viewport" id="masonry-view"><canvas id="masonry-canvas" tabindex="0" aria-label="3D-раскладка прямого участка кладки, сценарий"></canvas><div class="viewport-top"><span class="status amber">Сценарий · углы и проёмы не включены</span></div><div class="view-tools"><button id="masonry-fullscreen" type="button" title="На весь экран" aria-label="На весь экран" aria-pressed="false">⛶</button></div><div class="scene-help">ЛКМ — вращать · колесо — масштаб · выбранный ряд выделен</div></div><div class="row-slider scene-course-controls" id="masonry-row-controls"><label for="row-select">Выбрать ряд</label><input id="row-select" type="range" min="1" max="13" value="1"><output id="row-current" for="row-select">1 / 13</output></div><div id="row-summary" class="formula"></div><div class="buttons-row">${sheetBtn('house_1',4,'АР-3 · исходный план')}${sheetBtn('house_2',1,'Приложение · перевязка')}${sheetBtn('house_2',5,'Приложение · швы и первый ряд')}</div><div id="row-layouts"></div></div>
 <div class="section-grid"><div class="card"><h3>Армирование кладки по проекту</h3><table><tbody><tr><td>Первый ряд на ж/б основании</td><td>${factBtn('masonry.reinforcement.first_row','предусмотрено')}</td></tr><tr><td>Каждый 4-й ряд</td><td>${factBtn('masonry.reinforcement.row_interval','Ø8 А500С')}</td></tr><tr><td>Под оконными проёмами</td><td>${factBtn('masonry.reinforcement.under_windows','дополнительный ряд')}</td></tr><tr><td>Кладочная арматура, ведомость АР-1</td><td>${factBtn('material.masonry_rebar.quantity','280,00 кг')}</td></tr></tbody></table><p style="margin-top:15px">280 кг относится к ведомости кладки дома; это не масса для одного выбранного участка или только первого этажа. Арматура показана цветной линией как отметка ряда, не как утверждённая раскладка штраб.</p></div><div class="card"><h3>Откуда взят формат блока</h3><p>В приложении к проекту: 625 мм в плане. В рабочем АР-2: ЛСР, плотность не менее 500 кг/м³, несущие стены 400 мм.</p><p>Таблица 1.1 <a href="${MODEL.external_references[0].url}" target="_blank" rel="noopener">официального альбома ЛСР 2022</a>, печатная страница 10: D500, длина 625, высота 250, толщина 400 мм. Справка проверена 15.11.2026, хранится отдельно от подписей проекта.</p><div class="status amber">Внешняя справка + сценарий</div><p style="margin-top:14px">Для законченной порядовки остаются: все привязки проёмов и простенков, решения углов, стыков несущих стен, отметки перемычек и фактическая толщина выравнивающей постели. Они не заменены средними значениями.</p></div></div>`;
 initFloorCourses();
 $('page-masonry').querySelector('.page-heading .status').textContent='Сценарий / внешняя справка';$('page-masonry').querySelector('.page-heading .status').className='status amber';
 try{masonryRenderer=new HouseGL($('masonry-canvas'),id=>{if(id.startsWith('row:')){$('row-select').value=id.slice(4);updateMasonry(false);}});masonryRenderer.yaw=-.3;masonryRenderer.pitch=1.12;}catch(e){$('masonry-view').insertAdjacentHTML('beforeend',`<div class="render-error">${esc(e.message)}</div>`);}
 if(masonryRenderer)initSceneFullscreen($('masonry-view'),$('masonry-fullscreen'),masonryRenderer,$('masonry-row-controls'));
 for(const id of ['wall-choice','block-height','block-joint','block-bed'])$(id).oninput=()=>updateMasonry(true);$('row-select').oninput=()=>updateMasonry(false);updateMasonry(true);
}
function updateMasonry(reset){
 const h=$('block-height'),j=$('block-joint'),bed=$('block-bed');if([h,j,bed].some(e=>e.value===''||!e.validity.valid)){$('row-summary').textContent='Проверьте высоту блока, шов 1–3 мм и первую постель. Результат не рассчитан.';return;}
 const fid=$('wall-choice').value,inputs={length:n(fid),blockLength:625,blockHeight:+h.value,joint:+j.value,bed:+bed.value,base:-130,top:3020,width:400,source_length_fact_id:fid,status:'scenario',pattern:'alternating_half_block_straight_segment'};
 const rows=layoutWall(inputs);masonryState.inputs=inputs;masonryState.rows=rows;let selected=Math.min(rows.length,+$('row-select').value);if(reset)selected=1;$('row-select').max=rows.length;$('row-select').value=selected;masonryState.selected=selected;$('row-current').textContent=selected+' / '+rows.length;
 const r=rows[selected-1],cuts=r.pieces.filter(p=>p.cut),count=rows.reduce((v,r)=>v+r.pieces.length,0);$('row-summary').innerHTML=`Ряд ${selected}: низ ${(r.z_mm/1000).toFixed(3)} м · верх ${(r.top_mm/1000).toFixed(3)} м · высота ${fmt(r.height_mm)} мм<br>${r.pieces.length} деталей · доборы: ${cuts.length?cuts.map(p=>fmt(p.length_mm)+' мм').join(', '):'нет'}${r.reinforced?' · армируемый ряд по кратности АР-2':''}<br><small>В сценарии ${rows.length} рядов, ${count} уложенных деталей, включая доборы. Это не количество закупаемых целых блоков: повторное использование обрезков не рассчитано.</small>`;
 $('row-layouts').innerHTML=rows.map(r=>`<div class="row-tile ${r.reinforced?'reinforced':''} ${r.index===selected?'selected':''}" data-row-number="${r.index}" role="button" tabindex="0" aria-label="Выбрать ряд ${r.index}"><strong>${r.index<10?'0':''}${r.index}</strong><div class="row-diagram">${r.pieces.map(p=>`<span class="${p.cut?'cut':''}" style="flex:${p.length_mm}" title="${fmt(p.length_mm)} × ${fmt(r.height_mm)} × 400 мм">${p.length_mm>130?fmt(p.length_mm):''}</span>`).join('')}</div><span class="row-note">${r.partial?'подрезка '+fmt(r.height_mm):r.reinforced?'Ø8 А500С':fmt(r.height_mm)+' мм'}</span></div>`).join('');
 $('row-layouts').onclick=e=>{const a=e.target.closest('[data-row-number]');if(a){$('row-select').value=a.dataset.rowNumber;updateMasonry(false);}};$('row-layouts').onkeydown=e=>{const a=e.target.closest('[data-row-number]');if(a&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('row-select').value=a.dataset.rowNumber;updateMasonry(false);}};
 if(!masonryRenderer)return;const g=masonryRenderer;g.clear();const rest=g.addLayer('otherRows',[.77,.80,.65],{opacity:.20,order:4}),chosen=g.addLayer('chosenRow',[.69,.75,.52]),cut=g.addLayer('cutBlocks',[.83,.65,.40]),rebar=g.addLayer('reinforcement',[.64,.33,.15]);for(const rr of rows)for(const p of rr.pieces){const l=rr.index===selected?(p.cut||rr.partial?cut:chosen):rest;g.box(l,p.x_mm-inputs.length/2,-200,rr.z_mm,p.x_mm+p.length_mm-inputs.length/2,200,rr.top_mm,'row:'+rr.index,rr.index===selected);}for(const rr of rows)if(rr.reinforced)g.line(rebar,[-inputs.length/2,-205,rr.top_mm+3],[inputs.length/2,-205,rr.top_mm+3]);g.commit();if(reset){g.span=Math.max(5000,inputs.length*.75);g.target=[0,0,1400];g.pan=[0,0];}g.request();
}
function showServiceInModel(id){
 if(id==='В1-1')experience.waterCorner=true;
 return activateTab('model','foundation',()=>{
  renderer.yaw=0;renderer.pitch=.00001;renderer.request();inspect('service:'+id);
 });
}
const tabContents={
 materials:[['facts','foundation','materials-ui'],()=>renderMaterialsPage({MODEL,$,fmt,n,esc,raw,unit,factBtn,sheetBtn,heading,moneyless,revisedQuantity,foundationBalanceCard,loadComparisonHTML,foundationRebarAuditCard,FACTS})],
 services:[['facts','foundation','services','service-details','services-ui'],()=>renderServicesPage({MODEL,$,fmt,esc,core,factBtn,sheetBtn,heading,servicePlacement,serviceDetailButtons,showServiceInModel})],
 masonry:[['renderer','facts','floor1','floor2','structure','roof','floor'],masonryPage],
 roof:[['facts','roof','roof-index','roof-ui'],()=>renderRoofPage({DATA,MODEL,FACTS,$,fmt,esc,unit,factBtn,sheetBtn,heading,roofGeometryCard,activateTab})],
 audit:[['facts','issues','audit','audit-ui'],()=>renderAuditPage({DATA,MODEL,$,fmt,esc,unit,factBtn,sheetBtn,heading})],
 sheets:[['sheets-ui','thumbs'],()=>renderSheetsPage({data:DATA,mount:$('page-sheets'),esc,fmt,sheetKey})],
};
const renderedTabs=new Set();
let tabRequest=0, sceneBeforeRoof=null, roofTabCoverHidden=true;
const modelLayout=document.querySelector('#page-model .model-layout');
const constructionStages={
 model:{scenes:['house']},
 foundation:{scenes:['foundation','foundation-stack','rebar','section-field','section-external','section-edge','section-internal','lap','services3d'],sheets:[['house_2',7],['house_2',8],['house_2',9],['embeds',1]]},
 masonry:{scenes:['floor1','floor2','masonry3d'],sheets:[['house_1',4],['house_1',5],['house_1',6],['house_1',7],['house_2',16]]},
 slab:{scenes:['stairs'],sheets:[['house_2',12],['house_2',20]]},
 roof:{scenes:['frame','roof'],sheets:[['house_1',9],['house_2',22],['house_2',23],['house_2',24]]},
};
let constructionStage='model';

function renderConstructionTools(stage){
 const config=constructionStages[stage];
 let toolbar=$('construction-scenes'),drawings=$('construction-files');
 if(!toolbar){
  toolbar=document.createElement('div');toolbar.id='construction-scenes';
  $('foundation-study').before(toolbar);
  drawings=document.createElement('div');drawings.id='construction-files';
  $('scene-notice').after(drawings);
 }
 const profiles=[...document.querySelectorAll('.preset[data-mode]')];
 const title=profile=>profile.querySelector('span')?profile.firstChild.textContent.trim():profile.textContent.trim();
 for(const profile of profiles)profile.hidden=!config?.scenes.includes(profile.dataset.mode);
 const choices=profiles.filter(profile=>!profile.hidden);
 toolbar.innerHTML=choices.length>1?`<label>Вид <select aria-label="Вид этапа">${config.scenes.map(value=>`<option value="${value}">${esc(title(choices.find(p=>p.dataset.mode===value)))}</option>`).join('')}</select></label>`:'';
 const view=toolbar.querySelector('select');if(view)view.onchange=()=>buildScene(view.value);
 drawings.innerHTML=config?.sheets?`<details><summary>Чертежи и файлы</summary><div class="buttons-row">${config.sheets.map(([source,page])=>sheetBtn(source,page)).join('')}${stage==='foundation'?'<button data-print-foundation>Скачать комплект Фм 1 · PDF</button><a href="#materials">Ведомость материалов</a>':''}${stage==='roof'?'<button id="load-roof-reference">Ведомость и 3D-узлы</button>':''}</div></details>`:'<p><a href="#sheets">Все чертежи</a></p>';
 $('load-roof-reference')?.addEventListener('click',()=>{
  const request=tabRequest;
  const [keys,render]=tabContents.roof;
  withResources(keys,()=>{
   if(request!==tabRequest)return;
   if(!renderedTabs.has('roof')){render();renderedTabs.add('roof');}
   $('roof-reference').hidden=false;
   $('roof-reference').scrollIntoView({block:'start'});
  });
 });
 syncConstructionScene();
}

function syncConstructionScene(){
 const select=$('construction-scenes')?.querySelector('select');if(select)select.value=mode;
}

function activateTab(id,scene,afterScene){
 renderer?.resetInput();
 const targetStage=constructionViewer&&Object.hasOwn(constructionStages,id)?id:null;
 constructionStage=targetStage??id;
 if(targetStage&&targetStage!=='roof'){
  scene??=constructionStages[targetStage].scenes[0];
  id='model';
 }
 if(id!=='model'&&!Object.hasOwn(tabContents,id))id='model';
 if(id!==currentTab)closeFullscreenScene?.();
 if(id==='roof'&&currentTab!=='roof'){
  sceneBeforeRoof??={mode:renderer?mode:'house',coverHidden:roofFrameState.coverHidden};
  roofFrameState.coverHidden=roofTabCoverHidden;
  $('roof-scene-mount').append(modelLayout);
  $('viewport').before($('frame-tools'));
 }else if(id!=='roof'&&currentTab==='roof'){
  roofTabCoverHidden=roofFrameState.coverHidden;
  roofFrameState.coverHidden=sceneBeforeRoof.coverHidden;
  $('page-model').append(modelLayout);
  modelLayout.querySelector('.summary-strip').before($('frame-tools'));
 }
 const request=++tabRequest;
 dialogRequest++;
 if(id!=='model')sceneRequest++;
 currentTab=id;
 document.querySelectorAll('.tabs [data-tab]').forEach(b=>{
  const active=b.dataset.tab===(constructionViewer?constructionStage:id);
  b.classList.toggle('active',active);
  b.setAttribute('aria-current',active?'page':'false');
 });
 const page=$('page-'+id);
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p===page));
 history.replaceState(null,'','#'+(constructionViewer?constructionStage:id));
 if(constructionViewer){
  document.body.dataset.stage=constructionStage;
  renderConstructionTools(constructionStage);
  $('roof-reference').hidden=true;
  if(id==='roof')return buildScene(scene||'frame',afterScene);
 }
 if(id==='model'){
  const original=sceneBeforeRoof;sceneBeforeRoof=null;
  if(scene||original||!renderer)return buildScene(scene||original?.mode||'house',afterScene);
  renderer.request();
  return true;
 }
 const [keys,render]=tabContents[id];
 return withResources(keys,()=>{
  if(request!==tabRequest)return false;
  if(!renderedTabs.has(id)){render();renderedTabs.add(id);}
  if(id==='roof')return buildScene('frame',afterScene);
  if(id==='masonry'){masonryRenderer?.request();floorRenderer?.request();}
  return true;
 });
}
function openLinkedTab(){
 if(location.hash==='#entry-valley')showEntryValley();
 else activateTab(location.hash.slice(1)||'model');
}
if(constructionViewer)window.addEventListener('hashchange',openLinkedTab);
else{
 document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
 document.querySelector('.brand').onclick=e=>{e.preventDefault();activateTab('model');};
}
openLinkedTab();
window.HouseApp={experience,startTour,exitTour,selectSceneObject,toggleOpening,ensureCombinedCourses,get sceneObjects(){return renderer?.sceneObjects;},get roofFrameState(){return roofFrameState;},framePieces,get stairState(){return stairState;},activeStair,activeSlab,get serviceDetailRenderer(){return serviceDetailRenderer;},get serviceDetailState(){return serviceDetailState;},get foundationRebarState(){return foundationRebarState;},get roofDetailRenderer(){return roofDetailRenderer;},get roofDetailState(){return roofDetailState;},get floorRenderer(){return floorRenderer;},get floorScenario(){return floorScenario;},get floorCourseLevel(){return floorCourseLevel;},get renderer(){return renderer;},get masonryRenderer(){return masonryRenderer;},get mode(){return mode;},get tab(){return currentTab;},get masonryState(){return masonryState;},get activeSheetRuler(){return activeSheetRuler;},data:DATA,rulerPerpendicular,layoutWall,activateTab,buildScene,openFact,openSheet,openNode};
function foundationGeometrySVG(){
 const f=MODEL.foundation,p=f.slab.render_polygon_mm.map(p=>p.map(Number));
 return `<svg class="plan-svg geometry-plan" viewBox="-1800 -17800 20600 19600" role="img" aria-label="Восстановленный вариант контура Фм 1 с ростверками и прямым восточным краем, на проверке"><g transform="scale(1,-1)"><polygon points="${p.map(a=>a.join(',')).join(' ')}" fill="#e7eadb" stroke="#637d5a" stroke-width="34"/>${f.plinth.disjoint_rectangles_mm.map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${+r[2]-r[0]}" height="${+r[3]-r[1]}" fill="#94aa7e"/>`).join('')}${Object.entries(MODEL.axis_view_variant.x).map(([a,x])=>`<path d="M${x},-900V16800" stroke="#bcc8b1" stroke-width="10" stroke-dasharray="110 160"/>`).join('')}<path d="M${f.slab.front_x_start_mm},${f.slab.front_y_mm} H${f.slab.edge_x_mm} v${f.slab.edge_length_mm}" stroke="#bd6732" stroke-width="55"/></g>${f.points.slice(0,p.length).map((q,i)=>`<text x="${+q.x_mm+120}" y="${-q.y_mm-100}" font-size="190" fill="#637354">P${i+1}</text>`).join('')}<text x="4500" y="900" font-size="225" fill="#637354">Фм 1 · размерный вариант по осям · I002/I012/I013</text></svg>`;
}
function foundationBalanceTable(){const rows=MODEL.foundation.calculations.filter(c=>['foundation.geometry.area','foundation.geometry.plinth_area','foundation.geometry.slab_volume','foundation.geometry.plinth_volume','foundation.geometry.total_volume'].includes(c.id));return `<div class="table-wrap"><table><thead><tr><th>Показатель</th><th>Геометрия варианта, ≈</th><th>Ведомость КЖ-4</th><th>Разница, ≈</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.label)}</td><td class="number updated">${fmt(c.value,8)} ${unit(c.unit)}</td><td class="number">${c.printed?'<del>'+esc(c.printed)+' '+unit(c.unit)+'</del>':'—'}</td><td class="number ${c.difference?'check-bad':''}">${c.difference?fmt(c.difference,4):'—'}</td></tr>`).join('')}</tbody></table></div>`;}
function foundationBalanceCard(){const f=MODEL.foundation;return `<div class="card" id="foundation-balance"><h3>Край параллельно фасаду</h3><p>Параллельно оси 6 проложен край длиной ${fmt(f.slab.edge_length_mm)} мм по наружной грани выступа стены. Передний край площадки проходит на ${fmt(f.slab.front_y_mm)} мм от оси А. От предыдущей прямой версии справа убрано ${fmt(f.revision.removed_side_m2,6)} м², спереди добавлено ${fmt(f.revision.added_front_m2)} м². Ростверки проходят внутри этого края.</p>${foundationBalanceTable()}<p>КЖ-4 относится к исходной форме. Ещё у варианта с дугой оставалось расхождение по объёму В25 (I013).</p><div class="buttons-row"><button data-foundation-geometry>Координаты и формулы ↗</button><button data-print-foundation>↓ План для печати · А3</button>${sheetBtn('house_2',7,'КЖ-2 · контур','revision')}${sheetBtn('house_2',9,'КЖ-4 · ведомость')}</div></div>`;}
function openFoundationGeometry(){const f=MODEL.foundation;showDialog('КЖ-2 / ВОССТАНОВЛЕННЫЙ ВАРИАНТ','Геометрия фундамента и открытые зависимости',`<p>Вариант от 18 ноября 2026. Восточный край проходит по прямой X = ${f.slab.edge_x_mm} мм между Y = ${f.slab.front_y_mm} и ${+f.slab.front_y_mm + +f.slab.edge_length_mm} мм. Оси X рассчитаны по сумме частей. Прежняя дуга R12190 и её расхождения доступны на исходном листе. Открыты I002/I012/I013.</p>${foundationGeometrySVG()}${foundationBalanceTable()}<h3 style="margin-top:28px">Координаты и формулы привязок</h3><p class="tiny muted">P1…P${f.slab.point_ids.length} — внешний контур плиты. Остальные точки — внешний контур ростверка. Нулевые координаты — условное начало (1,А), не геодезическая привязка.</p><div class="table-wrap"><table><thead><tr><th>Точка</th><th>X / Y, мм</th><th>Связь с записями источника</th></tr></thead><tbody>${f.points.map((p,i)=>`<tr><td class="number">P${i+1}<br><small>${esc(p.id)}</small></td><td class="number">${p.x_mm} / ${p.y_mm}</td><td><details><summary>Формулы и ${p.input_fact_ids.length} входов</summary><div class="formula">X = ${esc(p.x_formula)}<br>Y = ${esc(p.y_formula)}</div>${p.input_fact_ids.map(id=>factBtn(id,FACTS.get(id)?.label)).join('<br>')}</details></td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:28px">Разрывы ростверков</h3><table><thead><tr><th>Участок</th><th>Границы [X0,Y0,X1,Y1], мм</th></tr></thead><tbody>${f.plinth.cuts.map(c=>`<tr><td>${esc(c.purpose)}</td><td class="number">${c.bounds_mm.join(' / ')}</td></tr>`).join('')}</tbody></table><p class="tiny muted">Разрывы убраны только из ростверков над плитой. Тело плиты под воротами и дверями сохраняется. Положение арматурных стыков, анкеров и местных усилений этими границами не задаётся.</p>${sheetBtn('house_2',7,'Открыть исходный лист КЖ-2','source')}`);}
