import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getGroundBounds,
  getTiltScene,
  projectTiltedPoint,
  unprojectTiltedPoint,
} from "./tiltProjection.ts";
import { createMosaicPlan, projectOnMosaic } from "./mosaic.ts";
import { TILT_STYLE } from "./styles.ts";

test("零倾角等于二维镜头；50 度远处缩小，落脚锚点不移动", () => {
  const viewport = { width: 1080, height: 1920 };
  const camera = { x: 30, y: -40, scale: 0.82 };
  const point = { x: 300, y: 600 };
  assert.deepEqual(projectTiltedPoint(point, camera, viewport, 0), {
    x: 276,
    y: 452,
    depthScale: 1,
    visible: true,
  });
  const { origin } = getTiltScene(viewport, 50);
  const anchor = projectTiltedPoint(
    origin,
    { x: 0, y: 0, scale: 1 },
    viewport,
    50,
  );
  assert.deepEqual(anchor, { ...origin, depthScale: 1, visible: true });
  assert.ok(
    projectTiltedPoint(
      { x: 540, y: 400 },
      { x: 0, y: 0, scale: 1 },
      viewport,
      50,
    ).depthScale < 1,
  );
});
test("三个比例、0/50/60 度的四角逆投影还原屏幕；近处底图不会放大超过原像素", () => {
  for (const viewport of [
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
    { width: 1080, height: 1080 },
  ]) {
    for (const tilt of [0, 50, 60]) {
      for (const screen of [
        { x: 0, y: 0 },
        { x: viewport.width, y: 0 },
        { x: 0, y: viewport.height },
        { x: viewport.width, y: viewport.height },
      ]) {
        const flat = unprojectTiltedPoint(screen, viewport, tilt);
        const actual = projectTiltedPoint(
          flat,
          { x: 0, y: 0, scale: 1 },
          viewport,
          tilt,
        );
        assert.ok(
          Math.abs(actual.x - screen.x) < 1e-8 &&
            Math.abs(actual.y - screen.y) < 1e-8,
        );
        if (tilt > 0) assert.ok(actual.depthScale * TILT_STYLE.closeScale < 1);
      }
    }
  }
});
test("透视近景块覆盖所有站点跟随视野，淡入起点和 60 度也不露边缘", () => {
  for (const viewport of [
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
    { width: 1080, height: 1080 },
  ]) {
    for (const tilt of [50, 60]) {
      const coords: [number, number][] = [
        [104.051, 30.666],
        [104.081, 30.656],
      ];
      const mosaic = createMosaicPlan(coords, viewport, 16.5, tilt);
      assert.ok(mosaic.tiles.length <= 16);
      const ground = getGroundBounds(viewport, tilt);
      const { origin } = getTiltScene(viewport, tilt);
      for (const coord of coords) {
        const point = projectOnMosaic(coord, mosaic);
        for (const scale of [
          TILT_STYLE.closeScale,
          TILT_STYLE.closeScale * TILT_STYLE.detailStart,
        ]) {
          assert.ok(point.x + (ground.left - origin.x) / scale >= 0);
          assert.ok(
            point.x + (ground.right - origin.x) / scale <= mosaic.width,
          );
          assert.ok(point.y + (ground.top - origin.y) / scale >= 0);
          assert.ok(
            point.y + (ground.bottom - origin.y) / scale <= mosaic.height,
          );
        }
      }
    }
  }
});
