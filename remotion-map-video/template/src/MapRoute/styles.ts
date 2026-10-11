// 均为正面基准像素；地面线条抵消镜头缩放后仍保留透视，气泡只按远近缩放。
export const LABEL_STYLE = {
  fontSize: 36,
  height: 44,
  maxCharacters: 8,
  gap: 12,
  collisionGap: 8,
};
export const BADGE_RADIUS = 76;
export const MARKER_STYLE = {
  visitedRadius: 16,
  nextRadius: 22,
  strokeWidth: 5,
  nextStrokeWidth: 7,
};
export const ROUTE_STYLE = {
  width: 14,
  casingWidth: 24,
  futureWidth: 8,
  futureCasingWidth: 14,
  futureDash: 18,
  futureGap: 14,
};
export const TILT_STYLE = {
  originY: 0.62,
  perspectiveHeights: 2.8,
  closeScale: 0.78,
  detailStart: 0.85,
  detailEnd: 0.98,
};
export const BUBBLE_STYLE = {
  nextRadius: 75,
  visitedRadius: 45,
  compactRadius: 32,
  maxOffset: 64,
  stemHeight: 24,
  // 小气泡字号低于卡片标题图标，到站时才能真正放大（标题图标为字号的1.2倍）。
  emojiRatio: 0.8,
  floatPixels: 4,
  floatSeconds: 1.8,
  arrivalSeconds: 0.3,
  shadow: "drop-shadow(0 8px 14px rgba(35,45,55,0.2))",
  labelGap: 16,
  layoutGap: 16,
};
export const ARRIVAL_STYLE = {
  cardCenterY: 0.46,
  badgeGap: 26,
};
export const NEXT_STOP_STYLE = {
  popSeconds: 0.3,
  initialScale: 0.86,
  overshootScale: 1.06,
  pulseSeconds: 1.2,
  pulseExpansion: 32,
  pulseOpacity: 0.5,
  pulseStrokeWidth: 5,
};
