import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wgs84ToWcongnamul, wcongnamulToWgs84,
  parseLocation, buildLocationSearch, buildLocationUrl,
} from '../../roadview/geo.mjs';

const DEFAULTS = { lat: 36.6, lng: 127.5, pan: 90, tilt: 5, zoom: 1, panoid: 1234567 };
const near = (actual, expected, tolerance) => assert.ok(
  Math.abs(actual - expected) < tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`,
);

test('matches coordinate examples published by Kakao, within 1 cm', () => {
  // https://apis.map.kakao.com/web/documentation/#LatLng_toCoords
  const central = wgs84ToWcongnamul({ lat: 37, lng: 127 });
  near(central.x, 500000, 0.01);
  near(central.y, 972532.3892234056, 0.01);

  // https://devtalk.kakao.com/t/topic/38086 (Kakao staff's examples).
  const jeju = wgs84ToWcongnamul({ lat: 33.450701, lng: 126.570667 });
  near(jeju.x, 400206.345643045, 0.01);
  near(jeju.y, -11702.439372717636, 0.01);
  const seoul = wcongnamulToWgs84({ x: 495285.98, y: 1129802.99 });
  near(seoul.lat, 37.56682596942951, 1e-7);
  near(seoul.lng, 126.97865669538913, 1e-7);
});

test('Korean coordinates round trip without losing roadview location', () => {
  for (const lat of [33.1, 34.5, 36.616, 37.5665, 38.5, 39]) {
    for (const lng of [124.5, 126.570667, 127, 129.0756, 131.9]) {
      const actual = wcongnamulToWgs84(wgs84ToWcongnamul({ lat, lng }));
      near(actual.lat, lat, 1e-10);
      near(actual.lng, lng, 1e-10);
    }
  }
});

test('query supports lng and lon, viewpoints, and panorama ids', () => {
  assert.deepEqual(parseLocation('?lat=37.1&lon=127.2&pan=360&tilt=-10&zoom=-3&panoid=98765', DEFAULTS), {
    lat: 37.1, lng: 127.2, pan: 0, tilt: -10, zoom: -3, panoid: 98765,
  });
  assert.deepEqual(parseLocation('', DEFAULTS), DEFAULTS);
  assert.equal(parseLocation('?lat=37.1&lng=127.2', DEFAULTS).panoid, null);
  assert.equal(parseLocation('?pan=180', DEFAULTS).panoid, DEFAULTS.panoid);
  assert.equal(parseLocation('?lat=37&lng=127&panoId=12', DEFAULTS).panoid, 12);
});

test('invalid and ambiguous URL values fail with a useful explanation', () => {
  const invalid = [
    ['?lat=37', /함께/],
    ['?lng=127', /함께/],
    ['?lat=&lng=127', /위도/],
    ['?lat=%20&lng=127', /위도/],
    ['?lat=NaN&lng=127', /위도/],
    ['?lat=Infinity&lng=127', /위도/],
    ['?lat=1e999&lng=127', /위도/],
    ['?lat=0x25&lng=127', /위도/],
    ['?lat=91&lng=127', /위도/],
    ['?lat=37&lng=-181', /경도/],
    ['?lat=37&lat=37&lng=127', /한 번/],
    ['?lat=37&lng=127&lon=127', /한 번/],
    ['?pan=361', /방향/],
    ['?pan=-1', /방향/],
    ['?tilt=91', /기울기/],
    ['?zoom=3.1', /확대/],
    ['?zoom=-4', /확대/],
    ['?panoid=', /로드뷰 ID/],
    ['?panoid=0', /로드뷰 ID/],
    ['?panoid=1.5', /로드뷰 ID/],
    ['?panoid=9007199254740992', /로드뷰 ID/],
    ['?panoid=1&panoId=1', /한 번/],
    ['?zoom=1&zoom=2', /한 번/],
  ];
  for (const [search, expected] of invalid) assert.throws(() => parseLocation(search, DEFAULTS), expected, search);
});

test('projection rejects values that cannot be coordinates', () => {
  assert.throws(() => wgs84ToWcongnamul({ lat: '', lng: 127 }), /위도/);
  assert.throws(() => wgs84ToWcongnamul({ lat: 37, lng: NaN }), /경도/);
  assert.throws(() => wcongnamulToWgs84({ x: Infinity, y: 0 }), /X 좌표/);
  assert.throws(() => wcongnamulToWgs84({ x: 0, y: '' }), /Y 좌표/);
});

test('share links preserve the location and unrelated URL settings', () => {
  const search = buildLocationSearch(DEFAULTS);
  assert.deepEqual(parseLocation(search), DEFAULTS);
  const url = new URL(buildLocationUrl('https://example.com/view?lon=128&lat=35&theme=dark#roadview', DEFAULTS));
  assert.equal(url.searchParams.get('theme'), 'dark');
  assert.equal(url.searchParams.has('lon'), false);
  assert.equal(url.hash, '#roadview');
  assert.deepEqual(parseLocation(url.search), DEFAULTS);
  const noId = { ...DEFAULTS, panoid: null, lat: 36.616123456789 };
  const roundTrip = parseLocation(buildLocationSearch(noId));
  near(roundTrip.lat, noId.lat, 1e-8);
  assert.equal(roundTrip.panoid, null);
});
