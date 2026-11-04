const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoadsService, parseVersion, project, unproject } = require('../eum-roads.cjs');
const handler = require('../api/eum/roads.js');
const bounds = () => new URLSearchParams({ bbox: '126.6915,35.7635,126.6962,35.7667' });
const page = (version) => `<select id="selLcstSpaceDplyDate"><option value="${version}">latest</option><option value="20260114">old</option></select>`;
const outer = [[927100,1752300],[927140,1752300],[927140,1752340],[927100,1752300]];
const hole = [[927110,1752310],[927120,1752310],[927120,1752320],[927110,1752310]];
const feature = (code, extra = {}) => ({ type: 'Feature', id: code, properties: { mnum: code, uname: '도시계획도로', hiddenOwner: 'omit' }, geometry: { type: 'Polygon', coordinates: [outer, hole] }, ...extra });

function fixture(options = {}) {
  const calls = [];
  let currentVersion = '20261014';
  let clock = 0;
  const fetchImpl = async (input) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === 'www.eum.go.kr') return new Response(page(currentVersion));
    if (url.searchParams.get('req') === 'code') return Response.json(options.legend || { layer: [{ name: 'CA', code: ['UQS121','UQS116','UQS121','UQT220'] }, { name: 'BA', code: ['UIA100'] }] });
    const code = url.searchParams.get('code');
    return options.geometryResponse ? options.geometryResponse(code) : Response.json({ type: 'FeatureCollection', features: [feature(code), feature(code)] });
  };
  return { calls, fetchImpl, service: createRoadsService({ fetchImpl, now: () => clock }),
    advance() { clock += 3600001; }, setVersion(value) { currentVersion = value; } };
}

test('Eum metadata selects the latest valid published drawing date, scoped to its selector', () => {
  assert.equal(parseVersion('<option value="20990101">outside</option>' + page('20261014')), '20261014');
  assert.equal(parseVersion('<select id="selLcstSpaceDplyDate"><option value="20260230"><option value="20260614"><option value="20261014"></select>'), '20261014');
  assert.throws(() => parseVersion('<option value="20261014">unrelated</option>'), /생성일/);
});

test('EPSG:5179 matches the projection used by Eum in Buan, Seoul, Busan and Jeju', () => {
  // Reference coordinates evaluated independently with Eum's own proj4.js.
  const controls = [
    [[126.69384253,35.76513472],[927127.3492474571,1752383.595905554]],
    [[126.978,37.5665],[953901.1653121508,1952032.0809725935]],
    [[129.0756,35.1796],[1143467.3796651924,1688281.9820342099]],
    [[126.5312,33.4996],[910010.5457116711,1501279.788811667]],
  ];
  for (const [wgs, unified] of controls) {
    project(...wgs).forEach((value, index) => assert.ok(Math.abs(value - unified[index]) < .01));
    unproject(...unified).forEach((value, index) => assert.ok(Math.abs(value - wgs[index]) < 1e-7));
  }
});

test('only Eum road facilities are fetched, transformed and deduplicated, with polygon holes preserved', async () => {
  const f = fixture();
  const data = await f.service.load(bounds());
  assert.equal(data.source, '토지이음');
  assert.equal(data.version, '20261014');
  assert.equal(data.features.length, 2);
  assert.equal(data.features[0].geometry.coordinates.length, 2);
  assert.deepEqual(data.features[0].geometry.coordinates[0][0], unproject(...outer[0]));
  assert.equal(data.features[0].properties.hiddenOwner, undefined);
  const requests = f.calls.filter((url) => url.hostname !== 'www.eum.go.kr');
  assert.ok(requests.every((url) => url.origin === 'https://www.eum.ne.kr:9003' && url.pathname === '/MapPlan/MapPlan' && url.searchParams.get('version') === '20261014'));
  assert.deepEqual(requests.filter((url) => url.searchParams.get('req') === 'search').map((url) => url.searchParams.get('code')).sort(), ['UQS116','UQS121']);
  const mbr = requests[0].searchParams.get('mbr').split(',').map(Number);
  assert.ok(mbr[0] < 927127.35 && mbr[2] > 927127.35 && mbr[1] < 1752383.6 && mbr[3] > 1752383.6);
});

test('drawing dates refresh hourly and on an explicit refresh without hardcoding a date', async () => {
  const f = fixture({ legend: { layer: [] } });
  assert.equal((await f.service.load(bounds())).version, '20261014');
  f.setVersion('20270114');
  assert.equal((await f.service.load(bounds())).version, '20261014');
  const refresh = bounds(); refresh.set('refresh', '1');
  assert.equal((await f.service.load(refresh)).version, '20270114');
  f.setVersion('20270414'); f.advance();
  assert.equal((await f.service.load(bounds())).version, '20270414');
  assert.equal(f.calls.filter((url) => url.hostname === 'www.eum.go.kr').length, 3);
});

test('invalid or excessive areas fail before any upstream request', async () => {
  const f = fixture();
  for (const bbox of ['', '126,,127,36', 'NaN,35,127,36', '127,35,126,36', '125,33,130,39', '120,35,121,36', '126,35,127,Infinity']) {
    await assert.rejects(f.service.load(new URLSearchParams({ bbox })), { status: 400 });
  }
  assert.equal(f.calls.length, 0);
});

test('empty coverage differs from failed, mismatched or malformed road data', async () => {
  const empty = fixture({ legend: { layer: [] } });
  assert.equal((await empty.service.load(bounds())).features.length, 0);
  assert.equal(empty.calls.length, 2);
  await assert.rejects(fixture({ legend: { error: 'unavailable' } }).service.load(bounds()), /범례/);
  await assert.rejects(fixture({ geometryResponse: () => new Response('unavailable', { status: 503 }) }).service.load(bounds()), /연결/);
  await assert.rejects(fixture({ geometryResponse: () => Response.json({ type: 'FeatureCollection', features: [feature('UQT220')] }) }).service.load(bounds()), /응답 도형/);
  await assert.rejects(fixture({ geometryResponse: (code) => Response.json({ type: 'FeatureCollection', features: [feature(code, { geometry: { type: 'Polygon', coordinates: [[[126,35],[127,35],[126,35]]] } })] }) }).service.load(bounds()), /좌표계/);
});

test('Vercel roads endpoint uses the shared loader and rejects writes and malformed requests', async (t) => {
  const f = fixture();
  t.mock.method(globalThis, 'fetch', f.fetchImpl);
  const run = async (url, method = 'GET') => {
    const result = {};
    await handler({ url, method }, { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.data = JSON.parse(body); } });
    return result;
  };
  assert.equal((await run('/api/eum/roads?bbox=bad')).status, 400);
  assert.equal((await run('/api/eum/roads?' + bounds(), 'POST')).status, 405);
  assert.equal(f.calls.length, 0);
  const response = await run('/api/eum/roads?' + bounds());
  assert.equal(response.status, 200);
  assert.equal(response.data.source, '토지이음');
  assert.equal(response.data.features.length, 2);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal((await run('/api/eum/arbitrary')).status, 404);
});
