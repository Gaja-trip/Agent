const ORIGIN = "https://njy.mafra.go.kr";
const CADASTRAL_LAYER = "lsmd_cont_ldreg_lx_s_2026_05";
const BASE_RESOLUTION = 1083.735500804335;
let configCache;

function badRequest(message = "잘못된 지도 조회 요청입니다.") {
  return Object.assign(new Error(message), { status: 400 });
}

function numberParam(params, name, min, max, integer = false) {
  const raw = params.get(name);
  const value = raw === null || raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw badRequest();
  return value;
}

async function upstream(path, params = {}, post = false) {
  const url = new URL(path, ORIGIN);
  const body = new URLSearchParams(params);
  if (!post) url.search = body.toString();
  const response = await fetch(url, {
    method: post ? "POST" : "GET",
    headers: post ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
    body: post ? body.toString() : undefined,
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("농지공간포털 응답을 받지 못했습니다.");
  return response;
}

function parseAirCapabilities(xml) {
  const layers = [];
  for (const match of xml.matchAll(/<Layer\b[^>]*>([\s\S]*?)<\/Layer>/g)) {
    const id = match[1].match(/<ows:Identifier>(AIR_\d{2}_[A-Z0-9_]+)<\/ows:Identifier>/)?.[1];
    if (!id) continue;
    const limits = {};
    for (const entry of match[1].matchAll(/<TileMatrixLimits>([\s\S]*?)<\/TileMatrixLimits>/g)) {
      const zoom = entry[1].match(/<TileMatrix>EPSG:5186_[^<]+:(\d+)<\/TileMatrix>/)?.[1];
      if (zoom === undefined) continue;
      const read = (tag) => Number(entry[1].match(new RegExp(`<${tag}>(\\d+)</${tag}>`))?.[1]);
      const range = { minX: read("MinTileCol"), maxX: read("MaxTileCol"), minY: read("MinTileRow"), maxY: read("MaxTileRow") };
      if (Object.values(range).every(Number.isFinite)) limits[zoom] = range;
    }
    if (Object.keys(limits).length) layers.push({ id, limits });
  }
  const year = Math.max(...layers.map(({ id }) => Number(id.slice(4, 6))));
  if (!Number.isFinite(year)) throw new Error("항공영상 목록을 읽지 못했습니다.");
  return { year: 2000 + year, origin: [-5423200, 6394600], baseResolution: BASE_RESOLUTION,
    cadastralLayer: CADASTRAL_LAYER, layers: layers.filter(({ id }) => Number(id.slice(4, 6)) === year) };
}

async function getConfig() {
  if (configCache && Date.now() - configCache.time < 3600000) return configCache.value;
  const value = await upstream("/map/getAirCapability.do").then((r) => r.text()).then(parseAirCapabilities);
  configCache = { time: Date.now(), value };
  return value;
}

const clean = (value) => value == null ? "" : String(value).trim();
const list = (value) => Array.isArray(value) ? value : [];
const regionNames = new Set(["도시지역", "관리지역", "농림지역", "자연환경보전지역", "보전관리지역", "생산관리지역", "계획관리지역", "주거지역", "상업지역", "공업지역", "녹지지역", "전용주거지역", "일반주거지역", "제1종전용주거지역", "제2종전용주거지역", "제1종일반주거지역", "제2종일반주거지역", "제3종일반주거지역", "준주거지역", "중심상업지역", "일반상업지역", "근린상업지역", "유통상업지역", "전용공업지역", "일반공업지역", "준공업지역", "보전녹지지역", "생산녹지지역", "자연녹지지역"]);

function normalizeParcelInfo(data, pnu) {
  if (!data || !Array.isArray(data.tojiList) || !Array.isArray(data.tojiUseList)) throw new Error("필지 속성정보 응답 형식이 올바르지 않습니다.");
  const parcel = data.tojiList[0] || {};
  if (parcel.pnu && clean(parcel.pnu) !== pnu) throw new Error("요청한 필지와 응답 필지가 다릅니다.");
  const seen = new Set();
  const zones = list(data.tojiUseList).flatMap((item) => {
    const name = clean(item.useZone), relation = clean(item.cfltYm);
    if (!name || name === "-" || seen.has(`${name}:${relation}`)) return [];
    seen.add(`${name}:${relation}`);
    const baseName = name.replace(/\s/g, "").split(/[（(]/)[0];
    const kind = regionNames.has(baseName) ? "region" : /지구$/.test(baseName) ? "district" : "other";
    return [{ name, relation, kind }];
  });
  // Expose only the public map's displayed attributes, not hidden ownership or farm records.
  return {
    pnu, source: "농지공간포털", address: clean(parcel.juso),
    parcel: { category: clean(parcel.jimok), area: clean(parcel.area), changeDate: clean(parcel.movYmd), changeReason: clean(parcel.landMovRsn) },
    zones,
    prices: list(data.JigaList).map((row) => ({ year: clean(row.baseYear), price: clean(row.pnilp), date: clean(row.pannYmd) })),
    buildings: list(data.bildList).map((row) => ({ use: clean(row.etcUse), structure: clean(row.etcStru), area: clean(row.barea), totalArea: clean(row.fsiCalcGarea), approvalDate: clean(row.useAprvYmd) })),
  };
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(data));
}

async function sendImage(response, result) {
  const type = result.headers.get("content-type") || "";
  if (!/^image\/(png|jpeg)/i.test(type)) throw new Error("지도 이미지가 제공되지 않았습니다.");
  const bytes = Buffer.from(await result.arrayBuffer());
  response.writeHead(200, { "Content-Type": type, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" });
  response.end(bytes);
}

async function handleFarmlandRequest(request, response, url) {
  if (!url.pathname.startsWith("/api/farmland/")) return false;
  try {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "조회 요청만 지원합니다." });
      return true;
    }
    const params = url.searchParams;
    if (url.pathname === "/api/farmland/config") {
      sendJson(response, 200, await getConfig());
    } else if (url.pathname === "/api/farmland/info") {
      const pnu = params.get("pnu") || "";
      if (!/^\d{19}$/.test(pnu)) throw badRequest("19자리 필지번호가 필요합니다.");
      const data = await upstream("/map/featureInfo.do", { pnu }, true).then((r) => r.json());
      sendJson(response, 200, normalizeParcelInfo(data, pnu));
    } else if (url.pathname === "/api/farmland/parcel") {
      const lat = numberParam(params, "lat", 32, 40), lon = numberParam(params, "lon", 123, 133);
      const data = await upstream("/map/proxy/vworld/getData.do", {
        service: "data", request: "GetFeature", data: "LP_PA_CBND_BUBUN", version: "2.0",
        geomFilter: `POINT(${lon} ${lat})`, geometry: "true", crs: "EPSG:4326", format: "json", size: "1",
      }).then((r) => r.json());
      if (!["OK", "NOT_FOUND"].includes(data?.response?.status)) throw new Error("선택 지점의 필지 조회에 실패했습니다.");
      const features = data?.response?.result?.featureCollection?.features || [];
      sendJson(response, 200, { type: "FeatureCollection", features });
    } else if (url.pathname === "/api/farmland/tile") {
      const id = params.get("layer"), z = numberParam(params, "z", 0, 20, true);
      const x = numberParam(params, "x", 0, 1000000, true), y = numberParam(params, "y", 0, 1000000, true);
      if (!/^AIR_\d{2}_[A-Z0-9_]+$/.test(id || "")) throw badRequest();
      const layer = (await getConfig()).layers.find((entry) => entry.id === id);
      const limits = layer?.limits[z];
      if (!limits || x < limits.minX || x > limits.maxX || y < limits.minY || y > limits.maxY) throw badRequest();
      await sendImage(response, await upstream("/map/proxy/airWmts.do", {
        SERVICE: "WMTS", REQUEST: "GetTile", VERSION: "1.0.0", LAYER: id, STYLE: "", FORMAT: "image/png",
        TILEMATRIXSET: `EPSG:5186_${id}`, TILEMATRIX: `EPSG:5186_${id}:${z}`, TILECOL: String(x), TILEROW: String(y),
      }));
    } else if (url.pathname === "/api/farmland/wms") {
      const fields = new URLSearchParams([...params].map(([key, value]) => [key.toLowerCase(), value]));
      const bbox = (fields.get("bbox") || "").split(",").map(Number);
      if (bbox.length !== 4 || !bbox.every((v) => Number.isFinite(v) && Math.abs(v) < 10000000) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) throw badRequest();
      const width = numberParam(fields, "width", 1, 512, true), height = numberParam(fields, "height", 1, 512, true);
      await sendImage(response, await upstream("/map/proxy/wms.do", {
        SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.1.1", LAYERS: CADASTRAL_LAYER,
        STYLES: "", FORMAT: "image/png", TRANSPARENT: "true", SRS: "EPSG:5186",
        BBOX: bbox.join(","), WIDTH: String(width), HEIGHT: String(height),
      }));
    } else {
      sendJson(response, 404, { error: "지원하지 않는 조회입니다." });
    }
  } catch (error) {
    sendJson(response, error.status || 502, { error: error.status === 400 ? error.message : "농지공간포털 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
  return true;
}

module.exports = { handleFarmlandRequest, parseAirCapabilities, normalizeParcelInfo, numberParam };
