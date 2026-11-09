/* Original procedural meshes. Units: metres. No body scan or fit inference. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1AvatarGeometry=api;})(globalThis,()=>{
 const defaults={height:170,chest:92,waist:76,hips:96,shoulders:42,inseam:78,shape:'neutral'};
 function validate(value){const ranges={height:[120,220],chest:[60,160],waist:[45,160],hips:[60,180],shoulders:[28,65],inseam:[40,110]};
  if(!value||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw TypeError('invalid_measurements');
  const out={};for(const [key,[min,max]]of Object.entries(ranges)){if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw TypeError('invalid_measurements');out[key]=value[key];}
  if(out.inseam>out.height*.6||!['neutral','straight','curved'].includes(value.shape))throw TypeError('invalid_proportions');return {...out,shape:value.shape};
 }
 function scene(input,garment='none'){
  const p=validate(input);if(!['none','LAB-A','LAB-B','LAB-C'].includes(garment))throw TypeError('invalid_garment');
  const vertices=[],skin=[.73,.55,.42],base=[.32,.36,.39],cloth=garment==='LAB-B'?[.18,.32,.50]:garment==='LAB-C'?[.09,.20,.33]:[.12,.26,.43];
  function ellipsoid(center,radius,color,angle=0){const rows=12,cols=20,c=Math.cos(angle),s=Math.sin(angle);
   function point(i,j){const lat=Math.PI*i/rows,lon=2*Math.PI*j/cols,u=[Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)],v=u.map((x,k)=>x*radius[k]),n=u.map((x,k)=>x/radius[k]),len=Math.hypot(...n);const normal=n.map(x=>x/len);
    return [center[0]+c*v[0]-s*v[1],center[1]+s*v[0]+c*v[1],center[2]+v[2],c*normal[0]-s*normal[1],s*normal[0]+c*normal[1],normal[2],...color];}
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=point(i,j),b=point(i+1,j),d=point(i,j+1),e=point(i+1,j+1);vertices.push(...a,...b,...d,...d,...b,...e);}
  }
  const h=p.height/100,leg=p.inseam/100,hipY=leg+.055,chestY=h*.74,shoulder=p.shoulders/200;
  const chest=p.chest/100/(2*Math.PI),waist=p.waist/100/(2*Math.PI),hips=p.hips/100/(2*Math.PI),shape=p.shape==='curved'?.94:p.shape==='straight'?1.06:1;
  ellipsoid([0,-.015,0],[.48,.025,.32],[.78,.79,.73]);
  ellipsoid([0,hipY,0],[hips*1.13,.15,hips*.83],base);
  ellipsoid([0,(hipY+chestY)/2,0],[waist*1.12*shape,(chestY-hipY)/2+.1,waist*.86],skin);
  ellipsoid([0,chestY,0],[Math.max(chest*1.17,shoulder*.94),.18,chest*.82],skin);
  ellipsoid([0,h-.245,0],[.065,.09,.065],skin);ellipsoid([0,h-.12,0],[.095,.12,.092],skin);
  // A small nose provides a visible front/back orientation cue.
  ellipsoid([0,h-.125,.094],[.022,.025,.025],skin);
  for(const sign of [-1,1]){
   const x=sign*hips*.55;ellipsoid([x,leg*.55+.035,0],[.075,leg*.49,.085],base);ellipsoid([x,.045,.045],[.075,.045,.12],base);
   ellipsoid([sign*(shoulder+.055),chestY-.19,0],[.055,.235,.057],skin,sign*.16);ellipsoid([sign*(shoulder+.095),chestY-.43,0],[.045,.065,.045],skin);
  }
  if(garment!=='none'){
   const loose=garment==='LAB-B'?1.16:1.07,cropped=garment==='LAB-C';
   ellipsoid([0,chestY-.025,0],[Math.max(chest*1.24,shoulder)*loose,.19,chest*.94*loose],cloth);
   ellipsoid([0,cropped?chestY-.13:(hipY+chestY)/2,0],[Math.max(waist*1.22,hips*1.12)*loose,cropped?.12:(chestY-hipY)/2+.13,Math.max(chest,waist)*.97*loose],cloth);
   for(const sign of [-1,1])ellipsoid([sign*(shoulder+.035),chestY-.07,0],[.085,.13,.09],cloth,sign*.2);
   if(garment==='LAB-A')for(let y=chestY-.02;y>hipY-.03;y-=.055)ellipsoid([0,y,chest*1.02],[.008,.008,.008],[.88,.85,.69]);
  }
  return {height:h,vertices:new Float32Array(vertices),garment};
 }
 return Object.freeze({defaults:Object.freeze(defaults),validate,scene});
});
