import { useMemo, type ReactNode } from "react";
import type { MapConfig } from "../config/schema";
import type { getCamera, PlateSize } from "./camera";
import type { ProjectedRoute } from "./projection";
import type { TimelineState } from "./timeline";
import { PlaceCard, PlaceEmoji } from "./PlaceCard";
import { getMorphAmount } from "./labelMorph";
import { layoutLabels, type BubblePlacement } from "./labels";
import { getStopAppearance } from "./stopVisibility";
import { projectTiltedPoint } from "./tiltProjection";
import { BUBBLE_STYLE, TILT_STYLE } from "./styles";
import { getBubbleMotion } from "./bubbleAnimation";
import { PlaceBubble } from "./PlaceBubble";
import { recommendPlaceIcon } from "../config/placeIcons";

export const PlaceLabels = ({
  config,
  route,
  state,
  camera,
  viewport,
  bubbleOffsets,
  badge,
}: {
  config: MapConfig;
  route: ProjectedRoute;
  state: TimelineState;
  camera: ReturnType<typeof getCamera>;
  viewport: PlateSize;
  bubbleOffsets: BubblePlacement[];
  badge: ReactNode;
}) => {
  const points = route.stops.map((point) =>
    projectTiltedPoint(point, camera, viewport, config.tilt),
  );
  // 只用近景板坐标布局一次；镜头和徽章不会参与换边，因此播放时不会闪躲。
  const labels = useMemo(
    () =>
      layoutLabels(
        route.stops.map((point, index) => ({
          x:
            point.x * (config.tilt === 0 ? 1 : TILT_STYLE.closeScale) +
            bubbleOffsets[index].dx,
          y:
            point.y *
              (config.tilt === 0 ? 1 : TILT_STYLE.closeScale) *
              Math.cos((config.tilt * Math.PI) / 180) +
            bubbleOffsets[index].dy,
        })),
        config.stops.map((stop) => stop.name),
        BUBBLE_STYLE.nextRadius,
      ),
    [route, config.stops, config.tilt, bubbleOffsets],
  );
  const amount = getMorphAmount(state, config);
  const indices = config.stops
    .map((_, index) => index)
    .sort(
      (a, b) =>
        Number(a === state.stopIndex && amount > 0) -
        Number(b === state.stopIndex && amount > 0),
    );
  const renderStops = (layer: "bubbles" | "labels") =>
    indices.map((index) => {
      const stop = config.stops[index];
      const point = points[index];
      const appearance =
        state.phase === "overview"
          ? { visible: true, opacity: 1, popScale: 1 }
          : getStopAppearance(index, state, config);
      if (!appearance.visible) return null;
      if (!point.visible) return null;
      const placement = bubbleOffsets[index];
      const motion = getBubbleMotion(
        index,
        state,
        config,
        placement.visitedRadius,
      );
      motion.centerY += placement.dy;
      // 本地坐标的原点就是地面点；只缩放正面图形，不施加 rotateX。
      const localViewport = {
        width: viewport.width / point.depthScale,
        height: viewport.height / point.depthScale,
      };
      const localPoint = {
        x: point.x / point.depthScale,
        y: point.y / point.depthScale,
      };
      const icon = stop.icon ?? recommendPlaceIcon(stop.name);
      const active = index === state.stopIndex ? amount : 0;
      const bubble = {
        x: localPoint.x + placement.dx,
        y: localPoint.y + motion.centerY,
        fontSize:
          motion.radius *
          appearance.popScale *
          motion.bounce *
          BUBBLE_STYLE.emojiRatio,
      };
      return (
        <g
          key={index}
          opacity={appearance.opacity}
          transform={`scale(${point.depthScale})`}
        >
          {layer === "bubbles" ? (
            <>
              <g transform={`translate(${localPoint.x} ${localPoint.y})`}>
                <PlaceBubble
                  amount={index === state.stopIndex ? amount : 0}
                  offsetX={placement.dx}
                  motion={{
                    ...motion,
                    radius: motion.radius * appearance.popScale,
                  }}
                />
              </g>
              {active === 0 ? (
                <PlaceEmoji icon={icon} name={stop.name} position={bubble} />
              ) : null}
            </>
          ) : (
            <PlaceCard
              icon={icon}
              bubble={bubble}
              showEmoji={active > 0}
              name={stop.name}
              address={stop.address}
              point={localPoint}
              label={{
                x: localPoint.x + placement.dx + labels[index].dx,
                y:
                  localPoint.y -
                  BUBBLE_STYLE.nextRadius -
                  BUBBLE_STYLE.stemHeight +
                  placement.dy +
                  labels[index].dy,
                width: labels[index].width,
                text: labels[index].text,
              }}
              amount={index === state.stopIndex ? amount : 0}
              viewport={localViewport}
            />
          )}
        </g>
      );
    });
  const overlayStyle = {
    position: "absolute" as const,
    overflow: "visible" as const,
    pointerEvents: "none" as const,
  };
  // 气泡在交通徽章下，文字仍在它上面；每站emoji仅在一个层里绘制，避免近点遮住人车。
  return (
    <>
      <svg {...viewport} style={overlayStyle}>
        {renderStops("bubbles")}
      </svg>
      {badge}
      <svg {...viewport} style={overlayStyle}>
        {renderStops("labels")}
      </svg>
    </>
  );
};
