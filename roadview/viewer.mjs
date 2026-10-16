// Each native panorama runs in its own document: the provider has global queues.
const params = new URLSearchParams(location.search);
const index = Number(params.get('index'));
const bridge = window.parent !== window && window.parent.roadviewBridge;
let viewer;
let frame;
let previous = 0;
let captureTarget = null;
let loadedCapture = null;
let captureTimer;
let compare;
let showingCapture = null;

function captureComplete() {
  if (!captureTarget || viewer.getPanoId() !== captureTarget.anchorId) return;
  const isCurrent = captureTarget.panoId === captureTarget.anchorId;
  if (isCurrent ? compare.isActive() : (!compare.isActive() || compare.getPanoId() !== captureTarget.panoId)) return;
  if (!isCurrent) {
    if (compare.getRatio() < 0.99) return;
    compare.setRatio(1);
  }
  loadedCapture = { ...captureTarget };
  showingCapture = null;
  clearTimeout(captureTimer);
  bridge.captureChanged(index, loadedCapture);
}

function applyCapture() {
  clearTimeout(captureTimer);
  if (!captureTarget || viewer.getPanoId() !== captureTarget.anchorId) return;
  const isCurrent = captureTarget.panoId === captureTarget.anchorId;
  if (isCurrent) {
    if (compare.isActive()) { if (showingCapture !== 'hide') { showingCapture = 'hide'; compare.hide(); } }
    else { captureComplete(); return; }
  } else if (compare.isActive() && compare.getPanoId() === captureTarget.panoId && compare.getRatio() >= 0.99) {
    captureComplete(); return;
  } else if (viewer.isIdle() && showingCapture !== captureTarget.panoId) {
    showingCapture = captureTarget.panoId;
    compare.show(captureTarget.panoId);
  }
  captureTimer = setTimeout(applyCapture, 150);
}

function loadProvider() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('카카오 로드뷰 서버 연결 시간이 초과되었습니다.')), 18000);
    script.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/prod/panorama.js';
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('카카오 로드뷰 뷰어를 불러오지 못했습니다.')); };
    document.head.append(script);
  });
}

function render(time) {
  if (!document.hidden && time - previous >= 30 && (bridge.isVisible(index) || (captureTarget && !loadedCapture))) {
    previous = time;
    try { window.mvp.render(viewer, time); }
    catch (error) { bridge.fail(index, '이 화면의 로드뷰를 표시하지 못했습니다. 다시 불러와 주세요.'); console.error('Roadview render:', error); return; }
  }
  frame = requestAnimationFrame(render);
}

async function start() {
  if (!bridge || !Number.isInteger(index) || index < 0 || index > 3) return;
  await loadProvider();
  if (!window.mvp?.supportWebGL()) throw new Error('WebGL을 사용할 수 없습니다. 다른 브라우저나 그래픽 가속 설정을 확인해 주세요.');
  viewer = new window.mvp.Panorama(document.querySelector('#panorama'), {
    pan: Number(params.get('pan')) || 0, tilt: Number(params.get('tilt')) || 0,
    zoom: Number(params.get('zoom')) || 0, serviceName: 'Roadview', _keyEvent: false,
  });
  const nativeRelease = viewer.release.bind(viewer);
  viewer.release = () => {
    loadedCapture = null; captureTarget = null; showingCapture = null;
    clearTimeout(captureTimer);
    nativeRelease();
  };
  viewer.getCaptureData = () => loadedCapture && loadedCapture.anchorId === viewer.getPanoId() ? loadedCapture : null;
  viewer.setCapture = (capture) => {
    const target = capture ? { ...capture, anchorId: viewer.getPanoId() } : null;
    if (target && captureTarget?.anchorId === target.anchorId && captureTarget?.panoId === target.panoId && loadedCapture) return;
    captureTarget = target;
    loadedCapture = null;
    showingCapture = null;
    clearTimeout(captureTimer);
    if (target) applyCapture();
  };
  bridge.register(index, viewer);
  viewer.on('init', () => {
    compare = viewer.getPastCompareView();
    compare.on('show', () => { compare.setRatio(1); captureComplete(); });
    compare.on('past_changed', () => { if (compare.isActive() && compare.getRatio() >= 0.99) { compare.setRatio(1); captureComplete(); } });
    compare.on('hide', captureComplete);
    compare.on('past_empty', () => { loadedCapture = null; bridge.fail(index, '이 위치에는 선택한 시기의 로드뷰가 없습니다. 다른 촬영일을 선택해 주세요.'); });
    bridge.initialized(index);
  });
  document.addEventListener('pointerdown', () => bridge.activate(index), { capture: true });
  document.addEventListener('wheel', () => bridge.activate(index), { capture: true, passive: true });
  document.addEventListener('keydown', (event) => { if (bridge.key(index, event.key)) event.preventDefault(); });
  window.addEventListener('resize', () => viewer.relayout());
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); clearTimeout(captureTimer); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) frame = requestAnimationFrame(render); });
  frame = requestAnimationFrame(render);
}
start().catch((error) => { bridge?.fail(index, error.message); console.error('Roadview frame:', error); });
