import { execFile } from "node:child_process";
import { promisify, stripVTControlCharacters } from "node:util";
import { access, mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const rows: { 项目: string; 结果: string; 原因: string; 补救建议: string }[] =
  [];
const check = async (
  name: string,
  remedy: string,
  action: () => Promise<string>,
) => {
  try {
    const detail = await action();
    rows.push({ 项目: name, 结果: "✅", 原因: detail, 补救建议: "—" });
    console.log(`✅ ${name}：${detail}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    rows.push({
      项目: name,
      结果: "❌",
      原因: reason.slice(-600),
      补救建议: remedy,
    });
    console.log(`❌ ${name}：${reason.slice(-600)}；建议：${remedy}`);
  }
};

await check(
  "Node",
  "安装 Node 22.18 或更新的 LTS（模板使用原生 TypeScript 运行）",
  async () => {
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 20) throw new Error(`当前 ${process.version}，最低要求 20`);
    if (major < 22 || (major === 22 && minor < 18))
      throw new Error(
        `当前 ${process.version} 已满足 ≥20，但模板原生 TS 要求 ≥22.18`,
      );
    return `${process.version}，满足 ≥20 和模板 ≥22.18 的要求`;
  },
);
await check("npm", "安装 Node 自带的 npm，并检查 PATH", async () => {
  // npm run 会给出实际入口；通过 Node 启动，兼容 Windows 的 npm.cmd 与中文路径。
  const npm =
    process.env.npm_execpath ??
    resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const result = await run(process.execPath, [npm, "--version"], {
    cwd: root,
    timeout: 10000,
  });
  return result.stdout.trim();
});
await check(
  "依赖与 worker",
  "在模板目录执行 npm ci；若 worker 缺失，再执行 npm run postinstall",
  async () => {
    await access(resolve(root, "node_modules"));
    for (const filename of [
      "node_modules/@remotion/cli/remotion-cli.js",
      "node_modules/maplibre-gl/package.json",
      "node_modules/zod/package.json",
      "public/maplibre-gl-worker.mjs",
      "public/maplibre-gl-shared.mjs",
    ])
      await access(resolve(root, filename));
    return "node_modules、Remotion、MapLibre、zod 和两个 worker 均存在";
  },
);
for (const [name, url] of [
  ["npm 网络", "https://registry.npmjs.org/"],
  ["底图网络", "https://tiles.openfreemap.org/styles/liberty"],
  [
    "Nominatim 网络",
    "https://nominatim.openstreetmap.org/status.php?format=json",
  ],
]) {
  await check(
    name,
    "开放该域名的 HTTPS 访问；检查代理、DNS 与工作空间网络权限",
    async () => {
      // 一个请求，不重试、不下载正文；状态端点不发地名搜索，不占批量查询入口。
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent":
            "remotion-map-video-doctor/1.0 (environment connectivity check)",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return `HTTP ${response.status}（单次 HEAD，10 秒超时）`;
    },
  );
}
const cli = resolve(root, "node_modules/@remotion/cli/remotion-cli.js");
await check(
  "无头浏览器",
  "执行 npx remotion browser ensure；开放 Chrome 下载域名并安装系统运行库",
  async () => {
    await access(cli);
    const result = await run(process.execPath, [cli, "browser", "ensure"], {
      cwd: root,
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return (
      stripVTControlCharacters(result.stdout).trim().slice(-400) ||
      "Remotion browser ensure 成功"
    );
  },
);
await check(
  "真实短视频渲染",
  "查看 out/doctor-render.log；修复浏览器、字体、WebGL、网络或文件权限后重跑",
  async () => {
    await mkdir(resolve(root, "out"), { recursive: true });
    const props = {
      aspect: "9:16",
      fps: 30,
      tilt: 50,
      closeZoom: 16,
      introSeconds: 0.2,
      secondsPerLeg: 0.4,
      holdSeconds: 0.1,
      outroSeconds: 0.2,
      stops: [
        {
          name: "环境起点",
          lngLat: [104.051, 30.666],
          mode: "walk",
          icon: "📍",
        },
        { name: "环境终点", lngLat: [104.055, 30.664], icon: "🏁" },
      ],
    };
    const propsPath = resolve(root, "out/doctor-props.json");
    await writeFile(propsPath, JSON.stringify(props, null, 2) + "\n", "utf8");
    const started = performance.now();
    try {
      const result = await run(
        process.execPath,
        [
          cli,
          "render",
          "MapRoute",
          "out/doctor.mp4",
          `--props=${propsPath}`,
          "--gl=angle",
          "--concurrency=1",
          "--log=verbose",
        ],
        {
          cwd: root,
          timeout: 360000,
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      await writeFile(
        resolve(root, "out/doctor-render.log"),
        result.stdout + result.stderr,
        "utf8",
      );
    } catch (error) {
      const output = error as Error & { stdout?: string; stderr?: string };
      await writeFile(
        resolve(root, "out/doctor-render.log"),
        (output.stdout ?? "") + (output.stderr ?? "") + output.message,
        "utf8",
      );
      throw new Error(
        `渲染失败，耗时 ${((performance.now() - started) / 1000).toFixed(2)} 秒；详见 out/doctor-render.log`,
      );
    }
    const file = await stat(resolve(root, "out/doctor.mp4"));
    if (file.size === 0) throw new Error("渲染文件为空");
    return `out/doctor.mp4（1 秒 / 30 帧），${file.size} 字节，耗时 ${((performance.now() - started) / 1000).toFixed(2)} 秒`;
  },
);
console.table(rows);
const failed = rows.filter((row) => row.结果 === "❌");
console.log(
  failed.length
    ? `总结：当前环境检查未全部通过，缺少或不可用：${failed.map((row) => row.项目).join("、")}。按表中建议修复后重跑。`
    : "总结：当前环境的版本、依赖、网络、浏览器和实际渲染检查全部通过，可以制作地图视频。",
);
process.exitCode = failed.length ? 1 : 0;
