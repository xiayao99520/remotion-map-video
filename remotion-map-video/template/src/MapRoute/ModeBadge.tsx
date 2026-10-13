import { TRAVEL_MODES, type TravelMode } from "../config/travelModes";
import { BADGE_RADIUS } from "./styles";
import { EMOJI_FONT } from "./fonts";

export const ModeBadge = ({
  x,
  y,
  mode,
  opacity,
  scale = 1,
}: {
  x: number;
  y: number;
  mode: TravelMode;
  opacity: number;
  scale?: number;
}) => {
  if (opacity === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 2,
        left: x - BADGE_RADIUS,
        top: y - BADGE_RADIUS,
        width: BADGE_RADIUS * 2,
        height: BADGE_RADIUS * 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: "white",
        boxShadow: "0 8px 28px rgba(35,45,55,0.2)",
        opacity,
        transform: `scale(${scale})`,
        fontSize: 88,
        lineHeight: 1,
        fontFamily: EMOJI_FONT,
      }}
      aria-label={TRAVEL_MODES[mode].label}
    >
      {TRAVEL_MODES[mode].emoji}
    </div>
  );
};
