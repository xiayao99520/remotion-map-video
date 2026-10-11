import type { LngLat, MapConfig } from "../config/schema.ts";
import type { PlateSize } from "./camera.ts";
import type { RouteGeometry } from "./geometry.ts";
import {
  createMosaicPlan,
  MAX_DETAIL_TILES,
  projectOnMosaic,
  type MosaicPlan,
} from "./mosaic.ts";
import {
  positionOnProjectedLeg,
  projectRoute,
  type ProjectedLeg,
} from "./projection.ts";
import { projectTiltedPoint, getTiltScene } from "./tiltProjection.ts";
import { TILT_STYLE } from "./styles.ts";

export const MAX_LEG_ZOOM = 18.5;
export const MIN_LEG_WIDTH_RATIO = 0.35;
export const getLegScreenLength = (
  leg: ProjectedLeg,
  viewport: PlateSize,
  tilt: number,
  scale: number,
  progress = 0.5,
) => {
  const head = positionOnProjectedLeg(leg, progress);
  const { origin } = getTiltScene(viewport, tilt);
  const camera = {
    scale,
    x: origin.x - head.x * scale,
    y: origin.y - head.y * scale,
  };
  const a = projectTiltedPoint(leg.start, camera, viewport, tilt);
  const b = projectTiltedPoint(leg.end, camera, viewport, tilt);
  return Math.hypot(b.x - a.x, b.y - a.y);
};
export const getLegScale = (
  leg: ProjectedLeg,
  viewport: PlateSize,
  tilt: number,
  zoom: number,
) => {
  const base = tilt === 0 ? 1 : TILT_STYLE.closeScale;
  const target = viewport.width * MIN_LEG_WIDTH_RATIO;
  const length = (scale: number) =>
    Math.min(
      ...[0, 0.5, 1].map((progress) =>
        getLegScreenLength(leg, viewport, tilt, scale, progress),
      ),
    );
  if (leg.length === 0 || length(base) >= target) return base;
  const maximum = base * 2 ** Math.max(0, MAX_LEG_ZOOM - zoom);
  let low = base,
    high = maximum;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (length(middle) < target) low = middle;
    else high = middle;
  }
  return high;
};
export type LocalDetailPlan = {
  legIndex: number;
  mosaic: MosaicPlan;
  ratio: number;
  x: number;
  y: number;
};
export const createLegDetailPlan = (
  geometry: RouteGeometry,
  base: MosaicPlan,
  viewport: PlateSize,
  config: MapConfig,
) => {
  const route = projectRoute(geometry, (coordinate) =>
    projectOnMosaic(coordinate, base),
  );
  const closeScale = config.tilt === 0 ? 1 : TILT_STYLE.closeScale;
  const scales = route.legs.map((leg) =>
    getLegScale(leg, viewport, config.tilt, base.zoom),
  );
  const patches: LocalDetailPlan[] = [];
  const warnings: string[] = [];
  let remaining = MAX_DETAIL_TILES - base.tiles.length;
  for (let legIndex = 0; legIndex < scales.length; legIndex++) {
    if (scales[legIndex] <= closeScale + 1e-6) continue;
    const requested = Math.min(
      MAX_LEG_ZOOM,
      Math.ceil((base.zoom + Math.log2(scales[legIndex] / closeScale)) * 4) / 4,
    );
    const coordinates = geometry.legs[legIndex].segments.flatMap(
      (segment) => segment.geometry.coordinates as LngLat[],
    );
    // 倾斜视野的最低块数不会随 zoom 降低而减少；先检查预算，避免无限降级。
    const minimum = createMosaicPlan(
      coordinates,
      viewport,
      base.zoom,
      config.tilt,
    );
    if (minimum.tiles.length > remaining) {
      scales[legIndex] = closeScale;
      warnings.push(
        `第 ${legIndex + 1} 段局部高清块超出 ${MAX_DETAIL_TILES} 块上限，已降级到 ${base.zoom} 级`,
      );
      continue;
    }
    const mosaic = createMosaicPlan(
      coordinates,
      viewport,
      requested,
      config.tilt,
      remaining,
    );
    if (mosaic.zoom <= base.zoom) {
      scales[legIndex] = closeScale;
      warnings.push(
        `第 ${legIndex + 1} 段局部底图已降级到近景级别 ${base.zoom}`,
      );
      continue;
    }
    if (mosaic.zoom < requested) {
      scales[legIndex] = Math.min(
        scales[legIndex],
        closeScale * 2 ** (mosaic.zoom - base.zoom),
      );
      warnings.push(
        `第 ${legIndex + 1} 段局部高清底图已自动调整为 ${mosaic.zoom} 级`,
      );
    }
    const ratio = 2 ** (base.zoom - mosaic.zoom);
    patches.push({
      legIndex,
      mosaic,
      ratio,
      x: mosaic.origin.x * ratio - base.origin.x,
      y: mosaic.origin.y * ratio - base.origin.y,
    });
    remaining -= mosaic.tiles.length;
  }
  return { route, scales, patches, warnings };
};
