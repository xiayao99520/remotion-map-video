import { useId } from "react";
import { getCardLayout, getLabelMorph, getEmojiMorph } from "./labelMorph";
import type { PixelPoint } from "./projection";
import { EMOJI_FONT } from "./fonts";

export const PlaceEmoji = ({
  icon,
  name,
  position,
}: {
  icon: string;
  name: string;
  position: PixelPoint & { fontSize: number };
}) => (
  <text
    x={position.x}
    y={position.y}
    textAnchor="middle"
    dominantBaseline="central"
    fontSize={position.fontSize}
    fontFamily={EMOJI_FONT}
    data-place-emoji={name}
  >
    {icon}
  </text>
);

export const PlaceCard = ({
  name,
  address,
  point,
  label,
  amount,
  viewport,
  icon,
  bubble,
  showEmoji = true,
}: {
  name: string;
  address?: string;
  point: PixelPoint;
  label: PixelPoint & { width: number; text: string };
  amount: number;
  viewport: { width: number; height: number };
  icon: string;
  bubble: PixelPoint & { fontSize: number };
  showEmoji?: boolean;
}) => {
  const card = getCardLayout(name, address, point, viewport);
  const morph = getLabelMorph(amount, label, card);
  const emoji = getEmojiMorph(amount, bubble, card);
  const clipId = useId();
  const lines = amount === 0 ? [label.text] : card.lines;
  return (
    <g>
      {amount > 0 ? (
        <defs>
          <clipPath id={clipId}>
            <rect
              x={morph.titleX - 4}
              y={morph.titleY - morph.fontSize - 4}
              width={
                Math.max(
                  0,
                  Math.min(
                    viewport.width - morph.titleX - 36,
                    label.width +
                      (card.width - 84 - card.emojiSpace - label.width) *
                        amount,
                  ),
                ) + 8
              }
              height={44 + (card.titleHeight - 44) * amount + 8}
            />
          </clipPath>
        </defs>
      ) : null}
      {/* 收起后移除背景、阴影和地址，不把透明滤镜图层留在合成器里。 */}
      {amount > 0 ? (
        <g
          opacity={morph.backgroundOpacity}
          data-place-card={name}
          style={{ filter: "drop-shadow(0 10px 20px rgba(35,45,55,0.18))" }}
        >
          <rect
            x={morph.backgroundX}
            y={morph.backgroundY}
            width={morph.backgroundWidth}
            height={morph.backgroundHeight}
            rx={morph.radius}
            fill="white"
          />
          <path
            d={`M ${Math.max(morph.backgroundX + 26, Math.min(morph.backgroundX + morph.backgroundWidth - 26, point.x)) - 22},${morph.backgroundY + morph.backgroundHeight - 1} l 44,0 l -22,${24 * amount} Z`}
            fill="white"
          />
        </g>
      ) : null}
      {/* 气泡与卡片共用这一份 emoji，始终保持完整可见。 */}
      {showEmoji ? (
        <PlaceEmoji icon={icon} name={name} position={emoji} />
      ) : null}
      {/* 一个 text 元素在小标签和标题之间移动；没有叠加的第二份地名。 */}
      <text
        x={morph.titleX}
        y={morph.titleY}
        fontSize={morph.fontSize}
        fontWeight={700 + 100 * amount}
        fill="#172b3a"
        stroke="white"
        strokeWidth={8 * (1 - amount)}
        paintOrder="stroke"
        strokeLinejoin="round"
        clipPath={amount > 0 ? `url(#${clipId})` : undefined}
      >
        {lines.map((line, index) => (
          <tspan
            key={index}
            x={morph.titleX}
            dy={index === 0 ? 0 : morph.fontSize * 1.2}
          >
            {line}
          </tspan>
        ))}
      </text>
      {morph.addressOpacity > 0 && card.addressLines.length ? (
        <text
          x={card.x + 42}
          y={card.y + 32 + card.titleHeight + 48 + morph.addressOffsetY}
          fontSize={40}
          fill="#93999d"
          opacity={morph.addressOpacity}
        >
          {card.addressLines.map((line, index) => (
            <tspan key={index} x={card.x + 42} dy={index === 0 ? 0 : 54}>
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
};
