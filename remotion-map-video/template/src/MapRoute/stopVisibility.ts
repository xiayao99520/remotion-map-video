import type { MapConfig } from "../config/schema.ts";
import { getTiming, smooth, type TimelineState } from "./timeline.ts";
import { NEXT_STOP_STYLE } from "./styles.ts";

export const getStopAppearance = (
  index: number,
  state: TimelineState,
  config: MapConfig,
) => {
  const timing = getTiming(config);
  // 到站停留期间不提前展示再下一站；其弹出从下一段出发帧开始。
  const visited = index <= state.stopIndex;
  const next =
    state.phase === "intro" || (state.phase === "hold" && state.stopIndex === 0)
      ? index === 1
      : state.phase === "travel" && index === state.legIndex + 1;
  const elapsed =
    index === 1
      ? state.phase === "intro"
        ? state.phaseFrame
        : timing.introMoveFrames
      : state.phaseFrame;
  const duration = Math.max(
    1,
    Math.round(config.fps * NEXT_STOP_STYLE.popSeconds),
  );
  const t = next ? Math.min(1, elapsed / duration) : 1;
  const opacity = smooth(t);
  const popScale =
    t < 0.7
      ? NEXT_STOP_STYLE.initialScale +
        (NEXT_STOP_STYLE.overshootScale - NEXT_STOP_STYLE.initialScale) *
          smooth(t / 0.7)
      : NEXT_STOP_STYLE.overshootScale +
        (1 - NEXT_STOP_STYLE.overshootScale) * smooth((t - 0.7) / 0.3);
  const cycleFrames = Math.max(
    1,
    Math.round(config.fps * NEXT_STOP_STYLE.pulseSeconds),
  );
  const pulse = (elapsed % cycleFrames) / cycleFrames;
  return {
    visible: visited || next,
    visited,
    next,
    opacity: visited ? 1 : opacity,
    popScale: visited ? 1 : popScale,
    pulseRadius: NEXT_STOP_STYLE.pulseExpansion * pulse,
    pulseOpacity: next
      ? NEXT_STOP_STYLE.pulseOpacity * (1 - pulse) * opacity
      : 0,
  };
};
