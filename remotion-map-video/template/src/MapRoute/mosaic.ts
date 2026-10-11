import type { LngLat } from "../config/schema.ts";
import type { PlateSize } from "./camera.ts";
import type { PixelPoint } from "./projection.ts";
import { getGroundBounds, getTiltScene } from "./tiltProjection.ts";
import { TILT_STYLE } from "./styles.ts";

export const MAX_DETAIL_TILES = 24;
export const DETAIL_TILE_SIZE = 3072;
// 多拍一圈再裁切，避免块边缘的文字被画布直接截掉。
export const TILE_GUTTER = 64;
const MAX_MERCATOR_LATITUDE = 85.0511287798066;

export const projectWorld = ([lng, lat]: LngLat, zoom: number): PixelPoint => {
  const world = 512 * 2 ** zoom;
  const latitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, lat),
  );
  const sine = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world,
  };
};
export const unprojectWorld = ({ x, y }: PixelPoint, zoom: number): LngLat => {
  const world = 512 * 2 ** zoom;
  return [
    (x / world) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world))) * 180) / Math.PI,
  ];
};
export type MosaicTile = PlateSize & PixelPoint & { center: LngLat };
export type MosaicPlan = PlateSize & {
  zoom: number;
  origin: PixelPoint;
  tiles: MosaicTile[];
};
export const createMosaicPlan = (
  coordinates: LngLat[],
  viewport: PlateSize,
  requestedZoom: number,
  tilt = 0,
  maxTiles = MAX_DETAIL_TILES,
): MosaicPlan => {
  const bounds = getGroundBounds(viewport, tilt);
  const { origin: anchor } = getTiltScene(viewport, tilt);
  const detailScale = TILT_STYLE.closeScale * TILT_STYLE.detailStart;
  const marginX =
    tilt === 0
      ? viewport.width + 100
      : Math.max(anchor.x - bounds.left, bounds.right - anchor.x) /
          detailScale +
        100;
  const marginTop =
    tilt === 0
      ? viewport.height * 1.25 + 100
      : (anchor.y - bounds.top) / detailScale + 100;
  const marginBottom =
    tilt === 0
      ? viewport.height * 1.25 + 100
      : (bounds.bottom - anchor.y) / detailScale + 100;
  let zoom = requestedZoom;
  for (;;) {
    const points = coordinates.map((point) => projectWorld(point, zoom));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    // 覆盖近景淡入时的两倍画幅，以及中央偏下的徽章锚点。
    const origin = {
      x: Math.floor(Math.min(...xs) - marginX),
      y: Math.floor(Math.min(...ys) - marginTop),
    };
    const width = Math.ceil(Math.max(...xs) + marginX - origin.x);
    const height = Math.ceil(Math.max(...ys) + marginBottom - origin.y);
    const columns = Math.ceil(width / DETAIL_TILE_SIZE);
    const rows = Math.ceil(height / DETAIL_TILE_SIZE);
    if (columns * rows <= maxTiles) {
      const tiles: MosaicTile[] = [];
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const x = column * DETAIL_TILE_SIZE;
          const y = row * DETAIL_TILE_SIZE;
          const tileWidth = Math.min(DETAIL_TILE_SIZE, width - x);
          const tileHeight = Math.min(DETAIL_TILE_SIZE, height - y);
          tiles.push({
            x,
            y,
            width: tileWidth,
            height: tileHeight,
            center: unprojectWorld(
              {
                x: origin.x + x + tileWidth / 2,
                y: origin.y + y + tileHeight / 2,
              },
              zoom,
            ),
          });
        }
      }
      return { width, height, origin, zoom, tiles };
    }
    // 不限制路线距离；长路线允许降到配置范围以下，精度取 0.25 级。
    zoom = Math.round((zoom - 0.25) * 100) / 100;
  }
};
export const projectOnMosaic = (
  coordinate: LngLat,
  plan: MosaicPlan,
): PixelPoint => {
  const point = projectWorld(coordinate, plan.zoom);
  return { x: point.x - plan.origin.x, y: point.y - plan.origin.y };
};
export const placeOverview = (
  center: LngLat,
  zoom: number,
  size: PlateSize,
  mosaic: MosaicPlan,
) => {
  const ratio = 2 ** (mosaic.zoom - zoom);
  const point = projectOnMosaic(center, mosaic);
  return {
    x: point.x - (size.width * ratio) / 2,
    y: point.y - (size.height * ratio) / 2,
    width: size.width * ratio,
    height: size.height * ratio,
    center: point,
    ratio,
  };
};
