import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir, open, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRouteText } from "../src/route-text/parse.ts";
import {
  createGeocoder,
  findDistanceWarnings,
  MATCH_LABELS,
} from "../src/route-text/geocode.ts";
import { parseMapConfig } from "../src/config/schema.ts";
import { TRAVEL_MODES } from "../src/config/travelModes.ts";
import { recommendPlaceIcon } from "../src/config/placeIcons.ts";

const main = async () => {
  const start = performance.now();
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      text: { type: "string" },
      out: { type: "string" },
      city: { type: "string" },
      title: { type: "string" },
      aspect: { type: "string" },
    },
  });
  if (
    (!values.input && !values.text) ||
    (values.input && values.text) ||
    !values.out
  )
    throw new Error(
      "请提供 --input 文件 或 --text 语料，并指定 --out 输出.json。",
    );
  if (values.aspect && !["9:16", "16:9", "1:1"].includes(values.aspect))
    throw new Error("比例必须是 9:16、16:9 或 1:1。");
  const parsed = parseRouteText(
    values.text ?? (await readFile(resolve(values.input!), "utf8")),
  );
  const city = values.city?.trim() || parsed.city;
  if (!city) throw new Error("请用 --city 南宁，或在语料第一行写 城市：南宁。");
  if (values.city && parsed.city && values.city !== parsed.city)
    console.log(
      `提示：命令行城市“${values.city}”覆盖语料城市“${parsed.city}”。`,
    );
  parsed.warnings.forEach((warning) => console.log(`提示：${warning}`));
  console.log(
    "Nominatim 公益服务：单机串行、最多每秒一请求、缓存复用；勿用于高频或定期批量查询。\n使用规则：https://operations.osmfoundation.org/policies/nominatim/",
  );
  const cachePath = fileURLToPath(
    new URL("../.cache/geocode.json", import.meta.url),
  );
  await mkdir(dirname(cachePath), { recursive: true });
  const lockPath = `${cachePath}.lock`;
  // 防止两个 CLI 进程同时请求，突破应用整体的每秒一次限额。
  const lock = await open(lockPath, "wx").catch(() => {
    throw new Error(
      `另一个查询正在执行；若上次异常退出，请确认无查询进程后删除 ${lockPath}。`,
    );
  });
  try {
    const geocoder = await createGeocoder({
      cachePath,
      baseUrl: process.env.NOMINATIM_SEARCH_URL,
    });
    const report = await geocoder.geocodeStops(city, parsed.stops);
    report.rows = report.rows.map((row) => ({
      ...row,
      icon: row.icon ?? recommendPlaceIcon(row.name),
    }));
    const distanceWarnings = findDistanceWarnings(report.rows);
    const warningByIndex = new Map(
      distanceWarnings.map((warning) => [warning.index, warning]),
    );
    console.table(
      report.rows.map((row, index) => ({
        序号: index + 1,
        地名: row.name,
        图标: row.icon,
        交通:
          index < report.rows.length - 1
            ? TRAVEL_MODES[row.mode].emoji
            : "终点",
        匹配方式: MATCH_LABELS[row.method],
        匹配名称: row.matchedName,
        坐标经度纬度: row.lngLat?.join(", ") ?? "未找到",
        警告: warningByIndex.has(index)
          ? `⚠ 可能匹配到了别的区县（离其他点中心约 ${warningByIndex.get(index)!.distanceKm.toFixed(1)} km）`
          : "",
      })),
    );
    distanceWarnings.forEach((warning) =>
      console.log(
        `⚠ 可能匹配到了别的区县：第 ${warning.index + 1} 站“${warning.name}”离其他点中心约 ${warning.distanceKm.toFixed(1)} km。`,
      ),
    );
    console.log(
      `请求 ${report.stats.requests} 次；缓存命中 ${report.stats.cacheHits} 次；耗时 ${((performance.now() - start) / 1000).toFixed(2)} 秒。`,
    );
    if (report.rows.some((row) => !row.lngLat))
      throw new Error(
        "有地点未找到，未写入路线 JSON。\n补救 1：写更具体的名称或附近地标。\n补救 2：用 @纬度,经度 手动指定 WGS-84（从谷歌地图或 OpenStreetMap 网站复制）。高德、百度复制的坐标有偏移，请勿直接使用。",
      );
    const config = parseMapConfig({
      title: values.title ?? `${city}路线`,
      aspect: values.aspect ?? "9:16",
      stops: report.rows,
    });
    const output = resolve(values.out);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(config, null, 2) + "\n", "utf8");
    await writeFile(
      output.replace(/\.json$/i, "") + ".geocode.json",
      JSON.stringify({ city, ...report }, null, 2) + "\n",
      "utf8",
    );
    console.log(
      `已通过 zod 校验并写入 ${output}；匹配依据保存在同名 .geocode.json。街道近似只代表街道位置，请核对。`,
    );
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
};
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
