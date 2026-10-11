// 名称、emoji 和合法配置值共用一个来源，增加交通方式只改这里。
export const TRAVEL_MODES = {
  walk: { label: "走路", emoji: "🚶" },
  car: { label: "汽车", emoji: "🚗" },
  metro: { label: "地铁", emoji: "🚇" },
  train: { label: "高铁", emoji: "🚄" },
} as const;
export type TravelMode = keyof typeof TRAVEL_MODES;
// 最长的词优先匹配，避免把“开车”只吃掉最后一个“车”。
export const TRAVEL_MODE_SYNONYMS: Record<string, TravelMode> = {
  走路: "walk",
  步行: "walk",
  走: "walk",
  车: "car",
  打车: "car",
  开车: "car",
  驾车: "car",
  出租车: "car",
  网约车: "car",
  地铁: "metro",
  高铁: "train",
  动车: "train",
  火车: "train",
};
export const TRAVEL_MODE_KEYS = Object.keys(TRAVEL_MODES) as [
  TravelMode,
  ...TravelMode[],
];
