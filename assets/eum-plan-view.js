(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EumPlanView = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
  function imageSource(image) {
    if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image.src || '') || !image.width || !image.height) {
      throw new Error('확인도면 또는 범례를 불러오지 못했습니다. 다시 조회해 주세요.');
    }
    return image.src;
  }
  function render(data) {
    const parcel = data.parcel || {};
    return `<div class="eum-plan__heading"><div><span class="eum-plan__eyebrow">토지이음 토지이용계획</span><h2>${escape(parcel.address)}</h2></div><span class="eum-plan__scale">축척 1:${escape(data.scale)}</span></div>
      <dl class="eum-plan__facts"><div><dt>지목</dt><dd>${escape(parcel.category)}</dd></div><div><dt>면적</dt><dd>${escape(parcel.area)}</dd></div><div><dt>개별공시지가 (㎡당)</dt><dd>${escape(parcel.price)}</dd></div></dl>
      <div class="eum-plan__drawing"><section class="eum-plan__map"><h3>확인도면</h3><img src="${imageSource(data.map)}" width="${Number(data.map.width)}" height="${Number(data.map.height)}" alt="${escape(parcel.address)} 토지이음 확인도면" /></section>
      <section class="eum-plan__legend"><h3>범례</h3><ul>${data.legend.map(item => `<li><img src="${imageSource(item)}" width="${Number(item.width)}" height="${Number(item.height)}" alt="${escape(item.label)} 범례" /><span>${escape(item.label)}</span></li>`).join('')}</ul></section></div>
      <section class="eum-plan__zones"><h3>지역·지구 등 지정여부</h3><dl>${data.zoneGroups.map(group => `<div><dt>${escape(group.title)}</dt><dd>${escape(group.text)}</dd></div>`).join('')}</dl></section>
      <p class="eum-plan__note">자료: 토지이음 · 확인도면은 참고용이며 법적 효력이 없습니다. 행위제한 등 상세 내용은 ‘전체 열람’ 또는 ‘원문 열기’에서 확인하세요.</p>`;
  }
  function create(root) {
    let controller, requestId = 0, currentPnu = '', loadedAt = 0;
    function empty() {
      controller?.abort(); requestId += 1; currentPnu = ''; loadedAt = 0;
      controller = null; root.setAttribute('aria-busy', 'false');
      root.innerHTML = '<div class="eum-plan__empty"><i data-lucide="map-pinned"></i><h2>확인도면·범례</h2><p>상단에서 주소를 검색하면 해당 필지의 도면과 범례를 함께 표시합니다.</p></div>';
    }
    async function load(pnu, { refresh = false } = {}) {
      if (!pnu) { empty(); return; }
      if (!refresh && currentPnu === pnu && (loadedAt && Date.now() - loadedAt < 120000 || controller && !controller.signal.aborted && !loadedAt)) return;
      controller?.abort(); controller = new AbortController();
      const active = controller, request = ++requestId;
      currentPnu = pnu; loadedAt = 0;
      const timeout = setTimeout(() => active.abort(new Error('토지이음 응답이 지연되고 있습니다. 다시 조회해 주세요.')), 55000);
      root.setAttribute('aria-busy', 'true');
      root.innerHTML = '<div class="eum-plan__empty" role="status"><span class="eum-plan__loading" aria-hidden="true"></span><h2>확인도면과 범례를 불러오는 중입니다.</h2></div>';
      try {
        const params = new URLSearchParams({ pnu, scale: '1200', ...(refresh ? { refresh: '1' } : {}) });
        const response = await fetch(`/api/eum/plan?${params}`, { signal: active.signal, cache: 'no-store' });
        if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('확인도면 조회에 연결하지 못했습니다. 다시 조회해 주세요.');
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || '토지이음 도면을 불러오지 못했습니다.');
        if (data.pnu !== pnu) throw new Error('선택 필지와 도면이 일치하지 않습니다. 다시 조회해 주세요.');
        if (!Array.isArray(data.legend) || !data.legend.length || !Array.isArray(data.zoneGroups)) throw new Error('확인도면과 범례 내용을 확인하지 못했습니다. 다시 조회해 주세요.');
        if (request !== requestId || active.signal.aborted) return;
        root.innerHTML = render(data);
        await Promise.all([...root.querySelectorAll('.eum-plan__drawing img')].map(img => img.decode())).catch(() => { throw new Error('확인도면 또는 범례 이미지를 표시하지 못했습니다. 다시 조회해 주세요.'); });
        if (request !== requestId || active.signal.aborted) return;
        loadedAt = Date.now();
      } catch (error) {
        if (request !== requestId) return;
        const message = active.signal.aborted ? active.signal.reason?.message : error.message;
        root.innerHTML = `<div class="eum-plan__empty"><h2>확인도면·범례를 확인하지 못했습니다.</h2><p role="alert">${escape(message || '잠시 후 다시 조회해 주세요.')}</p><button type="button" class="button button--primary" data-eum-action="reload">다시 조회</button></div>`;
      } finally {
        clearTimeout(timeout);
        if (request === requestId) { root.setAttribute('aria-busy', 'false'); controller = null; }
      }
    }
    return { load, empty, destroy() { requestId += 1; controller?.abort(); } };
  }
  return { create, render };
});
