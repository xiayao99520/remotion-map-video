import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapConfig } from "../config/schema.ts";
import {
  createRouteGeometry,
  getTrace,
  positionOnLeg,
  sliceLeg,
} from "./geometry.ts";

test("保留已完成段，到达目标坐标，零进度不生成虚假路线", () => {
  const geometry = createRouteGeometry(
    parseMapConfig({
      stops: [
        { name: "A", lngLat: [104, 30] },
        { name: "B", lngLat: [109, 34] },
        { name: "C", lngLat: [116, 40] },
      ],
    }),
  );
  assert.equal(sliceLeg(geometry.legs[0], 0).length, 0);
  assert.deepEqual(positionOnLeg(geometry.legs[0], 1), [109, 34]);
  assert.equal(getTrace(geometry, 1, 0.5).features.length, 2);
});
test("跨日期变更线的大圆保留所有分段，镜头经度连续", () => {
  const geometry = createRouteGeometry(
    parseMapConfig({
      lineStyle: "greatCircle",
      stops: [
        { name: "A", lngLat: [170, 30] },
        { name: "B", lngLat: [-170, 35] },
      ],
    }),
  );
  assert.equal(geometry.legs[0].segments.length, 2);
  assert.deepEqual(positionOnLeg(geometry.legs[0], 1), [190, 35]);
  assert.ok(
    geometry.coordinates.every(
      ([longitude]) => longitude >= 170 && longitude <= 190,
    ),
  );
});
test("重复地点不会让 Turf 零距离切片出错", () => {
  const geometry = createRouteGeometry(
    parseMapConfig({
      stops: [
        { name: "A", lngLat: [104, 30] },
        { name: "B", lngLat: [104, 30] },
      ],
    }),
  );
  assert.deepEqual(positionOnLeg(geometry.legs[0], 0.5), [104, 30]);
  assert.equal(sliceLeg(geometry.legs[0], 0.5).length, 1);
});
