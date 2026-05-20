const portalData = {
  eum: {
    title: "토지이음",
    url: "https://www.eum.go.kr/web/am/amMain.jsp",
    landUseUrl: "https://www.eum.go.kr/web/ar/lu/luLandDet.jsp",
    frameTitle: "토지이음 웹페이지",
  },
  map: {
    title: "토지이음 지도",
    url: "https://www.eum.go.kr/web/mp/mpMapDet.jsp",
    frameTitle: "토지이음 지도 웹페이지",
  },
  aerial: {
    title: "항공사진",
    url: "https://map.vworld.kr/map/dtkmap.do",
    frameTitle: "브이월드 지도 페이지",
  },
  law: {
    title: "법령정보",
    url: "https://www.law.go.kr/main.html",
    frameTitle: "국가법령정보센터 웹페이지",
  },
};

const parcelStorageKey = "landInfoPortal.parcelAddress";
const parcelStateStorageKey = "landInfoPortal.parcelState";
const vworldApiKey = "39B6F1DE-2D35-3582-9008-A537EF6A6BC4";
const vworldParcelDataId = "LP_PA_CBND_BUBUN";
const vworldParcelRadiusMeters = 50;
const defaultAerialCenter = [37.5665, 126.978];
let vworldMap = null;
let vworldMarker = null;
let vworldBaseLayer = null;
let vworldHybridLayer = null;
let vworldParcelLayer = null;
let vworldRadiusLayer = null;
let vworldCurrentLayer = "satellite";
let vworldCurrentPoint = null;
let vworldMarkerVisible = true;
let vworldMeasureMode = "";
let vworldMeasurePoints = [];
let vworldMeasureLayer = null;

const processSteps = {
  consult: {
    number: "01",
    owner: "관할 허가부서",
    title: "허가부서와 사전 상담",
    summary:
      "토지의 이용 목적, 분할 또는 형질변경 필요성, 개발행위허가 대상 여부를 관할 부서와 먼저 확인합니다.",
    checks: [
      "토지이음에서 확인한 용도지역·지구와 행위제한",
      "토지이음 지도에서 본 진입로와 주변 이용 상태",
      "목적에 따라 필요한 허가 종류와 담당 부서",
      "보완 가능성이 높은 서류와 선행 조건",
    ],
    outputs: ["상담일과 담당 부서 기록", "허가 가능성에 대한 1차 의견", "측량 또는 설계 검토 필요 범위", "다음 단계 진행 여부 판단"],
    notice:
      "상담 의견은 지자체와 담당 부서에 따라 달라질 수 있으므로 상담일, 담당 부서, 보완 요청사항을 기록해 둡니다.",
  },
  survey: {
    number: "02",
    owner: "지적측량 수행기관",
    title: "지적측량 신청 및 현장측량",
    summary: "분할, 경계 확인, 현황 정리가 필요하면 지적측량을 신청하고 현장에서 경계와 면적을 확인합니다.",
    checks: [
      "측량 목적: 분할, 경계복원, 지적현황 등",
      "소유자 또는 대리인의 신청 자격과 위임 관계",
      "현장 출입 가능 여부와 인접 토지 이해관계",
      "측량 결과가 허가 도면과 일치하는지 여부",
    ],
    outputs: ["측량 신청 접수 내역", "현장측량 일정과 입회 기록", "측량성과도 또는 관련 성과 자료", "허가 신청에 반영할 면적·경계 정보"],
    notice: "현장 상황과 공부상 경계가 다를 수 있으므로 측량 결과를 받은 뒤 허가 도면과 신청 내용을 다시 맞추는 과정이 필요합니다.",
  },
  permit: {
    number: "03",
    owner: "개발행위·인허가 담당 부서",
    title: "토지허가 진행",
    summary: "상담과 측량 결과를 바탕으로 허가 신청서를 제출하고, 관계 부서 협의와 보완을 거쳐 허가 여부를 확정합니다.",
    checks: [
      "신청 목적에 맞는 허가 신청서와 도면",
      "관련 법령, 조례, 도시계획 기준 충족 여부",
      "배수, 도로, 경사, 재해 등 관계 부서 협의 사항",
      "보완 요청이 있을 때 제출 기한과 보완 범위",
    ],
    outputs: ["허가 신청 접수증", "관계 부서 협의와 보완 처리 기록", "허가 조건 또는 불허 사유", "허가 완료 통지 또는 허가증"],
    notice: "허가 조건은 이후 토지이동신청과 등기 단계의 기준이 되므로 조건, 면적, 도면 번호를 정확히 보관해야 합니다.",
  },
  movement: {
    number: "04",
    owner: "지적민원·토지정보 담당 부서",
    title: "허가 완료 후 토지이동신청",
    summary: "허가 내용이 확정되면 분할, 합병, 지목변경 등 공부 정리를 위한 토지이동신청을 진행합니다.",
    checks: ["허가 내용과 측량성과의 일치 여부", "토지이동 종류: 분할, 합병, 지목변경, 등록전환 등", "신청인 자격과 첨부 서류", "지적공부 정리 후 면적과 지번 변동 내용"],
    outputs: ["토지이동신청서", "허가서와 측량성과 자료", "지적공부 정리 결과", "새 지번 또는 변경 지목 확인 자료"],
    notice: "허가만으로 공부가 자동 정리되는 것은 아니므로 허가 완료 후 토지이동신청까지 이어서 진행해야 합니다.",
  },
  registry: {
    number: "05",
    owner: "관할 행정기관·등기소",
    title: "등기촉탁 및 마무리 확인",
    summary: "지적공부가 정리되면 행정기관의 등기촉탁을 통해 등기부 내용이 변경되고 최종 정리 상태를 확인합니다.",
    checks: ["지적공부 정리 완료 여부", "등기촉탁 대상과 촉탁 처리 방식", "등기부의 지번, 면적, 지목 변경 반영 여부", "세금, 부담금, 후속 민원 가능성"],
    outputs: ["등기촉탁 접수 또는 처리 내역", "변경된 등기사항증명서", "최종 상담 기록과 완료 보고", "후속 활용 또는 처분 계획"],
    notice: "등기부 반영까지 완료되어야 토지 정리 절차가 사실상 마무리됩니다. 완료 후 공부와 등기부를 함께 대조합니다.",
  },
};

const readyMessages = [
  {
    title: "안내자료 확인 전",
    copy: "지번과 목적이 먼저 정리되면 토지이음, 토지이음 지도, 법령 검토를 빠르게 연결할 수 있습니다.",
  },
  {
    title: "기초 상담 가능",
    copy: "핵심 정보가 일부 준비되었습니다. 지번과 목적을 중심으로 1차 검토를 시작할 수 있습니다.",
  },
  {
    title: "상담 준비 양호",
    copy: "토지 현황과 목적이 어느 정도 정리되어 허가부서 상담 포인트를 구체화할 수 있습니다.",
  },
  {
    title: "절차 안내 준비 완료",
    copy: "상담 자료가 충분합니다. 허가 상담, 측량 신청, 토지이동까지 순서대로 설명하기 좋습니다.",
  },
];

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function readStoredValue(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (error) {
    return "";
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Storage can be unavailable in strict browser modes. The live UI still works.
  }
}

function readStoredJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}");
  } catch (error) {
    return {};
  }
}

function writeStoredJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage can be unavailable in strict browser modes. The live UI still works.
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function initPortalTabs() {
  const portalTabs = document.querySelectorAll(".portal-tab");
  const portalPanel = document.querySelector("[data-portal-panel]");
  const parcelForm = document.querySelector("[data-parcel-form]");
  const parcelInput = document.querySelector("[data-parcel-input]");
  let activePortalKey = "eum";

  if (!portalTabs.length || !portalPanel) {
    return;
  }

  function getParcelAddress() {
    return (parcelInput ? parcelInput.value : readStoredValue(parcelStorageKey)).trim();
  }

  function saveParcelAddress(nextAddress = getParcelAddress()) {
    const address = String(nextAddress || "").trim();
    const savedState = readStoredJson(parcelStateStorageKey);

    if (parcelInput && parcelInput.value !== address) {
      parcelInput.value = address;
    }

    writeStoredValue(parcelStorageKey, address);

    if (savedState.query !== address) {
      writeStoredJson(parcelStateStorageKey, { query: address });
    }
  }

  function getParcelState() {
    const address = getParcelAddress();
    const savedState = readStoredJson(parcelStateStorageKey);

    if (savedState.query === address) {
      return savedState;
    }

    return { query: address };
  }

  function getMapUrl() {
    const state = getParcelState();

    if (state.pnu) {
      const url = new URL(portalData.map.url);
      url.searchParams.set("pnu", state.pnu);
      url.searchParams.set("sId", "selectaddr");
      return url.toString();
    }

    return portalData.map.url;
  }

  function getEumUrl() {
    const state = getParcelState();

    if (state.pnu) {
      const url = new URL(portalData.eum.landUseUrl);
      url.searchParams.set("pnu", state.pnu);
      url.searchParams.set("isNoScr", "script");
      url.searchParams.set("mode", "search");
      url.searchParams.set("selGbn", "umd");
      url.searchParams.set("s_type", "1");
      url.searchParams.set("add", "land");
      return url.toString();
    }

    return portalData.eum.url;
  }

  function renderSharedParcel() {
    const parcelAddress = escapeHtml(getParcelAddress());
    const displayText = parcelAddress || "아직 입력 전";

    return `
      <div class="portal-context">
        <span>토지이음 검색 주소</span>
        <strong data-shared-parcel>${displayText}</strong>
      </div>
    `;
  }

  function syncSharedParcelText() {
    const displayText = getParcelAddress() || "아직 입력 전";
    document.querySelectorAll("[data-shared-parcel]").forEach((target) => {
      target.textContent = displayText;
    });
  }

  function renderEmbeddedPortal(portal) {
    const iframeUrl = portal === portalData.map ? getMapUrl() : portal === portalData.eum ? getEumUrl() : portal.url;

    return `
      <div class="embedded-site">
        <iframe
          class="embedded-site__frame"
          title="${portal.frameTitle}"
          src="${iframeUrl}"
          loading="eager"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    `;
  }

  function renderAerialPortal() {
    const parcelAddress = escapeHtml(getParcelAddress());

    return `
      <div class="aerial-portal">
        <aside class="aerial-portal__panel">
          <form class="aerial-search" data-aerial-parcel-form>
            <label for="aerial-parcel-address">주소 검색</label>
            <input
              id="aerial-parcel-address"
              type="search"
              name="aerialParcel"
              data-aerial-parcel-input
              value="${parcelAddress}"
              placeholder="지번 또는 도로명"
              autocomplete="street-address"
            />
            <button class="button button--primary" type="submit">
              <i data-lucide="search"></i>
              이동
            </button>
          </form>
          <div class="vworld-tools" aria-label="V-World 지도 기능">
            <div class="vworld-tool-group">
              <strong>지도</strong>
              <div class="vworld-segment" role="group" aria-label="배경지도 선택">
                <button type="button" class="is-active" data-vworld-layer="satellite">항공</button>
                <button type="button" data-vworld-layer="base">일반</button>
                <button type="button" data-vworld-layer="hybrid">라벨</button>
              </div>
            </div>
            <div class="vworld-tool-group">
              <strong>도구</strong>
              <button type="button" data-vworld-action="center">
                <i data-lucide="crosshair"></i>
                주소 이동
              </button>
              <button type="button" data-vworld-action="toggle-marker">
                <i data-lucide="map-pin"></i>
                마커
              </button>
              <button type="button" data-vworld-action="parcels">
                <i data-lucide="shapes"></i>
                연속지적도
              </button>
              <button type="button" data-vworld-action="distance">
                <i data-lucide="ruler"></i>
                거리재기
              </button>
              <button type="button" data-vworld-action="area">
                <i data-lucide="pentagon"></i>
                면적재기
              </button>
              <button type="button" data-vworld-action="clear">
                <i data-lucide="eraser"></i>
                초기화
              </button>
            </div>
            <output class="vworld-measure" data-vworld-measure>지도 도구를 선택하세요.</output>
          </div>
        </aside>
        <div class="vworld-map-shell">
          <div class="vworld-map" id="vworld-map" aria-label="V-World 항공사진 지도"></div>
          <div class="vworld-map__empty" data-vworld-empty>
            <i data-lucide="satellite"></i>
            <strong>${parcelAddress || "주소를 입력하세요"}</strong>
            <span>토지이음에서 마지막으로 저장한 주소 기준으로 항공사진 위치를 표시합니다.</span>
          </div>
          <p class="aerial-status" data-aerial-status>항공사진을 준비 중입니다.</p>
        </div>
      </div>
    `;
  }

  function requestVworldJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `vworldCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const jsonpUrl = new URL(url.toString());

      jsonpUrl.searchParams.set("callback", callbackName);

      window[callbackName] = (data) => {
        script.remove();
        delete window[callbackName];
        resolve(data);
      };

      script.onerror = () => {
        script.remove();
        delete window[callbackName];
        reject(new Error("V-World address search failed"));
      };

      script.src = jsonpUrl.toString();
      document.head.appendChild(script);
    });
  }

  async function requestVworldJson(url) {
    try {
      const response = await fetch(url.toString());

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // Fall back to JSONP below for static pages and browsers that block CORS.
    }

    return requestVworldJsonp(url);
  }

  async function searchVworldAddress(query, apiKey) {
    const categories = ["parcel", "road"];

    for (const category of categories) {
      const url = new URL("https://api.vworld.kr/req/search");
      url.searchParams.set("service", "search");
      url.searchParams.set("request", "search");
      url.searchParams.set("version", "2.0");
      url.searchParams.set("crs", "EPSG:4326");
      url.searchParams.set("size", "1");
      url.searchParams.set("page", "1");
      url.searchParams.set("type", "address");
      url.searchParams.set("category", category);
      url.searchParams.set("format", "json");
      url.searchParams.set("errorformat", "json");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("query", query);

      let data;

      try {
        data = await requestVworldJson(url);
      } catch (error) {
        continue;
      }

      const item = data.response?.result?.items?.[0];
      const longitude = Number(item?.point?.x);
      const latitude = Number(item?.point?.y);
      const pnu = String(item?.id || "").match(/^\d{19}$/) ? String(item.id) : "";

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return {
          latitude,
          longitude,
          pnu,
          title: item.title || item.address?.parcel || item.address?.road || query,
        };
      }
    }

    return null;
  }

  function getRadiusBbox(latitude, longitude, radiusMeters) {
    const latitudeDelta = radiusMeters / 111320;
    const longitudeDelta = radiusMeters / (111320 * Math.cos((latitude * Math.PI) / 180));

    return [longitude - longitudeDelta, latitude - latitudeDelta, longitude + longitudeDelta, latitude + latitudeDelta];
  }

  const epsg5186 = {
    semiMajor: 6378137,
    inverseFlattening: 298.257222101,
    originLatitude: (38 * Math.PI) / 180,
    centralMeridian: (127 * Math.PI) / 180,
    scale: 1,
    falseEasting: 200000,
    falseNorthing: 600000,
  };

  epsg5186.flattening = 1 / epsg5186.inverseFlattening;
  epsg5186.eccentricitySquared = 2 * epsg5186.flattening - epsg5186.flattening ** 2;
  epsg5186.secondEccentricitySquared = epsg5186.eccentricitySquared / (1 - epsg5186.eccentricitySquared);

  function getMeridionalArc(latitudeRadians) {
    const { semiMajor, eccentricitySquared } = epsg5186;
    const e4 = eccentricitySquared ** 2;
    const e6 = eccentricitySquared ** 3;

    return (
      semiMajor *
      ((1 - eccentricitySquared / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latitudeRadians -
        ((3 * eccentricitySquared) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latitudeRadians) +
        ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latitudeRadians) -
        ((35 * e6) / 3072) * Math.sin(6 * latitudeRadians))
    );
  }

  function wgs84ToEpsg5186(latitude, longitude) {
    const { semiMajor, eccentricitySquared, secondEccentricitySquared, originLatitude, centralMeridian, scale, falseEasting, falseNorthing } = epsg5186;
    const latitudeRadians = (latitude * Math.PI) / 180;
    const longitudeRadians = (longitude * Math.PI) / 180;
    const sinLatitude = Math.sin(latitudeRadians);
    const cosLatitude = Math.cos(latitudeRadians);
    const tangentLatitude = Math.tan(latitudeRadians);
    const n = semiMajor / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
    const t = tangentLatitude ** 2;
    const c = secondEccentricitySquared * cosLatitude ** 2;
    const a = (longitudeRadians - centralMeridian) * cosLatitude;
    const m = getMeridionalArc(latitudeRadians);
    const m0 = getMeridionalArc(originLatitude);

    return {
      x:
        falseEasting +
        scale *
          n *
          (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * secondEccentricitySquared) * a ** 5) / 120),
      y:
        falseNorthing +
        scale *
          (m -
            m0 +
            n *
              tangentLatitude *
              (a ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * a ** 4) / 24 + ((61 - 58 * t + t ** 2 + 600 * c - 330 * secondEccentricitySquared) * a ** 6) / 720)),
    };
  }

  function epsg5186ToWgs84(x, y) {
    const { semiMajor, eccentricitySquared, secondEccentricitySquared, originLatitude, centralMeridian, scale, falseEasting, falseNorthing } = epsg5186;
    const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));
    const e4 = eccentricitySquared ** 2;
    const e6 = eccentricitySquared ** 3;
    const m0 = getMeridionalArc(originLatitude);
    const m = m0 + (y - falseNorthing) / scale;
    const mu = m / (semiMajor * (1 - eccentricitySquared / 4 - (3 * e4) / 64 - (5 * e6) / 256));
    const footprintLatitude =
      mu +
      ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
      ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
      ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
      ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
    const sinFootprint = Math.sin(footprintLatitude);
    const cosFootprint = Math.cos(footprintLatitude);
    const tanFootprint = Math.tan(footprintLatitude);
    const c1 = secondEccentricitySquared * cosFootprint ** 2;
    const t1 = tanFootprint ** 2;
    const n1 = semiMajor / Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2);
    const r1 = (semiMajor * (1 - eccentricitySquared)) / (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5;
    const d = (x - falseEasting) / (n1 * scale);
    const latitude =
      footprintLatitude -
      ((n1 * tanFootprint) / r1) *
        (d ** 2 / 2 -
          ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * secondEccentricitySquared) * d ** 4) / 24 +
          ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * secondEccentricitySquared - 3 * c1 ** 2) * d ** 6) / 720);
    const longitude =
      centralMeridian +
      (d -
        ((1 + 2 * t1 + c1) * d ** 3) / 6 +
        ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * secondEccentricitySquared + 24 * t1 ** 2) * d ** 5) / 120) /
        cosFootprint;

    return {
      latitude: (latitude * 180) / Math.PI,
      longitude: (longitude * 180) / Math.PI,
    };
  }

  function bboxIntersects(first, second) {
    return first.minX <= second.maxX && first.maxX >= second.minX && first.minY <= second.maxY && first.maxY >= second.minY;
  }

  function getDistanceSquaredToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
      return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
    }

    const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx ** 2 + dy ** 2)));
    const projectedX = start.x + ratio * dx;
    const projectedY = start.y + ratio * dy;

    return (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;
  }

  function isProjectedPointInRing(point, ring = []) {
    let inside = false;

    if (ring.length < 3) {
      return false;
    }

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const start = ring[i];
      const end = ring[j];

      if ((start.y > point.y) !== (end.y > point.y)) {
        const crossingX = ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;

        if (point.x < crossingX) {
          inside = !inside;
        }
      }
    }

    return inside;
  }

  function doesRingIntersectRadius(ring, center, radiusMeters) {
    const radiusSquared = radiusMeters ** 2;

    if (isProjectedPointInRing(center, ring)) {
      return true;
    }

    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];

      if ((center.x - current.x) ** 2 + (center.y - current.y) ** 2 <= radiusSquared) {
        return true;
      }

      if (getDistanceSquaredToSegment(center, current, next) <= radiusSquared) {
        return true;
      }
    }

    return false;
  }

  function parseLocalCadastralShp(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const fileCode = view.getInt32(0, false);
    const shapeType = view.getInt32(32, true);

    if (fileCode !== 9994 || (shapeType !== 5 && shapeType !== 15)) {
      throw new Error("Unsupported cadastral geometry file");
    }

    const records = [];
    let offset = 100;

    while (offset + 12 <= view.byteLength) {
      const contentLengthBytes = view.getInt32(offset + 4, false) * 2;
      const contentOffset = offset + 8;
      const contentEnd = contentOffset + contentLengthBytes;

      if (contentEnd > view.byteLength || contentLengthBytes < 44) {
        break;
      }

      const recordShapeType = view.getInt32(contentOffset, true);

      if (recordShapeType === 5 || recordShapeType === 15) {
        records.push({
          contentOffset,
          contentLengthBytes,
          bbox: {
            minX: view.getFloat64(contentOffset + 4, true),
            minY: view.getFloat64(contentOffset + 12, true),
            maxX: view.getFloat64(contentOffset + 20, true),
            maxY: view.getFloat64(contentOffset + 28, true),
          },
        });
      }

      offset = contentEnd;
    }

    return { view, records };
  }

  async function getLocalCadastralDataset() {
    return { view: null, records: [] };
  }

  function parseLocalCadastralFeature(view, record, center, radiusMeters) {
    const contentOffset = record.contentOffset;
    const numberOfParts = view.getInt32(contentOffset + 36, true);
    const numberOfPoints = view.getInt32(contentOffset + 40, true);
    const partsOffset = contentOffset + 44;
    const pointsOffset = partsOffset + numberOfParts * 4;
    const expectedPointsEnd = pointsOffset + numberOfPoints * 16;

    if (numberOfParts <= 0 || numberOfPoints <= 0 || expectedPointsEnd > contentOffset + record.contentLengthBytes) {
      return null;
    }

    const partStarts = [];

    for (let index = 0; index < numberOfParts; index += 1) {
      partStarts.push(view.getInt32(partsOffset + index * 4, true));
    }

    const rings = [];
    let intersectsRadius = false;

    for (let partIndex = 0; partIndex < numberOfParts; partIndex += 1) {
      const start = partStarts[partIndex];
      const end = partStarts[partIndex + 1] ?? numberOfPoints;
      const ring = [];

      for (let pointIndex = start; pointIndex < end; pointIndex += 1) {
        const pointOffset = pointsOffset + pointIndex * 16;
        ring.push({
          x: view.getFloat64(pointOffset, true),
          y: view.getFloat64(pointOffset + 8, true),
        });
      }

      if (ring.length >= 4) {
        intersectsRadius = intersectsRadius || doesRingIntersectRadius(ring, center, radiusMeters);
        rings.push(ring);
      }
    }

    if (!intersectsRadius || !rings.length) {
      return null;
    }

    const coordinates = rings.map((ring) => [
      ring.map((point) => {
        const converted = epsg5186ToWgs84(point.x, point.y);
        return [converted.longitude, converted.latitude];
      }),
    ]);

    return {
      type: "Feature",
      properties: {
        source: "local-cadastral",
        title: "연속지적도",
      },
      geometry:
        coordinates.length === 1
          ? {
              type: "Polygon",
              coordinates: coordinates[0],
            }
          : {
              type: "MultiPolygon",
              coordinates,
            },
    };
  }

  async function searchLocalCadastralFeatures() {
    return [];
  }

  function createVworldParcelDataUrl() {
    const url = new URL("https://api.vworld.kr/req/data");

    url.searchParams.set("service", "data");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("version", "2.0");
    url.searchParams.set("data", vworldParcelDataId);
    url.searchParams.set("format", "json");
    url.searchParams.set("errorformat", "json");
    url.searchParams.set("crs", "EPSG:4326");
    url.searchParams.set("key", vworldApiKey);
    url.searchParams.set("domain", window.location.origin);

    return url;
  }

  function extractVworldFeatures(data) {
    if (data?.response?.status === "ERROR") {
      throw new Error(data.response?.error?.text || "V-World data API error");
    }

    return data?.response?.result?.featureCollection?.features || data?.response?.result?.features || data?.features || [];
  }

  async function searchVworldParcels(latitude, longitude, radiusMeters = vworldParcelRadiusMeters) {
    const bbox = getRadiusBbox(latitude, longitude, radiusMeters);
    const url = createVworldParcelDataUrl();

    url.searchParams.set("geomFilter", `BOX(${bbox.join(",")})`);
    url.searchParams.set("size", "200");
    url.searchParams.set("page", "1");

    const data = await requestVworldJson(url);
    return extractVworldFeatures(data);
  }

  async function searchVworldParcelByPnu(pnu) {
    const selectedPnu = normalizePnu(pnu);

    if (!selectedPnu) {
      return [];
    }

    const url = createVworldParcelDataUrl();

    url.searchParams.set("attrFilter", `pnu:=:${selectedPnu}`);
    url.searchParams.set("size", "20");
    url.searchParams.set("page", "1");

    const data = await requestVworldJson(url);
    return extractVworldFeatures(data);
  }

  async function resolveParcelAddress() {
    const address = getParcelAddress();

    if (!address) {
      writeStoredJson(parcelStateStorageKey, { query: "" });
      return null;
    }

    const state = getParcelState();

    if (state.query === address && Number.isFinite(state.latitude) && Number.isFinite(state.longitude)) {
      return state;
    }

    const point = await searchVworldAddress(address, vworldApiKey);

    if (!point) {
      writeStoredJson(parcelStateStorageKey, { query: address });
      return null;
    }

    const nextState = {
      query: address,
      ...point,
    };

    writeStoredJson(parcelStateStorageKey, nextState);
    return nextState;
  }

  function bindAerialSearchForm() {
    const aerialForm = document.querySelector("[data-aerial-parcel-form]");
    const aerialInput = document.querySelector("[data-aerial-parcel-input]");

    if (!aerialForm || !aerialInput) {
      return;
    }

    aerialInput.addEventListener("input", () => {
      if (parcelInput) {
        parcelInput.value = aerialInput.value;
      }

      saveParcelAddress(aerialInput.value);
    });

    aerialForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const address = aerialInput.value.trim();

      if (parcelInput) {
        parcelInput.value = address;
      }

      saveParcelAddress(address);
      await resolveParcelAddress();
      setActivePortal("aerial");
    });
  }

  function createVworldLayer(layerName) {
    const extension = layerName === "Satellite" ? "jpeg" : "png";

    return window.L.tileLayer(
      `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(vworldApiKey)}/${layerName}/{z}/{y}/{x}.${extension}`,
      {
        maxZoom: 19,
        attribution: "V-World",
      }
    );
  }

  function setVworldLayer(layerKey) {
    if (!vworldMap || !window.L) {
      return;
    }

    if (vworldBaseLayer) {
      vworldMap.removeLayer(vworldBaseLayer);
    }

    if (vworldHybridLayer) {
      vworldMap.removeLayer(vworldHybridLayer);
      vworldHybridLayer = null;
    }

    vworldCurrentLayer = layerKey;
    vworldBaseLayer = createVworldLayer(layerKey === "base" ? "Base" : "Satellite").addTo(vworldMap);

    if (layerKey === "hybrid") {
      vworldHybridLayer = createVworldLayer("Hybrid").addTo(vworldMap);
    }

    document.querySelectorAll("[data-vworld-layer]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.vworldLayer === layerKey);
    });
  }

  function updateAerialStatus(message) {
    const status = document.querySelector("[data-aerial-status]");

    if (status) {
      status.textContent = message;
    }
  }

  function updateMeasureOutput(message) {
    const output = document.querySelector("[data-vworld-measure]");

    if (output) {
      output.textContent = message;
    }
  }

  function centerVworldOnParcel() {
    if (!vworldMap || !vworldCurrentPoint) {
      updateAerialStatus("먼저 주소를 검색해 위치를 확인해 주세요.");
      return;
    }

    vworldMap.setView([vworldCurrentPoint.latitude, vworldCurrentPoint.longitude], 18);
    updateAerialStatus(`${vworldCurrentPoint.title} 위치로 이동했습니다.`);
  }

  function syncVworldMarker() {
    if (!vworldMap || !window.L || !vworldCurrentPoint) {
      return;
    }

    if (vworldMarker) {
      vworldMap.removeLayer(vworldMarker);
      vworldMarker = null;
    }

    if (!vworldMarkerVisible) {
      return;
    }

    vworldMarker = window.L.marker([vworldCurrentPoint.latitude, vworldCurrentPoint.longitude]).addTo(vworldMap).bindPopup(vworldCurrentPoint.title);
  }

  function clearVworldParcels() {
    if (vworldParcelLayer && vworldMap) {
      vworldMap.removeLayer(vworldParcelLayer);
    }

    if (vworldRadiusLayer && vworldMap) {
      vworldMap.removeLayer(vworldRadiusLayer);
    }

    vworldParcelLayer = null;
    vworldRadiusLayer = null;
  }

  function getFeatureProperty(properties = {}, names = []) {
    for (const name of names) {
      if (properties[name] !== undefined && properties[name] !== null && properties[name] !== "") {
        return properties[name];
      }
    }

    const entries = Object.entries(properties);

    for (const name of names) {
      const match = entries.find(([key, value]) => key.toLowerCase() === name.toLowerCase() && value !== undefined && value !== null && value !== "");

      if (match) {
        return match[1];
      }
    }

    return "";
  }

  function getFeaturePnu(feature) {
    return normalizePnu(getFeatureProperty(feature?.properties, ["pnu", "PNU"]));
  }

  function getParcelPopup(properties = {}) {
    const lines = [
      properties.jibun ? `지번: ${properties.jibun}` : "",
      properties.pnu ? `PNU: ${properties.pnu}` : "",
      properties.jimok ? `지목: ${properties.jimok}` : "",
      properties.sido_nm || properties.sgg_nm || properties.emd_nm
        ? `위치: ${[properties.sido_nm, properties.sgg_nm, properties.emd_nm, properties.ri_nm].filter(Boolean).join(" ")}`
        : "",
    ].filter(Boolean);

    return lines.length ? lines.join("<br>") : "필지 도형";
  }

  function normalizePnu(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function isPointInRing(point, ring = []) {
    const longitude = Number(point?.longitude);
    const latitude = Number(point?.latitude);
    let inside = false;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || ring.length < 3) {
      return false;
    }

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const start = ring[i];
      const end = ring[j];
      const startLng = Number(start?.[0]);
      const startLat = Number(start?.[1]);
      const endLng = Number(end?.[0]);
      const endLat = Number(end?.[1]);

      if (![startLng, startLat, endLng, endLat].every(Number.isFinite)) {
        continue;
      }

      if ((startLat > latitude) !== (endLat > latitude)) {
        const crossingLongitude = ((endLng - startLng) * (latitude - startLat)) / (endLat - startLat) + startLng;

        if (longitude < crossingLongitude) {
          inside = !inside;
        }
      }
    }

    return inside;
  }

  function isPointInPolygonCoordinates(point, coordinates = []) {
    const [outerRing, ...holes] = coordinates;

    return Boolean(outerRing?.length && isPointInRing(point, outerRing) && !holes.some((ring) => isPointInRing(point, ring)));
  }

  function isPointInParcelFeature(point, feature) {
    const geometry = feature?.geometry;

    if (geometry?.type === "Polygon") {
      return isPointInPolygonCoordinates(point, geometry.coordinates);
    }

    if (geometry?.type === "MultiPolygon") {
      return geometry.coordinates?.some((polygon) => isPointInPolygonCoordinates(point, polygon));
    }

    return false;
  }

  function getSelectedParcelFeatures(features, point) {
    const selectedPnu = normalizePnu(point?.pnu);
    const pnuMatches = selectedPnu ? features.filter((feature) => getFeaturePnu(feature) === selectedPnu) : [];

    if (pnuMatches.length) {
      return pnuMatches;
    }

    return features.filter((feature) => isPointInParcelFeature(point, feature));
  }

  function renderVworldParcelLayer(features, point, options = {}) {
    const selectedPnu = normalizePnu(point?.pnu);
    const highlightAll = Boolean(options.highlightAll);

    if (vworldParcelLayer && vworldMap) {
      vworldMap.removeLayer(vworldParcelLayer);
      vworldParcelLayer = null;
    }

    vworldParcelLayer = window.L.geoJSON(
      {
        type: "FeatureCollection",
        features,
      },
      {
        style(feature) {
          const featurePnu = getFeaturePnu(feature);
          const isSelected = highlightAll || (featurePnu && selectedPnu && featurePnu === selectedPnu) || isPointInParcelFeature(point, feature);

          return {
            color: isSelected ? "#f2c76b" : "#67e8f9",
            fillColor: isSelected ? "#f2c76b" : "#0f7f84",
            fillOpacity: isSelected ? 0.34 : 0.16,
            opacity: 0.95,
            weight: isSelected ? 4 : 2,
          };
        },
        onEachFeature(feature, layer) {
          layer.bindPopup(getParcelPopup(feature.properties));

          const jibun = getFeatureProperty(feature.properties, ["jibun", "JIBUN", "addr", "ADDR"]);

          if (jibun) {
            layer.bindTooltip(jibun, {
              direction: "center",
              permanent: true,
              className: "parcel-label",
            });
          }
        },
      }
    ).addTo(vworldMap);

    if (options.fitBounds) {
      const bounds = vworldParcelLayer.getBounds();

      if (bounds.isValid()) {
        vworldMap.fitBounds(bounds.pad(0.28), { maxZoom: 19 });
      }
    }
  }

  async function loadSelectedParcelShape(point) {
    if (!vworldMap || !window.L || !point) {
      return;
    }

    clearVworldParcels();

    try {
      let selectedFeatures = [];

      if (normalizePnu(point.pnu)) {
        try {
          const pnuFeatures = await searchVworldParcelByPnu(point.pnu);
          selectedFeatures = getSelectedParcelFeatures(pnuFeatures, point);
        } catch (error) {
          selectedFeatures = [];
        }
      }

      if (!selectedFeatures.length) {
        const nearbyFeatures = await searchVworldParcels(point.latitude, point.longitude, 80);
        selectedFeatures = getSelectedParcelFeatures(nearbyFeatures, point);
      }

      if (!selectedFeatures.length) {
        updateAerialStatus(`${point.title} 번지의 필지 도형을 찾지 못했습니다. 50m도형으로 주변 필지를 확인해 주세요.`);
        return;
      }

      renderVworldParcelLayer(selectedFeatures, point, { fitBounds: true, highlightAll: true });
      updateAerialStatus(`${point.title} 번지 도형을 항공사진 위에 중첩했습니다.`);
    } catch (error) {
      updateAerialStatus("해당 번지 필지 도형을 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.");
    }
  }

  async function loadNearbyParcelShapes(point) {
    if (!vworldMap || !window.L || !point) {
      return;
    }

    clearVworldParcels();

    const center = [point.latitude, point.longitude];

    vworldRadiusLayer = window.L.circle(center, {
      radius: vworldParcelRadiusMeters,
      color: "#f2c76b",
      fillColor: "#f2c76b",
      fillOpacity: 0.08,
      weight: 2,
      dashArray: "6 6",
    }).addTo(vworldMap);

    try {
      updateAerialStatus(`${point.title} 기준 ${vworldParcelRadiusMeters}m 이내 연속지적도를 불러오는 중입니다.`);
      const features = await searchVworldParcels(point.latitude, point.longitude, vworldParcelRadiusMeters);

      if (!features.length) {
        updateAerialStatus(`${point.title} 기준 ${vworldParcelRadiusMeters}m 이내 연속지적도 도형을 찾지 못했습니다.`);
        return;
      }

      renderVworldParcelLayer(features, point, { highlightAll: true });

      updateAerialStatus(`${point.title} 기준 ${vworldParcelRadiusMeters}m 이내 연속지적도 ${features.length}개를 표시했습니다.`);
    } catch (error) {
      updateAerialStatus("V-World 연속지적도 API를 불러오지 못했습니다. API 키 또는 도메인 설정을 확인해 주세요.");
    }
  }

  function formatDistance(meters) {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }

    return `${Math.round(meters)} m`;
  }

  function formatArea(squareMeters) {
    if (squareMeters >= 1000000) {
      return `${(squareMeters / 1000000).toFixed(2)} km²`;
    }

    return `${Math.round(squareMeters).toLocaleString()} m²`;
  }

  function calculatePolygonArea(points) {
    if (points.length < 3) {
      return 0;
    }

    const earthRadius = 6378137;
    const meanLatitude = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const latitudeScale = Math.cos((meanLatitude * Math.PI) / 180);
    const projected = points.map((point) => ({
      x: earthRadius * (point.lng * Math.PI / 180) * latitudeScale,
      y: earthRadius * (point.lat * Math.PI / 180),
    }));

    const area = projected.reduce((sum, point, index) => {
      const next = projected[(index + 1) % projected.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);

    return Math.abs(area / 2);
  }

  function clearVworldMeasure() {
    vworldMeasurePoints = [];
    vworldMeasureMode = "";

    if (vworldMeasureLayer && vworldMap) {
      vworldMap.removeLayer(vworldMeasureLayer);
    }

    vworldMeasureLayer = null;
    updateMeasureOutput("지도 도구를 선택하세요.");
  }

  function renderVworldMeasure() {
    if (!vworldMap || !window.L) {
      return;
    }

    if (vworldMeasureLayer) {
      vworldMap.removeLayer(vworldMeasureLayer);
    }

    const layers = vworldMeasurePoints.map((point) =>
      window.L.circleMarker(point, {
        radius: 5,
        color: "#f2c76b",
        fillColor: "#114636",
        fillOpacity: 1,
        weight: 2,
      })
    );

    if (vworldMeasurePoints.length >= 2) {
      const shapeOptions = {
        color: "#f2c76b",
        fillColor: "#1f6b55",
        fillOpacity: 0.24,
        weight: 3,
      };

      if (vworldMeasureMode === "area" && vworldMeasurePoints.length >= 3) {
        layers.push(window.L.polygon(vworldMeasurePoints, shapeOptions));
      } else {
        layers.push(window.L.polyline(vworldMeasurePoints, shapeOptions));
      }
    }

    vworldMeasureLayer = window.L.layerGroup(layers).addTo(vworldMap);

    if (vworldMeasureMode === "distance") {
      const distance = vworldMeasurePoints.reduce((sum, point, index) => {
        if (index === 0) {
          return 0;
        }

        return sum + vworldMap.distance(vworldMeasurePoints[index - 1], point);
      }, 0);

      updateMeasureOutput(vworldMeasurePoints.length > 1 ? `거리 ${formatDistance(distance)}` : "지도에서 지점을 클릭하세요.");
      return;
    }

    if (vworldMeasureMode === "area") {
      const area = calculatePolygonArea(vworldMeasurePoints);
      updateMeasureOutput(vworldMeasurePoints.length > 2 ? `면적 ${formatArea(area)}` : "지도에서 3개 이상 지점을 클릭하세요.");
    }
  }

  function handleVworldMapClick(event) {
    if (!vworldMeasureMode) {
      return;
    }

    vworldMeasurePoints.push(event.latlng);
    renderVworldMeasure();
  }

  function setVworldMeasureMode(mode) {
    clearVworldMeasure();
    vworldMeasureMode = mode;
    updateMeasureOutput(mode === "distance" ? "거리재기: 지도에서 지점을 클릭하세요." : "면적재기: 지도에서 3개 이상 지점을 클릭하세요.");
  }

  function bindVworldTools() {
    document.querySelectorAll("[data-vworld-layer]").forEach((button) => {
      button.addEventListener("click", () => setVworldLayer(button.dataset.vworldLayer));
    });

    document.querySelectorAll("[data-vworld-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.vworldAction;

        if (action === "center") {
          centerVworldOnParcel();
        }

        if (action === "toggle-marker") {
          vworldMarkerVisible = !vworldMarkerVisible;
          syncVworldMarker();
          updateAerialStatus(vworldMarkerVisible ? "마커를 표시했습니다." : "마커를 숨겼습니다.");
        }

        if (action === "parcels") {
          loadNearbyParcelShapes(vworldCurrentPoint);
        }

        if (action === "distance") {
          setVworldMeasureMode("distance");
        }

        if (action === "area") {
          setVworldMeasureMode("area");
        }

        if (action === "clear") {
          clearVworldMeasure();
          updateAerialStatus("측정 표시를 초기화했습니다.");
        }
      });
    });
  }

  async function initAerialMap() {
    const mapNode = document.querySelector("#vworld-map");
    const emptyState = document.querySelector("[data-vworld-empty]");
    const status = document.querySelector("[data-aerial-status]");
    const parcelAddress = getParcelAddress();

    if (vworldMap) {
      vworldMap.remove();
      vworldMap = null;
      vworldMarker = null;
      vworldBaseLayer = null;
      vworldHybridLayer = null;
      vworldParcelLayer = null;
      vworldRadiusLayer = null;
      vworldMeasureLayer = null;
      vworldMeasurePoints = [];
      vworldMeasureMode = "";
    }

    if (!mapNode || !emptyState || !status) {
      return;
    }

    if (!window.L) {
      mapNode.classList.add("is-hidden");
      emptyState.hidden = false;
      status.textContent = "지도 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.";
      return;
    }

    if (!parcelAddress) {
      mapNode.classList.add("is-hidden");
      emptyState.hidden = false;
      status.textContent = "주소를 입력하면 해당 위치로 항공사진을 이동합니다.";
      return;
    }

    mapNode.classList.remove("is-hidden");
    emptyState.hidden = true;

    vworldMap = window.L.map(mapNode, {
      zoomControl: true,
    }).setView(defaultAerialCenter, 16);
    vworldMap.on("click", handleVworldMapClick);

    setVworldLayer(vworldCurrentLayer);
    bindVworldTools();

    status.textContent = `"${parcelAddress}" 위치를 V-World에서 검색 중입니다.`;

    try {
      const point = await resolveParcelAddress();

      if (!point) {
        status.textContent = `"${parcelAddress}" 검색 결과를 찾지 못했습니다. 지번을 더 정확히 입력해 주세요.`;
        return;
      }

      const position = [point.latitude, point.longitude];
      vworldCurrentPoint = point;
      vworldMap.setView(position, 18);
      syncVworldMarker();
      if (vworldMarker) {
        vworldMarker.openPopup();
      }
      status.textContent = `${point.title} 기준으로 V-World 항공사진을 표시 중입니다.`;
      loadNearbyParcelShapes(point);
    } catch (error) {
      status.textContent = "V-World 주소 검색 중 오류가 발생했습니다. 네트워크 상태를 확인해 주세요.";
    }
  }

  function setActivePortal(portalKey) {
    const portal = portalData[portalKey];
    activePortalKey = portalKey;

    if (parcelForm) {
      parcelForm.hidden = portalKey === "aerial" || portalKey === "law";
    }

    portalTabs.forEach((button) => {
      const isActive = button.dataset.portal === portalKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    portalPanel.innerHTML = portal.type === "aerial" ? renderAerialPortal() : renderEmbeddedPortal(portal);

    refreshIcons();

    if (portal.type === "aerial") {
      bindAerialSearchForm();
      window.requestAnimationFrame(() => initAerialMap());
    }

    if ((portalKey === "eum" || portalKey === "map") && getParcelAddress() && !getParcelState().pnu) {
      resolveParcelAddress().then((state) => {
        if (state?.pnu && activePortalKey === portalKey) {
          setActivePortal(portalKey);
        }
      });
    }
  }

  if (parcelInput) {
    parcelInput.value = readStoredValue(parcelStorageKey);
    parcelInput.addEventListener("input", () => {
      saveParcelAddress();
    });
  }

  if (parcelForm) {
    parcelForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveParcelAddress();
      await resolveParcelAddress();
      setActivePortal(activePortalKey);
    });
  }

  portalTabs.forEach((button) => {
    button.addEventListener("click", () => setActivePortal(button.dataset.portal));
  });

  const initialPortal = new URLSearchParams(window.location.search).get("portal");
  setActivePortal(portalData[initialPortal] ? initialPortal : "eum");
}

function renderList(target, items) {
  target.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
}

function initProcessSteps() {
  const stepButtons = document.querySelectorAll(".timeline__step");
  const stepNumber = document.querySelector("#step-number");
  const stepOwner = document.querySelector("#step-owner");
  const stepTitle = document.querySelector("#step-title");
  const stepSummary = document.querySelector("#step-summary");
  const stepChecks = document.querySelector("#step-checks");
  const stepOutputs = document.querySelector("#step-outputs");
  const stepNotice = document.querySelector("#step-notice");

  if (!stepButtons.length || !stepNumber || !stepOwner || !stepTitle || !stepSummary || !stepChecks || !stepOutputs || !stepNotice) {
    return;
  }

  function setActiveStep(stepKey) {
    const step = processSteps[stepKey];

    stepButtons.forEach((button) => {
      const isActive = button.dataset.step === stepKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    stepNumber.textContent = step.number;
    stepOwner.textContent = step.owner;
    stepTitle.textContent = step.title;
    stepSummary.textContent = step.summary;
    renderList(stepChecks, step.checks);
    renderList(stepOutputs, step.outputs);
    stepNotice.textContent = step.notice;
  }

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveStep(button.dataset.step));
  });

  setActiveStep("consult");
}

function initReadinessChecklist() {
  const checkboxes = document.querySelectorAll(".checklist input");
  const readyScore = document.querySelector("#ready-score");
  const readyTitle = document.querySelector("#ready-title");
  const readyCopy = document.querySelector("#ready-copy");

  if (!checkboxes.length || !readyScore || !readyTitle || !readyCopy) {
    return;
  }

  function updateReadiness() {
    const checkedCount = [...checkboxes].filter((input) => input.checked).length;
    const messageIndex = Math.min(Math.floor(checkedCount / 2), readyMessages.length - 1);
    const message = readyMessages[messageIndex];

    readyScore.textContent = `${checkedCount}/${checkboxes.length}`;
    readyTitle.textContent = message.title;
    readyCopy.textContent = message.copy;
  }

  checkboxes.forEach((input) => {
    input.addEventListener("change", updateReadiness);
  });

  updateReadiness();
}

function initGuidePages() {
  const pageButtons = document.querySelectorAll("[data-guide-page]");
  const pagePanels = document.querySelectorAll("[data-guide-panel]");

  if (!pageButtons.length || !pagePanels.length) {
    return;
  }

  function setActiveGuidePage(pageKey, options = {}) {
    const targetPanel = document.querySelector(`[data-guide-panel="${pageKey}"]`);

    if (!targetPanel) {
      return;
    }

    pageButtons.forEach((button) => {
      const isActive = button.dataset.guidePage === pageKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    pagePanels.forEach((panel) => {
      const isActive = panel.dataset.guidePanel === pageKey;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    if (options.updateHash) {
      window.history.replaceState(null, "", `#${pageKey}`);
    }
  }

  pageButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveGuidePage(button.dataset.guidePage, { updateHash: true }));
  });

  const initialPage = window.location.hash.replace("#", "");
  const hasInitialPage = [...pagePanels].some((panel) => panel.dataset.guidePanel === initialPage);

  setActiveGuidePage(hasInitialPage ? initialPage : pageButtons[0].dataset.guidePage);
}

function initGuidePrintButtons() {
  const printButtons = document.querySelectorAll("[data-print-image]");

  if (!printButtons.length) {
    return;
  }

  printButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const imageUrl = button.dataset.printImage;
      const title = button.dataset.printTitle || "안내자료";
      const absoluteImageUrl = new URL(imageUrl, window.location.href).href;
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        window.print();
        return;
      }

      printWindow.document.write(`
        <!doctype html>
        <html lang="ko">
          <head>
            <meta charset="UTF-8" />
            <title>${escapeHtml(title)}</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 18px; font-family: sans-serif; }
              img { display: block; width: 100%; max-width: 1120px; margin: 0 auto; }
              @page { size: landscape; margin: 10mm; }
            </style>
          </head>
          <body>
            <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    });
  });
}

initPortalTabs();
initProcessSteps();
initReadinessChecklist();
initGuidePages();
initGuidePrintButtons();
refreshIcons();
