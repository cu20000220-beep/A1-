import * as THREE from './vendor/three-0.187.0/build/three.module.js';

export function lightNovaStage(renderer, scene) {
  scene.background = new THREE.Color('#c7c7c1');
  scene.fog = new THREE.FogExp2('#c7c7c1', .13);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.add(new THREE.HemisphereLight('#edf1f7', '#7c6e62', 1.05));
  const key = new THREE.DirectionalLight('#fff1e5', 2.6);
  key.position.set(-2.1, 3.3, 3);
  key.target.position.set(0, .92, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left:-1.1, right:1.1, top:1.1, bottom:-1.1, near:.5, far:7});
  key.shadow.normalBias = .006;
  key.shadow.bias = -.00015;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  for (const [color,intensity,position] of [['#dce7fa', .65, [2,1.8,2]], ['#fff7ee', 1.65, [1,2.7,-2]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({color:'#bdbcb5', roughness:1}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.005;
  floor.receiveShadow = true;
  scene.add(floor);
}

export function createNovaIdle(model) {
  const spine = model.getObjectByName('Spine');
  const head = model.getObjectByName('Head');
  const spinePose = new THREE.Quaternion();
  const headPose = new THREE.Quaternion();
  return (seconds, draw) => {
    spinePose.copy(spine.quaternion);
    if (head?.isBone) headPose.copy(head.quaternion);
    spine.rotateX(.013 * Math.sin(seconds * 1.55));
    spine.rotateZ(.018 * Math.sin(seconds * .76));
    if (head?.isBone) head.rotateY(.042 * Math.sin(seconds * .61));
    try { draw(); }
    finally {
      spine.quaternion.copy(spinePose);
      if (head?.isBone) head.quaternion.copy(headPose);
      model.updateMatrixWorld(true);
    }
  };
}

const colors = {navy:'#263850', terracotta:'#965848'};

export function createNovaTopPalette(pair) {
  const tint = {value:new THREE.Color(0xffffff)}, strength = {value:0};
  for (const material of [pair.standard, pair.basic]) {
    material.onBeforeCompile = shader => {
      shader.uniforms.a1TopTint = tint;
      shader.uniforms.a1TopTintStrength = strength;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 a1TopTint;\nuniform float a1TopTintStrength;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float a1TopLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 a1TopColor = a1TopTint * clamp(a1TopLuminance / 0.15, 0.18, 2.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, a1TopColor, a1TopTintStrength);
        `);
    };
    material.customProgramCacheKey = () => 'a1-nova-top-tint';
    material.needsUpdate = true;
  }
  return variant => {
    strength.value = Object.hasOwn(colors, variant) ? 1 : 0;
    if (strength.value) tint.value.set(colors[variant]);
  };
}
