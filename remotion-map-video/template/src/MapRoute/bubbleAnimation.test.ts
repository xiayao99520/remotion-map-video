import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import { getTimeline, getTiming } from "./timeline.ts";
import { getBadgeOpacity, getBubbleMotion } from "./bubbleAnimation.ts";
import { BUBBLE_STYLE } from "./styles.ts";

test("交通徽章到达前后与整个停留期间一直可见，气泡独立缩小", () => {
  const config = parseMapConfig({
    stops: [
      { name: "甲", lngLat: [1, 1] },
      { name: "乙", lngLat: [2, 2] },
    ],
  });
  const timing = getTiming(config);
  const start = timing.introFrames;
  for (
    let frame = timing.introMoveFrames;
    frame < timing.durationInFrames - timing.outroFrames;
    frame++
  )
    assert.equal(getBadgeOpacity(getTimeline(frame, config), config), 1);
  assert.equal(getBadgeOpacity(getTimeline(start + 45, config), config), 1);
  assert.equal(
    getBubbleMotion(0, getTimeline(start + 45, config), config).radius,
    BUBBLE_STYLE.visitedRadius,
  );
  assert.equal(
    getBubbleMotion(1, getTimeline(start + 45, config), config).radius,
    BUBBLE_STYLE.nextRadius,
  );
});

test("下一站等待期间无微浮动，乱序求帧仍返回相同位置", () => {
  const config = parseMapConfig({
    stops: [
      { name: "甲", lngLat: [1, 1] },
      { name: "乙", lngLat: [2, 2] },
    ],
  });
  const first = getBubbleMotion(1, getTimeline(90, config), config);
  for (const frame of [120, 80, 140, 100, 90]) {
    const motion = getBubbleMotion(1, getTimeline(frame, config), config);
    assert.equal(motion.centerY, first.centerY);
    assert.equal(motion.radius, first.radius);
  }
});
