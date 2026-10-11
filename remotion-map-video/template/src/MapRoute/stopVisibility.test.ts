import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import { getTimeline, getTiming } from "./timeline.ts";
import { getStopAppearance } from "./stopVisibility.ts";

const config = parseMapConfig({
  fps: 30,
  stops: [
    { name: "A", lngLat: [104, 30] },
    { name: "B", lngLat: [105, 30] },
    { name: "C", lngLat: [106, 30] },
    { name: "D", lngLat: [107, 30] },
  ],
});

test("开场只显示第一站和下一站，行进中只显示已到达和当前下一站", () => {
  const intro = getTimeline(0, config);
  assert.deepEqual(
    [0, 1].map((index) => getStopAppearance(index, intro, config).visible),
    [true, true],
  );
  assert.deepEqual(
    [2, 3].map((index) => getStopAppearance(index, intro, config).visible),
    [false, false],
  );
  const travel = getTimeline(getTiming(config).introFrames, config);
  assert.deepEqual(
    [0, 1, 2, 3].map(
      (index) => getStopAppearance(index, travel, config).visible,
    ),
    [true, true, false, false],
  );
});

test("到站后当前点变成已走过点，结尾全景显示全部点", () => {
  const timing = getTiming(config);
  const hold = getTimeline(timing.introFrames + timing.travelFrames, config);
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => getStopAppearance(index, hold, config).visible),
    [true, true, false, false],
  );
  const overview = getTimeline(timing.durationInFrames - 1, config);
  assert.deepEqual(
    [0, 1, 2, 3].map(
      (index) => getStopAppearance(index, overview, config).visible,
    ),
    [true, true, true, true],
  );
});
