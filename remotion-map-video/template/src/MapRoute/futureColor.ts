// 颜色与白色混合 60%，各通道计算，不依赖 DOM 或播放状态。
export const lightenRouteColor = (color: string) =>
  "#" +
  [1, 3, 5]
    .map((index) =>
      Math.round(parseInt(color.slice(index, index + 2), 16) * 0.4 + 255 * 0.6)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
