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
 function solids(model){const cuts=[...model.openings,...model.lintel_envelopes].map(o=>nums(o.bounds_mm)),out=[];for(const {wall,rect:r} of ownerRegions(model)){let boxes=[[r[0],r[1],+wall.base_mm,r[2],r[3],+wall.top_mm]];for(const cut of cuts)boxes=boxes.flatMap(r=>subtract3(r,cut));for(const bounds of boxes)out.push({wall_id:wall.id,material:wall.material,bounds});}return out;}
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
  const rows=[],voids=[...model.openings,...model.lintel_envelopes].map(o=>nums(o.bounds_mm)),regions={1:ownerRegions(model,1),0:ownerRegions(model,2)};
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
 return {subtract2,subtract3,ownerRegions,solids,courses,runLayout,volume};
})();
window.FloorGeometry=FloorGeometry;

export { FloorGeometry };
