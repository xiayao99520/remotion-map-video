import { test } from "node:test";
import assert from "node:assert/strict";
import { TRAVEL_MODES } from "./travelModes.ts";
import { parseMapConfig } from "./schema.ts";

test("交通 emoji 对照表、默认值、地址及近景缩放校验", () => {
  assert.deepEqual(
    Object.values(TRAVEL_MODES).map((mode) => mode.emoji),
    ["🚶", "🚗", "🚇", "🚄"],
  );
  const stops = [
    { name: "A", lngLat: [0, 0] },
    { name: "B", lngLat: [1, 1] },
  ];
  const config = parseMapConfig({ stops });
  assert.equal(config.stops[0].mode, "walk");
  assert.equal(config.closeZoom, 16.5);
  for (const mode of Object.keys(TRAVEL_MODES)) {
    assert.equal(
      parseMapConfig({
        stops: [{ ...stops[0], mode, address: "地址" }, stops[1]],
      }).stops[0].address,
      "地址",
    );
  }
  for (const closeZoom of [11.9, 18.1, NaN])
    assert.throws(() => parseMapConfig({ stops, closeZoom }));
  assert.throws(() =>
    parseMapConfig({ stops: [{ ...stops[0], mode: "unknown" }, stops[1]] }),
  );
});
