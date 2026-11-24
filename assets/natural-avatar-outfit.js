import { Color, DynamicDrawUsage, Float32BufferAttribute } from './vendor/three-0.187.0/build/three.module.js';

const shirtColors = Object.freeze({
  source: '#ffffff',
  navy: '#263e58',
  terracotta: '#b36955'
});

// The reviewed sample packs the shirt, jeans and shoes into one skinned
// primitive and one texture atlas. Find the shirt in rest space by welding
// the UV seams for the connectivity check only; retain the render geometry
// as-is, including its original indices, skin weights, normals and UVs.
export function identifyNaturalTop(geometry) {
  const position = geometry?.getAttribute('position');
  const index = geometry?.getIndex();
  if (!position || position.count !== 5362 || index?.count !== 21786) throw Error('natural_top_geometry_invalid');

  const parent = new Uint16Array(position.count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  function root(vertex) {
    while (parent[vertex] !== vertex) {
      parent[vertex] = parent[parent[vertex]];
      vertex = parent[vertex];
    }
    return vertex;
  }
  function join(first, second) { parent[root(first)] = root(second); }
  for (let offset = 0; offset < index.count; offset += 3) {
    const first = index.getX(offset);
    join(first, index.getX(offset + 1));
    join(first, index.getX(offset + 2));
  }

  const coincident = new Map();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const coordinates = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)];
    const key = coordinates.map(component => Math.round(component * 1e6)).join(',');
    if (coincident.has(key)) join(vertex, coincident.get(key));
    else coincident.set(key, vertex);
  }

  const components = new Map();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const component = root(vertex), height = position.getY(vertex);
    const range = components.get(component) ?? {count: 0, min: Infinity, max: -Infinity};
    range.count++;
    range.min = Math.min(range.min, height);
    range.max = Math.max(range.max, height);
    components.set(component, range);
  }
  // These height bounds fingerprint the shirt component on this approved
  // asset. The jeans can reach above the shirt's hem and must be excluded by
  // topology, so no per-vertex height cutoff is used.
  const matches = [...components].filter(([, range]) => range.min > 1.01 && range.max > 1.45);
  if (matches.length !== 1 || matches[0][1].count !== 774) throw Error('natural_top_geometry_invalid');
  const component = matches[0][0];
  return Uint8Array.from(parent, (_, vertex) => Number(root(vertex) === component));
}

// Vertex color multiplies the sample cloth atlas without replacing its
// texture or normal details. White keeps the jeans, shoes and original
// shirt unmodified. Both lighting modes consume the same color attribute.
export function setNaturalTopColor(geometry, pair, membership, variant) {
  if (!Object.hasOwn(shirtColors, variant) || !pair?.standard?.isMaterial || !pair.basic?.isMaterial ||
      !(membership instanceof Uint8Array) || membership.length !== geometry?.getAttribute('position')?.count) return false;

  let color = geometry.getAttribute('color');
  if (!color) {
    color = new Float32BufferAttribute(new Float32Array(membership.length * 3), 3);
    color.setUsage(DynamicDrawUsage);
    geometry.setAttribute('color', color);
  }
  if (color.itemSize !== 3 || color.count !== membership.length) return false;
  const tint = new Color(shirtColors[variant]);
  for (let vertex = 0; vertex < membership.length; vertex++) {
    if (membership[vertex]) color.setXYZ(vertex, tint.r, tint.g, tint.b);
    else color.setXYZ(vertex, 1, 1, 1);
  }
  color.needsUpdate = true;
  for (const material of [pair.standard, pair.basic]) {
    if (!material.vertexColors) {
      material.vertexColors = true;
      material.needsUpdate = true;
    }
  }
  return true;
}
