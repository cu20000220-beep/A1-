// The Nova shirt has real openings at the collar, cuffs and hem. Keep
// those garment-to-skin / garment-to-trousers boundaries fixed relative
// to the shared body deformation when adding room to the shirt itself.
const weightsByGeometry = new WeakMap();

const novaVertexCount = 3269;
const novaIndexCount = 13887;
const fixedDistance = .024;
const fullEaseDistance = .115;

function pointToSegmentSquared(x, y, z, edge) {
  const ax = x - edge.x, ay = y - edge.y, az = z - edge.z;
  const projection = (ax * edge.dx + ay * edge.dy + az * edge.dz) / edge.lengthSquared;
  const t = Math.min(1, Math.max(0, projection));
  return (ax - t * edge.dx) ** 2 + (ay - t * edge.dy) ** 2 + (az - t * edge.dz) ** 2;
}

export function novaTopEaseWeights(geometry) {
  if (!geometry?.isBufferGeometry) return null;
  if (weightsByGeometry.has(geometry)) return weightsByGeometry.get(geometry);

  const positions = geometry.getAttribute('position'), indices = geometry.getIndex();
  if (positions?.count !== novaVertexCount || positions.itemSize !== 3 || indices?.count !== novaIndexCount) return null;

  // UV islands and hard normals duplicate vertices. Weld only for finding
  // openings, keeping the authored position, index and shading buffers intact.
  const welds = new Map(), vertices = new Uint16Array(positions.count);
  for (let index = 0; index < positions.count; index++) {
    const point = [positions.getX(index), positions.getY(index), positions.getZ(index)];
    if (!point.every(Number.isFinite)) return null;
    const key = point.map(value => Math.round(value * 1e6)).join(',');
    if (!welds.has(key)) welds.set(key, index);
    vertices[index] = welds.get(key);
  }
  if (welds.size !== 2349) return null;

  const counts = new Map();
  for (let offset = 0; offset < indices.count; offset += 3) {
    const i = vertices[indices.getX(offset)], j = vertices[indices.getX(offset + 1)], k = vertices[indices.getX(offset + 2)];
    if (i === undefined || j === undefined || k === undefined || i === j || j === k || k === i) return null;
    for (const [a, b] of [[i, j], [j, k], [k, i]]) {
      const edge = Math.min(a, b) * positions.count + Math.max(a, b);
      counts.set(edge, (counts.get(edge) ?? 0) + 1);
    }
  }

  const openings = [], degree = new Map();
  for (const [edge, count] of counts) {
    if (count > 2) return null;
    if (count !== 1) continue;
    const start = Math.floor(edge / positions.count), end = edge % positions.count;
    degree.set(start, (degree.get(start) ?? 0) + 1);
    degree.set(end, (degree.get(end) ?? 0) + 1);
    const x = positions.getX(start), y = positions.getY(start), z = positions.getZ(start);
    const dx = positions.getX(end) - x, dy = positions.getY(end) - y, dz = positions.getZ(end) - z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    if (!(lengthSquared > 0)) return null;
    openings.push({ x, y, z, dx, dy, dz, lengthSquared });
  }
  // Reviewed shirt topology: 29 hem segments, 24 collar segments and
  // 8 segments on each cuff. The loops have no branched edge.
  if (openings.length !== 69 || [...degree.values()].some(count => count !== 2)) return null;

  const weights = new Float32Array(positions.count);
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    let distanceSquared = Infinity;
    for (const edge of openings) distanceSquared = Math.min(distanceSquared, pointToSegmentSquared(x, y, z, edge));
    const fraction = (Math.sqrt(distanceSquared) - fixedDistance) / (fullEaseDistance - fixedDistance);
    const t = Math.min(1, Math.max(0, fraction));
    weights[index] = t * t * (3 - 2 * t);
  }
  weightsByGeometry.set(geometry, weights);
  return weights;
}
