import type { PixelPoint } from "./projection";
import { LABEL_STYLE, MARKER_STYLE, BUBBLE_STYLE } from "./styles.ts";

export type LabelBox = { x: number; y: number; width: number; height: number };
export type LabelPlacement = {
  dx: number;
  dy: number;
  width: number;
  text: string;
};
export const overlaps = (a: LabelBox, b: LabelBox) =>
  a.x < b.x + b.width + LABEL_STYLE.collisionGap &&
  a.x + a.width + LABEL_STYLE.collisionGap > b.x &&
  a.y < b.y + b.height + LABEL_STYLE.collisionGap &&
  a.y + a.height + LABEL_STYLE.collisionGap > b.y;
export const shortLabel = (name: string) => {
  const letters = Array.from(name);
  return letters.length > LABEL_STYLE.maxCharacters
    ? letters.slice(0, LABEL_STYLE.maxCharacters - 1).join("") + "…"
    : name;
};

export type BubblePlacement = { dx: number; dy: number; visitedRadius: number };

// 只比较同时可见的“已走点 + 下一站”；下一站之间不会同时显示大气泡。
export const layoutBubbleOffsets = (
  points: PixelPoint[],
  scale: number,
  tilt: number,
): BubblePlacement[] => {
  const bases = points.map((point) => ({
    x: point.x * scale,
    y: point.y * scale * Math.cos((tilt * Math.PI) / 180),
  }));
  const radii = bases.map((base, i) =>
    bases
      .slice(i + 1)
      .some(
        (other) =>
          Math.hypot(base.x - other.x, base.y - other.y) <
          BUBBLE_STYLE.visitedRadius +
            BUBBLE_STYLE.nextRadius +
            BUBBLE_STYLE.layoutGap,
      )
      ? BUBBLE_STYLE.compactRadius
      : BUBBLE_STYLE.visitedRadius,
  );
  const placements: BubblePlacement[] = [];
  const limit = BUBBLE_STYLE.maxOffset;
  const candidates = [
    { dx: 0, dy: 0 },
    ...[0.5, 1].flatMap((ratio) => [
      { dx: 0, dy: -limit * ratio },
      { dx: (-limit * ratio) / Math.SQRT2, dy: (-limit * ratio) / Math.SQRT2 },
      { dx: (limit * ratio) / Math.SQRT2, dy: (-limit * ratio) / Math.SQRT2 },
    ]),
  ];
  bases.forEach((base, index) => {
    const score = (candidate: PixelPoint) =>
      placements.reduce((total, other, i) => {
        const distance = Math.hypot(
          base.x + candidate.x - bases[i].x - other.dx,
          base.y +
            candidate.y -
            BUBBLE_STYLE.nextRadius -
            (bases[i].y + other.dy - other.visitedRadius),
        );
        return (
          total +
          Math.max(
            0,
            other.visitedRadius +
              BUBBLE_STYLE.nextRadius +
              BUBBLE_STYLE.layoutGap -
              distance,
          )
        );
      }, 0);
    let best = candidates[0];
    let bestScore = score({ x: best.dx, y: best.dy });
    if (bestScore > 0)
      for (const candidate of candidates.slice(1)) {
        const value = score({ x: candidate.dx, y: candidate.dy });
        if (value < bestScore) {
          best = candidate;
          bestScore = value;
        }
        if (bestScore === 0) break;
      }
    placements.push({ ...best, visitedRadius: radii[index] });
  });
  return placements;
};

// 只接受近景板坐标，不接收帧号、镜头或徽章：换边决定与播放位置无关。
export const layoutLabels = (
  points: PixelPoint[],
  names: string[],
  bubbleRadius = 0,
): LabelPlacement[] => {
  const occupied: LabelBox[] = [];
  return points.map((point, index) => {
    const text = shortLabel(names[index]);
    const width = Array.from(text).length * LABEL_STYLE.fontSize + 8;
    for (let ring = 0; ; ring++) {
      const gap =
        (bubbleRadius || MARKER_STYLE.nextRadius) +
        LABEL_STYLE.gap +
        ring * (LABEL_STYLE.height + LABEL_STYLE.collisionGap);
      const candidates = bubbleRadius
        ? [
            {
              dx: -gap - width,
              dy: LABEL_STYLE.fontSize - LABEL_STYLE.height / 2,
            },
            { dx: gap, dy: LABEL_STYLE.fontSize - LABEL_STYLE.height / 2 },
            { dx: -width / 2, dy: gap + LABEL_STYLE.fontSize },
            {
              dx: -width / 2,
              dy: -gap - LABEL_STYLE.height + LABEL_STYLE.fontSize,
            },
          ]
        : [
            {
              dx: -width / 2,
              dy: -gap - LABEL_STYLE.height + LABEL_STYLE.fontSize,
            },
            { dx: -width / 2, dy: gap + LABEL_STYLE.fontSize },
            {
              dx: -gap - width,
              dy: LABEL_STYLE.fontSize - LABEL_STYLE.height / 2,
            },
            { dx: gap, dy: LABEL_STYLE.fontSize - LABEL_STYLE.height / 2 },
          ];
      // 四侧都挤满时才向外增加一圈，重合地点也能结束布局，仍只避让文字。
      for (const candidate of candidates) {
        const box = {
          x: point.x + candidate.dx,
          y: point.y + candidate.dy - LABEL_STYLE.fontSize,
          width,
          height: LABEL_STYLE.height,
        };
        if (occupied.some((other) => overlaps(box, other))) continue;
        occupied.push(box);
        return { ...candidate, width, text };
      }
    }
  });
};
