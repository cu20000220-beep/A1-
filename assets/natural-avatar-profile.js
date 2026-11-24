import { Box3, DoubleSide, Quaternion, TextureLoader, Vector3 } from './vendor/three-0.187.0/build/three.module.js';

// Original A1 presentation code for the fixed, reviewed stock sample. It changes
// the displayed pose and hair alpha handling, never body measurements/identity.
const applied = new WeakMap();

export function useEmbeddedImageElements(loader, manager) {
  // GLTFLoader's ImageBitmapLoader fetches blob: URLs, which requires a wider
  // connect-src policy. Image elements decode the same embedded bytes using
  // the existing img-src blob: permission; no global browser APIs are changed.
  loader.register(parser => {
    parser.textureLoader = new TextureLoader(manager);
    return { name: 'A1EmbeddedImageElement' };
  });
}

export function applyNaturalProfile(model, { nova = false } = {}) {
  if (applied.has(model)) return applied.get(model);
  model.updateMatrixWorld(true);
  const original = new Box3().setFromObject(model), height = original.max.y - original.min.y;
  if (!Number.isFinite(height) || height <= 0) throw Error('natural_profile_bounds');
  model.scale.multiplyScalar(1.7 / height);
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model), centre = bounds.getCenter(new Vector3());
  model.position.x -= centre.x; model.position.y -= bounds.min.y; model.position.z -= centre.z;
  model.updateMatrixWorld(true);

  const hair = model.getObjectByName('haircut');
  if (!nova && (!hair?.material || Array.isArray(hair.material))) throw Error('natural_profile_hair_missing');
  // The source contains real hair cards. A depth-writing cutout prevents the
  // translucent overlapping rectangles seen with ordinary blend sorting.
  // Avoid alpha-to-coverage dithering and additional copied hair meshes.
  if (hair) {
    hair.material.transparent = false;
    hair.material.alphaTest = 0.18;
    hair.material.alphaToCoverage = false;
    hair.material.depthWrite = true;
    hair.material.side = DoubleSide;
    hair.material.roughness = 0.85;
    hair.material.needsUpdate = true;
  }

  function pointBone(name, childName, target) {
    const bone = model.getObjectByName(name), child = model.getObjectByName(childName);
    if (!bone?.isBone || !child?.isBone || !bone.parent) throw Error('natural_profile_rig_missing');
    model.updateMatrixWorld(true);
    const direction = child.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3()));
    if (direction.lengthSq() < 1e-10) throw Error('natural_profile_joint_length');
    const delta = new Quaternion().setFromUnitVectors(direction.normalize(), new Vector3(...target).normalize());
    const world = bone.getWorldQuaternion(new Quaternion()).premultiply(delta);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));
    model.updateMatrixWorld(true);
  }

  for (const side of ['Left', 'Right']) {
    const arm = model.getObjectByName(side + 'Arm');
    if (!arm?.isBone) throw Error('natural_profile_rig_missing');
    const sign = Math.sign(arm.getWorldPosition(new Vector3()).x) || 1;
    const left = side === 'Left';
    pointBone(side + 'Arm', side + 'ForeArm', nova ? [sign * (left ? .19 : .23), -.97, left ? .08 : -.045] : [sign * .24, -.97, .025]);
    pointBone(side + 'ForeArm', side + 'ForeArm1', nova ? [sign * (left ? .045 : .10), -.98, left ? .19 : .16] : [sign * .15, -.98, .10]);
  }
  if (nova) {
    const head = model.getObjectByName('Head');
    if (head?.isBone) { head.rotateY(.09); head.rotateZ(-.035); }
    model.updateMatrixWorld(true);
  }
  const spine = model.getObjectByName('Spine');
  if (!spine?.isBone) throw Error('natural_profile_rig_missing');
  const result = { spine, spineNeutralQuaternion: spine.quaternion.clone(), referenceHeight: 1.7,
    pose: 'relaxed-stock-reference', hair: 'single-pass-alpha-cutout', bodyMeasurements: false };
  applied.set(model, result);
  return result;
}
