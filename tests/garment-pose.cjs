'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { makeMesh } = require('../assets/garment-pose.js');

const width = 240;
const height = 240;
const point = (x, y, visibility = 1) => ({ x, y, z: 0, visibility });

function standingPose() {
  const points = [];
  points[11] = point(160, 50);
  points[12] = point(80, 50);
  points[13] = point(180, 100);
  points[14] = point(60, 100);
  points[15] = point(200, 150);
  points[16] = point(40, 150);
  points[23] = point(150, 150);
  points[24] = point(90, 150);
  return points;
}

function vertexAt(mesh, x, y) {
  const column = Math.round(x / width * mesh.columns);
  const row = Math.round(y / height * mesh.rows);
  return mesh.vertices[row * (mesh.columns + 1) + column];
}

test('matching garment and wearer poses preserve the mesh coordinates', () => {
  const source = standingPose();
  const mesh = makeMesh(width, height, source, standingPose());
  assert.ok(mesh);
  const { columns, rows, vertices } = mesh;
  assert.equal(vertices.length, (columns + 1) * (rows + 1));
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const vertex = vertices[row * (columns + 1) + column];
      assert.ok(Math.abs(vertex.x - column * width / columns) < 1);
      assert.ok(Math.abs(vertex.y - row * height / rows) < 1);
    }
  }
});

test('the sleeves follow a bend in each arm while the torso remains centered', () => {
  const source = standingPose();
  const target = standingPose();
  target[13] = point(200, 100);
  target[14] = point(40, 100);
  target[15] = point(160, 130);
  target[16] = point(80, 130);

  const mesh = makeMesh(width, height, source, target);
  assert.ok(mesh);
  const rightCuff = vertexAt(mesh, 200, 150);
  const leftCuff = vertexAt(mesh, 40, 150);
  const chest = vertexAt(mesh, 120, 100);
  assert.ok(rightCuff.x < 180 && rightCuff.y < 145, JSON.stringify(rightCuff));
  assert.ok(leftCuff.x > 60 && leftCuff.y < 145, JSON.stringify(leftCuff));
  assert.ok(Math.abs(chest.x - 120) < 5 && Math.abs(chest.y - 100) < 5, JSON.stringify(chest));
});

test('missing or unreliable joints and invalid torso measurements reject the warp', () => {
  const source = standingPose();
  const target = standingPose();
  delete target[15];
  assert.equal(makeMesh(width, height, source, target), null);
  target[15] = point(200, 150, 0.1);
  assert.equal(makeMesh(width, height, source, target), null);
  target[15] = point(200, 150);
  target[11] = target[12];
  assert.equal(makeMesh(width, height, source, target), null);

  source[13] = point(Number.NaN, 100);
  assert.equal(makeMesh(width, height, source, standingPose()), null);
});
