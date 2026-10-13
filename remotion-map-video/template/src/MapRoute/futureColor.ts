// 只混入 30% 白色，浅色底图上仍能清楚辨认下一段。
export const lightenRouteColor = (color: string) =>
  "#" +
  [1, 3, 5]
    .map((index) =>
      Math.round(parseInt(color.slice(index, index + 2), 16) * 0.7 + 255 * 0.3)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
