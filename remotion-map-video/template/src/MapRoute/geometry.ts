import * as turf from "@turf/turf";
import type { Feature, LineString } from "geojson";
import type { LngLat, MapConfig } from "../config/schema";

export type RouteLeg = {
  segments: Feature<LineString>[];
  distances: number[];
  distance: number;
};
export type RouteGeometry = {
  legs: RouteLeg[];
  stops: LngLat[];
  coordinates: LngLat[];
};

const unwrapLongitude = (longitude: number, previous: number) =>
  longitude + 360 * Math.round((previous - longitude) / 360);

export const createRouteGeometry = (config: MapConfig): RouteGeometry => {
  const stops: LngLat[] = [config.stops[0].lngLat];
  const coordinates: LngLat[] = [];
  const legs = config.stops.slice(1).map((stop, index): RouteLeg => {
    const from = config.stops[index].lngLat;
    const generated =
      config.lineStyle === "greatCircle" &&
      (from[0] !== stop.lngLat[0] || from[1] !== stop.lngLat[1])
        ? turf.greatCircle(from, stop.lngLat, { npoints: 160 })
        : turf.lineString([from, stop.lngLat]);
    const parts =
      generated.geometry.type === "LineString"
        ? [generated.geometry.coordinates]
        : generated.geometry.coordinates;
    let previousLongitude = stops[index][0];
    // 大圆跨越日期变更线时保留所有分段，连续展开经度，避免镜头绕地球一圈。
    const segments = parts.map((part) =>
      turf.lineString(
        part.map((position): LngLat => {
          previousLongitude = unwrapLongitude(position[0], previousLongitude);
          const coordinate: LngLat = [previousLongitude, position[1]];
          coordinates.push(coordinate);
          return coordinate;
        }),
      ),
    );
    stops.push([previousLongitude, stop.lngLat[1]]);
    const distances = segments.map((segment) => turf.length(segment));
    return {
      segments,
      distances,
      distance: distances.reduce((sum, distance) => sum + distance, 0),
    };
  });
  return { legs, stops, coordinates };
};

export const sliceLeg = (
  leg: RouteLeg,
  progress: number,
): Feature<LineString>[] => {
  if (progress <= 0) return [];
  if (progress >= 1) return leg.segments;
  let remaining = leg.distance * progress;
  const result: Feature<LineString>[] = [];
  leg.segments.forEach((segment, index) => {
    const distance = leg.distances[index];
    if (remaining >= distance) result.push(segment);
    else if (remaining > 0)
      result.push(turf.lineSliceAlong(segment, 0, remaining));
    remaining = Math.max(0, remaining - distance);
  });
  return result;
};

export const positionOnLeg = (leg: RouteLeg, progress: number): LngLat => {
  if (progress <= 0) return leg.segments[0].geometry.coordinates[0] as LngLat;
  const last = leg.segments[leg.segments.length - 1].geometry.coordinates;
  if (progress >= 1) return last[last.length - 1] as LngLat;
  let remaining = leg.distance * progress;
  for (let index = 0; index < leg.segments.length; index++) {
    if (remaining <= leg.distances[index]) {
      const position = turf.along(leg.segments[index], remaining).geometry
        .coordinates;
      return [
        unwrapLongitude(
          position[0],
          leg.segments[index].geometry.coordinates[0][0],
        ),
        position[1],
      ];
    }
    remaining -= leg.distances[index];
  }
  return last[last.length - 1] as LngLat;
};

export const getTrace = (
  geometry: RouteGeometry,
  legIndex: number,
  progress: number,
) =>
  turf.featureCollection([
    ...geometry.legs.slice(0, legIndex).flatMap((leg) => leg.segments),
    ...sliceLeg(geometry.legs[legIndex], progress),
  ]);
