import type { MapConfig } from "../config/schema.ts";
import { getTiming, smooth } from "./timeline.ts";

export const getAttributionOpacity = (frame: number, config: MapConfig) => {
  if (config.attribution === "always") return 1;
  const timing = getTiming(config);
  const window = Math.min(timing.outroFrames, Math.round(config.fps * 2));
  const start = timing.durationInFrames - window;
  return (
    smooth(
      (frame - start) / Math.max(1, Math.min(config.fps * 0.25, window - 1)),
    ) * 0.85
  );
};
