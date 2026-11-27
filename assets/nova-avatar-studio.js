import * as THREE from './vendor/three-0.187.0/build/three.module.js';

export function lightNovaStage(renderer, scene, { compactShadows = false } = {}) {
  const backdrop = '#ddd3c8';
  scene.background = new THREE.Color(backdrop);
  scene.fog = new THREE.FogExp2(backdrop, .18);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.add(new THREE.HemisphereLight('#f5f3f0', '#9b8c7c', 1.22));
  // A higher light keeps the floor shadow close to the feet. A frontal fill
  // keeps faces and the fabric texture readable from the default angle.
  const key = new THREE.DirectionalLight('#fff8f1', 2.32);
  key.position.set(-1.35, 5.8, 1.75);
  key.target.position.set(0, .86, 0);
  key.castShadow = true;
  const shadowSize = compactShadows ? 512 : 1024;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, {left:-1.1, right:1.1, top:1.1, bottom:-1.1, near:.5, far:8});
  key.shadow.normalBias = .008;
  key.shadow.bias = -.00015;
  key.shadow.radius = compactShadows ? 5 : 10;
  key.shadow.intensity = .56;
  scene.add(key, key.target);
  for (const [color,intensity,position] of [['#eff4ff', 1.22, [1.8,1.65,2.6]], ['#fff5e9', 1.23, [.65,2.5,-2.1]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({color:'#cbc1b5', roughness:1}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.005;
  floor.receiveShadow = true;
  scene.add(floor);
}

export function createNovaIdle(model, stage) {
  const spine = model.getObjectByName('Spine');
  const head = model.getObjectByName('Head');
  const spinePose = new THREE.Quaternion();
  const headPose = new THREE.Quaternion();
  const stagePose = new THREE.Quaternion();
  return (seconds, draw, fitted) => {
    if (fitted) {
      // Body and clothing are baked in the adjusted proportions. Moving the
      // common parent keeps them in contact with the original head and hair.
      stagePose.copy(stage.quaternion);
      stage.rotateY(.016 * Math.sin(seconds * .76));
      stage.rotateZ(.006 * Math.sin(seconds * 1.23));
      try { draw(); }
      finally { stage.quaternion.copy(stagePose); stage.updateMatrixWorld(true); }
      return;
    }
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
