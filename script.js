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
    url: "https://map.vworld.kr/map/dtkmap.do?mapmode=raster",
    frameTitle: "브이월드 항공사진 및 주제도",
    type: "aerial",
  },
  realestate: {
    title: "부동산정보",
    url: "https://kras.jeonbuk.go.kr/land_info/info/baseInfo/baseInfo.do",
    frameTitle: "전북 부동산정보 통합열람",
    type: "realestate",
  },
  law: {
    title: "법령정보",
    url: "https://www.law.go.kr/main.html",
    frameTitle: "국가법령정보센터 웹페이지",
  },
};

const parcelStorageKey = "landInfoPortal.parcelAddress";
const parcelStateStorageKey = "landInfoPortal.parcelState";
const parcelProvinceStorageKey = "landInfoPortal.parcelProvince";
const parcelCityStorageKey = "landInfoPortal.parcelCity";
const jeonbukCityNames = [
  "전주시",
  "군산시",
  "익산시",
  "정읍시",
  "남원시",
  "김제시",
  "완주군",
  "진안군",
  "무주군",
  "장수군",
  "임실군",
  "순창군",
  "고창군",
  "부안군",
];
const vworldApiKey = "39B6F1DE-2D35-3582-9008-A537EF6A6BC4";
const vworldParcelDataId = "LP_PA_CBND_BUBUN";
const vworldParcelWfsDataIds = ["lp_pa_cbnd_bubun", "lt_c_landinfobasemap"];
const vworldParcelRadiusMeters = 80;
const vworldLotNumberMinZoom = 18;
const vworldMapMaxZoom = 21;
const vworldTileNativeMaxZoom = 19;
const vworldParcelDetailZoom = 20;
const landCategoryCodeLabels = {
  "01": "전",
  "02": "답",
  "03": "과수원",
  "04": "목장용지",
  "05": "임야",
  "06": "광천지",
  "07": "염전",
  "08": "대",
  "09": "공장용지",
  "10": "학교용지",
  "11": "주차장",
  "12": "주유소용지",
  "13": "창고용지",
  "14": "도로",
  "15": "철도용지",
  "16": "제방",
  "17": "하천",
  "18": "구거",
  "19": "유지",
  "20": "양어장",
  "21": "수도용지",
  "22": "공원",
  "23": "체육용지",
  "24": "유원지",
  "25": "종교용지",
  "26": "사적지",
  "27": "묘지",
  "28": "잡종지",
};
const defaultAerialCenter = [37.5665, 126.978];
let vworldMap = null;
let vworldMarker = null;
let vworldBaseLayer = null;
let vworldHybridLayer = null;
let vworldParcelLayer = null;
let vworldRadiusLayer = null;
let vworldCadastralLayer = null;
let vworldLotNumberLayer = null;
let vworldCurrentLayer = "satellite";
let vworldCurrentPoint = null;
let vworldSearchResults = [];
let vworldLabelRequestId = 0;
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
  const parcelProvince = document.querySelector("[data-parcel-province]");
  const parcelCity = document.querySelector("[data-parcel-city]");
  const parcelStatus = document.querySelector("[data-parcel-status]");
  let activePortalKey = "eum";
  const portalViews = new Map();
  const initialParams = new URLSearchParams(window.location.search);
  let selectedLaw = readSelectedLaw(initialParams);

  if (!portalTabs.length || !portalPanel) {
    return;
  }

  portalPanel.replaceChildren();

  function getParcelAddress() {
    return (parcelInput ? parcelInput.value : readStoredValue(parcelStorageKey)).trim();
  }

  function getParcelProvince() {
    return (parcelProvince?.value || readStoredValue(parcelProvinceStorageKey) || "전북특별자치도").trim();
  }

  function getParcelCity() {
    return (parcelCity?.value || readStoredValue(parcelCityStorageKey)).trim();
  }

  function saveParcelRegion() {
    writeStoredValue(parcelProvinceStorageKey, getParcelProvince());
    writeStoredValue(parcelCityStorageKey, getParcelCity());
  }

  function normalizeMountainLotAddress(rawAddress) {
    return String(rawAddress || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/([가-힣]+(?:리|동|가|읍|면))\s*산\s*(\d+(?:-\d+)?)/g, "$1 산 $2")
      .replace(/(^|\s)산\s*(\d+(?:-\d+)?)/g, "$1산 $2")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasProvinceToken(address) {
    return /(특별자치도|특별시|광역시|특별자치시|도)\s/.test(address) || /^(전북|전라북도|전북특별자치도)\b/.test(address);
  }

  function buildContextualParcelAddress(rawAddress = getParcelAddress()) {
    const address = normalizeMountainLotAddress(rawAddress);
    const province = getParcelProvince();
    const city = getParcelCity();

    if (!address) {
      return "";
    }

    const parts = [];

    if (province && !hasProvinceToken(address)) {
      parts.push(province);
    }

    if (city && !address.includes(city) && !jeonbukCityNames.some((cityName) => address.includes(cityName))) {
      parts.push(city);
    }

    parts.push(address);

    return normalizeMountainLotAddress(parts.join(" "));
  }

  function saveParcelAddress(nextAddress = getParcelAddress()) {
    const address = String(nextAddress || "").trim().replace(/\s+/g, " ");
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

  function getPnuParts(pnu) {
    const normalized = normalizePnu(pnu);

    if (normalized.length !== 19) {
      return null;
    }

    const mainNumber = Number(normalized.slice(11, 15));
    const subNumber = Number(normalized.slice(15, 19));

    return {
      landGbn: normalized.slice(10, 11),
      bobn: mainNumber ? String(mainNumber) : "",
      bubn: subNumber ? normalized.slice(15, 19) : "",
    };
  }

  function getEumUrl() {
    const state = getParcelState();

    if (state.pnu) {
      const url = new URL(portalData.eum.landUseUrl);
      const pnuParts = getPnuParts(state.pnu);

      url.searchParams.set("pnu", state.pnu);
      url.searchParams.set("bobn", pnuParts?.bobn || "");
      url.searchParams.set("bubn", pnuParts?.bubn || "");
      url.searchParams.set("landGbn", pnuParts?.landGbn || "");
      url.searchParams.set("chk", "0");
      url.searchParams.set("scale", "");
      url.searchParams.set("isNoScr", "script");
      url.searchParams.set("mode", "search");
      url.searchParams.set("selGbn", "umd");
      url.searchParams.set("s_type", "1");
      url.searchParams.set("add", "land");

      if (state.title || state.query || state.subtitle) {
        url.searchParams.set("fullAddress", state.title || state.query || state.subtitle);
      }

      return url.toString();
    }

    return portalData.eum.url;
  }

  function getRealEstateUrl() {
    return portalData.realestate.url;
  }

  function renderSharedParcel(label = "토지이음 검색 주소") {
    const parcelAddress = escapeHtml(getParcelAddress());
    const displayText = parcelAddress || "아직 입력 전";

    return `
      <div class="portal-context">
        <span>${escapeHtml(label)}</span>
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

  function updateParcelStatus(message) {
    if (parcelStatus) {
      parcelStatus.textContent = message;
    }
  }

  function readSelectedLaw(params) {
    const lawUrl = params.get("lawUrl");

    if (!lawUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(lawUrl, window.location.href);
      const isLawCenter = parsedUrl.hostname === "law.go.kr" || parsedUrl.hostname.endsWith(".law.go.kr");

      if (!isLawCenter || !/^https?:$/.test(parsedUrl.protocol)) {
        return null;
      }

      return {
        title: params.get("lawTitle") || "선택한 법령 조항",
        url: parsedUrl.toString(),
      };
    } catch (error) {
      return null;
    }
  }

  function getLawUrl() {
    return selectedLaw?.url || portalData.law.url;
  }

  function renderLawContext() {
    if (!selectedLaw) {
      return "";
    }

    return `
      <div class="portal-context portal-context--law">
        <span>선택한 법령 조항</span>
        <strong>${escapeHtml(selectedLaw.title)}</strong>
      </div>
    `;
  }

  function renderRealEstatePortal() {
    const parcelAddress = escapeHtml(getParcelAddress());
    const displayText = parcelAddress || "주소검색 후 이곳에 검색 주소가 표시됩니다.";

    return `
      <div class="realestate-connect">
        ${renderSharedParcel("부동산정보 검색 주소")}
        <div class="realestate-connect__body">
          <div class="realestate-connect__icon" aria-hidden="true">
            <i data-lucide="shield-alert"></i>
          </div>
          <div class="realestate-connect__content">
            <p class="realestate-connect__eyebrow">KRAS 웹방화벽 안내</p>
            <h2>부동산정보는 공식 사이트에서 직접 열람합니다.</h2>
            <p>
              전북 부동산정보 통합열람은 외부 페이지 내부 호출이나 필지 직접 URL 접근이 웹방화벽에서 차단될 수 있습니다.
              아래 버튼으로 공식 사이트를 열고, 복사된 주소를 지번 또는 도로명 검색란에 입력해 확인해 주세요.
            </p>
            <div class="realestate-connect__address">
              <span>현재 검색 주소</span>
              <strong data-shared-parcel>${displayText}</strong>
            </div>
            <div class="realestate-connect__actions">
              <button class="button realestate-connect__copy" type="button" data-realestate-copy>
                <i data-lucide="copy"></i>
                주소 복사
              </button>
              <button class="button button--primary" type="button" data-realestate-open>
                <i data-lucide="external-link"></i>
                KRAS 공식 사이트 열기
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderEmbeddedPortal(portal) {
    const iframeUrl =
      portal === portalData.map
        ? getMapUrl()
        : portal === portalData.eum
          ? getEumUrl()
          : portal === portalData.law
            ? getLawUrl()
            : portal.url;
    const isEumPortal = portal === portalData.eum;
    const isLawPortal = portal === portalData.law;

    return `
      <div class="embedded-site${isEumPortal ? " embedded-site--eum" : ""}${isLawPortal ? " embedded-site--law" : ""}">
        ${isLawPortal ? renderLawContext() : ""}
        <iframe
          class="embedded-site__frame"
          title="${portal.frameTitle}"
          src="${escapeHtml(iframeUrl)}"
          data-current-src="${escapeHtml(iframeUrl)}"
          loading="eager"
          allow="geolocation; fullscreen"
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

  function renderAerialPortalConnected() {
    const parcelAddress = escapeHtml(getParcelAddress());

    return `
      <div class="aerial-portal aerial-portal--connected">
        <aside class="aerial-portal__panel">
          <form class="aerial-search" data-aerial-parcel-form>
            <label for="aerial-parcel-address">주소·도로명·명칭 검색</label>
            <div class="aerial-search__row">
              <input
                id="aerial-parcel-address"
                type="search"
                name="aerialParcel"
                data-aerial-parcel-input
                value="${parcelAddress}"
                placeholder="예: 서울특별시 중구 세종대로 110 또는 지번주소"
                autocomplete="street-address"
              />
              <button class="button button--primary" type="submit">
                <i data-lucide="search"></i>
                검색
              </button>
            </div>
            <div class="aerial-search__modes" role="radiogroup" aria-label="검색 방식">
              <label>
                <input type="radio" name="vworldSearchMode" value="address" checked />
                <span>주소</span>
              </label>
              <label>
                <input type="radio" name="vworldSearchMode" value="place" />
                <span>명칭</span>
              </label>
            </div>
          </form>
          <div class="aerial-results" data-aerial-results>
            <p>검색 결과를 선택하면 항공사진과 연속지적도가 함께 이동합니다.</p>
          </div>
          <div class="vworld-tools" aria-label="항공사진 지도 도구">
            <div class="vworld-tool-group">
              <strong>지도</strong>
              <div class="vworld-segment" role="group" aria-label="배경지도 선택">
                <button type="button" class="is-active" data-vworld-layer="satellite">항공</button>
                <button type="button" data-vworld-layer="base">일반</button>
                <button type="button" data-vworld-layer="hybrid">라벨</button>
              </div>
            </div>
            <div class="vworld-tool-group">
              <strong>측정</strong>
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
            <div class="vworld-tool-group">
              <strong>보기</strong>
              <button type="button" data-vworld-action="center">
                <i data-lucide="crosshair"></i>
                검색위치
              </button>
              <button type="button" data-vworld-action="toggle-marker">
                <i data-lucide="map-pin"></i>
                마커
              </button>
            </div>
            <output class="vworld-measure" data-vworld-measure>거리 또는 면적을 선택한 뒤 도면을 클릭하세요.</output>
          </div>
        </aside>
        <div class="vworld-map-shell">
          <div class="vworld-map" id="vworld-map" aria-label="V-World 항공사진과 연속지적도"></div>
          <div class="vworld-map__empty" data-vworld-empty>
            <i data-lucide="satellite"></i>
            <strong>지도를 준비 중입니다.</strong>
            <span>주소 또는 명칭을 검색해 주세요.</span>
          </div>
          <p class="aerial-status" data-aerial-status>항공사진과 연속지적도를 준비 중입니다.</p>
        </div>
      </div>
    `;
  }

  function getEmbeddedPortalUrl(portal) {
    if (portal === portalData.map) {
      return getMapUrl();
    }

    if (portal === portalData.eum) {
      return getEumUrl();
    }

    if (portal === portalData.law) {
      return getLawUrl();
    }

    return portal.url;
  }

  function ensurePortalView(portalKey) {
    const portal = portalData[portalKey];
    let view = portalViews.get(portalKey);

    if (!view) {
      view = document.createElement("div");
      view.className = "portal-view";
      view.dataset.portalView = portalKey;
      view.hidden = true;
      view.innerHTML =
        portal.type === "aerial"
          ? renderAerialPortalConnected()
          : portal.type === "realestate"
            ? renderRealEstatePortal()
            : renderEmbeddedPortal(portal);
      portalPanel.append(view);
      portalViews.set(portalKey, view);
      return { view, isNew: true };
    }

    if (portal.type === "realestate") {
      view.innerHTML = renderRealEstatePortal();
    } else if (portal.type !== "aerial") {
      const iframe = view.querySelector(".embedded-site__frame");
      const nextUrl = getEmbeddedPortalUrl(portal);

      if (iframe && iframe.dataset.currentSrc !== nextUrl) {
        iframe.src = nextUrl;
        iframe.dataset.currentSrc = nextUrl;
      }
    }

    return { view, isNew: false };
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
        const roadAddress = item?.address?.road || "";
        const parcelAddress = item?.address?.parcel || "";

        const title = parcelAddress || item.title || roadAddress || query;

        return {
          latitude,
          longitude,
          pnu,
          title,
          subtitle: [roadAddress, parcelAddress, item?.category].filter(Boolean).join(" · "),
          roadAddress,
          parcelAddress,
          rawTitle: item.title || "",
        };
      }
    }

    return null;
  }

  function toVworldSearchResult(item, searchType, fallbackQuery) {
    const longitude = Number(item?.point?.x);
    const latitude = Number(item?.point?.y);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const pnu = String(item?.id || "").match(/^\d{19}$/) ? String(item.id) : "";
    const roadAddress = item?.address?.road || "";
    const parcelAddress = item?.address?.parcel || "";
    const title =
      searchType === "address"
        ? parcelAddress || item?.title || roadAddress || fallbackQuery
        : item?.title || parcelAddress || roadAddress || fallbackQuery;
    const subtitle = [roadAddress, parcelAddress, item?.category].filter(Boolean).join(" · ");

    return {
      latitude,
      longitude,
      pnu,
      title,
      subtitle,
      roadAddress,
      parcelAddress,
      rawTitle: item?.title || "",
      searchType,
    };
  }

  function getPreferredParcelAddress(result, fallbackQuery = "") {
    return result?.parcelAddress || result?.title || result?.roadAddress || fallbackQuery;
  }

  function setSharedParcelAddress(address) {
    const nextAddress = String(address || "").trim();

    if (!nextAddress) {
      return;
    }

    if (parcelInput && parcelInput.value !== nextAddress) {
      parcelInput.value = nextAddress;
    }

    const aerialInput = document.querySelector("[data-aerial-parcel-input]");

    if (aerialInput && aerialInput.value !== nextAddress) {
      aerialInput.value = nextAddress;
    }

    writeStoredValue(parcelStorageKey, nextAddress);
    syncSharedParcelText();
  }

  async function reverseGeocodeParcelAddress(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return "";
    }

    const url = new URL("https://api.vworld.kr/req/address");
    url.searchParams.set("service", "address");
    url.searchParams.set("request", "getAddress");
    url.searchParams.set("version", "2.0");
    url.searchParams.set("crs", "EPSG:4326");
    url.searchParams.set("point", `${longitude},${latitude}`);
    url.searchParams.set("type", "PARCEL");
    url.searchParams.set("format", "json");
    url.searchParams.set("errorformat", "json");
    url.searchParams.set("key", vworldApiKey);

    try {
      const data = await requestVworldJson(url);
      const result = data?.response?.result;
      const items = Array.isArray(result) ? result : result ? [result] : [];
      const parcelItem = items.find((item) => item?.text || item?.address?.parcel);

      return parcelItem?.text || parcelItem?.address?.parcel || "";
    } catch (error) {
      return "";
    }
  }

  async function ensureResultParcelAddress(result, fallbackQuery = "") {
    if (!result) {
      return String(fallbackQuery || "").trim();
    }

    let parcelAddress = String(result.parcelAddress || "").trim();

    if (!parcelAddress) {
      parcelAddress = await reverseGeocodeParcelAddress(Number(result.latitude), Number(result.longitude));
    }

    if (parcelAddress) {
      result.parcelAddress = parcelAddress;
      result.title = parcelAddress;
      result.subtitle = [result.roadAddress, parcelAddress, result.searchType].filter(Boolean).join(" · ");
      return parcelAddress;
    }

    return getPreferredParcelAddress(result, fallbackQuery);
  }

  async function searchVworldIntegrated(query, searchMode) {
    const requests =
      searchMode === "place"
        ? [{ type: "place" }]
        : [
            { type: "address", category: "parcel" },
            { type: "address", category: "road" },
          ];
    const results = [];
    const seen = new Set();

    for (const request of requests) {
      const url = new URL("https://api.vworld.kr/req/search");
      url.searchParams.set("service", "search");
      url.searchParams.set("request", "search");
      url.searchParams.set("version", "2.0");
      url.searchParams.set("crs", "EPSG:4326");
      url.searchParams.set("size", "10");
      url.searchParams.set("page", "1");
      url.searchParams.set("type", request.type);
      url.searchParams.set("format", "json");
      url.searchParams.set("errorformat", "json");
      url.searchParams.set("key", vworldApiKey);
      url.searchParams.set("query", query);

      if (request.category) {
        url.searchParams.set("category", request.category);
      }

      let data;

      try {
        data = await requestVworldJson(url);
      } catch (error) {
        continue;
      }

      const items = data?.response?.result?.items || [];

      for (const item of items) {
        const result = toVworldSearchResult(item, request.type, query);

        if (!result) {
          continue;
        }

        const key = result.pnu || `${result.title}:${result.latitude.toFixed(7)}:${result.longitude.toFixed(7)}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        results.push(result);
      }
    }

    return results;
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

  function createVworldParcelWfsUrl(layerName, latitude, longitude, radiusMeters) {
    const bbox = getRadiusBbox(latitude, longitude, radiusMeters);
    const url = new URL("https://api.vworld.kr/req/wfs");

    url.searchParams.set("service", "WFS");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("version", "1.1.0");
    url.searchParams.set("typename", layerName);
    url.searchParams.set("srsname", "EPSG:4326");
    url.searchParams.set("bbox", bbox.join(","));
    url.searchParams.set("maxfeatures", "200");
    url.searchParams.set("output", "text/javascript");
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
    url.searchParams.set("size", "300");
    url.searchParams.set("page", "1");

    try {
      const data = await requestVworldJson(url);
      return extractVworldFeatures(data);
    } catch (dataApiError) {
      const wfsFeatures = await searchVworldParcelWfsFeatures(latitude, longitude, radiusMeters);

      if (wfsFeatures.length) {
        return wfsFeatures;
      }

      throw dataApiError;
    }
  }

  async function searchVworldParcelWfsFeatures(latitude, longitude, radiusMeters = vworldParcelRadiusMeters) {
    const errors = [];

    for (const layerName of vworldParcelWfsDataIds) {
      try {
        const data = await requestVworldJson(createVworldParcelWfsUrl(layerName, latitude, longitude, radiusMeters));
        const features = extractVworldFeatures(data);

        if (features.length) {
          return features;
        }
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length) {
      throw errors[0];
    }

    return [];
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
    const rawAddress = getParcelAddress();
    const address = buildContextualParcelAddress(rawAddress);

    if (!address) {
      writeStoredJson(parcelStateStorageKey, { query: "" });
      return null;
    }

    if (address !== rawAddress) {
      saveParcelAddress(address);
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

    const resolvedAddress = await ensureResultParcelAddress(point, address);
    const nextState = {
      query: resolvedAddress || address,
      originalQuery: resolvedAddress && resolvedAddress !== address ? address : "",
      ...point,
      title: resolvedAddress || point.title,
    };

    writeStoredJson(parcelStateStorageKey, nextState);
    setSharedParcelAddress(nextState.query);
    return nextState;
  }

  function renderAerialResults(results, message = "") {
    const resultsNode = document.querySelector("[data-aerial-results]");

    if (!resultsNode) {
      return;
    }

    if (!results.length) {
      resultsNode.innerHTML = `<p>${escapeHtml(message || "검색 결과가 없습니다.")}</p>`;
      return;
    }

    resultsNode.innerHTML = `
      <strong>검색 결과</strong>
      <ul>
        ${results
          .map(
            (result, index) => `
              <li>
                <button type="button" data-vworld-result="${index}">
                  <span>${escapeHtml(result.title)}</span>
                  ${result.subtitle ? `<small>${escapeHtml(result.subtitle)}</small>` : ""}
                </button>
              </li>
            `
          )
          .join("")}
      </ul>
    `;
  }

  function moveVworldToResult(result) {
    if (!vworldMap || !window.L || !result) {
      return;
    }

    const title = result.title || result.query || "선택 위치";
    vworldCurrentPoint = { ...result, title };
    vworldMarkerVisible = true;
    vworldMap.setView([result.latitude, result.longitude], result.pnu ? vworldParcelDetailZoom : 18);
    syncVworldMarker();
    clearVworldParcels();
    syncVworldLotNumberLabel(vworldCurrentPoint);
    setVworldCadastralLayer();

    if (vworldMarker) {
      vworldMarker.openPopup();
    }

    updateAerialStatus(`${title} 위치로 이동했습니다. 반경 ${vworldParcelRadiusMeters}m 이내 지번과 지목을 불러오는 중입니다.`);
    loadNearbyParcelNumberLabels(vworldCurrentPoint);
  }

  function bindAerialSearchFormConnected() {
    const aerialForm = document.querySelector("[data-aerial-parcel-form]");
    const aerialInput = document.querySelector("[data-aerial-parcel-input]");
    const resultsNode = document.querySelector("[data-aerial-results]");

    if (!aerialForm || !aerialInput || !resultsNode) {
      return;
    }

    resultsNode.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-vworld-result]");

      if (!button) {
        return;
      }

      const result = vworldSearchResults[Number(button.dataset.vworldResult)];

      if (!result) {
        return;
      }

      updateAerialStatus("선택한 위치의 지번주소를 확인하는 중입니다.");
      const query = await ensureResultParcelAddress(result, result.title);
      setSharedParcelAddress(query);
      writeStoredJson(parcelStateStorageKey, {
        query,
        originalQuery: result.roadAddress || result.rawTitle || "",
        latitude: result.latitude,
        longitude: result.longitude,
        pnu: result.pnu,
        title: query,
        subtitle: result.subtitle,
        roadAddress: result.roadAddress,
        parcelAddress: result.parcelAddress,
      });
      moveVworldToResult({ ...result, query, title: query });
    });

    aerialForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const rawQuery = aerialInput.value.trim();
      const searchMode = aerialForm.querySelector("input[name='vworldSearchMode']:checked")?.value || "address";
      const query = searchMode === "address" ? buildContextualParcelAddress(rawQuery) : rawQuery;

      if (!query) {
        vworldSearchResults = [];
        renderAerialResults([], "검색어를 입력해 주세요.");
        updateAerialStatus("주소 또는 명칭을 입력해 주세요.");
        return;
      }

      saveParcelAddress(query);
      if (searchMode === "address" && aerialInput.value !== query) {
        aerialInput.value = query;
      }
      renderAerialResults([], "검색 중입니다.");
      updateAerialStatus(rawQuery && rawQuery !== query ? `"${rawQuery}"을 "${query}" 기준으로 검색 중입니다.` : `"${query}" 검색 중입니다.`);

      try {
        vworldSearchResults = await searchVworldIntegrated(query, searchMode);
        renderAerialResults(vworldSearchResults);
        updateAerialStatus(vworldSearchResults.length ? "검색 결과를 선택해 주세요." : "검색 결과가 없습니다.");
      } catch (error) {
        vworldSearchResults = [];
        renderAerialResults([], "V-World 검색 API를 불러오지 못했습니다.");
        updateAerialStatus("V-World 검색 API를 불러오지 못했습니다. API 키와 네트워크 상태를 확인해 주세요.");
      }
    });
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
      const originalAddress = aerialInput.value.trim();
      const address = buildContextualParcelAddress(originalAddress);

      if (parcelInput) {
        parcelInput.value = address;
      }

      saveParcelAddress(address);
      if (aerialInput.value !== address) {
        aerialInput.value = address;
      }
      await resolveParcelAddress();
      setActivePortal("aerial");
    });
  }

  function createVworldLayer(layerName) {
    const extension = layerName === "Satellite" ? "jpeg" : "png";

    return window.L.tileLayer(
      `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(vworldApiKey)}/${layerName}/{z}/{y}/{x}.${extension}`,
      {
        maxZoom: vworldMapMaxZoom,
        maxNativeZoom: vworldTileNativeMaxZoom,
        attribution: "V-World",
      }
    );
  }

  function createVworldCadastralLayer() {
    return window.L.tileLayer.wms("https://api.vworld.kr/req/wms", {
      service: "WMS",
      version: "1.3.0",
      request: "GetMap",
      layers: "lp_pa_cbnd_bonbun,lp_pa_cbnd_bubun",
      styles: "lp_pa_cbnd_bonbun_line,lp_pa_cbnd_bubun_line",
      format: "image/png",
      transparent: true,
      exceptions: "text/xml",
      maxZoom: vworldMapMaxZoom,
      maxNativeZoom: vworldTileNativeMaxZoom,
      key: vworldApiKey,
      domain: window.location.origin,
      attribution: "V-World",
    });
  }

  function setVworldCadastralLayer() {
    if (!vworldMap || !window.L) {
      return;
    }

    if (vworldCadastralLayer) {
      vworldMap.removeLayer(vworldCadastralLayer);
      vworldCadastralLayer = null;
    }

    vworldCadastralLayer = createVworldCadastralLayer().addTo(vworldMap);
    vworldCadastralLayer.setZIndex(30);
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

  function syncVworldMeasureCursor() {
    const mapNode = vworldMap?.getContainer?.();

    if (mapNode) {
      mapNode.classList.toggle("is-measuring", Boolean(vworldMeasureMode));
    }
  }

  function centerVworldOnParcel() {
    if (!vworldMap || !vworldCurrentPoint) {
      updateAerialStatus("먼저 주소를 검색해 위치를 확인해 주세요.");
      return;
    }

    vworldMap.setView([vworldCurrentPoint.latitude, vworldCurrentPoint.longitude], vworldParcelDetailZoom);
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

  function getLotNumberFromPnu(pnu) {
    const normalized = normalizePnu(pnu);

    if (normalized.length !== 19) {
      return "";
    }

    const isMountain = normalized.slice(10, 11) === "2";
    const mainNumber = Number(normalized.slice(11, 15));
    const subNumber = Number(normalized.slice(15, 19));

    if (!mainNumber) {
      return "";
    }

    return `${isMountain ? "산 " : ""}${mainNumber}${subNumber ? `-${subNumber}` : ""}`;
  }

  function getCleanLotNumber(value) {
    const text = String(value || "").trim();

    if (!text) {
      return "";
    }

    const matches = text.match(/산\s*\d+(?:-\d+)?|\d+(?:-\d+)?/g);

    return matches?.length ? matches[matches.length - 1].replace(/\s+/g, " ") : text;
  }

  function getLotNumberLabel(point) {
    return getLotNumberFromPnu(point?.pnu) || getCleanLotNumber(point?.title);
  }

  function clearVworldLotNumberLabels() {
    if (vworldLotNumberLayer && vworldMap) {
      vworldMap.removeLayer(vworldLotNumberLayer);
    }

    vworldLotNumberLayer = null;
  }

  function shouldShowVworldLotNumberLabels() {
    return Boolean(vworldMap && vworldMap.getZoom() >= vworldLotNumberMinZoom);
  }

  function syncVworldLotNumberLayerVisibility() {
    if (!vworldMap || !vworldLotNumberLayer) {
      return;
    }

    const isVisible = vworldMap.hasLayer(vworldLotNumberLayer);
    const shouldShow = shouldShowVworldLotNumberLabels();

    if (shouldShow && !isVisible) {
      vworldLotNumberLayer.addTo(vworldMap);
      return;
    }

    if (!shouldShow && isVisible) {
      vworldMap.removeLayer(vworldLotNumberLayer);
    }
  }

  function getVworldLotNumberHtml(lotNumber, jimok = "") {
    const lotText = String(lotNumber || "").trim();
    const jimokText = String(jimok || "").trim();

    if (!lotText) {
      return "";
    }

    return `<span><b>${escapeHtml(lotText)}</b>${jimokText ? `<small>${escapeHtml(jimokText)}</small>` : ""}</span>`;
  }

  function createVworldLotNumberMarker(label) {
    const latitude = Number(label?.latitude);
    const longitude = Number(label?.longitude);
    const html = getVworldLotNumberHtml(label?.lotNumber, label?.jimok);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !html) {
      return null;
    }

    return window.L.marker([latitude, longitude], {
      interactive: false,
      keyboard: false,
      zIndexOffset: 900,
      icon: window.L.divIcon({
        className: "vworld-lot-number-label",
        html,
        iconSize: [76, 40],
        iconAnchor: [38, 20],
      }),
    });
  }

  function renderVworldLotNumberLabels(labels = []) {
    if (!vworldMap || !window.L) {
      return 0;
    }

    clearVworldLotNumberLabels();

    const markers = labels.map(createVworldLotNumberMarker).filter(Boolean);

    if (!markers.length) {
      return 0;
    }

    vworldLotNumberLayer = window.L.layerGroup(markers);
    syncVworldLotNumberLayerVisibility();
    return markers.length;
  }

  function syncVworldLotNumberLabel(point) {
    if (!point) {
      clearVworldLotNumberLabels();
      return 0;
    }

    const lotNumber = getLotNumberLabel(point);

    if (!lotNumber) {
      clearVworldLotNumberLabels();
      return 0;
    }

    return renderVworldLotNumberLabels([
      {
        latitude: point.latitude,
        longitude: point.longitude,
        lotNumber,
        jimok: "",
        pnu: normalizePnu(point.pnu),
      },
    ]);
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

  function formatJimokLabel(value) {
    const label = String(value || "").trim();

    if (!label) {
      return "";
    }

    const normalizedCode = label.replace(/\D/g, "").padStart(2, "0");

    return landCategoryCodeLabels[label] || landCategoryCodeLabels[normalizedCode] || label;
  }

  function getJimokLabel(properties = {}) {
    const namedJimok = getFeatureProperty(properties, [
      "jimok",
      "JIMOK",
      "jimok_nm",
      "JIMOK_NM",
      "jimokName",
      "JIMOK_NAME",
      "lndcgrCodeNm",
      "LNDCGR_CODE_NM",
      "lndcgr_code_nm",
      "landCategory",
      "LAND_CATEGORY",
    ]);

    if (namedJimok) {
      return formatJimokLabel(namedJimok);
    }

    return formatJimokLabel(
      getFeatureProperty(properties, ["jimok_cd", "JIMOK_CD", "lndcgrCode", "LNDCGR_CODE", "lndcgr_code", "landCategoryCode"])
    );
  }

  function getFeatureLotNumber(feature) {
    const pnuLotNumber = getLotNumberFromPnu(getFeaturePnu(feature));

    if (pnuLotNumber) {
      return pnuLotNumber;
    }

    return getCleanLotNumber(getFeatureProperty(feature?.properties, ["jibun", "JIBUN", "lotNo", "LOT_NO", "lotno", "addr", "ADDR"]));
  }

  function collectGeometryCoordinates(coordinates, points = []) {
    if (!Array.isArray(coordinates)) {
      return points;
    }

    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);

    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      points.push([longitude, latitude]);
      return points;
    }

    coordinates.forEach((item) => collectGeometryCoordinates(item, points));
    return points;
  }

  function getFeatureLabelPoint(feature) {
    const points = collectGeometryCoordinates(feature?.geometry?.coordinates);

    if (!points.length) {
      return null;
    }

    const bounds = points.reduce(
      (nextBounds, [longitude, latitude]) => ({
        minLatitude: Math.min(nextBounds.minLatitude, latitude),
        maxLatitude: Math.max(nextBounds.maxLatitude, latitude),
        minLongitude: Math.min(nextBounds.minLongitude, longitude),
        maxLongitude: Math.max(nextBounds.maxLongitude, longitude),
      }),
      {
        minLatitude: Infinity,
        maxLatitude: -Infinity,
        minLongitude: Infinity,
        maxLongitude: -Infinity,
      }
    );

    return {
      latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
      longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    };
  }

  function getPointDistanceMeters(first, second) {
    const from = [Number(first?.latitude), Number(first?.longitude)];
    const to = [Number(second?.latitude), Number(second?.longitude)];

    if (![...from, ...to].every(Number.isFinite)) {
      return Infinity;
    }

    if (vworldMap?.distance) {
      return vworldMap.distance(from, to);
    }

    const earthRadius = 6378137;
    const latitude1 = (from[0] * Math.PI) / 180;
    const latitude2 = (to[0] * Math.PI) / 180;
    const latitudeDelta = ((to[0] - from[0]) * Math.PI) / 180;
    const longitudeDelta = ((to[1] - from[1]) * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

    return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  function isFeatureWithinRadius(feature, point, radiusMeters) {
    if (isPointInParcelFeature(point, feature)) {
      return true;
    }

    const labelPoint = getFeatureLabelPoint(feature);

    if (labelPoint && getPointDistanceMeters(point, labelPoint) <= radiusMeters) {
      return true;
    }

    return collectGeometryCoordinates(feature?.geometry?.coordinates).some(([longitude, latitude]) =>
      getPointDistanceMeters(point, { latitude, longitude }) <= radiusMeters
    );
  }

  function getNearbyParcelLabelItems(features = [], point, radiusMeters = vworldParcelRadiusMeters) {
    const labels = [];
    const seen = new Set();

    features.forEach((feature) => {
      const labelPoint = getFeatureLabelPoint(feature);
      const lotNumber = getFeatureLotNumber(feature);

      if (!labelPoint || !lotNumber || !isFeatureWithinRadius(feature, point, radiusMeters)) {
        return;
      }

      const pnu = getFeaturePnu(feature);
      const key = pnu || `${lotNumber}:${labelPoint.latitude.toFixed(7)}:${labelPoint.longitude.toFixed(7)}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      labels.push({
        ...labelPoint,
        lotNumber,
        jimok: getJimokLabel(feature?.properties),
        pnu,
        distance: getPointDistanceMeters(point, labelPoint),
      });
    });

    return ensureSelectedParcelLabel(labels, point)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, 80);
  }

  function ensureSelectedParcelLabel(labels, point) {
    const lotNumber = getLotNumberLabel(point);
    const selectedPnu = normalizePnu(point?.pnu);

    if (!lotNumber) {
      return labels;
    }

    const hasSelectedLabel = labels.some(
      (label) =>
        (selectedPnu && label.pnu === selectedPnu) ||
        (label.lotNumber === lotNumber && getPointDistanceMeters(label, point) <= 8)
    );

    if (hasSelectedLabel) {
      return labels;
    }

    return [
      {
        latitude: point.latitude,
        longitude: point.longitude,
        lotNumber,
        jimok: "",
        pnu: selectedPnu,
        distance: 0,
      },
      ...labels,
    ];
  }

  async function loadNearbyParcelNumberLabels(point) {
    if (!vworldMap || !window.L || !point) {
      return;
    }

    const requestId = ++vworldLabelRequestId;

    try {
      const features = await searchVworldParcels(point.latitude, point.longitude, vworldParcelRadiusMeters);

      if (requestId !== vworldLabelRequestId) {
        return;
      }

      const labels = getNearbyParcelLabelItems(features, point, vworldParcelRadiusMeters);
      const labelCount = renderVworldLotNumberLabels(labels);

      if (labelCount) {
        updateAerialStatus(`${point.title} 기준 반경 ${vworldParcelRadiusMeters}m 이내 지번·지목 ${labelCount}건을 표시했습니다.`);
        return;
      }

      syncVworldLotNumberLabel(point);
      updateAerialStatus(`${point.title} 위치로 이동했습니다. 반경 ${vworldParcelRadiusMeters}m 이내 지번·지목 정보를 찾지 못했습니다.`);
    } catch (error) {
      if (requestId !== vworldLabelRequestId) {
        return;
      }

      syncVworldLotNumberLabel(point);
      updateAerialStatus(`${point.title} 위치로 이동했습니다. 반경 ${vworldParcelRadiusMeters}m 지번·지목은 V-World 필지 API 권한 확인이 필요합니다.`);
    }
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
        vworldMap.fitBounds(bounds.pad(0.28), { maxZoom: vworldParcelDetailZoom });
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
        updateAerialStatus(`${point.title} 번지의 필지 도형을 찾지 못했습니다. ${vworldParcelRadiusMeters}m 도형으로 주변 필지를 확인해 주세요.`);
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
    document.querySelectorAll('[data-vworld-action="distance"], [data-vworld-action="area"]').forEach((button) => {
      button.classList.remove("is-active");
    });
    syncVworldMeasureCursor();
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
    document.querySelectorAll('[data-vworld-action="distance"], [data-vworld-action="area"]').forEach((button) => {
      button.classList.toggle("is-active", button.dataset.vworldAction === mode);
    });
    syncVworldMeasureCursor();
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
      vworldLotNumberLayer = null;
      vworldLabelRequestId += 1;
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
      maxZoom: vworldMapMaxZoom,
    }).setView(defaultAerialCenter, 16);
    vworldMap.on("click", handleVworldMapClick);
    vworldMap.on("zoomend", syncVworldLotNumberLayerVisibility);

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
      vworldMap.setView(position, vworldParcelDetailZoom);
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

  async function initAerialMapConnected() {
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
      vworldCadastralLayer = null;
      vworldLotNumberLayer = null;
      vworldLabelRequestId += 1;
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

    mapNode.classList.remove("is-hidden");
    emptyState.hidden = true;

    vworldMap = window.L.map(mapNode, {
      zoomControl: true,
      maxZoom: vworldMapMaxZoom,
    }).setView([36.4, 127.8], 7);
    vworldMap.on("click", handleVworldMapClick);
    vworldMap.on("zoomend", syncVworldLotNumberLayerVisibility);

    setVworldLayer("satellite");
    setVworldCadastralLayer();
    bindVworldTools();

    const savedState = getParcelState();

    if (Number.isFinite(savedState.latitude) && Number.isFinite(savedState.longitude)) {
      moveVworldToResult(savedState);
      return;
    }

    if (!parcelAddress) {
      status.textContent = "주소 또는 명칭을 검색한 뒤 결과를 선택해 주세요.";
      return;
    }

    status.textContent = `"${parcelAddress}" 위치를 확인하는 중입니다.`;

    try {
      const point = await resolveParcelAddress();

      if (point) {
        moveVworldToResult(point);
        return;
      }

      status.textContent = `"${parcelAddress}" 검색 결과를 찾지 못했습니다.`;
    } catch (error) {
      status.textContent = "V-World 검색 API를 불러오지 못했습니다. API 키와 네트워크 상태를 확인해 주세요.";
    }
  }

  function setActivePortal(portalKey) {
    const portal = portalData[portalKey];
    activePortalKey = portalKey;
    const { view, isNew } = ensurePortalView(portalKey);

    portalTabs.forEach((button) => {
      const isActive = button.dataset.portal === portalKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    portalViews.forEach((portalView, key) => {
      portalView.hidden = key !== portalKey;
    });

    refreshIcons();

    if (portal.type === "aerial") {
      if (isNew || !view.dataset.aerialInitialized) {
        bindAerialSearchFormConnected();
        view.dataset.aerialInitialized = "true";
        window.requestAnimationFrame(() => initAerialMapConnected());
      } else {
        const state = getParcelState();

        if (vworldMap) {
          window.requestAnimationFrame(() => vworldMap.invalidateSize());

          if (Number.isFinite(state.latitude) && Number.isFinite(state.longitude)) {
            moveVworldToResult(state);
          }
        }
      }
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

  if (parcelProvince) {
    parcelProvince.value = readStoredValue(parcelProvinceStorageKey) || "전북특별자치도";
    parcelProvince.addEventListener("change", () => {
      saveParcelRegion();
      updateParcelStatus("선택한 시도 기준으로 다음 주소 검색을 진행합니다.");
    });
  }

  if (parcelCity) {
    parcelCity.value = readStoredValue(parcelCityStorageKey);
    parcelCity.addEventListener("change", () => {
      saveParcelRegion();
      updateParcelStatus(parcelCity.value ? `${getParcelProvince()} ${parcelCity.value} 기준으로 다음 주소 검색을 진행합니다.` : "시군 기준을 해제했습니다.");
    });
  }

  if (parcelForm) {
    parcelForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveParcelRegion();
      const originalAddress = getParcelAddress();
      const address = buildContextualParcelAddress(originalAddress);
      saveParcelAddress(address);

      if (!address) {
        updateParcelStatus("주소를 입력해 주세요.");
        return;
      }

      updateParcelStatus(
        originalAddress && originalAddress !== address ? `"${originalAddress}"을 "${address}" 기준으로 확인하는 중입니다.` : `"${address}" 주소를 확인하는 중입니다.`
      );

      try {
        const state = await resolveParcelAddress();

        if (state?.pnu || (Number.isFinite(state?.latitude) && Number.isFinite(state?.longitude))) {
          updateParcelStatus(`${state.title || address} 기준으로 토지이음·토지이음지도·항공사진을 연결했습니다.`);
        } else {
          updateParcelStatus(`"${address}" 검색 결과를 찾지 못했습니다. 지번이나 도로명을 더 정확히 입력해 주세요.`);
        }

        setActivePortal(activePortalKey);
      } catch (error) {
        updateParcelStatus("주소 검색 API를 불러오지 못했습니다. 네트워크 상태와 API 키를 확인해 주세요.");
      }
    });
  }

  async function copyParcelAddress() {
    const address = getParcelAddress();

    if (!address) {
      updateParcelStatus("복사할 주소가 없습니다. 먼저 주소를 검색해 주세요.");
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = address;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      updateParcelStatus(`"${address}" 주소를 복사했습니다.`);
      return true;
    } catch (error) {
      updateParcelStatus("브라우저 보안 설정으로 자동 복사가 제한되었습니다. 화면의 주소를 직접 복사해 주세요.");
      return false;
    }
  }

  portalPanel.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-realestate-copy]");
    const openButton = event.target.closest("[data-realestate-open]");

    if (copyButton) {
      copyParcelAddress();
      return;
    }

    if (openButton) {
      const openedWindow = window.open(getRealEstateUrl(), "_blank");
      copyParcelAddress();

      if (!openedWindow) {
        updateParcelStatus("팝업 차단으로 KRAS 공식 사이트를 열 수 없습니다. 브라우저의 팝업 허용을 확인해 주세요.");
      } else {
        openedWindow.opener = null;
      }
    }
  });

  portalTabs.forEach((button) => {
    button.addEventListener("click", () => setActivePortal(button.dataset.portal));
  });

  const initialPortal = initialParams.get("portal");
  setActivePortal(selectedLaw ? "law" : portalData[initialPortal] ? initialPortal : "eum");
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

function setScopedContentTab(scope, tabKey) {
  const buttons = [...scope.querySelectorAll("[data-content-tab]")];
  const panels = [...scope.querySelectorAll("[data-content-panel]")];

  if (!buttons.length || !panels.length) {
    return;
  }

  const nextKey = tabKey || buttons[0].dataset.contentTab;
  scope.dataset.activeContentTab = nextKey;
  scope.classList.remove("is-searching");

  buttons.forEach((button) => {
    const isActive = button.dataset.contentTab === nextKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.contentPanel === nextKey;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function initContentTabs() {
  document.querySelectorAll("[data-content-scope]").forEach((scope) => {
    const buttons = [...scope.querySelectorAll("[data-content-tab]")];

    if (!buttons.length) {
      return;
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        scope.querySelectorAll("[data-search-item]").forEach((item) => {
          item.hidden = false;
        });
        setScopedContentTab(scope, button.dataset.contentTab);

        const status = scope.querySelector("[data-page-search-status]");
        const input = scope.querySelector("[data-page-search-input]");

        if (input) {
          input.value = "";
        }

        if (status) {
          status.textContent = "검색어를 입력하면 문구를 바로 찾습니다.";
        }
      });
    });

    const initialKey = buttons.find((button) => button.classList.contains("is-active"))?.dataset.contentTab || buttons[0].dataset.contentTab;
    setScopedContentTab(scope, initialKey);
  });
}

function initManualDocumentTabs() {
  document.querySelectorAll("[data-manual-document-tabs]").forEach((tablist) => {
    const container = tablist.closest(".manual-step-card") || document;
    const buttons = [...tablist.querySelectorAll("[data-manual-document-tab]")];
    const panels = [...container.querySelectorAll("[data-manual-document-panel]")];

    if (!buttons.length || !panels.length) {
      return;
    }

    function setActiveDocument(documentKey) {
      buttons.forEach((button) => {
        const isActive = button.dataset.manualDocumentTab === documentKey;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.manualDocumentPanel === documentKey;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
      });
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => setActiveDocument(button.dataset.manualDocumentTab));
    });

    const initialKey = buttons.find((button) => button.classList.contains("is-active"))?.dataset.manualDocumentTab || buttons[0].dataset.manualDocumentTab;
    setActiveDocument(initialKey);
  });
}

const buanVillageMap = {
  "부안읍": ["동중리", "서외리", "선은리", "봉덕리", "연곡리", "신흥리", "내요리", "모산리", "행중리", "신운리"],
  "주산면": ["갈촌리", "돈계리", "덕림리", "백석리", "사산리", "소산리", "소주리", "주산리"],
  "동진면": ["당상리", "동전리", "본덕리", "봉황리", "안성리", "장등리", "증산리", "하장리"],
  "행안면": ["대초리", "삼간리", "신기리", "역리", "진동리"],
  "계화면": ["계화리", "궁안리", "양산리", "의복리", "창북리"],
  "보안면": ["남포리", "상림리", "신복리", "영전리", "우동리", "월천리", "유천리", "하입석리"],
  "변산면": ["격포리", "대항리", "도청리", "마포리", "운산리", "중계리", "지서리"],
  "진서면": ["곰소리", "석포리", "운호리", "진서리"],
  "백산면": ["금판리", "대수리", "덕신리", "신평리", "오곡리", "용계리", "원천리", "평교리", "하청리"],
  "상서면": ["가오리", "감교리", "고잔리", "용서리", "장동리", "청림리", "통정리"],
  "하서면": ["백련리", "석상리", "언독리", "장신리", "청호리"],
  "줄포면": ["난산리", "대동리", "신리", "우포리", "장동리", "줄포리", "파산리"],
  "위도면": ["대리", "식도리", "정금리", "진리", "치도리"],
};

const landCategoryOptions = ["전", "답", "대", "임야", "도로", "구거", "하천", "잡종지", "과수원", "목장용지", "공장용지", "학교용지", "주차장", "주유소용지", "창고용지", "공원", "체육용지", "종교용지", "묘지"];

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function initEraConverters() {
  document.querySelectorAll("[data-era-converter]").forEach((converter) => {
    const typeSelect = converter.querySelector("[data-era-type]");
    const yearInput = converter.querySelector("[data-era-year]");
    const output = converter.querySelector("[data-era-output]");
    const note = converter.querySelector("[data-era-note]");

    if (!typeSelect || !yearInput || !output || !note) {
      return;
    }

    const eraData = {
      taisho: { label: "대정", start: 1911, min: 1, max: 15 },
      showa: { label: "소화", start: 1925, min: 1, max: 64 },
      dangi: { label: "단기", start: -2333, min: 2334, max: 9999 },
    };

    function updateConverter() {
      const era = eraData[typeSelect.value] || eraData.taisho;
      const inputYear = Number(yearInput.value);

      if (!yearInput.value || !Number.isFinite(inputYear)) {
        output.textContent = "연도를 입력하세요";
        note.textContent = `${era.label} 연도를 입력하면 서기 연도를 계산합니다.`;
        return;
      }

      const gregorianYear = typeSelect.value === "dangi" ? inputYear - 2333 : inputYear + era.start;
      output.textContent = `${gregorianYear.toLocaleString("ko-KR")}년`;

      if (inputYear < era.min || inputYear > era.max) {
        note.textContent = `${era.label} ${inputYear.toLocaleString("ko-KR")}년은 일반적인 사용 범위 밖입니다. 계산값만 참고하세요.`;
      } else if (typeSelect.value === "dangi") {
        note.textContent = `단기 ${inputYear.toLocaleString("ko-KR")}년은 서기 ${gregorianYear.toLocaleString("ko-KR")}년입니다.`;
      } else {
        note.textContent = `${era.label} ${inputYear.toLocaleString("ko-KR")}년은 서기 ${gregorianYear.toLocaleString("ko-KR")}년입니다.`;
      }
    }

    typeSelect.addEventListener("change", updateConverter);
    yearInput.addEventListener("input", updateConverter);
    updateConverter();
  });
}

function initJeongdanCalculator() {
  document.querySelectorAll("[data-jeongdan-calculator]").forEach((calculator) => {
    const inputs = [...calculator.querySelectorAll("[data-jeongdan-field]")];
    const pyeongOutput = calculator.querySelector('[data-jeongdan-output="pyeong"]');
    const sqmOutput = calculator.querySelector('[data-jeongdan-output="sqm"]');

    if (!inputs.length || !pyeongOutput || !sqmOutput) {
      return;
    }

    function readField(name) {
      const input = calculator.querySelector(`[data-jeongdan-field="${name}"]`);
      return Number(input?.value) || 0;
    }

    function updateCalculator() {
      const pyeong = readField("jeong") * 3000 + readField("dan") * 300 + readField("mu") * 30 + readField("bo");
      const squareMeters = pyeong / 0.3025;

      pyeongOutput.textContent = formatNumber(pyeong, Number.isInteger(pyeong) ? 0 : 1) || "0";
      sqmOutput.textContent = formatNumber(squareMeters, 1) || "0.0";
    }

    inputs.forEach((input) => {
      input.addEventListener("input", updateCalculator);
    });

    updateCalculator();
  });
}

function initAreaUnitConverters() {
  document.querySelectorAll("[data-area-unit-converter]").forEach((converter) => {
    const sqmInput = converter.querySelector("[data-area-unit-sqm]");
    const pyeongInput = converter.querySelector("[data-area-unit-pyeong]");
    const note = converter.querySelector("[data-area-unit-note]");

    if (!sqmInput || !pyeongInput || !note) {
      return;
    }

    function updateFromSquareMeters() {
      const squareMeters = Number(sqmInput.value);

      if (!sqmInput.value || !Number.isFinite(squareMeters)) {
        pyeongInput.value = "";
        note.textContent = "값을 입력하면 자동 계산됩니다.";
        return;
      }

      const pyeong = squareMeters * 0.3025;
      pyeongInput.value = pyeong.toFixed(2);
      note.textContent = `${formatNumber(squareMeters, 2)}㎡ = ${formatNumber(pyeong, 2)}평`;
    }

    function updateFromPyeong() {
      const pyeong = Number(pyeongInput.value);

      if (!pyeongInput.value || !Number.isFinite(pyeong)) {
        sqmInput.value = "";
        note.textContent = "값을 입력하면 자동 계산됩니다.";
        return;
      }

      const squareMeters = pyeong / 0.3025;
      sqmInput.value = squareMeters.toFixed(2);
      note.textContent = `${formatNumber(pyeong, 2)}평 = ${formatNumber(squareMeters, 2)}㎡`;
    }

    sqmInput.addEventListener("input", updateFromSquareMeters);
    pyeongInput.addEventListener("input", updateFromPyeong);
  });
}

function initAreaChangeBuilders() {
  document.querySelectorAll("[data-area-change-builder]").forEach((builder) => {
    const rows = builder.querySelector("[data-area-rows]");
    const addButton = builder.querySelector("[data-area-row-add]");

    if (!rows) {
      return;
    }

    function fillSelect(select, options, placeholder) {
      const currentValue = select.value;
      select.replaceChildren(
        new Option(placeholder, ""),
        ...options.map((option) => new Option(option, option))
      );

      if (options.includes(currentValue)) {
        select.value = currentValue;
      }
    }

    function setupVillageSelect(row) {
      const townSelect = row.querySelector('[data-area-field="town"]');
      const villageSelect = row.querySelector('[data-area-field="village"]');

      if (!townSelect || !villageSelect) {
        return;
      }

      const villages = buanVillageMap[townSelect.value] || [];
      fillSelect(villageSelect, villages, townSelect.value ? "동리 선택" : "읍면 먼저 선택");
    }

    function setupRow(row) {
      const townSelect = row.querySelector('[data-area-field="town"]');
      const landCategorySelect = row.querySelector('[data-area-field="landCategory"]');

      if (townSelect && townSelect.options.length <= 1) {
        fillSelect(townSelect, Object.keys(buanVillageMap), "읍면 선택");
      }

      if (landCategorySelect && landCategorySelect.options.length <= 1) {
        fillSelect(landCategorySelect, landCategoryOptions, "지목 선택");
      }

      setupVillageSelect(row);
      updateAreaRow(row);
    }

    function updateAreaRow(row) {
      const ledgerInput = row.querySelector('[data-area-field="ledgerArea"]');
      const computedInput = row.querySelector('[data-area-field="computedArea"]');
      const ledgerArea = Number(ledgerInput?.value);
      const computedArea = Number(computedInput?.value);
      const toleranceOutput = row.querySelector('[data-area-output="tolerance"]');
      const errorOutput = row.querySelector('[data-area-output="error"]');

      if (toleranceOutput) {
        const tolerance = ledgerInput?.value && Number.isFinite(ledgerArea) && ledgerArea > 0 ? 0.026 * 0.026 * 1200 * Math.sqrt(ledgerArea) : 0;
        toleranceOutput.textContent = formatNumber(tolerance, 1) || "0.0";
      }

      if (errorOutput) {
        const error = ledgerInput?.value && computedInput?.value && Number.isFinite(ledgerArea) && Number.isFinite(computedArea) ? computedArea - ledgerArea : 0;
        errorOutput.textContent = formatNumber(error, 1) || "0.0";
      }
    }

    function resetRow(row) {
      row.querySelectorAll("input, textarea").forEach((field) => {
        field.value = "";
      });
      row.querySelectorAll("select").forEach((field) => {
        field.value = "";
      });
      setupVillageSelect(row);
      updateAreaRow(row);
    }

    rows.querySelectorAll("tr").forEach(setupRow);

    rows.addEventListener("input", (event) => {
      const row = event.target.closest("tr");

      if (row) {
        updateAreaRow(row);
      }
    });

    rows.addEventListener("change", (event) => {
      const row = event.target.closest("tr");

      if (!row) {
        return;
      }

      if (event.target.matches('[data-area-field="town"]')) {
        setupVillageSelect(row);
      }

      updateAreaRow(row);
    });

    rows.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-area-row-remove]");

      if (!removeButton) {
        return;
      }

      const row = removeButton.closest("tr");

      if (!row) {
        return;
      }

      if (rows.querySelectorAll("tr").length === 1) {
        resetRow(row);
      } else {
        row.remove();
      }
    });

    if (addButton) {
      addButton.addEventListener("click", () => {
        const sourceRow = rows.querySelector("tr");

        if (!sourceRow) {
          return;
        }

        const nextRow = sourceRow.cloneNode(true);
        rows.append(nextRow);
        resetRow(nextRow);
      });
    }
  });
}

function initPageSearch() {
  const forms = document.querySelectorAll("[data-page-search]");

  forms.forEach((form) => {
    const input = form.querySelector("[data-page-search-input]");
    const status = form.querySelector("[data-page-search-status]");
    const scope = form.closest("[data-content-scope]") || document;
    const items = [...scope.querySelectorAll("[data-search-item]")];
    const panels = [...scope.querySelectorAll("[data-content-panel]")];

    if (!input || !items.length) {
      return;
    }

    const normalize = (value) => String(value || "").trim().toLowerCase();

    function applySearch() {
      const query = normalize(input.value);
      let visibleCount = 0;

      items.forEach((item) => {
        const matches = !query || normalize(item.textContent).includes(query);
        item.hidden = !matches;

        if (matches) {
          visibleCount += 1;
        }
      });

      if (panels.length) {
        if (query) {
          scope.classList.add("is-searching");
          panels.forEach((panel) => {
            const hasMatch = [...panel.querySelectorAll("[data-search-item]")].some((item) => !item.hidden);
            panel.hidden = !hasMatch;
            panel.classList.toggle("is-active", hasMatch);
          });
          scope.querySelectorAll("[data-content-tab]").forEach((button) => {
            button.classList.remove("is-active");
            button.setAttribute("aria-selected", "false");
          });
        } else {
          items.forEach((item) => {
            item.hidden = false;
          });
          setScopedContentTab(scope, scope.dataset.activeContentTab);
        }
      }

      if (status) {
        status.textContent = query ? `${visibleCount}건을 찾았습니다.` : "검색어를 입력하면 문구를 바로 찾습니다.";
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      applySearch();
    });

    input.addEventListener("input", applySearch);
  });
}

initPortalTabs();
initProcessSteps();
initReadinessChecklist();
initGuidePages();
initGuidePrintButtons();
initContentTabs();
initManualDocumentTabs();
initEraConverters();
initJeongdanCalculator();
initAreaUnitConverters();
initAreaChangeBuilders();
initPageSearch();
refreshIcons();
