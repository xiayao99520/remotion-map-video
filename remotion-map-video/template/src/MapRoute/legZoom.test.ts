import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMapConfig, getDimensions } from "../config/schema.ts";
import { createRouteGeometry } from "./geometry.ts";
import {
  createMosaicPlan,
  MAX_DETAIL_TILES,
  projectOnMosaic,
} from "./mosaic.ts";
import {
  createLegDetailPlan,
  getLegScale,
  getLegScreenLength,
  MAX_LEG_ZOOM,
  MIN_LEG_WIDTH_RATIO,
} from "./legZoom.ts";
import { getCamera } from "./camera.ts";
import { getTiming, getTimeline } from "./timeline.ts";
import { getGroundBounds } from "./tiltProjection.ts";

const example = (name: string) =>
  parseMapConfig(
    JSON.parse(
      readFileSync(
        new URL(`../../../examples/${name}.json`, import.meta.url),
        "utf8",
      ).replace(/^\uFEFF/, ""),
    ),
  );
test("真实300–800m短路段达到35%画面宽，极近南宁段最多18.5级，长段不变", () => {
  for (const name of ["chengdu-citywalk", "nanning-food"]) {
    const config = example(name),
      geometry = createRouteGeometry(config),
      viewport = getDimensions(config.aspect);
    const base = createMosaicPlan(
      geometry.coordinates,
      viewport,
      config.closeZoom,
      config.tilt,
      16,
    );
    const detail = createLegDetailPlan(geometry, base, viewport, config);
    assert.ok(
      base.tiles.length +
        detail.patches.reduce((sum, p) => sum + p.mosaic.tiles.length, 0) <=
        MAX_DETAIL_TILES,
    );
    for (let i = 0; i < detail.scales.length; i++) {
      const scale = detail.scales[i];
      assert.ok(base.zoom + Math.log2(scale / 0.78) <= MAX_LEG_ZOOM + 1e-8);
      if (
        geometry.legs[i].distance >= 0.3 &&
        geometry.legs[i].distance <= 0.8
      ) {
        for (const progress of [0, 0.25, 0.5, 0.75, 1])
          assert.ok(
            getLegScreenLength(
              detail.route.legs[i],
              viewport,
              config.tilt,
              scale,
              progress,
            ) >=
              viewport.width * MIN_LEG_WIDTH_RATIO - 1e-5,
          );
      }
    }
    if (name === "chengdu-citywalk") {
      assert.ok(
        geometry.legs[0].distance > 0.3 && geometry.legs[0].distance < 0.8,
      );
      assert.ok(detail.scales[0] > 0.78);
      assert.equal(detail.scales[2], 0.78);
    } else
      assert.ok(
        detail.patches.some(
          (patch) => patch.legIndex === 4 && patch.mosaic.zoom === 18.5,
        ),
      );
  }
});
test("所有行进帧比例固定，停留渐变连续；镜头中心沿线只往前，顶部由高清覆盖", () => {
  const config = example("chengdu-citywalk"),
    geometry = createRouteGeometry(config),
    viewport = getDimensions(config.aspect);
  const base = createMosaicPlan(
    geometry.coordinates,
    viewport,
    config.closeZoom,
    config.tilt,
    16,
  );
  const detail = createLegDetailPlan(geometry, base, viewport, config),
    timing = getTiming(config);
  const plan = {
    viewport,
    plate: base,
    overviewScale: 0.1,
    closeScale: 0.78,
    overviewCenter: { x: base.width / 2, y: base.height / 2 },
    followOffset: viewport.height * 0.12,
    legScales: detail.scales,
    holdFrames: timing.holdFrames,
  };
  for (let i = 0; i < detail.route.legs.length; i++) {
    const leg = detail.route.legs[i];
    let previous = -Infinity;
    for (let f = 0; f < timing.travelFrames; f++) {
      const camera = getCamera(
        detail.route,
        plan,
        getTimeline(timing.introFrames + i * timing.legFrames + f, config),
      );
      assert.equal(camera.scale, detail.scales[i]);
      const p =
        (camera.center.x - leg.start.x) * (leg.end.x - leg.start.x) +
        (camera.center.y - leg.start.y) * (leg.end.y - leg.start.y);
      assert.ok(p >= previous - 1e-6);
      previous = p;
    }
    const boundary = timing.introFrames + i * timing.legFrames;
    if (i > 0)
      assert.deepEqual(
        getCamera(detail.route, plan, getTimeline(boundary - 1, config)),
        getCamera(detail.route, plan, getTimeline(boundary, config)),
      );
  }
  const bounds = getGroundBounds(viewport, config.tilt);
  for (const patch of detail.patches) {
    for (const coordinate of geometry.legs[patch.legIndex].segments.flatMap(
      (part) => part.geometry.coordinates,
    )) {
      const point = projectOnMosaic(
        coordinate as [number, number],
        patch.mosaic,
      );
      const margin = (viewport.height * 0.62 - bounds.top) / (0.78 * 0.85);
      assert.ok(point.y >= margin);
    }
  }
});
test("预算不足确定性降级，重复点有限，不发生无限放大或无限降级", () => {
  const config = example("nanning-food"),
    geometry = createRouteGeometry(config),
    viewport = getDimensions(config.aspect);
  const base = createMosaicPlan(
    geometry.coordinates,
    viewport,
    config.closeZoom,
    config.tilt,
    16,
  );
  const constrained = {
    ...base,
    tiles: Array.from({ length: MAX_DETAIL_TILES }, () => base.tiles[0]),
  };
  const detail = createLegDetailPlan(geometry, constrained, viewport, config);
  assert.equal(detail.patches.length, 0);
  assert.ok(detail.warnings.length > 0);
  assert.ok(detail.scales.every((scale) => scale === 0.78));
  const leg = detail.route.legs[0];
  assert.equal(
    getLegScale({ ...leg, length: 0, end: leg.start }, viewport, 50, 16.5),
    0.78,
  );
});

test("零或单帧停留在出发时连续换比例，半秒后锁定；跳帧结果确定", () => {
  for (const holdSeconds of [0, 1 / 30]) {
    const config = { ...example("chengdu-citywalk"), holdSeconds };
    const geometry = createRouteGeometry(config);
    const viewport = getDimensions(config.aspect);
    const base = createMosaicPlan(
      geometry.coordinates,
      viewport,
      config.closeZoom,
      config.tilt,
      16,
    );
    const detail = createLegDetailPlan(geometry, base, viewport, config);
    const timing = getTiming(config);
    const plan = {
      viewport,
      plate: base,
      overviewScale: 0.1,
      closeScale: 0.78,
      overviewCenter: { x: 0, y: 0 },
      followOffset: viewport.height * 0.12,
      legScales: detail.scales,
      holdFrames: timing.holdFrames,
      departureFrames: 15,
    };
    for (let i = 1; i < detail.route.legs.length; i++) {
      const boundary = timing.introFrames + i * timing.legFrames;
      const camera = (frame: number) =>
        getCamera(detail.route, plan, getTimeline(frame, config));
      assert.deepEqual(camera(boundary - 1), camera(boundary));
      assert.equal(camera(boundary + 15).scale, detail.scales[i]);
      let previous = camera(boundary).scale;
      for (let f = 1; f < timing.travelFrames; f++) {
        const scale = camera(boundary + f).scale;
        assert.ok(Math.abs(scale - previous) < 0.35);
        if (f >= 15) assert.equal(scale, detail.scales[i]);
        previous = scale;
      }
      const at = camera(boundary + 7);
      camera(boundary + 40);
      assert.deepEqual(camera(boundary + 7), at);
    }
  }
});
