import { test } from "node:test";
import assert from "node:assert/strict";
import { getDimensions, parseMapConfig } from "./schema.ts";

const stops = [
  { name: "上海", lngLat: [121.4737, 31.2304] },
  { name: "杭州", lngLat: [120.1551, 30.2741] },
];
test("只提供地点也能补齐默认配置，局部颜色也有默认值", () => {
  const config = parseMapConfig({ stops, colors: { line: "#123456" } });
  assert.equal(config.fps, 30);
  assert.equal(config.colors.marker, "#ed7b20");
  assert.equal(config.secondsPerLeg, 3);
});
test("错误位置与中文原因清楚可读", () => {
  assert.throws(
    () =>
      parseMapConfig({
        stops: [{ name: "上海", lngLat: [121, 200] }, stops[1]],
      }),
    /stops\.0\.lngLat\.1：纬度/,
  );
  assert.throws(
    () => parseMapConfig({ stops: [stops[0]] }),
    /至少需要两个地点/,
  );
  assert.throws(
    () => parseMapConfig({ stops, colors: { line: "red" } }),
    /六位十六进制/,
  );
  assert.throws(
    () => parseMapConfig({ stops, secondsPerLeg: 0 }),
    /必须大于 0/,
  );
});
test("三个画幅映射为指定分辨率", () => {
  assert.deepEqual(getDimensions("9:16"), { width: 1080, height: 1920 });
  assert.deepEqual(getDimensions("16:9"), { width: 1920, height: 1080 });
  assert.deepEqual(getDimensions("1:1"), { width: 1080, height: 1080 });
});
