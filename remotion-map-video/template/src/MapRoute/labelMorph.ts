import type { MapConfig } from "../config/schema.ts";
import type { PixelPoint } from "./projection.ts";
import { getTiming, smooth, type TimelineState } from "./timeline.ts";
import { LABEL_STYLE, BADGE_RADIUS, ARRIVAL_STYLE } from "./styles.ts";
import { projectTiltedPoint, unprojectTiltedPoint } from "./tiltProjection.ts";

const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const clampTo = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const getMorphAmount = (state: TimelineState, config: MapConfig) => {
  const timing = getTiming(config);
  // 一帧的停留没有时间做连续变形，保留小标签，避免出发时突然弹出卡片。
  if (timing.holdFrames < 2 || state.phase === "intro") return 0;
  const opening = Math.max(
    1,
    Math.min(config.fps * 0.5, timing.holdFrames - 1),
  );
  if (state.phase === "hold") return smooth(state.phaseFrame / opening);
  const closing = Math.max(
    1,
    Math.min(
      config.fps * 0.5,
      (state.phase === "overview" ? timing.outroFrames : timing.travelFrames) -
        1,
    ),
  );
  return 1 - smooth(state.phaseFrame / closing);
};
export const getCardLayout = (
  name: string,
  address: string | undefined,
  point: PixelPoint,
  viewport: { width: number; height: number },
) => {
  const fontSize = Array.from(name).length >= 12 ? 54 : 64;
  const emojiSize = fontSize * 1.2;
  const emojiSpace = emojiSize + 18;
  const width = Math.min(
    viewport.width - 80,
    940,
    Math.max(
      360,
      Array.from(name).length * fontSize + 84 + emojiSpace,
      Array.from(address ?? "").length * 40 + 84,
    ),
  );
  const namePerLine = Math.max(
    1,
    Math.floor((width - 84 - emojiSpace + 1e-6) / fontSize),
  );
  const letters = Array.from(name);
  const lines = Array.from(
    { length: Math.ceil(letters.length / namePerLine) },
    (_, i) => letters.slice(i * namePerLine, (i + 1) * namePerLine).join(""),
  );
  const addressPerLine = Math.max(1, Math.floor((width - 84) / 40));
  const addressLetters = Array.from(address ?? "");
  const addressLines = Array.from(
    { length: Math.ceil(addressLetters.length / addressPerLine) },
    (_, i) =>
      addressLetters
        .slice(i * addressPerLine, (i + 1) * addressPerLine)
        .join(""),
  );
  const titleHeight = lines.length * fontSize * 1.2;
  const height =
    62 + titleHeight + (addressLines.length ? 8 + addressLines.length * 54 : 0);
  const x = clampTo(point.x - width / 2, 40, viewport.width - width - 40);
  const y = clampTo(
    point.y - BADGE_RADIUS - ARRIVAL_STYLE.badgeGap - height,
    160,
    viewport.height - height - 40,
  );
  return {
    x,
    y,
    width,
    height,
    fontSize,
    emojiSize,
    emojiSpace,
    lines,
    addressLines,
    titleHeight,
  };
};

// 初始化时逆算徽章锚点，卡片字号保持正面像素，并计入透视后的实际高度。
export const getArrivalOffset = (
  config: MapConfig,
  index: number,
  viewport: { width: number; height: number },
) => {
  let low = viewport.height * ARRIVAL_STYLE.cardCenterY;
  let high = viewport.height * 0.95;
  for (let i = 0; i < 40; i++) {
    const y = (low + high) / 2;
    const ground = unprojectTiltedPoint(
      { x: viewport.width / 2, y },
      viewport,
      config.tilt,
    );
    const depth = projectTiltedPoint(
      ground,
      { x: 0, y: 0, scale: 1 },
      viewport,
      config.tilt,
    ).depthScale;
    const card = getCardLayout(
      config.stops[index].name,
      config.stops[index].address,
      { x: viewport.width / 2 / depth, y: y / depth },
      { width: viewport.width / depth, height: viewport.height / depth },
    );
    const center = (card.y + card.height / 2) * depth;
    if (center < viewport.height * ARRIVAL_STYLE.cardCenterY) low = y;
    else high = y;
  }
  return (
    unprojectTiltedPoint(
      { x: viewport.width / 2, y: (low + high) / 2 },
      viewport,
      config.tilt,
    ).y -
    viewport.height / 2
  );
};
export const getLabelMorph = (
  amount: number,
  label: PixelPoint & { width: number },
  card: ReturnType<typeof getCardLayout>,
) => ({
  titleX: mix(label.x, card.x + 42 + card.emojiSpace, amount),
  titleY: mix(label.y, card.y + 32 + card.fontSize, amount),
  fontSize: mix(LABEL_STYLE.fontSize, card.fontSize, amount),
  backgroundX: mix(label.x - 8, card.x, amount),
  backgroundY: mix(label.y - LABEL_STYLE.fontSize, card.y, amount),
  backgroundWidth: mix(label.width + 16, card.width, amount),
  backgroundHeight: mix(LABEL_STYLE.height, card.height, amount),
  radius: mix(8, 30, amount),
  backgroundOpacity: amount,
  addressOpacity: smooth((amount - 0.75) / 0.25),
  addressOffsetY: 20 * (1 - smooth((amount - 0.75) / 0.25)),
});

export const getEmojiMorph = (
  amount: number,
  bubble: PixelPoint & { fontSize: number },
  card: ReturnType<typeof getCardLayout>,
) => ({
  x: mix(bubble.x, card.x + 42 + card.emojiSize / 2, amount),
  y: mix(bubble.y, card.y + 32 + card.fontSize * 0.6, amount),
  fontSize: mix(bubble.fontSize, card.emojiSize, amount),
  shellOpacity: 1 - amount,
  shellScale: 1 - amount * 0.7,
});
