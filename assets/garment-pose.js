'use strict';
(function (root) {
  const midpoint = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
  const difference = (a, b) => ({x: a.x - b.x, y: a.y - b.y});
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const length = v => Math.hypot(v.x, v.y);
  const normal = v => ({x: -v.y, y: v.x});
  const unit = (v, size) => ({x: v.x / size, y: v.y / size});
  const mix = (a, b, amount) => ({x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount});
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  function smoothstep(low, high, value) {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function visible(point) {
    return point?.visibility >= .55 && Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  function frame(points) {
    if (![11, 12, 13, 14, 15, 16, 23, 24].every(id => visible(points?.[id]))) return null;
    const left = points[11].x < points[12].x ? 11 : 12;
    const right = left === 11 ? 12 : 11;
    const shoulder = midpoint(points[left], points[right]), hip = midpoint(points[23], points[24]);
    const across = difference(points[right], points[left]), width = length(across);
    if (width < 12) return null;
    const acrossUnit = unit(across, width), downUnit = normal(acrossUnit);
    const spine = difference(hip, shoulder), height = dot(spine, downUnit);
    const hipWidth = Math.abs(dot(difference(points[23], points[24]), acrossUnit));
    if (acrossUnit.x < .72 || height < width * .55 || height > width * 3 || hipWidth < width * .25) return null;
    const arms = [left, right].map(id => {
      const start = points[id], joint = points[id + 2], end = points[id + 4];
      const upper = difference(joint, start), lower = difference(end, joint);
      const upperLength = length(upper), lowerLength = length(lower);
      return {start, joint, end, upper: unit(upper, upperLength), lower: unit(lower, lowerLength), upperLength, lowerLength};
    });
    if (arms.some(a => [a.upperLength, a.lowerLength].some(n => n < width * .14 || n > width * 1.4))) return null;
    return {shoulder, acrossUnit, downUnit, spine, width, height, hipWidth, arms};
  }

  function makeMesh(width, height, source, target) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 12 || height < 12) return null;
    const original = frame(source), pose = frame(target);
    if (!original || !pose) return null;
    const bodyScale = pose.width / original.width;
    const verticalScale = pose.height / original.height / bodyScale;
    if (verticalScale < .52 || verticalScale > 1.85) return null;
    // The interpolation at each elbow assumes the garment photo is in a
    // relatively neutral pose. Strong bends in the source are ambiguous.
    if (original.arms.some((arm, i) => dot(arm.upper, arm.lower) < .65 ||
      [pose.arms[i].upperLength / arm.upperLength, pose.arms[i].lowerLength / arm.lowerLength]
        .some(ratio => ratio / bodyScale < .32 || ratio / bodyScale > 2.1))) return null;

    const columns = 24, rows = 24, vertices = [];
    const originalHip = original.hipWidth / original.width, targetHip = pose.hipWidth / pose.width;
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const point = {x: column * width / columns, y: row * height / rows};
        const fromShoulder = difference(point, original.shoulder);
        const alongBody = dot(fromShoulder, original.downUnit) / original.height;
        const acrossBody = dot({
          x: fromShoulder.x - alongBody * original.spine.x,
          y: fromShoulder.y - alongBody * original.spine.y
        }, original.acrossUnit) / original.width;
        const taper = 1 + (clamp(targetHip / originalHip, .75, 1.3) - 1) * smoothstep(.12, 1, alongBody);
        const lateral = acrossBody * pose.width * taper;
        const torso = {
          x: pose.shoulder.x + alongBody * pose.spine.x + lateral * pose.acrossUnit.x,
          y: pose.shoulder.y + alongBody * pose.spine.y + lateral * pose.acrossUnit.y
        };
        const side = acrossBody < 0 ? 0 : 1, direction = side === 0 ? -1 : 1;
        const arm = original.arms[side], bent = pose.arms[side];
        const upper = mapSegment(point, arm.start, arm.upper, arm.upperLength, bent.start, bent.upper, bent.upperLength, bodyScale);
        const lower = mapSegment(point, arm.joint, arm.lower, arm.lowerLength, bent.joint, bent.lower, bent.lowerLength, bodyScale);
        const elbowOffset = dot(difference(point, arm.joint), arm.upper) / arm.upperLength;
        const sleeve = mix(upper, lower, smoothstep(-.24, .22, elbowOffset));
        // Fade across the sleeve seam. Near the shoulder the fabric remains
        // attached to the torso, while the outer fabric follows the arm.
        const armSide = dot(difference(point, arm.start), original.acrossUnit) * direction / original.width;
        const seam = -.20 + .07 * smoothstep(.25, .95, alongBody);
        const sleeveWeight = smoothstep(seam, seam + .24, armSide) * smoothstep(-.19, .22, alongBody);
        vertices.push(mix(torso, sleeve, sleeveWeight));
      }
    }
    return {columns, rows, vertices};
  }

  function mapSegment(point, from, fromAxis, fromLength, to, toAxis, toLength, widthScale) {
    const offset = difference(point, from);
    const along = dot(offset, fromAxis) * toLength / fromLength;
    const across = dot(offset, normal(fromAxis)) * widthScale;
    return {x: to.x + along * toAxis.x - across * toAxis.y, y: to.y + along * toAxis.y + across * toAxis.x};
  }

  function paintMesh(ctx, garment, mesh, scale) {
    const {columns, rows, vertices} = mesh;
    const points = vertices.map(p => ({x: p.x * scale, y: p.y * scale}));
    const tileWidth = garment.width / columns, tileHeight = garment.height / rows;
    ctx.imageSmoothingQuality = 'high';
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const i = row * (columns + 1) + column, x = tileWidth * column, y = tileHeight * row;
        const a = points[i], b = points[i + 1], c = points[i + columns + 1], d = points[i + columns + 2];
        paintTriangle(ctx, garment, [a, b, c], a, b, c, x, y, tileWidth, tileHeight);
        const virtualOrigin = {x: b.x + c.x - d.x, y: b.y + c.y - d.y};
        paintTriangle(ctx, garment, [b, d, c], virtualOrigin, b, c, x, y, tileWidth, tileHeight);
      }
    }
  }

  function paintTriangle(ctx, garment, points, a, b, c, x, y, width, height) {
    const across = unit(difference(b, a), width), down = unit(difference(c, a), height);
    if (across.x * down.y - across.y * down.x <= .025) return; // Folded cells are back-facing.
    const center = {x: (points[0].x + points[1].x + points[2].x) / 3, y: (points[0].y + points[1].y + points[2].y) / 3};
    ctx.save();
    ctx.beginPath();
    points.forEach((point, index) => {
      const outward = difference(point, center), radius = Math.max(1, length(outward));
      const px = point.x + .65 * outward.x / radius, py = point.y + .65 * outward.y / radius;
      if (index) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.clip();
    ctx.transform(across.x, across.y, down.x, down.y, a.x - across.x * x - down.x * y, a.y - across.y * x - down.y * y);
    const left = Math.max(0, x - 2), top = Math.max(0, y - 2);
    const sampleWidth = Math.min(garment.width - left, x + width + 2 - left);
    const sampleHeight = Math.min(garment.height - top, y + height + 2 - top);
    ctx.drawImage(garment, left, top, sampleWidth, sampleHeight, left, top, sampleWidth, sampleHeight);
    ctx.restore();
  }

  function foregroundHands(source, points) {
    const reliableDepth = point => visible(point) && Number.isFinite(point.z);
    if (![points?.[11], points?.[12]].every(reliableDepth)) return [];
    const ctx = source.getContext('2d'), patches = [];
    const shoulderDepth = (points[11].z + points[12].z) / 2;
    const shoulderWidth = length(difference(points[11], points[12]));
    for (const id of [15, 16]) {
      const wrist = points[id], tips = [points[id + 2], points[id + 4], points[id + 6]];
      if (!reliableDepth(wrist) || !(wrist.z < shoulderDepth - .05) || !tips.every(visible)) continue;
      const hand = mix(midpoint(tips[0], tips[1]), tips[2], 1 / 3);
      const forward = difference(hand, wrist), size = length(forward);
      if (size < 6 || size > shoulderWidth * .33) continue;
      const axis = unit(forward, size), sideways = normal(axis);
      const span = Math.max(...tips.map(p => Math.abs(dot(difference(p, wrist), sideways))));
      const halfWidth = Math.max(size * .34, span + size * .19);
      const middle = mix(wrist, hand, .76), radius = Math.max(size, halfWidth) * 1.35;
      const left = Math.max(0, Math.floor(middle.x - radius)), top = Math.max(0, Math.floor(middle.y - radius));
      const width = Math.min(source.width, Math.ceil(middle.x + radius)) - left;
      const height = Math.min(source.height, Math.ceil(middle.y + radius)) - top;
      if (width < 2 || height < 2) continue;
      const pixels = ctx.getImageData(left, top, width, height);
      const patch = maskHand(pixels, left, top, {wrist, hand, tips, axis, sideways, size, halfWidth});
      if (patch) patches.push({canvas: patch, left, top});
    }
    return patches;
  }

  function maskHand(pixels, left, top, shape) {
    const {width, height, data} = pixels;
    const {wrist, hand, tips, axis, sideways, size, halfWidth} = shape;
    const color = index => {
      const sum = Math.max(24, data[index] + data[index + 1] + data[index + 2]);
      return {x: data[index] / sum, y: data[index + 1] / sum};
    };
    // Use nearby pixels from this hand as the color reference. When it is
    // ambiguous, keep the result without a hand mask.
    const samples = [hand, ...tips.map(p => mix(p, hand, .22))].flatMap(point => {
      const x = Math.round(point.x - left), y = Math.round(point.y - top);
      const offsets = [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]];
      return offsets.filter(([dx, dy]) => x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height)
        .map(([dx, dy]) => color(((y + dy) * width + x + dx) * 4));
    });
    if (samples.length < 8) return null;
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const tint = {x: median(samples.map(p => p.x)), y: median(samples.map(p => p.y))};
    const spread = median(samples.map(p => length(difference(p, tint))));
    if (spread > .055) return null;
    for (let y = 0, index = 0; y < height; y++) {
      for (let x = 0; x < width; x++, index += 4) {
        const offset = {x: x + left - wrist.x, y: y + top - wrist.y};
        const along = dot(offset, axis) / size, across = dot(offset, sideways) / halfWidth;
        const edge = Math.hypot((along - .76) / .93, across);
        const spatial = smoothstep(-.1, .16, along) * (1 - smoothstep(.77, 1, edge));
        const distance = length(difference(color(index), tint));
        data[index + 3] *= spatial * (1 - smoothstep(.022 + spread, .068 + spread, distance));
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').putImageData(pixels, 0, 0);
    return canvas;
  }

  const api = {usablePose: points => Boolean(frame(points)), makeMesh, paintMesh, foregroundHands};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.A1GarmentMesh = Object.freeze(api);
})(globalThis);
