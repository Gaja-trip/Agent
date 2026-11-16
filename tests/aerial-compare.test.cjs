const test = require('node:test');
const assert = require('node:assert/strict');
const compare = require('../assets/aerial-compare.js');

test('past imagery uses the official 2007 XYZ catalog rather than the current Satellite layer', () => {
  assert.equal(compare.tileTemplate, 'https://cdn.vworld.kr/2d/Satellite/2007/{z}/{x}/{y}.png');
  assert.match(decodeURIComponent(compare.emptyTile), /2007년 영상 없음/);
});

test('comparison divider stays reachable and invalid positions reset to the middle', () => {
  for (const [value, expected] of [[-20, 5], [0, 5], [25, 25], [100, 95], [NaN, 50], [Infinity, 50]]) {
    assert.equal(compare.normalizePosition(value), expected);
  }
});

test('past imagery clipping follows the map pane offset during panning and resizing', () => {
  const map = { getSize: () => ({ x: 800, y: 600 }), containerPointToLayerPoint: ([x, y]) => ({ x: x - 130, y: y + 45 }) };
  assert.equal(compare.clipRect(map, 50), 'rect(45px, 670px, 645px, 270px)');
  assert.equal(compare.clipRect(map, 75), 'rect(45px, 670px, 645px, 470px)');
  map.getSize = () => ({ x: 400, y: 800 });
  assert.equal(compare.clipRect(map, 50), 'rect(45px, 270px, 845px, 70px)');
  map.getSize = () => ({ x: 0, y: 0 });
  assert.equal(compare.clipRect(map, 50), '');
});
