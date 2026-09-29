(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VworldParcel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const regionNames = new Set(['도시지역', '관리지역', '농림지역', '자연환경보전지역', '보전관리지역', '생산관리지역', '계획관리지역', '주거지역', '상업지역', '공업지역', '녹지지역', '전용주거지역', '일반주거지역', '제1종전용주거지역', '제2종전용주거지역', '제1종일반주거지역', '제2종일반주거지역', '제3종일반주거지역', '준주거지역', '중심상업지역', '일반상업지역', '근린상업지역', '유통상업지역', '전용공업지역', '일반공업지역', '준공업지역', '보전녹지지역', '생산녹지지역', '자연녹지지역']);
  const clean = (value) => value == null ? '' : String(value).trim();

  function formatLocation(address, lotNumber = '') {
    const tokens = clean(address).replace(/\s+/g, ' ').split(' ');
    const localityToken = /^[가-힣0-9·]+(?:읍|면|리|동|가)$/;
    const start = tokens.findIndex((token) => localityToken.test(token));
    if (start < 0) return clean(lotNumber);
    const locality = [];
    let end = start;
    while (end < tokens.length && localityToken.test(tokens[end])) locality.push(tokens[end++]);
    const addressLot = tokens.slice(end).join(' ').match(/^(?:산\s*)?\d+(?:-\d+)?(?:\s*번지)?(?=$|\s|[()])/);
    const lot = clean(lotNumber) || (addressLot ? addressLot[0].replace(/\s*번지$/, '').replace(/^산\s*/, '산 ') : '');
    return [...locality, lot].filter(Boolean).join(' ');
  }

  function readPage(data, fieldName) {
    const body = data?.[fieldName];
    if (!body || typeof body !== 'object') throw new Error('V-World 속성정보 응답 형식을 확인할 수 없습니다.');
    const code = clean(body.resultCode);
    if (code && !['0', '00', '000', '0000', 'NORMAL_SERVICE', 'INFO-000'].includes(code)) {
      if (/KEY|AUTH|DOMAIN/i.test(code)) throw new Error('V-World 인증키의 국가중점데이터 권한과 등록 도메인을 확인해 주세요.');
      throw new Error(`V-World 속성 조회 오류 (${code}): ${clean(body.resultMsg)}`);
    }
    const rows = Array.isArray(body.field) ? body.field : body.field ? [body.field] : [];
    const total = body.totalCount == null ? rows.length : Number(body.totalCount);
    if (!Number.isFinite(total) || total < 0 || (total > 0 && !rows.length)) throw new Error('V-World 속성정보가 불완전하게 응답했습니다.');
    return { rows, total };
  }

  async function readAll(endpoint, fieldName, pnu, options) {
    const rows = [];
    for (let page = 1; page <= 10; page += 1) {
      const url = new URL(`https://api.vworld.kr/ned/data/${endpoint}`);
      Object.entries({ pnu, key: options.key, domain: options.domain, format: 'json', numOfRows: '100', pageNo: String(page) }).forEach(([key, value]) => url.searchParams.set(key, value));
      const result = readPage(await options.requestJson(url), fieldName);
      if (result.rows.some((row) => clean(row.pnu) !== pnu)) throw new Error('요청한 필지와 V-World 응답 필지가 다릅니다.');
      rows.push(...result.rows);
      if (rows.length >= result.total) return rows;
    }
    throw new Error('V-World 속성정보가 너무 많아 전체 자료를 확인하지 못했습니다.');
  }

  function normalize(pnu, characteristics, uses, failures = {}) {
    const latest = [...characteristics].sort((a, b) => Number(b.stdrYear || 0) - Number(a.stdrYear || 0) || Number(b.stdrMt || 0) - Number(a.stdrMt || 0) || clean(b.lastUpdtDt).localeCompare(clean(a.lastUpdtDt)))[0];
    const zones = [], seen = new Set();
    const add = (name, kind, relation = '') => {
      name = clean(name);
      if (!name || ['지정되지않음', '미지정', '-'].includes(name)) return;
      const id = `${kind}:${name}:${relation}`;
      if (!seen.has(id)) { zones.push({ name, kind, relation }); seen.add(id); }
    };
    for (const row of uses) {
      const name = clean(row.prposAreaDstrcCodeNm);
      const base = name.replace(/\s/g, '').split(/[（(]/)[0];
      const kind = regionNames.has(base) ? 'region' : /^UQ/.test(clean(row.prposAreaDstrcCode)) && /지구$/.test(base) ? 'district' : 'other';
      add(name, kind, clean(row.cnflcAtNm));
    }
    // The annual characteristics record can provide zoning even if the plan API fails.
    if (!zones.some((zone) => zone.kind === 'region')) {
      add(latest?.prposArea1Nm, 'region');
      add(latest?.prposArea2Nm, 'region');
    }
    const area = clean(latest?.lndpclAr).replace(/,/g, '');
    return {
      pnu, source: 'V-World', year: clean(latest?.stdrYear),
      address: latest ? `${clean(latest.ldCodeNm)} ${clean(latest.mnnmSlno)}`.trim() : '',
      parcel: { area: area && Number.isFinite(Number(area)) && Number(area) >= 0 ? area : '', category: clean(latest?.lndcgrCodeNm) },
      zones,
      errors: {
        area: failures.characteristics || '',
        region: zones.some((zone) => zone.kind === 'region') ? '' : failures.uses || failures.characteristics || '',
        district: failures.uses || '',
      },
    };
  }

  async function load(pnu, options) {
    if (!/^\d{19}$/.test(pnu)) throw new Error('19자리 필지번호가 필요합니다.');
    const [characteristics, uses] = await Promise.allSettled([
      readAll('getLandCharacteristics', 'landCharacteristicss', pnu, options),
      readAll('getLandUseAttr', 'landUses', pnu, options),
    ]);
    if (characteristics.status === 'rejected' && uses.status === 'rejected') throw characteristics.reason;
    return normalize(pnu,
      characteristics.status === 'fulfilled' ? characteristics.value : [],
      uses.status === 'fulfilled' ? uses.value : [],
      { characteristics: characteristics.status === 'rejected' ? characteristics.reason.message : '', uses: uses.status === 'rejected' ? uses.reason.message : '' }
    );
  }

  return { load, normalize, readPage, formatLocation };
});
