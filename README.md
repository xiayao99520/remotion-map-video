# remotion-map-video

一个给 AI 用的 agent skill（Claude Code、Codex 都能用）：给它一段中文路线语料，它就做出一段**地图路线视频**。

```
城市：南宁
舒记粉店七星总店（七星路44号）车→ 三街两巷 走路→ 水街老牌凉茶（水街27号）车→ 中山路夜市 地铁→ 亭子码头
```

效果：

- 斜视 3D 地图，镜头平稳地沿路线向前推进
- 每个地点有一个主题 emoji 气泡（按地名自动挑选，可手动指定）
- 交通方式图标随路线移动：🚶 走路、🚗 车、🚇 地铁、🚄 高铁
- 到达时地名放大成卡片，显示地址
- 距离很短的路段自动放大，画面保持清晰
- 默认竖屏 9:16，也支持 16:9 和 1:1

视频的风格已经在模板里定好，AI 只负责填配置，所以每次做出来的风格都一样。

## 安装

把 `remotion-map-video/` 整个文件夹复制到 skills 目录：

- Claude Code：`~/.claude/skills/remotion-map-video/`
- Codex：`~/.agents/skills/remotion-map-video/`

第一次使用时，AI 会在 `template/` 下运行 `npm ci` 安装依赖，并用 `npm run doctor` 检查环境。

## 环境要求

- Node.js ≥ 22.18
- 能访问网络：npm、`tiles.openfreemap.org`（底图）、`nominatim.openstreetmap.org`（地名查坐标）
- 第一次渲染时 Remotion 会自动下载一个无头 Chrome

### 在远程 Linux 工作空间使用（例如 ChatGPT 工作空间）

skill 自带 `workspace/` 脚本：自动安装依赖、中文和 emoji 字体、无头 Chrome，处理代理和软件渲染，并先渲染一段 1 秒的测试视频确认环境可用。AI 读 `SKILL.md` 时会自动判断环境并选择这条流程，详见 [references/workspace-deployment.md](remotion-map-video/references/workspace-deployment.md)。

- 环境必须能执行命令、读写文件、访问网络；普通聊天窗口无法渲染视频。
- 已在 Linux x86_64 + Remotion 4.0.534 下验证；升级 Remotion 后需要重新验证。

## 使用

对 AI 说"用这段路线做个地图视频"，然后贴上语料。AI 会：

1. 没写城市时先问你是哪座城市；
2. 查坐标，给你一张固定格式的确认表（去哪儿 | 下面的字 | 图标 | 怎么去）。只有地点没找到、只定位到街道或可能找错区县时，表下才多一行提示；
3. 等你确认后，再渲染出 MP4，放在当前目录的 `map-videos/<名字>/` 下。

语料写法见 [references/route-text.md](remotion-map-video/references/route-text.md)，可调参数见 [references/config.md](remotion-map-video/references/config.md)。

## 致谢和授权

- 本仓库的代码以 [MIT 协议](LICENSE) 开源。Remotion 本身有它自己的授权条款（见下一条），使用时需要另外遵守。
- 基于 [Remotion](https://www.remotion.dev/) 和官方 skill [remotion-dev/skills](https://github.com/remotion-dev/skills) 精简改造。Remotion 对个人和 3 人以内的公司免费，更大的公司商用需要[购买授权](https://www.remotion.dev/license)。
- 地图：[MapLibre GL JS](https://maplibre.org/)、[OpenFreeMap](https://openfreemap.org/)，数据 © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors。视频片尾会显示署名，这是数据许可的要求。
- 地名查坐标：[Nominatim](https://nominatim.org/)，请遵守它的[使用规则](https://operations.osmfoundation.org/policies/nominatim/)（每秒最多 1 个请求）。
