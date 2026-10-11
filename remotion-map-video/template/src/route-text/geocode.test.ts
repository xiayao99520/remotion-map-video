import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGeocoder,
  findDistanceWarnings,
  withinBounds,
  streetFromAddress,
} from "./geocode.ts";
import { parseRouteText } from "./parse.ts";

const city = {
  lat: "22.8",
  lon: "108.3",
  display_name: "南宁市",
  boundingbox: ["22", "24", "107", "110"],
  type: "administrative",
};
const poi = (name: string, lat = "22.8", lon = "108.3") => ({
  lat,
  lon,
  display_name: name,
  osm_type: "node",
  osm_id: 1,
});
const fixture = async (run: (path: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), "map-geocode-"));
  try {
    await run(join(directory, "cache.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
test("查城市后每站带 bounded/viewbox；拒绝合肥结果；地址退街道并显式记录", async () => {
  await fixture(async (cachePath) => {
    const urls: URL[] = [];
    let clock = 0;
    const starts: number[] = [];
    const mock = (async (input, init) => {
      const url = new URL(String(input));
      urls.push(url);
      starts.push(clock);
      assert.match(
        String((init?.headers as Record<string, string>)["User-Agent"]),
        /remotion-map-video/,
      );
      assert.equal(
        (init?.headers as Record<string, string>)["Accept-Language"],
        "zh",
      );
      const q = url.searchParams.get("q")!;
      const results =
        q === "南宁"
          ? [city]
          : q.startsWith("舒记")
            ? [poi("合肥", "31.8", "117.2")]
            : q.startsWith("七星路44")
              ? []
              : q.startsWith("七星路")
                ? [{ ...poi("七星路"), category: "highway" }]
                : [poi("乙")];
      return new Response(JSON.stringify(results));
    }) as typeof fetch;
    const geocoder = await createGeocoder({
      cachePath,
      fetch: mock,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    const report = await geocoder.geocodeStops(
      "南宁",
      parseRouteText("舒记（七星路44号）车→乙").stops,
    );
    assert.equal(report.rows[0].method, "street");
    assert.equal(report.rows[0].matchedName, "七星路");
    assert.equal(
      report.rows[0].sourceUrl,
      "https://www.openstreetmap.org/node/1",
    );
    urls.slice(1).forEach((url) => {
      assert.equal(url.searchParams.get("bounded"), "1");
      assert.equal(url.searchParams.get("viewbox"), "107,24,110,22");
    });
    starts.slice(1).forEach((start, i) => assert.ok(start - starts[i] >= 1000));
    report.rows.forEach((row) =>
      assert.ok(row.lngLat && withinBounds(row.lngLat, report.bounds)),
    );
    const cached = await createGeocoder({
      cachePath,
      fetch: (async () => {
        throw new Error("缓存应阻止网络调用");
      }) as typeof fetch,
    });
    const second = await cached.geocodeStops(
      "南宁",
      parseRouteText("舒记（七星路44号）车→乙").stops,
    );
    assert.equal(second.stats.requests, 0);
    assert.equal(second.stats.cacheHits, urls.length);
    assert.deepEqual(second.rows, report.rows);
  });
});
test("手动优先且校验范围；未找到不生成坐标；查询缓存按城市隔离", async () => {
  await fixture(async (cachePath) => {
    const mock = (async (input) => {
      const q = new URL(String(input)).searchParams.get("q")!;
      return new Response(
        JSON.stringify(["南宁", "桂林"].includes(q) ? [city] : []),
      );
    }) as typeof fetch;
    const client = await createGeocoder({
      cachePath,
      fetch: mock,
      sleep: async () => {},
    });
    const rows = parseRouteText("甲@22.8,108.3车→乙@31,117→丙").stops;
    const report = await client.geocodeStops("南宁", rows);
    assert.equal(report.rows[0].method, "manual");
    assert.equal(report.rows[1].method, "missing");
    assert.equal(report.rows[1].lngLat, undefined);
    assert.equal(report.rows[2].lngLat, undefined);
    const previous = client.stats.requests;
    await client.geocodeStops("桂林", rows);
    assert.equal(client.stats.requests - previous, 2);
    assert.equal(streetFromAddress("永宁街华兴里1-4号"), "永宁街");
    assert.equal(streetFromAddress("成都市青羊区祠堂街9号"), "祠堂街");
  });
});
test("网络错误重试一次且重试节流；HTTP 403 不反复请求；无城市范围报错", async () => {
  await fixture(async (cachePath) => {
    let calls = 0,
      clock = 0;
    const starts: number[] = [];
    const mock = (async () => {
      starts.push(clock);
      if (++calls === 1) throw new TypeError("网络中断");
      return new Response(JSON.stringify([city]));
    }) as typeof fetch;
    const client = await createGeocoder({
      cachePath,
      fetch: mock,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    await client.geocodeStops(
      "南宁",
      parseRouteText("甲@22.8,108.3→乙@22.9,108.4").stops,
    );
    assert.equal(calls, 2);
    assert.ok(starts[1] - starts[0] >= 1000);
    for (const [status, body, expected] of [
      [403, "", /HTTP 403/],
      [200, "[]", /城市范围/],
    ] as const) {
      let count = 0;
      const other = await createGeocoder({
        cachePath: `${cachePath}-${status}`,
        fetch: (async () => {
          count++;
          return new Response(body, { status });
        }) as typeof fetch,
      });
      await assert.rejects(() => other.geocodeStops("南宁", []), expected);
      assert.equal(count, 1);
    }
  });
});

test("某站离其余地点中心超过 20 km 时只给醒目警告", () => {
  const rows = [
    {
      name: "甲",
      lngLat: [108.3, 22.8] as [number, number],
      mode: "walk" as const,
      method: "name" as const,
      matchedName: "甲",
    },
    {
      name: "乙",
      lngLat: [108.31, 22.81] as [number, number],
      mode: "walk" as const,
      method: "name" as const,
      matchedName: "乙",
    },
    {
      name: "冰神",
      lngLat: [109.0, 23.4] as [number, number],
      mode: "walk" as const,
      method: "manual" as const,
      matchedName: "附近位置",
    },
  ];
  const warnings = findDistanceWarnings(rows);
  assert.deepEqual(
    warnings.map((warning) => warning.name),
    ["冰神"],
  );
  assert.ok(warnings[0].distanceKm > 20);
  assert.deepEqual(findDistanceWarnings(rows, 1000), []);
});
