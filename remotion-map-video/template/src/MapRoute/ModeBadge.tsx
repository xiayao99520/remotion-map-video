import { TRAVEL_MODES, type TravelMode } from "../config/travelModes";
import { BADGE_RADIUS } from "./styles";

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
  return (
    <div
      style={{
        position: "absolute",
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
        fontFamily:
          '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
      }}
      aria-label={TRAVEL_MODES[mode].label}
    >
      {TRAVEL_MODES[mode].emoji}
    </div>
  );
};
