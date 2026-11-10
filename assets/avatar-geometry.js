/* Original visual morphs and procedural clothing; licensed CC0 base data documented separately.
 * Reference geometry, never a body scan or accurate fit inference. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1AvatarGeometry=api;})(globalThis,()=>{
 const defaults={height:170,chest:92,waist:76,hips:96,shoulders:42,inseam:78,shape:'neutral'};
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 let humanBase=null;
 function installBase(data){
  if(!data||data.version!==1||data.license!=='CC0-1.0'||data.height!==1.7||!Array.isArray(data.positions)||data.positions.length<3000||data.positions.length>120000||data.positions.length%3||!Array.isArray(data.indices)||data.indices.length<3000||data.indices.length>180000||data.indices.length%3||!Array.isArray(data.arms)||data.arms.length!==data.positions.length/3)throw TypeError('invalid_human_base');
  const count=data.positions.length/3;if(data.positions.some((v,i)=>!Number.isFinite(v)||Math.abs(v)>2||i%3===1&&(v<0||v>1.701))||data.indices.some(v=>!Number.isSafeInteger(v)||v<0||v>=count)||data.arms.some(v=>!Number.isFinite(v)||v<0||v>1))throw TypeError('invalid_human_base');
  humanBase={positions:new Float32Array(data.positions),indices:new Uint16Array(data.indices),arms:new Float32Array(data.arms)};return true;
 }
 const hasHumanBase=()=>humanBase!==null;
 function garmentShell(body,normals,style,height){
  // One shared shoulder/torso/upper-arm topology, cut to a garment pattern.
  // These are generic example tops, never a retail pattern or cloth solver.
  const loose=style==='LAB-B',cropped=style==='LAB-C',hem=cropped?1.02:loose?.80:.83,cuff=loose?1.22:1.27,neck=1.435;
  const scale=height/1.7,ease=(loose?.028:.012)*scale,minimum=.006*scale;
  const positions=[],anchors=[],support=[],source=[],clearances=[],indices=[],original=new Map(),cuts=new Map(),distance=[];
  for(let i=0;i<humanBase.positions.length;i+=3){
   const x=humanBase.positions[i],y=humanBase.positions[i+1],z=humanBase.positions[i+2],arm=clamp((humanBase.arms[i/3]-.05)/.25,0,1),front=clamp((z+.06)/.10,0,1),innerNeck=Math.exp(-Math.pow(x/(loose?.085:.075),2));
   distance.push(Math.min(y-(hem+(cuff-hem)*arm),neck-(cropped?.07:.065)*front*innerNeck-y));
  }
  function add(a,b=a,t=0){
   const id=positions.length/3,n=[],point=[];for(let k=0;k<3;k++){n.push(normals[a*3+k]+(normals[b*3+k]-normals[a*3+k])*t);point.push(body[a*3+k]+(body[b*3+k]-body[a*3+k])*t);}const length=Math.hypot(...n)||1;for(let k=0;k<3;k++)n[k]/=length;
   // Limit ease where a nearby opposing body surface leaves little room,
   // e.g. an upper arm close to a narrow torso. Inflating both sides uniformly
   // can push a loose top into the arm even with a positive own-body tangent.
   let localEase=ease;const reach=.09*scale,radiusSquared=Math.pow(.012*scale,2);for(let j=0;j<body.length;j+=3){
    const dx=body[j]-point[0],dy=body[j+1]-point[1],dz=body[j+2]-point[2];if(Math.abs(dx)>reach||Math.abs(dy)>reach||Math.abs(dz)>reach||n[0]*normals[j]+n[1]*normals[j+1]+n[2]*normals[j+2]>-.3)continue;
    const along=dx*n[0]+dy*n[1]+dz*n[2];if(along>minimum&&dx*dx+dy*dy+dz*dz-along*along<radiusSquared)localEase=Math.min(localEase,Math.max(minimum,(along-.004*scale)*.4));
   }clearances.push(localEase);
   for(let k=0;k<3;k++){anchors.push(point[k]);support.push(n[k]);positions.push(point[k]+n[k]*localEase);source.push(humanBase.positions[a*3+k]+(humanBase.positions[b*3+k]-humanBase.positions[a*3+k])*t);}return id;
  }
  const vertex=a=>{if(!original.has(a))original.set(a,add(a));return original.get(a);};
  function cut(a,b){const key=a<b?a+':'+b:b+':'+a;if(!cuts.has(key)){const t=distance[a]/(distance[a]-distance[b]);cuts.set(key,t<1e-8?vertex(a):t>1-1e-8?vertex(b):add(a,b,t));}return cuts.get(key);}
  for(let i=0;i<humanBase.indices.length;i+=3){
   const polygon=[];for(let j=0;j<3;j++){const a=humanBase.indices[i+j],b=humanBase.indices[i+(j+1)%3],inside=distance[a]>=0,next=distance[b]>=0;if(inside)polygon.push(vertex(a));if(inside!==next)polygon.push(cut(a,b));}
   for(let j=1;j<polygon.length-1;j++)if(new Set([polygon[0],polygon[j],polygon[j+1]]).size===3)indices.push(polygon[0],polygon[j],polygon[j+1]);
  }
  const count=positions.length/3,neighbors=Array.from({length:count},()=>new Set()),edges=new Map();
  for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const a=indices[i+j],b=indices[i+(j+1)%3],key=a<b?a+':'+b:b+':'+a;neighbors[a].add(b);neighbors[b].add(a);edges.set(key,(edges.get(key)||0)+1);}
  const boundary=new Set(),boundaryNeighbors=new Map();for(const [key,count]of edges)if(count===1){const [a,b]=key.split(':').map(Number);for(const [id,other]of [[a,b],[b,a]]){boundary.add(id);if(!boundaryNeighbors.has(id))boundaryNeighbors.set(id,[]);boundaryNeighbors.get(id).push(other);}}
  const loops=[],visited=new Set();for(const id of boundary){if(visited.has(id))continue;const ids=[],stack=[id];visited.add(id);while(stack.length){const current=stack.pop();ids.push(current);for(const next of boundaryNeighbors.get(current))if(!visited.has(next)){visited.add(next);stack.push(next);}}
   const y=ids.reduce((sum,id)=>sum+source[id*3+1],0)/ids.length,x=ids.reduce((sum,id)=>sum+source[id*3],0)/ids.length,kind=y<hem+.08?'hem':Math.abs(x)>.12?'cuff':'neck';loops.push({kind,indices:ids});
  }
  // Smooth anatomical detail into fabric ease while constraining every vertex
  // outside its corresponding body tangent. Shared seam vertices cannot split.
  for(let pass=0;pass<14;pass++){
   const next=positions.slice();for(let i=0;i<count;i++){
    const ids=neighbors[i],blend=boundary.has(i)?.16:.38;for(let k=0;k<3;k++){let sum=0;for(const id of ids)sum+=positions[id*3+k];next[i*3+k]=positions[i*3+k]*(1-blend)+sum/ids.size*blend;}
    let gap=0;for(let k=0;k<3;k++)gap+=(next[i*3+k]-anchors[i*3+k])*support[i*3+k];
    if(gap<clearances[i])for(let k=0;k<3;k++)next[i*3+k]+=support[i*3+k]*(clearances[i]-gap);
   }for(let i=0;i<positions.length;i++)positions[i]=next[i];
  }
  for(const loop of loops)if(loop.kind==='hem'||loop.kind==='cuff'){
   const y=loop.indices.reduce((sum,id)=>sum+anchors[id*3+1],0)/loop.indices.length;
   for(const id of loop.indices){const i=id*3;positions[i+1]=y;let gap=0;for(let k=0;k<3;k++)gap+=(positions[i+k]-anchors[i+k])*support[i+k];const radial=support[i]*support[i]+support[i+2]*support[i+2];if(gap<clearances[id]&&radial>1e-5)for(const k of [0,2])positions[i+k]+=support[i+k]*(clearances[id]-gap)/radial;}
  }
  // Recompute normals on the final sewn shell, including the shoulder/armhole.
  const normal=new Float32Array(positions.length);for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,u=[0,1,2].map(k=>positions[b+k]-positions[a+k]),v=[0,1,2].map(k=>positions[c+k]-positions[a+k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   for(const id of [a,b,c])for(let k=0;k<3;k++)normal[id+k]+=n[k];
  }
  for(let i=0;i<normal.length;i+=3){const length=Math.hypot(normal[i],normal[i+1],normal[i+2]);for(let k=0;k<3;k++)normal[i+k]=length>1e-12?normal[i+k]/length:support[i+k];}
  // A narrow binding follows the actual open neckline, cuffs and hem. It does
  // not add a detached collar tube or cap any opening.
  const binding=new Float32Array(count);for(const id of boundary){binding[id]=1;for(const adjacent of neighbors[id])binding[adjacent]=Math.max(binding[adjacent],.45);}
  return {positions:new Float32Array(positions),normals:normal,indices:new Uint16Array(indices),bodyPositions:new Float32Array(anchors),bodyNormals:new Float32Array(support),sourcePositions:new Float32Array(source),binding,boundaries:loops,minimumClearance:minimum,ease,kind:'connected-example-top'};
 }
 function validate(value){const ranges={height:[120,220],chest:[60,160],waist:[45,160],hips:[60,180],shoulders:[28,65],inseam:[40,110]};
  if(!value||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw TypeError('invalid_measurements');
  const out={};for(const [key,[min,max]]of Object.entries(ranges)){if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw TypeError('invalid_measurements');out[key]=value[key];}
  if(out.inseam>out.height*.6||!['neutral','straight','curved'].includes(value.shape))throw TypeError('invalid_proportions');return {...out,shape:value.shape};
 }
 function photoReference(metrics){
  if(!metrics||Object.keys(metrics).sort().join(',')!=='legTorsoRatio,shoulderHipRatio'||!Number.isFinite(metrics.shoulderHipRatio)||metrics.shoulderHipRatio<.45||metrics.shoulderHipRatio>2.5||!Number.isFinite(metrics.legTorsoRatio)||metrics.legTorsoRatio<.6||metrics.legTorsoRatio>3.5)throw TypeError('invalid_photo_reference');
  // Bounded, dimensionless visual deformations of a default/manual base.
  // These coefficients are UI heuristics, not calibrated anthropometry. No
  // waist, girth, depth, height or garment size is inferred from the image.
  return Object.freeze({shoulderHipRatio:metrics.shoulderHipRatio,legTorsoRatio:metrics.legTorsoRatio,
   shoulderScale:clamp(metrics.shoulderHipRatio/1.35,.78,1.25),legScale:clamp(Math.pow(metrics.legTorsoRatio/1.7,.35),.88,1.12)});
 }
 function scene(input,garment='none',metrics=null){
  const p=validate(input),reference=metrics==null?null:photoReference(metrics);if(!['none','LAB-A','LAB-B','LAB-C'].includes(garment))throw TypeError('invalid_garment');
  let humanBodyPoints=null,humanBodyNormals=null,garmentMesh=null;
  const vertices=[],skin=[.73,.55,.42],base=[.32,.36,.39],cloth=garment==='LAB-B'?[.18,.32,.50]:garment==='LAB-C'?[.09,.20,.33]:[.12,.26,.43];
  function ellipsoid(center,radius,color,angle=0){const rows=12,cols=20,c=Math.cos(angle),s=Math.sin(angle);
   function point(i,j){const lat=Math.PI*i/rows,lon=2*Math.PI*j/cols,u=[Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)],v=u.map((x,k)=>x*radius[k]),n=u.map((x,k)=>x/radius[k]),len=Math.hypot(...n);const normal=n.map(x=>x/len);
    return [center[0]+c*v[0]-s*v[1],center[1]+s*v[0]+c*v[1],center[2]+v[2],c*normal[0]-s*normal[1],s*normal[0]+c*normal[1],normal[2],...color];}
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=point(i,j),b=point(i+1,j),d=point(i,j+1),e=point(i+1,j+1);vertices.push(...a,...b,...d,...d,...b,...e);}
  }
  function surface(sections,color,{open=false,folds=0}={}){
   // Original connected surfaces along a gently curved axis. Elliptical radii
   // and centers vary continuously at elbows/knees rather than meeting as balls.
   // The folds are a visual material detail, never a cloth-physics calculation.
   const cubic=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
   const rings=[];for(let i=0;i<sections.length-1;i++)for(let j=0;j<5;j++){
    const a=sections[Math.max(0,i-1)],b=sections[i],c=sections[i+1],d=sections[Math.min(sections.length-1,i+2)],t=j/5;
    rings.push([b[0]+(c[0]-b[0])*t,...[1,2,3,4].map(k=>k<3?cubic(a[k],b[k],c[k],d[k],t):Math.max(.003,cubic(a[k],b[k],c[k],d[k],t)))]);
   }rings.push(sections.at(-1));
   const cols=28;
   function point(i,j){const [y,cx,cz,rx,rz]=rings[i],previous=rings[Math.max(0,i-1)],next=rings[Math.min(rings.length-1,i+1)],delta=next[0]-previous[0],dy=Math.abs(delta)<.00001?(delta<0?-.00001:.00001):delta,dx=(next[3]-previous[3])/dy,dz=(next[4]-previous[4])/dy,ax=(next[1]-previous[1])/dy,az=(next[2]-previous[2])/dy,angle=2*Math.PI*j/cols,c=Math.cos(angle),s=Math.sin(angle);
    const wrinkle=1+folds*Math.sin(angle*7+y*27)*Math.sin(Math.PI*i/(rings.length-1));
    const normal=[c/rx,-(ax+c*dx)*c/rx-(az+s*dz)*s/rz,s/rz],length=Math.hypot(...normal);return [cx+rx*c*wrinkle,y,cz+rz*s*wrinkle,...normal.map(v=>v/length),...color];}
   for(let i=0;i<rings.length-1;i++)for(let j=0;j<cols;j++){const a=point(i,j),b=point(i+1,j),c=point(i,j+1),d=point(i+1,j+1);vertices.push(...a,...b,...c,...c,...b,...d);}
   if(!open)for(const [index,sign]of [[0,-1],[rings.length-1,1]])for(let j=0;j<cols;j++){
    const a=point(index,j),b=point(index,j+1),ring=rings[index],center=[ring[1],ring[0],ring[2],0,sign,0,...color];vertices.push(...center,...a,...b);
   }
  }
  const torso=(sections,color,options)=>surface(sections.map(([y,rx,rz])=>[y,0,0,rx,rz]),color,options);
  const h=p.height/100,leg=clamp(p.inseam/100*(reference?.legScale||1),h*.28,h*.56),hipY=leg+.065,shoulderY=h-.29,shoulder=p.shoulders/200*(reference?.shoulderScale||1);
  const chest=p.chest/100/(2*Math.PI),waist=p.waist/100/(2*Math.PI),hips=p.hips/100/(2*Math.PI),shape=p.shape==='curved'?.94:p.shape==='straight'?1.06:1;
  const waistY=hipY+(shoulderY-hipY)*.37,chestY=shoulderY-.09,hipWidth=hips*1.13,waistWidth=waist*1.12*shape,chestWidth=Math.max(chest*1.17*(reference?.shoulderScale||1),shoulder*.96);
  const bodySections=[[hipY-.055,hipWidth*.94,hips*.8],[hipY,hipWidth,hips*.84],[waistY,waistWidth,waist*.86],[chestY,chestWidth,chest*.82],[shoulderY,shoulder,chest*.76],[h-.235,.065,.065]];
  ellipsoid([0,-.015,0],[.48,.025,.32],[.78,.79,.73]);
  if(humanBase){
   // Original visual morphing of a licensed generic body. Circumferences are
   // visual controls, not calibrated girth/size reconstruction from a photo.
   const sourceY=[0,.8335,.987,1.211,1.374,1.441,1.7],targetY=[0,hipY,waistY,chestY,shoulderY,h-.235,h];
   const width=[p.hips/96,p.hips/96,p.waist/76*shape,p.chest/92*(reference?.shoulderScale||1),p.shoulders/42*(reference?.shoulderScale||1),1,1];
   const depth=[p.hips/96,p.hips/96,p.waist/76*shape,p.chest/92,1,1,1];
   const interpolate=(y,values)=>{let i=0;while(i<sourceY.length-2&&y>sourceY[i+1])i++;const t=clamp((y-sourceY[i])/(sourceY[i+1]-sourceY[i]),0,1);return values[i]+(values[i+1]-values[i])*t;};
   const points=new Float32Array(humanBase.positions.length),normals=new Float32Array(points.length),colors=new Float32Array(points.length),heightScale=h/1.7,shoulderDelta=shoulder-.21*heightScale;
   for(let i=0;i<points.length;i+=3){const index=i/3,x=humanBase.positions[i],y=humanBase.positions[i+1],z=humanBase.positions[i+2],arm=humanBase.arms[index],bodyX=x*interpolate(y,width)*heightScale,armX=x*heightScale+Math.sign(x)*shoulderDelta,bodyY=interpolate(y,targetY),armY=y*heightScale+(shoulderY-1.41*heightScale);
    points[i]=bodyX*(1-arm)+armX*arm;points[i+1]=bodyY*(1-arm)+armY*arm;points[i+2]=z*interpolate(y,depth)*heightScale;
    // The generic body wears a neutral fitted suit. No bare anatomy or
    // user-specific skin/face is generated; hands and head have a generic tone.
    const skinRegion=y>1.445||arm>.75&&y<1.02,hair=y>1.64||y>1.59&&z<.025,color=hair?[.12,.095,.08]:skinRegion?skin:base;for(let k=0;k<3;k++)colors[i+k]=color[k];
   }
   for(let j=0;j<humanBase.indices.length;j+=3){const a=humanBase.indices[j]*3,b=humanBase.indices[j+1]*3,c=humanBase.indices[j+2]*3,ux=points[b]-points[a],uy=points[b+1]-points[a+1],uz=points[b+2]-points[a+2],vx=points[c]-points[a],vy=points[c+1]-points[a+1],vz=points[c+2]-points[a+2],n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];for(const index of [a,b,c])for(let k=0;k<3;k++)normals[index+k]+=n[k];}
   for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(length>1e-12)for(let k=0;k<3;k++)normals[i+k]/=length;else normals[i+1]=1;}
   for(const index of humanBase.indices){const i=index*3;vertices.push(points[i],points[i+1],points[i+2],normals[i],normals[i+1],normals[i+2],colors[i],colors[i+1],colors[i+2]);}
   humanBodyPoints=points;humanBodyNormals=normals;
   const eyeY=interpolate(1.584,targetY),eyeX=.035*heightScale,eyeZ=.093*heightScale;
   for(const sign of [-1,1]){ellipsoid([sign*eyeX,eyeY,eyeZ],[.012*heightScale,.007*heightScale,.009*heightScale],[.85,.85,.80]);ellipsoid([sign*eyeX,eyeY,eyeZ+.008*heightScale],[.0045*heightScale,.0045*heightScale,.0025*heightScale],[.08,.10,.12]);}
  }else{
  torso([[hipY-.11,hipWidth*.7,hips*.69],[hipY-.035,hipWidth,hips*.85],[hipY+.025,hipWidth*.97,hips*.83]],base);torso(bodySections,skin);
  torso([[h-.26,.055,.059],[h-.218,.055,.066],[h-.185,.079,.080],[h-.128,.092,.087],[h-.075,.087,.081],[h-.028,.055,.057],[h-.014,.006,.009]],skin);
  ellipsoid([0,h-.135,.082],[.011,.025,.017],skin);ellipsoid([0,h-.149,.096],[.011,.009,.012],skin);
  for(const sign of [-1,1])ellipsoid([sign*.089,h-.127,0],[.012,.025,.014],skin);
  for(const sign of [-1,1]){
   const x=sign*hipWidth*.47,thighWidth=clamp(hips*.47,.055,.10),calfWidth=clamp(hips*.36,.043,.075);
   surface([[.085,x,0,calfWidth*.63,.044],[leg*.23,x,0,calfWidth*.88,.057],[leg*.34,x,.005,calfWidth*1.06,.066],[leg*.52,x,-.008,calfWidth*.84,.057],[leg*.72,x,0,thighWidth*.94,.074],[hipY-.05,x,0,thighWidth*1.06,.083]],base);
   ellipsoid([x,.035,.048],[.058,.036,.112],base);ellipsoid([x,.013,.05],[.059,.011,.113],[.21,.24,.26]);
   const upper=h*.17,lower=h*.15;
   const elbowY=shoulderY-upper,wristY=elbowY-lower;
   surface([[shoulderY+.005,sign*(shoulder-.007),0,.033*h,.036*h],[shoulderY-upper*.25,sign*(shoulder+.025),0,.033*h,.034*h],[shoulderY-upper*.7,sign*(shoulder+.046),.003,.028*h,.031*h],[elbowY,sign*(shoulder+.055),-.008,.022*h,.025*h],[elbowY-lower*.33,sign*(shoulder+.066),-.004,.025*h,.026*h],[wristY,sign*(shoulder+.078),.008,.015*h,.018*h]],skin);
   ellipsoid([sign*(shoulder+.078),wristY-.038,.008],[.020*h,.035*h,.016*h],skin,sign*.04);
   ellipsoid([sign*(shoulder+.05),wristY-.033,.021],[.009*h,.023*h,.010*h],skin,sign*.3);
   for(let digit=0;digit<4;digit++)ellipsoid([sign*(shoulder+.052+digit*.016),wristY-.094+(digit===0||digit===3?.007:0),.009],[.0055,.024-(digit===0||digit===3?.004:0),.008],skin);
  }
  }
  if(garment!=='none'){
   if(humanBodyPoints){
    garmentMesh=garmentShell(humanBodyPoints,humanBodyNormals,garment,h);
    for(const index of garmentMesh.indices){const i=index*3,binding=garmentMesh.binding[index],color=cloth.map(v=>v*(1-binding*.16));vertices.push(garmentMesh.positions[i],garmentMesh.positions[i+1],garmentMesh.positions[i+2],garmentMesh.normals[i],garmentMesh.normals[i+1],garmentMesh.normals[i+2],...color);}
   }else{
   const loose=garment==='LAB-B'?1.13:1.04,cropped=garment==='LAB-C',hemY=cropped?waistY+Math.min(.035,(chestY-waistY)*.2):hipY-.035;
   const clothingSections=[[hemY,(cropped?waistWidth:hipWidth)*loose+.008,(cropped?waist:hips)*.88*loose+.008],
    [cropped?hemY+Math.min(.015,(chestY-hemY)*.35):waistY,waistWidth*loose+.012,waist*.88*loose+.01],
    [chestY,chestWidth*loose+.012,chest*.85*loose+.01],[shoulderY,shoulder*loose+.008,chest*.79*loose+.01],[h-.235,.073,.073]];
   torso(clothingSections,cloth,{open:true,folds:garment==='LAB-B'?.008:.004});
   for(const sign of [-1,1])surface([[shoulderY+.005,sign*(shoulder-.008),0,.039*h*loose,.042*h*loose],[shoulderY-.06,sign*(shoulder+.026),.001,.039*h*loose,.041*h*loose],[shoulderY-.14,sign*(shoulder+.043),.002,.036*h*loose,.038*h*loose]],cloth,{open:true,folds:.006});
   const seam=cloth.map(v=>Math.min(1,v*1.18+.035));
   const collar=clothingSections.at(-1);torso([[h-.238,collar[1]+.001,collar[2]+.001],[h-.224,collar[1]+.002,collar[2]+.002]],seam,{open:true});
   const hem=clothingSections[0];torso([[hemY-.001,hem[1]+.003,hem[2]+.004],[hemY+.009,hem[1]+.003,hem[2]+.004]],seam,{open:true});
   if(garment==='LAB-A')for(let y=chestY-.02;y>hemY+.015;y-=.055){
    const front=(y>waistY?chest:waist)*.91+.025;
    ellipsoid([0,y,front],[.006,.006,.006],[.88,.85,.69]);
   }
   }
  }
  return {height:h,vertices:new Float32Array(vertices),garment,reference,humanBase:Boolean(humanBase),garmentMesh,bodyMesh:humanBodyPoints?{positions:humanBodyPoints,normals:humanBodyNormals,indices:humanBase.indices}:null};
 }
 return Object.freeze({defaults:Object.freeze(defaults),validate,photoReference,scene,installBase,hasHumanBase});
});
