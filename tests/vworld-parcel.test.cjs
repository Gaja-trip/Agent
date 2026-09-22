const test = require('node:test');
const assert = require('node:assert/strict');
const { load, normalize, readPage } = require('../vworld-parcel.js');
const pnu = '1111011900100010000';
const characteristic = { pnu, stdrYear: '2026', stdrMt: '01', lndpclAr: '238881.8', prposArea1Nm: '제1종일반주거지역', prposArea2Nm: '자연녹지지역' };

test('selects newest annual area, preserves land-use relations, and deduplicates districts', () => {
  const uses = [
    { prposAreaDstrcCode: 'UQA121', prposAreaDstrcCodeNm: '제1종일반주거지역', cnflcAtNm: '저촉' },
    { prposAreaDstrcCode: 'UQF110', prposAreaDstrcCodeNm: '자연경관지구', cnflcAtNm: '저촉' },
    { prposAreaDstrcCode: 'UQF110', prposAreaDstrcCodeNm: '자연경관지구', cnflcAtNm: '저촉' },
    { prposAreaDstrcCode: 'UOC800', prposAreaDstrcCodeNm: '역사문화환경보존지역', cnflcAtNm: '접함' },
  ];
  const data = normalize(pnu, [characteristic, { ...characteristic, stdrYear: '2025', lndpclAr: '1' }], uses);
  assert.equal(data.parcel.area, '238881.8');
  assert.equal(data.year, '2026');
  assert.equal(data.source, 'V-World');
  assert.deepEqual(data.zones.map(({ kind, relation }) => [kind, relation]), [['region', '저촉'], ['district', '저촉'], ['other', '접함']]);
});

test('authentication and malformed responses are not rendered as no zoning', () => {
  assert.throws(() => readPage({ landUses: { resultCode: 'INCORRECT_KEY' } }, 'landUses'), /인증키/);
  assert.throws(() => readPage({}, 'landUses'), /응답 형식/);
  assert.throws(() => readPage({ landUses: { totalCount: '5' } }, 'landUses'), /불완전/);
});

test('partial plan failure retains area and annual region, reports district failure', async () => {
  const data = await load(pnu, { key: 'test', domain: 'https://example.test', requestJson: async (url) => {
    if (url.pathname.endsWith('getLandUseAttr')) throw new Error('plan unavailable');
    return { landCharacteristicss: { field: [characteristic], totalCount: '1' } };
  } });
  assert.equal(data.parcel.area, '238881.8');
  assert.equal(data.errors.area, '');
  assert.equal(data.errors.region, '');
  assert.equal(data.errors.district, 'plan unavailable');
  assert.equal(data.zones.filter((row) => row.kind === 'region').length, 2);
});

test('reads every page and rejects another parcel rather than attributing its area', async () => {
  const calls = [];
  const data = await load(pnu, { key: 'test', domain: 'https://example.test', requestJson: async (url) => {
    calls.push(url);
    if (url.pathname.endsWith('getLandUseAttr')) return { landUses: { field: [], totalCount: '0' } };
    return { landCharacteristicss: { field: [{ ...characteristic, stdrYear: url.searchParams.get('pageNo') === '1' ? '2025' : '2026' }], totalCount: '2' } };
  } });
  assert.equal(data.year, '2026');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => url.origin === 'https://api.vworld.kr' && url.searchParams.get('domain') === 'https://example.test'));
  await assert.rejects(load(pnu, { key: 'test', domain: 'https://example.test', requestJson: async (url) => ({ [url.pathname.endsWith('getLandUseAttr') ? 'landUses' : 'landCharacteristicss']: { field: [{ pnu: 'mismatch' }], totalCount: '1' } }) }), /필지가 다릅니다/);
});
