import type { TimelineState } from "./timeline.ts";
import { smooth } from "./timeline.ts";
import type { MapConfig } from "../config/schema.ts";
import { getMorphAmount } from "./labelMorph.ts";
import {
  positionOnProjectedLeg,
  type ProjectedRoute,
  type PixelPoint,
} from "./projection.ts";

export type PlateSize = { width: number; height: number };
export type CameraPlan = {
  plate: PlateSize;
  viewport: PlateSize;
  overviewScale: number;
  closeScale: number;
  overviewCenter?: PixelPoint;
  followOffset?: number;
  legScales?: number[];
  holdFrames?: number;
  departureFrames?: number;
  arrivalOffsets?: number[];
  arrivalConfig?: MapConfig;
};
export const getPlateSize = (width: number, height: number): PlateSize => {
  const factor = Math.min(2, 4096 / Math.max(width, height));
  return {
    width: Math.round(width * factor),
    height: Math.round(height * factor),
  };
};
export const createCameraPlan = (
  viewport: PlateSize,
  plate: PlateSize,
): CameraPlan => ({
  viewport,
  plate,
  overviewScale: Math.max(
    viewport.width / plate.width,
    viewport.height / plate.height,
  ),
  closeScale: 1,
});
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPoint = (a: PixelPoint, b: PixelPoint, t: number): PixelPoint => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
});
export const getCamera = (
  route: ProjectedRoute,
  plan: CameraPlan,
  state: TimelineState,
) => {
  const overview = plan.overviewCenter ?? {
    x: plan.plate.width / 2,
    y: plan.plate.height / 2,
  };
  const offset = plan.followOffset ?? 0;
  let center = positionOnProjectedLeg(
    route.legs[state.legIndex],
    state.progress,
  );
  const legScale = plan.legScales?.[state.legIndex] ?? plan.closeScale;
  let scale = legScale;
  // 停留中准备下一段；没有停留时只在出发的前半秒渐变，之后锁定比例。
  if (state.phase === "hold" && state.stopIndex > 0) {
    const next = plan.legScales?.[state.legIndex + 1] ?? legScale;
    scale = mix(
      legScale,
      next,
      smooth(state.phaseFrame / Math.max(1, (plan.holdFrames ?? 1) - 1)),
    );
  } else if (
    state.phase === "travel" &&
    (plan.holdFrames ?? 2) < 2 &&
    state.legIndex > 0
  ) {
    scale = mix(
      plan.legScales?.[state.legIndex - 1] ?? legScale,
      legScale,
      smooth(state.phaseFrame / Math.max(1, plan.departureFrames ?? 1)),
    );
  }
  let anchorOffset = offset;
  if (plan.arrivalConfig && plan.arrivalOffsets) {
    anchorOffset = mix(
      offset,
      plan.arrivalOffsets[state.stopIndex],
      getMorphAmount(state, plan.arrivalConfig),
    );
  }
  if (state.phase === "intro") {
    center = mixPoint(overview, route.stops[0], state.introProgress);
    scale = mix(
      plan.overviewScale,
      plan.legScales?.[0] ?? plan.closeScale,
      state.introProgress,
    );
    anchorOffset *= state.introProgress;
  } else if (state.phase === "overview") {
    center = mixPoint(
      route.stops[route.stops.length - 1],
      overview,
      state.overviewProgress,
    );
    scale = mix(legScale, plan.overviewScale, state.overviewProgress);
    anchorOffset *= 1 - state.overviewProgress;
  }
  // 拟合时留足近景边距；再限制边界，任何缩放都不会露出底图外的空白。
  const halfWidth = plan.viewport.width / (2 * scale);
  const halfHeight = plan.viewport.height / (2 * scale);
  // 双层底图：全景范围比拼接板大，限制到拼接板会造成推拉镜头跳动。
  if (!plan.overviewCenter)
    center = {
      x: Math.max(halfWidth, Math.min(plan.plate.width - halfWidth, center.x)),
      y: Math.max(
        halfHeight,
        Math.min(plan.plate.height - halfHeight, center.y),
      ),
    };
  return {
    center,
    scale,
    x: plan.viewport.width / 2 - center.x * scale,
    y: plan.viewport.height / 2 + anchorOffset - center.y * scale,
  };
};

// 只在接近原生近景比例时换层，不放大小尺寸全景图来充当街道细节。
export const getDetailOpacity = (scale: number) => {
  const t = Math.min(1, Math.max(0, (scale - 0.55) / 0.35));
  return t * t * (3 - 2 * t);
};
