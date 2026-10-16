import { wgs84ToWcongnamul, wcongnamulToWgs84, parseLocation, buildLocationUrl } from './geo.mjs';
import { createSyncController } from './sync.mjs';
import { mountAddressSearch } from './address-search.mjs?v=address-inline-1';
import { captureList, chooseCaptures, captureLabel, readCaptureDates } from './captures.mjs';

const $ = (selector) => document.querySelector(selector);
const cards = [...document.querySelectorAll('.view-card')];
const ORIGINAL = { ...wcongnamulToWgs84({ x: 609530, y: 864261 }), pan: 7.9, tilt: 10.5, zoom: 0 };
const offsets = [0, 0, 0, 0];
let availableCaptures = [];
let selectedCaptures = [];
let preferredDates = readCaptureDates(location.search);
let captureLocationId = null;
const entries = [];
let controller;
let addressSearch;
let currentLocation = null;
let currentLocationPanoId = null;
let searchVersion = 0;
let searching = false;
let urlTimer;
let toastTimer;
let latestRequested = ORIGINAL;
let initialError = '';
let initial;
try { initial = parseLocation(location.search, ORIGINAL); }
catch (error) { initialError = error.message; initial = { ...ORIGINAL }; }

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function notice(message) {
  $('#notice-text').textContent = message;
  $('#notice').hidden = false;
}

function setInputs(position) {
  $('#lat').value = position.lat.toFixed(7);
  $('#lng').value = position.lng.toFixed(7);
}

function setFieldError(message = '') {
  $('#coordinate-error').textContent = message;
  $('#coordinate-error').hidden = !message;
  for (const id of ['lat', 'lng']) {
    if (message) $(`#${id}`).setAttribute('aria-invalid', 'true');
    else $(`#${id}`).removeAttribute('aria-invalid');
  }
}

function setBusy(value) {
  searching = value;
  addressSearch?.refresh();
  $('#go').disabled = value;
  $('#go').firstChild.textContent = value ? '주변 로드뷰 찾는 중 ' : '이 위치로 이동 ';
  updateStatus();
}

function updateStatus() {
  const id = controller?.state.panoId;
  const visible = cards.map((card, i) => ({ card, i })).filter(({ card }) => card.getClientRects().length);
  let matched = 0;
  let expected = 0;
  for (const { card, i } of visible) {
    const entry = entries[i];
    const target = selectedCaptures[i];
    if (target) expected++;
    if (!entry?.ready || !target) continue;
    const actual = entry.viewer.getCaptureData();
    card.dataset.panoid = actual?.panoId || '';
    card.dataset.date = actual?.date || '';
    if (actual && actual.anchorId === id && actual.panoId === target.panoId && !entry.failed && !entry.contextLost) {
      matched++;
      card.classList.remove('is-loading', 'is-error', 'is-empty');
      clearTimeout(entry.loadTimer);
      card.querySelector('.direction-tag').textContent = `${captureLabel(actual.date)} 촬영 · 같은 방향`;
    }
  }
  const complete = !searching && id && expected > 0 && matched === expected;
  const failed = entries.some((e) => e.failed);
  $('#connection').classList.toggle('connected', Boolean(complete));
  $('#connection').classList.toggle('error', failed);
  $('#connection-text').textContent = searching ? '주변 로드뷰 찾는 중' : failed ? '일부 화면 연결 실패' : complete ? `${matched}개 시기 비교 중` : id ? `촬영 영상 연결 중 (${matched}/${expected || visible.length})` : '로드뷰 연결 중';
  document.body.dataset.syncState = complete ? 'connected' : failed ? 'error' : 'loading';
}

function renderCaptureChoices() {
  const last = Math.max(1, selectedCaptures.findLastIndex(Boolean));
  cards.forEach((card, i) => card.classList.toggle('is-second', i === last));
  cards.forEach((card, i) => {
    const select = card.querySelector('.capture-select');
    select.replaceChildren();
    const empty = new Option('비교할 촬영일 선택', '');
    empty.disabled = true;
    select.add(empty);
    availableCaptures.forEach((item) => {
      const option = new Option(captureLabel(item.date) + (item === availableCaptures[0] ? ' · 최신' : ''), String(item.panoId));
      option.disabled = selectedCaptures.some((selected, other) => other !== i && selected?.panoId === item.panoId);
      select.add(option);
    });
    select.value = selectedCaptures[i] ? String(selectedCaptures[i].panoId) : '';
    select.disabled = !availableCaptures.length;
    card.querySelector('.direction-tag').textContent = selectedCaptures[i] ? `${captureLabel(selectedCaptures[i].date)} 촬영 · 같은 방향` : '촬영 기록 없음';
    if (!selectedCaptures[i]) {
      clearTimeout(entries[i]?.loadTimer);
      card.classList.remove('is-error', 'is-empty');
      card.classList.add('is-loading', 'is-empty');
      card.querySelector('.loading-text').textContent = availableCaptures.length < cards.length ? `이 위치에는 ${availableCaptures.length}개의 촬영 기록이 있습니다. 비교할 다른 촬영일이 없습니다.` : '위에서 비교할 촬영일을 선택해 주세요.';
      card.querySelector('.retry').hidden = true;
      entries[i]?.viewer?.setCapture(null);
    } else card.classList.remove('is-empty');
  });
}

function applyCapture(index) {
  const entry = entries[index];
  const target = selectedCaptures[index];
  if (!target || !entry?.ready || entry.viewer.getPanoId() !== controller.state.panoId) return;
  const actual = entry.viewer.getCaptureData();
  if (actual?.panoId === target.panoId && actual.anchorId === controller.state.panoId) return;
  panelLoading(index);
  entry.viewer.setCapture(target);
}

function panelLoading(index, target = controller?.state.panoId) {
  const entry = entries[index];
  const card = cards[index];
  entry.failed = false;
  if (entry.loadingPanoId !== target) entry.retryAttempts = 0;
  entry.loadingPanoId = target;
  card.classList.remove('is-error', 'is-empty');
  card.classList.add('is-loading');
  card.querySelector('.loading-text').textContent = '선택한 촬영 시기를 불러오는 중';
  card.querySelector('.retry').hidden = true;
  clearTimeout(entry.loadTimer);
  entry.loadTimer = setTimeout(() => recoverPanel(index, '로드뷰를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.'), 20000);
}

function recoverPanel(index, message) {
  const entry = entries[index];
  const target = controller?.state.panoId;
  if (!entry?.ready || entry.contextLost || !target || (entry.retryAttempts || 0) >= 2) {
    panelError(index, message);
    return;
  }
  entry.retryAttempts = (entry.retryAttempts || 0) + 1;
  clearTimeout(entry.loadTimer);
  cards[index].classList.add('is-loading');
  cards[index].querySelector('.loading-text').textContent = '응답이 늦어 다시 연결하고 있습니다';
  entry.loadTimer = setTimeout(() => {
    if (target !== controller.state.panoId) return;
    panelLoading(index, target);
    entry.viewer.release();
    entry.viewer.setPanoId(target);
  }, 800);
}

function panelError(index, message) {
  const entry = entries[index];
  if (entry) { entry.failed = true; clearTimeout(entry.loadTimer); }
  const card = cards[index];
  card.classList.add('is-loading', 'is-error');
  card.querySelector('.loading-text').textContent = message;
  card.querySelector('.retry').hidden = false;
  updateStatus();
}

function updateAngles() {
  if (!controller) return;
  for (const [i, entry] of entries.entries()) {
    const vp = entry.ready && entry.viewer.getPanoId() ? entry.viewer.getViewpoint() : { pan: controller.state.viewpoint.pan + offsets[i] };
    const angle = ((Math.round(vp.pan) % 360) + 360) % 360;
    cards[i].querySelector('.angle-badge').textContent = `${String(angle).padStart(3, '0')}°`;
    cards[i].dataset.pan = String(angle);
  }
  const base = ((Math.round(controller.state.viewpoint.pan) % 360) + 360) % 360;
  $('#heading-value').textContent = `${String(base).padStart(3, '0')}°`;
  $('#compass-needle').style.transform = `rotate(${base}deg)`;
}

function currentShareUrl() {
  if (!currentLocation || !controller) return location.href;
  const vp = controller.state.viewpoint;
  const url = new URL(buildLocationUrl(location.href, { ...currentLocation, pan: Math.round(((vp.pan % 360) + 360) % 360 * 100) / 100, tilt: Math.round(vp.tilt * 100) / 100, zoom: Math.max(-3, Math.min(3, Math.round(vp.zoom))), panoid: null }));
  url.searchParams.set('dates', selectedCaptures.map((item) => item?.date || '').join(','));
  return url.href;
}

function updateUrl(immediate = false) {
  clearTimeout(urlTimer);
  const update = () => {
    if (!currentLocation || searching || initialError || currentLocationPanoId !== controller.state.panoId) return;
    history.replaceState(null, '', currentShareUrl());
  };
  if (immediate) update();
  else urlTimer = setTimeout(update, 180);
}

function onPosition(index, data) {
  if (!data?.position) return;
  const locationChanged = currentLocationPanoId !== data.panoId;
  currentLocationPanoId = data.panoId;
  currentLocation = wcongnamulToWgs84(data.position);
  $('#place-name').textContent = data.address || '선택한 로드뷰 위치';
  if (captureLocationId !== data.panoId) {
    captureLocationId = data.panoId;
    availableCaptures = captureList(data);
    selectedCaptures = chooseCaptures(availableCaptures, preferredDates);
    renderCaptureChoices();
    const oldest = availableCaptures.at(-1);
    const latest = availableCaptures[0];
    $('#capture-date').textContent = latest ? `${captureLabel(oldest.date)} — ${captureLabel(latest.date)} · ${availableCaptures.length}개 촬영 기록` : '촬영일 정보 없음';
    if (availableCaptures.length < 4) notice(`이 위치에서 제공하는 촬영 기록은 ${availableCaptures.length}개입니다. 기록이 없는 화면은 비워 둡니다.`);
    for (let i = 0; i < entries.length; i++) if (selectedCaptures[i]) panelLoading(i);
  }
  if (locationChanged) setInputs(currentLocation);
  document.body.dataset.lat = currentLocation.lat.toFixed(7);
  document.body.dataset.lng = currentLocation.lng.toFixed(7);
  for (let i = 0; i < entries.length; i++) applyCapture(i);
  updateAngles();
  updateUrl();
  updateStatus();
}

function nearest(position, radius, version) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('로드뷰 검색 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.')), 12000);
    entries[0].viewer.getNearestPanoId(position.x, position.y, radius, (panoid) => {
      clearTimeout(timeout);
      resolve(version === searchVersion ? panoid : null);
    });
  });
}

async function goTo(request, { push = false, original = false, fromAddress = false } = {}) {
  if (!controller) return { ok: false, error: '로드뷰가 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.' };
  const version = ++searchVersion;
  latestRequested = request;
  initialError = '';
  setFieldError();
  $('#notice').hidden = true;
  setBusy(true);
  try {
    if (request.lat < 32 || request.lat > 40 || request.lng < 123 || request.lng > 133) throw new Error('대한민국 주변의 좌표를 입력해 주세요. 이 위치에는 카카오 로드뷰가 없습니다.');
    const position = wgs84ToWcongnamul(request);
    let panoid = original ? 1170000105 : null;
    if (!original) {
      for (const radius of [80, 250, 500]) {
        panoid = await nearest(position, radius, version);
        if (version !== searchVersion) return;
        if (panoid) break;
      }
    }
    if (!panoid) throw new Error('선택한 위치의 반경 500m 안에 로드뷰가 없습니다. 가까운 도로의 주소나 좌표로 다시 시도해 주세요.');
    if (version !== searchVersion) return;
    if (push) history.pushState(null, '', buildLocationUrl(location.href, { ...request, panoid: null }));
    for (let i = 0; i < entries.length; i++) if (entries[i].viewer.getPanoId() !== panoid) panelLoading(i, panoid);
    controller.moveTo(panoid, { pan: request.pan, tilt: request.tilt, zoom: request.zoom });
    // A lookup can resolve to the current panorama without emitting another event.
    const source = entries.findIndex((entry) => entry.viewer.getPanoId() === panoid);
    if (source >= 0) onPosition(source, entries[source].viewer.getPanoramaData());
    setInputs(currentLocationPanoId === panoid ? currentLocation : request);
    return { ok: true, panoid };
  } catch (error) {
    if (version !== searchVersion) return;
    if (!fromAddress) setFieldError(error.message);
    if (currentLocation) notice(`${error.message} 현재 화면은 이전 위치를 보여줍니다.`);
    else {
      $('#place-name').textContent = '로드뷰를 찾지 못했습니다';
      $('#capture-date').textContent = '좌표를 바꾸거나 다시 시도해 주세요.';
      cards.forEach((_, i) => panelError(i, error.message));
    }
    return { ok: false, error: error.message };
  } finally {
    if (version === searchVersion) { setBusy(false); updateUrl(); }
  }
}

function activate(index) {
  if (!controller) return;
  controller.activate(index);
  cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
}

function relayout() {
  const last = Math.max(1, selectedCaptures.findLastIndex(Boolean));
  cards.forEach((card, i) => card.classList.toggle('is-second', i === last));
  requestAnimationFrame(() => {
    entries.forEach((entry) => { if (entry.ready) entry.viewer.relayout(); });
    updateStatus();
  });
}

async function boot() {
  $('#go').disabled = true;
  const deferred = [];
  const inits = cards.map(() => new Promise((resolve, reject) => deferred.push({ resolve, reject })));
  cards.forEach(() => entries.push({ viewer: null, ready: false, desiredPanoId: null, failed: false }));
  window.roadviewBridge = {
    isVisible: (i) => Boolean(cards[i].getClientRects().length) && !entries[i].contextLost,
    activate,
    key: handleKey,
    captureChanged: () => { updateStatus(); updateUrl(); },
    initialized: (i) => { clearTimeout(entries[i].initTimer); entries[i].ready = true; deferred[i].resolve(); },
    fail: (i, message) => {
      if (!entries[i].ready) { clearTimeout(entries[i].initTimer); deferred[i].reject(new Error(message)); }
      else panelError(i, message);
    },
    register: (i, viewer) => {
      const card = cards[i];
      const entry = entries[i];
      entry.viewer = viewer;
      viewer.on('panoid_changed', () => {
        entry.failed = false;
        entry.retryAttempts = 0;
        controller?.onPosition(i);
        card.dataset.panoid = viewer.getPanoId() || '';
        updateAngles();
        updateStatus();
      });
      viewer.on('viewpoint_changed', () => { controller?.onViewpoint(i); updateAngles(); });
      viewer.on('panoid_empty', () => recoverPanel(i, '이 위치의 로드뷰를 불러오지 못했습니다. 다시 시도해 주세요.'));
      viewer.on('context_lost', () => { entry.contextLost = true; panelError(i, '그래픽 연결이 끊겼습니다. 새로고침하면 다시 연결됩니다.'); });
    },
  };
  cards.forEach((card, i) => {
    entries[i].initTimer = setTimeout(() => deferred[i].reject(new Error('로드뷰 초기화 시간이 초과되었습니다. 다시 불러와 주세요.')), 22000);
    const iframe = document.createElement('iframe');
    iframe.title = `${i + 1}번 촬영 시기 로드뷰`;
    iframe.src = `./viewer.html?${new URLSearchParams({ index: i, pan: initial.pan + offsets[i], tilt: initial.tilt, zoom: initial.zoom })}`;
    card.querySelector('.viewer').append(iframe);
  });
  await Promise.all(inits);
  controller = createSyncController(entries, {
    position: onPosition,
    viewpoint: () => { updateAngles(); updateUrl(); },
    status: updateStatus,
  });
  $('#go').disabled = false;
  if (initialError) notice(`URL 좌표를 읽지 못했습니다: ${initialError} 처음 공유한 위치를 표시합니다.`);
  const hasCoordinates = new URLSearchParams(location.search).has('lat') || new URLSearchParams(location.search).has('lng') || new URLSearchParams(location.search).has('lon');
  const savedError = initialError;
  await goTo(initial, { original: Boolean(savedError) || !hasCoordinates });
  if (savedError) notice(`URL 좌표를 읽지 못했습니다: ${savedError} 처음 공유한 위치를 표시합니다.`);
}

addressSearch = mountAddressSearch({
  isReady: () => Boolean(controller) && !searching,
  onSelect: (address) => goTo({ ...address, ...(controller?.state.viewpoint || ORIGINAL) }, { push: true, fromAddress: true }),
});
setInputs(initial);
function handleKey(i, key) {
  if (key === 'Escape' && $('#view-grid').hasAttribute('data-focus')) {
    delete $('#view-grid').dataset.focus;
    cards.forEach((card) => card.querySelector('.expand').setAttribute('aria-pressed', 'false'));
    relayout();
    return true;
  }
  const entry = entries[i];
  if (!entry?.ready || !entry.viewer.getPanoId()) return false;
  const vp = entry.viewer.getViewpoint();
  if (key === 'ArrowLeft') vp.pan -= 10;
  else if (key === 'ArrowRight') vp.pan += 10;
  else if (key === '+') vp.zoom = Math.min(3, vp.zoom + 1);
  else if (key === '-') vp.zoom = Math.max(-3, vp.zoom - 1);
  else return false;
  activate(i); entry.viewer.setViewpoint(vp);
  return true;
}
$('#location-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const params = new URLSearchParams({ lat: $('#lat').value, lng: $('#lng').value });
    const request = parseLocation(params, { ...ORIGINAL, ...(controller?.state.viewpoint || {}) });
    goTo(request, { push: true });
  } catch (error) { setFieldError(error.message); }
});
for (const id of ['lat', 'lng']) $(`#${id}`).addEventListener('input', () => setFieldError());
$('#notice-close').addEventListener('click', () => { $('#notice').hidden = true; });
$('#reset-heading').addEventListener('click', () => { controller?.resetViewpoint({ pan: ORIGINAL.pan, tilt: ORIGINAL.tilt, zoom: 0 }); updateAngles(); updateUrl(); });
$('#home').addEventListener('click', () => { setInputs(ORIGINAL); goTo(ORIGINAL, { push: true, original: true }); });
$('#guide-return').addEventListener('click', () => { location.assign('/?portal=aerial'); });
$('#about').addEventListener('click', () => $('#about-dialog').showModal());
$('#about-close').addEventListener('click', () => $('#about-dialog').close());
cards.forEach((card, i) => {
  card.querySelector('.capture-select').addEventListener('change', (event) => {
    const selected = availableCaptures.find((item) => String(item.panoId) === event.target.value) || null;
    selectedCaptures[i] = selected;
    preferredDates = selectedCaptures.map((item) => item?.date || '');
    renderCaptureChoices();
    applyCapture(i);
    updateStatus();
    updateUrl();
  });
  const host = card.querySelector('.viewer');
  host.addEventListener('pointerdown', () => activate(i), { capture: true });
  host.addEventListener('focus', () => activate(i));
  host.addEventListener('keydown', (event) => {
    if (handleKey(i, event.key)) event.preventDefault();
  });
  card.querySelector('.expand').addEventListener('click', () => {
    const grid = $('#view-grid');
    if (grid.dataset.focus === String(i)) delete grid.dataset.focus;
    else grid.dataset.focus = String(i);
    cards.forEach((other, index) => other.querySelector('.expand').setAttribute('aria-pressed', String(grid.dataset.focus === String(index))));
    relayout();
  });
  card.querySelector('.retry').addEventListener('click', () => {
    if (!controller || entries[i]?.contextLost) { location.reload(); return; }
    if (!controller.state.panoId) { goTo(latestRequested); return; }
    panelLoading(i);
    entries[i].retryAttempts = 0;
    entries[i].viewer.release();
    entries[i].viewer.setPanoId(controller.state.panoId);
  });
});
document.querySelectorAll('.layout-control button[data-count]').forEach((button) => button.addEventListener('click', () => {
  $('#view-grid').dataset.count = button.dataset.count;
  delete $('#view-grid').dataset.focus;
  cards.forEach((card) => card.querySelector('.expand').setAttribute('aria-pressed', 'false'));
  document.querySelectorAll('.layout-control button').forEach((other) => other.setAttribute('aria-pressed', String(button === other)));
  $('#mode-label').textContent = `${button.dataset.count}개 화면`;
  relayout();
}));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#view-grid').hasAttribute('data-focus')) {
    delete $('#view-grid').dataset.focus;
    cards.forEach((card) => card.querySelector('.expand').setAttribute('aria-pressed', 'false'));
    relayout();
  }
});
window.addEventListener('resize', relayout);
window.addEventListener('popstate', () => {
  preferredDates = readCaptureDates(location.search);
  captureLocationId = null;
  try { const request = parseLocation(location.search, ORIGINAL); setInputs(request); goTo(request); }
  catch (error) { notice(error.message); }
});
boot().catch((error) => {
  console.error('Roadview startup:', error);
  $('#place-name').textContent = '연결을 확인해 주세요';
  $('#capture-date').textContent = '로드뷰를 불러오지 못했습니다.';
  cards.forEach((_, i) => panelError(i, error.message));
  $('#connection-text').textContent = '로드뷰 연결 실패';
  $('#connection').classList.add('error');
});
