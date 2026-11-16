import { Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial } from './vendor/three-0.187.0/build/three.module.js';

// Original, procedural SF surface on the existing CC0 body. No character model,
// texture download, personal photo, extra geometry or external service is used.
export const HUMANOID_STYLE = Object.freeze({
  id: 'a1-synthetic-humanoid-v1',
  label: 'SF 휴머노이드',
  geometryChanged: false,
  externalAssets: false,
  textures: 0
});

const rgb = hex => {
  const color = new Color(hex);
  return `vec3(${color.r.toFixed(7)},${color.g.toFixed(7)},${color.b.toFixed(7)})`;
};

const common = `
varying vec3 vA1HumanoidRest;
float a1Band(float coordinate, float centre, float halfWidth) {
  float aa = max(fwidth(coordinate), 0.0002);
  return 1.0 - smoothstep(halfWidth, halfWidth + aa, abs(coordinate - centre));
}
float a1Range(float coordinate, float low, float high) {
  float aa = max(fwidth(coordinate), 0.0003);
  return smoothstep(low - aa, low + aa, coordinate) * (1.0 - smoothstep(high - aa, high + aa, coordinate));
}
`;

const surface = `
  vec3 a1P = vA1HumanoidRest;
  float a1X = abs(a1P.x);
  float a1Front = smoothstep(0.012, 0.055, a1P.z);
  float a1Back = 1.0 - smoothstep(-0.070, -0.025, a1P.z);
  float a1Torso = a1Range(a1P.y, 0.88, 1.43) * (1.0 - smoothstep(0.19, 0.24, a1X));
  float a1Head = smoothstep(1.468, 1.495, a1P.y);

  // Teal armour is painted on one continuous body, with darker flank panels.
  // Every pattern is evaluated in undeformed local coordinates, so skinning
  // bends the pattern with the body instead of sliding a screen-space overlay.
  vec3 a1Colour = ${rgb('#14545b')};
  float a1Flank = smoothstep(0.105, 0.17, a1X) * a1Torso;
  a1Colour = mix(a1Colour, ${rgb('#122b36')}, a1Flank * 0.83);
  float a1Shin = a1Range(a1P.y, 0.11, 0.54);
  a1Colour = mix(a1Colour, ${rgb('#183940')}, a1Shin * 0.65);

  // A tapered sternum panel and narrow joint accents preserve anatomy.
  float a1PanelWidth = mix(0.027, 0.075, smoothstep(1.03, 1.40, a1P.y));
  float a1ChestPanel = (1.0 - smoothstep(a1PanelWidth, a1PanelWidth + 0.002, a1X)) * a1Torso * a1Front;
  a1Colour = mix(a1Colour, ${rgb('#7f294c')}, a1ChestPanel);
  float a1Forearm = smoothstep(0.18, 0.23, a1X) * a1Range(a1P.y, 0.87, 1.12);
  a1Colour = mix(a1Colour, ${rgb('#702a48')}, a1Forearm * 0.72);

  float a1Gold = a1Band(a1X, a1PanelWidth, 0.0014) * a1Torso * a1Front;
  a1Gold = max(a1Gold, a1Band(a1P.y, 0.945, 0.0016) * (1.0 - smoothstep(0.18, 0.22, a1X)));
  a1Gold = max(a1Gold, a1Band(a1P.x, 0.0, 0.0015) * a1Range(a1P.y, 0.98, 1.43) * a1Back);
  float a1LegTrack = mix(0.083, 0.125, smoothstep(0.45, 0.87, a1P.y));
  a1Gold = max(a1Gold, a1Band(a1X, a1LegTrack, 0.0011) * a1Range(a1P.y, 0.15, 0.83) * a1Front);

  // Bald burgundy face: the existing nose, lips, cheekbones and ears remain
  // actual body geometry, rather than a helmet or attached primitive head.
  a1Colour = mix(a1Colour, ${rgb('#a73057')}, a1Head);
  float a1FaceFront = smoothstep(0.067, 0.09, a1P.z) * a1Head;
  float a1Temple = a1Band(a1X, 0.059 - (a1P.y - 1.60) * 0.16, 0.0012) * a1Range(a1P.y, 1.535, 1.651) * a1FaceFront;
  float a1Brow = a1Band(a1P.y, 1.604 + a1X * 0.08, 0.0010) * a1Range(a1X, 0.017, 0.061) * a1FaceFront;
  a1Gold = max(a1Gold, max(a1Temple, a1Brow));

  // Inlaid forehead diamond and eye apertures are surface regions. They add
  // no separate meshes and cannot float away during the two-joint rig test.
  float a1DiamondDistance = abs(a1P.x) / 0.012 + abs(a1P.y - 1.637) / 0.018;
  float a1DiamondAA = max(fwidth(a1DiamondDistance), 0.02);
  float a1Diamond = (1.0 - smoothstep(1.0 - a1DiamondAA, 1.0 + a1DiamondAA, a1DiamondDistance)) * a1FaceFront;
  a1Gold = max(a1Gold, a1Diamond);
  a1Gold = clamp(a1Gold, 0.0, 1.0);
  a1Colour = mix(a1Colour, ${rgb('#d0ac65')}, a1Gold);

  vec2 a1Eye = vec2((a1X - 0.035) / 0.012, (a1P.y - 1.584) / 0.0045);
  float a1EyeDistance = dot(a1Eye, a1Eye);
  float a1Eyes = (1.0 - smoothstep(0.70, 1.05, a1EyeDistance)) * a1FaceFront;
  a1Colour = mix(a1Colour, ${rgb('#f4e6bc')}, a1Eyes);
  diffuseColor.rgb = a1Colour;
`;

export function createHumanoidMaterial(sourceMaterial, { unlit = false } = {}) {
  const options = { color: '#ffffff', side: sourceMaterial?.side ?? FrontSide, vertexColors: false };
  const material = unlit ? new MeshBasicMaterial(options) : new MeshStandardMaterial({
    ...options, roughness: 0.42, metalness: 0.34
  });
  material.name = unlit ? 'A1 SF humanoid · basic' : 'A1 SF humanoid · PBR';
  material.userData.a1Style = HUMANOID_STYLE.id;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vA1HumanoidRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvA1HumanoidRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + common)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + surface);
    if (!unlit) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.43, 0.35, a1Head), 0.29, a1Gold);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(mix(0.34, 0.24, a1Head), 0.58, a1Gold);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ' + rgb('#ffcf69') + ' * (a1Diamond * 0.28 + a1Eyes * 0.20);');
    }
  };
  material.customProgramCacheKey = () => HUMANOID_STYLE.id + (unlit ? '-basic' : '-standard');
  return material;
}
