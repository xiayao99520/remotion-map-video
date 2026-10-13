import type { MapConfig } from "../config/schema.ts";
import { TRAVEL_MODES } from "../config/travelModes.ts";
import { recommendPlaceIcon } from "../config/placeIcons.ts";

export const TEXT_FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
export const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const waitForFonts = async (config: MapConfig) => {
  const text = [
    config.title,
    ...config.stops.flatMap((stop) => [stop.name, stop.address ?? ""]),
    "© OpenStreetMap contributors · OpenFreeMap · OpenMapTiles",
    "openstreetmap.org/copyright",
  ].join("");
  const emoji = [
    ...config.stops.map((stop) => stop.icon ?? recommendPlaceIcon(stop.name)),
    ...Object.values(TRAVEL_MODES).map((mode) => mode.emoji),
  ].join("");
  // ready 只等待已经请求过的字体；先请求所有文字和 emoji，不能只等空的字体集合。
  await Promise.all([
    ...[400, 700, 800].map((weight) =>
      document.fonts.load(`${weight} 64px ${TEXT_FONT}`, text),
    ),
    document.fonts.load(`88px ${EMOJI_FONT}`, emoji),
  ]);
  await document.fonts.ready;
};
