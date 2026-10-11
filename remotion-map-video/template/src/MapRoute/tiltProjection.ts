import type { PlateSize, getCamera } from "./camera.ts";
import type { PixelPoint } from "./projection.ts";
import { TILT_STYLE } from "./styles.ts";

export const getTiltScene = (viewport: PlateSize, tilt: number) => ({
  origin: { x: viewport.width / 2, y: viewport.height * TILT_STYLE.originY },
  perspective: viewport.height * TILT_STYLE.perspectiveHeights,
  radians: (tilt * Math.PI) / 180,
});

// 与浏览器一致：先 translate/scale，再围绕 viewport 原点 rotateX，最后 perspective。
export const projectTiltedPoint = (
  point: PixelPoint,
  camera: Pick<ReturnType<typeof getCamera>, "x" | "y" | "scale">,
  viewport: PlateSize,
  tilt: number,
) => {
  const { origin, perspective, radians } = getTiltScene(viewport, tilt);
  const dx = camera.x + point.x * camera.scale - origin.x;
  const dy = camera.y + point.y * camera.scale - origin.y;
  const w = 1 - (dy * Math.sin(radians)) / perspective;
  const depthScale = 1 / w;
  return {
    x: origin.x + dx * depthScale,
    y: origin.y + dy * Math.cos(radians) * depthScale,
    depthScale,
    visible: w > 0,
  };
};

export const unprojectTiltedPoint = (
  screen: PixelPoint,
  viewport: PlateSize,
  tilt: number,
): PixelPoint => {
  const { origin, perspective, radians } = getTiltScene(viewport, tilt);
  const dy =
    (screen.y - origin.y) /
    (Math.cos(radians) +
      ((screen.y - origin.y) * Math.sin(radians)) / perspective);
  const w = 1 - (dy * Math.sin(radians)) / perspective;
  return { x: origin.x + (screen.x - origin.x) * w, y: origin.y + dy };
};

export const getGroundBounds = (viewport: PlateSize, tilt: number) => {
  const points = [
    { x: 0, y: 0 },
    { x: viewport.width, y: 0 },
    { x: 0, y: viewport.height },
    { x: viewport.width, y: viewport.height },
  ].map((point) => unprojectTiltedPoint(point, viewport, tilt));
  const left = Math.min(...points.map((p) => p.x));
  const right = Math.max(...points.map((p) => p.x));
  const top = Math.min(...points.map((p) => p.y));
  const bottom = Math.max(...points.map((p) => p.y));
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};
