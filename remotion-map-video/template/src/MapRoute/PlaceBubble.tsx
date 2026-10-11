import { BUBBLE_STYLE } from "./styles";
import type { getBubbleMotion } from "./bubbleAnimation";

export const PlaceBubble = ({
  motion,
  offsetX,
  amount,
}: {
  amount: number;
  motion: ReturnType<typeof getBubbleMotion>;
  offsetX: number;
}) => (
  <g opacity={1 - amount}>
    {/* 杆的下端固定在投影点；浮动和弹跳只改变上端，不让落脚点漂移。 */}
    <path
      d={`M ${offsetX - 7},${motion.centerY + motion.radius - 4} L ${offsetX + 7},${motion.centerY + motion.radius - 4} L 0,0 Z`}
      fill="white"
    />
    <g
      transform={`translate(${offsetX} ${motion.centerY}) scale(${motion.bounce * (1 - amount * 0.7)})`}
      style={{ filter: BUBBLE_STYLE.shadow }}
    >
      <circle r={motion.radius} fill="white" />
    </g>
  </g>
);
