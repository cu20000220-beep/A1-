/* Original procedural meshes. Reference geometry, never a body scan or fit inference. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1AvatarGeometry=api;})(globalThis,()=>{
 const defaults={height:170,chest:92,waist:76,hips:96,shoulders:42,inseam:78,shape:'neutral'};
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
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
  if(garment!=='none'){
   const loose=garment==='LAB-B'?1.13:1.04,cropped=garment==='LAB-C',hemY=cropped?waistY+Math.min(.035,(chestY-waistY)*.2):hipY-.035;
   torso([[hemY,(cropped?waistWidth:hipWidth)*loose+.008,(cropped?waist:hips)*.88*loose+.008],
    [cropped?hemY+Math.min(.015,(chestY-hemY)*.35):waistY,waistWidth*loose+.012,waist*.88*loose+.01],
    [chestY,chestWidth*loose+.012,chest*.85*loose+.01],[shoulderY,shoulder*loose+.008,chest*.79*loose+.01],[h-.235,.073,.073]],cloth,{open:true,folds:garment==='LAB-B'?.008:.004});
   for(const sign of [-1,1])surface([[shoulderY+.005,sign*(shoulder-.008),0,.039*h*loose,.042*h*loose],[shoulderY-.06,sign*(shoulder+.026),.001,.039*h*loose,.041*h*loose],[shoulderY-.14,sign*(shoulder+.043),.002,.036*h*loose,.038*h*loose]],cloth,{open:true,folds:.006});
   const seam=cloth.map(v=>Math.min(1,v*1.18+.035));
   torso([[h-.238,.074,.074],[h-.224,.075,.075]],seam,{open:true});
   torso([[hemY-.001,(cropped?waistWidth:hipWidth)*loose+.011,(cropped?waist:hips)*.88*loose+.012],[hemY+.009,(cropped?waistWidth:hipWidth)*loose+.011,(cropped?waist:hips)*.88*loose+.012]],seam,{open:true});
   if(garment==='LAB-A')for(let y=chestY-.02;y>hemY+.015;y-=.055)ellipsoid([0,y,(y>waistY?chest:waist)*.91+.025],[.006,.006,.006],[.88,.85,.69]);
  }
  return {height:h,vertices:new Float32Array(vertices),garment,reference};
 }
 return Object.freeze({defaults:Object.freeze(defaults),validate,photoReference,scene});
});
