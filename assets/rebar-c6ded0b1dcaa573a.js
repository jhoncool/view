/* Source-bound reinforcement diagrams. Global placement phases are scenarios.
 * No stock lengths, lap locations or bending radii are invented as source facts.
 * All clipping and perimeter stations use the active straight-edged plate.
 */
'use strict';
const RebarLayout=(()=>{
 const EPS=1e-7;
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const segmentDistance=(p,a,b)=>{const u=b.map((v,i)=>v-a[i]),den=u.reduce((s,v)=>s+v*v,0),t=den?Math.max(0,Math.min(1,u.reduce((s,v,i)=>s+v*(p[i]-a[i]),0)/den)):0;return distance(p,a.map((v,i)=>v+t*u[i]));};
 class PlateDomain{
  constructor(f){
   this.polygon=f.slab.render_polygon_mm.map(p=>p.map(Number));
   this.lines=this.polygon.map((a,i)=>[a,this.polygon[(i+1)%this.polygon.length]]);
   this.min=[0,1].map(axis=>Math.min(...this.polygon.map(p=>p[axis])));
   this.max=[0,1].map(axis=>Math.max(...this.polygon.map(p=>p[axis])));
  }
  contains(p){return inside(p,this.polygon);}
  boundaryDistance(p){return Math.min(...this.lines.map(([a,b])=>segmentDistance(p,a,b)));}
  intervals(axis,fixed,inset){
   const cross=1-axis,events=[this.min[axis]-1,this.max[axis]+1],point=t=>axis===0?[t,fixed]:[fixed,t];
   const circleEvents=(c,r)=>{const delta=fixed-c[cross],disc=r*r-delta*delta;if(disc>=0){const d=Math.sqrt(disc);events.push(c[axis]-d,c[axis]+d);}};
   for(const [a,b]of this.lines){events.push(a[axis],b[axis]);if(a[axis]===b[axis])events.push(a[axis]-inset,a[axis]+inset);circleEvents(a,inset);circleEvents(b,inset);}
   const sorted=events.filter(Number.isFinite).sort((a,b)=>a-b),unique=sorted.filter((v,i)=>!i||v-sorted[i-1]>EPS),out=[];
   for(let i=1;i<unique.length;i++){const lo=unique[i-1],hi=unique[i],p=point((lo+hi)/2);if(hi-lo>EPS&&this.contains(p)&&this.boundaryDistance(p)>=inset-EPS){const last=out.at(-1);if(last&&Math.abs(last[1]-lo)<EPS)last[1]=hi;else out.push([lo,hi]);}}
   return out;
  }
  segmentFits(a,b,inset){
   const u=[b[0]-a[0],b[1]-a[1]],square=u[0]*u[0]+u[1]*u[1];
   const valid=t=>{const p=[a[0]+u[0]*t,a[1]+u[1]*t];return this.contains(p)&&this.boundaryDistance(p)>=inset-EPS;};
   if(!valid(0)||!valid(1))return false;if(square<EPS)return true;
   const events=[0,1],event=t=>{if(t>EPS&&t<1-EPS&&Number.isFinite(t))events.push(t);};
   const circle=(c,r)=>{const dx=a[0]-c[0],dy=a[1]-c[1],B=2*(dx*u[0]+dy*u[1]),C=dx*dx+dy*dy-r*r,disc=B*B-4*square*C;if(disc>=0){const q=Math.sqrt(disc);event((-B-q)/(2*square));event((-B+q)/(2*square));}};
   for(const [p,q]of this.lines){const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy),rate=(-dy*u[0]+dx*u[1])/len,origin=(-dy*(a[0]-p[0])+dx*(a[1]-p[1]))/len;if(Math.abs(rate)>EPS)for(const offset of [-inset,0,inset])event((offset-origin)/rate);circle(p,inset);circle(q,inset);}
   events.sort((a,b)=>a-b);
   for(let i=1;i<events.length;i++)if(events[i]-events[i-1]>EPS&&!valid((events[i]+events[i-1])/2))return false;
   return true;
  }
  boundaryAt(s){
   for(const [edge,[a,b]] of this.lines.entries()){
    const len=distance(a,b);
    if(s<=len+EPS){
     const t=Math.min(1,s/len),dx=b[0]-a[0],dy=b[1]-a[1];
     return {p:[a[0]+t*dx,a[1]+t*dy],inward:[-dy/len,dx/len],edge};
    }
    s-=len;
   }
   return this.boundaryAt(0);
  }
  get perimeter(){return this.lines.reduce((sum,[a,b])=>sum+distance(a,b),0);}

 }
 function edgeLinkStations(domain,isConcrete,step,phase,inset,reach){
  const stations=[];
  for(let i=0,s=phase;s<domain.perimeter-EPS;i++,s=phase+i*step){
   const at=domain.boundaryAt(s),p=at.p.map((v,i)=>v+at.inward[i]*inset);
   const innerP=p.map((v,i)=>v+at.inward[i]*reach);
   stations.push({s,at,p,innerP,free:!isConcrete(p),fits:domain.segmentFits(p,innerP,inset)});
  }
  return stations;
 }
 function edgeLinkPhaseAudit(foundation,facts,options){
  const domain=new PlateDomain(foundation),rects=foundation.plinth.disjoint_rectangles_mm.map(r=>r.map(Number));
  const isConcrete=p=>rects.some(r=>p[0]>=r[0]-EPS&&p[0]<=r[2]+EPS&&p[1]>=r[1]-EPS&&p[1]<=r[3]+EPS);
  const value=property=>Number(facts.find(f=>f.id==='foundation.Фм1.'+property).value);
  const step=value('edge_link_spacing'),reach=value('rebar.7.sketch_long');
  return Array.from({length:step},(_,phase)=>{
   const stations=edgeLinkStations(domain,isConcrete,step,phase,options.axis_inset_mm,reach);
   const accepted=stations.filter(s=>s.fits);
   return {phase_mm:phase,nominal:stations.length,full_edge:accepted.length,free_edge:accepted.filter(s=>s.free).length};
  });
 }
 function* beamStations(run,phase,step,side,leg,isConcrete,inner,domain,inset){
  const [dx,dy]=run.b.map((v,i)=>Math.sign(v-run.a[i]));
  const normal=[-dy,dx],axis=dx===0?1:0;
  const lo=Math.min(run.a[axis],run.b[axis]),hi=Math.max(run.a[axis],run.b[axis]);
  for(let index=Math.ceil((lo-phase)/step);phase+index*step<hi-EPS;index++){
   const coordinate=phase+index*step;
   if(coordinate<=lo+EPS)continue;
   const p=[...run.a];p[axis]=coordinate;
   if(!isConcrete(p)||(run.kind==='internal'&&!inside(p,inner)))continue;
   const legs=[-1,1].map(sign=>{
    const stem=p.map((v,i)=>v+sign*normal[i]*(run.width/2-side));
    const direction=run.kind==='external'?normal:normal.map(v=>v*sign);
    const foot=stem.map((v,i)=>v+direction[i]*leg);
    return {stem,foot,sign,fits:isConcrete(stem)&&domain.segmentFits(foot,stem,inset)};
   });
   yield {index,coordinate,p,legs};
  }
 }
 function beamLPhaseAudit(foundation,facts,diagram,trialPhase){
  const domain=new PlateDomain(foundation);
  const inner=foundation.plinth.inner_polygon_mm.map(p=>p.map(Number));
  const concrete=foundation.plinth.disjoint_rectangles_mm.map(r=>r.map(Number));
  const isConcrete=p=>concrete.some(r=>p[0]>=r[0]-EPS&&p[0]<=r[2]+EPS&&p[1]>=r[1]-EPS&&p[1]<=r[3]+EPS);
  const value=property=>Number(facts.find(f=>f.id==='foundation.Фм1.'+property).value);
  const step=value('beam_vertical_spacing'),side=value('beam_side_bar_offset'),leg=value('rebar.4.sketch_short');
  const z=diagram.z_convention.bottom_mm,rise=value('rebar.4.sketch_long'),diameter=value('rebar.4.diameter');
  const inset=Math.min(side,diagram.parameters.axis_inset_mm),trial=[];
  const rows=Array.from({length:step},(_,phase)=>{
   const row={phase_mm:phase,external:0,internal:0};
   for(const run of diagram.beam_runs){
    for(const {legs} of beamStations(run,phase,step,side,leg,isConcrete,inner,domain,inset)){
     for(const {stem,foot,sign,fits} of legs){
      if(!fits)continue;
      row[run.kind]++;
      if(phase===trialPhase)trial.push({id:'trial-p4-'+String(trial.length+1).padStart(4,'0'),position:4,
       run_id:run.id,run_kind:run.kind,side:sign,diameter_mm:diameter,
       points_mm:[[...foot,z],[...stem,z],[...stem,z+rise]]});
     }
    }
   }
   return row;
  });
  const pinSteps={external:value('external_pin_spacing'),internal:value('internal_pin_spacing')};
  const pinRows=Array.from({length:Math.max(...Object.values(pinSteps))},(_,phase)=>{
   const row={phase_mm:phase,external:0,internal:0};
   for(const run of diagram.beam_runs){
    const pitch=pinSteps[run.kind];
    for(const {legs} of beamStations(run,phase%pitch,pitch,side,leg,isConcrete,inner,domain,inset)){
     if(legs.every(l=>l.fits))row[run.kind]+=2;
    }
   }
   return row;
  });
  return {rows,trial_phase_mm:trialPhase,trial,pin_rows:pinRows};
 }
 function build(foundation,facts,parameters={}){
  const F=new Map((facts instanceof Map?[...facts.values()]:facts).map(f=>[f.id,f])),v=id=>Number(F.get(id).value),id=p=>'foundation.Фм1.'+p;
  const options={phase_x_mm:0,phase_y_mm:0,axis_inset_mm:50,chair_phase_x_mm:400,chair_phase_y_mm:400,chair_base_lift_mm:10,beam_station_phase_mm:100,beam_end_inset_mm:60,edge_station_phase_mm:100,edge_scope:'entire_perimeter_hypothesis',...parameters};
  for(const key of ['phase_x_mm','phase_y_mm','axis_inset_mm','chair_phase_x_mm','chair_phase_y_mm','chair_base_lift_mm','beam_station_phase_mm','beam_end_inset_mm','edge_station_phase_mm'])if(!Number.isFinite(options[key])||options[key]<0||options[key]>1000)throw Error('Некорректный параметр арматурной схемы: '+key);
  if(!['entire_perimeter_hypothesis','free_edge_hypothesis'].includes(options.edge_scope))throw Error('Неизвестный вариант позиции7');
  const domain=new PlateDomain(foundation),rods=[],omissions=[],families=[],counters=Array(9).fill(0),step=v(id('lower_mesh_spacing')),zBottom=v(id('bottom_elevation'))*1000+v(id('rebar_cover')),zTop=v(id('top_elevation'))*1000-v(id('rebar_cover'));
  const concrete=foundation.plinth.disjoint_rectangles_mm.map(r=>r.map(Number)),isConcrete=p=>concrete.some(r=>p[0]>=r[0]-EPS&&p[0]<=r[2]+EPS&&p[1]>=r[1]-EPS&&p[1]<=r[3]+EPS);
  const length=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
  const add=(pos,points,props={})=>{
   if(points.length<2||points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('Invalid rod coordinates');
   const pre=id('rebar.'+pos),refs=[pre+'.diameter',pre+'.grade',pre+'.quantity',...(F.has(pre+'.length')?[pre+'.length']:[])];
   rods.push({id:'p'+pos+'-'+String(++counters[pos]).padStart(4,'0'),position:pos,geometry_rule_id:({1:'mesh_grid',2:'mesh_grid',3:'chair_stagger',4:'beam_L',5:'pin_span',6:'beam_longitudinal',7:'edge_U',8:'pin_span'})[pos],points_mm:points,visible_axis_length_mm:length(points),diameter_mm:v(pre+'.diameter'),source_blank_length_mm:F.get(pre+'.length')?.value??null,source_issue_ids:[F.get(pre+'.grade').issue_id].filter(Boolean),status:'derived_layout_scenario',...props,input_fact_ids:[...new Set([...refs,...(props.input_fact_ids||[])])]});
  };
  const meshRefs=[id('rebar_cover'),id('bottom_elevation'),id('top_elevation')];
  for(const pos of [1,2])for(const axis of [0,1]){
   const cross=1-axis,phase=cross===0?options.phase_x_mm:options.phase_y_mm,z=pos===1?zBottom:zTop,spacing=pos===1?step:v(id('upper_mesh_field_spacing'));
   for(let index=Math.ceil((domain.min[cross]-phase)/spacing);phase+index*spacing<=domain.max[cross]+EPS;index++){
    const fixed=phase+index*spacing;
    for(const [lo,hi]of domain.intervals(axis,fixed,options.axis_inset_mm)){const p=t=>axis===0?[t,fixed,z]:[fixed,t,z];add(pos,[p(lo),p(hi)],{axis:axis===0?'X':'Y',grid_index:index,fixed_mm:fixed,length_status:'continuous_axis_without_stock_laps_or_bend_allowances',input_fact_ids:[...meshRefs,id(pos===1?'lower_mesh_spacing':'upper_mesh_field_spacing'),id('rebar.'+pos+'.diameter'),id('rebar.'+pos+'.quantity')],parameter_ids:['phase_x_mm','phase_y_mm','axis_inset_mm'],geometry_input_ids:['foundation.slab.render_polygon_mm']});}
   }
  }
  // Source 800 mm stagger: alternating rows shift by half the source pitch.
  const chairStep=v(id('chair_spacing')),chairTop=v(id('rebar.3.sketch_top')),chairHeight=v(id('rebar.3.sketch_height')),chairFoot=v(id('rebar.3.sketch_foot')),chairZ=zBottom+options.chair_base_lift_mm;
  for(let row=Math.ceil((domain.min[1]-options.chair_phase_y_mm)/chairStep);options.chair_phase_y_mm+row*chairStep<=domain.max[1]+EPS;row++){
   const y=options.chair_phase_y_mm+row*chairStep,xPhase=options.chair_phase_x_mm+((row%2+2)%2)*chairStep/2;
   for(let col=Math.ceil((domain.min[0]-xPhase)/chairStep);xPhase+col*chairStep<=domain.max[0]+EPS;col++){
    const x=xPhase+col*chairStep;if(!domain.contains([x,y]))continue;
    const points=[[x-chairTop/2,y-chairFoot,chairZ],[x-chairTop/2,y,chairZ],[x-chairTop/2,y,chairZ+chairHeight],[x+chairTop/2,y,chairZ+chairHeight],[x+chairTop/2,y,chairZ],[x+chairTop/2,y+chairFoot,chairZ]];
    if(points.slice(1).some((p,i)=>!domain.segmentFits(points[i],p,options.axis_inset_mm))){omissions.push({position:3,at_mm:[x,y],reason:'chair_footprint_does_not_fit_scenario_inset'});continue;}
    add(3,points,{grid_row:row,grid_column:col,stagger_shift_mm:((row%2+2)%2)*chairStep/2,grid_origin_x_mm:xPhase,axis:'chair_profile',length_status:'sharp_profile_950_not_a_bending_schedule',input_fact_ids:[...meshRefs,id('chair_spacing'),id('rebar.3.sketch_top'),id('rebar.3.sketch_height'),id('rebar.3.sketch_foot'),id('rebar.3.length')],parameter_ids:['chair_phase_x_mm','chair_phase_y_mm','chair_base_lift_mm','axis_inset_mm'],vertical_placement_status:'schematic_support_contacts_not_resolved'});
   }
  }
  // Dimensioned band centre lines. Internal parts within the outer ring are
  // assigned to that ring once, rather than counted again as internal runs.
  const outer=foundation.plinth.outer_polygon_mm.map(p=>p.map(Number)),inner=foundation.plinth.inner_polygon_mm.map(p=>p.map(Number)),mid=outer.map((p,i)=>p.map((v,j)=>(v+inner[i][j])/2)),runs=[];
  const bandRefs=[...new Set(foundation.points.filter(p=>p.id.startsWith('plinth_')).flatMap(p=>p.input_fact_ids))];
  for(let i=0;i<mid.length;i++)runs.push({id:'outer-'+i,a:mid[i],b:mid[(i+1)%mid.length],width:v(id('external_beam_width')),kind:'external',input_fact_ids:[...bandRefs,id('external_beam_width')]});
  for(const extra of foundation.plinth.additions.filter(r=>r.id.startsWith('internal_'))){const [a,b,c,d]=extra.bounds_mm.map(Number),vertical=d-b>c-a;runs.push({id:extra.id,a:vertical?[(a+c)/2,b]:[a,(b+d)/2],b:vertical?[(a+c)/2,d]:[c,(b+d)/2],width:v(id('internal_beam_width')),kind:'internal',input_fact_ids:extra.input_fact_ids});}
  const clipToConcrete=(a,b,inset=0)=>{
   const axis=Math.abs(a[0]-b[0])>EPS?0:1,cross=1-axis,value=a[cross],lo=Math.min(a[axis],b[axis]),hi=Math.max(a[axis],b[axis]),ranges=[];
   for(const r of concrete)if(value>=r[cross]-EPS&&value<=r[cross+2]+EPS){const start=Math.max(lo,r[axis]),end=Math.min(hi,r[axis+2]);if(end-start>EPS)ranges.push([start,end]);}
   ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const p of ranges){const last=merged.at(-1);if(last&&p[0]<=last[1]+EPS)last[1]=Math.max(last[1],p[1]);else merged.push([...p]);}
   return merged.map(([start,end])=>[start+(start>lo+EPS?inset:0),end-(end<hi-EPS?inset:0)]).filter(([a,b])=>b-a>EPS);
  };
  const topZ=v(id('beam_top_elevation'))*1000-v(id('beam_top_bar_offset')),bottomZ=topZ-v(id('beam_longitudinal_vertical_distance')),side=v(id('beam_side_bar_offset')),leg=v(id('rebar.4.sketch_short')),long=v(id('rebar.4.sketch_long'));
  const beamStep=v(id('beam_vertical_spacing'));
  for(const run of runs){
   const vector=run.b.map((v,i)=>v-run.a[i]),len=Math.hypot(...vector),t=vector.map(v=>v/len),normal=[-t[1],t[0]],axis=Math.abs(t[0])>.5?0:1;
   for(const {index,coordinate,p,legs} of beamStations(run,options.beam_station_phase_mm,beamStep,side,leg,isConcrete,inner,domain,Math.min(side,options.axis_inset_mm))){
    const pair=[];
    for(const {sign,stem,foot,fits} of legs){
     if(!fits){omissions.push({position:4,run_id:run.id,at_mm:stem,reason:'L_profile_needs_corner_or_end_detail'});continue;}
     pair.push({stem,foot,sign});add(4,[[...foot,zBottom],[...stem,zBottom],[...stem,zBottom+long]],{run_id:run.id,run_kind:run.kind,station_index:index,side:sign,foot_direction:run.kind==='external'?'towards_plate_field':'away_from_band_axis',length_status:'sharp_L_profile_not_bend_allowance',input_fact_ids:[...meshRefs,...run.input_fact_ids,id('beam_vertical_spacing'),id('beam_side_bar_offset'),id('rebar.4.sketch_short'),id('rebar.4.sketch_long'),id('rebar.4.length'),id('rebar.4.foot_direction_'+run.kind)],parameter_ids:['beam_station_phase_mm','axis_inset_mm'],vertical_placement_status:'schematic_net_contact_not_resolved'});
    }
    // Pins in two tiers. The dimension locates the transverse gauge;
    // the measured blank also includes the two end returns.
    const pinStep=v(id(run.kind+'_pin_spacing')),phase=options.beam_station_phase_mm;
    if(Math.abs((coordinate-phase)/pinStep-Math.round((coordinate-phase)/pinStep))<EPS&&pair.length===2){
     const pos=run.kind==='external'?5:8,span=v(id('rebar.'+pos+'.sketch_span'));
     for(const z of [topZ,bottomZ])add(pos,[-1,1].map(sign=>[p[0]+sign*normal[0]*span/2,p[1]+sign*normal[1]*span/2,z]),{run_id:run.id,run_kind:run.kind,station_index:index,height_level:z===topZ?'upper':'lower',length_status:'visible_span_only_hooks_not_modelled',input_fact_ids:[id('beam_top_elevation'),id('beam_top_bar_offset'),id('beam_longitudinal_vertical_distance'),...run.input_fact_ids,id(run.kind+'_pin_spacing'),id('rebar.'+pos+'.sketch_span'),id('rebar.'+pos+'.length')],parameter_ids:['beam_station_phase_mm']});
    }
   }
   for(const sign of [-1,1])for(const z of [topZ,bottomZ]){
    const a=run.a.map((v,i)=>v+sign*normal[i]*(run.width/2-side)),b=run.b.map((v,i)=>v+sign*normal[i]*(run.width/2-side));
    for(const [start,end]of clipToConcrete(a,b,options.beam_end_inset_mm)){
     const p=q=>{const r=[...a];r[axis]=q;return r;},pieces=[[start,end]];
     // Internal longitudinal traces within the external ring are omitted.
     if(run.kind==='internal'){
      const events=[start,end,...inner.map(q=>q[axis]).filter(q=>q>start&&q<end)].sort((a,b)=>a-b);pieces.length=0;
      for(let j=1;j<events.length;j++)if(inside(p((events[j-1]+events[j])/2),inner))pieces.push([events[j-1],events[j]]);
     }
     for(const [c,d]of pieces)if(d-c>EPS)add(6,[[...p(c),z],[...p(d),z]],{run_id:run.id,run_kind:run.kind,side:sign,height_level:z===topZ?'upper':'lower',length_status:'longitudinal_trace_no_laps_anchors_or_corner_bending',input_fact_ids:[...run.input_fact_ids,id('beam_longitudinal_count'),id('beam_side_bar_offset'),id('beam_top_bar_offset'),id('beam_longitudinal_vertical_distance'),id('beam_top_elevation')],parameter_ids:['beam_end_inset_mm']});
    }
   }
  }
  // Hypothesis for position7 is explicit and switchable. Every U remains
  // within the plate; corner cases are reported instead of silently bent.
  const edgeStep=v(id('edge_link_spacing')),uLong=v(id('rebar.7.sketch_long')),uHeight=v(id('rebar.7.sketch_height'));
  for(const {s,at,p,innerP,free,fits} of edgeLinkStations(domain,isConcrete,edgeStep,options.edge_station_phase_mm,options.axis_inset_mm,uLong)){
   if(options.edge_scope==='free_edge_hypothesis'&&!free)continue;
   if(!fits){omissions.push({position:7,at_mm:p,reason:'U_profile_at_corner_needs_working_detail'});continue;}
   add(7,[[...innerP,zBottom],[...p,zBottom],[...p,zBottom+uHeight],[...innerP,zBottom+uHeight]],{station_mm:s,boundary_edge:at.edge,inward_normal:at.inward,scope_hypothesis:options.edge_scope,length_status:'sharp_U_profile_not_bend_allowance',input_fact_ids:[...meshRefs,id('edge_link_spacing'),id('rebar.7.sketch_long'),id('rebar.7.sketch_height'),id('rebar.7.length')],parameter_ids:['edge_station_phase_mm','edge_scope','axis_inset_mm']});
  }
  for(let position=1;position<=8;position++){const members=rods.filter(r=>r.position===position),pre=id('rebar.'+position);families.push({position,count:members.length,visible_axis_length_m:members.reduce((s,r)=>s+r.visible_axis_length_mm/1000,0),source_quantity:v(pre+'.quantity'),source_quantity_unit:F.get(pre+'.quantity').unit,source_blank_length_mm:F.get(pre+'.length')?.value??null,source_mass_kg_per_unit:v(pre+'.unit_mass'),source_grade:F.get(pre+'.grade').value,source_issue_ids:[F.get(pre+'.grade').issue_id].filter(Boolean),input_fact_ids:[pre+'.quantity',pre+'.grade',pre+'.diameter',pre+'.unit_mass',...(F.has(pre+'.length')?[pre+'.length']:[])],comparison_status:[5,8].includes(position)?'count_only_hooks_not_modelled':'scenario_only_no_procurement_override'});}
  const coordinate_rules={
   mesh_grid:{formula:'fixed = phase[cross] + grid_index * step; Zbottom = 1000 * bottom_elevation + rebar_cover; Ztop = 1000 * top_elevation - rebar_cover. Variable endpoints delimit inside(plate) AND distance(analytic_boundary) >= axis_inset. Offset segments and endpoint circles are solved in binary64.',input_geometry_ids:['foundation.slab.render_polygon_mm'],status:'derived_scenario_axis_convention_not_physical_cover'},
   chair_stagger:{formula:'Y = chair_phase_y + row * 800; X = chair_phase_x + parity(row) * 400 + column * 800. Zfoot = Zbottom + chair_base_lift. Profile vertices use top130 / height160 / foot250; centre-line sum = 2*250 + 2*160 + 130 = 950.',input_geometry_ids:['foundation.slab.render_polygon_mm'],status:'source_profile_conditional_phase_and_vertical_contacts'},
   beam_L:{formula:'C lies on the band centre line; N is its left unit normal; stem = C + side*N*(width/2 - 60). External foot = stem + N*200; internal foot = stem + side*N*200. Zstem_base = Zbottom; Zhead = Zbottom + 590. Centre-line sum590+200=790; bend radius is not assigned.',input_geometry_ids:['foundation.plinth.outer_polygon_mm','foundation.plinth.inner_polygon_mm','foundation.plinth.additions','foundation.plinth.disjoint_rectangles_mm'],status:'source_section_direction_interpretation_conditional_stations'},
   pin_span:{formula:'Gauge endpoints = C +/- N*span/2, span530 externally or330 internally. Reference Z levels match the longitudinal bar centres. Stations repeat400. This is the transverse sketch dimension between the extreme points of the bends; blanks680/480 include the returns.',input_geometry_ids:['foundation.plinth.disjoint_rectangles_mm'],status:'partial_visible_profile_hooks_unknown'},
   beam_longitudinal:{formula:'Trace = band centre line + side*N*(width/2 - 60), at the two source Z levels. Intersect with concrete interval union and trim gap endings by beam_end_inset. Internal portions already in the outer ring are omitted. Stock lengths, laps, anchors and corner radii are not assigned.',input_geometry_ids:['foundation.plinth.outer_polygon_mm','foundation.plinth.inner_polygon_mm','foundation.plinth.additions','foundation.plinth.disjoint_rectangles_mm'],status:'continuous_trace_not_stock_bar_cutting'},
   edge_U:{formula:'s = edge_station_phase + index*200 on the analytic plate boundary; P = boundary(s) + inward(s)*axis_inset; Q = P + inward(s)*400. U vertices = Q/Zbottom, P/Zbottom, P/(Zbottom+220), Q/(Zbottom+220). Scope is a hypothesis. Sum400+220+400=1020; no bending allowance.',input_geometry_ids:['foundation.slab.render_polygon_mm','foundation.plinth.disjoint_rectangles_mm'],status:'conditional_edge_scope_and_stations'}
  };
  return {status:'global_reinforcement_diagram_with_unresolved_routing',accepted_for_construction:false,cut_list_available:false,parameters:options,coordinate_rules,parameter_status:'phases_and_axis_offsets_are_scenario_choices_not_printed_bindings',z_convention:{bottom_mm:zBottom,top_mm:zTop,chair_foot_mm:chairZ,note:'Схема осевых линий.50 мм применены к линии; два направления одной сетки не разнесены на физические диаметры. Контакты с фиксаторами не назначены рабочими узлами.'},families,rods,omissions,beam_runs:runs,analytic_plate_perimeter_mm:domain.perimeter,issue_ids:['I002','I012','I013','I015','I017','I018'],limitations:['Общий шаг поля 200 подтверждён. Область и направление локального верхнего шага 150 требуют решения I015; этот сценарий не распространяет 150 на всю сетку.','Фазы сеток, фиксаторов и поперечных деталей — параметры сценария, не подписанные привязки.','Линии сеток не разнесены по диаметрам; высоты и контакты здесь схемные. Защитный слой 50 хранится отдельно как подпись проекта.','Продольные трассы показаны без раскроя на мерные стержни, реальных мест нахлёстов, анкеров и радиусов углов.','В базовой схеме поз. 5 и 8 показаны линиями поперечного габарита 530 и 330 мм.','Позиция 7 по всему периметру — явно выбранная гипотеза. Можно переключить на свободный край; ни один вариант не принят для строительства.','Пропущенные у углов/окончаний детали перечислены отдельно. Количества сцены не заменяют ведомость КЖ-4.']};
 }
 return {build,edgeLinkPhaseAudit,beamLPhaseAudit,PlateDomain,segmentDistance};
})();
if(typeof module!=='undefined')module.exports=RebarLayout;

export { RebarLayout };
