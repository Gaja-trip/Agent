const test = require("node:test");
const assert = require("node:assert/strict");
const { buildUrl, defaultPoint } = require("../assets/aerial-roadview.js");

test("roadview links pass the selected coordinates and preserve comparison dates and view direction", () => {
  const point = { latitude: 35.76845213, longitude: 126.69821354 };
  const url = new URL(buildUrl(point));
  assert.equal(url.origin, "https://roadview-sync-360.hopesound.chatgpt.site");
  assert.equal(url.pathname, "/");
  assert.equal(Number(url.searchParams.get("lat")), point.latitude);
  assert.equal(Number(url.searchParams.get("lng")), point.longitude);
  assert.equal(url.searchParams.get("dates"), "2024-06-20,2022-05-25,2019-05-25,");
  assert.equal(url.searchParams.get("pan"), "266.29");
  assert.equal(url.searchParams.get("tilt"), "6.11");
  assert.equal(url.searchParams.get("zoom"), "3");
  assert.equal(Number(new URL(buildUrl()).searchParams.get("lat")), defaultPoint.latitude);
});

test("roadview links reject missing or invalid coordinates without inventing a location", () => {
  for (const point of [null, {}, {latitude: "", longitude: 126}, {latitude: NaN, longitude: 126}, {latitude: 35, longitude: Infinity}, {latitude: 91, longitude: 126}, {latitude: 35, longitude: -181}]) {
    assert.throws(() => buildUrl(point), TypeError);
  }
  assert.equal(Number(new URL(buildUrl({ latitude: 0, longitude: 0 })).searchParams.get("lat")), 0);
});
