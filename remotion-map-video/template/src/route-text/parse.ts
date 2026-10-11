import type { LngLat } from "../config/schema.ts";
import { isPlaceIcon } from "../config/placeIcons.ts";
import {
  TRAVEL_MODE_SYNONYMS,
  type TravelMode,
} from "../config/travelModes.ts";

export type TextStop = {
  name: string;
  address?: string;
  mode: TravelMode;
  lngLat?: LngLat;
  icon?: string;
};
export type ParsedRoute = {
  city?: string;
  stops: TextStop[];
  warnings: string[];
};
const synonyms = Object.keys(TRAVEL_MODE_SYNONYMS).sort(
  (a, b) => b.length - a.length,
);

export const parseRouteText = (input: string): ParsedRoute => {
  let text = input.replace(/^\uFEFF/, "").trim();
  const cityLine = /^城市\s*[:：]\s*([^\r\n]+)(?:\r?\n|$)/.exec(text);
  const city = cityLine?.[1].trim();
  if (cityLine) text = text.slice(cityLine[0].length).trim();
  const segments = text.split(/→|->|=>/);
  if (segments.length < 2)
    throw new Error("路线至少需要两个地点，用 →、-> 或 => 分隔。");
  const warnings: string[] = [];
  const stops = segments.map((raw, index): TextStop => {
    let segment = raw.trim();
    if (!segment) throw new Error(`第 ${index + 1} 段为空，请检查箭头。`);
    const synonym = synonyms.find((word) => segment.endsWith(word));
    const mode = synonym ? TRAVEL_MODE_SYNONYMS[synonym] : "walk";
    if (synonym) segment = segment.slice(0, -synonym.length).trim();
    if (index === segments.length - 1) {
      if (synonym) warnings.push(`最后一站的“${synonym}”没有下一站，已忽略。`);
    } else if (!synonym)
      warnings.push(`第 ${index + 1} 站未写交通方式，默认走路。`);

    let icon: string | undefined;
    // 图标和手动坐标都属于尾部修饰符，允许二者按任意顺序书写。
    const iconMatch = /#([^\s@]+)\s*(?=@|$)/u.exec(segment);
    if (iconMatch) {
      icon = iconMatch[1];
      if (!isPlaceIcon(icon))
        throw new Error(`第 ${index + 1} 站 # 后必须是一个 emoji。`);
      segment = (
        segment.slice(0, iconMatch.index) +
        segment.slice(iconMatch.index + iconMatch[0].length)
      ).trim();
    }
    if (segment.includes("#"))
      throw new Error(`第 ${index + 1} 站图标格式错误，请写 #🍜。`);
    let lngLat: LngLat | undefined;
    if (segment.includes("@")) {
      const manual =
        /@\s*([+-]?\d+(?:\.\d+)?)\s*[,，]\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(
          segment,
        );
      if (!manual)
        throw new Error(`第 ${index + 1} 站坐标格式错误，请写 @纬度,经度。`);
      const lat = Number(manual[1]);
      const lng = Number(manual[2]);
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw new Error(`第 ${index + 1} 站经纬度超出范围。`);
      // 用户粘贴的是谷歌地图的纬度、经度，内部统一转成经度、纬度。
      lngLat = [lng, lat];
      segment = segment.slice(0, manual.index).trim();
    }
    const place = /^([^（）()]+?)(?:（([^（）]*)）|\(([^()]*)\))?$/.exec(
      segment,
    );
    if (!place?.[1].trim())
      throw new Error(`第 ${index + 1} 站地名或括号格式错误：${segment}`);
    return {
      name: place[1].trim(),
      address: (place[2] ?? place[3])?.trim() || undefined,
      mode: index === segments.length - 1 ? "walk" : mode,
      lngLat,
      ...(icon ? { icon } : {}),
    };
  });
  return { city, stops, warnings };
};
