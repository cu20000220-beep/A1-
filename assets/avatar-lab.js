'use strict';
function initializeAvatarLab(){
 const root=document.querySelector('#avatar-root');if(!root||!window.A1Preview||root.dataset.initialized)return;root.dataset.initialized='true';root.dataset.loadState='initializing';
 const G=window.A1AvatarGeometry,I=window.A1I18n,$=s=>document.querySelector(s);
 let humanModel=false;
 try{if(window.A1HumanBase&&!G.hasHumanBase())G.installBase(window.A1HumanBase);humanModel=G.hasHumanBase();}catch{/* Keep the existing geometry available if a local asset is invalid. */}
 I.register({
 '스캔 머리 자료를 준비 중입니다. 기존 범용 모델을 표시합니다.':'Preparing the scan head assets. The existing generic model is shown.',
 '범용 스캔 머리 · 눈을 감은 정적 에셋이며 사용자 얼굴 복원이 아닙니다.':'Generic scan head · a static asset with closed eyes, not a reconstruction of your face.',
 '스캔 머리 재질을 준비하지 못해 기존 범용 모델을 표시합니다. 기존 모델로 계속 이용하거나 새로고침 후 확인해주세요.':'The scan head material could not load; the existing generic model is shown. Continue with that model or reload to check again.',
 '기존 범용 머리로 비교':'Compare with the original generic head',
 '기본 재질과 비교':'Compare with the basic material',
 '범용 피부·원단 재질 연구 · 사진에서 얼굴이나 피부색을 추정하지 않습니다.':'Generic skin and fabric material study · face and skin tone are not inferred from your photo.',
 '고급 재질을 시작하지 못해 기존 기본 재질로 표시합니다. 회전과 체형 조절은 계속 이용할 수 있습니다.':'The studio material could not start; the existing basic material is shown. Rotation and body controls remain available.',
 '예시 3D 착용 이미지':'Example 3D garment preview',
 '연구 중인 범용 의류 메시입니다. 실제 상품 3D 모델·원단·의복 물리 검증이 없어 정확한 상품 피팅이나 착용감·사이즈를 보장하지 않습니다.':'An experimental generic garment mesh. Without the actual product model, fabric and cloth-physics validation, it does not guarantee product fit, comfort or size.',
 '범용 인체 모델 · 입력 치수와 동의한 사진 비율을 참고합니다. 실제 사람의 얼굴·신체 복원이나 정확한 사이즈 보장이 아닙니다.':'Generic human body model · uses entered measurements and consented photo references. It does not reconstruct a real person or guarantee an exact size.',
 '인체 모델 자료를 읽지 못해 기본 형상을 표시합니다. 새로고침 후 다시 확인해주세요.':'The human body asset did not load; default geometry is shown. Reload and check again.',
 '사용자 보정값':'User correction','기본 예시값 · 사진 측정 아님':'Example default · not measured from photo',
 '사진상 두 비율 적용 중 · 실제 치수 아님. 허리·가슴둘레·깊이는 추정하지 않습니다. 치수는 기본값 또는 직접 입력값입니다.':'Two photo ratios applied · not measurements. Waist/chest circumference and depth are not estimated. Measurement fields are defaults or your inputs.',
 '사진 비율 미적용 · 기본 형상과 사용자 보정값입니다.':'No photo reference · default geometry and user corrections.',
 '비교할 분석 이미지가 없습니다. 원래 화면에서 사진을 분석해주세요.':'No analysis image is available. Analyze a photo on the original page.',
 '분석 비율이 부족합니다. 기본 아바타를 사용하고 직접 보정해주세요.':'Insufficient analysis ratios. Use the default avatar and manual corrections.',
 '분석 이미지를 아바타 옆에 기기 안에서 표시하는 데 별도로 동의합니다.':'I separately agree to display the analysis image beside the avatar on this device.',
 '어깨 위쪽을 자른 분석 이미지 · 별도 동의 후 표시':'Analysis image cropped above the shoulders · shown with separate consent',
 '사진에서 cm를 측정하지 않습니다. 아래 수치는 기본 예시값이며 직접 고칠 수 있습니다.':'No centimetres are measured from the photo. The values below are editable example defaults.',
 '어깨/골반 기준점 비율 {shoulder} · 다리/몸통 기준점 비율 {leg} · 사진상 참고값':'Shoulder/hip landmark ratio {shoulder} · leg/torso landmark ratio {leg} · photo references only',
 '기기 내 분석 이미지':'On-device analysis image',
 '사진·분석·아바타 모두 지우기':'Delete photo, analysis & avatar',
 '측면':'Side','후면':'Back',
 '연구실로 돌아가기':'Back to the lab','무료 브라우저 3D 아바타 · 시각적 미리보기':'Free browser 3D avatar · visual preview',
 '입력한 치수로 만든 단순 3D 인체와 시험 의류입니다. 실제 판매 상품·정확한 신체 복제·의복 물리 시뮬레이션·사이즈 보장이 아닙니다. 동의한 사진상 비율만 기기 안에서 참고하며 외부로 전송하지 않습니다.':'A simplified 3D body and fictional garment made from entered measurements. Not a real product, exact body replica, cloth simulation or size guarantee. Consented photo ratios are used only on this device and are not transmitted.',
 '직접 입력한 치수 · cm':'Self-reported measurements · cm','키':'Height','가슴둘레':'Chest circumference','허리둘레':'Waist circumference','엉덩이둘레':'Hip circumference','어깨너비':'Shoulder width','안쪽 다리 길이':'Inseam','체형 시각 프리셋':'Visual shape preset','중립':'Neutral','직선형':'Straight','곡선형':'Curved','시험 의류':'Fictional garment',
 'LAB-A · 네이비 셔츠 도식':'LAB-A · navy shirt diagram','LAB-B · 루즈 네이비 도식':'LAB-B · loose navy diagram','LAB-C · 짧은 네이비 도식':'LAB-C · cropped navy diagram','의류 도식 없음':'No garment diagram',
 '입력 치수로 아바타 갱신':'Update avatar from measurements','치수·의류·시점 초기화':'Reset measurements, garment & view',
 '드래그로 회전, 두 손가락으로 확대·축소하세요. 두 화면의 시점은 함께 바뀝니다.':'Drag to rotate; pinch with two fingers to zoom. Both views move together.',
 '왼쪽 회전':'Rotate left','오른쪽 회전':'Rotate right','확대':'Zoom in','축소':'Zoom out','정면':'Front',
 '변경 전 · 기본 의류 없는 아바타':'Before · body without garment diagram','변경 후 · 선택한 시험 의류':'After · selected fictional garment',
 '입력 치수 기반 3D 아바타 변경 전':'3D avatar before garment, using entered measurements','시험 의류가 표시된 3D 아바타':'3D avatar with fictional garment',
 '치수와 조작 상태는 현재 화면 메모리에서만 사용합니다. 초기화·페이지 이탈 시 지우며 저장·전송하지 않습니다.':'Measurements and controls stay in this page memory. Reset and page exit clear them; they are not saved or transmitted.',
 '3D 미리보기를 표시했습니다. 시험 의류이며 실제 착용감·사이즈를 예측하지 않습니다.':'3D preview rendered. Fictional garment; fit and size are not predicted.',
 '입력값을 확인해주세요. 각 범위와 안쪽 다리 길이(키의 60% 이하)를 확인하세요.':'Check the input ranges and inseam (at most 60% of height).',
 'WebGL 3D 표시를 시작하지 못했습니다. Safari를 업데이트하고 다른 탭을 닫은 뒤 다시 열어주세요.':'WebGL could not start. Update Safari, close other tabs and reopen this page.',
 '3D 그래픽 연결이 중단됐습니다. 페이지를 다시 열어주세요. 치수는 저장되지 않습니다.':'The 3D graphics context was lost. Reopen this page; measurements are not saved.'
 });
 root.hidden=false;const unavailable=$('#avatar-unavailable');if(unavailable)unavailable.hidden=true;
 root.dataset.humanModel=humanModel?'hm08-cc0':'procedural-fallback';
 let humanNote=$('#avatar-human-model');if(!humanNote){humanNote=document.createElement('p');humanNote.id='avatar-human-model';root.querySelector('h1').after(humanNote);}I.setText(humanNote,humanModel?'범용 인체 모델 · 입력 치수와 동의한 사진 비율을 참고합니다. 실제 사람의 얼굴·신체 복원이나 정확한 사이즈 보장이 아닙니다.':'인체 모델 자료를 읽지 못해 기본 형상을 표시합니다. 새로고침 후 다시 확인해주세요.');
 I.setText(root.querySelector('h1'),'예시 3D 착용 이미지');let garmentNote=$('#avatar-garment-limit');if(!garmentNote){garmentNote=document.createElement('p');garmentNote.id='avatar-garment-limit';humanNote.after(garmentNote);}I.setText(garmentNote,'연구 중인 범용 의류 메시입니다. 실제 상품 3D 모델·원단·의복 물리 검증이 없어 정확한 상품 피팅이나 착용감·사이즈를 보장하지 않습니다.');
 const materialNote=document.createElement('p');materialNote.id='avatar-material-note';garmentNote.after(materialNote);I.setText(materialNote,'범용 피부·원단 재질 연구 · 사진에서 얼굴이나 피부색을 추정하지 않습니다.');
 const materialLabel=document.createElement('label'),materialBasic=document.createElement('input'),materialText=document.createElement('span');materialLabel.className='avatar-photo-consent';materialBasic.type='checkbox';materialBasic.id='avatar-material-basic';I.setText(materialText,'기본 재질과 비교');materialLabel.append(materialBasic,materialText);materialNote.after(materialLabel);root.dataset.humanMaterial='loading';root.dataset.humanMaterialSource='procedural';
 const headNote=document.createElement('p'),headLabel=document.createElement('label'),headBasic=document.createElement('input'),headText=document.createElement('span');headNote.id='avatar-head-note';materialLabel.after(headNote);I.setText(headNote,'스캔 머리 자료를 준비 중입니다. 기존 범용 모델을 표시합니다.');headLabel.className='avatar-photo-consent';headBasic.id='avatar-head-basic';headBasic.type='checkbox';headBasic.disabled=true;I.setText(headText,'기존 범용 머리로 비교');headLabel.append(headBasic,headText);headNote.after(headLabel);root.dataset.humanHead='loading';
 const attribution=document.createElement('p');attribution.id='avatar-head-credit';attribution.append(document.createTextNode('Infinite, 3D Head Scan by Lee Perry-Smith · '));const license=document.createElement('a');license.href='https://creativecommons.org/licenses/by/3.0/';license.rel='noopener noreferrer';license.referrerPolicy='no-referrer';license.textContent='CC BY 3.0';attribution.append(license,document.createTextNode(' · Source: Three.js / triplegangers.com. A1: neck crop, taper & integration.'));headLabel.after(attribution);
 const form=$('#avatar-form'),selector=$('#avatar-garment'),canvases=[$('#avatar-before'),$('#avatar-after')];
 let referenceMetrics=null;const manual=new Set();
 let params={...G.defaults},yaw=0,pitch=0,zoom=3.5,scheduled=false,disposed=false,lost=false,headReady=false,headGeneration=0,releaseHeadLoad=null;
 if(['LAB-A','LAB-B','LAB-C'].includes(location.hash.slice(1)))selector.value=location.hash.slice(1);
 const status=s=>I.setText($('#avatar-status'),s),views=[];
 function shader(gl,type,source){const result=gl.createShader(type);gl.shaderSource(result,source);gl.compileShader(result);if(!gl.getShaderParameter(result,gl.COMPILE_STATUS)){gl.deleteShader(result);throw Error('shader_compile');}return result;}
 function createView(canvas){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('webgl_unavailable');
  const derivatives=Boolean(gl.getExtension('OES_standard_derivatives'));
  const vertexSource=`
   attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute vec3 m;
   uniform mat4 model;uniform mat4 projection;uniform float center;
   varying vec3 surfaceNormal;varying vec3 surfacePosition;
   varying vec3 materialPosition;varying vec3 materialColor;varying vec3 materialData;
   void main(){vec4 position=model*vec4(p-vec3(0.,center,0.),1.);
    surfaceNormal=mat3(model)*n;surfacePosition=position.xyz;
    materialPosition=p;materialColor=c;materialData=m;gl_Position=projection*position;}
  `;
  const basicSource=`
   precision mediump float;
   varying vec3 surfaceNormal;varying vec3 surfacePosition;
   varying vec3 materialPosition;varying vec3 materialColor;varying vec3 materialData;
   uniform sampler2D headColor;uniform sampler2D headNormal;
   void main(){
    vec3 displayColor=materialData.z>1.5?texture2D(headColor,materialData.xy).rgb:materialColor;
    vec3 normal=normalize(surfaceNormal),viewDirection=normalize(-surfacePosition);
    vec3 key=normalize(vec3(-.45,.75,.9)),fill=normalize(vec3(.75,.2,.45));
    float diffuse=max(dot(normal,key),0.);
    float ambient=.38+.08*max(normal.y,0.);
    float fillLight=.13*max(dot(normal,fill),0.);
    float rim=.075*pow(1.-max(dot(normal,viewDirection),0.),3.);
    // Procedural blue cloth has matte micro-variation; skin remains a generic
    // avatar material. No photo texture, personal face or external asset is used.
    float fabric=step(displayColor.r*1.3,displayColor.b)*(1.-step(1.5,materialData.z));
    float weave=sin(materialPosition.y*390.)*sin(materialPosition.x*310.+materialPosition.z*73.);
    float texture=mix(1.,1.+.018*weave,fabric);
    float shine=pow(max(dot(normal,normalize(key+viewDirection)),0.),mix(28.,12.,fabric))*mix(.035,.006,fabric);
    vec3 linearColor=pow(displayColor,vec3(2.2))*texture*(ambient+.62*diffuse+fillLight)+vec3(shine+rim*.12);
    // Bounded soft contact shading on the original display plinth, not a cloth
    // or fit simulation. All surfaces still respond to the shared view controls.
    float plinth=step(.70,min(displayColor.r,displayColor.g))*step(displayColor.b,.78)*(1.-step(1.5,materialData.z));
    vec2 ground=materialPosition.xz/vec2(.23,.17);
    linearColor*=1.-plinth*.18*exp(-dot(ground,ground));
    gl_FragColor=vec4(pow(clamp(linearColor,0.,1.),vec3(1./2.2)),1.);
   }
  `;
  const studioSource=(derivatives?'#extension GL_OES_standard_derivatives : enable\n':'')+basicSource.replace('void main(){',`
   // A1_SKIN_STUDIO: original material shader, no external model or photograph.
   uniform float useStudio;
   const float PI=3.14159265;
   vec3 fresnel(float angle,vec3 f0){return f0+(1.-f0)*pow(1.-clamp(angle,0.,1.),5.);}
   float distributionGGX(float nh,float roughness){float a=roughness*roughness,a2=a*a,d=nh*nh*(a2-1.)+1.;return a2/max(PI*d*d,.001);}
   float visibility(float cosine,float roughness){float k=pow(roughness+1.,2.)/8.;return cosine/max(cosine*(1.-k)+k,.001);}
   vec3 lightBRDF(vec3 n,vec3 v,vec3 l,vec3 radiance,vec3 albedo,float roughness,float skin){
    vec3 h=normalize(v+l);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.);vec3 f=fresnel(max(dot(v,h),0.),vec3(mix(.025,.032,skin)));
    vec3 specular=distributionGGX(nh,roughness)*visibility(nv,roughness)*visibility(nl,roughness)*f/max(4.*nv*nl,.001);
    float wrap=max((dot(n,l)+.28)/1.28,0.)-nl;
    return ((1.-f)*albedo/PI+specular)*radiance*nl+skin*albedo*vec3(1.,.38,.23)*radiance*wrap*.10;
   }
   vec3 studioShade(){
    vec3 n=normalize(surfaceNormal),v=normalize(-surfacePosition),displayColor=materialData.z>1.5?texture2D(headColor,materialData.xy).rgb:materialColor;
    ${derivatives?`if(materialData.z>1.5){vec3 q0=dFdx(surfacePosition),q1=dFdy(surfacePosition);vec2 st0=dFdx(materialData.xy),st1=dFdy(materialData.xy);vec3 t=q0*st1.y-q1*st0.y,b=-q0*st1.x+q1*st0.x,map=texture2D(headNormal,materialData.xy).xyz*2.-1.;float scale=inversesqrt(max(max(dot(t,t),dot(b,b)),.000001));map.xy*=.5;n=normalize(t*map.x*scale+b*map.y*scale+n*map.z);}`:''}
    vec3 albedo=pow(displayColor,vec3(2.2));float skin=clamp(materialData.z,0.,1.),fabric=step(displayColor.r*1.3,displayColor.b)*(1.-step(1.5,materialData.z));
    float roughness=mix(mix(.76,.88,fabric),.53,skin);
    vec3 hemisphere=mix(vec3(.17,.14,.12),vec3(.47,.52,.61),n.y*.5+.5),color=albedo*hemisphere;
    color+=lightBRDF(n,v,normalize(vec3(-.5,.65,.9)),vec3(2.3,2.08,1.88),albedo,roughness,skin);
    color+=lightBRDF(n,v,normalize(vec3(.8,.3,.4)),vec3(.72,.87,1.08),albedo,roughness,skin);
    color+=lightBRDF(n,v,normalize(vec3(.35,.65,-.8)),vec3(.7,.72,.76),albedo,roughness,skin);
    float plinth=step(.70,min(displayColor.r,displayColor.g))*step(displayColor.b,.78)*(1.-step(1.5,materialData.z));vec2 ground=materialPosition.xz/vec2(.23,.17);color*=1.-plinth*.18*exp(-dot(ground,ground));
    color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);return pow(color,vec3(1./2.2));
   }
   void main(){if(useStudio>.5){gl_FragColor=vec4(studioShade(),1.);return;}
  `);
  function programFor(fragmentSource){let vertex,fragment,program;try{vertex=shader(gl,gl.VERTEX_SHADER,vertexSource);fragment=shader(gl,gl.FRAGMENT_SHADER,fragmentSource);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader_link');return program;}catch(error){if(program)gl.deleteProgram(program);throw error;}finally{if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);}}
  let program,studioEnabled=true;try{program=programFor(studioSource);}catch{program=programFor(basicSource);studioEnabled=false;}
  const buffer=gl.createBuffer(),materialBuffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [name,offset]of [['p',0],['n',12],['c',24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}
  const materialLocation=gl.getAttribLocation(program,'m');if(materialLocation>=0){gl.bindBuffer(gl.ARRAY_BUFFER,materialBuffer);gl.enableVertexAttribArray(materialLocation);gl.vertexAttribPointer(materialLocation,3,gl.FLOAT,false,12,0);}
  const textures=[[186,140,107,255],[128,128,255,255]].map((rgba,index)=>{const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba));for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);return texture;});gl.uniform1i(gl.getUniformLocation(program,'headColor'),0);gl.uniform1i(gl.getUniformLocation(program,'headNormal'),1);
  gl.enable(gl.DEPTH_TEST);gl.clearColor(.91,.93,.87,1);
  const view={canvas,gl,buffer,materialBuffer,textures,program,studioEnabled,studio:gl.getUniformLocation(program,'useStudio'),model:gl.getUniformLocation(program,'model'),projection:gl.getUniformLocation(program,'projection'),center:gl.getUniformLocation(program,'center'),count:0};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;status('3D 그래픽 연결이 중단됐습니다. 페이지를 다시 열어주세요. 치수는 저장되지 않습니다.');});
  return view;
 }
 function upload(){views.forEach((v,i)=>{const scene=G.scene(params,i?selector.value:'none',referenceMetrics,{head:headReady&&!headBasic.checked});v.gl.bindBuffer(v.gl.ARRAY_BUFFER,v.buffer);v.gl.bufferData(v.gl.ARRAY_BUFFER,scene.vertices,v.gl.STATIC_DRAW);v.gl.bindBuffer(v.gl.ARRAY_BUFFER,v.materialBuffer);v.gl.bufferData(v.gl.ARRAY_BUFFER,scene.surfaceMaterials,v.gl.STATIC_DRAW);v.count=scene.vertices.length/9;});}
 function render(){scheduled=false;if(disposed||lost)return;
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const model=new Float32Array([cy,sp*sy,-cp*sy,0,0,cp,sp,0,sy,-sp*cy,cp*cy,0,0,0,-zoom,1]);
  for(const v of views){const {gl,canvas}=v,dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.useProgram(v.program);
   const f=1/Math.tan(Math.PI*35/360),near=.1,far=20;
   gl.uniformMatrix4fv(v.projection,false,new Float32Array([f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]));
   gl.uniformMatrix4fv(v.model,false,model);gl.uniform1f(v.center,params.height/200);gl.uniform1f(v.studio,materialBasic.checked?0:1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,v.count);
  }
 }
 const schedule=()=>{if(!scheduled&&!disposed){scheduled=true;requestAnimationFrame(render);}};
 function update(){try{const next=Object.fromEntries(Object.keys(G.defaults).map(k=>[k,k==='shape'?form.elements.namedItem(k).value:Number(form.elements.namedItem(k).value)]));params=G.validate(next);upload();render();status('3D 미리보기를 표시했습니다. 시험 의류이며 실제 착용감·사이즈를 예측하지 않습니다.');}catch{status('입력값을 확인해주세요. 각 범위와 안쪽 다리 길이(키의 60% 이하)를 확인하세요.');}}
 function reset(){referenceMetrics=null;manual.clear();clearPhoto();updateSources();params={...G.defaults};form.reset();selector.value='LAB-A';yaw=pitch=0;zoom=3.5;update();}
 try{for(const canvas of canvases)views.push(createView(canvas));upload();render();root.dataset.humanMaterial=views.every(v=>v.studioEnabled)?'ready':'fallback';if(root.dataset.humanMaterial==='fallback'){materialBasic.checked=true;materialBasic.disabled=true;render();I.setText(materialNote,'고급 재질을 시작하지 못해 기존 기본 재질로 표시합니다. 회전과 체형 조절은 계속 이용할 수 있습니다.');}status('3D 미리보기를 표시했습니다. 시험 의류이며 실제 착용감·사이즈를 예측하지 않습니다.');}catch{root.dataset.loadState='webgl-error';root.dataset.initialized='';for(const v of views){v.gl.deleteBuffer(v.buffer);v.gl.deleteBuffer(v.materialBuffer);v.gl.deleteProgram(v.program);}status('WebGL 3D 표시를 시작하지 못했습니다. Safari를 업데이트하고 다른 탭을 닫은 뒤 다시 열어주세요.');return;}
 materialBasic.addEventListener('change',render);
 headBasic.addEventListener('change',()=>{upload();render();});
 async function loadHead(){
  const token=++headGeneration,images=[];let timer;
  const release=()=>{clearTimeout(timer);for(const image of images){image.onload=image.onerror=null;image.removeAttribute('src');}};releaseHeadLoad=release;
  try{
   if(!humanModel||!window.A1HumanHead||typeof G.installHead!=='function')throw Error('head_missing');G.installHead(window.A1HumanHead);
   const base=new URL('.',document.querySelector('script[src*="avatar-lab.js"]').src);
   const pending=['human-head-color.jpg','human-head-normal.jpg'].map(name=>new Promise((resolve,reject)=>{const image=new Image();images.push(image);image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.onload=()=>image.naturalWidth===1024&&image.naturalHeight===1024?resolve(image):reject(Error('head_dimensions'));image.onerror=()=>reject(Error('head_image'));image.src=new URL(name+'?v=scan-1',base).href;}));
   const loaded=await Promise.race([Promise.all(pending),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('head_timeout')),10000);})]);if(disposed||token!==headGeneration)return;
   for(const view of views){const gl=view.gl;if(gl.getParameter(gl.MAX_TEXTURE_SIZE)<1024)throw Error('head_texture_limit');loaded.forEach((image,index)=>{gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,view.textures[index]);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);});gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);if(gl.getError()!==gl.NO_ERROR)throw Error('head_texture_upload');}
   headReady=true;headBasic.disabled=false;root.dataset.humanHead='ready';root.dataset.humanHeadSource='lee-perry-smith-cc-by-3';I.setText(headNote,'범용 스캔 머리 · 눈을 감은 정적 에셋이며 사용자 얼굴 복원이 아닙니다.');upload();render();
  }catch{if(!disposed&&token===headGeneration){headReady=false;headBasic.checked=true;headBasic.disabled=true;root.dataset.humanHead='fallback';I.setText(headNote,'스캔 머리 재질을 준비하지 못해 기존 범용 모델을 표시합니다. 기존 모델로 계속 이용하거나 새로고침 후 확인해주세요.');upload();render();}}
  finally{release();if(releaseHeadLoad===release)releaseHeadLoad=null;}
 }
 loadHead();
 form.addEventListener('submit',e=>{e.preventDefault();update();});form.addEventListener('input',e=>{if(Object.hasOwn(G.defaults,e.target.name))manual.add(e.target.name);updateSources();if(form.checkValidity())update();});selector.addEventListener('change',update);$('#avatar-reset').addEventListener('click',reset);
 const controls={left:()=>{yaw-=.3;},right:()=>{yaw+=.3;},'zoom-in':()=>{zoom=Math.max(2,zoom-.25);},'zoom-out':()=>{zoom=Math.min(6,zoom+.25);},front:()=>{yaw=pitch=0;zoom=3.5;},side:()=>{yaw=Math.PI/2;pitch=0;},back:()=>{yaw=Math.PI;pitch=0;}};
 for(const [id,action]of Object.entries(controls))$('#avatar-'+id).addEventListener('click',()=>{action();render();});
 for(const canvas of canvases){const pointers=new Map();let previousDistance=0;
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});previousDistance=0;});
  canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(previousDistance>0)zoom=Math.max(2,Math.min(6,zoom*previousDistance/Math.max(distance,1)));previousDistance=distance;}
   else if(pointers.size===1){yaw+=(e.clientX-old.x)*.012;pitch=Math.max(-.6,Math.min(.6,pitch+(e.clientY-old.y)*.008));}schedule();
  });
  const release=e=>{pointers.delete(e.pointerId);previousDistance=0;};for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,release);
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(2,Math.min(6,zoom+e.deltaY*.002));schedule();},{passive:false});
  canvas.addEventListener('keydown',e=>{const action={ArrowLeft:controls.left,ArrowRight:controls.right,'+':controls['zoom-in'],'-':controls['zoom-out'],Home:controls.front}[e.key];if(action){e.preventDefault();action();render();}});
 }

 function clearPhoto(){const c=$('#avatar-photo-canvas');c.width=c.height=1;$('#avatar-photo-figure').hidden=true;$('#avatar-compare-photo').checked=false;root.querySelector('.avatar-views').classList.remove('photo-mode');}
 function updateSources(){
  if(referenceMetrics)I.setText($('#avatar-reference-values'),'어깨/골반 기준점 비율 {shoulder} · 다리/몸통 기준점 비율 {leg} · 사진상 참고값',{shoulder:referenceMetrics.shoulderHipRatio.toFixed(2),leg:referenceMetrics.legTorsoRatio.toFixed(2)});else I.setText($('#avatar-reference-values'),'');
  for(const key of Object.keys(G.defaults)){const badge=root.querySelector('[data-avatar-source="'+key+'"]');if(badge)I.setText(badge,manual.has(key)?'사용자 보정값':'기본 예시값 · 사진 측정 아님');}
  I.setText($('#avatar-reference'),referenceMetrics?'사진상 두 비율 적용 중 · 실제 치수 아님. 허리·가슴둘레·깊이는 추정하지 않습니다. 치수는 기본값 또는 직접 입력값입니다.':'사진 비율 미적용 · 기본 형상과 사용자 보정값입니다.');
 }
 $('#avatar-delete-all').addEventListener('click',()=>{const clear=document.querySelector('#ai-clear');if(clear)clear.click();else {reset();root.hidden=true;}});
 $('#avatar-compare-photo').addEventListener('change',()=>{
  if(!$('#avatar-compare-photo').checked){clearPhoto();return;}
  const source=document.querySelector('#ai-canvas'),result=document.querySelector('#ai-result');
  if(!source||source.width<=1||!result||result.hidden){clearPhoto();status('비교할 분석 이미지가 없습니다. 원래 화면에서 사진을 분석해주세요.');return;}
  const target=$('#avatar-photo-canvas');target.width=source.width;target.height=source.height;target.getContext('2d').drawImage(source,0,0);$('#avatar-photo-figure').hidden=false;root.querySelector('.avatar-views').classList.add('photo-mode');
 });
 document.addEventListener('a1:avatar-photo-apply',e=>{
  try{G.photoReference(e.detail?.metrics);referenceMetrics={...e.detail.metrics};root.hidden=false;update();updateSources();}
  catch{referenceMetrics=null;clearPhoto();upload();render();updateSources();status('분석 비율이 부족합니다. 기본 아바타를 사용하고 직접 보정해주세요.');}
 });
 document.addEventListener('a1:avatar-reference-clear',()=>{reset();root.hidden=true;});
 document.addEventListener('a1:avatar-open',e=>{root.hidden=false;if(['LAB-A','LAB-B','LAB-C'].includes(e.detail?.garment))selector.value=e.detail.garment;upload();render();updateSources();});
 root.dataset.loadState='ready';updateSources();

 const observer=new ResizeObserver(schedule);for(const canvas of canvases)observer.observe(canvas);
 window.addEventListener('pagehide',()=>{disposed=true;headGeneration++;releaseHeadLoad?.();observer.disconnect();params=null;referenceMetrics=null;manual.clear();clearPhoto();form.reset();selector.value='LAB-A';yaw=pitch=0;zoom=3.5;for(const v of views){v.gl.clear(v.gl.COLOR_BUFFER_BIT|v.gl.DEPTH_BUFFER_BIT);v.gl.deleteBuffer(v.buffer);v.gl.deleteBuffer(v.materialBuffer);for(const texture of v.textures)v.gl.deleteTexture(texture);v.gl.deleteProgram(v.program);v.canvas.width=v.canvas.height=1;}});
 window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
}
initializeAvatarLab();
document.addEventListener('a1:avatar-mounted',initializeAvatarLab);
