const OFFSETS = [0, 0, 0, 0];
const wrap = (angle) => ((angle % 360) + 360) % 360;
const samePano = (a, b) => a != null && b != null && String(a) === String(b);
const clean = (vp = {}) => ({
  pan: wrap(Number.isFinite(vp.pan) ? vp.pan : 0),
  tilt: Number.isFinite(vp.tilt) ? vp.tilt : 0,
  zoom: Number.isFinite(vp.zoom) ? Math.trunc(vp.zoom) : 0,
});
// The native setter truncates pan/tilt to integers; its settled angle can differ
// from a requested fractional angle by just under one degree.
const sameView = (a, b) => !!a && !!b
  && Math.min(wrap(a.pan - b.pan), wrap(b.pan - a.pan)) < 1.05
  && Math.abs(a.tilt - b.tilt) < 1.05 && Math.abs(a.zoom - b.zoom) < 0.01;

/** Coordinate four native viewers without allowing follower events to lead. */
export function createSyncController(entries, callbacks = {}) {
  const now = callbacks.now ?? Date.now;
  const state = { panoId: null, viewpoint: clean(), activeIndex: 0, syncRotation: true };
  const targets = entries.map(() => null);
  const commands = entries.map(() => null);
  const guards = entries.map(() => 0);
  const pending = entries.map(() => new Map());
  const settingPano = entries.map(() => false);
  const settingView = entries.map(() => false);
  const ready = () => entries.every((entry) => entry.ready && entry.viewer);
  const status = () => callbacks.status?.();
  const readView = (index) => clean(entries[index].viewer.getViewpoint());
  const baseView = (index, vp) => ({ ...vp, pan: wrap(vp.pan - OFFSETS[index]) });
  const offsetView = (index, vp) => ({ ...vp, pan: wrap(vp.pan + OFFSETS[index]) });

  function setTarget(index, vp) {
    targets[index] = clean(vp);
  }

  function applyView(index) {
    if (!ready() || !targets[index] || settingView[index]) return;
    const vp = readView(index);
    if (sameView(vp, targets[index])) return;
    // Native transitions emit intermediate events; restarting the same command
    // on every frame would pin the camera at its starting angle.
    if (sameView(commands[index], targets[index]) && now() < guards[index]) return;
    commands[index] = { ...targets[index] };
    guards[index] = now() + 300;
    settingView[index] = true;
    try { entries[index].viewer.setViewpoint({ ...targets[index] }); }
    finally { settingView[index] = false; }
  }

  function applyPano(index) {
    if (!ready() || settingPano[index] || state.panoId == null) return;
    const entry = entries[index];
    if (samePano(entry.viewer.getPanoId(), state.panoId)) {
      applyView(index);
      return;
    }
    for (const [id, until] of pending[index]) if (until <= now()) pending[index].delete(id);
    pending[index].set(String(state.panoId), now() + 2000);
    settingPano[index] = true;
    try { entry.viewer.setPanoId(state.panoId); }
    finally { settingPano[index] = false; }
  }

  function relocate(panoId, vp, preserveIndependent = false) {
    state.panoId = panoId;
    if (vp) state.viewpoint = clean(vp);
    // Assign every desired ID and orientation before a setter can emit synchronously.
    entries.forEach((entry, index) => {
      entry.desiredPanoId = panoId;
      setTarget(index, preserveIndependent ? readView(index) : offsetView(index, state.viewpoint));
    });
    entries.forEach((_, index) => applyPano(index));
    status();
  }

  function activate(index) {
    if (!entries[index]) return;
    state.activeIndex = index;
    commands[index] = null;
    guards[index] = 0;
    status();
  }

  function moveTo(panoId, vp) {
    if (panoId == null || !ready()) return false;
    relocate(panoId, vp, !state.syncRotation && !vp);
    return true;
  }

  function onPosition(index) {
    if (!ready() || !entries[index]) return;
    const viewer = entries[index].viewer;
    const data = viewer.getPanoramaData();
    const panoId = data?.panoId ?? viewer.getPanoId();
    if (panoId == null) return;
    const commandUntil = pending[index].get(String(panoId)) ?? 0;
    const commanded = now() < commandUntil;
    // Keep superseded commands briefly: some viewers repeat their completion event.
    if (samePano(panoId, state.panoId) || !commanded) pending[index].delete(String(panoId));
    if (!samePano(panoId, state.panoId)) {
      if (index !== state.activeIndex || commanded || settingPano[index]) {
        applyPano(index);
        return;
      }
      relocate(panoId, baseView(index, readView(index)), !state.syncRotation);
    }
    applyView(index);
    callbacks.position?.(index, data);
    status();
  }

  function onViewpoint(index) {
    if (!ready() || !entries[index]) return;
    const vp = readView(index);
    callbacks.viewpoint?.(index, vp);
    if (sameView(vp, targets[index])) { commands[index] = null; return; }
    const commanded = commands[index] !== null;
    if (index !== state.activeIndex || commanded) {
      if (state.syncRotation || commanded) applyView(index);
      return;
    }
    if (settingView[index] || now() < guards[index]) return;
    setTarget(index, vp);
    state.viewpoint = baseView(index, vp);
    if (state.syncRotation) {
      entries.forEach((_, i) => setTarget(i, offsetView(i, state.viewpoint)));
      entries.forEach((_, i) => { if (i !== index) applyView(i); });
    }
    status();
  }

  function resetViewpoint(vp) {
    state.viewpoint = clean(vp);
    entries.forEach((_, i) => setTarget(i, offsetView(i, state.viewpoint)));
    entries.forEach((_, i) => applyView(i));
    status();
  }

  function setRotationSync(enabled) {
    state.syncRotation = !!enabled;
    if (enabled && ready()) resetViewpoint(baseView(state.activeIndex, readView(state.activeIndex)));
    else status();
  }

  return {
    activate, moveTo, onPosition, onViewpoint, setRotationSync, resetViewpoint,
    get state() { return { ...state, viewpoint: { ...state.viewpoint } }; },
  };
}
