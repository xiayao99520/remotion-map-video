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

1. Check that `template/node_modules` exists. If it does not, run `npm ci` in `template/`.
2. On first use or any environment error, run `npm run doctor` in `template/` and follow its table. It checks Node, dependencies, network, Chrome, and a real short render.

## Standard workflow

1. Get route text. If it has no `城市：...` line, ask the user for the city; never guess one.
2. Create `map-videos/<name>/route.txt` as UTF-8 and preserve the text exactly.
3. From `template/`, run `npm run route -- --input "<absolute>/map-videos/<name>/route.txt" --out "<absolute>/map-videos/<name>/route.json" --title "..."`. Add `--aspect 16:9` or `--aspect 1:1` only when requested.
4. Show the route command's matching table exactly as printed. Ask only about street approximations, ❌ not found rows, ⚠ possible other-district warnings, and automatically chosen icons. Do not silently fix coordinates.
5. If the user supplies a landmark, `@纬度,经度`, or `#emoji`, update `route.txt` and run the route command again. Never hand-edit coordinates or invent them.
6. Render directly by default:
   `npx remotion render MapRoute "<absolute>/map-videos/<name>/<name>.mp4" --props="<absolute>/map-videos/<name>/route.json" --gl=angle --concurrency=4`
   Report the MP4's absolute path. Open Studio only if the user wants a preview: `npm run dev -- --props="<absolute>/map-videos/<name>/route.json"`.

## Allowed JSON adjustments

The route command fills `title`, `aspect`, `fps`, and `stops`. You may adjust these validated fields in a copied JSON: `secondsPerLeg` (movement seconds per leg), `holdSeconds` (pause at each stop), `introSeconds`, `outroSeconds`, `closeZoom` (12–18), `tilt` (0–60 degrees), `lineStyle` (`straight` or `greatCircle`), `colors.line`, `colors.marker`, `colors.future`, `mapStyle`, and `attribution` (`end` or `always`). `stops[].mode` and `stops[].icon` are also configurable. Attribution cannot be disabled because OpenStreetMap data requires credit.

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
- **Slow or failed render**: run `npm run doctor`, then read [references/troubleshooting.md](references/troubleshooting.md).
- **Emoji is monochrome**: install/use a system color emoji font; this is a font limitation, not a route-coordinate issue.

Remotion is free for individuals and companies with up to 3 people; larger companies need a commercial license.
