import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLACE_ICON_RULES,
  recommendPlaceIcon,
  isPlaceIcon,
} from "./placeIcons.ts";
import { parseMapConfig } from "./schema.ts";

test("所有关键词均有推荐，具体场所优先于地形词", () => {
  for (const rule of PLACE_ICON_RULES) {
    for (const word of rule.words)
      assert.equal(recommendPlaceIcon(word), rule.icon);
    assert.ok(isPlaceIcon(rule.icon));
  }
  assert.equal(recommendPlaceIcon("中山路夜市"), "🌃");
  assert.equal(recommendPlaceIcon("江边咖啡"), "☕");
  assert.equal(recommendPlaceIcon("未知店铺"), "📍");
});
test("单个组合 emoji 可配置，拒绝文字和多个 emoji，倾角保持边界", () => {
  for (const icon of ["🏛️", "👩🏽‍🍳", "🇨🇳", "🍜"]) assert.ok(isPlaceIcon(icon));
  const stops = [
    { name: "甲", lngLat: [1, 1], icon: "🍜" },
    { name: "乙", lngLat: [2, 2] },
  ];
  assert.equal(parseMapConfig({ stops }).tilt, 50);
  for (const tilt of [0, 60])
    assert.equal(parseMapConfig({ stops, tilt }).tilt, tilt);
  for (const tilt of [-1, 61])
    assert.throws(() => parseMapConfig({ stops, tilt }));
  for (const icon of ["", "文字", "🍜🍵"])
    assert.throws(() =>
      parseMapConfig({ stops: [{ ...stops[0], icon }, stops[1]] }),
    );
});
