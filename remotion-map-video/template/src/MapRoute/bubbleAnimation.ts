import type { MapConfig } from "../config/schema.ts";
import type { TimelineState } from "./timeline.ts";
import { smooth } from "./timeline.ts";
import { BUBBLE_STYLE } from "./styles.ts";

export const getBadgeOpacity = (state: TimelineState, config: MapConfig) =>
  state.phase === "intro"
    ? smooth((state.introProgress - 0.8) / 0.2)
    : state.phase === "overview"
      ? 1 - smooth(state.phaseFrame / (config.fps * 0.18))
      : 1;

export const getBubbleMotion = (
  index: number,
  state: TimelineState,
  config: MapConfig,
  visitedRadius: number = BUBBLE_STYLE.visitedRadius,
) => {
  const current = index === state.stopIndex;
  const shrinking =
    current && (state.phase === "travel" || state.phase === "overview");
  const shrink = shrinking ? smooth(state.phaseFrame / (config.fps * 0.5)) : 0;
  const large = index > state.stopIndex || current;
  const radius = large
    ? BUBBLE_STYLE.nextRadius +
      (visitedRadius - BUBBLE_STYLE.nextRadius) * shrink
    : visitedRadius;
  const bounceProgress =
    state.phaseFrame / (config.fps * BUBBLE_STYLE.arrivalSeconds);
  const bounce =
    current && state.phase === "hold" && bounceProgress < 1
      ? 1 + 0.08 * Math.sin(Math.PI * bounceProgress)
      : 1;
  // 等待时保持位置；原来的 4px 正弦浮动在像素栅格上会表现为微抖。
  return { radius, centerY: -BUBBLE_STYLE.stemHeight - radius, bounce };
};
