#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const skillRoot = process.env.MAP_VIDEO_SKILL_ROOT
  ? path.resolve(process.env.MAP_VIDEO_SKILL_ROOT)
  : path.resolve(__dirname, "..");
const template = path.join(skillRoot, "template");
// 每次恢复环境，避免新会话重置用户字体或证书库后复用不完整的状态。
execFileSync(
  "python3",
  [path.join(__dirname, "bootstrap.py"), "--skill-root", skillRoot],
  { stdio: "inherit" },
);
process.chdir(template);
process.env.MAP_VIDEO_SKILL_ROOT = skillRoot;
if (["render", "still", "studio", "compositions"].includes(process.argv[2])) {
  if (!process.argv.some((a) => a === "--gl" || a.startsWith("--gl="))) {
    process.argv.push("--gl=swangle");
  }
  if (
    !process.argv.some(
      (a) =>
        a === "--browser-executable" || a.startsWith("--browser-executable="),
    )
  ) {
    const wrapper = path.join(__dirname, "workspace-chrome.py");
    fs.chmodSync(wrapper, 0o755);
    process.argv.push("--browser-executable=" + wrapper);
  }
}
const installed = require(
  path.join(template, "node_modules/@remotion/renderer/package.json"),
).version;
if (installed !== "4.0.534")
  throw new Error(
    "Revalidate the compatibility adapter for Remotion " + installed,
  );
const ports = require(
  path.join(template, "node_modules/@remotion/renderer/dist/port-config.js"),
);
const discover = ports.getPortConfig;
let fallback;
ports.getPortConfig = (preferIpv4) => {
  if (fallback) return fallback;
  try {
    return discover(preferIpv4);
  } catch (error) {
    if (
      error.code !== "ERR_SYSTEM_ERROR" ||
      !String(error.message).includes("uv_interface_addresses")
    )
      throw error;
    console.log(
      "Network-interface enumeration unavailable; binding only to 127.0.0.1.",
    );
    return (fallback = { host: "127.0.0.1", hostsToTry: ["127.0.0.1"] });
  }
};
require(path.join(template, "node_modules/@remotion/cli/remotion-cli.js"));
