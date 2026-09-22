const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/farmland/[action].js');
const { createServer } = require('node:http');

test('Vercel entry handles real HTTP requests with the same JSON and PNG routes', async (t) => {
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requested.push(String(url));
    if (url.pathname === '/map/featureInfo.do') return Response.json({ tojiList: [{ pnu: '1111011900100010000', area: '100' }], tojiUseList: [] });
    if (url.pathname === '/map/proxy/wms.do') return new Response(Buffer.from([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
    throw new Error('Unexpected upstream');
  });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const http = require('node:http');
  const get = (route) => new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${server.address().port}${route}`, (res) => {
      const chunks = [];
      res.on('data', (data) => chunks.push(data));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], bytes: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
  const info = await get('/api/farmland/info?pnu=1111011900100010000');
  assert.equal(info.status, 200);
  assert.equal(JSON.parse(info.bytes).parcel.area, '100');
  const wms = await get('/api/farmland/wms?bbox=100,100,200,200&width=256&height=256');
  assert.equal(wms.status, 200);
  assert.equal(wms.type, 'image/png');
  assert.deepEqual([...wms.bytes], [137, 80, 78, 71]);
  assert.equal((await get('/api/farmland/info?pnu=bad')).status, 400);
  assert.equal((await get('/api/farmland/unknown')).status, 404);
  assert.equal(requested.length, 2);
});
