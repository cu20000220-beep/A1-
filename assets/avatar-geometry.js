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
  let humanBodyPoints=null;
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
   humanBodyPoints=points;
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
   const loose=garment==='LAB-B'?1.13:1.04,cropped=garment==='LAB-C',hemY=cropped?waistY+Math.min(.035,(chestY-waistY)*.2):hipY-.035;
   const clothingSections=[[hemY,(cropped?waistWidth:hipWidth)*loose+.008,(cropped?waist:hips)*.88*loose+.008],
    [cropped?hemY+Math.min(.015,(chestY-hemY)*.35):waistY,waistWidth*loose+.012,waist*.88*loose+.01],
    [chestY,chestWidth*loose+.012,chest*.85*loose+.01],[shoulderY,shoulder*loose+.008,chest*.79*loose+.01],[h-.235,.073,.073]];
   if(humanBodyPoints)for(const section of clothingSections.slice(0,-1)){
    // A bounded visual clearance for this generic body only. This is not cloth
    // physics or retail sizing: keep the pre-existing trial shirt from cutting
    // through the changed body profile after large manual/photo adjustments.
    let envelope=1;for(let i=0;i<humanBodyPoints.length;i+=3)if(humanBase.arms[i/3]<.35&&Math.abs(humanBodyPoints[i+1]-section[0])<.065)envelope=Math.max(envelope,Math.hypot(humanBodyPoints[i]/section[1],humanBodyPoints[i+2]/section[2]));
    section[1]*=envelope+ .035;section[2]*=envelope+ .035;
   }
   torso(clothingSections,cloth,{open:true,folds:garment==='LAB-B'?.008:.004});
   for(const sign of [-1,1])surface([[shoulderY+.005,sign*(shoulder-.008),0,.039*h*loose,.042*h*loose],[shoulderY-.06,sign*(shoulder+.026),.001,.039*h*loose,.041*h*loose],[shoulderY-.14,sign*(shoulder+.043),.002,.036*h*loose,.038*h*loose]],cloth,{open:true,folds:.006});
   const seam=cloth.map(v=>Math.min(1,v*1.18+.035));
   const collar=clothingSections.at(-1);torso([[h-.238,collar[1]+.001,collar[2]+.001],[h-.224,collar[1]+.002,collar[2]+.002]],seam,{open:true});
   const hem=clothingSections[0];torso([[hemY-.001,hem[1]+.003,hem[2]+.004],[hemY+.009,hem[1]+.003,hem[2]+.004]],seam,{open:true});
   if(garment==='LAB-A')for(let y=chestY-.02;y>hemY+.015;y-=.055){
    let front=(y>waistY?chest:waist)*.91+.025;if(humanBodyPoints){let i=0;while(i<clothingSections.length-2&&y>clothingSections[i+1][0])i++;const a=clothingSections[Math.max(0,i-1)][2],b=clothingSections[i][2],c=clothingSections[i+1][2],d=clothingSections[Math.min(clothingSections.length-1,i+2)][2],t=clamp((y-clothingSections[i][0])/(clothingSections[i+1][0]-clothingSections[i][0]),0,1);front=.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)+.004;}
    ellipsoid([0,y,front],[.006,.006,.006],[.88,.85,.69]);
   }
  }
  return {height:h,vertices:new Float32Array(vertices),garment,reference,humanBase:Boolean(humanBase)};
 }
 return Object.freeze({defaults:Object.freeze(defaults),validate,photoReference,scene,installBase,hasHumanBase});
});
