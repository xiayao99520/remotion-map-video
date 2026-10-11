import { test } from "node:test";
import { layoutBubbleOffsets } from "./labels.ts";
import assert from "node:assert/strict";
import { BUBBLE_STYLE } from "./styles.ts";
test("重合和相邻地点先缩小已走气泡，再有界向上错开；独立远点不动", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 5, y: 1 },
    { x: 3000, y: 3000 },
  ];
  const offsets = layoutBubbleOffsets(points, 0.78, 50);
  assert.deepEqual(offsets, layoutBubbleOffsets(points, 0.78, 50));
  assert.equal(offsets[0].dx, 0);
  assert.equal(offsets[0].dy, 0);
  assert.equal(offsets[0].visitedRadius, BUBBLE_STYLE.compactRadius);
  assert.deepEqual(offsets[3], {
    dx: 0,
    dy: 0,
    visitedRadius: BUBBLE_STYLE.visitedRadius,
  });
  for (const offset of offsets) {
    assert.ok(
      Math.hypot(offset.dx, offset.dy) <= BUBBLE_STYLE.maxOffset + 1e-8,
    );
    assert.ok(offset.dy <= 0);
  }
});
test("两个完全重合点及大量密集点也不越过小气泡直径上限", () => {
  for (const count of [2, 10, 100])
    for (const tilt of [0, 50, 60]) {
      const offsets = layoutBubbleOffsets(
        Array.from({ length: count }, (_, i) => ({ x: i % 2, y: i % 3 })),
        0.78,
        tilt,
      );
      assert.ok(
        offsets.every(
          (offset) =>
            Math.hypot(offset.dx, offset.dy) <= BUBBLE_STYLE.maxOffset + 1e-8,
        ),
      );
    }
});
import { layoutLabels, overlaps, shortLabel } from "./labels.ts";

const boxes = (
  points: { x: number; y: number }[],
  layout: ReturnType<typeof layoutLabels>,
) =>
  layout.map((label, index) => ({
    x: points[index].x + label.dx,
    y: points[index].y + label.dy - 36,
    width: label.width,
    height: 44,
  }));

test("标签布局只由近景点位决定，连续帧得到完全相同的位置", () => {
  const points = [
    { x: 1000, y: 1000 },
    { x: 1010, y: 1030 },
    { x: 1010, y: 1030 },
  ];
  const names = ["春熙路", "太古里", "大慈寺"];
  const first = layoutLabels(points, names);
  for (let frame = 1; frame < 20; frame++)
    assert.deepEqual(layoutLabels(points, names), first);
  boxes(points, first).forEach((box, index, all) =>
    all
      .slice(index + 1)
      .forEach((other) => assert.equal(overlaps(box, other), false)),
  );
});

test("标签默认紧贴圆点，重叠时按上、下、左、右一次性换边", () => {
  const points = [
    { x: 500, y: 500 },
    { x: 500, y: 500 },
  ];
  const layout = layoutLabels(points, ["甲", "乙"]);
  assert.ok(layout[0].dy < 0);
  assert.notDeepEqual(layout[0], layout[1]);
  assert.equal(
    overlaps(boxes(points, layout)[0], boxes(points, layout)[1]),
    false,
  );
  assert.equal(shortLabel("梁阿婆廿年老牌扣肉糯米饭"), "梁阿婆廿年老牌…");
});
