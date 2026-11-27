export function createRoofContactAudit({ MODEL, n, activeSlab, HouseShapes, cutRoofCell, clipDisplaySolid, roofBeltInsulationPrisms, ventBodyBounds, wallDisplayPieces, frameAxes, frameDisplaySolids, framePieces, rafterRidgePurlin, roofFrameMember, roofFrameMembers, roofCornerSupport, clipContactFace, contactCross, contactDot, contactSub, measureRoofContact, roofCommonFaces, roofConnectedBodies, roofContactArea, roofContactPrism, roofContactRect, roofContactReports, roofContactSolid, roofContactTolerance, roofConvexVolume }) {
function roofFacePlanMoment(polygon){
 const moment=[0,0];let area=0;
 const [origin]=polygon;
 for(let i=1;i+1<polygon.length;i++){
  const a=polygon[i],b=polygon[i+1];
  const weight=Math.abs((a[0]-origin[0])*(b[1]-origin[1])-(a[1]-origin[1])*(b[0]-origin[0]))/2;
  area+=weight;
  for(let k=0;k<2;k++)moment[k]+=weight*(origin[k]+a[k]+b[k])/3;
 }
 return {area,moment};
}

function roofTimberSlice(solids,axis,lo,hi){
 let volume=0,moment=0;
 for(const {bounds,faces} of solids){
  if(bounds[axis]>=hi||bounds[axis+3]<=lo)continue;
  let shell=faces;
  if(bounds[axis]<lo)shell=clipDisplaySolid(shell,axis===0?[1,0,0,-lo]:[0,1,0,-lo]);
  if(bounds[axis+3]>hi)shell=clipDisplaySolid(shell,axis===0?[-1,0,0,hi]:[0,-1,0,hi]);
  const corners=shell.flat();
  if(!corners.length)continue;
  const origin=[0,1,2].map(i=>corners.reduce((sum,point)=>sum+point[i],0)/corners.length);
  for(const [first,...edge] of shell)for(let i=0;i+1<edge.length;i++){
   const weight=Math.abs(contactDot(contactSub(first,origin),
    contactCross(contactSub(edge[i],origin),contactSub(edge[i+1],origin))))/6;
   volume+=weight;
   moment+=weight*(origin[axis]+first[axis]+edge[i][axis]+edge[i+1][axis])/4;
  }
 }
 return {volume_mm3:volume,first_moment_mm4:moment};
}

function roofPostBearings(pairs,members,solids){
 const supports=new Set(['purlins','mauerlat','diagonals','beds']);
 const pieces=new Map();
 for(const solid of solids){
  if(!pieces.has(solid.id))pieces.set(solid.id,[]);
  pieces.get(solid.id).push(solid);
 }
 return members.filter(m=>m.family==='posts').map(post=>{
  const id=post.id+'-piece1';
  const shimId=post.bearing_fit?.shim_id;
  const neighbours=pairs.filter(p=>!p.volume_mm3&&p.ids.includes(id)&&
   (p.family.some(f=>supports.has(f))||shimId&&p.ids.includes(shimId+'-piece1')))
   .map(p=>p.ids.find(other=>other!==id));
  const surfaces={upper:[],lower:[]};
  for(const neighbour of neighbours)for(const a of pieces.get(id))for(const b of pieces.get(neighbour)){
   for(const {normal,polygon,area} of roofCommonFaces(a,b)){
    if(Math.abs(normal[2])<1e-6)continue;
    const {area:planArea,moment}=roofFacePlanMoment(polygon);
    if(planArea>roofContactTolerance**2)surfaces[normal[2]<0?'upper':'lower'].push({part_id:neighbour,area,planArea,moment});
   }
  }
  const section=post.width_mm*post.height_mm;
  const report=contacts=>{
   const area=contacts.reduce((sum,s)=>sum+s.planArea,0);
   const centre=area?[0,1].map(k=>contacts.reduce((sum,s)=>sum+s.moment[k],0)/area):null;
   return {part_ids:[...new Set(contacts.map(s=>s.part_id))],area_mm2:contacts.reduce((sum,s)=>sum+s.area,0),
    projected_area_mm2:area,section_fraction:area/section,centre_xy_mm:centre,
    centre_offset_xy_mm:centre?.map((value,k)=>value-post.a_mm[k])??null};
  };
  return {post_id:post.id,section_mm2:section,upper:report(surfaces.upper),lower:report(surfaces.lower)};
 });
}

function roofNwDiagonalLoadPath(members,solids,contacts,seats,postBearings,stock,westBattenLoads){
 const diagonalId='diagonal-1',partId=diagonalId+'-piece1',ridgeId='purlin-7-piece1';
 const diagonal=members.find(m=>m.id===diagonalId);
 const byPart=new Map();
 for(const solid of solids){
  if(!byPart.has(solid.id))byPart.set(solid.id,[]);
  byPart.get(solid.id).push(solid);
 }
 const bodies=byPart.get(partId);
 const measure=id=>{
  let area=0,vertical=0,upward=0;
  const moment=[0,0];
  for(const a of bodies)for(const b of byPart.get(id)??[]){
   for(const {normal,polygon} of roofCommonFaces(a,b)){
    const [origin,...edge]=polygon;
    for(let i=0;i+1<edge.length;i++){
     const p=edge[i],q=edge[i+1];
     const w=roofContactArea([origin,p,q],normal);
     area+=w;
     vertical+=Math.abs(normal[2])*w;
     upward+=Math.max(0,normal[2])*w;
     for(let axis=0;axis<2;axis++)moment[axis]+=w*(origin[axis]+p[axis]+q[axis])/3;
    }
   }
  }
  return {part_id:id,face_area_mm2:area,horizontal_projected_area_mm2:vertical,upward_projected_area_mm2:upward,
   face_centre_xy_mm:area?moment.map(v=>v/area):null};
 };
 const contactsHere=contacts.filter(p=>!p.volume_mm3&&p.ids.includes(partId)).map(p=>{
  const index=p.ids[0]===partId?1:0;
  return {...measure(p.ids[index]),family:p.family[index]};
 });
 const atRidge=contactsHere.find(p=>p.part_id===ridgeId)??measure(ridgeId);
 const atMauerlat=seats.find(s=>s.beam_id===partId&&s.support_id==='mauerlat-10-piece1');
 const post=postBearings.find(p=>p.post_id==='support18-w');
 if(!atMauerlat||!post?.upper.centre_xy_mm)return null;
 const [along]=frameAxes(framePieces(diagonal)[0]);
 const planLength=Math.hypot(along[0],along[1]);
 const station=point=>point.slice(0,2).reduce((sum,v,i)=>sum+(v-diagonal.a_mm[i])*along[i]/planLength,0);
 const [a,b]=[atMauerlat.centre_xy_mm,post.upper.centre_xy_mm].map(station);
 const legs=contactsHere.filter(p=>p.family==='rafters').sort((a,b)=>station(a.face_centre_xy_mm)-station(b.face_centre_xy_mm));
 const facets=diagonal.hip_facets.map(id=>({
  id,cover:MODEL.roof_geometry.cells.filter(c=>c.facet_id===id).flatMap(cell=>cutRoofCell(cell)),
  rows:[...new Set(members.filter(r=>r.family==='rafters'&&r.facet_id===id).map(r=>r.grid_coordinate_mm))].sort((a,b)=>a-b),
 }));
 const rafterData=legs.map(leg=>{
  const id=leg.part_id.replace(/-piece1$/,'');
  const member=members.find(m=>m.id===id);
  const foot=seats.find(s=>s.beam_id===leg.part_id&&s.support_id.startsWith('mauerlat-'));
  const components=stock.rows.find(row=>row.member_id===id)?.pieces.length;
  const item={...leg,member_id:id,station_mm:station(leg.face_centre_xy_mm)};
  if(components!==1)return {...item,status:'interrupted_or_unverified_stock'};
  if(!foot)return {...item,status:'other_gravity_seat_missing'};
  const grid=member.grid_coordinate_mm,axis=member.grid_axis,cross=1-axis;
  const footStation=foot.centre_xy_mm[axis],headStation=leg.face_centre_xy_mm[axis];
  const span=headStation-footStation;
  if(Math.abs(span)<roofContactTolerance)return {...item,status:'bearing_centres_coincide'};
  const common={...item,foot_xy_mm:foot.centre_xy_mm,support_span_plan_mm:Math.abs(span)};
  const battenLoads=westBattenLoads?.[id];
  if(battenLoads?.length){
   const area=battenLoads.reduce((sum,p)=>sum+p.area_m2,0);
   const lever=battenLoads.reduce((sum,p)=>sum+p.area_m2*(p.x_mm-footStation),0);
   return {...common,status:'unit_pressure_through_west_battens_with_assumed_head_connector',
    roof_strip_m2:area,diagonal_force_kn:lever/span};
  }
  const {cover,rows}=facets.find(f=>f.id===member.facet_id);
  const i=rows.indexOf(grid);
  const before=rows[i-1]??(2*grid-rows[i+1]),after=rows[i+1]??(2*grid-rows[i-1]);
  const strip=[(before+grid)/2,(grid+after)/2];
  const spans=byPart.get(leg.part_id);
  const extent=[Math.min(...spans.map(s=>s.bounds[axis])),Math.max(...spans.map(s=>s.bounds[axis+3]))];
  const limit=[];
  limit[axis]=extent;
  limit[cross]=strip;
  const [x,y]=limit;
  const planes=[[1,0,-x[0]],[-1,0,x[1]],[0,1,-y[0]],[0,-1,y[1]]];
  const measure=cover.map(poly=>roofFacePlanMoment(planes.reduce((p,plane)=>HouseShapes.clip(p,plane),poly)));
  const area=measure.reduce((sum,p)=>sum+p.area,0);
  const lever=measure.reduce((sum,p)=>sum+p.moment[axis]-p.area*footStation,0);
  return {...common,status:'unit_pressure_on_plan_strip_with_assumed_head_connector',
   strip_range_mm:strip,along_extent_mm:extent,roof_strip_m2:area/1e6,
   diagonal_force_kn:lever/span/1e6};
 });
 const transfers=rafterData.filter(p=>p.diagonal_force_kn!==undefined);
 const unitForces=transfers.map(p=>({x:p.station_mm,force:p.diagonal_force_kn}));
 const summarize=forces=>{
  const response=roofTwoSeatResponse(forces,a,b);
  return {total_kn:response.total,mauerlat_kn:response.west,post_kn:response.east};
 };
 const sx=roofTimberSlice(bodies,0,-Infinity,Infinity),sy=roofTimberSlice(bodies,1,-Infinity,Infinity);
 const centre=[sx.first_moment_mm4/sx.volume_mm3,sy.first_moment_mm4/sy.volume_mm3];
 const gravity=MODEL.roof_frame.gravity_reference;
 const weight=sx.volume_mm3*gravity.softwood_density_kg_m3*gravity.gravity_m_s2/1e12;
 return {status:'geometry_and_partial_two_support_load_screen',member_id:diagonalId,
  supports:[{id:atMauerlat.support_id,station_mm:a,projected_area_mm2:atMauerlat.area_mm2},
   {id:post.post_id,station_mm:b,projected_area_mm2:post.upper.projected_area_mm2}],
  ridge:atRidge,other_compression_contacts:contactsHere.filter(p=>p.family==='wall'&&p.upward_projected_area_mm2>.01),
  rafters:rafterData,unit_pressure_kn_m2:1,unit_pressure_response:summarize(unitForces),
  timber:{volume_mm3:sx.volume_mm3,centre_xy_mm:centre,response:summarize([{x:station(centre),force:weight}])},
  unit_at_ridge_response:summarize([{x:station(atRidge.face_centre_xy_mm??diagonal.b_mm),force:1}])};
}

function roofRidgeSupportChain(members,solids,postBearings){
 const joints=['post-2','post-1'].map(id=>{
  const post=members.find(m=>m.id===id);
  const support=postBearings.find(row=>row.post_id===id).upper;
  return {post_id:id,load_y_mm:post.a_mm[1],contact_y_mm:support.centre_xy_mm?.[1]??null,area_mm2:support.projected_area_mm2};
 });
 const central=members.find(m=>m.id==='purlin-19');
 const timber=solids.filter(s=>s.id===central.id+'-piece1');
 const walls=central.central_bearing.wall_ids.map(id=>{
  let area=0,firstMoment=0;
  for(const a of timber)for(const b of solids.filter(s=>s.id===id)){
   for(const {normal,polygon} of roofCommonFaces(a,b))if(normal[2]>.99999){
    const {area:patchArea,moment}=roofFacePlanMoment(polygon);
    area+=patchArea;firstMoment+=moment[1];
   }
  }
  return {wall_id:id,area_mm2:area,contact_y_mm:area?firstMoment/area:null};
 });
 const study=(supports,loads)=>{
  const [south,north]=supports.map(s=>s.contact_y_mm);
  if(south===null||north===null||north<=south)return null;
  const reactions=loads.map(load=>{
   const northReaction=(load.load_y_mm-south)/(north-south);
   return {...load,south_reaction_kn:1-northReaction,north_reaction_kn:northReaction};
  });
  return {span_mm:north-south,supports,loads:reactions};
 };
 return {status:'unit_load_on_contact_centres',load_kn:1,main:study(joints,joints),
  lower:study(walls,[{post_id:joints[0].post_id,load_y_mm:joints[0].load_y_mm}])};
}

function roofRafterStockReport(){
 // KD-4 cites GOST 24454-80. Use the upper nominal stock length
 // and the larger depicted lap for a length-only fit check.
 const stock=6500;
 const laps=[n('roof.splice_rafter.lap_front'),n('roof.splice_rafter.lap_section')];
 const halfLap=Math.max(...laps)/2;
 const members=MODEL.roof_frame.members;
 const rafters=members.filter(m=>m.position==='1'&&m.family==='rafters');
 const supportFamilies=new Set(['mauerlat','purlins','diagonals']);
 const supports=members.filter(m=>supportFamilies.has(m.family)).flatMap(m=>
  frameDisplaySolids(m).map(p=>roofContactSolid(p.axis_piece_id,m.family,p.faces)));
 const rows=rafters.map(m=>{
  const [axis]=frameAxes(framePieces(m)[0]);
  const projectStation=point=>contactDot(contactSub(point,m.a_mm),axis);
  const fragments=frameDisplaySolids(m).map(p=>roofContactSolid(p.axis_piece_id,m.family,p.faces));
  const pieces=[];
  for(const component of roofConnectedBodies(fragments)){
   const stations=component.flatMap(p=>p.faces.flat()).map(projectStation);
   const start=Math.min(...stations),end=Math.max(...stations),length=end-start;
   const volume=component.reduce((sum,p)=>sum+roofConvexVolume(p.faces,p.centre),0);
   const firstCentre=length-stock+halfLap,lastCentre=stock-halfLap;
   const oneBlank=m.lvl_trial?.catalogue_blank_mm??null;
   const lapCentre=!oneBlank&&length>stock&&firstCentre<=lastCentre?[firstCentre,lastCentre]:null;
   const piece={start_mm:start,end_mm:end,length_mm:length,volume_mm3:volume,
    one_blank_mm:oneBlank,lap_centre_from_start_mm:lapCentre};
   if(length>stock){
    const contacts=new Map();
    for(const support of supports)for(const fragment of component){
     const hit=measureRoofContact(fragment,support,projectStation);
     if(!hit?.station_range_mm)continue;
     const [lo,hi]=hit.station_range_mm;
     const contact=contacts.get(support.id)??{id:support.id,family:support.family,start_mm:lo,end_mm:hi,area_mm2:0};
     contact.start_mm=Math.min(contact.start_mm,lo);
     contact.end_mm=Math.max(contact.end_mm,hi);
     contact.area_mm2+=hit.area_mm2;
     contacts.set(support.id,contact);
    }
    const interfaces=[...contacts.values()].sort((a,b)=>a.start_mm-b.start_mm);
    piece.support_contacts=interfaces;
    piece.clear_intervals_mm=interfaces.slice(1).map((next,i)=>Math.max(0,next.start_mm-interfaces[i].end_mm));
   }
   pieces.push(piece);
  }
  pieces.sort((a,b)=>a.start_mm-b.start_mm);
  return {member_id:m.id,facet_id:m.facet_id,station_mm:m.grid_coordinate_mm,axis_length_mm:m.axis_length_mm,
   section_area_mm2:m.width_mm*m.height_mm,additional_vk2_row:Boolean(m.vk2_edge_support),pieces};
 });
 const sum=(items,key)=>items.reduce((total,item)=>total+item[key],0);
 const pieces=rows.flatMap(row=>row.pieces);
 const source=MODEL.roof_frame.comparisons.find(r=>r.position==='1');
 return {nominal_stock_mm:stock,source_laps_mm:laps,check_lap_mm:halfLap*2,source_length_m:Number(source.source_quantity),
  source_volume_m3:Number(source.source_listed_volume_m3),axis_sum_mm:sum(rows,'axis_length_mm'),piece_count:pieces.length,
  piece_length_sum_mm:sum(pieces,'length_mm'),net_volume_m3:sum(pieces,'volume_mm3')/1e9,
  net_equivalent_length_mm:rows.reduce((s,row)=>s+sum(row.pieces,'volume_mm3')/row.section_area_mm2,0),
  long_piece_count:pieces.filter(p=>p.length_mm>stock).length,rows};
}

function roofVk2SpanScreen(members,seats,stock,ridge){
 const elasticModulus=10000;
 const lineLoad=1;
 const climate=MODEL.roof_frame.climatic_reference;
 // SP 20, Appendix B.1, uniform scheme for simple roofs. This is a
 // reference pressure only, without the roof's local accumulations.
 const pitch=n('roof.pitch');
 const shape=Math.min(1,Math.max(0,(60-pitch)/30));
 const snowPressure=climate.ground_snow_kn_m2*shape;
 const ridgePosts=ridge?.supports??[];
 const rows=ridge?['rafter-vk2','rafter-90'].flatMap(id=>{
  const rafter=members.find(m=>m.id===id);
  const [eave,ridgeEdge]=[rafter.a_mm[0],rafter.b_mm[0]];
  const supports=seats.filter(s=>s.beam_id===id+'-piece1').sort((a,b)=>a.centre_xy_mm[0]-b.centre_xy_mm[0]);
  if(supports.length!==2||supports[0].support_id!=='mauerlat-10-piece1'||supports[1].support_id!=='purlin-7-piece1')return [];
  const [west,east]=supports.map(s=>s.centre_xy_mm[0]);
  const seat=supports[0],notchDepth=seat.cut_depth_mm;
  const cosine=(ridgeEdge-eave)/rafter.axis_length_mm;
  const toStation=x=>(x-eave)/cosine;
  const a=toStation(west),b=toStation(east);
  const mid=(a+b)/2;
  const inertia=rafter.width_mm*rafter.height_mm**3/12;
  const modulus=rafter.lvl_trial?.screen_elastic_modulus_mpa??elasticModulus;
  const lap=stock.rows.find(row=>row.member_id===id).pieces.find(p=>p.lap_centre_from_start_mm);
  const lapRange=lap?.lap_centre_from_start_mm.map(s=>s+lap.start_mm)??null;
  const cases=[['full',eave,ridgeEdge],['eave',eave,west],['upper_slope',west,ridgeEdge]].map(([key,from,to])=>{
   const verticalLoad=lineLoad*(to-from)/1000;
   const atRidge=verticalLoad*((from+to)/2-west)/(east-west);
   const atMauerlat=verticalLoad-atRidge;
   const u=toStation(from),v=toStation(to),q=lineLoad*cosine**2;
   const positive=x=>Math.max(0,x);
   const bend=(s,power)=>1000*cosine*(atMauerlat*positive(s-a)**power+atRidge*positive(s-b)**power)
    -q*(positive(s-u)**(power+1)-positive(s-v)**(power+1))/(power+1);
   const moment=s=>bend(s,1)/1e6;
   // Twice integrate M/EI and impose zero transverse displacement at both seats.
   const primitive=s=>bend(s,3)/(6*modulus*inertia);
   const transverse=s=>primitive(s)-primitive(a)-(s-a)*(primitive(b)-primitive(a))/(b-a);
   const zeroShear=toStation(from+1000*atMauerlat/lineLoad);
   const extremes=(low,high)=>{
    const stations=[low,high,...[u,v].filter(s=>s>low&&s<high)];
    if(zeroShear>low&&zeroShear<high&&zeroShear>u&&zeroShear<v)stations.push(zeroShear);
    const moments=stations.map(moment);
    return [Math.min(...moments),Math.max(...moments)];
   };
   const northShare=(rafter.grid_coordinate_mm-ridge.supports[0].contact_y_mm)/ridge.span_mm;
   return {id:key,loaded_x_range_mm:[from,to],vertical_load_kn:verticalLoad,
    mauerlat_reaction_kn:atMauerlat,ridge_reaction_kn:atRidge,
    ridge_post_reactions_kn:[atRidge*(1-northShare),atRidge*northShare],
    mauerlat_moment_knm:moment(a),span_moment_range_knm:extremes(a,b),
    lap_centre_moment_range_knm:lapRange?extremes(...lapRange):null,
    midspan_vertical_bending_deflection_mm:cosine*transverse(mid),eave_vertical_bending_deflection_mm:cosine*transverse(0)};
  });
  return [{member_id:id,y_mm:rafter.grid_coordinate_mm,section_mm:[rafter.width_mm,rafter.height_mm],
   cover_x_range_mm:[eave,ridgeEdge],support_centres_x_mm:[west,east],support_span_along_grain_mm:b-a,
   mauerlat_contact_mm2:seat.area_mm2,mauerlat_contact_width_mm:rafter.width_mm,elastic_modulus_mpa:modulus,
   mauerlat_notch:{remaining_height_mm:seat.nominal_remaining_height_mm,
    // Intersection of the uncut axis with the normal section at the heel.
    section_x_mm:west-seat.plan_length_mm/2-(rafter.height_mm/2-notchDepth)*Math.sqrt(1-cosine**2)},
   eave_overhang_plan_mm:west-eave,eave_overhang_along_grain_mm:a,lap_centres_along_grain_mm:lapRange,cases}];
 }):[];
 return {status:'unit_vertical_action_on_two_bearings',elastic_modulus_mpa:elasticModulus,
  uniform_snow_reference:{status:'simple_slope_reference_not_roof_load_envelope',climatic_reference:climate,
   input_fact_ids:['roof.pitch'],slope_deg:pitch,shape_coefficient:shape,snow_exposure_factor:1,thermal_factor:1,
   characteristic_pressure_kn_m2:snowPressure,factored_pressure_kn_m2:snowPressure*climate.snow_load_factor},
  load_kn_per_m_horizontal_projection:lineLoad,ridge_post_ids:ridgePosts.map(s=>s.post_id),rows};
}

function roofBattenLoadField(members,solids,contacts,cells,along,onPatch=()=>{}){
 const across=1-along;
 const cellIds=new Set(cells.map(c=>c.id));
 const cover=cells.flatMap(cell=>cutRoofCell(cell));
 const coverArea=cover.reduce((sum,poly)=>sum+roofFacePlanMoment(poly).area,0);
 const edge=axis=>{
  const values=cover.flat().map(p=>p[axis]);
  return [Math.min(...values),Math.max(...values)];
 };
 const edgeAcross=edge(across),edgeAlong=edge(along);
 const length=Math.hypot(...cells[0].plane.slice(0,2),1);
 const undersideNormal=[-cells[0].plane[0]/length,-cells[0].plane[1]/length,1/length];
 const cellId=member=>member.input_geometry_ids.find(id=>id.startsWith('roof.cells.'))?.split('.').at(-1);
 const byId=new Map();
 for(const s of solids){
  if(!byId.has(s.id))byId.set(s.id,[]);
  byId.get(s.id).push(s);
 }
 const battenSupports=new Map();
 for(const pair of contacts.filter(p=>p.area_mm2>0&&p.family.includes('battens')&&p.family.includes('counter'))){
  const batten=pair.ids[pair.family.indexOf('battens')],counter=pair.ids[pair.family.indexOf('counter')];
  if(!battenSupports.has(batten))battenSupports.set(batten,[]);
  battenSupports.get(batten).push(counter);
 }
 const plane=(axis,sign,position)=>{
  const row=[0,0,0,-sign*position];row[axis]=sign;return row;
 };
 const clipRun=(poly,axis,lo,hi)=>clipContactFace(
  clipContactFace(poly,plane(axis,1,lo)),plane(axis,-1,hi));
 const segments=members.filter(m=>m.family==='battens'&&m.a_mm[across]===m.b_mm[across]&&cellIds.has(cellId(m))).flatMap(m=>{
  const id=m.id+'-piece1',station=m.a_mm[across],parts=byId.get(id)??[];
  const ranges=parts.flatMap(part=>{
   const values=part.faces.flatMap(face=>clipRun(face,across,station,station)).map(p=>p[along]);
   return values.length&&Math.max(...values)-Math.min(...values)>roofContactTolerance?[[Math.min(...values),Math.max(...values)]]:[];
  }).sort((a,b)=>a[0]-b[0]);
  const runs=[];
  for(const [lo,hi] of ranges){
   const last=runs.at(-1);
   if(last&&lo<=last.hi+roofContactTolerance)last.hi=Math.max(last.hi,hi);
   else runs.push({id,station,lo,hi,seats:[],area:0});
  }
  for(const counter of battenSupports.get(id)??[]){
   for(const run of runs){
    let area=0;const first=[0,0];
    for(const a of parts)for(const b of byId.get(counter)){
     if(a.bounds[along]>run.hi||a.bounds[along+3]<run.lo||b.bounds[along]>run.hi||b.bounds[along+3]<run.lo)continue;
     for(const {normal,polygon} of roofCommonFaces(a,b)){
      if(contactDot(normal,undersideNormal)<1-1e-7)continue;
      const patch=clipRun(polygon,along,run.lo,run.hi);
      if(patch.length<3)continue;
      const {area:weight,moment}=roofFacePlanMoment(patch);
      area+=weight;
      first[0]+=moment[0];first[1]+=moment[1];
     }
    }
    if(area>roofContactTolerance**2)run.seats.push({counter_id:counter,x:first[0]/area,y:first[1]/area,
     along:first[along]/area,area,tributary:0});
   }
  }
  for(const [i,run] of runs.entries()){
   run.seats.sort((a,b)=>a.along-b.along);
   run.separable=run.seats.length>=2&&run.seats.every((seat,i)=>!i||seat.along-run.seats[i-1].along>roofContactTolerance);
   run.wood_range=[
    i?(runs[i-1].hi+run.lo)/2:Math.min(...parts.map(p=>p.bounds[along])),
    i+1<runs.length?(run.hi+runs[i+1].lo)/2:Math.max(...parts.map(p=>p.bounds[along+3])),
   ];
  }
  return runs;
 }).sort((a,b)=>a.station-b.station);
 // Partition projected covering first along the batten axis, then across
 // the active transverse rows. This keeps cuts and holes out of the loads.
 const planClip=(poly,lo,hi,start,end)=>[plane(across,1,lo),plane(across,-1,hi),plane(along,1,start),plane(along,-1,end)]
  .reduce((p,[a,b,,d])=>HouseShapes.clip(p,[a,b,d]),poly);
 const bounds=[...new Set([...edgeAlong,...segments.flatMap(s=>[s.lo,s.hi])])].sort((a,b)=>a-b);
 const uncovered=[];
 for(let i=1;i<bounds.length;i++){
  const start=bounds[i-1],end=bounds[i],mid=(start+end)/2;
  if(end-start<=1e-7)continue;
  const active=segments.filter(s=>s.lo<mid&&s.hi>mid);
  if(!active.length){
   for(const poly of cover){
    const tile=planClip(poly,...edgeAcross,start,end);
    const area=roofFacePlanMoment(tile).area;
    if(area>roofContactTolerance**2)uncovered.push({polygon_mm:tile,area_m2:area/1e6});
   }
  }
  for(const [j,segment] of active.entries()){
   const lo=j?(active[j-1].station+segment.station)/2:edgeAcross[0];
   const hi=j+1<active.length?(active[j+1].station+segment.station)/2:edgeAcross[1];
   const stations=[...new Set([start,end,...segment.seats.map(s=>s.along).filter(y=>y>start&&y<end)])].sort((a,b)=>a-b);
   for(const poly of cover){
    const tile=planClip(poly,lo,hi,start,end);
    if(tile.length<3)continue;
    const n=segment.seats.length;
    if(!segment.separable){segment.area+=roofFacePlanMoment(tile).area;continue;}
    for(let k=1;k<stations.length;k++){
     const from=stations[k-1],to=stations[k];
     const patch=planClip(tile,lo,hi,from,to);
     if(patch.length<3)continue;
     const {area,moment}=roofFacePlanMoment(patch);
     if(!area)continue;
     segment.area+=area;
     const upper=segment.seats.findIndex(s=>s.along>(from+to)/2);
     const rightIndex=upper===-1?n-1:Math.max(1,upper);
     const [left,right]=segment.seats.slice(rightIndex-1,rightIndex+1);
     const share=(moment[along]-left.along*area)/(right.along-left.along);
     left.tributary+=area-share;
     right.tributary+=share;
     onPatch({patch,left,right,segment});
    }
   }
  }
 }
 const accounted=segments.reduce((sum,s)=>sum+s.area,0);
 const unresolved=segments.filter(s=>!s.separable&&s.area>roofContactTolerance**2);
 const transferred=segments.reduce((sum,s)=>sum+s.seats.reduce((area,seat)=>area+seat.tributary,0),0);
 return {cellIds,byId,segments,length,coverArea,accounted,transferred,uncovered,unresolved};
}

function roofBattenVolumeShares(segment,bodies,axis){
 const stations=[segment.wood_range[0],...segment.seats.map(s=>s.along),segment.wood_range[1]];
 const shares=segment.seats.map(()=>0),last=shares.length-1;
 for(let i=0;i+1<stations.length;i++){
  const {volume_mm3:volume,first_moment_mm4:moment}=roofTimberSlice(bodies,axis,stations[i],stations[i+1]);
  const left=Math.min(last-1,Math.max(0,i-1)),right=left+1;
  const a=segment.seats[left].along,b=segment.seats[right].along;
  const share=(moment-a*volume)/(b-a);
  shares[left]+=volume-share;
  shares[right]+=share;
 }
 return shares;
}

function roofVk2BattenLoads(members,solids,contacts,span,ridgeChain){
 if(!span.rows.length)return null;
 const counterRows=span.rows.map(row=>framePieces(members.find(m=>m.id==='counter-'+row.member_id)).map(p=>p.id));
 const targetRowByPart=new Map(counterRows.flatMap((ids,index)=>ids.map(id=>[id,index])));
 const member=members.find(m=>m.id===span.rows[0].member_id);
 const cellId=member.input_geometry_ids.find(id=>id.startsWith('roof.cells.'))?.split('.').at(-1);
 const cell=MODEL.roof_geometry.cells.find(c=>c.id===cellId);
 const cells=MODEL.roof_geometry.cells.filter(c=>c.plane.every((p,i)=>Math.abs(p-cell.plane[i])<1e-6));
 const drift=roofVk2SnowDriftGeometry(cell.plane,span.uniform_snow_reference);
 const driftPatches=[];
 const field=roofBattenLoadField(members,solids,contacts,cells,1,({patch,left,right})=>{
  const targetRows=[left,right].map(seat=>targetRowByPart.get(seat.counter_id)??-1);
  if(targetRows.some(i=>i>=0)&&drift&&[0,1].every(i=>
    patch.some(p=>p[i]>=drift.outer_limits_mm[i])&&patch.some(p=>p[i]<=drift.outer_limits_mm[i+2]))){
   driftPatches.push({polygon:patch,left,right,targetRows});
  }
 });
 const {cellIds,byId,segments,length,coverArea,accounted,transferred,uncovered,unresolved}=field;
 const northwestIds=new Set(contacts.filter(p=>p.area_mm2>0&&p.ids.includes('diagonal-1-piece1')&&p.family.includes('rafters'))
  .map(p=>p.ids.find(id=>id!=='diagonal-1-piece1').replace(/-piece1$/,'')));
 const northwestLoads={};
 for(const segment of segments.filter(s=>s.separable))for(const seat of segment.seats){
  const id=seat.counter_id.replace(/^counter-|-piece\d+$/g,'');
  if(northwestIds.has(id))(northwestLoads[id]??=[]).push({batten_id:segment.id,x_mm:seat.x,area_m2:seat.tributary/1e6});
 }
 const gravity=MODEL.roof_frame.gravity_reference;
 // These layers are measured per square metre of slope. Snow is per plan m².
 const massToPlanPressure=gravity.gravity_m_s2*length/1000;
 const characteristicLayers=gravity.area_layers.reduce((sum,l)=>sum+l.kg_per_slope_m2,0)*massToPlanPressure;
 const factoredLayers=gravity.area_layers.reduce((sum,l)=>sum+l.kg_per_slope_m2*l.load_factor,0)*massToPlanPressure;
 for(const segment of segments.filter(s=>s.separable&&s.seats.some(seat=>targetRowByPart.has(seat.counter_id)))){
  const shares=roofBattenVolumeShares(segment,byId.get(segment.id),1);
  segment.seats.forEach((seat,i)=>{seat.batten_volume_share_mm3=shares[i];});
 }
 const volumeToSoftwoodKn=gravity.softwood_density_kg_m3*gravity.gravity_m_s2/1e12;
 const rows=span.rows.map((row,i)=>{
  const ids=counterRows[i],rafter=row.member_id+'-piece1';
  const bearing=contacts.filter(p=>p.ids.includes(rafter)&&p.ids.some(id=>ids.includes(id)))
   .reduce((total,p)=>total+p.area_mm2,0);
  const loads=segments.flatMap(segment=>segment.seats.filter(s=>targetRowByPart.get(s.counter_id)===i).map(s=>({
   batten_piece_id:segment.id,x_mm:s.x,batten_axis_x_mm:segment.station,contact_y_mm:s.y,projected_contact_mm2:s.area,
   batten_segment_y_range_mm:[segment.lo,segment.hi],
   equivalent_roof_area_m2:segment.separable?s.tributary/1e6:null,batten_support_count:segment.seats.length,
   batten_self_weight_kn:segment.separable?s.batten_volume_share_mm3*volumeToSoftwoodKn:null,
  })));
  const snow=span.uniform_snow_reference;
  return {member_id:row.member_id,y_mm:row.y_mm,loads,counter_to_rafter_contact_mm2:bearing,
   ...(bearing?{...roofVk2SnowResponse(row,loads,snow),
    gravity_response:roofVk2GravityResponse(row,loads,byId.get(rafter),ids.flatMap(id=>byId.get(id)??[]),gravity,
     characteristicLayers,factoredLayers,snow.factored_pressure_kn_m2)}:{})};
 });
 const gravityCases=rows.map(row=>row.gravity_response?.results.find(c=>c.id==='factored_gravity_and_reference_snow'));
 const lowerRidge=ridgeChain.lower;
 let ridgeTransfer=null;
 if(lowerRidge&&gravityCases.every(Boolean)){
  const {supports:[south,north],span_mm:spanMm}=ridgeChain.main;
  const total=gravityCases.reduce((sum,c)=>sum+c.ridge_kn,0);
  const northForce=gravityCases.reduce((sum,c,i)=>sum+c.ridge_kn*(rows[i].y_mm-south.contact_y_mm)/spanMm,0);
  const southForce=total-northForce;
  const [load]=lowerRidge.loads;
  ridgeTransfer={status:'two_rafter_contribution_point_bearings',purlin_7_total_kn:total,
   post_reactions_kn:{[south.post_id]:southForce,[north.post_id]:northForce},
   purlin_19_wall_reactions_kn:{[lowerRidge.supports[0].wall_id]:southForce*load.south_reaction_kn,
    [lowerRidge.supports[1].wall_id]:southForce*load.north_reaction_kn}};
 }
 return {field,status:'simplified_batten_bays_from_scene',cover_cell_ids:[...cellIds],
  batten_step_mm:MODEL.roof_frame.display_parameters.batten_display_step_mm,
  cover_projected_m2:coverArea/1e6,assigned_projected_m2:accounted/1e6,transferred_projected_m2:transferred/1e6,
  gravity_reference:{...gravity,area_layer_characteristic_kn_m2_plan:characteristicLayers,area_layer_factored_kn_m2_plan:factoredLayers},
  gravity_and_reference_snow_ridge_transfer:ridgeTransfer,
  northwest_rafter_plan_loads:northwestLoads,
  vk2_snow_drift:drift?roofVk2SnowDriftResponse(drift,driftPatches,span.rows,rows):null,
  unassigned_cover_patches:uncovered,
  unresolved_batten_segments:unresolved.map(s=>({batten_piece_id:s.id,y_range_mm:[s.lo,s.hi],projected_m2:s.area/1e6,support_count:s.seats.length})),rows};
}

function roofNorthHipBattenScreen(members,solids,contacts,stock,snow,west){
 const hipIds=new Set(['diagonal-1','diagonal-2']);
 const byId=new Map(members.map(m=>[m.id,m]));
 const assembly=id=>id.replace(/-piece\d+$/,'');
 const legIds=new Set(contacts.filter(p=>p.area_mm2>0&&p.family.includes('rafters')&&p.ids.some(id=>hipIds.has(assembly(id))))
  .map(p=>assembly(p.ids[p.family.indexOf('rafters')])));
 const gravity=MODEL.roof_frame.gravity_reference;
 const timberFactor=gravity.timber_load_factor*gravity.softwood_density_kg_m3*gravity.gravity_m_s2/1e12;
 const layers=gravity.area_layers.reduce((sum,l)=>sum+l.kg_per_slope_m2*l.load_factor,0)*gravity.gravity_m_s2/1000;
 const loads=new Map([...legIds].map(id=>[id,[]]));
 const fields=[];
 for(const [facet,along] of [['main_запад',1],['main_север',0],['main_восток',1]]){
  const cells=MODEL.roof_geometry.cells.filter(c=>c.facet_id===facet);
  const field=facet==='main_запад'&&west?west:roofBattenLoadField(members,solids,contacts,cells,along);
  const owner=seat=>assembly(seat.counter_id).replace(/^counter-/,'');
  const direct=new Map();
  for(const segment of field.segments.filter(s=>s.separable)){
   const isTarget=seat=>legIds.has(owner(seat))||byId.get(assembly(seat.counter_id))?.hip_counter;
   if(!segment.seats.some(isTarget))continue;
   const volumes=roofBattenVolumeShares(segment,field.byId.get(segment.id),along);
   for(const [i,seat] of segment.seats.entries()){
    if(!isTarget(seat))continue;
    const area=seat.tributary/1e6;
    const load={batten_id:segment.id,counter_id:seat.counter_id,point_xy_mm:[seat.x,seat.y],projected_m2:area,
     snow_kn:area*snow.factored_pressure_kn_m2,gravity_kn:area*field.length*layers+volumes[i]*timberFactor};
    if(loads.has(owner(seat)))loads.get(owner(seat)).push(load);
    else{
     const hipId=byId.get(assembly(seat.counter_id)).hip_counter.hip_id;
     if(!direct.has(hipId))direct.set(hipId,[]);
     direct.get(hipId).push(load);
    }
   }
  }
  fields.push({facet,cover_cell_ids:[...field.cellIds],cover_projected_m2:field.coverArea/1e6,
   transferred_projected_m2:field.transferred/1e6,uncovered_projected_m2:field.uncovered.reduce((sum,p)=>sum+p.area_m2,0),
   unresolved_battens:field.unresolved.map(s=>({id:s.id,station_mm:s.station,along_range_mm:[s.lo,s.hi],projected_m2:s.area/1e6,seats:s.seats.length})),
   direct_to_diagonals:Object.fromEntries(direct)});
 }
 const byPart=new Map();
 for(const solid of solids){
  if(!byPart.has(solid.id))byPart.set(solid.id,[]);
  byPart.get(solid.id).push(solid);
 }
 const seat=(partId,otherId,family)=>{
  let area=0;const moment=[0,0];
  for(const a of byPart.get(partId))for(const b of byPart.get(otherId)??[]){
   for(const {normal,polygon} of roofCommonFaces(a,b)){
    const plan=roofFacePlanMoment(polygon);
    const weight=family==='diagonals'?roofContactArea(polygon,normal):normal[2]>1e-6?plan.area:0;
    if(!weight)continue;
    area+=weight;
    if(plan.area>roofContactTolerance**2){
     for(let k=0;k<2;k++)moment[k]+=plan.moment[k]*weight/plan.area;
    }else{
     const [origin,...edge]=polygon;
     for(let i=1;i<edge.length;i++){
      const p=edge[i-1],q=edge[i],triangle=roofContactArea([origin,p,q],normal);
      for(let k=0;k<2;k++)moment[k]+=triangle*(origin[k]+p[k]+q[k])/3;
     }
    }
   }
  }
  if(area>roofContactTolerance**2)return {part_id:otherId,family,area_mm2:area,centre_xy_mm:moment.map(v=>v/area)};
 };
 const stockCounts=new Map(stock.rows.map(row=>[row.member_id,row.pieces.length]));
 const rows=[...legIds].sort((a,b)=>+a.slice(7)-+b.slice(7)).map(id=>{
  const member=byId.get(id),partId=id+'-piece1',counterId='counter-'+partId,axis=member.grid_axis;
  const battenLoads=loads.get(id);
  const bearings=contacts.filter(p=>p.area_mm2>0&&p.ids.includes(partId)).flatMap(p=>{
   const i=p.ids[0]===partId?1:0,family=p.family[i];
   if(!['diagonals','mauerlat','purlins','roof-cleats'].includes(family))return [];
   const support=seat(partId,p.ids[i],family);
   if(!support)return [];
   const parent=byId.get(assembly(p.ids[i]))?.diagonal_cleat?.diagonal_id;
   return [{...support,load_to_id:parent??assembly(p.ids[i])}];
  });
  const supports=bearings.filter(s=>s.family!=='diagonals'||!bearings.some(b=>b.family==='roof-cleats'&&b.load_to_id===s.load_to_id));
  const item={member_id:id,facet_id:member.facet_id,axis,batten_loads:battenLoads,supports};
  if(stockCounts.get(id)!==1)return {...item,status:'interrupted_rafter'};
  if(!battenLoads.length||!contacts.some(p=>p.area_mm2>0&&p.ids.includes(partId)&&p.ids.includes(counterId)))return {...item,status:'batten_load_or_counter_contact_missing'};
  if(supports.length!==2)return {...item,status:'requires_other_support_scheme'};
  const [a,b]=supports.map(s=>s.centre_xy_mm[axis]);
  if(Math.abs(b-a)<=roofContactTolerance)return {...item,status:'bearing_centres_coincide'};
  const dead=battenLoads.map(t=>({x:t.point_xy_mm[axis],force:t.gravity_kn}));
  for(const key of [partId,counterId]){
   const {volume_mm3:volume,first_moment_mm4:moment}=roofTimberSlice(byPart.get(key)??[],axis,-Infinity,Infinity);
   if(volume)dead.push({x:moment/volume,force:volume*timberFactor});
  }
  const snowForces=battenLoads.map(t=>({x:t.point_xy_mm[axis],force:t.snow_kn}));
  const g=roofTwoSeatResponse(dead,a,b),s=roofTwoSeatResponse(snowForces,a,b);
  return {...item,status:'two_seat_reference_with_assumed_end_fastening',support_span_mm:Math.abs(b-a),reactions:supports.map((p,i)=>({
   ...p,snow_kn:i?s.east:s.west,known_gravity_kn:i?g.east:g.west}))};
 });
 return {status:'partial_reference_snow_and_known_weight_through_batten_contact',snow_kn_m2:snow.factored_pressure_kn_m2,fields,rows};
}

function roofVk2SnowDriftGeometry(plane,snow){
 const shaft=MODEL.roof_frame.shaft_clearances.vent2;
 const [x0,y0,x1,y1]=shaft.insulated_bounds_mm;
 const width=x1-x0,depth=y1-y0;
 const diagonal=Math.hypot(width,depth)/1000;
 const heightFact='vent.ВК-2.top_elevation';
 const top=n(heightFact)*1000;
 const corners=roofContactRect(shaft.insulated_bounds_mm);
 const heights=corners.map(p=>top-HouseShapes.z(plane,p));
 const bottomHeight=Math.min(...heights),maximumHeight=Math.max(...heights);
 if(maximumHeight<=400||diagonal>15)return null;
 // B.17 shows one horizontal base elevation. At this sloping roof,
 // use the maximum projection height and retain the measured range.
 const cap=diagonal<=5?1.5:diagonal<=10?2:2.5;
 const shape=diagonal<=1.5?1:Math.max(1,Math.min(cap,2*(maximumHeight/1000)/snow.characteristic_pressure_kn_m2));
 const reach=Math.min(2*maximumHeight,2000*diagonal,16000);
 const designPressure=snow.climatic_reference.ground_snow_kn_m2*shape*snow.climatic_reference.snow_load_factor;
 return {status:'appendix_b14_reference_gravity_combination',standard:'СП 20.13330.2016, Б.14, рис. Б.17',
  source_url:snow.climatic_reference.maps_url+'#page=93',
  input_fact_ids:[...shaft.insulated_bounds_input_fact_ids,heightFact,'roof.pitch'],
  shaft_bounds_mm:shaft.insulated_bounds_mm,diagonal_mm:diagonal*1000,
  exposed_height_range_mm:[bottomHeight,maximumHeight],sweep_length_mm:reach,
  shape_coefficient:shape,factored_pressure_kn_m2:designPressure,
  increment_kn_m2:designPressure-snow.factored_pressure_kn_m2,
  outer_limits_mm:[x0-reach,y0-reach,x1+reach,y1+reach]};
}

function roofVk2SnowDriftResponse(drift,patches,spanRows,loadRows){
 const [x0,y0,x1,y1]=drift.shaft_bounds_mm;
 const corners=roofContactRect(drift.shaft_bounds_mm);
 const step=.25,refinement=.01,extremes=spanRows.map(()=>({mauerlat:null,ridge:null}));
 const atAngle=angle=>{
  const t=angle*Math.PI/180,dx=Math.cos(t),dy=Math.sin(t);
  const sx=Math.abs(dx)*drift.sweep_length_mm,sy=Math.abs(dy)*drift.sweep_length_mm;
  const offsets=corners.map(([x,y])=>-dy*x+dx*y);
  // A rectangle translated in both directions along a line. Its facets
  // are the expanded axis-aligned bounds and the perpendicular strip.
  const planes=[[1,0,-x0+sx],[-1,0,x1+sx],[0,1,-y0+sy],[0,-1,y1+sy],
   [-dy,dx,-Math.min(...offsets)],[dy,-dx,Math.max(...offsets)]];
  const areas=spanRows.map(()=>new Map());
  for(const {polygon,left,right,targetRows} of patches){
   const {area,moment}=roofFacePlanMoment(planes.reduce((poly,plane)=>HouseShapes.clip(poly,plane),polygon));
   if(area<=1e-5)continue;
   const share=(moment[1]-left.y*area)/(right.y-left.y);
   for(const [side,seat] of [left,right].entries()){
    const row=targetRows[side];
    if(row<0)continue;
    const value=(side?share:area-share)/1e6;
    areas[row].set(seat,(areas[row].get(seat)??0)+value);
   }
  }
  for(const [i,row] of spanRows.entries()){
   const gravity=loadRows[i].gravity_response?.results.find(c=>c.id==='factored_gravity_and_reference_snow');
   if(!gravity)continue;
   const [a,b]=row.support_centres_x_mm;
   const forces=[...areas[i]].map(([seat,area])=>({x:seat.x,force:area*drift.increment_kn_m2}));
   const {total,west,east,beam}=roofTwoSeatResponse(forces,a,b);
   const heel=gravity.notch_moment_knm+beam(row.mauerlat_notch.section_x_mm,1)/1000;
   const bearing=loadRows[i].mauerlat_bearing_screen;
   const pressure=(gravity.mauerlat_kn+west)*1000/row.mauerlat_contact_mm2;
   const result={angle_deg:angle,added_total_kn:total,added_mauerlat_kn:west,added_ridge_kn:east,
    mauerlat_kn:gravity.mauerlat_kn+west,ridge_kn:gravity.ridge_kn+east,
    mauerlat_average_pressure_mpa:pressure,
    required_bearing_length_mm:bearing.full_width_contact_length_mm*pressure/bearing.reference_resistance_mpa,
    notch_moment_knm:heel};
   for(const support of ['mauerlat','ridge']){
    const key=support+'_kn';
    if(!extremes[i][support]||result[key]>extremes[i][support][key])extremes[i][support]=result;
   }
  }
 };
 for(let angle=0;angle<180;angle+=step)atAngle(angle);
 const nearby=new Set();
 for(const {mauerlat,ridge} of extremes)for(const hit of [mauerlat,ridge].filter(Boolean)){
  for(let i=-Math.round(step/refinement);i<=Math.round(step/refinement);i++){
   nearby.add(Number(((hit.angle_deg+i*refinement+180)%180).toFixed(2)));
  }
 }
 for(const angle of nearby)atAngle(angle);
 return {...drift,angle_step_deg:step,local_angle_step_deg:refinement,rows:spanRows.map((row,i)=>({
  member_id:row.member_id,max_mauerlat:extremes[i].mauerlat,max_ridge:extremes[i].ridge}))};
}

function roofTwoSeatResponse(forces,a,b){
 const total=forces.reduce((sum,p)=>sum+p.force,0);
 const east=forces.reduce((sum,p)=>sum+p.force*(p.x-a),0)/(b-a),west=total-east;
 const positive=t=>Math.max(0,t);
 const beam=(x,power)=>west*positive(x-a)**power+east*positive(x-b)**power
  -forces.reduce((sum,p)=>sum+p.force*positive(x-p.x)**power,0);
 return {total,west,east,beam};
}

function roofVk2GravityResponse(row,loads,rafterSolids,counterSolids,gravity,characteristic,factored,snowPressure){
 const [a,b]=row.support_centres_x_mm,heel=row.mauerlat_notch.section_x_mm;
 const stations=[-Infinity,heel,a,b,Infinity];
 const memberWeights=[
  ['rafter',rafterSolids,row.member_id==='rafter-90'?gravity.lvl_density_kg_m3:gravity.softwood_density_kg_m3],
  ['counter',counterSolids,gravity.softwood_density_kg_m3],
 ].map(([id,solids,density])=>{
  const slices=stations.slice(1).map((hi,i)=>roofTimberSlice(solids,0,stations[i],hi)).filter(s=>s.volume_mm3>0);
  const selfWeight=slices.map(({volume_mm3:volume,first_moment_mm4:moment})=>
   ({x:moment/volume,force:volume*density*gravity.gravity_m_s2/1e12}));
  return {id,volume_mm3:slices.reduce((sum,s)=>sum+s.volume_mm3,0),self_weight:selfWeight};
 });
 const positions=loads.filter(p=>p.equivalent_roof_area_m2!==null);
 const results=[['characteristic',characteristic,1,0],['factored_gravity',factored,gravity.timber_load_factor,0],
  ['factored_gravity_and_reference_snow',factored,gravity.timber_load_factor,snowPressure]].map(([id,pressure,timberFactor,snow])=>{
  const battenReactions=positions.map(p=>({x:p.x_mm,force:(pressure+snow)*p.equivalent_roof_area_m2+timberFactor*p.batten_self_weight_kn}));
  const wood=memberWeights.flatMap(m=>m.self_weight.map(p=>({x:p.x,force:p.force*timberFactor})));
  const {total,west,east,beam}=roofTwoSeatResponse([...battenReactions,...wood],a,b);
  const notchMoment=beam(heel,1)/1000;
  return {id,total_kn:total,mauerlat_kn:west,ridge_kn:east,at_mauerlat_knm:beam(a,1)/1000,
   notch_moment_knm:notchMoment,notch_nominal_bending_mpa:Math.abs(notchMoment)*6e6/(row.section_mm[0]*row.mauerlat_notch.remaining_height_mm**2),
   mauerlat_average_pressure_mpa:west*1000/row.mauerlat_contact_mm2,
   batten_uplift:battenReactions.flatMap((p,i)=>p.force<0?[{batten_piece_id:positions[i].batten_piece_id,reaction_kn:p.force}]:[])};
 });
 return {status:'partial_permanent_weight_and_reference_snow',member_weights:memberWeights,results};
}

function roofVk2SnowResponse(row,loads,snow){
 const area=loads.reduce((sum,p)=>sum+(p.equivalent_roof_area_m2??0),0);
 const [a,b]=row.support_centres_x_mm,[eave]=row.cover_x_range_mm;
 const cos=(b-a)/row.support_span_along_grain_mm;
 const [width,height]=row.section_mm,inertia=width*height**3/12;
 const positions=loads.filter(p=>p.equivalent_roof_area_m2!==null);
 const results=[['characteristic',snow.characteristic_pressure_kn_m2],['factored',snow.factored_pressure_kn_m2]].map(([id,pressure])=>{
  const force=positions.map(p=>({x:p.x_mm,force:p.equivalent_roof_area_m2*pressure}));
  const {total,west,east,beam}=roofTwoSeatResponse(force,a,b);
  const moment=x=>beam(x,1)/1000;
  const primitive=x=>1000*beam(x,3)/(6*row.elastic_modulus_mpa*inertia*cos);
  const deflection=x=>primitive(x)-primitive(a)-(x-a)*(primitive(b)-primitive(a))/(b-a);
  const lap=row.lap_centres_along_grain_mm?.map(s=>eave+s*cos);
  const lapMoments=lap?[...lap,...force.map(p=>p.x).filter(x=>x>lap[0]&&x<lap[1])].map(moment):[];
  const notchMoment=moment(row.mauerlat_notch.section_x_mm);
  return {id,reference_pressure_kn_m2:pressure,total_kn:total,mauerlat_kn:west,ridge_kn:east,at_mauerlat_knm:moment(a),
   notch_moment_knm:notchMoment,
   notch_nominal_bending_mpa:Math.abs(notchMoment)*6e6/(width*row.mauerlat_notch.remaining_height_mm**2),
   lap_centre_moment_range_knm:lapMoments.length?[Math.min(...lapMoments),Math.max(...lapMoments)]:null,
   midspan_vertical_bending_deflection_mm:deflection((a+b)/2),eave_vertical_bending_deflection_mm:deflection(eave)};
 });
 // SP 64 table 3, 4a, table 4, regime Г, and 6.9(k), cross-grain local bearing.
 const baseBearingResistance=4.5,durationFactor=.66,localBearingFactor=1.15;
 const resistance=baseBearingResistance*durationFactor*localBearingFactor;
 const bearingLoad=results[1].mauerlat_kn*1000;
 const meanPressure=bearingLoad/row.mauerlat_contact_mm2;
 return {equivalent_roof_area_m2:area,results,mauerlat_bearing_screen:{
  status:'snow_contribution_only_perpendicular_to_plate_grain',
  base_resistance_mpa:baseBearingResistance,load_duration_factor:durationFactor,local_bearing_factor:localBearingFactor,reference_resistance_mpa:resistance,
  horizontal_contact_mm2:row.mauerlat_contact_mm2,full_width_contact_length_mm:row.mauerlat_contact_mm2/row.mauerlat_contact_width_mm,
  average_pressure_mpa:meanPressure,
  required_full_width_length_mm:bearingLoad/(resistance*row.mauerlat_contact_width_mm),
 }};
}

function timberLineSpans(point,up,fragments){
 const spans=[];
 for(const body of fragments){
  let start=0,end=Infinity;
  for(const {plane} of body.sides){
   const direction=plane.slice(0,3);
   const distance=contactDot(direction,point)+plane[3];
   const rate=contactDot(direction,up);
   if(rate>1e-9)start=Math.max(start,-distance/rate);
   else if(rate< -1e-9)end=Math.min(end,-distance/rate);
   else if(distance< -1e-6){end=-1;break;}
  }
  if(end>start+1e-6)spans.push([start,end]);
 }
 return spans.sort((a,b)=>a[0]-b[0]);
}

function timberDepthFrom(point,up,fragments){
 let depth=0;
 for(const [start,end] of timberLineSpans(point,up,fragments)){
  if(start>depth+1e-6)break;
  depth=Math.max(depth,end);
 }
 return depth;
}

function roofSeatCuts(contacts,members,solids){
 const pieces=new Map(members.flatMap(m=>framePieces(m).map(p=>[p.id,p])));
 const fragments=new Map();
 for(const solid of solids){
  if(!fragments.has(solid.id))fragments.set(solid.id,[]);
  fragments.get(solid.id).push(solid);
 }
 const result=[];
 for(const contact of contacts){
  if(!contact.area_mm2)continue;
  const beamIndex=contact.family.findIndex(f=>f==='rafters'||f==='diagonals');
  if(beamIndex<0||!['mauerlat','purlins'].includes(contact.family[1-beamIndex]))continue;
  const [beamId,supportId]=[contact.ids[beamIndex],contact.ids[1-beamIndex]];
  const piece=pieces.get(beamId);
  const [along,,up]=frameAxes(piece);
  const run=Math.hypot(along[0],along[1]);
  const planAxis=[along[0]/run,along[1]/run,0];
  const beamBodies=fragments.get(beamId);
  let area=0,depth=0,lo=Infinity,hi=-Infinity;
  const planMoment=[0,0];
  let heightMin=Infinity,heightMax=0;
  for(const beam of beamBodies)for(const support of fragments.get(supportId)){
   for(const {face,plane} of beam.sides){
    if(plane[2]<1-1e-9||!support.sides.some(s=>s.plane[2]<-1+1e-9&&Math.abs(plane[3]+s.plane[3])<1e-6))continue;
    const polygon=support.sides.reduce((ring,side)=>clipContactFace(ring,side.plane),face);
    if(polygon.length<3)continue;
    const {area:patch,moment}=roofFacePlanMoment(polygon);
    if(patch<=roofContactTolerance**2)continue;
    area+=patch;
    for(let i=0;i<2;i++)planMoment[i]+=moment[i];
    for(const point of polygon){
     const delta=contactSub(point,piece.a_mm);
     depth=Math.max(depth,piece.height_mm/2+contactDot(delta,up));
     const height=timberDepthFrom(point,up,beamBodies);
     heightMin=Math.min(heightMin,height);
     heightMax=Math.max(heightMax,height);
     const alongPlan=contactDot(delta,planAxis);
     lo=Math.min(lo,alongPlan);
     hi=Math.max(hi,alongPlan);
    }
   }
  }
  if(area>0&&depth>roofContactTolerance)result.push({
   beam_id:beamId,support_id:supportId,area_mm2:area,plan_length_mm:hi-lo,centre_xy_mm:planMoment.map(m=>m/area),
   cut_depth_mm:depth,section_height_mm:piece.height_mm,nominal_remaining_height_mm:piece.height_mm-depth,
   edge_height_range_mm:[heightMin,heightMax],
  });
 }
 return result;
}

const hipHangerCatalogue={
 model:'Simpson Strong-Tie LSSU170/50',
 catalogue_max_width_mm:50, catalogue_joist_height_mm:[195,245], catalogue_max_skew_deg:45,
 eta_c24_table_width_mm:47,
 catalogue_url:'https://www.strongtie.co.uk/en-UK/products/light-slope-skew-adjustable-hangers-lssu',
 assessment_url:'https://www.strongtie.dk/sites/default/files/field_media_file_2/2025/05/07/194130/eta-08-0053-2025-05-01.pdf',
};

function roofHipHangerGeometry(rafter,hip,rafterParts,hipParts){
 const degrees=180/Math.PI;
 const d=contactSub(rafter.b_mm,rafter.a_mm),h=contactSub(hip.b_mm,hip.a_mm);
 const rafterSlope=Math.atan2(Math.abs(d[2]),Math.hypot(d[0],d[1]))*degrees;
 const hipSlope=Math.atan2(Math.abs(h[2]),Math.hypot(h[0],h[1]))*degrees;
 const skew=Math.atan2(Math.abs(d[0]*h[0]+d[1]*h[1]),Math.abs(d[0]*h[1]-d[1]*h[0]))*degrees;
 const [,side]=frameAxes(framePieces(hip)[0]);
 const [from,to]=[rafter.a_mm,rafter.b_mm].map(p=>contactDot(contactSub(p,hip.a_mm),side));
 const outer=Math.abs(from)>Math.abs(to)?from:to;
 const ratio=(Math.sign(outer)*hip.width_mm/2-from)/(to-from);
 const point=rafter.a_mm.map((value,i)=>value+d[i]*ratio);
 point[2]=Math.min(...[...rafterParts,...hipParts].map(p=>p.bounds[2]))-1;
 const vertical=[0,0,1];
 const rafterSpan=timberLineSpans(point,vertical,rafterParts)[0];
 const hipSpan=timberLineSpans(point,vertical,hipParts)[0];
 const bottomDelta=rafterSpan&&hipSpan?hipSpan[0]-rafterSpan[0]:null;
 const [minHeight,maxHeight]=hipHangerCatalogue.catalogue_joist_height_mm;
 return {rafter_slope_deg:rafterSlope,diagonal_slope_deg:hipSlope,skew_deg:skew,
  plan_point_mm:point.slice(0,2),rafter_bottom_below_diagonal_mm:bottomDelta,
  nominal_size_matches_catalogue:rafter.width_mm<=hipHangerCatalogue.catalogue_max_width_mm&&
   rafter.height_mm>=minHeight&&rafter.height_mm<=maxHeight,
  skew_exceeds_catalogue:skew>hipHangerCatalogue.catalogue_max_skew_deg+1e-9};
}

function roofHipCleatFits(pairs,solids){
 const contacts=new Set(pairs.filter(p=>p.area_mm2).map(p=>p.ids.join('|')));
 const fragments=new Map();
 for(const solid of solids){
  if(!fragments.has(solid.id))fragments.set(solid.id,[]);
  fragments.get(solid.id).push(solid);
 }
 const fits=[];
 for(const probe of MODEL.roof_frame.hip_cleat_probes){
  const {rafter_id,diagonal_id,plan_station_mm}=probe.diagonal_cleat;
  const rafter=rafter_id+'-piece1',diagonal=diagonal_id+'-piece1';
  if(!contacts.has([rafter,diagonal].sort().join('|')))continue;
  const [fragment]=frameDisplaySolids(probe);
  const specimen=roofContactSolid(probe.id,probe.family,fragment.faces);
  const [,,up]=frameAxes(framePieces(probe)[0]);
  const projectHeight=p=>contactDot(contactSub(p,probe.a_mm),up);
  let lower=Infinity,upper=-Infinity;
  const areas=new Map(),volumes=new Map();
  for(const target of solids){
   if(target.bounds[0]>specimen.bounds[3]+roofContactTolerance)break;
   if(probe.installed_id&&target.id===probe.installed_id+'-piece1')continue;
   const hit=measureRoofContact(specimen,target,target.id===diagonal?projectHeight:undefined);
   if(!hit)continue;
   if(hit.station_range_mm){
    lower=Math.min(lower,hit.station_range_mm[0]);
    upper=Math.max(upper,hit.station_range_mm[1]);
   }
   if(hit.area_mm2)areas.set(target.id,(areas.get(target.id)||0)+hit.area_mm2);
   if(hit.volume_mm3)volumes.set(target.id,(volumes.get(target.id)||0)+hit.volume_mm3);
  }
  fits.push({rafter_id,diagonal_id,plan_station_mm,probe_id:probe.id,installed_id:probe.installed_id,
   rafter_area_mm2:areas.get(rafter)||0,diagonal_area_mm2:areas.get(diagonal)||0,
   flank_height_mm:Number.isFinite(lower)?upper-lower:0,
   hanger_geometry:roofHipHangerGeometry(roofFrameMember(rafter_id),roofFrameMember(diagonal_id),fragments.get(rafter),fragments.get(diagonal)),
   neighboring_rafters:[...areas.keys()].filter(id=>id.startsWith('rafter-')&&id!==rafter),
   overlaps:[...volumes].map(([id,volume_mm3])=>({id,volume_mm3}))});
 }
 return fits;
}

function roofTieInterfaces(timber){
 const rafters=timber.filter(m=>m.family==='rafters'&&m.facet_id.startsWith('garage_'));
 const layouts=MODEL.roof_frame.garage_tie_layouts;
 const contains=(parts,point)=>parts.some(s=>s.sides.every(({plane})=>contactDot(plane.slice(0,3),point)+plane[3]>=-roofContactTolerance));
 const interfaces=[];
 for(const tie of timber.filter(m=>m.family==='ties')){
  const side=Math.sign(tie.a_mm[1]-tie.joint_row_mm);
  const boards=frameDisplaySolids(tie);
  if(!boards.length)continue;
  const inner=side*Math.min(...boards.flatMap(p=>p.faces.flat().map(v=>side*v[1])));
  for(const rafter of rafters.filter(r=>r.grid_coordinate_mm===tie.joint_row_mm)){
   const legs=frameDisplaySolids(rafter).map(p=>roofContactSolid(rafter.id,rafter.family,p.faces));
   if(!legs.length)continue;
   const edge=side*Math.max(...legs.map(s=>side*s.bounds[side>0?4:1]));
   const gap=side*(inner-edge);
   // Bring the parallel faces onto a common plane to measure their shared
   // outline. The actual board position and bolt layout stay independent.
   const aligned=boards.map(p=>roofContactSolid(tie.id,tie.family,p.faces.map(face=>
    face.map(([x,y,z])=>[x,y-side*gap,z]))));
   const hits=aligned.flatMap(a=>legs.map(b=>measureRoofContact(a,b))).filter(p=>p?.area_mm2>0);
   const area=hits.reduce((sum,p)=>sum+p.area_mm2,0);
   const layout=layouts[rafter.id];
   const shim=layout.shim_ids.map(roofFrameMember).find(m=>m.shim_fit.tie_id===tie.id);
   const axesFit=layout.centres_xz_mm.every(([x,z])=>
    contains(aligned,[x,edge,z])&&contains(legs,[x,edge,z]));
   interfaces.push({tie_id:tie.id,rafter_id:rafter.id,side:rafter.facet_id==='garage_запад'?'запад':'восток',
    gap_mm:gap,shim_id:shim.id,shim_thickness_mm:shim.width_mm,projected_area_mm2:area,point_mm:hits[0]?.point_mm??null,
    bolt_geometry:{...layout,axes_within_both_faces:axesFit}});
  }
 }
 return interfaces;
}

function roofTieFastenerScreen(members,solids,interfaces){
 const {bolt,washer,nut}=MODEL.roof_frame.garage_tie_fastener;
 const memberById=new Map(members.map(m=>[m.id,m]));
 const rafterIds=new Set(interfaces.map(joint=>joint.rafter_id));
 const extrude=(profile,y0,y1)=>{
  const a=profile.map(([x,z])=>[x,y0,z]),b=profile.map(([x,z])=>[x,y1,z]);
  return roofContactSolid('bolt-probe','bolt-probe',[a,b,...a.map((p,i)=>{
   const j=(i+1)%a.length;
   return [p,a[j],b[j],b[i]];
  })]);
 };
 const rows=MODEL.roof_frame.garage_tie_takeoff.rows.filter(row=>rafterIds.has(row.rafter_id)).map(row=>{
  const {rafter_id:rafterId,board_ids:boards,shim_ids:shims}=row;
  const [[nutStart,south],[north,underHead]]=row.washer_bounds_y_mm;
  const layers=[boards[0],shims[0],rafterId,shims[1],boards[1]];
  const ids=layers.map(id=>id+'-piece1');
  const widths=layers.map(id=>memberById.get(id).width_mm);
  const bolts=row.bolt_axes_mm.map(([[x,end,z]])=>{
   const circle=(r,count)=>Array.from({length:count},(_,i)=>{
    const angle=2*Math.PI*i/count;
    return [x+r*Math.cos(angle),z+r*Math.sin(angle)];
   });
   const stem=circle(bolt.diameter_mm/2,24),plate=washer.side_mm/2;
   const square=roofContactRect([x-plate,z-plate,x+plate,z+plate]);
   const hex=flats=>circle(flats/(2*Math.cos(Math.PI/6)),6);
   const nearby=solids.filter(s=>s.bounds[0]<=x+plate&&s.bounds[3]>=x-plate&&s.bounds[2]<=z+plate&&s.bounds[5]>=z-plate);
   const stemAtRest=extrude(stem,end,underHead);
   const stemArea=HouseShapes.area(stem);
   const traversed=ids.map((id,i)=>{
    const volume=nearby.filter(s=>s.id===id).reduce((sum,s)=>sum+(measureRoofContact(stemAtRest,s)?.volume_mm3??0),0);
    return Math.abs(volume-widths[i]*stemArea)<.01;
   });
   const washers=[extrude(square,south-washer.thickness_mm,south),extrude(square,north,underHead)];
   const washerFootprints=washers.map((probe,i)=>nearby.filter(s=>s.id===ids[i?4:0])
    .reduce((sum,s)=>sum+(measureRoofContact(probe,s)?.area_mm2??0),0));
   const nutProbe=extrude(hex(nut.flats_mm),nutStart-nut.height_mm,nutStart);
   const headSweep=extrude(hex(bolt.head_flats_mm),underHead,underHead+bolt.length_mm+bolt.head_height_mm);
   const stemSweep=extrude(stem,end,underHead+bolt.length_mm);
   const blockedBy=nearby.filter(s=>[...washers,nutProbe,headSweep].some(probe=>measureRoofContact(probe,s)?.volume_mm3)||
    (!ids.includes(s.id)&&measureRoofContact(stemSweep,s)?.volume_mm3)).map(s=>s.id);
   return {point_mm:[x,north,z],passes_all_five_layers:traversed.every(Boolean),
    washers_fully_on_wood:washerFootprints.every(area=>Math.abs(area-washer.side_mm**2)<.01),
    insertion_blocking_ids:[...new Set(blockedBy)]};
  });
  return {rafter_id:rafterId,tie_ids:boards,bolts,stack_mm:row.stack_mm,
   nominal_unthreaded_margin_mm:row.unthreaded_margin_mm,thread_projection_mm:row.tip_past_nut_mm};
 });
 return {...MODEL.roof_frame.garage_tie_fastener,rows};
}

function roofRidgePlateScreen(members,solids){
 const length=n('roof.ridge_plate.length'),height=n('roof.ridge_plate.width');
 const nailLength=n('roof.ridge.nail_length'),nailDiameter=n('roof.ridge.nail_diameter');
 const plateThickness=MODEL.roof_frame.display_parameters.ridge_plate_thickness_mm;
 const gable=MODEL.roof_frame.north_gable_ridge;
 const ridgeRows=new Map();
 for(const member of members.filter(m=>m.family==='rafters'&&m.ridge_cut)){
  const cut=member.ridge_cut,station=member[cut.end][1-cut.axis];
  const key=[...cut.input_geometry_ids,station].join('|');
  if(!ridgeRows.has(key))ridgeRows.set(key,[]);
  ridgeRows.get(key).push(member);
 }
 const rows=[...ridgeRows.values()].map(row=>{
  const [first]=row,{axis,coordinate_mm:seam,end}=first.ridge_cut,cross=1-axis;
  const station=first[end][cross],half=first.width_mm/2;
  const section={member_ids:row.map(m=>m.id),purlin_id:rafterRidgePurlin(first)?.id??null,
   axis,station_mm:station,nail_beyond_board_mm:nailLength-plateThickness-first.width_mm,plate_fit:null,blocked_example:null};
  if(row.length!==2)return section;
  const sideOffset=Math.abs(first.width_mm-row[1].width_mm)/2;
  if(sideOffset>roofContactTolerance)return {...section,nail_beyond_board_mm:null,
   side_face_offset_mm:sideOffset,point_mm:first[end]};
  const rafterIds=new Set(row.map(m=>m.id+'-piece1'));
  const byMember=new Map(row.map(m=>[m.id,solids.filter(s=>s.id===m.id+'-piece1')]));
  const fromZ=Math.min(...[...byMember.values()].flat().map(s=>s.bounds[2]));
  const alongBounds=[seam-length/2,seam+length/2];
  const position=(u,v,z)=>axis===0?[u,v,z]:[v,u,z];
  const corners=row.flatMap(member=>{
   const other=member.ridge_cut.end==='a_mm'?member.b_mm:member.a_mm;
   const side=Math.sign(other[axis]-seam);
   return [seam,seam+side*length/2].flatMap(u=>[station-half,station+half].map(v=>{
    const spans=timberLineSpans(position(u,v,fromZ),[0,0,1],byMember.get(member.id));
    return spans.length?[fromZ+spans[0][0],fromZ+spans.at(-1)[1]]:null;
   }));
  });
  if(corners.some(p=>!p))return section;
  const bottom=Math.max(...corners.map(p=>p[0]));
  const ceiling=Math.min(...corners.map(p=>p[1]))-height;
  const installedIds=gable?.rafter_ids.includes(first.id)?gable.plate_ids.map(id=>id+'-piece1'):[];
  const nearby=solids.filter(s=>!rafterIds.has(s.id)&&!installedIds.includes(s.id)&&
   s.bounds[axis]<alongBounds[1]&&s.bounds[axis+3]>alongBounds[0]&&
   s.bounds[cross]<station+half+plateThickness&&s.bounds[cross+3]>station-half-plateThickness&&
   s.bounds[2]<ceiling+height&&s.bounds[5]>bottom);
  const fitAt=z=>{
   const plates=[station-half-plateThickness,station+half].map(c=>{
    const a=position(alongBounds[0],c,z),b=position(alongBounds[1],c+plateThickness,z);
    const bounds=[a[0],a[1],z,b[0],b[1],z+height];
    return {bounds,solid:roofContactPrism('probe','metal',roofContactRect([a[0],a[1],b[0],b[1]]),[0,0,z],[0,0,z+height])};
   });
   const contacts=new Map();
   for(const {solid} of plates){
    for(const parts of byMember.values()){
     const hits=parts.map(part=>measureRoofContact(solid,part)).filter(Boolean);
     if(hits.some(hit=>hit.volume_mm3)||Math.abs(hits.reduce((sum,hit)=>sum+hit.area_mm2,0)-length*height/2)>.05)return null;
    }
    for(const part of nearby){
     const volume=measureRoofContact(solid,part)?.volume_mm3;
     if(volume)contacts.set(part.id,(contacts.get(part.id)||0)+volume);
    }
   }
   const fit={plate_bounds_mm:plates.map(p=>p.bounds),point_mm:position(seam,station,z+height/2)};
   if(!contacts.size)return fit;
   section.blocked_example??={...fit,overlaps:[...contacts].map(([id,volume_mm3])=>({id,volume_mm3}))};
   return null;
  };
  if(ceiling>=bottom){
   // Start in the middle of the vertical range and try nearby heights in millimetres.
   const mid=(bottom+ceiling)/2;
   section.plate_fit=fitAt(mid);
   for(let shift=1;!section.plate_fit&&shift<=Math.ceil(ceiling-mid);shift++){
    section.plate_fit=fitAt(Math.min(ceiling,mid+shift))||fitAt(Math.max(bottom,mid-shift));
   }
   if(section.plate_fit)section.blocked_example=null;
  }
  return section;
 });
 return {status:'plate_geometry_with_open_fastening',length_mm:length,height_mm:height,display_thickness_mm:plateThickness,
  nail_length_mm:nailLength,nail_count:n('roof.ridge.nail_count'),nail_diameter_mm:nailDiameter,rows};
}

function roofVk2RafterConnector(members,solids){
 // ETA-06/0106 Annex D60, pattern 1, and the manufacturer's ADR6090L DXF.
 const rafter=members.find(m=>m.id==='rafter-vk2'),purlin=rafter&&rafterRidgePurlin(rafter);
 if(!purlin)return null;
 const leg=solids.filter(s=>s.id===rafter.id+'-piece1'),beam=solids.filter(s=>s.id===purlin.id+'-piece1');
 const width=60,metal=2,nailDiameter=4,nailLength=35;
 const rafterHoles=[[-20,39.5],[0,59.5],[20,39.5]],purlinHoles=[[-20,-21.5],[20,-21.5]];
 const end=rafter[rafter.ridge_cut.end],seatZ=Math.max(...beam.map(s=>s.bounds[5]));
 const edgeX=Math.min(...beam.map(s=>s.bounds[0])),sideY=end[1]-rafter.width_mm/2;
 const centreRange=[edgeX+width/2,end[0]-width/2];
 const [along]=frameAxes(framePieces(rafter)[0]);
 // On the beam keep the 4d clear distance from the axis to the longitudinal edge.
 const centreX=Math.max(centreRange[0],edgeX+4*nailDiameter-Math.min(...purlinHoles.map(p=>p[0])));
 const fit=centreX<=centreRange[1];
 const probe=(a,direction,parts)=>{
  const b=a.map((p,i)=>p+direction[i]*(nailLength-metal));
  return {a_mm:a,b_mm:b,wood_length_mm:Math.min(nailLength-metal,timberDepthFrom(a,direction,parts))};
 };
 const nails=fit?[
  ...rafterHoles.map(([x,z])=>{
   const a=[centreX+x,sideY,seatZ+z];
   return {...probe(a,[0,1,0],leg),part_id:rafter.id,end_distance_along_grain_mm:(end[0]-a[0])/Math.abs(along[0])};
  }),
  ...purlinHoles.map(([x,y])=>{
   const a=[centreX+x,sideY+y,seatZ];
   return {...probe(a,[0,0,-1],beam),part_id:purlin.id,edge_distance_mm:a[0]-edgeX};
  }),
 ]:[];
 return {status:'geometry_only',model:'ADR6090L',rafter_id:rafter.id,purlin_id:purlin.id,
  centre_range_mm:centreRange,probe_origin_mm:fit?[centreX,sideY,seatZ]:null,
  nail_length_mm:nailLength,nail_diameter_mm:nailDiameter,nails,
  maximum_nearest_end_distance_mm:(end[0]-centreRange[0]-Math.max(...rafterHoles.map(p=>p[0])))/Math.abs(along[0]),
  nearest_end_distance_mm:fit?Math.min(...nails.filter(n=>n.part_id===rafter.id).map(n=>n.end_distance_along_grain_mm)):null,
  required_end_distance_mm:15*nailDiameter};
}

function roofPlateAnchorScreen(members,runs,solids){
 const section='belt.Мп2.';
 const inputFactIds=['roof.eave.anchor_diameter','roof.eave.anchor_spacing',section+'longitudinal_side_to_axis',
  section+'longitudinal_axis_spacing',section+'bar_axis_from_top',section+'crossbar_spacing',
  section+'rebar.1.diameter',section+'rebar.3.diameter'];
 const [diameter,spacing,sideOffset,barSpacing,barDepth,crossbarSpacing,barDiameter,crossbarDiameter]=inputFactIds.map(n);
 const radius=diameter/2;
 const washer={diameter_mm:58,height_mm:6,source:'https://www.fischer-international.com/-/media/fixing-systems/rebrush/fide/xxx---fide---alt/service/informationsmaterial/documents/prospekte/holzbau.pdf'};
 const nut={width_across_flats_mm:19,height_mm:10,source:'https://eshop.wuerth.de/Hexagonal-nut-DIN-934-zinc-plated-I8I-steel-with-thick-layer-passivation-VZD-NUT-HEX-DIN934-I8I-WS19-VZD-M12/0317512.sku/en/US/EUR/'};
 const socket={diameter_mm:26,height_mm:30,source:'https://www.wera.de/en/tools/8790-hmb-zyklop-socket-with-3-8-drive'};
 const threadProjection=4;
 const head=[{...washer,start_mm:0},
  {...nut,diameter_mm:nut.width_across_flats_mm/Math.cos(Math.PI/6),start_mm:washer.height_mm},
  {diameter_mm:diameter,height_mm:threadProjection,start_mm:washer.height_mm+nut.height_mm}];
 const clip=(solid,planes)=>solid.faces.flatMap(face=>planes.reduce(clipContactFace,face));
 const rows=members.filter(m=>m.family==='mauerlat'&&m.support_id).map(member=>{
  const run=runs.find(r=>r.id===member.support_id);
  const axis=run.axis,cross=1-axis;
  const lo=run.bounds_mm[axis],hi=run.bounds_mm[axis+2],crossPosition=member.a_mm[cross];
  const top=member.a_mm[2]+member.height_mm/2;
  const timber=solids.filter(s=>s.id===member.id+'-piece1');
  const washerRadius=washer.diameter_mm/2;
  const timberStart=Math.min(...timber.map(s=>s.bounds[axis])),timberEnd=Math.max(...timber.map(s=>s.bounds[axis+3]));
  const nearby=solids.filter(s=>s.id!==member.id+'-piece1'&&s.bounds[axis]<=hi+washerRadius&&s.bounds[axis+3]>=lo-washerRadius&&
   s.bounds[cross]<=crossPosition+washerRadius&&s.bounds[cross+3]>=crossPosition-washerRadius&&s.bounds[5]>run.top_mm+roofContactTolerance);
  const across=[0,0,0];across[cross]=1;
  const strip=r=>[[...across,r-crossPosition],[...across.map(v=>-v),crossPosition+r]];
  const blockedIntervals=(r,z0,z1)=>nearby.filter(s=>s.bounds[2]<=z1&&s.bounds[5]>=z0).flatMap(s=>{
   const stations=clip(s,[...strip(r),[0,0,1,-z0],[0,0,-1,z1]]).map(p=>p[axis]);
   return stations.length?[{part_id:s.id,range_mm:[Math.min(...stations),Math.max(...stations)]}]:[];
  });
  const obstacles=blockedIntervals(radius,run.top_mm,top);
  const envelopeObstacles=({diameter_mm,height_mm,start_mm})=>{
   const r=diameter_mm/2;
   return blockedIntervals(r,top+start_mm,top+start_mm+height_mm).map(o=>({...o,radius_mm:r}));
  };
  const headObstacles=head.flatMap(envelopeObstacles);
  const socketObstacles=envelopeObstacles({...socket,start_mm:washer.height_mm});
  const count=Math.ceil((hi-lo)/spacing);
  const clearanceFrom=(station,intervals)=>Math.min(...intervals.map(({radius_mm:r,range_mm:[a,b]})=>Math.max(a-station,station-b)-r));
  const shaftClearance=station=>Math.min(station-lo,hi-station,
   ...obstacles.map(({range_mm:[a,b]})=>Math.max(a-station,station-b)))-radius;
  const hardwareClearance=station=>Math.min(station-timberStart-washerRadius,timberEnd-station-washerRadius,
   clearanceFrom(station,headObstacles));
  const socketFits=station=>clearanceFrom(station,socketObstacles)>=roofContactTolerance;
  const score=station=>Math.min(shaftClearance(station),hardwareClearance(station));
  let best=null;
  // Try the maximum count first. A shorter row keeps the same internal
  // pitch and may put the first or last axis farther from the belt ends.
  for(let size=count;size>=Math.max(1,count-1)&&!best;size--){
   const lastOffset=(size-1)*spacing;
   for(let first=Math.max(lo+radius,hi-spacing-lastOffset);first<=Math.min(lo+spacing,hi-radius-lastOffset);first++){
    const stations=Array.from({length:size},(_,i)=>first+i*spacing);
    const clearance=Math.min(...stations.map(score));
    if(clearance<roofContactTolerance)continue;
    const covered=stations.filter(station=>!socketFits(station)).length;
    if(!best||covered<best.covered||(covered===best.covered&&clearance>best.clearance+1e-7))best={stations,clearance,covered};
   }
  }
  const longitudinalBars=[0,1,2].map(i=>run.bounds_mm[cross]+sideOffset+i*barSpacing);
  const along=[0,0,0];along[axis]=1;
  const stations=MODEL.roof_frame.south_hip_connection?.plate_anchor_stations_mm[member.id]??best?.stations??[];
  const anchors=stations.map(station=>{
   const point=axis===0?[station,crossPosition,top]:[crossPosition,station,top];
   const toolRadius=socket.diameter_mm/2;
   const shaft=[...strip(toolRadius),[...along,toolRadius-station],[...along.map(v=>-v),station+toolRadius],
    [0,0,1,-top-washer.height_mm]];
   let overhead=null;
   for(const solid of nearby.filter(s=>s.bounds[axis]<=station+toolRadius&&s.bounds[axis+3]>=station-toolRadius)){
    const vertices=clip(solid,shaft);
    const gap=Math.min(...vertices.map(p=>p[2]-top-washer.height_mm));
    if(Number.isFinite(gap)&&(!overhead||gap<overhead.gap))overhead={id:solid.id,gap};
   }
   return {top_point_mm:point,offset_from_belt_start_mm:station-lo,
    socket_headroom_mm:overhead?.gap??null,overhead_part_id:overhead?.id??null,socket_fits_final_frame:socketFits(station),
    conservative_hardware_clearance_mm:hardwareClearance(station)};
  });
  let crossbarPhase=null;
  if(anchors.length){
   const crossbarRadius=crossbarDiameter/2,length=hi-lo;
   for(let phase=Math.ceil(crossbarRadius);phase<crossbarSpacing&&phase<=length-crossbarRadius;phase++){
    const last=phase+Math.floor((length-phase)/crossbarSpacing)*crossbarSpacing;
    if(length-last<crossbarRadius)continue;
    const axisDistance=Math.min(...anchors.map(a=>{
     const delta=(phase-a.offset_from_belt_start_mm)%crossbarSpacing;
     return Math.min(Math.abs(delta),crossbarSpacing-Math.abs(delta));
    }));
    if(!crossbarPhase||axisDistance>crossbarPhase.minimum_axis_distance_mm)crossbarPhase={phase_from_belt_start_mm:phase,
     minimum_axis_distance_mm:axisDistance,radial_clearance_mm:axisDistance-radius-crossbarRadius};
   }
  }
  return {member_id:member.id,belt_id:run.id,axis,anchors,maximum_grid_count:count,obstacles,
   belt_range_mm:[lo,hi],top_of_belt_mm:run.top_mm,cage_section_status:run.section_status,crossbar_phase_probe:crossbarPhase,
   near_concrete_side_mm:Math.min(crossPosition-run.bounds_mm[cross],run.bounds_mm[cross+2]-crossPosition),
   straight_longitudinal_bar_clearance_mm:Math.min(...longitudinalBars.map(p=>Math.abs(p-crossPosition)))-radius-barDiameter/2,
   conservative_lengthwise_clearance_mm:stations.length?Math.min(...stations.map(shaftClearance)):null};
 });
 return {status:'geometric_screen_not_anchor_layout',input_fact_ids:inputFactIds,diameter_mm:diameter,spacing_mm:spacing,
  washer_probe:washer,nut_probe:nut,thread_projection_probe_mm:threadProjection,socket_probe:socket,
  top_bar_axis_depth_mm:barDepth,crossbar_spacing_mm:crossbarSpacing,
  crossbar_axis_collision_distance_mm:(diameter+crossbarDiameter)/2,rows};
}

function roofBedAnchorScreen(members,solids){
 const inputFactIds=['roof.post_support.anchor_diameter','roof.post_support.anchor_spacing'];
 const [diameter,spacing]=inputFactIds.map(n),radius=diameter/2;
 const beds=new Map(solids.filter(s=>s.family==='beds').map(s=>[s.id,s]));
 const outline=MODEL.slab2.outer_polygon_mm.map(p=>p.map(Number));
 const perimeter=outline.map((a,i)=>[a,outline[(i+1)%outline.length]]);
 const boundaryFor=slab=>[
  {id:'slab-perimeter',edges:perimeter},
  ...[slab.opening,...slab.holes].map(hole=>{
   const polygon=roofContactRect(hole.bounds_mm.map(Number));
   return {id:hole.id,edges:polygon.map((a,i)=>[a,polygon[(i+1)%polygon.length]])};
  }),
 ];
 const boundaryByVariant=MODEL.slab2.variants.map(slab=>[slab.id,boundaryFor(slab)]);
 const distanceToEdge=([x,y],[[ax,ay],[bx,by]])=>{
  const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/lengthSquared)):0;
  return Math.hypot(x-ax-t*dx,y-ay-t*dy);
 };
 const rows=members.filter(m=>m.family==='beds').map(bed=>{
  const [x0,y0,,x1,y1,top]=beds.get(bed.id+'-piece1').bounds;
  const supports=members.filter(m=>m.bed_id===bed.id);
  const trial=bed.anchor_trial;
  const y=trial?.y_mm??(supports.length===1?supports[0].a_mm[1]:(y0+y1)/2);
  const sideDistance=Math.min(y-y0,y1-y);
  const posts=supports.flatMap(m=>{
   const bases=solids.filter(s=>s.id===m.id+'-piece1'&&Math.abs(s.bounds[2]-top)<roofContactTolerance&&
    s.bounds[1]<=y+radius&&s.bounds[4]>=y-radius);
   return bases.length?[{member_id:m.id,range_mm:[Math.min(...bases.map(s=>s.bounds[0])),Math.max(...bases.map(s=>s.bounds[3]))]}]:[];
  });
  const axisSpan=x1-x0-diameter;
  const score=x=>Math.min(x-x0,x1-x,
   ...posts.map(({range_mm:[a,b]})=>Math.max(a-x,x-b)))-radius;
  const toolBlocking=(x)=>{
   const extent=trial.tool_radius_mm+trial.placement_tolerance_mm;
   const box=roofContactPrism('bed-anchor-tool','probe',roofContactRect([x-extent,y-extent,x+extent,y+extent]),
    [0,0,top],[0,0,top+trial.tool_height_mm+8]);
   return [...new Set(solids.filter(s=>s.id!==bed.id+'-piece1'&&measureRoofContact(box,s)?.volume_mm3>0).map(s=>s.id))];
  };
  let best=null;
  // The search starts at a pair, as drawn on KD-3, and leaves the phase of the pitch free.
  // First keep as many full pitches as fit, then maximize clearance from timber ends and posts.
  for(let size=Math.floor(axisSpan/spacing)+1;!trial&&size>=2&&!best&&sideDistance>radius;size--){
   const offset=(size-1)*spacing;
   for(let first=Math.ceil(x0+radius);first<=x1-radius-offset;first++){
    const stations=Array.from({length:size},(_,i)=>first+i*spacing);
    const clearance=Math.min(...stations.map(score));
    if(clearance>roofContactTolerance&&(!best||clearance>best.clearance))best={stations,clearance};
   }
  }
  const stations=trial?.x_mm??best?.stations??[];
  const anchors=stations.map(x=>{
   const point=[x,y,top];
   const concrete=Object.fromEntries(boundaryByVariant.map(([id,boundary])=>[id,boundary
    .map(({id,edges})=>({feature_id:id,axis_distance_mm:Math.min(...edges.map(edge=>distanceToEdge(point,edge)))}))
    .sort((a,b)=>a.axis_distance_mm-b.axis_distance_mm)[0]]));
   const planes=[[1,0,0,radius-x],[-1,0,0,radius+x],[0,1,0,radius-y],[0,-1,0,radius+y],[0,0,1,-top]];
   const overhead=solids.filter(s=>s.bounds[0]<=x+radius&&s.bounds[3]>=x-radius&&
    s.bounds[1]<=y+radius&&s.bounds[4]>=y-radius&&s.bounds[5]>top+roofContactTolerance)
    .map(s=>({id:s.id,gap_mm:Math.max(0,Math.min(...s.faces.flatMap(face=>planes.reduce(clipContactFace,face)).map(p=>p[2]-top)))}))
    .filter(s=>Number.isFinite(s.gap_mm)).sort((a,b)=>a.gap_mm-b.gap_mm)[0]??null;
   const result={top_point_mm:point,longitudinal_clearance_mm:score(x),nearest_concrete_edge:concrete,overhead};
   if(trial)result.tool_blocking_ids=toolBlocking(x);
   return result;
  });
  return {member_id:bed.id,length_mm:x1-x0,maximum_axis_span_mm:axisSpan,side_axis_distance_mm:sideDistance,
   anchor_line_rule:trial?'partition_clearance':supports.length===1?'single_post_axis':'bed_centreline',posts,anchors};
 });
 return {status:'geometric_screen_not_anchor_layout',input_fact_ids:inputFactIds,diameter_mm:diameter,spacing_mm:spacing,rows};
}

function roofBedUpliftBounds(members,solids,bedAnchors,postBearings){
 const load=1,rollMoment=1;
 const rows=bedAnchors.rows.flatMap(row=>{
  if(row.anchors.length<2)return [];
  const bed=members.find(m=>m.id===row.member_id),partId=bed.id+'-piece1';
  const slabBearing=bed.slab_bearings[activeSlab().id];
  if(Math.abs(slabBearing.sole_area_mm2-slabBearing.area_mm2)>roofContactTolerance)return [];
  const [x0,y0,,x1,y1]=solids.find(s=>s.id===partId).bounds;
  const [west,y]=row.anchors[0].top_point_mm,[east]=row.anchors.at(-1).top_point_mm;
  const posts=postBearings.filter(p=>p.lower.part_ids.includes(partId)).map(post=>{
   const [px,py]=post.lower.centre_xy_mm;
   // Compression is free to act anywhere on the sole. Its resultant must move
   // the combined uplift and bearing line onto the anchor segment.
   const cx=load*Math.max(0,(west-px)/(x1-west),(px-east)/(east-x0));
   const cy=load*Math.max(0,(y-py)/(y1-y),(py-y)/(y-y0));
   const bearing=Math.max(cx,cy);
   return {post_id:post.post_id,load_xy_mm:[px,py],
    minimum_bearing_x_kn:cx,minimum_bearing_y_kn:cy,minimum_bearing_kn:bearing,
    minimum_anchor_group_tension_kn:load+bearing};
  });
  return {bed_id:bed.id,sole_bounds_xy_mm:[x0,y0,x1,y1],anchor_line_mm:{west_x_mm:west,east_x_mm:east,y_mm:y},
   posts,minimum_anchor_tension_under_roll_kn:{south_toe:rollMoment*1000/(y-y0),north_toe:rollMoment*1000/(y1-y)}};
 });
 return {status:'static_lower_bound_for_isolated_bed_without_stiffness_or_preload',one_post_uplift_kn:load,
  independent_moment_about_bed_axis_knm:rollMoment,rows};
}

function roofPostBedConnectors(members,solids){
 const catalogue=MODEL.roof_frame.post_bed_connector;
 const {flange_mm:length,width_mm:width,thickness_mm:thickness,nail_length_mm:nailLength}=catalogue;
 const partIds=new Map();
 const context=solids.filter(s=>['beds','posts','wall'].includes(s.family));
 for(const solid of context){
  if(!partIds.has(solid.id))partIds.set(solid.id,[]);
  partIds.get(solid.id).push(solid);
 }
 const rows=members.filter(m=>m.bed_id).map(post=>{
  const postId=post.id+'-piece1',bedId=post.bed_id+'-piece1';
  const postSolids=partIds.get(postId),bedSolids=partIds.get(bedId);
  const [bx,by,,ex,ey,z]=bedSolids[0].bounds;
  const y=post.a_mm[1];
  const base=postSolids.filter(s=>Math.abs(s.bounds[2]-z)<roofContactTolerance);
  const postWest=Math.min(...base.map(s=>s.bounds[0])),postEast=Math.max(...base.map(s=>s.bounds[3]));
  const sides=[-1,1].map(direction=>{
   const x=direction<0?postWest:postEast;
   const shape=(reach,bottom,top)=>roofContactPrism('angle','metal',
    roofContactRect([Math.min(x,x+direction*reach),y-width/2,Math.max(x,x+direction*reach),y+width/2]),
    [0,0,z+bottom],[0,0,z+top]);
   const flanges=[shape(length,0,thickness),shape(thickness,thickness,length)];
   const obstacles=[...new Set(context.filter(s=>s.id!==postId&&s.id!==bedId&&flanges.some(flange=>
    flange.bounds.every((edge,i)=>i<3?edge<s.bounds[i+3]:edge>s.bounds[i-3])&&
     measureRoofContact(s,flange)?.volume_mm3)).map(s=>s.id))];
   const nail=(point,axis,parts)=>({wood_start_mm:point,direction:axis,
    wood_depth_mm:Math.min(nailLength-thickness,timberDepthFrom(point,axis,parts))});
   const postNails=catalogue.post_hole_rows_mm.flatMap(([offset,height])=>[-1,1].map(sign=>
    nail([x,y+sign*offset,z+height],[-direction,0,0],postSolids)));
   const bedNails=catalogue.bed_hole_rows_mm.flatMap(([offset,extent])=>[-1,1].map(sign=>
    nail([x+direction*extent,y+sign*offset,z],[0,0,-1],bedSolids)));
   const overhang=direction<0?x-bx:ex-x;
   const fullFoot=overhang>=length-roofContactTolerance&&y-width/2>=by&&y+width/2<=ey;
   return {side:direction<0?'west':'east',point_mm:[x,y,z],bed_extension_mm:overhang,full_bed_foot:fullFoot,
    adjacent_timber_ids:obstacles.filter(id=>partIds.get(id)[0].family!=='wall'),
    partition_ids:obstacles.filter(id=>partIds.get(id)[0].family==='wall'),post_nails:postNails,bed_nails:bedNails};
  });
  return {post_id:post.id,bed_id:post.bed_id,sides};
 });
 return {catalogue,status:'geometric_fit_without_capacity_approval',rows};
}

function roofStairBasePlateAudit(members,solids,pairs){
 const catalogue=MODEL.roof_frame.stair_base_plate;
 const depth=catalogue.nail_length_mm-catalogue.thickness_mm;
 const seat=members.find(m=>m.id==='bed-stair-row');
 const seatZ=seat.a_mm[2]+seat.height_mm/2;
 const holeArea=Math.PI*(catalogue.hole_diameter_mm/2)**2;
 const rows=members.filter(m=>m.post_base_plate).map(plate=>{
  const {post_id:postId,bed_id:bedId,side,face_y_mm:y}=plate.post_base_plate;
  const x=(plate.a_mm[0]+plate.b_mm[0])/2,z=plate.a_mm[2];
  const direction=[0,side==='north'?-1:1,0];
  const contact=pairs.filter(p=>p.ids.includes(plate.id+'-piece1')&&p.area_mm2>0);
  const check=(id,holes)=>{
   const partId=id+'-piece1',timber=solids.filter(s=>s.id===partId);
   const envelope=contact.find(p=>p.ids.includes(partId))?.area_mm2??0;
   const holeCount=catalogue.hole_rows_xz_mm.filter(([height])=>(z+height<seatZ)===(id===bedId))
    .reduce((sum,[,columns])=>sum+columns.length,0);
   return {member_id:id,contact_envelope_mm2:envelope,nominal_net_contact_mm2:Math.max(0,envelope-holeCount*holeArea),
    nails:holes.flatMap(([height,columns])=>columns.map(column=>{
     const point=[x+column,y,z+height];
     return {wood_start_mm:point,direction,wood_depth_mm:Math.min(depth,timberDepthFrom(point,direction,timber))};
    }))};
  };
  return {plate_id:plate.id,post:check(postId,catalogue.post_nail_rows_xz_mm),
   bed:check(bedId,catalogue.bed_nail_rows_xz_mm),partition_ids:contact.filter(p=>p.family.includes('wall'))
    .map(p=>p.ids.find(id=>id!==plate.id+'-piece1'))};
 });
 return {catalogue,rows,status:'perforated_plate_geometry_screen_without_capacity_approval'};
}

function scanRoofContacts(){
 const key=activeSlab().id;
 if(roofContactReports.has(key))return roofContactReports.get(key);
 const frameMembers=roofFrameMembers();
 const solids=[];
 const parts=[];
 const cadFittings=[];
 for(const member of frameMembers){
  if(member.family==='eave-connectors'){
   cadFittings.push({id:member.id,triangles:member.cad_mesh.triangles.length});
   continue;
  }
  const fragments=frameDisplaySolids(member);
  const pieceIds=framePieces(member).map(p=>p.id);
  for(const id of pieceIds)parts.push({id,member:member.id,family:member.family,fragments:fragments.filter(p=>p.axis_piece_id===id).length});
  for(const p of fragments)solids.push(roofContactSolid(p.axis_piece_id,member.family,p.faces));
 }
 const frameFragments=solids.length;
 const steelFragments=solids.filter(p=>['tie-shims','ridge-plates','dormer-transfer'].includes(p.family)).length;
 const rect=(...bounds)=>roofContactRect(bounds);
 for(const mesh of MODEL.floor2.mesh_prisms)for(const p of wallDisplayPieces(mesh))solids.push(roofContactPrism(p.wall_id,'wall',p.polygon_mm,p.bottom_plane,p.top_plane));
 const belt=MODEL.floor2.roof_belt;
 const beltSolid=(run,family)=>roofContactPrism(run.id,family,rect(...run.bounds_mm),[0,0,run.bottom_mm],[0,0,run.top_mm]);
 const concrete=new Map(belt.runs.map(run=>[run.id,beltSolid(run,'belt')]));
 const insulation=new Map(belt.insulation.map(strip=>[strip.run_id,roofBeltInsulationPrisms(strip)
  .map(p=>roofContactPrism(strip.id,'insulation',p.polygon_mm,p.bottom_plane,p.top_plane))]));
 const masonryIds=new Set(MODEL.floor2.walls.filter(w=>w.material==='aac').map(w=>w.id));
 const masonry=solids.filter(s=>masonryIds.has(s.id));
 const eaves=MODEL.floor2.eave_wall_heads.map(({run_id})=>{
  const beam=concrete.get(run_id),strip=insulation.get(run_id);
  const [x0,y0,z0,x1,y1,z1]=beam.bounds;
  const axis=belt.runs.find(run=>run.id===run_id).axis;
  const runSide=beam.bounds[axis+3]-beam.bounds[axis];
  const below=masonry.filter(s=>s.bounds[2]<z0&&s.bounds[5]>=z0-roofContactTolerance&&
   [0,1].every(i=>Math.min(beam.bounds[i+3],s.bounds[i+3])-Math.max(beam.bounds[i],s.bounds[i])>roofContactTolerance));
  const wallContact={area_mm2:0,volume_mm3:0,expected_mm2:(x1-x0)*(y1-y0)};
  for(const wall of below){
   const hit=measureRoofContact(beam,wall);
   if(hit){wallContact.area_mm2+=hit.area_mm2;wallContact.volume_mm3+=hit.volume_mm3;}
  }
  const stripContact={area_mm2:0,volume_mm3:0,expected_mm2:runSide*(z1-z0)};
  for(const piece of strip){
   const hit=measureRoofContact(beam,piece);
   if(hit){stripContact.area_mm2+=hit.area_mm2;stripContact.volume_mm3+=hit.volume_mm3;}
  }
  return {belt_id:run_id,masonry:wallContact,insulation:stripContact};
 });
 solids.push(...concrete.values(),...[...insulation.values()].flat());
 for(const r of activeSlab().disjoint_rectangles_mm)solids.push(roofContactPrism('Пм1','slab',rect(...r.map(Number)),[0,0,+MODEL.slab2.bottom_mm],[0,0,+MODEL.slab2.top_mm]));
 for(const body of MODEL.floor1.brick_envelopes){
  const [x0,y0,z0,x1,y1,z1]=ventBodyBounds(body);
  solids.push(roofContactPrism('ВК-'+body.id.slice(4),'vent',rect(x0,y0,x1,y1),[0,0,z0],[0,0,z1]));
 }
 for(const row of MODEL.roof_geometry.shaft_finishes.rows)for(const p of row.insulation.prisms)
  solids.push(roofContactPrism(row.label+' · утепление','vent',p.polygon_mm,p.bottom_plane,p.top_plane));
 solids.sort((a,b)=>a.bounds[0]-b.bounds[0]);
 const support=new Set(['wall','belt','insulation','slab','vent']);
 const results=new Map();
 let candidates=0;
 for(let i=0;i<solids.length;i++){
  const a=solids[i];
  for(let j=i+1;j<solids.length&&solids[j].bounds[0]<=a.bounds[3]+roofContactTolerance;j++){
   const b=solids[j];
   if(a.id===b.id||support.has(a.family)&&support.has(b.family))continue;
   candidates++;
   const hit=measureRoofContact(a,b);
   if(!hit)continue;
   const ids=a.id<b.id?[a.id,b.id]:[b.id,a.id],id=ids.join('|');
   const family=a.id<b.id?[a.family,b.family]:[b.family,a.family];
   const row=results.get(id)??{ids,family,volume_mm3:0,area_mm2:0,point_mm:hit.point_mm};
   if(hit.volume_mm3){
    if(!row.volume_mm3)row.point_mm=hit.point_mm;
    const bounds=hit.overlap_bounds_mm;
    row.overlap_bounds_mm=row.overlap_bounds_mm?.map((value,i)=>i<3?Math.min(value,bounds[i]):Math.max(value,bounds[i]))??bounds;
   }
   row.volume_mm3+=hit.volume_mm3;
   row.area_mm2+=hit.area_mm2;
   results.set(id,row);
  }
 }
 const pairs=[...results.values()].map(r=>r.volume_mm3?{...r,area_mm2:0}:r).sort((a,b)=>b.volume_mm3-a.volume_mm3||b.area_mm2-a.area_mm2);
 const cornerSupports=frameMembers.filter(m=>m.corner_plate_ids).map(roofCornerSupport);
 const gable=MODEL.roof_frame.north_gable_ridge;
 let northGableRidge=null;
 if(gable?.recess_depth_mm>0){
  const [x0,y0,z0,x1,y1,z1]=gable.recess_bounds_mm;
  const recess=roofContactPrism('ridge-recess','wall',rect(x0,y0,x1,y1),[0,0,z0],[0,0,z1]);
  const original=MODEL.floor2.mesh_prisms.filter(m=>m.wall_id===gable.wall_id)
   .flatMap(mesh=>wallDisplayPieces(mesh,{ridgeRecess:false}))
   .map(p=>roofContactPrism(p.wall_id,'wall',p.polygon_mm,p.bottom_plane,p.top_plane));
  const volumeWithWall=solid=>original.reduce((sum,part)=>sum+(measureRoofContact(solid,part)?.volume_mm3??0),0);
  const plates=solids.filter(p=>gable.plate_ids.includes(p.id.replace(/-piece1$/,'')));
  northGableRidge={...gable,removed_volume_mm3:volumeWithWall(recess),
   prior_overlap_mm3:plates.reduce((sum,p)=>sum+volumeWithWall(p),0)};
 }
 const postBearings=roofPostBearings(pairs,frameMembers,solids);
 const bedAnchors=roofBedAnchorScreen(frameMembers,solids);
 const tieInterfaces=roofTieInterfaces(frameMembers);
 const rafterStock=roofRafterStockReport();
 const seatCuts=roofSeatCuts(pairs,frameMembers,solids);
 const ridgeSupportChain=roofRidgeSupportChain(frameMembers,solids,postBearings);
 const vk2Span=roofVk2SpanScreen(frameMembers,seatCuts,rafterStock,ridgeSupportChain.main);
 const {field:westField,...westLoads}=roofVk2BattenLoads(frameMembers,solids,pairs,vk2Span,ridgeSupportChain)??{};
 const westBattenLoads=westField?westLoads:null;
 const report={paired:MODEL.roof_frame.display_parameters.paired_purlin_arrangement,slab:key,tolerance_mm:roofContactTolerance,
  parts,pairs,cad_fittings:cadFittings,eave_interfaces:eaves,corner_supports:cornerSupports,tie_interfaces:tieInterfaces,
  tie_fastener_screen:roofTieFastenerScreen(frameMembers,solids,tieInterfaces),rafter_stock:rafterStock,
  seat_cuts:seatCuts,post_bearings:postBearings,ridge_support_chain:ridgeSupportChain,
  nw_diagonal_load_path:roofNwDiagonalLoadPath(frameMembers,solids,pairs,seatCuts,postBearings,rafterStock,westBattenLoads?.northwest_rafter_plan_loads),
  north_hip_batten_screen:roofNorthHipBattenScreen(frameMembers,solids,pairs,rafterStock,vk2Span.uniform_snow_reference,westField),
  vk2_span_screen:vk2Span,vk2_batten_loads:westBattenLoads,
  hip_cleat_fits:roofHipCleatFits(pairs,solids),hip_hanger_catalogue:hipHangerCatalogue,
  plate_anchor_screen:roofPlateAnchorScreen(frameMembers,belt.runs,solids),
  bed_anchor_screen:bedAnchors,
  bed_uplift_bounds:roofBedUpliftBounds(frameMembers,solids,bedAnchors,postBearings),
  post_bed_connectors:roofPostBedConnectors(frameMembers,solids),
  stair_base_plates:roofStairBasePlateAudit(frameMembers,solids,pairs),
  ridge_plate_screen:roofRidgePlateScreen(frameMembers,solids),north_gable_ridge:northGableRidge,
  vk2_rafter_connector:roofVk2RafterConnector(frameMembers,solids),
  timber_fragments:frameFragments-steelFragments,steel_fragments:steelFragments,context_fragments:solids.length-frameFragments,candidate_fragment_pairs:candidates};
 roofContactReports.set(key,report);
 return report;
}

return { scanRoofContacts, roofRafterStockReport };
}
