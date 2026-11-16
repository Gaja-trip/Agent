(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VworldBuilding = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const missing = '—';
  // Confirmed codes only: AURI report tables 3-34/3-36 (2025) and 2-6.
  // https://www.auri.re.kr/publicationFileDirect.es?bid=research&list_no=2211&seq=1
  // https://www.auri.re.kr/publicationFileDirect.es?bid=research&list_no=167&seq=1
  const purposeNames = {
    '01000': '단독주택', '02000': '공동주택', '03000': '제1종근린생활시설', '04000': '제2종근린생활시설',
    '05000': '문화및집회시설', '06000': '종교시설', '07000': '판매시설', '08000': '운수시설',
    '09000': '의료시설', '10000': '교육연구시설', '11000': '노유자시설', '12000': '수련시설',
    '13000': '운동시설', '14000': '업무시설', '15000': '숙박시설', '16000': '위락시설',
    '17000': '공장', '18000': '창고시설', '19000': '위험물저장및처리시설', '20000': '자동차관련시설',
    '21000': '동물및식물관련시설', '22000': '분뇨·쓰레기처리시설', '23000': '교정및군사시설',
    '24000': '방송통신시설', '25000': '발전시설', '26000': '묘지관련시설', '27000': '관광휴게시설',
    '29000': '장례시설', '30000': '자원순환관련시설', '31000': '야영장시설', '33000': '국방·군사시설',
    '01001': '단독주택', '01003': '다가구주택', '02001': '아파트', '02002': '연립주택',
    '02003': '다세대주택', '02005': '부대시설', '03001': '소매점', '03002': '휴게음식점',
    '03999': '기타제1종근린생활시설', '04001': '일반음식점', '04005': '제조업소',
    '04402': '사무소', '04999': '기타제2종근린생활시설', '14202': '오피스텔',
    '17100': '일반공장', '17999': '기타공장',
  };
  const structureNames = {
    '10': '조적구조', '11': '벽돌구조', '12': '블록구조', '13': '석구조', '19': '기타조적구조',
    '20': '콘크리트구조', '21': '철근콘크리트구조', '22': '프리케스트콘크리트구조', '29': '기타콘크리트구조',
    '30': '철골구조', '31': '일반철골구조', '32': '경량철골구조', '33': '강파이프구조', '39': '기타강구조',
    '40': '철골철근콘크리트구조', '41': '철골콘크리트구조', '42': '철골철근콘크리트구조',
    '49': '기타철골철근콘크리트구조', '50': '목구조', '51': '일반목구조', '52': '통나무구조', '99': '기타구조',
  };
  const fields = [
    ['건물명칭', ['bld_nm', 'buld_nm', 'bd_nm', 'pos_bul_nm', 'building_nm', 'name', 'bldNm'], 'text'],
    ['건물용도', ['main_purps_cd_nm', 'mainPurpsCdNm', 'use_nm', 'bdtyp_cd_nm', 'buld_use', '용도', 'usability'], 'purpose'],
    ['건물동명칭', ['dong_nm', 'buld_nm_dc', 'bld_dong_nm', 'dongNm', '동명칭'], 'text'],
    ['구조', ['strct_cd_nm', 'strctCdNm', 'strct_nm', 'structure', '구조', 'strct_cd'], 'structure'],
    ['지상층수', ['grnd_flr', 'gro_flo_co', 'grnd_flr_cnt', 'grndFlrCnt', 'ground_flr', '지상층수'], 'floor'],
    ['지하층수', ['ugrnd_flr', 'und_flo_co', 'ugrnd_flr_cnt', 'ugrndFlrCnt', 'underground_flr', '지하층수'], 'floor'],
    ['건물면적', ['archarea', 'arch_area', 'archArea', 'bd_ar', 'building_area', '건물면적'], 'area'],
    ['건물높이', ['height', 'heit', 'hgt', '건물높이'], 'height'],
    ['용적률', ['vl_rat', 'vlRat', 'vlrat', 'far', '용적률'], 'percent'],
    ['건폐율', ['bc_rat', 'bcRat', 'bcrat', 'bld_coverage', '건폐율'], 'percent'],
    ['연면적', ['totalarea', 'totarea', 'tot_ar', 'totArea', 'gfa', '연면적'], 'area'],
    ['대지면적', ['platarea', 'plot_ar', 'plat_area', 'platArea', 'site_area', '대지면적'], 'area'],
    ['사용승인일자', ['useapr_day', 'use_apr_day', 'useAprDay', 'use_confm_de', 'apprv_de', '사용승인일자'], 'date'],
  ];
  const registryFields = fields.filter(([, , kind]) => ['purpose', 'structure', 'area', 'date'].includes(kind)).flatMap(([, names]) => names);

  function clean(value) {
    if (typeof value === 'number' && !Number.isFinite(value)) return '';
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const text = String(value).trim();
    return !text || ['-', '—'].includes(text) || /^(?:null|undefined)$/i.test(text) ? '' : text;
  }

  function read(properties, names) {
    const values = new Map();
    for (const [key, value] of Object.entries(properties || {})) {
      const text = clean(value);
      const name = key.toLowerCase();
      if (text && !values.has(name)) values.set(name, text);
    }
    for (const name of names) {
      if (values.has(name.toLowerCase())) return values.get(name.toLowerCase());
    }
    return '';
  }

  function numeric(text, unit) {
    const value = text.replace(/,/g, '').replace(unit, '').trim();
    return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function numberText(value) {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }

  function display(value, kind) {
    const text = clean(value);
    if (!text) return missing;
    if (kind === 'purpose' || kind === 'structure') {
      if (!/^\d+$/.test(text)) return text;
      const names = kind === 'purpose' ? purposeNames : structureNames;
      const code = kind === 'purpose' ? text.padStart(5, '0') : text;
      return names[code] || `코드 ${text}`;
    }
    if (kind === 'date') {
      if (text === '00000000') return missing;
      return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : text;
    }
    if (kind === 'area') {
      if (/평/.test(text)) return text;
      const amount = numeric(text, /\s*(?:㎡|m²|m2|제곱미터)\s*$/i);
      return amount == null ? text : `${numberText(amount)} ㎡ (${numberText(amount * 0.3025)}평)`;
    }
    const units = { floor: [/\s*층\s*$/, '층'], height: [/\s*m\s*$/i, 'm'], percent: [/\s*%\s*$/, '%'] };
    if (units[kind]) {
      const [pattern, suffix] = units[kind];
      const amount = numeric(text, pattern);
      return amount == null ? text : `${numberText(amount)}${suffix}`;
    }
    return text;
  }

  function getInfoRows(feature) {
    return fields.map(([label, names, kind]) => [label, display(read(feature?.properties, names), kind)]);
  }

  function getAddressItems(feature, fallbackAddress = '') {
    const properties = feature?.properties;
    const road = read(properties, ['road_addr', 'rn_addr', 'roadAddr', 'road_address', 'rn', 'road_nm', 'rd_nm', 'newPlatPlc']);
    const parcel = read(properties, ['jibun_addr', 'jibun', 'lot_no', 'addr', 'platPlc']) || clean(fallbackAddress);
    return [road ? ['도로명', road] : null, parcel ? ['지번', parcel] : null].filter(Boolean);
  }

  function isRegistryFeature(feature) {
    return /(?:^|[:/])lt_c_bldginfo(?:[.:/]|$)/i.test(clean(feature?.id)) || Boolean(read(feature?.properties, registryFields));
  }

  return { getInfoRows, getAddressItems, isRegistryFeature };
});
