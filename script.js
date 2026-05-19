const portalData = {
  eum: {
    eyebrow: "토지이용계획 확인",
    title: "토지이음",
    icon: "layers",
    url: "https://www.eum.go.kr/web/am/amMain.jsp",
    button: "토지이음 열기",
    copy: "대상 필지의 토지이용계획, 용도지역·지구, 행위제한, 도시계획시설 여부를 확인합니다.",
    checks: ["지번 기반 토지이용계획 열람", "용도지역, 용도지구, 구역 지정 여부", "허가 가능성에 영향을 주는 행위제한"],
    points: ["허가부서 상담 전 기초 규제 확인", "다음지도 현황 검토와 비교", "법령정보에서 근거 조항 확인"],
  },
  map: {
    eyebrow: "위성지도와 현장 여건",
    title: "다음지도",
    icon: "satellite",
    url: "https://map.kakao.com/",
    button: "다음지도 열기",
    copy: "스카이뷰와 로드뷰를 활용해 대상 토지의 접근성, 주변 이용 상태, 도로 접합 조건을 살핍니다.",
    checks: ["스카이뷰로 필지 주변 현황 확인", "로드뷰로 진입도로와 현장 접근성 확인", "지목과 실제 이용 상태의 차이 검토"],
    points: ["지적측량 전 현장 확인 포인트 정리", "허가부서 상담 시 도로·배수 이슈 설명", "토지이음 규제 정보와 실제 현황 비교"],
  },
  law: {
    eyebrow: "법령과 조례 근거",
    title: "법령정보",
    icon: "scale",
    url: "https://www.law.go.kr/main.html",
    button: "법령정보 열기",
    copy: "국가법령정보센터에서 허가, 지적측량, 토지이동, 등기촉탁과 관련된 법령 근거를 확인합니다.",
    checks: ["개발행위허가 관련 법령 검색", "지적공부 정리와 토지이동 관련 규정 확인", "지자체 조례와 별도 기준 검토"],
    points: ["민원 보완 요청의 근거 조항 확인", "상담 설명의 신뢰도 보강", "허가 조건과 후속 절차의 법적 기준 정리"],
  },
};

const processSteps = {
  consult: {
    number: "01",
    owner: "관할 허가부서",
    title: "허가부서와 사전 상담",
    summary:
      "토지의 이용 목적, 분할 또는 형질변경 필요성, 개발행위허가 대상 여부를 관할 부서와 먼저 확인합니다.",
    checks: [
      "토지이음에서 확인한 용도지역·지구와 행위제한",
      "다음지도 위성 화면으로 본 진입로와 주변 이용 상태",
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
    title: "준비자료 확인 전",
    copy: "지번과 목적이 먼저 정리되면 토지이음, 지도, 법령 검토를 빠르게 연결할 수 있습니다.",
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

function createList(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function initPortalTabs() {
  const portalTabs = document.querySelectorAll(".portal-tab");
  const portalPanel = document.querySelector("[data-portal-panel]");

  if (!portalTabs.length || !portalPanel) {
    return;
  }

  function setActivePortal(portalKey) {
    const portal = portalData[portalKey];

    portalTabs.forEach((button) => {
      const isActive = button.dataset.portal === portalKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    portalPanel.innerHTML = `
      <div class="portal-panel__main">
        <div class="portal-panel__top">
          <span class="portal-panel__icon" aria-hidden="true">
            <i data-lucide="${portal.icon}"></i>
          </span>
          <div>
            <p class="eyebrow">${portal.eyebrow}</p>
            <h2>${portal.title}</h2>
          </div>
        </div>
        <p class="portal-panel__copy">${portal.copy}</p>
        <a class="button button--primary portal-panel__button" href="${portal.url}" target="_blank" rel="noopener">
          <i data-lucide="external-link"></i>
          ${portal.button}
        </a>
      </div>
      <div class="portal-panel__details">
        <div>
          <h3>확인할 내용</h3>
          <ul>${createList(portal.checks)}</ul>
        </div>
        <div>
          <h3>상담 연결 포인트</h3>
          <ul>${createList(portal.points)}</ul>
        </div>
      </div>
    `;

    refreshIcons();
  }

  portalTabs.forEach((button) => {
    button.addEventListener("click", () => setActivePortal(button.dataset.portal));
  });

  setActivePortal("eum");
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

initPortalTabs();
initProcessSteps();
initReadinessChecklist();
refreshIcons();
