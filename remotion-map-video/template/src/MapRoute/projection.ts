import type { LngLat } from "../config/schema";
import type { RouteGeometry } from "./geometry";

export type PixelPoint = { x: number; y: number };
export type ProjectedLeg = {
  path: string;
  edges: { from: PixelPoint; to: PixelPoint; start: number; length: number }[];
  length: number;
  start: PixelPoint;
  end: PixelPoint;
};
export type ProjectedRoute = { legs: ProjectedLeg[]; stops: PixelPoint[] };

export const projectRoute = (
  geometry: RouteGeometry,
  project: (coordinate: LngLat) => PixelPoint,
): ProjectedRoute => ({
  stops: geometry.stops.map(project),
  legs: geometry.legs.map((leg) => {
    let length = 0;
    const edges: ProjectedLeg["edges"] = [];
    const parts = leg.segments.map((segment) =>
      segment.geometry.coordinates.map((coordinate) =>
        project(coordinate as LngLat),
      ),
    );
    const path = parts
      .map((points) =>
        points
          .map(
            (point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`,
          )
          .join(" "),
      )
      .join(" ");
    // 保留每个子路径的 M；展开经度后的日期变更线不会错误地连到世界另一侧。
    parts.forEach((points) =>
      points.slice(1).forEach((to, index) => {
        const from = points[index];
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        edges.push({ from, to, start: length, length: distance });
        length += distance;
      }),
    );
    return {
      path,
      edges,
      length,
      start: parts[0][0],
      end: parts[parts.length - 1].at(-1)!,
    };
  }),
});

export const positionOnProjectedLeg = (
  leg: ProjectedLeg,
  progress: number,
): PixelPoint => {
  if (progress <= 0) return leg.start;
  if (progress >= 1 || leg.length === 0) return leg.end;
  const distance = progress * leg.length;
  const edge = leg.edges.find(
    (part) => part.length > 0 && part.start + part.length >= distance,
  );
  if (!edge) return leg.end;
  const t = (distance - edge.start) / edge.length;
  return {
    x: edge.from.x + (edge.to.x - edge.from.x) * t,
    y: edge.from.y + (edge.to.y - edge.from.y) * t,
  };
};
