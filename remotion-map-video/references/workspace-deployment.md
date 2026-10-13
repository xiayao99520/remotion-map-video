# Linux 工作空间部署

先判断操作系统和工具。Linux x86_64 的远程执行工作空间（以及 WSL 验证）用本说明；Windows/macOS 和普通本地 Linux 用 SKILL.md 的本机分支。本机 Linux 的 doctor 若明确报 `uv_interface_addresses`，也转用本入口。其他架构没有验证。普通聊天窗口若没有命令执行、文件读写和网络工具，skill 无法替它提供这些能力。

## 1. 定位与基础工具

从正在读取的 SKILL.md 的父目录取得 skill 根目录，设为真实绝对路径 `MAP_SKILL_ROOT`。确认存在 `template/package-lock.json`、`workspace/bootstrap.py`；模板随 skill 分发，无需 clone、checkout 或创建工程。所有成品放在当前任务工作目录的 `map-videos/<名称>/`，不要放进模板。

要求 Linux x86_64、Node ≥22.18、npm、Python ≥3.11、`dpkg-deb`、`fc-cache` 及 Chrome 所需共享库。Remotion 锁定为 4.0.534，兼容入口依赖该版本的内部接口，升级后须重新验收。软件渲染不要求 GPU。包来自固定的 Ubuntu 24.04 快照；系统仍需提供兼容运行库。

缺基础工具时先按当前环境允许的方式安装。Node 可用用户目录中的官方发行包，校验官方 SHASUMS256 后加入 PATH；Ubuntu 中 `python3`、`fontconfig`、`dpkg`、`ffmpeg` 和 Chrome 的 `libnss3`、`libatk-bridge2.0-0`、`libgbm1`、`libasound2t64` 可由 apt 提供，包名以当前发行版为准。没有安装权限或网络受限时，报告具体缺项，不修改权限策略。

## 2. 准备环境

```bash
python3 "$MAP_SKILL_ROOT/workspace/bootstrap.py" --skill-root "$MAP_SKILL_ROOT"
```

脚本按顺序检查工具、模板及 Remotion 版本，依赖或生成的地图 worker 缺失时执行 `npm ci`；下载字体与 NSS 工具到 `.workspace-runtime/` 并解包，复制中文和彩色 emoji 字体到当前用户字体目录后执行 `fc-cache`；将环境明确提供的 CA 加入当前用户 Chrome NSS 信任库；通过 Remotion `browser ensure` 安装 Chrome，检查可执行文件并记录路径。每次使用兼容入口都会重新运行这些检查，用户目录重置时可从缓存恢复字体和信任库。

下载包固定到 `https://snapshot.ubuntu.com/ubuntu/20260828T000000Z/`，SHA256 从该快照的 Packages 索引核对：

| 包 | SHA256 | 索引 |
| --- | --- | --- |
| fonts-wqy-microhei 0.2.0-beta-3.1 | `58d0a29af79ce1fc5c63b4276065f0fce27decf6839835f3f9c2e68d9f84ca20` | noble/universe |
| fonts-noto-color-emoji 2.047-0ubuntu0.24.04.1 | `b102b62ce6a7313315223cff5e052bdf8fc0ad162c9e961ce0dc2202bc139ce2` | noble-updates/main |
| libnss3-tools 2:3.98-1ubuntu0.2 | `e5b42390b02c21851bc04e9557ec48539a913f9b09637220c4b1db0d1386b3fb` | noble-updates/main |

已下载的缓存也重新校验，解包标记不能跳过校验；不一致立即停止。按错误提示移除损坏缓存再重试，不能改期望哈希来绕过。字体等待沿用模板的 `document.fonts.load()` / `document.fonts.ready` 屏障，字体须在 Chrome 启动前准备好。

代理按 `HTTPS_PROXY`、`https_proxy`、`HTTP_PROXY`、`http_proxy` 的顺序从当前环境读取；Chrome 包装器只在存在代理时替换 Remotion 的直连参数，并让本地回环地址绕过代理。CA 从 `NODE_EXTRA_CA_CERTS` 或 `SSL_CERT_FILE` 读取；Python 下载器同时加载 Node 的附加 CA。不得写入固定代理地址、证书路径或证书内容，不关闭 HTTPS 检查。

Chrome 官方下载器失败时，脚本可从已安装 Remotion 给出的同一官方 URL 下载并解包，检查归一化路径防止越界写入。备用下载仍受网络限制，不应仅凭代码存在声称已验证。

## 3. 首次部署必须真实渲染

```bash
OUTPUT_ROOT="$PWD/map-videos/environment-check"
mkdir -p "$OUTPUT_ROOT"
node "$MAP_SKILL_ROOT/workspace/workspace-remotion.cjs" render MapRoute \
  "$OUTPUT_ROOT/smoke.mp4" --props="$MAP_SKILL_ROOT/workspace/smoke.json" \
  --concurrency=1 --log=verbose > "$OUTPUT_ROOT/render.log" 2>&1
ffprobe -v error -show_entries stream=codec_name,width,height,nb_frames \
  -show_entries format=duration,size -of json "$OUTPUT_ROOT/smoke.mp4"
ffmpeg -y -i "$OUTPUT_ROOT/smoke.mp4" -ss 0.5 -frames:v 1 "$OUTPUT_ROOT/smoke.png"
```

预期 H.264、1080×1920、30 帧、1 秒、文件非空。用当前工具打开抽帧，确认地图、中文和 emoji 可见。没有独立 ffmpeg/ffprobe 时，可先查看 `node "$MAP_SKILL_ROOT/workspace/workspace-remotion.cjs" ffmpeg --help` 与 `ffprobe --help` 使用 Remotion 自带工具；无法查看图片时须说明视觉验收未完成。安装、类型检查或打包通过不等于真实渲染通过。

受限环境的 `npm run doctor` 会直接启动未适配的子进程，不能作为此分支的唯一验收；用上述短视频检查代替。网卡枚举正常时保持 Remotion 原行为，只有 `ERR_SYSTEM_ERROR` 且消息含 `uv_interface_addresses` 时才绑定 `127.0.0.1`，其他异常仍抛出。

## 4. 路线制作与交付

依照 SKILL.md 保存原始 route.txt、补齐明确城市，用 `npm run route` 查坐标并展示原始匹配表。无结果、街道近似、异区警告和自动图标按原流程核对，不编造坐标。查询保持串行并复用缓存。手动 WGS-84 坐标写为 `@纬度,经度`，图标写为 `#emoji`。

```bash
# 在切换目录前取得当前任务的输出目录。
ROUTE_DIR="$PWD/map-videos/my-route"
cd "$MAP_SKILL_ROOT/template"
npm run route -- --input "$ROUTE_DIR/route.txt" --out "$ROUTE_DIR/route.json" --title "路线标题"
node "$MAP_SKILL_ROOT/workspace/workspace-remotion.cjs" render MapRoute \
  "$ROUTE_DIR/my-route.mp4" --props="$ROUTE_DIR/route.json" \
  --concurrency=1 --log=verbose > "$ROUTE_DIR/render.log" 2>&1
```

入口自动选择 `--gl=swangle` 软件渲染和 Chrome 包装器。用 ffprobe 检查成片的时长、分辨率和帧数，再抽取行进、到达卡片和片尾帧，查看地图、中文、彩色 emoji 与署名。按当前环境的文件保存机制持久保存成品，再提供实际文件的可点击链接。临时下载链接不证明持久保存；保存能力缺失要如实说明。

## 5. 排错

| 现象 | 处理 |
| --- | --- |
| 缺工具、Node 太旧 | 安装前提工具；保证 PATH 优先使用 Linux Node/npm，再重跑 bootstrap |
| SHA256 mismatch | 停止，移除报错的损坏缓存，重新下载；不跳过校验 |
| 缺共享库、Chrome 无法启动 | 看 `--version` 错误或 `ldd` 中的缺项，安装当前发行版对应库 |
| `uv_interface_addresses`，`--ipv4` 也无效 | 使用兼容入口；该版 Remotion 先枚举网卡再选择地址 |
| WebGL2 不可用 | 保持默认 `swangle` 和并发 1 |
| Node 能联网而 Chrome DNS 失败 | 检查环境代理；必须通过 Chrome 包装器启动 |
| `ERR_CERT_AUTHORITY_INVALID` | 检查环境提供的 CA 文件及 NSS 工具；重跑 bootstrap，不禁用证书检查 |
| 中文方框或 emoji 单色 | 检查用户字体、`fc-cache`，重跑 bootstrap 后重启渲染 |
| 长时间停在 0 帧 | 查看底图日志和网络；初始化需捕获多块地图，未开始编码不等于失败 |
| 新会话又缺字体、证书或浏览器 | 使用入口恢复；缓存也丢失时重新部署 |

适用边界以当前环境实测为准。WSL 无代理/CA 时的成功不能证明云环境的代理、CA 或受限网卡分支成功。

参考：[Remotion GL 参数](https://www.remotion.dev/docs/options/gl)、[浏览器准备](https://www.remotion.dev/docs/cli/browser)、[Ubuntu 快照](https://snapshot.ubuntu.com/)。
