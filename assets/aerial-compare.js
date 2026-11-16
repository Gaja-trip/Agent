(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AerialCompare = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  // Published by V-World's 2D past-imagery catalog (Satellite / fldnam 2007).
  const tileTemplate = "https://cdn.vworld.kr/2d/Satellite/2007/{z}/{x}/{y}.png";
  const emptyTile = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#edf1f4" d="M0 0h256v256H0z"/><text x="128" y="128" text-anchor="middle" fill="#647582" font-size="13">2007년 영상 없음</text></svg>');
  function normalizePosition(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(5, Math.min(95, number)) : 50;
  }

  function clipRect(map, position) {
    const size = map.getSize();
    if (!size.x || !size.y) return "";
    const origin = map.containerPointToLayerPoint([0, 0]);
    const edge = map.containerPointToLayerPoint([size.x, size.y]);
    const split = map.containerPointToLayerPoint([size.x * normalizePosition(position) / 100, 0]);
    return `rect(${origin.y}px, ${edge.x}px, ${edge.y}px, ${split.x}px)`;
  }

  function render() {
    return `<div class="aerial-compare" data-aerial-compare hidden>
      <div class="aerial-compare__cover" data-compare-cover></div>
      <span class="aerial-compare__label aerial-compare__label--latest">최신 항공사진</span>
      <span class="aerial-compare__label aerial-compare__label--history">2007년 항공사진</span>
      <div class="aerial-compare__divider" aria-hidden="true"></div>
      <button class="aerial-compare__handle" type="button" role="slider" aria-label="항공사진 비교 경계" aria-valuemin="5" aria-valuemax="95" aria-valuenow="50" title="좌우로 움직여 항공사진 비교"><i data-lucide="chevrons-left-right"></i></button>
      <p class="aerial-compare__status" role="status" data-compare-status>2007년 항공사진을 불러오는 중입니다.</p>
    </div>`;
  }

  function create({ map, shell, loadLayer, onEnable = () => {} }) {
    const ui = shell.querySelector("[data-aerial-compare]");
    const toggle = shell.querySelector("[data-aerial-compare-toggle]");
    const handle = ui.querySelector(".aerial-compare__handle");
    const cover = ui.querySelector("[data-compare-cover]");
    const status = ui.querySelector("[data-compare-status]");
    const abort = new AbortController();
    const options = { signal: abort.signal };
    let layer = null, enabled = false, position = 50, generation = 0;
    let loaded = 0, failed = 0, dragging = false, restoreDragging = false;
    let activePointerId = null;
    let previousMinZoom = map.getMinZoom();

    function update() {
      ui.style.setProperty("--compare-position", `${position}%`);
      handle.setAttribute("aria-valuenow", String(Math.round(position)));
      handle.setAttribute("aria-valuetext", `최신 항공사진 ${Math.round(position)}%, 2007년 항공사진 ${100 - Math.round(position)}%`);
      const container = layer?.getContainer();
      const clip = enabled && clipRect(map, position);
      if (container && clip) container.style.clip = clip;
    }
    function showStatus(message) { status.textContent = message; status.hidden = false; }
    function finishDrag(event) {
      if (!dragging || (event && event.pointerId !== activePointerId)) return;
      const pointerId = activePointerId;
      dragging = false;
      activePointerId = null;
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      if (restoreDragging) map.dragging.enable();
      restoreDragging = false;
    }
    function positionFromEvent(event) {
      const rect = map.getContainer().getBoundingClientRect();
      if (rect.width) position = normalizePosition((event.clientX - rect.left) / rect.width * 100);
      update();
    }
    function detachLayer() {
      if (!layer) return;
      layer.off("loading", startLoading).off("tileload", tileLoaded).off("tileerror", tileFailed).off("load", finishLoading);
      map.removeLayer(layer);
      layer = null;
    }
    function startLoading() {
      loaded = 0; failed = 0;
      cover.hidden = false;
      showStatus("2007년 항공사진을 불러오는 중입니다.");
      update();
    }
    function tileLoaded(event) { if (!event.tile.dataset.compareFailed) loaded += 1; }
    function tileFailed(event) { failed += 1; event.tile.dataset.compareFailed = "true"; }
    function finishLoading() {
      if (!enabled) return;
      cover.hidden = loaded > 0;
      if (!loaded) showStatus("이 위치의 2007년 영상을 불러오지 못했습니다. 지도를 이동하거나 분할을 다시 켜 주세요.");
      else if (failed) showStatus("일부 구역은 2007년 영상이 제공되지 않습니다.");
      else status.hidden = true;
      update();
    }
    async function setEnabled(next) {
      next = Boolean(next);
      if (enabled === next) return;
      enabled = next;
      const request = ++generation;
      toggle.setAttribute("aria-pressed", String(enabled));
      toggle.classList.toggle("is-active", enabled);
      toggle.title = enabled ? "항공사진 분할 비교 종료" : "최신·2007년 항공사진 분할 비교";
      ui.hidden = !enabled;
      finishDrag();
      if (!enabled) { detachLayer(); map.setMinZoom(previousMinZoom); return; }
      previousMinZoom = map.getMinZoom();
      map.setMinZoom(Math.max(9, previousMinZoom));
      cover.hidden = false;
      showStatus("2007년 항공사진을 불러오는 중입니다.");
      update();
      onEnable();
      try {
        const nextLayer = await loadLayer();
        if (!enabled || request !== generation) return;
        layer = nextLayer;
        layer.on("loading", startLoading).on("tileload", tileLoaded).on("tileerror", tileFailed).on("load", finishLoading);
        layer.addTo(map);
        update();
      } catch (error) {
        if (enabled && request === generation) showStatus(error.message || "2007년 영상에 연결하지 못했습니다.");
      }
    }
    toggle.addEventListener("click", () => setEnabled(!enabled), options);
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || dragging) return;
      event.preventDefault(); event.stopPropagation();
      dragging = true;
      activePointerId = event.pointerId;
      restoreDragging = map.dragging.enabled();
      map.dragging.disable();
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
      positionFromEvent(event);
    }, options);
    handle.addEventListener("pointermove", (event) => { if (dragging && event.pointerId === activePointerId) positionFromEvent(event); }, options);
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => handle.addEventListener(name, finishDrag, options));
    handle.addEventListener("keydown", (event) => {
      const steps = { ArrowLeft: -2, ArrowRight: 2, ArrowDown: -2, ArrowUp: 2, PageDown: -10, PageUp: 10 };
      if (event.key === "Home") position = 5;
      else if (event.key === "End") position = 95;
      else if (event.key in steps) position = normalizePosition(position + steps[event.key]);
      else return;
      event.preventDefault(); event.stopPropagation(); update();
    }, options);
    map.on("move zoomend resize", update);
    return {
      setEnabled,
      destroy() { generation += 1; const wasEnabled = enabled; enabled = false; finishDrag(); detachLayer(); abort.abort(); map.off("move zoomend resize", update); if (wasEnabled) map.setMinZoom(previousMinZoom); ui.hidden = true; toggle.setAttribute("aria-pressed", "false"); toggle.classList.remove("is-active"); },
    };
  }

  return { tileTemplate, emptyTile, normalizePosition, clipRect, render, create };
});
