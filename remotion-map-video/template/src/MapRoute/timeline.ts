import type { MapConfig } from "../config/schema";
export type TimelineState = {
  legIndex: number;
  phase: "intro" | "travel" | "hold" | "overview";
  progress: number;
  introProgress: number;
  overviewProgress: number;
  markerProgress: number;
  phaseFrame: number;
  stopIndex: number;
};
export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export const smooth = (value: number) => {
  const t = clamp(value);
  // 两端速度和加速度都为零，到点、出发、换段不会突然变向。
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const getTiming = (config: MapConfig) => {
  const travelFrames = Math.max(
    1,
    Math.round(config.secondsPerLeg * config.fps),
  );
  const holdFrames = Math.round(config.holdSeconds * config.fps);
  const introMoveFrames = Math.max(
    2,
    Math.round(config.introSeconds * config.fps),
  );
  // 第一站也需要完整停留，让卡片在推近完成后有时间出现和阅读。
  const introFrames = introMoveFrames + holdFrames;
  const outroFrames = Math.max(2, Math.round(config.outroSeconds * config.fps));
  const legFrames = travelFrames + holdFrames;
  const legCount = config.stops.length - 1;
  return {
    travelFrames,
    holdFrames,
    introFrames,
    introMoveFrames,
    outroFrames,
    legFrames,
    legCount,
    durationInFrames: introFrames + legCount * legFrames + outroFrames,
  };
};
export const getTimeline = (
  frame: number,
  config: MapConfig,
): TimelineState => {
  const timing = getTiming(config);
  const current = Math.min(timing.durationInFrames - 1, Math.max(0, frame));
  const base = { introProgress: 1, overviewProgress: 0, markerProgress: 0 };
  if (current < timing.introMoveFrames)
    return {
      ...base,
      legIndex: 0,
      phase: "intro",
      progress: 0,
      introProgress: smooth(current / (timing.introMoveFrames - 1)),
      phaseFrame: current,
      stopIndex: 0,
    };
  if (current < timing.introFrames)
    return {
      ...base,
      legIndex: 0,
      phase: "hold",
      progress: 0,
      markerProgress: 1,
      phaseFrame: current - timing.introMoveFrames,
      stopIndex: 0,
    };
  const routeFrame = current - timing.introFrames;
  const overviewStart = timing.legCount * timing.legFrames;
  if (routeFrame >= overviewStart)
    return {
      ...base,
      legIndex: timing.legCount - 1,
      phase: "overview",
      progress: 1,
      markerProgress: 1,
      phaseFrame: routeFrame - overviewStart,
      stopIndex: config.stops.length - 1,
      overviewProgress: smooth(
        (routeFrame - overviewStart) / (timing.outroFrames - 1),
      ),
    };
  const legIndex = Math.floor(routeFrame / timing.legFrames);
  const local = routeFrame - legIndex * timing.legFrames;
  if (local >= timing.travelFrames)
    return {
      ...base,
      legIndex,
      phase: "hold",
      progress: 1,
      markerProgress: 1,
      phaseFrame: local - timing.travelFrames,
      stopIndex: legIndex + 1,
    };
  const t = timing.travelFrames <= 1 ? 1 : local / (timing.travelFrames - 1);
  return {
    ...base,
    legIndex,
    phase: "travel",
    progress: smooth(t),
    markerProgress: smooth((t - 0.8) / 0.2),
    phaseFrame: local,
    stopIndex: legIndex,
  };
};
