import { test } from "node:test";
import assert from "node:assert/strict";
import { MercatorCoordinate } from "maplibre-gl";
import {
  createMosaicPlan,
  MAX_DETAIL_TILES,
  placeOverview,
  projectOnMosaic,
  projectWorld,
  TILE_GUTTER,
  unprojectWorld,
} from "./mosaic.ts";
import { parseMapConfig } from "../config/schema.ts";
import { createRouteGeometry } from "./geometry.ts";
import { getCamera, getDetailOpacity, getPlateSize } from "./camera.ts";
import { projectRoute, positionOnProjectedLeg } from "./projection.ts";
import { getTimeline, getTiming } from "./timeline.ts";

const viewport = { width: 1080, height: 1920 };
const stops = [
  { name: "A", lngLat: [104.051, 30.666] },
  { name: "B", lngLat: [104.081, 30.656] },
];

test("像素投影与实际 MapLibre 墨卡托 API 一致，三个画幅都遵守块数上限", () => {
  for (const coordinate of [
    [104.051, 30.666],
    [190, 35],
    [-170, -80],
  ] as [number, number][]) {
    const reference = MercatorCoordinate.fromLngLat(coordinate);
    for (const zoom of [7, 12, 16.5, 18]) {
      const point = projectWorld(coordinate, zoom);
      const world = 512 * 2 ** zoom;
      assert.ok(Math.abs(point.x - reference.x * world) < 1e-6);
      assert.ok(Math.abs(point.y - reference.y * world) < 1e-6);
    }
  }
  const geometry = createRouteGeometry(parseMapConfig({ stops }));
  for (const size of [
    viewport,
    { width: 1920, height: 1080 },
    { width: 1080, height: 1080 },
  ]) {
    assert.ok(
      createMosaicPlan(geometry.coordinates, size, 18).tiles.length <=
        MAX_DETAIL_TILES,
    );
  }
});

test("城市保留 16.5 级；跨洲、跨日期变更线、重复点均满足块数和纹理尺寸上限", () => {
  for (const config of [
    parseMapConfig({ stops }),
    parseMapConfig({
      lineStyle: "greatCircle",
      stops: [
        { name: "A", lngLat: [8.54, 47.37] },
        { name: "B", lngLat: [-74, 40.71] },
      ],
    }),
    parseMapConfig({
      lineStyle: "greatCircle",
      stops: [
        { name: "A", lngLat: [170, 30] },
        { name: "B", lngLat: [-170, 35] },
      ],
    }),
    parseMapConfig({ stops: [stops[0], stops[0]] }),
  ]) {
    const geometry = createRouteGeometry(config);
    const plan = createMosaicPlan(
      geometry.coordinates,
      viewport,
      config.closeZoom,
    );
    assert.ok(plan.tiles.length <= MAX_DETAIL_TILES);
    assert.ok(
      plan.tiles.every(
        (tile) => Math.max(tile.width, tile.height) + TILE_GUTTER * 2 <= 4096,
      ),
    );
    if (config.stops[1].name === "B" && config.lineStyle === "straight")
      assert.equal(plan.zoom, 16.5);
    if (config.lineStyle === "greatCircle") assert.ok(plan.zoom < 12);
    for (const coordinate of geometry.coordinates) {
      const point = projectOnMosaic(coordinate, plan);
      assert.ok(
        point.x >= viewport.width && point.x <= plan.width - viewport.width,
      );
      assert.ok(
        point.y >= viewport.height * 1.25 &&
          point.y <= plan.height - viewport.height * 1.25,
      );
    }
  }
});
test("全景图与近景图使用同一墨卡托坐标，含展开经度与高纬度", () => {
  const plan = createMosaicPlan(
    [
      [170, 30],
      [190, 35],
    ],
    viewport,
    16.5,
  );
  const size = getPlateSize(viewport.width, viewport.height);
  const center: [number, number] = [180, 33];
  const zoom = plan.zoom - 2;
  const overview = placeOverview(center, zoom, size, plan);
  for (const coordinate of [
    [170, 30],
    [190, 35],
    [180, 33],
    [179, 80],
  ] as [number, number][]) {
    const low = projectWorld(coordinate, zoom);
    const lowCenter = projectWorld(center, zoom);
    const high = projectOnMosaic(coordinate, plan);
    assert.ok(
      Math.abs(
        overview.x +
          (low.x - lowCenter.x + size.width / 2) * overview.ratio -
          high.x,
      ) < 1e-6,
    );
    assert.ok(
      Math.abs(
        overview.y +
          (low.y - lowCenter.y + size.height / 2) * overview.ratio -
          high.y,
      ) < 1e-6,
    );
    const restored = unprojectWorld(
      projectWorld(coordinate, plan.zoom),
      plan.zoom,
    );
    assert.ok(Math.abs(restored[0] - coordinate[0]) < 1e-9);
    assert.ok(Math.abs(restored[1] - coordinate[1]) < 1e-9);
  }
});
test("高清镜头连续前进，线头锚点固定偏下，推拉层透明度单调且连续", () => {
  const config = parseMapConfig({ stops });
  const geometry = createRouteGeometry(config);
  const mosaic = createMosaicPlan(
    geometry.coordinates,
    viewport,
    config.closeZoom,
  );
  const route = projectRoute(geometry, (coordinate) =>
    projectOnMosaic(coordinate, mosaic),
  );
  const plan = {
    viewport,
    plate: mosaic,
    overviewScale: 0.1,
    closeScale: 1,
    overviewCenter: { x: mosaic.width / 2, y: mosaic.height / 2 },
    followOffset: viewport.height * 0.12,
  };
  const timing = getTiming(config);
  let previous = -Infinity;
  for (
    let frame = timing.introFrames;
    frame < timing.durationInFrames - timing.outroFrames;
    frame++
  ) {
    const state = getTimeline(frame, config);
    const head = positionOnProjectedLeg(route.legs[0], state.progress);
    const camera = getCamera(route, plan, state);
    assert.ok(camera.center.x >= previous - 1e-8);
    previous = camera.center.x;
    assert.ok(
      Math.abs(camera.x + head.x * camera.scale - viewport.width / 2) < 1e-7,
    );
    assert.ok(
      Math.abs(camera.y + head.y * camera.scale - viewport.height * 0.62) <
        1e-7,
    );
  }
  for (const boundary of [
    timing.introMoveFrames,
    timing.introFrames,
    timing.durationInFrames - timing.outroFrames,
  ]) {
    assert.deepEqual(
      getCamera(route, plan, getTimeline(boundary - 1, config)),
      getCamera(route, plan, getTimeline(boundary, config)),
    );
  }
  let opacity = 0;
  for (let frame = 0; frame < timing.introMoveFrames; frame++) {
    const current = getDetailOpacity(
      getCamera(route, plan, getTimeline(frame, config)).scale,
    );
    assert.ok(current >= opacity && current <= 1);
    opacity = current;
  }
  assert.equal(getDetailOpacity(0.55), 0);
  assert.equal(getDetailOpacity(1), 1);
});
