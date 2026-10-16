import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncController } from '../../roadview/sync.mjs';

function fixture({ synchronous = false, deferredViews = false } = {}) {
  let clock = 1000;
  let controller;
  const positions = [];
  const entries = Array.from({ length: 4 }, (_, index) => ({
    ready: true,
    desiredPanoId: null,
    viewer: {
      panoId: 100,
      vp: { pan: 0, tilt: 0, zoom: 0 },
      panoCommands: [],
      viewCommands: [],
      getPanoId() { return this.panoId; },
      getPanoramaData() { return { panoId: this.panoId, position: { x: 1, y: 2 } }; },
      getViewpoint() { return { ...this.vp }; },
      setPanoId(id) {
        assert.ok(entries.every((entry) => String(entry.desiredPanoId) === String(id)));
        this.panoCommands.push(id);
        if (synchronous) { this.panoId = id; controller.onPosition(index); }
      },
      setViewpoint(vp) {
        this.viewCommands.push({ ...vp });
        if (!deferredViews) this.vp = { ...vp };
        if (synchronous) controller.onViewpoint(index);
      },
    },
  }));
  controller = createSyncController(entries, {
    now: () => clock,
    position: (index, data) => positions.push([index, data.panoId]),
  });
  const load = (index, id) => {
    entries[index].viewer.panoId = id;
    controller.onPosition(index);
  };
  const rotate = (index, vp) => {
    entries[index].viewer.vp = { tilt: 0, zoom: 0, ...vp };
    controller.onViewpoint(index);
  };
  return { entries, controller, load, rotate, positions, tick: (ms = 500) => { clock += ms; } };
}

test('any of four activated views leads native movement and preserves a shared direction', () => {
  for (let source = 0; source < 4; source++) {
    const { entries, controller, load } = fixture();
    controller.moveTo(100, { pan: 10, tilt: 2, zoom: 1 });
    controller.activate(source);
    load(source, 200 + source);
    assert.equal(controller.state.panoId, 200 + source);
    entries.forEach((entry, i) => {
      assert.equal(entry.desiredPanoId, 200 + source);
      if (i !== source) load(i, 200 + source);
      assert.deepEqual(entry.viewer.vp, { pan: 10, tilt: 2, zoom: 1 });
    });
  }
});

test('any activated view leads rotation with identical directions and no synchronous echoes', () => {
  for (let source = 0; source < 4; source++) {
    const { entries, controller, rotate } = fixture({ synchronous: true });
    controller.moveTo(100);
    controller.activate(source);
    rotate(source, { pan: 355, tilt: 8, zoom: 2 });
    const base = 355;
    assert.deepEqual(controller.state.viewpoint, { pan: base, tilt: 8, zoom: 2 });
    entries.forEach((entry, i) => {
      assert.deepEqual(entry.viewer.vp, { pan: base, tilt: 8, zoom: 2 });
      assert.ok(entry.viewer.viewCommands.length <= 1);
    });
  }
});

test('followers and stale asynchronous panorama callbacks cannot change the target', () => {
  const { entries, controller, load, positions } = fixture();
  controller.moveTo(200);
  controller.moveTo(300);
  load(1, 200);
  assert.equal(controller.state.panoId, 300);
  assert.equal(entries[1].viewer.panoCommands.at(-1), 300);
  assert.equal(positions.length, 0);
  controller.activate(1);
  load(1, 200);
  assert.equal(controller.state.panoId, 300);
  load(1, 300);
  assert.deepEqual(positions.at(-1), [1, 300]);
  load(2, 999);
  assert.equal(controller.state.panoId, 300);
  assert.equal(entries[2].viewer.panoCommands.at(-1), 300);
});

test('late follower viewpoint commands are restored without moving the leader', () => {
  const { entries, controller, rotate, tick } = fixture();
  controller.moveTo(100, { pan: 20, tilt: 0, zoom: 0 });
  controller.activate(0);
  rotate(0, { pan: 40, tilt: 3, zoom: 1 });
  tick();
  rotate(1, { pan: 110, tilt: 0, zoom: 0 });
  assert.deepEqual(controller.state.viewpoint, { pan: 40, tilt: 3, zoom: 1 });
  assert.deepEqual(entries[1].viewer.vp, { pan: 40, tilt: 3, zoom: 1 });
});

test('intermediate viewpoint and idle events do not restart a follower animation', () => {
  const { entries, controller, rotate, tick } = fixture({ deferredViews: true });
  controller.moveTo(100, { pan: 7, tilt: 0, zoom: 0 });
  const follower = entries[1].viewer;
  assert.equal(follower.viewCommands.length, 1);
  for (const pan of [0, 1, 3, 5]) {
    tick(16);
    rotate(1, { pan });
    controller.onPosition(1);
  }
  assert.equal(follower.viewCommands.length, 1);
  rotate(1, { pan: 7 });
  tick();
  controller.onPosition(1);
  assert.equal(follower.viewCommands.length, 1);
  assert.equal(controller.state.viewpoint.pan, 7);
});

test('native integer truncation settles fractional headings without repeated commands', () => {
  const { entries, controller, rotate, tick } = fixture({ deferredViews: true });
  controller.moveTo(100, { pan: 7.9, tilt: 10.5, zoom: 1.8 });
  entries.forEach((entry, index) => {
    const target = entry.viewer.viewCommands.at(-1);
    assert.equal(target.zoom, 1);
    rotate(index, { pan: Math.trunc(target.pan), tilt: Math.trunc(target.tilt), zoom: target.zoom });
  });
  tick();
  entries.forEach((entry, index) => {
    controller.onPosition(index);
    controller.onViewpoint(index);
    assert.equal(entry.viewer.viewCommands.length, 1);
  });
  assert.ok(Math.abs(controller.state.viewpoint.pan - 7.9) < 1e-9);
  assert.equal(controller.state.viewpoint.tilt, 10.5);
  assert.equal(controller.state.viewpoint.zoom, 1);
  assert.deepEqual(entries.map(({ viewer }) => viewer.vp.pan), [7, 7, 7, 7]);
});

test('a new leader immediately replaces in-flight targets and late old steps converge to the newest target', () => {
  const { entries, controller, rotate, tick } = fixture({ deferredViews: true });
  controller.moveTo(100, { pan: 7, tilt: 0, zoom: 0 });
  const follower = entries[1].viewer;
  controller.activate(3);
  rotate(3, { pan: 350, tilt: 4, zoom: 1 });
  assert.equal(controller.state.viewpoint.pan, 350);
  assert.deepEqual(follower.viewCommands.map((vp) => vp.pan), [7, 350]);
  rotate(1, { pan: 94 });
  rotate(1, { pan: 97 });
  assert.equal(follower.viewCommands.length, 2);
  assert.equal(controller.state.viewpoint.pan, 350);
  tick();
  rotate(1, { pan: 97 }); // A late old completion after the guard restores the latest target once.
  assert.equal(follower.viewCommands.length, 3);
  assert.deepEqual(follower.viewCommands.at(-1), { pan: 350, tilt: 4, zoom: 1 });
  tick(16);
  rotate(1, { pan: 130, tilt: 2, zoom: 1 });
  assert.equal(follower.viewCommands.length, 3);
  rotate(1, { pan: 350, tilt: 4, zoom: 1 });
  assert.equal(follower.vp.pan, 350);
  assert.deepEqual(controller.state.viewpoint, { pan: 350, tilt: 4, zoom: 1 });
});

test('a slow programmatic transition on the active view cannot become native user movement', () => {
  const { entries, controller, rotate, tick } = fixture({ deferredViews: true });
  controller.moveTo(100, { pan: 60, tilt: 0, zoom: 0 });
  tick();
  rotate(0, { pan: 30 });
  assert.equal(controller.state.viewpoint.pan, 60);
  assert.equal(entries[0].viewer.viewCommands.length, 2);
  tick(16);
  rotate(0, { pan: 45 });
  assert.equal(entries[0].viewer.viewCommands.length, 2);
  rotate(0, { pan: 60 });
  assert.equal(controller.state.viewpoint.pan, 60);
});

test('programmatic viewpoint guards suppress echoes and pointer activation permits immediate input', () => {
  const { controller, rotate } = fixture();
  controller.moveTo(100, { pan: 20, tilt: 0, zoom: 0 });
  rotate(0, { pan: 19, tilt: 0, zoom: 0 });
  assert.equal(controller.state.viewpoint.pan, 20);
  controller.activate(0);
  rotate(0, { pan: 30, tilt: 0, zoom: 0 });
  assert.equal(controller.state.viewpoint.pan, 30);
});

test('the active user can reverse direction within the same drag gesture', () => {
  const { entries, controller, rotate } = fixture();
  controller.moveTo(100);
  controller.activate(0);
  for (const pan of [20, 40, 20]) rotate(0, { pan });
  assert.equal(controller.state.viewpoint.pan, 20);
  assert.deepEqual(entries.map(({ viewer }) => viewer.vp.pan), [20, 20, 20, 20]);
});

test('expired old panorama commands do not prevent returning to a previous location', () => {
  const { controller, load, tick } = fixture();
  controller.moveTo(200);
  controller.moveTo(300);
  load(1, 300);
  for (let i = 0; i < 5; i++) tick();
  controller.activate(1);
  load(1, 200);
  assert.equal(controller.state.panoId, 200);
});

test('all entries must initialize before issuing API calls', () => {
  const { entries, controller } = fixture();
  entries[3].ready = false;
  assert.equal(controller.moveTo(200), false);
  controller.resetViewpoint({ pan: 30, tilt: 0, zoom: 0 });
  controller.onPosition(0);
  entries.forEach(({ viewer }) => {
    assert.equal(viewer.panoCommands.length, 0);
    assert.equal(viewer.viewCommands.length, 0);
  });
  entries[3].ready = true;
  assert.equal(controller.moveTo(200), true);
  entries.forEach(({ viewer }) => assert.deepEqual(viewer.panoCommands, [200]));
});

test('rotation can be independent while location remains synchronized, and reset restores a shared direction', () => {
  const { entries, controller, rotate, load } = fixture();
  controller.moveTo(100);
  controller.setRotationSync(false);
  controller.activate(2);
  rotate(2, { pan: 7, tilt: 4, zoom: 1 });
  assert.equal(entries[0].viewer.vp.pan, 0);
  controller.onPosition(2); // Native viewer also emits panoid_changed after a drag settles.
  assert.deepEqual(entries[2].viewer.vp, { pan: 7, tilt: 4, zoom: 1 });
  load(2, 400);
  entries.forEach((entry, i) => { if (i !== 2) load(i, 400); });
  assert.equal(entries[2].viewer.vp.pan, 7);
  assert.equal(entries[1].viewer.vp.pan, 0);
  controller.resetViewpoint({ pan: 350, tilt: 1, zoom: 0 });
  assert.deepEqual(entries.map(({ viewer }) => viewer.vp.pan), [350, 350, 350, 350]);
  controller.setRotationSync(true);
  assert.equal(controller.state.syncRotation, true);
});
