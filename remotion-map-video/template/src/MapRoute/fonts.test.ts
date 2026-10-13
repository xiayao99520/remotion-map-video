import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForFonts, TEXT_FONT, EMOJI_FONT } from "./fonts.ts";
import { parseMapConfig } from "../config/schema.ts";

test("字体屏障包含全部中文和交通 emoji，未完成或失败时不会放行", async (t) => {
  const config = parseMapConfig({
    title: "路线标题",
    stops: [
      { name: "甲", address: "地址一", icon: "🏮", lngLat: [1, 1] },
      { name: "乙", icon: "🍧", lngLat: [2, 2] },
    ],
  });
  const calls: { font: string; text: string }[] = [];
  let releaseLoad!: () => void;
  let releaseReady!: () => void;
  const loaded = new Promise<void>((resolve) => (releaseLoad = resolve));
  const ready = new Promise<void>((resolve) => (releaseReady = resolve));
  const fonts = {
    load: (font: string, text: string) => {
      calls.push({ font, text });
      return loaded;
    },
    ready,
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    value: { fonts },
    configurable: true,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  });
  let finished = false;
  const waiting = waitForFonts(config).then(() => (finished = true));
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(calls.length, 4);
  const chinese = calls.filter((call) => call.font.includes(TEXT_FONT));
  assert.equal(chinese.length, 3);
  assert.ok(chinese.every((call) => call.text.includes("路线标题甲地址一乙")));
  const emoji = calls.find((call) => call.font.includes(EMOJI_FONT))!;
  for (const icon of ["🏮", "🍧", "🚶", "🚗", "🚇", "🚄"])
    assert.ok(emoji.text.includes(icon));
  releaseLoad();
  await Promise.resolve();
  assert.equal(finished, false);
  releaseReady();
  await waiting;
  assert.equal(finished, true);
  fonts.load = () => Promise.reject(new Error("字体加载失败"));
  await assert.rejects(waitForFonts(config), /字体加载失败/);
});
