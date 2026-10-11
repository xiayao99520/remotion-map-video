import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// 使用已安装的同版 worker；npm install 后自动更新，生成文件不提交 Git。
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
for (const filename of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(
    require.resolve(`maplibre-gl/dist/${filename}`),
    new URL(`../public/${filename}`, import.meta.url),
  );
}
