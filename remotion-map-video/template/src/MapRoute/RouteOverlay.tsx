import type { MapConfig } from "../config/schema";
import type { PlateSize } from "./camera";
import type { ProjectedRoute } from "./projection";
import type { TimelineState } from "./timeline";
import { MARKER_STYLE, NEXT_STOP_STYLE, ROUTE_STYLE } from "./styles";
import { getStopAppearance } from "./stopVisibility";
import { lightenRouteColor } from "./futureColor";

export const RouteOverlay = ({
  config,
  route,
  state,
  plate,
  scale,
}: {
  config: MapConfig;
  route: ProjectedRoute;
  state: TimelineState;
  plate: PlateSize;
  scale: number;
}) => {
  return (
    <svg
      width={plate.width}
      height={plate.height}
      style={{ position: "absolute", overflow: "visible" }}
    >
      {(state.phase === "intro" ||
        state.phase === "travel" ||
        (state.phase === "hold" && state.stopIndex === 0)) &&
      state.progress < 1 ? (
        <g>
          <path
            d={route.legs[state.legIndex].path}
            fill="none"
            stroke="white"
            strokeWidth={ROUTE_STYLE.futureCasingWidth / scale}
            strokeDasharray={`${ROUTE_STYLE.futureDash / scale} ${ROUTE_STYLE.futureGap / scale}`}
            strokeLinejoin="round"
          />
          <path
            d={route.legs[state.legIndex].path}
            fill="none"
            stroke={
              config.colors.future ?? lightenRouteColor(config.colors.line)
            }
            strokeWidth={ROUTE_STYLE.futureWidth / scale}
            strokeDasharray={`${ROUTE_STYLE.futureDash / scale} ${ROUTE_STYLE.futureGap / scale}`}
            strokeLinejoin="round"
          />
        </g>
      ) : null}
      {route.legs.map((leg, index) => {
        const progress =
          index < state.legIndex
            ? 1
            : index === state.legIndex
              ? state.progress
              : 0;
        if (progress <= 0 || leg.length === 0) return null;
        return (
          <g key={index}>
            <path
              d={leg.path}
              pathLength={1}
              fill="none"
              stroke="white"
              strokeWidth={ROUTE_STYLE.casingWidth / scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 1"
              strokeDashoffset={1 - progress}
            />
            <path
              d={leg.path}
              pathLength={1}
              fill="none"
              stroke={config.colors.line}
              strokeWidth={ROUTE_STYLE.width / scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 1"
              strokeDashoffset={1 - progress}
            />
          </g>
        );
      })}
      {route.stops.map((point, index) => {
        const appearance =
          state.phase === "overview"
            ? {
                visible: true,
                visited: true,
                next: false,
                opacity: 1,
                popScale: 1,
                pulseRadius: 0,
                pulseOpacity: 0,
              }
            : getStopAppearance(index, state, config);
        if (!appearance.visible) return null;
        return (
          <g
            key={index}
            transform={`translate(${point.x},${point.y}) scale(${1 / scale})`}
            opacity={appearance.opacity}
          >
            {appearance.next ? (
              <circle
                r={MARKER_STYLE.nextRadius + appearance.pulseRadius}
                fill="none"
                stroke={config.colors.marker}
                strokeWidth={NEXT_STOP_STYLE.pulseStrokeWidth}
                opacity={appearance.pulseOpacity}
              />
            ) : null}
            <circle
              r={
                appearance.next
                  ? MARKER_STYLE.nextRadius * appearance.popScale
                  : MARKER_STYLE.visitedRadius
              }
              fill={
                appearance.visited || appearance.next
                  ? config.colors.marker
                  : "white"
              }
              stroke={
                appearance.visited || appearance.next
                  ? "white"
                  : config.colors.marker
              }
              strokeWidth={
                appearance.next
                  ? MARKER_STYLE.nextStrokeWidth
                  : MARKER_STYLE.strokeWidth
              }
            />
          </g>
        );
      })}
    </svg>
  );
};
