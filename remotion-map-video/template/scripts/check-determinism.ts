import { spawn } from "node:child_process";
import { mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseMapConfig } from "../src/config/schema.ts";
import { getTiming } from "../src/MapRoute/timeline.ts";

const template = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = join(template, "out", "determinism", String(Date.now()));

const run = async (concurrency: number, props: string, frames: number[]) => {
  const directory = join(output, `c${concurrency}`);
  const log = await open(join(output, `c${concurrency}.log`), "w");
  try {
    const code = await new Promise<number | null>((resolveCode, reject) => {
      const child = spawn(
        process.execPath,
        [
          join(template, "node_modules", "@remotion", "cli", "remotion-cli.js"),
          "render",
          "MapRoute",
          directory,
          `--props=${props}`,
          `--frames=${frames.join(",")}`,
          "--sequence",
          "--image-format=png",
          "--gl=angle",
          `--concurrency=${concurrency}`,
        ],
        { cwd: template, stdio: ["ignore", log.fd, log.fd] },
      );
      child.once("error", reject);
      child.once("exit", resolveCode);
    });
    if (code !== 0)
      throw new Error(
        `并发 ${concurrency} 渲染失败，请看 ${output}/c${concurrency}.log`,
      );
    return directory;
  } finally {
    await log.close();
  }
};

try {
  await mkdir(output, { recursive: true });
  const example = JSON.parse(
    await readFile(
      new URL("../../examples/nanning-food.json", import.meta.url),
      "utf8",
    ),
  );
  // 固定纯色底图隔离在线瓦片和 GPU 纹理边缘误差；中文、emoji、透视和卡片仍走真实组件。
  const config = parseMapConfig({
    ...example,
    stops: example.stops,
    introSeconds: 0.6,
    holdSeconds: 0.8,
    secondsPerLeg: 0.7,
    outroSeconds: 0.6,
    mapStyle:
      "data:application/json," +
      encodeURIComponent(
        JSON.stringify({
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e8eef3" },
            },
          ],
        }),
      ),
  });
  const timing = getTiming(config);
  const selected = new Set<number>([0, timing.durationInFrames - 1]);
  for (let frame = 0; frame < timing.durationInFrames; frame += 15)
    selected.add(frame);
  // 同时覆盖停留/出发边界及完全收起后，避免采样正好漏过卡片变形。
  for (let leg = 0; leg < timing.legCount; leg++) {
    const start = timing.introFrames + leg * timing.legFrames;
    for (const frame of [
      start - 1,
      start,
      start + 15,
      start + timing.travelFrames,
    ])
      selected.add(frame);
  }
  const frames = [...selected].sort((a, b) => a - b);
  const props = join(output, "config.json");
  await writeFile(props, JSON.stringify(config, null, 2));
  console.log(`检查 ${frames.length} 帧：分别以并发 1 和 4 渲染无损 PNG。`);
  const one = await run(1, props, frames);
  const four = await run(4, props, frames);
  const names = (await readdir(one))
    .filter((name) => name.endsWith(".png"))
    .sort();
  const other = (await readdir(four))
    .filter((name) => name.endsWith(".png"))
    .sort();
  if (
    names.length !== frames.length ||
    JSON.stringify(names) !== JSON.stringify(other)
  )
    throw new Error("输出帧数或文件名不一致，不能判定通过");
  const rows = [];
  for (const name of names) {
    const a = await readFile(join(one, name));
    const b = await readFile(join(four, name));
    // PNG 没有有损压缩；字节完全一致是比像素一致更严格的条件。
    rows.push({
      name,
      identical: a.equals(b),
      sha256: createHash("sha256").update(a).digest("hex"),
    });
  }
  await writeFile(
    join(output, "report.json"),
    JSON.stringify({ frames, rows }, null, 2),
  );
  const different = rows.filter((row) => !row.identical);
  if (different.length)
    throw new Error(
      `${different.length} 帧不同：${different.map((row) => row.name).join("、")}`,
    );
  console.log(
    `通过：${frames.length} 帧 PNG 字节完全一致，像素差为 0。证据：${output}`,
  );
} catch (error) {
  console.error(
    `确定性检查失败：${error instanceof Error ? error.message : String(error)}`,
  );
  console.error(`保留证据：${output}`);
  process.exitCode = 1;
}
