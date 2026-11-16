const test = require('node:test');
const assert = require('node:assert/strict');
const { load, normalize, readPage, formatLocation, getSubdivisionStandards } = require('../vworld-parcel.js');
const pnu = '1111011900100010000';
const characteristic = { pnu, stdrYear: '2026', stdrMt: '01', lndpclAr: '238881.8', prposArea1Nm: '제1종일반주거지역', prposArea2Nm: '자연녹지지역' };

test('subdivision reference follows checklist values for each selected zoning family', () => {
  for (const [name, minimumArea, coverage] of [
    ['제2종일반주거지역', 60, 70], ['중심상업지역', 150, 90], ['준공업지역', 150, 70],
    ['자연녹지지역', 200, 20], ['보전관리지역', 60, 20], ['생산관리지역', 60, 20],
    ['계획관리지역', 60, 40], ['농림지역', 60, 20], ['자연환경보전지역', 60, 20],
  ]) {
    assert.deepEqual(getSubdivisionStandards([{ kind: 'region', name, relation: '포함' }]).regions, [{ name, minimumArea, coverage }]);
  }
});

test('mixed regions retain separate limits and discard redundant broad zoning names', () => {
  const zones = ['도시지역', '주거지역', '제2종 일반주거지역 (설명)', '자연녹지지역', '제2종일반주거지역'].map((name) => ({ name, kind: 'region' }));
  assert.deepEqual(getSubdivisionStandards(zones).regions, [
    { name: '제2종일반주거지역', minimumArea: 60, coverage: 70 },
    { name: '자연녹지지역', minimumArea: 200, coverage: 20 },
  ]);
  assert.deepEqual(getSubdivisionStandards(['관리지역', '계획관리지역'].map((name) => ({ name, kind: 'region' }))).regions,
    [{ name: '계획관리지역', minimumArea: 60, coverage: 40 }]);
});

test('adjacent zones and failed or unspecified zoning do not become applicable limits', () => {
  const zones = [{ kind: 'region', name: '계획관리지역', relation: '접함' }, { kind: 'region', name: '도시지역' }];
  assert.deepEqual(getSubdivisionStandards(zones).regions, [{ name: '도시지역', minimumArea: null, coverage: null }]);
  assert.deepEqual(getSubdivisionStandards(zones, { region: '조회 실패' }).regions, []);
  assert.deepEqual(getSubdivisionStandards().regions, []);
});

test('natural settlement distinguishes whole, partial and adjacent districts and respects plan failure', () => {
  const region = { kind: 'region', name: '자연녹지지역' };
  const district = { kind: 'district', name: '자연 취락지구 (지정)' };
  assert.equal(getSubdivisionStandards([region, { ...district, relation: '포함' }]).naturalSettlement, 'included');
  assert.equal(getSubdivisionStandards([region, { ...district, relation: '저촉' }]).naturalSettlement, 'partial');
  assert.equal(getSubdivisionStandards([region, { ...district, relation: '접함' }]).naturalSettlement, '');
  const failed = getSubdivisionStandards([region, district], { district: '계획 조회 실패' });
  assert.equal(failed.naturalSettlement, '');
  assert.equal(failed.districtUnavailable, true);
  assert.equal(failed.regions[0].coverage, 20);
});

test('parcel location shows town, village and lot without province or county', () => {
  assert.equal(formatLocation('전북특별자치도 부안군 부안읍 동중리 351-2', '351-2'), '부안읍 동중리 351-2');
  assert.equal(formatLocation('전북특별자치도 부안군 변산면 격포리 산12-3', '산 12-3'), '변산면 격포리 산 12-3');
  assert.equal(formatLocation('전라북도 완주군 삼례읍 삼례리', '100'), '삼례읍 삼례리 100');
  assert.equal(formatLocation('서울특별시 종로구 종로1가 1-2'), '종로1가 1-2');
  assert.equal(formatLocation('전북특별자치도 전주시 완산구 효자동3가 1200'), '효자동3가 1200');
  assert.equal(formatLocation('전북특별자치도 부안군 부안읍 동중리 351-2 전', '352'), '부안읍 동중리 352');
  assert.equal(formatLocation('  부안읍   동중리  351-2번지 '), '부안읍 동중리 351-2');
  assert.equal(formatLocation('부안읍 동중리 산12-3'), '부안읍 동중리 산 12-3');
  assert.equal(formatLocation('선택한 필지', '12'), '12');
  assert.equal(formatLocation('필지를 선택해 주세요.'), '');
});

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
