// Kakao's public map address search. No application keys or proxy are used.
const ENDPOINT = 'https://search.map.kakao.com/mapsearch/search_addr.daum';
const cache = new Map();
let requestId = 0;

export function normalizeQuery(value) {
  const query = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < 2) throw new Error('도로명 주소나 지번 주소를 두 글자 이상 입력해 주세요.');
  if (query.length > 150) throw new Error('주소는 150자 이내로 입력해 주세요.');
  return query;
}

export function normalizeAddressResponse(data) {
  if (!data || !Array.isArray(data.List)) throw new Error('주소 검색 응답을 읽지 못했습니다. 잠시 후 다시 검색해 주세요.');
  const seen = new Set();
  const results = [];
  for (const item of data.List) {
    const lat = Number(item.lat), lng = Number(item.lon);
    const address = typeof item.addr === 'string' ? item.addr.trim() : '';
    if (!address || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 123 || lng > 133 || item.is_alive === 'N') continue;
    const key = `${address}:${lat}:${lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const related = String(item.related_address || '').split(';')[0].split('^')[0];
    results.push({
      id: String(item.docid || key), address, lat, lng,
      building: typeof item.building_name === 'string' ? item.building_name : '',
      alternate: related ? `${item.related_prefix_address || ''} ${related}`.trim() : '',
      postalCode: /^\d{5}$/.test(item.zone_no) ? item.zone_no : '',
    });
    if (results.length === 8) break;
  }
  return { results, total: Math.max(results.length, Number(data.total_count) || 0) };
}

export async function searchAddresses(value, { signal } = {}) {
  const query = normalizeQuery(value);
  if (signal?.aborted) throw new DOMException('검색이 취소되었습니다.', 'AbortError');
  if (cache.has(query)) return cache.get(query);
  const result = await new Promise((resolve, reject) => {
    const callback = `__roadviewAddress_${Date.now()}_${++requestId}`;
    const script = document.createElement('script');
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({ q: query, cpage: '1', callback });
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      script.remove();
      // Ignore a late JSONP response from a cancelled request.
      window[callback] = () => {};
      setTimeout(() => { delete window[callback]; }, 60000);
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(new DOMException('검색이 취소되었습니다.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('주소 검색 응답이 늦어지고 있습니다. 잠시 후 다시 검색해 주세요.')), 10000);
    window[callback] = (data) => {
      try { finish(null, normalizeAddressResponse(data)); }
      catch (error) { finish(error); }
    };
    signal?.addEventListener('abort', abort, { once: true });
    script.onerror = () => finish(new Error('주소 검색에 연결하지 못했습니다. 네트워크 연결을 확인하고 다시 검색해 주세요.'));
    script.src = url.href;
    document.head.append(script);
  });
  if (cache.size >= 20) cache.delete(cache.keys().next().value);
  cache.set(query, result);
  return result;
}
