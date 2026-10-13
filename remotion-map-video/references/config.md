# Configuration reference

This reference mirrors the validated configuration schema; users of the skill should normally only edit the generated JSON fields listed here.

## Top-level fields

| Field | Default | Valid values / range | Meaning |
|---|---:|---|---|
| `title` | `""` | string | Display title metadata. The route CLI defaults to `<city>路线`. |
| `aspect` | `"9:16"` | `9:16`, `16:9`, `1:1` | Output dimensions 1080×1920, 1920×1080, or 1080×1080. |
| `fps` | `30` | integer 1–120 | Frames per second. |
| `stops` | required | at least 2 items | Ordered places; coordinates are `[lng, lat]`. |
| `lineStyle` | `"straight"` | `straight`, `greatCircle` | Draw a straight projected route or a great-circle route. |
| `closeZoom` | `16.5` | 12–18 | Requested street-level detail; long routes may lower it automatically. |
| `tilt` | `50` | 0–60 | CSS ground-plane tilt in degrees. |
| `secondsPerLeg` | `3` | > 0 | Travel time for each leg. |
| `holdSeconds` | `1` | ≥ 0 | Pause at each stop. Zero keeps the timeline moving without a card expansion. |
| `introSeconds` | `1.5` | > 0 | Opening move from overview to the first stop. |
| `outroSeconds` | `1.5` | > 0 | Closing move back to overview. |
| `attribution` | `"end"` | `end`, `always` | OpenStreetMap/OpenFreeMap credit at the end or throughout. It cannot be disabled. |
| `mapStyle` | OpenFreeMap Liberty URL | complete URL | MapLibre style JSON URL. |

## Stop fields

Each stop has `name` (non-empty), `lngLat` as `[longitude, latitude]`, optional `address`, `mode` (`walk`, `car`, `metro`, `train`, default `walk`), and optional one-grapheme `icon` emoji. `mode` describes the leg leaving this stop; the final stop's mode is ignored.

## Colors

`colors.line` defaults to `#ff5a1f`; `colors.marker` defaults to `#ed7b20`. `colors.future` is optional and controls the dashed next-leg line; by default it mixes the route color with 30% white. All colors must be six-digit hex values such as `#e8432e`.

## Example

```json
{
  "title": "杭州路线",
  "aspect": "9:16",
  "stops": [
    {"name": "西湖边", "lngLat": [120.15, 30.24], "mode": "walk", "icon": "🌊"},
    {"name": "雷峰塔", "lngLat": [120.15, 30.23], "mode": "metro", "icon": "🏯"}
  ],
  "secondsPerLeg": 3,
  "holdSeconds": 1,
  "tilt": 50,
  "attribution": "end"
}
```
