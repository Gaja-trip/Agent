const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/vworld/parcel.js');

test('Vercel aerial endpoint obtains attributes solely from V-World and validates input', async (t) => {
  const calls = [];
  const pnu = '1111011900100010000';
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return Response.json(url.pathname.endsWith('getLandCharacteristics')
      ? { landCharacteristicss: { field: [{ pnu, stdrYear: '2026', lndpclAr: '100' }], totalCount: '1' } }
      : { landUses: { field: [{ pnu, prposAreaDstrcCode: 'UQA121', prposAreaDstrcCodeNm: '제1종일반주거지역', cnflcAtNm: '포함' }], totalCount: '1' } });
  });
  const run = async (url, method = 'GET') => {
    const result = {};
    await handler({ url, method }, { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.data = JSON.parse(body); } });
    return result;
  };
  const response = await run('/api/vworld/parcel?pnu=' + pnu);
  assert.equal(response.status, 200);
  assert.equal(response.data.source, 'V-World');
  assert.equal(response.data.parcel.area, '100');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.origin === 'https://api.vworld.kr' && url.searchParams.get('pnu') === pnu));
  assert.equal((await run('/api/vworld/parcel?pnu=invalid')).status, 400);
  assert.equal((await run('/api/vworld/parcel?pnu=' + pnu, 'POST')).status, 405);
  assert.equal((await run('/api/vworld/unrecognized')).status, 404);
  assert.equal(calls.length, 2);
});
