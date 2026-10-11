import type { MapConfig } from "../config/schema.ts";
import type { TimelineState } from "./timeline.ts";
import { getTiming, smooth } from "./timeline.ts";
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
  const timing = getTiming(config);
  const elapsed =
    state.phase === "intro"
      ? state.phaseFrame
      : state.phase === "hold" && state.stopIndex === 0
        ? timing.introMoveFrames + state.phaseFrame
        : timing.introFrames +
          state.legIndex * timing.legFrames +
          state.phaseFrame +
          (state.phase === "hold" ? timing.travelFrames : 0);
  const float =
    index > state.stopIndex
      ? BUBBLE_STYLE.floatPixels *
        Math.sin(
          (elapsed / (config.fps * BUBBLE_STYLE.floatSeconds)) * Math.PI * 2,
        )
      : 0;
  return { radius, centerY: -BUBBLE_STYLE.stemHeight - radius + float, bounce };
};
