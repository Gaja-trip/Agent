// Kakao WCONGNAMUL = EPSG:5181 (GRS80, Korean Central Belt) × 2.5.
// Projection parameters confirmed by Kakao:
// https://devtalk.kakao.com/t/topic/38086
// +proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80
// This local implementation avoids a coordinate-conversion API request/key.
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const DEG = Math.PI / 180;
const LON0 = 127 * DEG;
const SCALE = 2.5;
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function finiteNumber(value, label) {
  if (typeof value === 'string') {
    if (!NUMERIC.test(value.trim())) throw new Error(`${label}에 유효한 숫자를 입력해 주세요.`);
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label}에 유효한 숫자를 입력해 주세요.`);
  }
  return value;
}

function rangedNumber(value, label, min, max, integer = false) {
  const number = finiteNumber(value, label);
  if (number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`${label}은(는) ${min}~${max} 범위의 ${integer ? '정수' : '숫자'}여야 합니다.`);
  }
  return number;
}

function coordinate({ lat, lng }) {
  return {
    lat: rangedNumber(lat, '위도(lat)', -90, 90),
    lng: rangedNumber(lng, '경도(lng)', -180, 180),
  };
}

function meridian(phi) {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const e8 = e4 * e4;
  return A * (
    (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256 - 175 * e8 / 16384) * phi
    - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024 + 105 * e8 / 4096) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024 + 525 * e8 / 16384) * Math.sin(4 * phi)
    - (35 * e6 / 3072 + 175 * e8 / 12288) * Math.sin(6 * phi)
    + 315 * e8 / 131072 * Math.sin(8 * phi)
  );
}

const M0 = meridian(38 * DEG);

/** Convert Korean WGS84 latitude/longitude to Kakao's projected coordinates. */
export function wgs84ToWcongnamul(location) {
  const { lat, lng } = coordinate(location);
  const phi = lat * DEG;
  const lambda = lng * DEG;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const t = tan * tan;
  const c = EP2 * cos * cos;
  const d = (lambda - LON0) * cos;
  const d2 = d * d;
  const d3 = d2 * d;
  const d4 = d2 * d2;
  const d5 = d4 * d;
  const d6 = d3 * d3;
  const east = 200000 + n * (d + (1 - t + c) * d3 / 6
    + (5 - 18 * t + t * t + 72 * c - 58 * EP2) * d5 / 120);
  const north = 500000 + meridian(phi) - M0 + n * tan * (d2 / 2
    + (5 - t + 9 * c + 4 * c * c) * d4 / 24
    + (61 - 58 * t + t * t + 600 * c - 330 * EP2) * d6 / 720);
  return { x: east * SCALE, y: north * SCALE };
}

/** Inverse of the Korean Central Belt projection; no network or SDK needed. */
export function wcongnamulToWgs84(location) {
  const x = finiteNumber(location.x, 'X 좌표');
  const y = finiteNumber(location.y, 'Y 좌표');
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const m = M0 + y / SCALE - 500000;
  const mu = m / (A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + 151 * e1 ** 3 / 96 * Math.sin(6 * mu)
    + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const sin = Math.sin(phi1);
  const cos = Math.cos(phi1);
  const tan = Math.tan(phi1);
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const r = A * (1 - E2) / (1 - E2 * sin * sin) ** 1.5;
  const t = tan * tan;
  const c = EP2 * cos * cos;
  const d = (x / SCALE - 200000) / n;
  const d2 = d * d;
  const d3 = d2 * d;
  const d4 = d2 * d2;
  const d5 = d4 * d;
  const d6 = d3 * d3;
  let lat = (phi1 - n * tan / r * (d2 / 2
    - (5 + 3 * t + 10 * c - 4 * c * c - 9 * EP2) * d4 / 24
    + (61 + 90 * t + 298 * c + 45 * t * t - 252 * EP2 - 3 * c * c) * d6 / 720)) / DEG;
  let lng = (LON0 + (d - (1 + 2 * t + c) * d3 / 6
    + (5 - 2 * c + 28 * t - 3 * c * c + 8 * EP2 + 24 * t * t) * d5 / 120) / cos) / DEG;

  // Refine against the forward series to keep URL round trips below a millimetre.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const projected = wgs84ToWcongnamul({ lat, lng });
    const dx = x - projected.x;
    const dy = y - projected.y;
    if (Math.abs(dx) + Math.abs(dy) < 1e-7) break;
    const step = 1e-5;
    const north = wgs84ToWcongnamul({ lat: lat + step, lng });
    const east = wgs84ToWcongnamul({ lat, lng: lng + step });
    const a = (north.x - projected.x) / step;
    const b = (east.x - projected.x) / step;
    const c = (north.y - projected.y) / step;
    const d = (east.y - projected.y) / step;
    const determinant = a * d - b * c;
    lat += (dx * d - b * dy) / determinant;
    lng += (a * dy - dx * c) / determinant;
  }
  return coordinate({ lat, lng });
}

function oneValue(params, names) {
  const entries = names.flatMap((name) => params.getAll(name));
  if (entries.length > 1) throw new Error(`${names.join('/')} 인자는 한 번만 입력해 주세요.`);
  return entries.length ? entries[0] : undefined;
}

function panoramaId(value) {
  if (value === undefined || value === null) return null;
  return rangedNumber(value, '로드뷰 ID(panoid)', 1, Number.MAX_SAFE_INTEGER, true);
}

/**
 * Read location.search. `lat` and `lng` (or `lon`) must be supplied together.
 * Missing location parameters use defaults; a new coordinate clears a default panoid.
 * Duplicate parameters/aliases and malformed values throw a user-readable Error.
 */
export function parseLocation(search = '', defaults = {}) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const rawLat = oneValue(params, ['lat']);
  const rawLng = oneValue(params, ['lng', 'lon']);
  const supplied = rawLat !== undefined || rawLng !== undefined;
  if (supplied && (rawLat === undefined || rawLng === undefined)) {
    throw new Error('위도(lat)와 경도(lng 또는 lon)를 함께 입력해 주세요.');
  }
  const position = coordinate({ lat: supplied ? rawLat : defaults.lat, lng: supplied ? rawLng : defaults.lng });
  const rawPan = oneValue(params, ['pan']);
  const rawTilt = oneValue(params, ['tilt']);
  const rawZoom = oneValue(params, ['zoom']);
  const rawPanoid = oneValue(params, ['panoid', 'panoId']);
  const pan = rangedNumber(rawPan ?? defaults.pan ?? 0, '방향(pan)', 0, 360);
  return {
    ...position,
    pan: pan === 360 ? 0 : pan,
    tilt: rangedNumber(rawTilt ?? defaults.tilt ?? 0, '기울기(tilt)', -90, 90),
    zoom: rangedNumber(rawZoom ?? defaults.zoom ?? 0, '확대(zoom)', -3, 3, true),
    panoid: panoramaId(rawPanoid ?? (supplied ? null : defaults.panoid)),
  };
}

const LOCATION_PARAMS = ['lat', 'lng', 'lon', 'pan', 'tilt', 'zoom', 'panoid', 'panoId'];
const compact = (value) => String(Number(value.toFixed(8)));

/** Build a canonical query string suitable for a share link. */
export function buildLocationSearch(location) {
  const validated = parseLocation('', location);
  const params = new URLSearchParams();
  for (const name of ['lat', 'lng', 'pan', 'tilt', 'zoom']) params.set(name, compact(validated[name]));
  if (validated.panoid !== null) params.set('panoid', String(validated.panoid));
  return `?${params}`;
}

/** Update an absolute URL's location arguments, preserving other arguments/hash. */
export function buildLocationUrl(baseUrl, location) {
  const url = new URL(baseUrl);
  for (const name of LOCATION_PARAMS) url.searchParams.delete(name);
  for (const [name, value] of new URLSearchParams(buildLocationSearch(location))) url.searchParams.set(name, value);
  return url.href;
}
