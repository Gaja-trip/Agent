const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeParcelInfo, parseAirCapabilities, numberParam, handleFarmlandRequest } = require('../farmland-service.cjs');
const pnu = '1111011900100010000';

test('land-use categories preserve inclusion/overlap/adjacency and omit hidden records', () => {
  const data = normalizeParcelInfo({
    tojiList: [{ pnu, juso: '공개 시험 필지', jimok: '대', area: '100', owner: 'excluded' }],
    tojiUseList: [
      { useZone: '제1종일반주거지역', cfltYm: '포함' },
      { useZone: '제1종일반주거지역', cfltYm: '포함' },
      { useZone: '자연녹지지역', cfltYm: '접합' },
      { useZone: '자연경관지구', cfltYm: '저촉' },
      { useZone: '역사문화환경보존지역', cfltYm: '포함' },
    ],
    farmInfoList: [{ hidden: 'excluded' }],
  }, pnu);
  assert.deepEqual(data.zones.map(({ kind, relation }) => [kind, relation]), [
    ['region', '포함'], ['region', '접합'], ['district', '저촉'], ['other', '포함'],
  ]);
  assert.equal(JSON.stringify(data).includes('excluded'), false);
  assert.throws(() => normalizeParcelInfo({ tojiList: [{ pnu: 'different' }], tojiUseList: [] }, pnu));
  assert.throws(() => normalizeParcelInfo({}, pnu));
});

test('WMTS capabilities select latest year and retain advertised tile limits', () => {
  const layer = (id) => `<Layer><ows:Identifier>${id}</ows:Identifier><TileMatrixLimits><TileMatrix>EPSG:5186_${id}:8</TileMatrix><MinTileRow>100</MinTileRow><MaxTileRow>105</MaxTileRow><MinTileCol>90</MinTileCol><MaxTileCol>99</MaxTileCol></TileMatrixLimits></Layer>`;
  const config = parseAirCapabilities(layer('AIR_24_GG') + layer('AIR_25_GG') + layer('AIR_25_JRD'));
  assert.equal(config.year, 2025);
  assert.deepEqual(config.layers.map(({ id }) => id), ['AIR_25_GG', 'AIR_25_JRD']);
  assert.deepEqual(config.layers[0].limits[8], { minX: 90, maxX: 99, minY: 100, maxY: 105 });
  assert.throws(() => parseAirCapabilities('<html>upstream error</html>'));
});

test('numeric query validation rejects missing, nonfinite, and out-of-range parameters', () => {
  for (const query of ['', 'x=', 'x=Infinity', 'x=NaN', 'x=-1', 'x=11', 'x=1.5']) {
    assert.throws(() => numberParam(new URLSearchParams(query), 'x', 0, 10, true));
  }
  assert.equal(numberParam(new URLSearchParams('x=5'), 'x', 0, 10, true), 5);
});

test('proxy refuses arbitrary layers, invalid PNU/coordinates, and writes before upstream access', async () => {
  for (const [path, method, expected] of [
    ['/info?pnu=bad', 'GET', 400], ['/parcel?lat=0&lon=0', 'GET', 400],
    ['/tile?layer=https://example.com&z=1&x=1&y=1', 'GET', 400],
    ['/info?pnu=' + pnu, 'POST', 405], ['/arbitrary', 'GET', 404],
  ]) {
    let status;
    const response = { writeHead(value) { status = value; }, end() {} };
    assert.equal(await handleFarmlandRequest({ method }, response, new URL('http://localhost/api/farmland' + path)), true);
    assert.equal(status, expected);
  }
});
