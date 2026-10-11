# Troubleshooting

Run these commands from the copied skill's `template/` directory.

## `npm run doctor` failures

- **Node**: install Node 22.18+; the template uses Node's native TypeScript execution.
- **npm**: use the npm bundled with Node and check PATH.
- **Dependencies/worker**: run `npm ci`; if workers are still missing, run `npm run postinstall`.
- **npm, map, or Nominatim network**: allow HTTPS to `registry.npmjs.org`, `tiles.openfreemap.org`, and `nominatim.openstreetmap.org`; check proxy/DNS.
- **Headless browser**: run `npx remotion browser ensure`; allow Chrome download and required OS libraries.
- **Real short render**: read `out/doctor-render.log`; fix browser, WebGL, font, network, or write permissions, then rerun doctor.

A passing doctor is evidence for the current environment only.

## Geocoding

Nominatim is a small, serial, user-triggered lookup service. The CLI uses a recognizable User-Agent, Chinese language header, at least one second between requests, one retry, a city viewbox, and a cache. Do not turn it into autocomplete, bulk, or scheduled traffic. A street result is only a street approximation; a city rectangle can still include other counties. Show the matching table and let the user correct uncertain rows.

## Map and rendering

OpenFreeMap is required at render time. If tiles fail, check the map URL and network, then run doctor. Long routes may lower close zoom or use concurrency 1. For a timeout, retry with `--concurrency=1` and keep the log; do not edit template code.

## Emoji

Emoji rendering depends on the installed font. Keep the icon in the route text or JSON; install/use a color emoji font if the browser shows monochrome glyphs. The route and coordinates are still valid.
