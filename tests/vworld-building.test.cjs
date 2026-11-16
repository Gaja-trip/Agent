const test = require('node:test');
const assert = require('node:assert/strict');
const { getInfoRows, getAddressItems, isRegistryFeature, getFarmlandCoverageRelief } = require('../assets/vworld-building.js');

test('building-register GIS fields populate all overview rows with confirmed code names', () => {
  const feature = { id: 'lt_c_bldginfo.123', properties: {
    BLD_NM: '부안군청', dong_nm: '본관', USABILITY: '02000', strct_cd: '21',
    grnd_flr: 4, ugrnd_flr: 0, archarea: '1,000', height: 12.5,
    vl_rat: 0, bc_rat: '35.5', totalarea: 2500, platarea: 4000, useapr_day: '20260102',
  } };
  assert.deepEqual(getInfoRows(feature), [
    ['건물명칭', '부안군청'], ['건물용도', '공동주택'], ['건물동명칭', '본관'], ['구조', '철근콘크리트구조'],
    ['지상층수', '4층'], ['지하층수', '0층'], ['건물면적', '1,000 ㎡ (302.5평)'], ['건물높이', '12.5m'],
    ['용적률', '0%'], ['건폐율', '35.5%'], ['연면적', '2,500 ㎡ (756.25평)'],
    ['대지면적', '4,000 ㎡ (1,210평)'], ['사용승인일자', '2026-01-02'],
  ]);
  assert.equal(isRegistryFeature(feature), true);
});

test('confirmed main and detailed codes are named while unconfirmed codes stay explicit', () => {
  const overview = (usability, strct_cd) => Object.fromEntries(getInfoRows({ properties: { usability, strct_cd } }));
  assert.equal(overview('14000', '21')['건물용도'], '업무시설');
  assert.equal(overview('04000', '51')['구조'], '일반목구조');
  assert.equal(overview('04000', '51')['건물용도'], '제2종근린생활시설');
  assert.equal(overview('14202', '32')['건물용도'], '오피스텔');
  assert.equal(overview('04001', '32')['건물용도'], '일반음식점');
  assert.equal(overview(1000, '32')['건물용도'], '단독주택');
  assert.equal(overview('99999', '53')['건물용도'], '코드 99999');
  assert.equal(overview('99999', '53')['구조'], '코드 53');
  assert.equal(overview(0, 0)['건물용도'], '코드 0');
});

test('legacy aliases and named purposes take precedence over numeric codes', () => {
  const feature = { properties: {
    BULD_NM: '기존 건물', MAINPURPSCDNM: '단독주택', usability: '01000', STRCTCDNM: '철근콘크리트구조',
    strct_cd: '21', gro_flo_co: '2', und_flo_co: '0', archArea: '100㎡',
    HEIT: '8m', vlRat: '0%', bcRat: '50%', totArea: '200 m²', platArea: '250 ㎡', useAprDay: '2025-12-24',
  } };
  const rows = Object.fromEntries(getInfoRows(feature));
  assert.equal(rows['건물명칭'], '기존 건물');
  assert.equal(rows['건물용도'], '단독주택');
  assert.equal(rows['구조'], '철근콘크리트구조');
  assert.equal(rows['건물면적'], '100 ㎡ (30.25평)');
  assert.equal(rows['연면적'], '200 ㎡ (60.5평)');
  assert.equal(rows['대지면적'], '250 ㎡ (75.63평)');
  assert.equal(rows['건물높이'], '8m');
  assert.equal(rows['용적률'], '0%');
  assert.equal(rows['사용승인일자'], '2025-12-24');
});

test('missing fields stay empty and already formatted units are not duplicated', () => {
  assert.equal(getInfoRows().length, 13);
  assert.ok(getInfoRows({ properties: { bld_nm: '  ', height: NaN } }).every(([, value]) => value === '—'));
  const rows = Object.fromEntries(getInfoRows({ properties: { archarea: '100 ㎡ (30.25평)', grnd_flr: '2층', useapr_day: '00000000', bc_rat: 0 } }));
  assert.equal(rows['건물면적'], '100 ㎡ (30.25평)');
  assert.equal(rows['지상층수'], '2층');
  assert.equal(rows['사용승인일자'], '—');
  assert.equal(rows['건폐율'], '0%');
});

test('address display does not mistake management identifiers for a street or lot address', () => {
  const identifiers = { properties: { RDS_MAN_NO: '1234567890', pnu: '4580010100102220001', bld_nm: '도로명주소 건물' } };
  assert.deepEqual(getAddressItems(identifiers), []);
  assert.deepEqual(getAddressItems(identifiers, '부안읍 동중리 222-1'), [['지번', '부안읍 동중리 222-1']]);
  const feature = { properties: { NEWPLATPLC: '부안군 당산로 91', PLATPLC: '부안읍 동중리 222-1' } };
  assert.deepEqual(getAddressItems(feature, '다른 주소'), [['도로명', '부안군 당산로 91'], ['지번', '부안읍 동중리 222-1']]);
  assert.equal(isRegistryFeature(identifiers), false);
  assert.equal(isRegistryFeature({ id: 'LT_C_BLDGINFO.42', properties: {} }), true);
  assert.equal(isRegistryFeature({ properties: { MAIN_PURPS_CD_NM: '단독주택' } }), true);
  assert.equal(isRegistryFeature({ properties: { archarea: 0 } }), true);
  assert.equal(isRegistryFeature(), false);
});

const reliefZone = (name = '농림지역', relation = '포함') => ({ name, relation, kind: 'region' });
const registerBuilding = (properties, id = 'LT_C_BLDGINFO.1') => ({ id, properties });

test('farmland coverage notice applies only to the four interior regions', () => {
  for (const name of ['보전관리지역', '생산관리지역', '농림지역', '자연환경보전지역']) {
    assert.deepEqual(getFarmlandCoverageRelief({ zones: [reliefZone(name)] }), {
      regions: [name], partial: false, status: 'possible', candidates: [],
    });
  }
  for (const name of ['계획관리지역', '생산녹지지역', '자연녹지지역', '관리지역', '도시지역']) {
    assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone(name)] }), null);
  }
  assert.equal(getFarmlandCoverageRelief(), null);
});

test('adjacent and failed regions are not eligible while mixed parcels remain explicitly partial', () => {
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone('농림지역', '접함')] }), null);
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone()], regionError: '조회 실패' }), null);
  assert.deepEqual(getFarmlandCoverageRelief({ zones: [reliefZone('관리지역'), reliefZone('농 림 지역 (농업진흥구역)'), reliefZone()] }).regions, ['농림지역']);
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone('농림지역', '저촉')] }).partial, true);
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone(), reliefZone('계획관리지역')] }).partial, true);
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone('보전관리지역'), reliefZone('생산관리지역')] }).partial, true);
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone('관리지역'), reliefZone()] }).partial, false);
});

test('ordinary housing, warehouses and factories do not imply farmland relief', () => {
  for (const [bld_nm, usability] of [['농가주택', '01000'], ['농업인 주택', '01000'], ['일반 창고', '18000'], ['농업회사법인', '17000'], ['연구소', '10000']]) {
    const relief = getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [registerBuilding({ bld_nm, usability })], buildingStatus: 'loaded' });
    assert.equal(relief.status, 'possible');
    assert.deepEqual(relief.candidates, []);
  }
});

test('explicit register purposes provide named evidence for a review estimate', () => {
  for (const purpose of ['농업용 창고', '축사', '작물재배사', '농수산물 가공처리시설', '농업 시험연구시설', '마을회관', '어린이놀이터', '농업인주택']) {
    const relief = getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [registerBuilding({ BLD_NM: '본관', MAINPURPSCDNM: purpose })], buildingStatus: 'loaded' });
    assert.equal(relief.status, 'estimated', purpose);
    assert.deepEqual(relief.candidates, [{ name: '본관', purpose, evidence: `건물용도: ${purpose}` }]);
  }
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [registerBuilding({ usability: '21000' })], buildingStatus: 'loaded' }).status, 'estimated');
});

test('agriculture-specific building names require a compatible registered purpose', () => {
  const scenarios = [
    ['부안 미곡종합처리장', '17000', true], ['농산물 가공 공장', '17000', true],
    ['농업용 창고', '18000', true], ['농산물 저장고', '18000', true],
    ['마을회관', '03000', true], ['농업 시험연구소', '10000', true],
    ['농업용 창고', '14000', false], ['미곡종합처리장', '01000', false], ['농가주택', '01000', false],
  ];
  for (const [bld_nm, usability, estimated] of scenarios) {
    const relief = getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [registerBuilding({ bld_nm, usability })], buildingStatus: 'loaded' });
    assert.equal(relief.status, estimated ? 'estimated' : 'possible', `${bld_nm}: ${usability}`);
    if (estimated) assert.match(relief.candidates[0].evidence, /건물명칭: .* \/ 건물용도:/);
  }
});

test('map-only, incomplete and failed building results never produce an estimate', () => {
  const buildings = [registerBuilding({ bld_nm: '농업용 창고', mainPurpsCdNm: '농업용창고' })];
  for (const buildingStatus of ['idle', 'loading', 'failed', 'stale']) {
    assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone()], buildings, buildingStatus }).status, 'possible');
  }
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [registerBuilding({ bld_nm: '농업용 창고', mainPurpsCdNm: '농업용창고' }, 'LT_C_SPBD.1')], buildingStatus: 'loaded' }).status, 'possible');
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [registerBuilding({})], buildingStatus: 'loaded' }).status, 'possible');
  assert.equal(getFarmlandCoverageRelief({ zones: [reliefZone()], buildings: [], buildingStatus: 'loaded' }).status, 'possible');
});
