import { test } from "node:test";
import assert from "node:assert/strict";
import { lightenRouteColor } from "./futureColor.ts";
import { parseMapConfig } from "../config/schema.ts";
test("虚线颜色逐通道提亮30%，允许覆盖并校验格式", () => {
  assert.equal(lightenRouteColor("#ff5a1f"), "#ff8c62");
  assert.equal(lightenRouteColor("#000000"), "#4d4d4d");
  assert.equal(lightenRouteColor("#FFFFFF"), "#ffffff");
  const stops = [
    { name: "甲", lngLat: [0, 0] },
    { name: "乙", lngLat: [1, 1] },
  ];
  assert.equal(
    parseMapConfig({ stops, colors: { future: "#123456" } }).colors.future,
    "#123456",
  );
  assert.throws(
    () => parseMapConfig({ stops, colors: { future: "red" } }),
    /六位十六进制/,
  );
});
