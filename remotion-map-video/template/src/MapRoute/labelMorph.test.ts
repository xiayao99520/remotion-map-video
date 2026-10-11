import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import { getTimeline, getTiming } from "./timeline.ts";
import {
  getMorphAmount,
  getCardLayout,
  getLabelMorph,
  getEmojiMorph,
} from "./labelMorph.ts";

const config = parseMapConfig({
  stops: [
    { name: "甲", lngLat: [0, 0] },
    { name: "乙", lngLat: [1, 1] },
    { name: "丙", lngLat: [2, 2] },
  ],
});
test("首站推近结束才展开；到站、出发、结尾连续，只有一站变形", () => {
  const t = getTiming(config);
  const amount = (frame: number) =>
    getMorphAmount(getTimeline(frame, config), config);
  for (const start of [
    t.introMoveFrames,
    t.introFrames + t.travelFrames,
    t.introFrames + t.legFrames + t.travelFrames,
  ]) {
    assert.equal(amount(start - 1), 0);
    assert.equal(amount(start), 0);
    assert.equal(amount(start + 15), 1);
  }
  for (const start of [
    t.introFrames,
    t.introFrames + t.legFrames,
    t.durationInFrames - t.outroFrames,
  ]) {
    assert.equal(amount(start - 1), 1);
    assert.equal(amount(start), 1);
    assert.equal(amount(start + 15), 0);
  }
  for (let frame = 1; frame < t.durationInFrames; frame++)
    assert.ok(Math.abs(amount(frame) - amount(frame - 1)) < 0.13);
  const at = amount(171);
  amount(500);
  assert.equal(amount(171), at);
  assert.equal(amount(t.durationInFrames - 1), 0);
});
test("文字位置字号与背景插值端点正确，地址后段上浮；长标题完整换行且在画面内", () => {
  const viewport = { width: 1080, height: 1920 };
  const name = "梁阿婆廿年老牌扣肉糯米饭";
  const card = getCardLayout(
    name,
    "永宁街华兴里1-4号",
    { x: 540, y: 1190 },
    viewport,
  );
  assert.equal(card.lines.join(""), name);
  assert.ok(card.x >= 40 && card.x + card.width <= viewport.width - 40);
  assert.ok(card.y >= 160 && card.y + card.height <= viewport.height - 40);
  const label = { x: 636, y: 1166, width: 296 };
  const a = getLabelMorph(0, label, card),
    b = getLabelMorph(1, label, card);
  assert.equal(a.titleX, label.x);
  assert.equal(a.titleY, label.y);
  assert.equal(a.fontSize, 36);
  assert.equal(a.backgroundOpacity, 0);
  assert.equal(a.addressOffsetY, 20);
  assert.equal(b.titleX, card.x + 42 + card.emojiSpace);
  assert.equal(b.fontSize, 54);
  assert.equal(b.backgroundWidth, card.width);
  assert.equal(b.addressOpacity, 1);
  assert.equal(b.addressOffsetY, 0);
  assert.equal(getLabelMorph(0.7, label, card).addressOpacity, 0);
  for (let i = 0; i <= 100; i++) {
    const m = getLabelMorph(i / 100, label, card);
    assert.ok(m.titleX >= b.titleX && m.titleX <= a.titleX);
  }
});

test("emoji 起点在气泡中心，终点位于标题左侧，中间连续且卡片为图标留足空间", () => {
  const card = getCardLayout(
    "非常长的地点名称需要完整换行显示",
    "示例地址",
    { x: 1050, y: 1100 },
    { width: 1080, height: 1920 },
  );
  const bubble = { x: 1050, y: 1000, fontSize: 60 };
  assert.deepEqual(getEmojiMorph(0, bubble, card), {
    ...bubble,
    shellOpacity: 1,
    shellScale: 1,
  });
  const end = getEmojiMorph(1, bubble, card);
  assert.equal(end.fontSize, card.fontSize * 1.2);
  assert.ok(end.fontSize > bubble.fontSize);
  assert.ok(Math.abs(end.x - (card.x + 42 + card.emojiSize / 2)) < 1e-8);
  assert.equal(end.shellOpacity, 0);
  assert.ok(
    end.x + end.fontSize / 2 <
      getLabelMorph(1, { x: 900, y: 950, width: 200 }, card).titleX,
  );
  assert.ok(
    card.lines.every(
      (line) =>
        Array.from(line).length * card.fontSize <=
        card.width - 84 - card.emojiSpace,
    ),
  );
  let previous = getEmojiMorph(0, bubble, card);
  for (let i = 1; i <= 100; i++) {
    const current = getEmojiMorph(i / 100, bubble, card);
    assert.ok(Math.abs(current.x - previous.x) < 10);
    assert.ok(Math.abs(current.y - previous.y) < 10);
    previous = current;
  }
});
test("零停留、低 fps 单帧停留及短行进不产生卡片跳变", () => {
  for (const holdSeconds of [0, 1]) {
    const low = { ...config, fps: 1, holdSeconds };
    for (let frame = 0; frame < getTiming(low).durationInFrames; frame++)
      assert.equal(getMorphAmount(getTimeline(frame, low), low), 0);
  }
  const short = { ...config, secondsPerLeg: 0.1 };
  const timing = getTiming(short);
  assert.equal(
    getMorphAmount(
      getTimeline(timing.introFrames + timing.travelFrames - 1, short),
      short,
    ),
    0,
  );
});

test("标题占位刚好够一行时，不因浮点舍入把最后一个字挤到第二行", () => {
  const card = getCardLayout(
    "水街老牌凉茶",
    undefined,
    { x: 540, y: 1100 },
    { width: 1080, height: 1920 },
  );
  assert.deepEqual(card.lines, ["水街老牌凉茶"]);
});
