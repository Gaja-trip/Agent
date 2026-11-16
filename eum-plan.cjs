const DETAIL_URL = 'https://www.eum.go.kr/web/ar/lu/luLandDet.jsp';
const IMAGE_PATH = '/web/ar/lu/images';
const SCALES = new Set(['500', '600', '1000', '1200', '2400', '3000', '6000']);
const MAX_HTML_BYTES = 2_000_000;
const MAX_IMAGE_BYTES = 2_000_000;
const MAX_PLAN_IMAGE_BYTES = 2_500_000;
const UNKNOWN = '확인 불가';

class PlanError extends Error {
  constructor(message, status = 502, code = 'EUM_PLAN_UNAVAILABLE') {
    super(message); this.status = status; this.code = code;
  }
}

function validate(pnu, scale) {
  if (!/^\d{19}$/.test(String(pnu || ''))) throw new PlanError('19자리 필지번호가 필요합니다.', 400, 'INVALID_PNU');
  if (!SCALES.has(String(scale))) throw new PlanError('지원하는 도면 축척을 선택해 주세요.', 400, 'INVALID_SCALE');
}

function buildDetailUrl(pnu, scale = '1200') {
  pnu = String(pnu); scale = String(scale); validate(pnu, scale);
  const url = new URL(DETAIL_URL);
  url.search = new URLSearchParams({
    pnu, selSido: pnu.slice(0, 2), selSgg: pnu.slice(2, 5), selUmd: pnu.slice(5, 8), selRi: pnu.slice(8, 10),
    landGbn: pnu[10], bobn: String(Number(pnu.slice(11, 15))), bubn: Number(pnu.slice(15)) ? String(Number(pnu.slice(15))) : '',
    sggcd: pnu.slice(0, 5), chk: '0', scale, scaleFlag: '', isNoScr: 'script', mode: 'search', selGbn: 'umd', s_type: '1', add: 'land',
  }).toString();
  return url.href;
}

function decodeEntities(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, name) => {
    if (name[0] !== '#') return entities[name.toLowerCase()] || all;
    const point = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  });
}

function attrs(tag) {
  const result = {};
  for (const match of String(tag).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}

function plainText(fragment) {
  return decodeEntities(String(fragment || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function innerById(html, id, tag) {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi');
  for (const match of html.matchAll(pattern)) if (attrs(match[1]).id === id) return match[2];
  return '';
}

function withoutPopupDivs(fragment) {
  let result = '', previous = 0, depth = 0;
  for (const match of fragment.matchAll(/<\/?div\b[^>]*>/gi)) {
    const closing = /^<\//.test(match[0]);
    if (!depth && !closing && /(?:^|\s)layer_pop(?:\s|$)/.test(attrs(match[0]).class || '')) {
      result += fragment.slice(previous, match.index); depth = 1;
    } else if (depth) {
      depth += closing ? -1 : 1;
      if (!depth) previous = match.index + match[0].length;
    }
  }
  return result + (depth ? '' : fragment.slice(previous));
}

function imageUrl(source, pnu, mapKey) {
  let url;
  try { url = new URL(source, DETAIL_URL); } catch { throw new PlanError('토지이음 도면 주소를 확인하지 못했습니다.'); }
  if (url.origin !== 'https://www.eum.go.kr' || url.pathname !== IMAGE_PATH || url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => key !== 'key') || url.searchParams.getAll('key').length !== 1) {
    throw new PlanError('토지이음 도면 주소가 올바르지 않습니다.');
  }
  const key = url.searchParams.get('key') || '';
  if (mapKey ? !new RegExp(`^${mapKey}\\d{1,3}$`).test(key) : !new RegExp(`^\\d{10,17}-${pnu}$`).test(key)) {
    throw new PlanError('요청한 필지와 토지이음 도면이 일치하지 않습니다.');
  }
  return url.href;
}

function parseDetailHtml(html, pnu, scale = '1200') {
  validate(pnu, scale);
  const inputs = [...String(html).matchAll(/<input\b[^>]*>/gi)].map((item) => attrs(item[0]));
  if (!inputs.some((input) => (input.id === 'pnu' || input.name === 'pnu') && input.value === pnu)) {
    throw new PlanError('요청한 필지의 토지이용계획을 확인하지 못했습니다.');
  }
  const mapBlock = String(html).match(/<div\b[^>]*class\s*=\s*["'][^"']*\bmap_a_img\b[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1] || '';
  const mapTag = mapBlock.match(/<img\b[^>]*>/i)?.[0];
  if (!mapTag) throw new PlanError('토지이음 확인도면을 찾지 못했습니다. 원문을 확인해 주세요.');
  const mapSource = imageUrl(attrs(mapTag).src || '', pnu);
  const mapKey = new URL(mapSource).searchParams.get('key');
  const legendBlock = String(html).match(/<ul\b[^>]*class\s*=\s*["'][^"']*\blegend\b[^"']*["'][^>]*>([\s\S]*?)<\/ul\s*>/i)?.[1] || '';
  const legendSources = [...legendBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)].map((match) => {
    const image = match[1].match(/<img\b[^>]*>/i)?.[0];
    if (!image) throw new PlanError('토지이음 범례 이미지를 확인하지 못했습니다.');
    const attributes = attrs(image);
    return { label: plainText(match[1]) || attributes.alt?.replace(/\s*범례$/, '') || UNKNOWN, url: imageUrl(attributes.src || '', pnu, mapKey) };
  });
  if (!legendSources.length || legendSources.length > 64) throw new PlanError('토지이음 범례 목록을 확인하지 못했습니다.');
  const address = plainText(String(html).match(/<th\b[^>]*>\s*소재지\s*<\/th\s*>\s*<td\b[^>]*>([\s\S]*?)<\/td\s*>/i)?.[1]);
  const category = inputs.find((input) => input.id === 'present_class_val' || input.name === 'present_class_val')?.value;
  const categoryText = category || plainText(innerById(html, 'present_class', 'td').split(/<span\b/i)[0]);
  const zoneTitles = ['국토계획법에 따른 지역·지구', '다른 법령에 따른 지역·지구', '토지이용규제 기본법 시행령 제9조제4항에 해당되는 사항'];
  return {
    pnu, scale: String(scale), sourceUrl: buildDetailUrl(pnu, scale),
    parcel: { address: address || UNKNOWN, category: categoryText || UNKNOWN, area: plainText(innerById(html, 'present_area', 'td')) || UNKNOWN, price: plainText(innerById(html, 'jiga', 'span')) || UNKNOWN },
    zoneGroups: zoneTitles.map((title, index) => ({ title, text: plainText(withoutPopupDivs(innerById(html, `present_mark${index + 1}`, 'td'))) || UNKNOWN })),
    mapSource, legendSources,
  };
}

function readPng(value) {
  const data = Buffer.from(value);
  if (data.length < 45 || data.length > MAX_IMAGE_BYTES || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.readUInt32BE(8) !== 13 || data.toString('ascii', 12, 16) !== 'IHDR') {
    throw new PlanError('토지이음 도면 이미지가 올바르지 않습니다. 다시 조회해 주세요.');
  }
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16_000_000) throw new PlanError('토지이음 도면 크기가 올바르지 않습니다.');
  let offset = 8, hasData = false, ended = false;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset), end = offset + 12 + length;
    if (end > data.length) break;
    const type = data.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT' && length) hasData = true;
    if (type === 'IEND') { ended = length === 0 && end === data.length; break; }
    offset = end;
  }
  if (!hasData || !ended) throw new PlanError('토지이음 도면 이미지가 완전하지 않습니다. 다시 조회해 주세요.');
  return { src: `data:image/png;base64,${data.toString('base64')}`, width, height };
}

async function readBytes(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) throw new PlanError('토지이음 응답 크기가 너무 큽니다.');
  if (!response.body?.getReader) {
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > limit) throw new PlanError('토지이음 응답 크기가 너무 큽니다.');
    return data;
  }
  const reader = response.body.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new PlanError('토지이음 응답 크기가 너무 큽니다.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}

function createPlanService({ fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 20_000, cacheTtlMs = 120_000, maxCacheEntries = 32 } = {}) {
  const cache = new Map(), inflight = new Map();
  async function fetchPlan(pnu, scale) {
    const signal = AbortSignal.timeout(timeoutMs), jar = new Map();
    function rememberCookies(headers) {
      const separate = headers.getSetCookie?.() || [];
      const values = separate.length ? separate : (headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=)/).filter(Boolean);
      for (const value of values) {
        const pair = value.split(';', 1)[0], index = pair.indexOf('=');
        if (index > 0 && !/[\r\n]/.test(pair)) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
      }
    }
    const detailUrl = buildDetailUrl(pnu, scale);
    async function request(url, limit) {
      signal.throwIfAborted();
      const response = await fetchImpl(url, { signal, redirect: 'error', cache: 'no-store', headers: {
        Accept: url === detailUrl ? 'text/html' : 'image/png', Referer: detailUrl,
        ...(jar.size ? { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') } : {}),
      } });
      if (!response.ok) throw new PlanError('토지이음 서버에 연결하지 못했습니다. 잠시 후 다시 조회해 주세요.');
      rememberCookies(response.headers);
      return { response, data: await readBytes(response, limit) };
    }
    try {
      const { response, data } = await request(detailUrl, MAX_HTML_BYTES);
      const contentType = response.headers.get('content-type') || '';
      const charset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] || data.subarray(0, 1024).toString('ascii').match(/charset\s*=\s*["']?([^\s;"'>]+)/i)?.[1] || 'euc-kr';
      let html;
      try { html = new TextDecoder(charset).decode(data); } catch { throw new PlanError('토지이음 원문 인코딩을 확인하지 못했습니다.'); }
      const parsed = parseDetailHtml(html, pnu, scale);
      if (!jar.size) throw new PlanError('토지이음 도면 조회 세션을 준비하지 못했습니다. 다시 조회해 주세요.');
      const sources = [parsed.mapSource, ...parsed.legendSources.map((item) => item.url)];
      const images = new Array(sources.length), imageRequests = new Map();
      let cursor = 0, totalBytes = 0;
      async function getImage(url) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const result = await request(url, MAX_IMAGE_BYTES);
          if (!result.data.length && !attempt) continue;
          if (!result.data.length) throw new PlanError('토지이음 도면 이미지가 비어 있습니다. 다시 조회해 주세요.');
          if (!/^image\/(?:x-)?png(?:\s*;|$)/i.test(result.response.headers.get('content-type') || '')) throw new PlanError('토지이음 도면 이미지 형식을 확인하지 못했습니다.');
          return { image: readPng(result.data), bytes: result.data.length };
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
        while (cursor < sources.length) {
          const index = cursor++, source = sources[index];
          if (!imageRequests.has(source)) imageRequests.set(source, getImage(source));
          const item = await imageRequests.get(source);
          totalBytes += item.bytes;
          if (totalBytes > MAX_PLAN_IMAGE_BYTES) throw new PlanError('토지이음 확인도면과 범례의 용량이 너무 큽니다. 원문을 확인해 주세요.');
          images[index] = item.image;
        }
      }));
      return { pnu, scale, sourceUrl: parsed.sourceUrl, parcel: parsed.parcel, zoneGroups: parsed.zoneGroups, map: images[0], legend: parsed.legendSources.map((item, index) => ({ label: item.label, ...images[index + 1] })) };
    } catch (error) {
      if (signal.aborted) throw new PlanError('토지이음 도면 응답이 지연되고 있습니다. 다시 조회해 주세요.', 504, 'EUM_PLAN_TIMEOUT');
      if (error instanceof PlanError) throw error;
      throw new PlanError('토지이음 도면 서버에 연결하지 못했습니다. 잠시 후 다시 조회해 주세요.');
    }
  }
  async function load(pnu, scale = '1200', { refresh = false } = {}) {
    pnu = String(pnu || ''); scale = String(scale); validate(pnu, scale);
    const key = `${pnu}:${scale}`;
    if (inflight.has(key)) return inflight.get(key);
    const stored = cache.get(key);
    if (!refresh && stored && now() - stored.time < cacheTtlMs) {
      cache.delete(key); cache.set(key, stored); return stored.data;
    }
    cache.delete(key);
    if (inflight.size >= 32) throw new PlanError('도면 조회가 많습니다. 잠시 후 다시 조회해 주세요.', 503, 'EUM_PLAN_BUSY');
    const task = fetchPlan(pnu, scale).then((data) => {
      cache.set(key, { time: now(), data });
      while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
      return data;
    }).finally(() => inflight.delete(key));
    inflight.set(key, task);
    return task;
  }
  return { load };
}

const defaultService = createPlanService();
async function handleEumPlanRequest(request, response, url, service = defaultService) {
  if (url.pathname !== '/api/eum/plan') return false;
  const send = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(data)); };
  if (request.method !== 'GET') { send(405, { error: '조회 요청만 지원합니다.' }); return true; }
  if ([...url.searchParams.keys()].some((key) => !['pnu', 'scale', 'refresh'].includes(key)) || [...new Set(url.searchParams.keys())].some((key) => url.searchParams.getAll(key).length !== 1) || (url.searchParams.has('refresh') && url.searchParams.get('refresh') !== '1')) {
    send(400, { error: '도면 조회 요청이 올바르지 않습니다.' }); return true;
  }
  try {
    const pnu = url.searchParams.get('pnu') || '', scale = url.searchParams.get('scale') || '1200';
    validate(pnu, scale);
    send(200, await service.load(pnu, scale, { refresh: url.searchParams.get('refresh') === '1' }));
  } catch (error) { send(error.status || 502, { error: error.message, code: error.code || 'EUM_PLAN_UNAVAILABLE' }); }
  return true;
}

module.exports = { createPlanService, handleEumPlanRequest, buildDetailUrl, parseDetailHtml, readPng };
