import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import { getTimeline, getTiming } from "./timeline.ts";
const config = parseMapConfig({
  stops: [
    { name: "A", lngLat: [104, 30] },
    { name: "B", lngLat: [109, 34] },
    { name: "C", lngLat: [116, 40] },
  ],
});
test("三站默认 360 帧，第一站推近后也停留", () => {
  assert.equal(getTiming(config).durationInFrames, 360);
  assert.equal(
    getTiming({ ...config, stops: config.stops.slice(0, 2) }).durationInFrames,
    240,
  );
  assert.equal(getTimeline(0, config).phase, "intro");
  assert.equal(getTimeline(44, config).introProgress, 1);
  assert.equal(getTimeline(45, config).progress, 0);
  assert.equal(getTimeline(45, config).phase, "hold");
  assert.equal(getTimeline(45, config).stopIndex, 0);
  assert.equal(getTimeline(75, config).phase, "travel");
  assert.equal(getTimeline(164, config).progress, 1);
  assert.equal(getTimeline(165, config).phase, "hold");
  assert.equal(getTimeline(165, config).stopIndex, 1);
  assert.equal(getTimeline(195, config).legIndex, 1);
  assert.equal(getTimeline(195, config).progress, 0);
  assert.equal(getTimeline(315, config).phase, "overview");
  assert.equal(getTimeline(359, config).overviewProgress, 1);
});
test("整条路线上的进度单调，所有缓动值有界", () => {
  let previous = 0;
  for (let frame = 0; frame < getTiming(config).durationInFrames; frame++) {
    const state = getTimeline(frame, config);
    for (const value of [
      state.progress,
      state.introProgress,
      state.overviewProgress,
      state.markerProgress,
    ])
      assert.ok(value >= 0 && value <= 1);
    assert.ok(state.legIndex + state.progress >= previous);
    previous = state.legIndex + state.progress;
  }
});
test("反向跳帧及越界结果确定", () => {
  const middle = getTimeline(90, config);
  getTimeline(300, config);
  assert.deepEqual(getTimeline(90, config), middle);
  assert.deepEqual(getTimeline(-1, config), getTimeline(0, config));
  assert.deepEqual(getTimeline(9999, config), getTimeline(359, config));
});
test("零停留、低 fps、最短行进和重复地点不会除零", () => {
  const short = { ...config, fps: 1, secondsPerLeg: 0.1, holdSeconds: 0 };
  assert.equal(getTiming(short).durationInFrames, 6);
  assert.equal(getTimeline(5, short).overviewProgress, 1);
});
test("小数秒逐段量化", () => {
  const timing = getTiming({
    ...config,
    fps: 24,
    secondsPerLeg: 1.13,
    holdSeconds: 0.17,
  });
  assert.deepEqual(timing, {
    travelFrames: 27,
    holdFrames: 4,
    introFrames: 40,
    introMoveFrames: 36,
    outroFrames: 36,
    legFrames: 31,
    legCount: 2,
    durationInFrames: 138,
  });
});
