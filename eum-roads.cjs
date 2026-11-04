const MAP_PAGE = 'https://www.eum.go.kr/web/mp/mpMapDet.jsp';
const MAP_SERVICE = 'https://www.eum.ne.kr:9003/MapPlan/MapPlan';
const MAX_SPAN_METRES = 6000;
const MAX_POINTS = 60000;
const a = 6378137;
const f = 1 / 298.257222101;
const e2 = 2 * f - f * f;
const ep2 = e2 / (1 - e2);
const k0 = 0.9996;
const lon0 = 127.5 * Math.PI / 180;
const lat0 = 38 * Math.PI / 180;

// EPSG:5179 (GRS80 / Korea 2000 Unified CS), as used by the Eum map.
function meridian(lat) {
  return a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat)
    - 35 * e2 ** 3 / 3072 * Math.sin(6 * lat));
}

function project(lon, lat) {
  const phi = lat * Math.PI / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = ep2 * Math.cos(phi) ** 2;
  const d = (lon * Math.PI / 180 - lon0) * Math.cos(phi);
  return [1000000 + k0 * n * (d + (1 - t + c) * d ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * d ** 5 / 120),
    2000000 + k0 * (meridian(phi) - meridian(lat0) + n * Math.tan(phi) * (d * d / 2 + (5 - t + 9 * c + 4 * c * c) * d ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * d ** 6 / 720))];
}

function unproject(x, y) {
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const mu = (meridian(lat0) + (y - 2000000) / k0) / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const phi = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + 151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const t = Math.tan(phi) ** 2;
  const c = ep2 * Math.cos(phi) ** 2;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const r = a * (1 - e2) / (1 - e2 * Math.sin(phi) ** 2) ** 1.5;
  const d = (x - 1000000) / (n * k0);
  const lat = phi - n * Math.tan(phi) / r * (d * d / 2 - (5 + 3 * t + 10 * c - 4 * c * c - 9 * ep2) * d ** 4 / 24
    + (61 + 90 * t + 298 * c + 45 * t * t - 252 * ep2 - 3 * c * c) * d ** 6 / 720);
  const lon = lon0 + (d - (1 + 2 * t + c) * d ** 3 / 6 + (5 - 2 * c + 28 * t - 3 * c * c + 8 * ep2 + 24 * t * t) * d ** 5 / 120) / Math.cos(phi);
  return [Number((lon * 180 / Math.PI).toFixed(7)), Number((lat * 180 / Math.PI).toFixed(7))];
}

function parseVersion(html) {
  const select = html.match(/<select\b[^>]*\bid=["']selLcstSpaceDplyDate["'][^>]*>([\s\S]*?)<\/select>/i)?.[1];
  const versions = [...(select || '').matchAll(/<option\b[^>]*\bvalue=["'](20\d{6})["']/gi)].map((m) => m[1]).filter((value) => {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
    const parsed = new Date(date + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date);
  });
  if (!versions.length) throw new Error('토지이음 최신 도면 생성일을 확인하지 못했습니다.');
  return versions.sort().at(-1);
}

function readBounds(params) {
  const parts = (params.get('bbox') || '').split(',');
  const bounds = parts.map((value) => value.trim() ? Number(value) : NaN);
  const [west, south, east, north] = bounds;
  if (parts.length !== 4 || !bounds.every(Number.isFinite) || west < 124 || east > 132 || south < 32 || north > 40 || west >= east || south >= north) {
    throw Object.assign(new Error('올바른 국내 지도 범위가 필요합니다.'), { status: 400 });
  }
  const corners = [project(west, south), project(west, north), project(east, south), project(east, north)];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  const mbr = [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2];
  if (mbr[2] - mbr[0] > MAX_SPAN_METRES || mbr[3] - mbr[1] > MAX_SPAN_METRES) {
    throw Object.assign(new Error('지도를 확대하면 토지이음 도시계획도로를 표시합니다.'), { status: 400 });
  }
  return mbr.map((value) => value.toFixed(2)).join(',');
}

function convertFeatures(data, code, budget) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('토지이음 도로 경계 응답이 올바르지 않습니다.');
  const depths = { Polygon: 2, MultiPolygon: 3, LineString: 1, MultiLineString: 2 };
  function coordinates(value, depth) {
    if (!Array.isArray(value) || !value.length) throw new Error('토지이음 도로 좌표가 올바르지 않습니다.');
    if (depth) return value.map((part) => coordinates(part, depth - 1));
    if (value.length < 2 || !value.slice(0, 2).every(Number.isFinite) || value[0] < 500000 || value[0] > 1500000 || value[1] < 1000000 || value[1] > 2500000) throw new Error('토지이음 도로 좌표계가 올바르지 않습니다.');
    if (++budget.points > MAX_POINTS) throw new Error('도로 경계가 많습니다. 지도를 더 확대해 주세요.');
    return unproject(value[0], value[1]);
  }
  return data.features.map((feature) => {
    if (feature?.type !== 'Feature' || feature.properties?.mnum !== code || !Object.hasOwn(depths, feature.geometry?.type)) throw new Error('요청한 토지이음 도로와 응답 도형이 다릅니다.');
    return { type: 'Feature', id: String(feature.id ?? ''), properties: { code, name: String(feature.properties.uname || '도시계획도로').slice(0, 100) },
      geometry: { type: feature.geometry.type, coordinates: coordinates(feature.geometry.coordinates, depths[feature.geometry.type]) } };
  });
}

function createRoadsService({ fetchImpl = (...args) => fetch(...args), now = Date.now } = {}) {
  let metadata;
  let metadataPending;
  async function read(url, json = true, signal) {
    const timeout = AbortSignal.timeout(10000);
    const result = await fetchImpl(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect: 'error' });
    if (!result.ok) throw new Error('토지이음 지도 서버에 연결하지 못했습니다. 잠시 후 갱신해 주세요.');
    if (Number(result.headers.get('content-length')) > 4000000) throw new Error('도로 경계가 많습니다. 지도를 더 확대해 주세요.');
    const buffer = await result.arrayBuffer();
    if (buffer.byteLength > 4000000) throw new Error('도로 경계가 많습니다. 지도를 더 확대해 주세요.');
    const text = new TextDecoder(json ? 'utf-8' : 'euc-kr').decode(buffer);
    return json ? JSON.parse(text) : text;
  }
  async function version(refresh) {
    if (!refresh && metadata && now() - metadata.time < 3600000) return metadata.value;
    if (!metadataPending) metadataPending = read(MAP_PAGE, false).then(parseVersion).then((value) => { metadata = { value, time: now() }; return value; }).finally(() => { metadataPending = null; });
    return metadataPending;
  }
  async function load(params) {
    const mbr = readBounds(params);
    const signal = AbortSignal.timeout(22000);
    const currentVersion = await version(params.get('refresh') === '1');
    const query = (values) => { const url = new URL(MAP_SERVICE); url.search = new URLSearchParams({ version: currentVersion, mbr, ...values }).toString(); return read(url, true, signal); };
    const available = await query({ req: 'code', tiles: 'tile6', levelId: '14', accuracy: 'true' });
    if (!Array.isArray(available?.layer) || available.layer.some((item) => !Array.isArray(item?.code))) throw new Error('토지이음 도로 범례 응답이 올바르지 않습니다.');
    const codes = [...new Set(available.layer.filter((item) => item.name === 'CA').flatMap((item) => item.code).filter((code) => /^UQS1\d{2}$/.test(code)))];
    const budget = { points: 0 };
    const features = [];
    for (let offset = 0; offset < codes.length; offset += 4) {
      const batches = await Promise.all(codes.slice(offset, offset + 4).map(async (code) => convertFeatures(await query({ req: 'search', layer: 'CA', code }), code, budget)));
      features.push(...batches.flat());
    }
    const seen = new Set();
    return { type: 'FeatureCollection', source: '토지이음', version: currentVersion,
      sourceUrl: MAP_PAGE, features: features.filter((feature) => {
        const key = feature.id ? `${feature.properties.code}:${feature.id}` : JSON.stringify(feature.geometry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }) };
  }
  return { load };
}

const service = createRoadsService();
async function handleEumRoadsRequest(request, response, url) {
  if (url.pathname !== '/api/eum/roads') return false;
  const send = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(data));
  };
  if (request.method !== 'GET') { send(405, { error: '조회 요청만 지원합니다.' }); return true; }
  try { send(200, await service.load(url.searchParams)); }
  catch (error) { send(error.status || 502, { error: error.status ? error.message : `토지이음 도로 조회 실패: ${error.message}` }); }
  return true;
}

module.exports = { createRoadsService, handleEumRoadsRequest, parseVersion, readBounds, project, unproject };
