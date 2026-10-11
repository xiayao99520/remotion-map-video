import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import { createCameraPlan, getCamera, getPlateSize } from "./camera.ts";
import { getTimeline, getTiming } from "./timeline.ts";
import { createRouteGeometry } from "./geometry.ts";
import { projectRoute, positionOnProjectedLeg } from "./projection.ts";
const config = parseMapConfig({
  stops: [
    { name: "A", lngLat: [0, 0] },
    { name: "B", lngLat: [1, 1] },
    { name: "C", lngLat: [2, -1] },
    { name: "D", lngLat: [1.5, -0.5] },
  ],
});
const route = projectRoute(createRouteGeometry(config), ([lng, lat]) => ({
  x: 700 + lng * 300,
  y: 1700 - lat * 300,
}));
const plan = createCameraPlan(
  { width: 1080, height: 1920 },
  getPlateSize(1080, 1920),
);
test("每段沿路线方向的投影单调，连续换段也不走回头路", () => {
  const timing = getTiming(config);
  for (let leg = 0; leg < route.legs.length; leg++) {
    const part = route.legs[leg];
    const dx = part.end.x - part.start.x,
      dy = part.end.y - part.start.y;
    let previous = -Infinity;
    for (let i = 0; i < timing.legFrames; i++) {
      const state = getTimeline(
        timing.introFrames + leg * timing.legFrames + i,
        config,
      );
      const camera = getCamera(route, plan, state);
      const projection =
        (camera.center.x - part.start.x) * dx +
        (camera.center.y - part.start.y) * dy;
      assert.ok(projection >= previous - 1e-7);
      previous = projection;
      assert.equal(camera.scale, 1);
    }
  }
});
test("相邻帧位移有界，换段和停留边界速度接近零", () => {
  const timing = getTiming(config);
  const start = timing.introFrames;
  const end = start + timing.legCount * timing.legFrames;
  let previous = getCamera(route, plan, getTimeline(start, config)).center;
  for (let frame = start + 1; frame < end; frame++) {
    const current = getCamera(route, plan, getTimeline(frame, config)).center;
    const state = getTimeline(frame, config);
    const speed = Math.hypot(current.x - previous.x, current.y - previous.y);
    // 五次缓动最大导数 1.875，按像素弧长得到可解释的逐帧位移上界。
    assert.ok(
      speed <=
        (route.legs[state.legIndex].length * 1.875) /
          (timing.travelFrames - 1) +
          1e-6,
    );
    const local = (frame - start) % timing.legFrames;
    if (local === 0 || local === 1 || local === timing.travelFrames)
      assert.ok(speed < 0.02);
    previous = current;
  }
});
test("开场到行进、行进到结尾连续，scale <= 1，画面不露底", () => {
  const timing = getTiming(config);
  for (const boundary of [
    timing.introFrames,
    timing.durationInFrames - timing.outroFrames,
  ]) {
    const a = getCamera(route, plan, getTimeline(boundary - 1, config));
    const b = getCamera(route, plan, getTimeline(boundary, config));
    assert.deepEqual(a, b);
  }
  for (let frame = 0; frame < timing.durationInFrames; frame++) {
    const camera = getCamera(route, plan, getTimeline(frame, config));
    assert.ok(camera.scale >= plan.overviewScale && camera.scale <= 1);
    assert.ok(camera.x <= 1e-6 && camera.y <= 1e-6);
    assert.ok(camera.x + plan.plate.width * camera.scale >= 1080 - 1e-6);
    assert.ok(camera.y + plan.plate.height * camera.scale >= 1920 - 1e-6);
  }
  assert.deepEqual(getPlateSize(1920, 1080), { width: 3840, height: 2160 });
  assert.ok(Math.max(...Object.values(getPlateSize(4000, 3000))) <= 4096);
});
test("跨日期变更线投影保留子路径，像素距离连续，重复点有限", () => {
  const geometry = createRouteGeometry(
    parseMapConfig({
      lineStyle: "greatCircle",
      stops: [
        { name: "A", lngLat: [170, 30] },
        { name: "B", lngLat: [-170, 35] },
      ],
    }),
  );
  const projected = projectRoute(geometry, ([lng, lat]) => ({
    x: lng * 10,
    y: lat * 10,
  }));
  assert.equal(projected.legs[0].path.match(/M/g)?.length, 2);
  assert.ok(projected.legs[0].edges.every((e) => e.length < 20));
  assert.equal(positionOnProjectedLeg(projected.legs[0], 1).x, 1900);
  const repeated = projectRoute(
    createRouteGeometry(
      parseMapConfig({
        stops: [
          { name: "A", lngLat: [0, 0] },
          { name: "B", lngLat: [0, 0] },
        ],
      }),
    ),
    ([x, y]) => ({ x, y }),
  );
  assert.deepEqual(positionOnProjectedLeg(repeated.legs[0], 0.5), {
    x: 0,
    y: 0,
  });
});
