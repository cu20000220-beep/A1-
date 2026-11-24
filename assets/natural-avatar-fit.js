import { Group, Matrix4, Mesh, Vector3 } from './vendor/three-0.187.0/build/three.module.js';
import { novaTopEaseWeights } from './nova-garment-fit.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const novaBottomSilhouettes = Object.freeze({
  straight: { upperLeg: .006, lowerLeg: .023 },
  relaxed: { upperLeg: .032, lowerLeg: .009 },
  wide: { upperLeg: .041, lowerLeg: .048 }
});

function smoothStep(low, high, value) {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

function legacyScales(metrics) {
  if (metrics == null) return { shoulderScale: 1, legScale: 1 };
  const { shoulderHipRatio, legTorsoRatio } = metrics;
  if (!Number.isFinite(shoulderHipRatio) || shoulderHipRatio < .45 || shoulderHipRatio > 2.5 ||
      !Number.isFinite(legTorsoRatio) || legTorsoRatio < .6 || legTorsoRatio > 3.5) {
    throw new RangeError('natural_fit_invalid_photo_ratios');
  }
  // These are dimensionless appearance factors. Photo landmarks and stock
  // rig joints do not correspond exactly, so do not match distances directly.
  return {
    shoulderScale: clamp(Math.pow(shoulderHipRatio / 1.35, .45), .86, 1.16),
    legScale: clamp(Math.pow(legTorsoRatio / 1.7, .27), .9, 1.1)
  };
}

function fitScales(metrics, profile) {
  const legacy = legacyScales(metrics);
  const appliedAxes = [];
  function proportion(axis, low, high, manualOnly = false) {
    const entry = profile?.[axis];
    if (!entry || (entry.basis !== 'manual' && (manualOnly || entry.basis !== 'photo')) ||
        !Number.isFinite(entry.value) || entry.value < low || entry.value > high) return null;
    appliedAxes.push(axis);
    return entry.value;
  }

  const shoulderHip = proportion('shoulderHip', .45, 2.5);
  const waistHip = proportion('waistHip', .3, 2, true);
  const legTorso = proportion('legTorso', .6, 3.5);
  const legHeight = proportion('legHeight', .15, .85, true);
  const torsoHeight = proportion('torsoHeight', .08, .8, true);
  const armHeight = proportion('armHeight', .1, .8, true);
  const armLeg = armHeight == null ? proportion('armLeg', .2, 1.6) : null;
  if (!appliedAxes.length) return legacy;

  // Changes are bounded visual differences on the reviewed base shape.
  // Widths affect only the front silhouette, not chest, waist or hip girth.
  const breadth = shoulderHip == null ? 1 : Math.pow(shoulderHip / 1.35, .38);
  const shoulderScale = shoulderHip == null ? legacy.shoulderScale : clamp(breadth, .86, 1.16);
  const hipScale = clamp(Math.pow(breadth, -.65), .92, 1.09);
  const waistScale = waistHip == null ? 1 : clamp(Math.pow(waistHip / .80, .55), .85, 1.16);

  // The feet and neckline stay anchored. Relative upper- and lower-body
  // lengths share the hip transition rather than moving the whole avatar.
  const lengthCues = [];
  if (legTorso != null) lengthCues.push(Math.pow(legTorso / 1.7, .35));
  if (legHeight != null) lengthCues.push(Math.pow(legHeight / .47, .42));
  if (torsoHeight != null) lengthCues.push(Math.pow(.28 / torsoHeight, .40));
  const meanLength = lengthCues.length ? lengthCues.reduce((sum, cue) => sum + cue, 0) / lengthCues.length : legacy.legScale;
  const armScale = armHeight != null ? clamp(Math.pow(armHeight / .31, .42), .87, 1.13) :
    armLeg != null ? clamp(Math.pow(armLeg / .62, .42), .87, 1.13) : 1;
  return {
    shoulderScale, hipScale, waistScale, legScale: clamp(meanLength, .86, 1.14), armScale,
    appliedAxes: Object.freeze(appliedAxes)
  };
}

function fitFrame(model, parentInverse, scales) {
  const joint = name => {
    const bone = model.getObjectByName(name);
    if (!bone?.isBone) throw Error('natural_fit_joint_missing');
    return bone.getWorldPosition(new Vector3()).applyMatrix4(parentInverse);
  };
  const [left, right] = [joint('LeftArm'), joint('RightArm')];
  const shoulder = left.clone().lerp(right, .5);
  const hips = [joint('LeftUpLeg'), joint('RightUpLeg')];
  const ankles = [joint('LeftFoot'), joint('RightFoot')];
  const hip = hips[0].clone().lerp(hips[1], .5);
  const ankle = ankles[0].clone().lerp(ankles[1], .5);
  const halfWidth = Math.abs(left.x - right.x) / 2;
  const torsoHeight = shoulder.y - hip.y;
  if (!(halfWidth > .02 && torsoHeight > .05 && hip.y - ankle.y > .05)) throw Error('natural_fit_frame_invalid');
  const arms = scales.armScale != null && scales.armScale !== 1 ? ['Left', 'Right'].map((side, index) => {
    const start = index ? right : left;
    const axis = joint(side + 'Hand').sub(start);
    const length = axis.length();
    if (!(length > .05)) throw Error('natural_fit_arm_frame_invalid');
    return { start, axis: axis.multiplyScalar(1 / length), length };
  }) : [];
  return { shoulder, hip, ankle, hips, ankles, halfWidth, torsoHeight, arms };
}

function makeDeformation(frame, scales, legShift) {
  const { shoulder, hip, ankle, halfWidth, torsoHeight, arms } = frame;
  const hipDelta = (scales.hipScale ?? 1) - 1;
  const waistDelta = (scales.waistScale ?? 1) - 1;
  const armDelta = (scales.armScale ?? 1) - 1;
  return (point, target, ease, armWeights) => {
    const { x, y, z } = point;
    const torso = (y - hip.y) / torsoHeight;
    const offsetX = x - shoulder.x;
    // The centre of the neckline and the exact head/neck seam stay in place.
    // Fabric and exposed skin at a matching point get the same deformation.
    const shoulderWeight = smoothStep(-.32, .9, torso) * (1 - smoothStep(.96, 1.07, torso));
    const offsetWidth = halfWidth * clamp((Math.abs(offsetX) / halfWidth - .60) / .40, 0, 1);
    const shoulderShift = Math.sign(offsetX) * offsetWidth * shoulderWeight * (scales.shoulderScale - 1);
    const legWeight = smoothStep(ankle.y, hip.y, y) * (1 - smoothStep(.02, .86, torso));
    target.set(x + shoulderShift, y + legShift * legWeight, z);

    const torsoInfluence = clamp(1 - armWeights[0] - armWeights[1], 0, 1);
    const hipBand = smoothStep(-.67, -.19, torso) * (1 - smoothStep(.07, .46, torso));
    const waistBand = smoothStep(.02, .28, torso) * (1 - smoothStep(.34, .63, torso));
    target.x += (x - hip.x) * torsoInfluence * (hipBand * hipDelta + waistBand * waistDelta);

    // Extend each upper limb along the stock posed shoulder-to-wrist line.
    // Native skin weights keep sleeves attached and prevent torso movement.
    // The shift is constant past the wrist so finger lengths stay intact.
    for (let i = 0; i < arms.length; i++) {
      const { start, axis, length } = arms[i];
      const projected = (x - start.x) * axis.x + (y - start.y) * axis.y + (z - start.z) * axis.z;
      target.addScaledVector(axis, clamp(projected, 0, length) * armDelta * armWeights[i]);
    }
    if (ease > 0) {
      const weighting = smoothStep(.02, .24, torso) * (1 - smoothStep(.64, .94, torso)) *
        (1 - smoothStep(.8, 1.16, Math.abs(offsetX) / halfWidth)) * ease;
      const centreZ = hip.z + (shoulder.z - hip.z) * clamp(torso, 0, 1);
      target.x += Math.tanh(offsetX / (halfWidth * .55)) * weighting * .012;
      target.z += Math.tanh((z - centreZ) / .06) * weighting * .018;
    }
    return target;
  };
}

function makeNovaBottomDeformation(frame, silhouette, deform) {
  const { hip, ankle, hips, ankles } = frame;
  const { upperLeg, lowerLeg } = silhouette;
  return (point, target, ease, armWeights) => {
    const { x, y, z } = point;
    deform(point, target, ease, armWeights);
    const fraction = (y - ankle.y) / (hip.y - ankle.y);
    // Preserve the stock waistband and cuffs. Spread the fabric smoothly
    // between their seams, using the same posed leg centres as the avatar.
    const weighting = smoothStep(.05, .27, fraction) * (1 - smoothStep(.68, .94, fraction));
    if (weighting === 0) return target;
    const offset = x - hip.x;
    const side = x >= hip.x ? 0 : 1;
    const centreX = ankles[side].x + (hips[side].x - ankles[side].x) * fraction;
    const centreZ = ankles[side].z + (hips[side].z - ankles[side].z) * fraction;
    const taper = smoothStep(.31, .69, fraction);
    const allowance = (lowerLeg + (upperLeg - lowerLeg) * taper) * weighting;
    const medial = smoothStep(0, .05, Math.abs(offset));
    const spreadX = allowance * clamp((x - centreX) / .07, -1, 1) * medial;
    target.x += clamp(spreadX, -Math.abs(offset) * .65, Math.abs(offset) * .65);
    target.z += allowance * .5 * clamp((z - centreZ) / .08, -1, 1) * medial;
    return target;
  };
}

function armWeightsFor(mesh) {
  const joints = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  const sides = mesh.skeleton.bones.map(bone => {
    if (/^Left(?:Arm|ForeArm|Hand)/.test(bone.name)) return 0;
    if (/^Right(?:Arm|ForeArm|Hand)/.test(bone.name)) return 1;
    return -1;
  });
  return (index, result) => {
    result[0] = result[1] = 0;
    for (let component = 0; component < 4; component++) {
      const side = sides[joints.getComponent(index, component)];
      if (side === 0 || side === 1) result[side] += weights.getComponent(index, component);
    }
  };
}

function bakeGeometry(mesh, parentInverse, deform, useEase, useArmWeights) {
  if (!mesh?.isSkinnedMesh || !mesh.geometry.getAttribute('normal')) throw Error('natural_fit_mesh_invalid');
  const geometry = mesh.geometry.clone();
  try {
    const positions = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal');
    const outputPositions = geometry.getAttribute('position'), outputNormals = geometry.getAttribute('normal');
    const meshToParent = new Matrix4().multiplyMatrices(parentInverse, mesh.matrixWorld);
    const point = new Vector3(), normal = new Vector3(), tangent = new Vector3(), bitangent = new Vector3();
    const result = new Vector3(), dx = new Vector3(), dy = new Vector3();
    const up = new Vector3(0, 1, 0), right = new Vector3(1, 0, 0);
    const normalStep = .00015;
    const armWeights = [0, 0];
    const getArmWeights = useArmWeights ? armWeightsFor(mesh) : null;
    for (let index = 0; index < positions.count; index++) {
      mesh.getVertexPosition(index, point).applyMatrix4(meshToParent);
      // The stock body and outfit have no morph targets. A second point
      // transformed through the same skin weights recovers the posed normal.
      normal.fromBufferAttribute(normals, index).add(result.fromBufferAttribute(positions, index));
      mesh.applyBoneTransform(index, normal).applyMatrix4(meshToParent).sub(point).normalize();
      tangent.crossVectors(Math.abs(normal.y) < .9 ? up : right, normal).normalize();
      bitangent.crossVectors(normal, tangent);
      const ease = useEase(index);
      getArmWeights?.(index, armWeights);
      deform(point, result, ease, armWeights);
      // Deform both surface directions, then recalculate the normal. This
      // keeps smooth UV seams and normal-map lighting on the modified mesh.
      deform(dx.copy(point).addScaledVector(tangent, normalStep), dx, ease, armWeights).sub(result);
      deform(dy.copy(point).addScaledVector(bitangent, normalStep), dy, ease, armWeights).sub(result);
      const adjusted = tangent.crossVectors(dx, dy);
      if (adjusted.lengthSq() > 1e-19) normal.copy(adjusted).normalize();
      outputPositions.setXYZ(index, result.x, result.y, result.z);
      outputNormals.setXYZ(index, normal.x, normal.y, normal.z);
    }
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}

export function createNaturalFit(model, metrics, { topVertices, relaxed = false, profile, bottomFit } = {}) {
  const scales = fitScales(metrics, profile);
  const parentInverse = new Matrix4();
  if (model.parent) {
    model.parent.updateMatrixWorld(true);
    parentInverse.copy(model.parent.matrixWorld).invert();
  } else model.updateMatrixWorld(true);
  const frame = fitFrame(model, parentInverse, scales);
  const legSpan = frame.hip.y - frame.ankle.y;
  const hasLengthCues = scales.appliedAxes?.some(axis => ['legTorso', 'legHeight', 'torsoHeight'].includes(axis));
  const legLimit = frame.torsoHeight * (hasLengthCues ? .19 : .15);
  const legShift = clamp(legSpan * (scales.legScale - 1), -legLimit, legLimit);
  const deform = makeDeformation(frame, scales, legShift);
  const useArmWeights = frame.arms.length > 0 || (scales.hipScale ?? 1) !== 1 || (scales.waistScale ?? 1) !== 1;
  const sourceBody = model.getObjectByName('AvatarBody');
  const combinedOutfit = model.getObjectByName('outfit');
  const outfitNames = combinedOutfit ? ['outfit'] : ['outfit_top', 'outfit_bottom', 'outfit_shoes'];
  const outfitSources = outfitNames.map(name => model.getObjectByName(name));
  if (![sourceBody, ...outfitSources].every(source => source?.isSkinnedMesh)) throw Error('natural_fit_mesh_invalid');
  const topSource = outfitSources[0];
  const bottomSource = !combinedOutfit && Object.hasOwn(novaBottomSilhouettes, bottomFit) ? outfitSources[1] : null;
  const deformBottom = bottomSource ? makeNovaBottomDeformation(frame, novaBottomSilhouettes[bottomFit], deform) : deform;
  const count = topSource.geometry.getAttribute('position').count;
  const top = topVertices instanceof Uint8Array && topVertices.length === count
    ? topVertices
    : topVertices instanceof Set || Array.isArray(topVertices)
      ? new Set([...topVertices].filter(index => Number.isInteger(index) && index >= 0 && index < count))
      : null;
  const validTop = top instanceof Uint8Array ? top.includes(1) : Boolean(top?.size);
  const eased = relaxed === true && validTop;
  const novaWeights = eased && topSource.name === 'outfit_top' ? novaTopEaseWeights(topSource.geometry) : null;
  const useEase = index => {
    if (!eased || !(top instanceof Uint8Array ? top[index] === 1 : top.has(index))) return 0;
    return novaWeights ? novaWeights[index] : 1;
  };
  const group = new Group(), parts = [];
  group.name = 'PhotoProportionedAvatar';
  const dispose = () => {
    group.removeFromParent();
    for (const { mesh } of parts) mesh.geometry.dispose();
  };
  try {
    for (const source of [sourceBody, ...outfitSources]) {
      const geometry = bakeGeometry(source, parentInverse, source === bottomSource ? deformBottom : deform,
        source === topSource ? useEase : () => 0, useArmWeights);
      const mesh = new Mesh(geometry, source.material);
      mesh.name = source === sourceBody ? 'PhotoProportionedBody' :
        source === topSource ? 'PhotoProportionedOutfit' : 'PhotoProportioned_' + source.name;
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.renderOrder = source.renderOrder;
      parts.push({ source, mesh });
      group.add(mesh);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    group, parts, body: parts[0].mesh, outfit: parts[1].mesh,
    profile: Object.freeze({
      ...scales,
      ...(scales.appliedAxes ? { legScale: 1 + legShift / legSpan, torsoScale: 1 - legShift / frame.torsoHeight } : {}),
      ...(bottomSource ? { bottomFit } : {}),
      relaxed: eased
    }),
    dispose
  };
}
