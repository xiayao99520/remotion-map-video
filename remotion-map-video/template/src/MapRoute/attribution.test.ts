import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import { getAttributionOpacity } from "./attribution.ts";
import { getTiming } from "./timeline.ts";
test("署名默认仅结尾最后2秒淡入，短片尾截取窗口，always全程显示且不能关闭", () => {
  const config = parseMapConfig({
    stops: [
      { name: "甲", lngLat: [0, 0] },
      { name: "乙", lngLat: [1, 1] },
    ],
    outroSeconds: 2.5,
  });
  assert.equal(config.attribution, "end");
  const t = getTiming(config);
  const start = t.durationInFrames - 60;
  for (let f = 0; f <= start; f++)
    assert.equal(getAttributionOpacity(f, config), 0);
  for (let f = start; f < t.durationInFrames; f++)
    assert.ok(
      getAttributionOpacity(f, config) >= getAttributionOpacity(f - 1, config),
    );
  assert.equal(getAttributionOpacity(t.durationInFrames - 1, config), 0.85);
  assert.equal(
    getAttributionOpacity(0, { ...config, attribution: "always" }),
    1,
  );
  assert.throws(() => parseMapConfig({ ...config, attribution: "off" }));
  assert.equal(getAttributionOpacity(0, { ...config, outroSeconds: 0.1 }), 0);
});
