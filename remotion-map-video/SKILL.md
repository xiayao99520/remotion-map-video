---
name: remotion-map-video
description: Create only configuration-driven map route videos that connect multiple places in order, when the user asks for 地图视频、路线视频、路线动画、探店路线、citywalk、打卡路线、旅游路线视频 or 行程地图. It does not create other kinds of videos.
---

# Remotion map route video

Use this skill only for a video that draws a route between places in order, follows it with a fixed 3D map camera, and labels each stop.

## Golden rule

- Do not edit any file under `template/`. Do not create a Remotion project. Do not read `template/src`; the finished visual style is controlled by JSON and the route parser.
- Put every user-facing artifact in the current working directory under `map-videos/<name>/`. Use absolute paths in commands. The template's internal geocode cache is automatic and is not a deliverable.

## Prepare once

1. Locate this `SKILL.md` and use its parent as the absolute `MAP_SKILL_ROOT`. Confirm `template/package-lock.json` exists; never create a replacement template. Check the OS and available command, file, and network tools.
2. **Linux x86_64 remote workspace (including WSL validation)**: read [references/workspace-deployment.md](references/workspace-deployment.md) before setup. Run `python3 "<MAP_SKILL_ROOT>/workspace/bootstrap.py" --skill-root "<MAP_SKILL_ROOT>"`, then use the workspace entry below to render `workspace/smoke.json`. Check the real 1-second MP4 and extracted frames before proceeding. On Linux, a doctor `uv_interface_addresses` error also selects this branch. Other Linux architectures require separate validation.
3. **Windows/macOS, or an ordinary local Linux host without that error**: if `template/node_modules` is missing, run `npm ci` in `template/`. On first use or any environment error, run `npm run doctor` and follow its table (Node, dependencies, network, Chrome, real short render). Do not run the Linux bootstrap on Windows/macOS.

## Standard workflow

1. Get route text. If it has no `城市：...` line, ask the user for the city; never guess one.
2. Create `map-videos/<name>/route.txt` as UTF-8 and preserve the text exactly.
3. If the user gives spoken natural-language route text, first rewrite it into `route.txt` syntax (`城市：...` plus stops and arrows). Do not expose a different format to the user.
4. From `template/`, run `npm run route -- --input "<absolute>/map-videos/<name>/route.txt" --out "<absolute>/map-videos/<name>/route.json"`. Add `--aspect 16:9` or `--aspect 1:1` only when requested.
5. Send the command's four-column Markdown table exactly as printed, then stop and wait for confirmation. Ask only about street approximations, ❌ not found rows, and ⚠ possible other-district warnings. Do not silently fix coordinates.
6. If the user wants a change (place, address, emoji, or travel mode), edit `route.txt`, run the route command again, send the new table, and wait again. Never hand-edit coordinates or invent them.
7. Render only after the user confirms:
   - Local branch, from `template/`:
   `npx remotion render MapRoute "<absolute>/map-videos/<name>/<name>.mp4" --props="<absolute>/map-videos/<name>/route.json" --gl=angle --concurrency=4`
   - Linux workspace branch:
   `node "<MAP_SKILL_ROOT>/workspace/workspace-remotion.cjs" render MapRoute "<absolute>/map-videos/<name>/<name>.mp4" --props="<absolute>/map-videos/<name>/route.json" --concurrency=1 --log=verbose`
   Keep the render log in the same output directory. Open Studio only when requested, using `npm run dev -- --props="<absolute>/map-videos/<name>/route.json"` locally, or the workspace entry's `studio` command on Linux workspaces.
7. Check the actual MP4's duration, dimensions and nonzero size with ffprobe; extract and view movement, arrival-card and ending frames for the map, Chinese labels and color emoji. Use the current environment's file-saving mechanism to persist the deliverable, then give a clickable link using its actual absolute path. A temporary download link alone does not prove persistence. If a check or save tool is unavailable, report that limitation.

## Allowed JSON adjustments

The route command fills `aspect`, `fps`, and `stops`. You may adjust these validated fields in a copied JSON: `secondsPerLeg` (movement seconds per leg), `holdSeconds` (pause at each stop), `introSeconds`, `outroSeconds`, `closeZoom` (12–18), `tilt` (0–60 degrees), `lineStyle` (`straight` or `greatCircle`), `colors.line`, `colors.marker`, `colors.future`, `mapStyle`, and `attribution` (`end` or `always`). The legacy `title` field remains accepted for old JSON but is ignored. `stops[].mode` and `stops[].icon` are also configurable. Attribution cannot be disabled because OpenStreetMap data requires credit.

For complete defaults, limits, and examples, read [references/config.md](references/config.md) when changing JSON. For full route syntax, read [references/route-text.md](references/route-text.md) when writing or correcting route text. Read [references/troubleshooting.md](references/troubleshooting.md) only when doctor, geocoding, map loading, rendering, or emoji issues occur.

## Route syntax quick reference

- `城市：南宁` is required unless `--city` supplies the city.
- Connect stops with `→`, `->`, or `=>`; write the travel mode before each arrow.
- Put an address in `（...）` or `(...)`; supported modes include `走路/步行/走`, `车/打车/开车/驾车/出租车/网约车`, `地铁`, and `高铁/动车/火车`.
- Add `#🍜` for one emoji. Add `@纬度,经度` for a manual WGS-84 coordinate; the parser converts it to internal `[经度, 纬度]`. Coordinates copied from Gaode or Baidu are offset and should not be used directly.

## Common problems

- **No city**: add `城市：...` or pass `--city`; do not infer it.
- **No match**: make the place or nearby landmark more specific, or supply a verified `@纬度,经度`.
- **Wrong district warning**: show the table and let the user correct the text; a city bounding box is not an exact administrative boundary.
- **Slow or failed render**: follow the selected environment branch: workspace setup and smoke in [references/workspace-deployment.md](references/workspace-deployment.md), or local doctor and [references/troubleshooting.md](references/troubleshooting.md).
- **Emoji is monochrome**: install/use a system color emoji font; this is a font limitation, not a route-coordinate issue.

Remotion is free for individuals and companies with up to 3 people; larger companies need a commercial license.
