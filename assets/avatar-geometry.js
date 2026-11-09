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
  function torso(sections,color){
   // Interpolate connected elliptical rings instead of separate oval blobs.
   const rings=[];for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){
    const a=sections[i],b=sections[i+1],t=j/4,u=t*t*(3-2*t);rings.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]);
   }rings.push(sections.at(-1));
   const cols=24;
   function point(i,j){const [y,rx,rz]=rings[i],previous=rings[Math.max(0,i-1)],next=rings[Math.min(rings.length-1,i+1)],dy=next[0]-previous[0],dx=(next[1]-previous[1])/dy,dz=(next[2]-previous[2])/dy,angle=2*Math.PI*j/cols,c=Math.cos(angle),s=Math.sin(angle);
    const normal=[c/rx,-c*c*dx/rx-s*s*dz/rz,s/rz],length=Math.hypot(...normal);return [rx*c,y,rz*s,...normal.map(v=>v/length),...color];}
   for(let i=0;i<rings.length-1;i++)for(let j=0;j<cols;j++){const a=point(i,j),b=point(i+1,j),c=point(i,j+1),d=point(i+1,j+1);vertices.push(...a,...b,...c,...c,...b,...d);}
   for(const [index,sign]of [[0,-1],[rings.length-1,1]])for(let j=0;j<cols;j++){
    const a=point(index,j),b=point(index,j+1),center=[0,rings[index][0],0,0,sign,0,...color];vertices.push(...center,...a,...b);
   }
  }
  const h=p.height/100,leg=clamp(p.inseam/100*(reference?.legScale||1),h*.28,h*.56),hipY=leg+.065,shoulderY=h-.29,shoulder=p.shoulders/200*(reference?.shoulderScale||1);
  const chest=p.chest/100/(2*Math.PI),waist=p.waist/100/(2*Math.PI),hips=p.hips/100/(2*Math.PI),shape=p.shape==='curved'?.94:p.shape==='straight'?1.06:1;
  const waistY=hipY+(shoulderY-hipY)*.37,chestY=shoulderY-.09,hipWidth=hips*1.13,waistWidth=waist*1.12*shape,chestWidth=Math.max(chest*1.17*(reference?.shoulderScale||1),shoulder*.96);
  const bodySections=[[hipY-.055,hipWidth*.94,hips*.8],[hipY,hipWidth,hips*.84],[waistY,waistWidth,waist*.86],[chestY,chestWidth,chest*.82],[shoulderY,shoulder,chest*.76],[h-.235,.065,.065]];
  ellipsoid([0,-.015,0],[.48,.025,.32],[.78,.79,.73]);
  ellipsoid([0,hipY-.045,0],[hipWidth,.10,hips*.83],base);torso(bodySections,skin);
  ellipsoid([0,h-.24,0],[.064,.055,.064],skin);ellipsoid([0,h-.12,0],[.092,.12,.089],skin);
  ellipsoid([0,h-.125,.091],[.018,.022,.023],skin);
  for(const sign of [-1,1]){
   const x=sign*hipWidth*.47,thighWidth=clamp(hips*.47,.055,.10),calfWidth=clamp(hips*.36,.043,.075);
   ellipsoid([x,leg*.75+.035,0],[thighWidth,leg*.28,.080],base);ellipsoid([x,leg*.29+.035,0],[calfWidth,leg*.28,.065],base);ellipsoid([x,.045,.045],[.065,.045,.115],base);
   const upper=h*.17,lower=h*.15;
   ellipsoid([sign*(shoulder+.03),shoulderY-upper/2,0],[.033*h,upper/2+.025,.034*h],skin,sign*.08);
   ellipsoid([sign*(shoulder+.06),shoulderY-upper-lower/2,0],[.027*h,lower/2+.02,.029*h],skin,sign*.04);
   ellipsoid([sign*(shoulder+.065),shoulderY-upper-lower-.025,0],[.025*h,.052,.028*h],skin);
  }
  if(garment!=='none'){
   const loose=garment==='LAB-B'?1.13:1.04,cropped=garment==='LAB-C',hemY=cropped?waistY+Math.min(.035,(chestY-waistY)*.2):hipY-.035;
   torso([[hemY,(cropped?waistWidth:hipWidth)*loose+.008,(cropped?waist:hips)*.88*loose+.008],
    [cropped?hemY+Math.min(.015,(chestY-hemY)*.35):waistY,waistWidth*loose+.012,waist*.88*loose+.01],
    [chestY,chestWidth*loose+.012,chest*.85*loose+.01],[shoulderY,shoulder*loose+.008,chest*.79*loose+.01],[h-.235,.073,.073]],cloth);
   for(const sign of [-1,1])ellipsoid([sign*(shoulder+.025),shoulderY-.055,0],[.085*loose,.12,.085*loose],cloth,sign*.12);
   if(garment==='LAB-A')for(let y=chestY-.02;y>hemY+.015;y-=.055)ellipsoid([0,y,(y>waistY?chest:waist)*.91+.025],[.006,.006,.006],[.88,.85,.69]);
  }
  return {height:h,vertices:new Float32Array(vertices),garment,reference};
 }
 return Object.freeze({defaults:Object.freeze(defaults),validate,photoReference,scene});
});
