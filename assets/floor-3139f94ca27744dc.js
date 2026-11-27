/* Pure geometry routines shared by the overview and the course inspector.
 * Dimensions in millimetres. Quantisation to 0.001 mm keeps course arithmetic
 * stable; no geometry routine changes source schedule quantities.
 */
'use strict';
const FloorGeometry=(()=>{
 const q=n=>Math.round(n*1000)/1000,nums=r=>r.map(Number),positive=r=>r.every(Number.isFinite)&&r[2]>r[0]+.0001&&r[3]>r[1]+.0001;
 function subtract2(a,b){const x0=Math.max(a[0],b[0]),y0=Math.max(a[1],b[1]),x1=Math.min(a[2],b[2]),y1=Math.min(a[3],b[3]);if(x1<=x0||y1<=y0)return [a];return [[a[0],a[1],x0,a[3]],[x1,a[1],a[2],a[3]],[x0,a[1],x1,y0],[x0,y1,x1,a[3]]].filter(positive);}
 function subtract3(a,b){const x0=Math.max(a[0],b[0]),y0=Math.max(a[1],b[1]),z0=Math.max(a[2],b[2]),x1=Math.min(a[3],b[3]),y1=Math.min(a[4],b[4]),z1=Math.min(a[5],b[5]);if(x1<=x0||y1<=y0||z1<=z0)return [a];return [[a[0],a[1],a[2],x0,a[4],a[5]],[x1,a[1],a[2],a[3],a[4],a[5]],[x0,a[1],a[2],x1,y0,a[5]],[x0,y1,a[2],x1,a[4],a[5]],[x0,y0,a[2],x1,y1,z0],[x0,y0,z1,x1,y1,a[5]]].filter(r=>r[3]>r[0]+.0001&&r[4]>r[1]+.0001&&r[5]>r[2]+.0001);}
 function ownerRegions(model,row=1){const priority=[...model.walls].sort((a,b)=>{const ar=nums(a.bounds_mm),br=nums(b.bounds_mm),aw=ar[a.axis===0?3:2]-ar[a.axis===0?1:0],bw=br[b.axis===0?3:2]-br[b.axis===0?1:0];return (a.material==='frame')-(b.material==='frame')||bw-aw||(a.axis===(row%2?0:1)?-1:1)-(b.axis===(row%2?0:1)?-1:1)||a.id.localeCompare(b.id);});const prior=[],out=[];
  for(const wall of priority){let rects=[nums(wall.bounds_mm)];for(const cut of prior)rects=rects.flatMap(r=>subtract2(r,cut));prior.push(nums(wall.bounds_mm));for(const c of model.brick_envelopes)rects=rects.flatMap(r=>subtract2(r,nums(c.bounds_mm)));for(const rect of rects)out.push({wall,rect});}return out;
 }
 const volume=r=>(r[3]-r[0])*(r[4]-r[1])*(r[5]-r[2])/1e9;
 const rectangle=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
 function stairEnvelopes(stair,riser,tread){
  const slope=riser/tread;
  const envelopes=stair.flights.map(flight=>{
   const rule=flight.geometry_rule,origin=+rule.origin_x_mm,end=origin+rule.direction_x*flight.plan_run_mm;
   const a=slope/rule.direction_x,c=+rule.base_mm-riser-a*origin-rule.normal_thickness_mm*Math.sqrt(1+slope*slope);
   const [y0,y1]=nums(flight.y_bounds_mm);
   return {foot:rectangle(Math.min(origin,end),y0,Math.max(origin,end),y1),plane:[a,0,c]};
  });
  for(const box of stair.landing.disjoint_boxes_mm??[stair.landing.bounds_mm]){
   const [x0,y0,z0,x1,y1]=nums(box);
   envelopes.push({foot:rectangle(x0,y0,x1,y1),plane:[0,0,z0]});
  }
  return envelopes;
 }
 function stairCuts(envelopes,wall){
  if(wall!=='boiler')return envelopes;
  const [lower,upper]=envelopes;
  const gapStart=Math.min(lower.foot[0][0],upper.foot[0][0]);
  const foot=rectangle(gapStart,lower.foot[2][1],upper.foot[1][0],upper.foot[0][1]);
  return [...envelopes,{foot,plane:upper.plane}];
 }
 function stairPatches(bounds,wall,envelopes){
  const shapes=window.HouseShapes, [x0,y0,z0,x1,y1,z1]=bounds;
  let pieces=[{polygon_mm:rectangle(x0,y0,x1,y1),bottom_plane:[0,0,z0],top_plane:[0,0,z1]}];
  if(wall==='wc2-frame'){
   pieces[0].top_plane=envelopes[1].plane;
   return pieces;
  }
  const cuts=stairCuts(envelopes,wall);
  for(const {foot,plane} of cuts){
   const next=[];
   for(const piece of pieces){
    for(const polygon of shapes.subtract(piece.polygon_mm,foot))next.push({...piece,polygon_mm:polygon});
    const inside=intersectConvex(piece.polygon_mm,foot);
    const delta=plane.map((v,i)=>v-piece.top_plane[i]);
    const candidates=delta.every(v=>v===0)?[[inside,piece.top_plane]]:
     [[shapes.clip(inside,delta),piece.top_plane],[shapes.clip(inside,delta.map(v=>-v)),plane]];
    for(const [region,top] of candidates){
     const polygon=shapes.clip(region,top.map((v,i)=>v-piece.bottom_plane[i]));
     if(polygon.length>=3&&shapes.area(polygon)>1e-5&&polygon.some(p=>shapes.z(top,p)>z0+1e-5)){
      next.push({...piece,polygon_mm:polygon,top_plane:top});
     }
    }
   }
   pieces=next;
  }
  return pieces;
 }
 function prismVolume(piece){
  const shapes=window.HouseShapes,polygon=piece.polygon_mm;
  let volume=0;
  for(let i=1;i<polygon.length-1;i++){
   const triangle=[polygon[0],polygon[i],polygon[i+1]];
   const height=triangle.reduce((sum,p)=>sum+shapes.z(piece.top_plane,p)-shapes.z(piece.bottom_plane,p),0)/3;
   volume+=shapes.area(triangle)*height/1e9;
  }
  return volume;
 }
 function installedVolume(bounds,wall,envelopes){
  if(wall!=='bearing3'&&wall!=='boiler')return volume(bounds);
  return stairPatches(bounds,wall,envelopes).reduce((sum,piece)=>sum+prismVolume(piece),0);
 }
 function intersectConvex(poly,foot){
  const shapes=window.HouseShapes;
  for(let i=0;i<foot.length&&poly.length;i++){
   const [x,y]=foot[i],b=foot[(i+1)%foot.length],dx=b[0]-x,dy=b[1]-y;
   if(dx||dy)poly=shapes.clip(poly,[-dy,dx,dy*x-dx*y]);
  }
  return poly;
 }
 function jointFace(piece,z,envelopes){
  const b=piece.bounds_mm;
  if(piece.wall_id!=='bearing3'&&piece.wall_id!=='boiler')return [rectangle(b[0],b[1],b[3],b[4])];
  const shapes=window.HouseShapes;
  return stairPatches(b,piece.wall_id,envelopes)
   .map(p=>shapes.clip(p.polygon_mm,[...p.top_plane.slice(0,2),p.top_plane[2]-z]))
   .filter(p=>p.length>=3&&shapes.area(p)>1e-5);
 }
 function masonryTakeoff(model,scenario,envelopes,landingSharedBoxes=[]){
  const shapes=window.HouseShapes,params=scenario.parameters;
  const walls=new Map(),groups=new Map(),row_counts=[];
  const common=landingSharedBoxes.map(nums);
  const accounted={net_blocks_m3:0,bed_m3:0,horizontal_glue_m3:0,vertical_glue_m3:0};
  function measure(bounds,id,key){
   if(id==='boiler')for(const box of common){
    const lower=bounds.slice(0,3).map((n,i)=>Math.max(n,box[i]));
    const upper=bounds.slice(3).map((n,i)=>Math.min(n,box[i+3]));
    if(lower.every((n,i)=>n<upper[i]))accounted[key]+=installedVolume([...lower,...upper],id,envelopes);
   }
   return installedVolume(bounds,id,envelopes);
  }
  for(const wall of model.walls.filter(w=>w.material==='aac')){
   const cross=1-wall.axis,thickness=+wall.bounds_mm[cross+2]-wall.bounds_mm[cross];
   const role=wall.material_status==='unconfirmed'?'unconfirmed':
    wall.outside_sign?'external':wall.id.startsWith('bearing')?'internal':'partition';
   walls.set(wall.id,{wall_id:wall.id,axis:wall.axis,role,thickness_mm:thickness,placed_pieces:0,stair_cut_pieces:0,
    net_blocks_m3:0,bed_m3:0,horizontal_glue_m3:0,vertical_glue_m3:0});
  }
  const bedTop=params.base+params.bed;
  for(const solid of solids(model)){
   if(!walls.has(solid.wall_id))continue;
   const b=solid.bounds.slice();
   b[2]=Math.max(b[2],params.base);
   b[5]=Math.min(b[5],bedTop);
   if(b[5]>b[2])walls.get(solid.wall_id).bed_m3+=measure(b,solid.wall_id,'bed_m3');
  }
  let prior=[];
  for(const row of scenario.rows){
   let count=0,net=0;
   for(const piece of row.pieces){
    const b=piece.bounds_mm,wall=walls.get(piece.wall_id),installed=measure(b,piece.wall_id,'net_blocks_m3');
    if(installed<=1e-10)continue;
    wall.placed_pieces++;
    wall.net_blocks_m3+=installed;
    if(installed<volume(b)-1e-10)wall.stair_cut_pieces++;
    count++;net+=installed;
    if(b[2]!==row.z_mm)continue;
    let aboveFaces;
    for(const {below,faces} of prior){
     if(below[0]>=b[3]||below[3]<=b[0]||below[1]>=b[4]||below[4]<=b[1])continue;
     aboveFaces??=jointFace(piece,b[2],envelopes);
     for(const above of aboveFaces)for(const face of faces){
      const joint=intersectConvex(above,face);
      wall.horizontal_glue_m3+=shapes.area(joint)*params.joint/1e9;
      if(piece.wall_id==='boiler')for(const [x,y,z,X,Y,Z] of common){
       const height=Math.min(b[2],Z)-Math.max(b[2]-params.joint,z);
       if(height>0)accounted.horizontal_glue_m3+=shapes.area(intersectConvex(joint,rectangle(x,y,X,Y)))*height/1e9;
      }
     }
    }
   }
   prior=row.pieces.filter(p=>p.bounds_mm[5]===row.top_mm).map(p=>({
    below:p.bounds_mm,faces:jointFace(p,row.top_mm,envelopes)
   }));
   for(const joint of row.joints){
    const a=joint.at_mm-params.joint/2,b=joint.at_mm+params.joint/2;
    const c=joint.cross0_mm,d=joint.cross1_mm,z=joint.bottom_mm,Z=joint.top_mm;
    const wall=walls.get(joint.wall_id);
    const bounds=wall.axis===0?[a,c,z,b,d,Z]:[c,a,z,d,b,Z];
    wall.vertical_glue_m3+=measure(bounds,joint.wall_id,'vertical_glue_m3');
   }
   row_counts.push({row:row.index,placed_pieces:count,net_blocks_m3:net});
  }
  const fields=['placed_pieces','stair_cut_pieces','net_blocks_m3','bed_m3','horizontal_glue_m3','vertical_glue_m3'];
  const total=Object.fromEntries(fields.map(key=>[key,0]));
  for(const wall of walls.values()){
   const key=wall.role+'-'+wall.thickness_mm;
   if(!groups.has(key))groups.set(key,{...Object.fromEntries(fields.map(key=>[key,0])),role:wall.role,thickness_mm:wall.thickness_mm});
   const group=groups.get(key);
   for(const field of fields){group[field]+=wall[field];total[field]+=wall[field];}
  }
  for(const group of groups.values()){
   const unit=params.length*params.height*group.thickness_mm/1e9;
   group.block_volume_equivalent=group.role==='unconfirmed'?null:Math.ceil(group.net_blocks_m3/unit-1e-9);
  }
  const landing_shared_masonry=common.length?{
   envelope_m3:common.reduce((sum,b)=>sum+volume(b),0),
   accounted_m3:accounted
  }:null;
  return {total,groups:[...groups.values()],walls:[...walls.values()],row_counts,landing_shared_masonry,
   untrimmed_pieces:scenario.fragment_count,untrimmed_block_volume_m3:scenario.net_block_geometry_m3};
 }
 function cutsAtFloor1(model){
  const openings=model.openings.map(p=>{
   const bounds=nums(p.bounds_mm);
   if(p.frame_cut_bottom_mm!=null)bounds[2]=+p.frame_cut_bottom_mm;
   return bounds;
  });
  return [...openings,...model.lintel_envelopes.map(p=>p.bounds_mm),
   ...(model.entrance_arch?[model.entrance_arch.replacement_bounds_mm]:[]),
   ...(model.belt1?.concrete_boxes_mm||[]),...(model.belt1?.xps_boxes_mm||[])].map(nums);
 }
 function solids(model){const cuts=cutsAtFloor1(model),out=[];for(const {wall,rect:r} of ownerRegions(model)){let boxes=[[r[0],r[1],+wall.base_mm,r[2],r[3],+wall.top_mm]];for(const cut of cuts)boxes=boxes.flatMap(r=>subtract3(r,cut));for(const bounds of boxes)out.push({wall_id:wall.id,material:wall.material,bounds});}return out;}
 function masonryBelowCourses(model, elevation){
  return solids(model).filter(piece=>piece.material==='aac'&&piece.bounds[2]<elevation).map(piece=>{
   const bounds=[...piece.bounds];
   bounds[5]=Math.min(bounds[5],elevation);
   return {...piece,bounds};
  });
 }
 // Select end pieces before laying a run. Integer micrometres preserve exact
 // closure even for 312.5 mm half blocks and fractional glue thicknesses.
 // minEnd is an optimisation preference, not a structural rule. Bond is checked
 // separately against adjacent-row joint centres from the informational appendix.
 function runLayout(span,{length=625,joint=2,preferred=625,minEnd=100,bond=100,previous=[],start=0}={}){
  const U=v=>Math.round(v*1000),S=U(span),L=U(length),J=U(joint),B=U(bond),A=U(start);
  const least=Math.max(1,Math.ceil((S+J)/(L+J))),M=Math.min(U(minEnd),Math.floor((S-(least-1)*J)/least)),most=Math.max(least,Math.floor((S+J)/(M+J)));
  if(least===1)return {lengths:[S/1000],joints:[],closure_mm:S/1000,bond_violations:[],minimum_joint_shift_mm:null};
  const prev=previous.map(U).filter(p=>p>A&&p<A+S);
  const merge=intervals=>{const out=[];for(const [l,h]of intervals.sort((a,b)=>a[0]-b[0])){if(h<l)continue;const last=out.at(-1);if(last&&l<=last[1])last[1]=Math.max(last[1],h);else out.push([l,h]);}return out;};
  const intersect=(aa,bb)=>{const out=[];let i=0,j=0;while(i<aa.length&&j<bb.length){const lo=Math.max(aa[i][0],bb[j][0]),hi=Math.min(aa[i][1],bb[j][1]);if(hi>=lo)out.push([lo,hi]);if(aa[i][1]<bb[j][1])i++;else j++;}return out;};
  const choose=(ranges,target)=>ranges.map(([l,h])=>Math.max(l,Math.min(h,target))).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||b-a)[0];
  function solve(required){
   let allowed=[[A+M+J/2,A+S-M-J/2]];
   for(const p of prev){const next=[];for(const [lo,hi]of allowed){if(p+required<=lo||p-required>=hi){next.push([lo,hi]);continue;}if(p-required>=lo)next.push([lo,Math.min(hi,p-required)]);if(p+required<=hi)next.push([Math.max(lo,p+required),hi]);}allowed=next;}
   if(!allowed.length)return null;
   // Backward interval reachability proves that every selected joint leaves a
   // feasible remainder. An extra block is allowed when the shortest layout
   // cannot achieve the specified stagger with pieces of stock length <= L.
   for(let count=least;count<=most;count++){
    const reach=Array(count-1);reach[count-2]=intersect(allowed,[[A+S-L-J/2,A+S-M-J/2]]);
    for(let k=count-3;k>=0&&reach[k+1].length;k--)reach[k]=intersect(allowed,merge(reach[k+1].map(([lo,hi])=>[lo-L-J,hi-M-J])));
    if(!reach[0]?.length)continue;const first=intersect(reach[0],[[A+M+J/2,A+L+J/2]]);if(!first.length)continue;
    const joints=[choose(first,A+U(preferred)+J/2)];
    for(let k=1;k<count-1;k++){const last=joints.at(-1),range=intersect(reach[k],[[last+M+J,last+L+J]]);joints.push(choose(range,last+L+J));}
    return joints;
   }
   return null;
  }
  let joints=solve(B);
  if(!joints){let lo=0,hi=B;for(let i=0;i<18&&hi-lo>1;i++){const mid=Math.floor((lo+hi)/2);if(solve(mid))lo=mid;else hi=mid;}joints=solve(lo)||solve(0);}
  if(!joints)throw Error('Не удалось замкнуть участок кладки.');
  const lengths=[joints[0]-A-J/2,...joints.slice(1).map((p,i)=>p-joints[i]-J),A+S-joints.at(-1)-J/2],violations=[];let min=Infinity;
  for(const at of joints){let distance=Infinity,other=null;for(const p of prev)if(Math.abs(at-p)<distance){distance=Math.abs(at-p);other=p;}min=Math.min(min,distance);if(distance<B-.1)violations.push({at_mm:at/1000,previous_at_mm:other/1000,shift_mm:distance/1000});}
  return {lengths:lengths.map(x=>x/1000),joints:joints.map(x=>x/1000),closure_mm:(lengths.reduce((a,b)=>a+b,0)+(lengths.length-1)*J)/1000,bond_violations:violations,minimum_joint_shift_mm:Number.isFinite(min)?min/1000:null};
 }
 function courses(model,{height=250,length=625,joint=2,bed=20}={}){
  if(![height,length,joint,bed].every(Number.isFinite)||height<50||height>500||length<100||joint<1||joint>3||bed<0||bed>100)throw Error('Проверьте параметры блока и шва.');
  const rows=[],voids=cutsAtFloor1(model),regions={1:ownerRegions(model,1),0:ownerRegions(model,2)};
  const bond=Number(model.course_rules?.minimum_joint_shift_mm||100);let z=q(-130+bed),index=1,previousJoints=[];
  while(z<3020-.0001&&index<=100){
   const top=Math.min(3020,q(z+height)),pieces=[],runs=[],joints=[],bondViolations=[];let serial=0;
   for(const {wall,rect:r} of regions[index%2]){
    if(wall.material!=='aac')continue;const axis=wall.axis,cross=1-axis;
    // Carve the source openings/lintels first. A jamb can no longer slice a
    // last 0.5 mm off an already placed block. Vertical slivers remain visible
    // when the chosen course module does not match a source elevation.
    let available=[[r[0],r[1],z,r[2],r[3],top]];for(const cut of voids)available=available.flatMap(b=>subtract3(b,cut));
    for(const b of available){
     const prev=Math.abs(b[2]-z)<.001?previousJoints.filter(p=>p.wall_id===wall.id&&p.axis===axis&&p.cross0_mm<b[cross+3]&&p.cross1_mm>b[cross]&&Math.abs(p.top_mm-rows.at(-1)?.top_mm)<.001).map(p=>p.at_mm):[];
     const layout=runLayout(b[axis+3]-b[axis],{length,joint,preferred:index%2?length:length/2,minEnd:100,bond,previous:prev,start:b[axis]});
     const runId=`${index}:${wall.id}:run${runs.length}`,runPieces=[];let cursor=b[axis];
     for(const len of layout.lengths){
      const bounds=[...b];bounds[axis]=q(cursor);bounds[axis+3]=q(cursor+len);const key=`${index}:${wall.id}:${serial++}`;
      const piece={id:key,stock_key:key,wall_id:wall.id,run_id:runId,axis,bounds_mm:bounds.map(q),cut:len<length-.0001||b[5]-b[2]<height-.0001||b[cross+3]-b[cross]<Number(wall.bounds_mm[cross+2])-Number(wall.bounds_mm[cross])-.0001,junction_cut:r[3]-r[1]!==+wall.bounds_mm[3]-wall.bounds_mm[1]||r[2]-r[0]!==+wall.bounds_mm[2]-wall.bounds_mm[0]};
      pieces.push(piece);runPieces.push(key);cursor=q(cursor+len+joint);
     }
     runs.push({id:runId,wall_id:wall.id,axis,bounds_mm:b.map(q),piece_ids:runPieces,lengths_mm:layout.lengths,joint_count:Math.max(0,layout.lengths.length-1),closure_mm:layout.closure_mm,minimum_joint_shift_mm:layout.minimum_joint_shift_mm});
     for(const at of layout.joints)joints.push({wall_id:wall.id,axis,at_mm:at,cross0_mm:b[cross],cross1_mm:b[cross+3],bottom_mm:b[2],top_mm:b[5],run_id:runId});
     for(const violation of layout.bond_violations)bondViolations.push({...violation,wall_id:wall.id,run_id:runId,row:index});
    }
   }
   rows.push({index,z_mm:z,top_mm:top,height_mm:q(top-z),reinforced:index===1||index%4===0,pieces,runs,joints,bond_violations:bondViolations});previousJoints=joints;z=q(top+joint);index++;
  }
  const pieces=rows.flatMap(r=>r.pieces),netVolume=pieces.reduce((s,p)=>s+volume(p.bounds_mm),0),violations=rows.flatMap(r=>r.bond_violations),shifts=rows.flatMap(r=>r.runs).map(r=>r.minimum_joint_shift_mm).filter(v=>v!==null);
  return {status:'scenario_not_construction_layout',algorithm:'carve_first_balanced_ends_joint_shift_solver_v2',parameters:{length,height,joint,bed,base:-130,top:3020},rows,net_block_geometry_m3:netVolume,fragment_count:pieces.length,stock_positions:pieces.length,bond_audit:{scope:'Смещение центров внутренних вертикальных швов соседних рядов одного участка стены; пространственные углы/Т-узлы требуют отдельной проверки.',minimum_required_mm:bond,source_fact_id:model.course_rules?.minimum_joint_shift_source_fact_id||null,minimum_observed_mm:shifts.length?Math.min(...shifts):null,violations},small_fragment_audit:{threshold_mm:100,threshold_status:'interface_review_threshold_not_a_design_rule',count:pieces.filter(p=>Math.min(p.bounds_mm[p.axis+3]-p.bounds_mm[p.axis],p.bounds_mm[5]-p.bounds_mm[2])<100).length,min_length_mm:Math.min(...pieces.map(p=>p.bounds_mm[p.axis+3]-p.bounds_mm[p.axis])),min_height_mm:Math.min(...pieces.map(p=>p.bounds_mm[5]-p.bounds_mm[2]))},scope:model.course_scope,limitations:model.limitations};
 }
 function masonryReinforcement(model,scenario,envelopes,rules){
  const value=key=>Number(rules[key].value);
  const diameter=value('diameter'),size=value('groove'),half=size/2,radius=diameter/2;
  const spacing=value('interval'),extension=value('extension'),steelRate=value('mass');
  const walls=new Map(model.walls.filter(w=>w.material==='aac'&&
   (w.outside_sign||w.id.startsWith('bearing'))&&Math.abs(w.bounds_mm[3-w.axis]-w.bounds_mm[1-w.axis])===400)
   .map(w=>[w.id,w]));
  if(value('grooves')!==2||diameter>=size)throw Error('Проверьте сечение арматуры кладки.');
  const periodic=row=>row.index===value('first')||row.index%spacing===0;
  const shapes=window.HouseShapes;
  function clearStair(wall,axis,range,cross,top){
   if(wall!=='bearing3'&&wall!=='boiler')return [range];
   const strip=axis===0?rectangle(range[0],cross-half,range[1],cross+half):
    rectangle(cross-half,range[0],cross+half,range[1]);
   let spans=[range];
   for(const {foot,plane:[a,b,c]} of stairCuts(envelopes,wall)){
    const blocked=shapes.clip(intersectConvex(strip,foot),[-a,-b,top-c]);
    if(shapes.area(blocked)<1e-6)continue;
    const projected=blocked.map(p=>p[axis]),lo=Math.min(...projected),hi=Math.max(...projected);
    spans=spans.flatMap(([l,h])=>hi<=l||h<=lo?[[l,h]]:[[l,Math.min(h,lo)],[Math.max(l,hi),h]])
     .filter(([l,h])=>h-l>1e-6);
   }
   return spans;
  }
  // Merge adjacent rectangular pieces of the same channel at one head before
  // applying an end inset. Deliberately stop at changes of wall ownership.
  function lanes(row,wall,nominalOnly){
   const axis=wall.axis,crossAxis=1-axis,edge=Number(wall.bounds_mm[crossAxis]),out=[];
   for(const cross of [edge+100,edge+300]){
    const heights=new Map();
    for(const run of row.runs.filter(r=>r.wall_id===wall.id)){
     const b=run.bounds_mm,top=b[5];
     if(top-b[2]<size||b[crossAxis]>cross-half||b[crossAxis+3]<cross+half||
        nominalOnly&&top!==row.top_mm)continue;
     const spans=heights.get(top)||[];
     spans.push(...clearStair(wall.id,axis,[b[axis],b[axis+3]],cross,top));
     heights.set(top,spans);
    }
    for(const [top,spans] of heights){
     const merged=[];
     for(const [l,h] of spans.sort((a,b)=>a[0]-b[0])){
      const last=merged.at(-1);
      if(last&&l<=last[1]+1e-6)last[1]=Math.max(last[1],h);
      else merged.push([l,h]);
     }
     for(const [l,h] of merged)if(h-l>size)out.push({cross,top,lo:l+half,hi:h-half});
    }
   }
   return out;
  }
  const bars=[];
  function addBar(wall,row,lane,lo,hi,windowId=null){
   const {cross,top}=lane,axis=wall.axis,z=top-half;
   const point=(a,b,z)=>axis===0?[a,b,z]:[b,a,z];
   const bounds=[...point(lo,cross-half,top-size),...point(hi,cross+half,top)];
   const length=hi-lo;
   const removed=row.pieces.filter(p=>p.wall_id===wall.id).reduce((sum,p)=>{
    let part=1;
    for(let i=0;i<3;i++)part*=Math.max(0,Math.min(bounds[i+3],p.bounds_mm[i+3])-Math.max(bounds[i],p.bounds_mm[i]));
    return sum+part/1e9;
   },0);
   bars.push({id:'masonry-bar-'+(bars.length+1),wall_id:wall.id,row:row.index,window_id:windowId,
    a_mm:point(lo,cross,z),b_mm:point(hi,cross,z),groove_bounds_mm:bounds,
    length_m:length/1000,removed_aac_m3:removed});
  }
  const regularRows=scenario.rows.filter(periodic);
  for(const row of regularRows)for(const wall of walls.values())for(const lane of lanes(row,wall,false)){
   addBar(wall,row,lane,lane.lo,lane.hi);
  }
  const windows=[];
  for(const opening of model.openings.filter(o=>o.id.startsWith('w-')&&walls.get(o.wall_id)?.outside_sign)){
   const wall=walls.get(opening.wall_id),axis=wall.axis,b=nums(opening.bounds_mm);
   const lo=b[axis]-extension,hi=b[axis+3]+extension;
   const row=scenario.rows.findLast(r=>r.top_mm<=b[2]&&!periodic(r));
   const fit=row?lanes(row,wall,true).filter(lane=>lane.lo<=lo+1e-6&&lane.hi>=hi-1e-6):[];
   const status=opening.id==='w-balcony'?'door_window_unit':!row?'no_separate_course':fit.length!==2?'short_seat':'fits';
   const record={opening_id:opening.id,wall_id:wall.id,sill_mm:b[2],row:row?.index??null,
    course_top_mm:row?.top_mm??null,requested_limits_mm:[lo,hi],status,bar_ids:[]};
   if(status==='fits')for(const lane of fit){
    addBar(wall,row,lane,lo,hi,opening.id);
    record.bar_ids.push(bars.at(-1).id);
   }
   windows.push(record);
  }
  const totals={};const summarize=items=>{
   const length_m=items.reduce((sum,b)=>sum+b.length_m,0);
   const groove_m3=length_m*size*size/1e6;
   const removed_aac_m3=items.reduce((sum,b)=>sum+b.removed_aac_m3,0);
   return {segments:items.length,length_m,mass_kg:length_m*steelRate,groove_m3,removed_aac_m3,
    displaced_joint_m3:Math.max(0,groove_m3-removed_aac_m3),fill_m3:groove_m3-length_m*Math.PI*radius*radius/1e6};
  };
  for(const [key,match] of [['regular',b=>!b.window_id],['under_windows',b=>!!b.window_id],['total',()=>true]]){
   totals[key]=summarize(bars.filter(match));
  }
  return {status:'straight_groove_trial',accepted_for_construction:false,purchase_quantities:null,
   groove_mm:size,axis_from_side_mm:100,straight_end_inset_mm:half,regular_rows:regularRows.map(row=>row.index),
   bars,windows,...totals,by_wall:[...walls.keys()].map(wall_id=>({wall_id,...summarize(bars.filter(b=>b.wall_id===wall_id))}))};
 }
 return {subtract2,subtract3,ownerRegions,solids,masonryBelowCourses,courses,runLayout,volume,stairEnvelopes,stairCuts,stairPatches,installedVolume,prismVolume,masonryTakeoff,masonryReinforcement};
})();
window.FloorGeometry=FloorGeometry;

export { FloorGeometry };
