import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRouteText } from "./parse.ts";
import { TRAVEL_MODE_SYNONYMS } from "../config/travelModes.ts";

export const NANNING_TEXT =
  "舒记粉店七星总店（七星路44号）车→ 三街两巷 走路→ 梁阿婆廿年老牌扣肉糯米饭（永宁街华兴里1-4号）走路→ 水街老牌凉茶（水街27号）车→ 中山路夜市 地铁→ 冰神糖水铺（中山路256-1号）高铁→ 亭子码头走路";
test("语料原文：七个点、箭头前的六种交通方式、末站提示", () => {
  const route = parseRouteText(NANNING_TEXT);
  assert.equal(route.stops.length, 7);
  assert.deepEqual(
    route.stops.slice(0, -1).map((s) => s.mode),
    ["car", "walk", "walk", "car", "metro", "train"],
  );
  assert.equal(route.stops[2].name, "梁阿婆廿年老牌扣肉糯米饭");
  assert.equal(route.stops[2].address, "永宁街华兴里1-4号");
  assert.equal(route.stops[6].name, "亭子码头");
  assert.match(route.warnings[0], /已忽略/);
});
test("城市行、半角括号、三种箭头、手动坐标交换及默认提示", () => {
  const route = parseRouteText(
    "城市：南宁\n冰神糖水铺(中山路256-1号)@22.8155,108.3275 高铁-> B => C→ D",
  );
  assert.equal(route.city, "南宁");
  assert.deepEqual(route.stops[0].lngLat, [108.3275, 22.8155]);
  assert.equal(route.stops[0].mode, "train");
  assert.equal(route.warnings.length, 2);
  for (const [word, mode] of Object.entries(TRAVEL_MODE_SYNONYMS))
    assert.equal(parseRouteText(`甲${word}→乙`).stops[0].mode, mode);
});
test("空段、错括号、非法坐标不偷偷生成路线", () => {
  for (const text of [
    "A",
    "A→",
    "A→→B",
    "A(地址→B",
    "A@91,0→B",
    "A@1,181→B",
    "A@xx→B",
  ])
    assert.throws(() => parseRouteText(text));
});
test("#emoji 保留交通方式、地址、坐标；组合 emoji 与两种尾部顺序", () => {
  const parsed = parseRouteText(
    "舒记粉店（七星路44号）#🍜 车→ 公园#🌳→ 博物馆#🏛️",
  );
  assert.equal(parsed.stops[0].name, "舒记粉店");
  assert.equal(parsed.stops[0].address, "七星路44号");
  assert.equal(parsed.stops[0].mode, "car");
  assert.deepEqual(
    parsed.stops.map((stop) => stop.icon),
    ["🍜", "🌳", "🏛️"],
  );
  assert.equal(parseRouteText("甲##️⃣走路→乙").stops[0].icon, "#️⃣");
  for (const text of ["甲#👩🏽‍🍳 @22,108 车→乙", "甲@22,108 #👩🏽‍🍳车→乙"]) {
    const stop = parseRouteText(text).stops[0];
    assert.equal(stop.icon, "👩🏽‍🍳");
    assert.deepEqual(stop.lngLat, [108, 22]);
  }
  for (const text of ["甲#→乙", "甲#中文→乙", "甲#🍜🍵→乙", "甲#🍜#🍵→乙"])
    assert.throws(() => parseRouteText(text));
});
