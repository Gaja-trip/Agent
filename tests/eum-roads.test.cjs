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
    if (url.hostname === 'www.eum.go.kr') return options.metadataResponse ? options.metadataResponse() : new Response(page(currentVersion));
    if (url.searchParams.get('req') === 'code') return Response.json(options.legend || { layer: [{ name: 'CA', code: ['UQS121','UQS116','UQS121','UQT220'] }, { name: 'BA', code: ['UIA100'] }] });
    const code = url.searchParams.get('code');
    return options.geometryResponse ? options.geometryResponse(code) : Response.json({ type: 'FeatureCollection', features: [feature(code), feature(code)] });
  };
  return { calls, fetchImpl, service: createRoadsService({ fetchImpl, now: () => clock, cache: options.cache, retryDelay: async () => {} }),
    advance(ms = 3600001) { clock += ms; }, setVersion(value) { currentVersion = value; } };
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

test('a timed-out drawing-date page uses only a previously verified date and discloses the delay', async () => {
  const f = fixture({ metadataResponse() { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); } });
  const data = await f.service.load(bounds());
  assert.equal(data.version, '20261014');
  assert.equal(data.metadataVerified, false);
  assert.match(data.warnings.join(' '), /마지막 확인 도면/);
  assert.equal(data.features.length, 2);
  assert.ok(f.calls.filter((url) => url.hostname === 'www.eum.ne.kr').every((url) => url.searchParams.get('version') === '20261014' && !url.searchParams.has('key')));
});

test('a transient geometry timeout retries once using a new attempt signal', async () => {
  const signals = [];
  const f = fixture({ legend: { layer: [{ name: 'CA', code: ['UQS121'] }] } });
  let attempts = 0;
  const service = createRoadsService({ retryDelay: async () => {}, fetchImpl: async (input, options) => {
    const url = new URL(input);
    if (url.searchParams.get('req') === 'search') {
      signals.push(options.signal);
      if (++attempts === 1) throw new DOMException('timeout', 'TimeoutError');
    }
    return f.fetchImpl(input, options);
  } });
  assert.equal((await service.load(bounds())).features.length, 1);
  assert.equal(attempts, 2);
  assert.notEqual(signals[0], signals[1]);
});

test('identical concurrent requests share upstream work and successful coverage is reused', async () => {
  const f = fixture();
  const data = await Promise.all([f.service.load(bounds()), f.service.load(bounds()), f.service.load(bounds())]);
  assert.equal(data[0], data[1]);
  assert.equal(f.calls.length, 4);
  await f.service.load(bounds());
  assert.equal(f.calls.length, 4);
});

test('successful coverage can be reused by a new server instance through the runtime cache', async () => {
  const entries = new Map();
  const cache = { get: async (key) => entries.get(key), set: async (key, value, options) => { assert.equal(options.ttl, 86400); entries.set(key, value); } };
  const f = fixture({ cache });
  await f.service.load(bounds());
  const next = createRoadsService({ cache, now: () => 1, fetchImpl() { throw new Error('No upstream request expected'); } });
  const data = await next.load(bounds());
  assert.equal(data.version, '20261014');
  assert.equal(data.features.length, 2);
});

test('outage fallback preserves the actual drawing date and never substitutes another area', async () => {
  let failed = false;
  const f = fixture({ geometryResponse(code) {
    if (failed) throw new DOMException('timeout', 'TimeoutError');
    return Response.json({ type: 'FeatureCollection', features: [feature(code)] });
  } });
  await f.service.load(bounds());
  f.advance(360001); f.setVersion('20270114'); failed = true;
  const refresh = bounds(); refresh.set('refresh', '1');
  const data = await f.service.load(refresh);
  assert.equal(data.stale, true);
  assert.equal(data.version, '20261014');
  assert.match(data.warnings.join(' '), /최근 정상 조회 자료/);
  await assert.rejects(f.service.load(new URLSearchParams({ bbox: '127.145,35.821,127.151,35.827' })), { code: 'UPSTREAM_TIMEOUT' });
  f.advance(86400001);
  await assert.rejects(f.service.load(bounds()), { code: 'UPSTREAM_TIMEOUT' });
});

test('timeout errors sent by the deployed entry are Korean, bounded retries, and identify the failed stage', async (t) => {
  let attempts = 0;
  const f = fixture({ legend: { layer: [{ name: 'CA', code: ['UQS121'] }] }, geometryResponse() {
    attempts++;
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  } });
  t.mock.method(globalThis, 'fetch', f.fetchImpl);
  const result = {};
  await handler({ url: '/api/eum/roads?bbox=126.524,35.665,126.530,35.671&refresh=1', method: 'GET' }, {
    writeHead(status) { result.status = status; }, end(body) { result.data = JSON.parse(body); }
  });
  assert.equal(result.status, 503);
  assert.equal(result.data.code, 'UPSTREAM_TIMEOUT');
  assert.equal(result.data.stage, 'geometry');
  assert.equal(result.data.retryable, true);
  assert.match(result.data.error, /응답이 지연/);
  assert.doesNotMatch(result.data.error, /operation|aborted|timeout/i);
  assert.equal(attempts, 2);
});
