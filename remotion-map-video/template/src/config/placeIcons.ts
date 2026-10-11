// 顺序即优先级：夜市优先于“山”，咖啡优先于名字中的“河”等地形词。
export const PLACE_ICON_RULES = [
  { words: ["公园", "花园"], icon: "🌳" },
  { words: ["夜市", "步行街"], icon: "🌃" },
  { words: ["博物馆"], icon: "🏛️" },
  { words: ["咖啡"], icon: "☕" },
  { words: ["糖水", "甜品"], icon: "🍧" },
  { words: ["凉茶", "茶"], icon: "🍵" },
  { words: ["火锅"], icon: "🍲" },
  { words: ["烧烤"], icon: "🍢" },
  { words: ["米粉", "粉", "面"], icon: "🍜" },
  { words: ["酒店"], icon: "🏨" },
  { words: ["车站", "机场"], icon: "🚉" },
  { words: ["海滩"], icon: "🏖️" },
  { words: ["寺", "庙", "塔"], icon: "🏯" },
  { words: ["码头", "湖", "江", "河"], icon: "⛴️" },
  { words: ["巷", "古街"], icon: "🏮" },
  { words: ["商场", "广场"], icon: "🛍️" },
  { words: ["山"], icon: "⛰️" },
] as const;

export const recommendPlaceIcon = (name: string): string =>
  PLACE_ICON_RULES.find((rule) =>
    rule.words.some((word) => name.includes(word)),
  )?.icon ?? "📍";

// 一个 emoji 可以含变体选择符、肤色和 ZWJ；不能用字符串长度判断。
const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
export const isPlaceIcon = (value: string): boolean =>
  Array.from(segmenter.segment(value)).length === 1 &&
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(
    value,
  );
