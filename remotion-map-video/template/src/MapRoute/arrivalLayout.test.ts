import { test } from "node:test";
import assert from "node:assert/strict";
import { getDimensions, parseMapConfig } from "../config/schema.ts";
import { createRouteGeometry } from "./geometry.ts";
import { projectRoute } from "./projection.ts";
import {
  getArrivalOffset,
  getCardLayout,
  getMorphAmount,
} from "./labelMorph.ts";
import { getCamera } from "./camera.ts";
import { getTimeline, getTiming } from "./timeline.ts";
import { projectTiltedPoint } from "./tiltProjection.ts";
import { BADGE_RADIUS, ARRIVAL_STYLE } from "./styles.ts";

test("横竖屏与0–60度倾角：停留展开后卡片中心在42%–50%，长标题在画内且紧贴徽章", () => {
  for (const aspect of ["9:16", "16:9", "1:1"] as const)
    for (const tilt of [0, 50, 60]) {
      const config = parseMapConfig({
        aspect,
        tilt,
        stops: [
          { name: "宽窄巷子", address: "成都市青羊区宽巷子", lngLat: [0, 0] },
          {
            name: "梁阿婆廿年老牌扣肉糯米饭非常长的分店名称",
            address: "永宁街华兴里1-4号",
            lngLat: [1, 1],
          },
          { name: "终点", lngLat: [2, 2] },
        ],
      });
      const viewport = getDimensions(aspect),
        timing = getTiming(config);
      const route = projectRoute(createRouteGeometry(config), ([x, y]) => ({
        x: 3000 + x * 1000,
        y: 4000 - y * 1000,
      }));
      const plan = {
        viewport,
        plate: { width: 10000, height: 10000 },
        closeScale: 0.78,
        overviewScale: 0.1,
        overviewCenter: { x: 5000, y: 5000 },
        followOffset: viewport.height * 0.12,
        holdFrames: timing.holdFrames,
        arrivalConfig: config,
        arrivalOffsets: config.stops.map((_, i) =>
          getArrivalOffset(config, i, viewport),
        ),
      };
      for (let i = 0; i < config.stops.length; i++) {
        const frame =
          (i === 0
            ? timing.introMoveFrames
            : timing.introFrames +
              (i - 1) * timing.legFrames +
              timing.travelFrames) +
          timing.holdFrames -
          1;
        const state = getTimeline(frame, config);
        assert.equal(getMorphAmount(state, config), 1);
        const point = projectTiltedPoint(
          route.stops[i],
          getCamera(route, plan, state),
          viewport,
          tilt,
        );
        const depth = point.depthScale;
        const card = getCardLayout(
          config.stops[i].name,
          config.stops[i].address,
          { x: point.x / depth, y: point.y / depth },
          { width: viewport.width / depth, height: viewport.height / depth },
        );
        const center = ((card.y + card.height / 2) * depth) / viewport.height;
        assert.ok(
          center >= 0.42 && center <= 0.5,
          `${aspect}/${tilt}/${i}: ${center}`,
        );
        assert.ok(
          card.x * depth >= 0 &&
            (card.x + card.width) * depth <= viewport.width,
        );
        assert.ok(
          card.y * depth >= 0 &&
            (card.y + card.height) * depth <= viewport.height,
        );
        assert.ok(
          Math.abs(
            point.y -
              BADGE_RADIUS * depth -
              (card.y + card.height) * depth -
              ARRIVAL_STYLE.badgeGap * depth,
          ) < 1e-5,
        );
      }
      // 新构图仅改变静态板偏移，沿线镜头中心仍单调；相邻帧构图变化有界。
      for (let leg = 0; leg < route.legs.length; leg++) {
        const start = timing.introFrames + leg * timing.legFrames;
        let previous = getCamera(route, plan, getTimeline(start - 1, config));
        assert.deepEqual(
          previous,
          getCamera(route, plan, getTimeline(start, config)),
        );
        for (let f = 0; f < timing.legFrames; f++) {
          const state = getTimeline(start + f, config);
          const camera = getCamera(route, plan, state);
          assert.ok(camera.center.x >= previous.center.x - 1e-8);
          const anchor = camera.y + camera.center.y * camera.scale;
          const previousAnchor =
            previous.y + previous.center.y * previous.scale;
          assert.ok(
            Math.abs(anchor - previousAnchor) < viewport.height * 0.035,
          );
          previous = camera;
        }
      }
    }
});
