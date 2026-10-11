import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { LngLat } from "../config/schema.ts";
import type { TextStop } from "./parse.ts";

const resultSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  display_name: z.string(),
  boundingbox: z.array(z.coerce.number()).length(4).optional(),
  osm_type: z.enum(["node", "way", "relation"]).optional(),
  osm_id: z.number().optional(),
  category: z.string().optional(),
  class: z.string().optional(),
  type: z.string().optional(),
  addresstype: z.string().optional(),
});
type SearchResult = z.infer<typeof resultSchema>;
export type CityBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};
export type MatchMethod = "manual" | "name" | "address" | "street" | "missing";
export type GeocodedStop = TextStop & {
  method: MatchMethod;
  matchedName: string;
  sourceUrl?: string;
};
export type DistanceWarning = {
  index: number;
  name: string;
  distanceKm: number;
};
export const MATCH_LABELS: Record<MatchMethod, string> = {
  manual: "手动",
  name: "地名",
  address: "地址",
  street: "⚠ 街道近似",
  missing: "❌ 未找到",
};
export const withinBounds = ([lng, lat]: LngLat, bounds: CityBounds) =>
  lng >= bounds.west &&
  lng <= bounds.east &&
  lat >= bounds.south &&
  lat <= bounds.north;

const distanceKm = (a: LngLat, b: LngLat) => {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians;
  const dLng = (b[0] - a[0]) * radians;
  const latA = a[1] * radians;
  const latB = b[1] * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// 这是核对提示，不判断坐标对错：用路线经纬度中位数作为稳健中心，异常远的点可能落到了同名的别的区县。
export const findDistanceWarnings = (
  rows: GeocodedStop[],
  thresholdKm = 20,
): DistanceWarning[] => {
  const located = rows.flatMap((row, index) =>
    row.lngLat ? [{ row, index, lngLat: row.lngLat }] : [],
  );
  if (located.length < 2) return [];
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const center: LngLat = [
    median(located.map((item) => item.lngLat[0])),
    median(located.map((item) => item.lngLat[1])),
  ];
  return located.flatMap(({ row, index, lngLat }) => {
    const distance = distanceKm(lngLat, center);
    return distance > thresholdKm
      ? [{ index, name: row.name, distanceKm: distance }]
      : [];
  });
};

export const streetFromAddress = (address: string) => {
  // 只退到语料明确给出的街道，不推测门牌或另造一个附近坐标。
  const withoutCity = address.replace(/^(?:[^路街巷里号]+?[省市区县])+/u, "");
  return /^(.+?(?:大道|大街|路|街|巷|里))/.exec(withoutCity)?.[1];
};
const isStreet = (result: SearchResult) =>
  result.category === "highway" ||
  result.class === "highway" ||
  ["road", "street"].includes(result.addresstype ?? "");
const sourceUrl = (result: SearchResult) =>
  result.osm_type && result.osm_id
    ? `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`
    : undefined;

type GeocoderOptions = {
  cachePath: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export const createGeocoder = async (options: GeocoderOptions) => {
  const baseUrl =
    options.baseUrl ?? "https://nominatim.openstreetmap.org/search";
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const cacheSchema = z.object({
    version: z.literal(1),
    queries: z.record(z.string(), z.array(resultSchema)),
  });
  let cache: z.infer<typeof cacheSchema> = { version: 1, queries: {} };
  try {
    cache = cacheSchema.parse(
      JSON.parse(await readFile(options.cachePath, "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        `坐标缓存无法读取，请检查或移走 ${options.cachePath}：${String(error)}`,
      );
  }
  const stats = { requests: 0, cacheHits: 0 };
  // 首个未缓存请求也留一秒间隔，连续启动 CLI 时仍不会突破限速。
  let lastRequest = now();
  const saveCache = async () => {
    await mkdir(dirname(options.cachePath), { recursive: true });
    const temporary = `${options.cachePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(cache, null, 2) + "\n", "utf8");
    await rename(temporary, options.cachePath);
  };
  const search = async (
    params: Record<string, string>,
  ): Promise<SearchResult[]> => {
    const url = new URL(baseUrl);
    url.search = new URLSearchParams({
      format: "jsonv2",
      limit: "5",
      "accept-language": "zh",
      ...params,
    }).toString();
    const key = url.toString();
    if (cache.queries[key]) {
      stats.cacheHits++;
      return cache.queries[key];
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      // 查询与重试都经过同一节流口；不用并发查询公益服务。
      await sleep(Math.max(0, 1050 - (now() - lastRequest)));
      lastRequest = now();
      stats.requests++;
      let response: Response;
      let body: unknown;
      try {
        response = await request(url, {
          headers: {
            "User-Agent":
              "remotion-map-video/1.0 (local route video CLI; OpenStreetMap data)",
            "Accept-Language": "zh",
          },
          signal: AbortSignal.timeout(20000),
        });
        if (response.status >= 500 && attempt === 0) continue;
        if (!response.ok)
          throw new Error(`Nominatim HTTP ${response.status}，请稍后再试。`);
        body = await response.json();
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Nominatim HTTP")
        )
          throw error;
        if (attempt === 0) continue;
        throw new Error(`Nominatim 网络请求失败，已重试一次：${String(error)}`);
      }
      const results = z.array(resultSchema).parse(body);
      cache.queries[key] = results;
      await saveCache();
      return results;
    }
    throw new Error("Nominatim 查询失败。");
  };

  const findCity = async (city: string): Promise<CityBounds> => {
    const results = await search({ q: city, addressdetails: "1" });
    const match = results.find(
      (r) =>
        r.boundingbox &&
        (r.type === "administrative" ||
          ["city", "town", "municipality"].includes(r.type ?? "") ||
          ["city", "town", "municipality"].includes(r.addresstype ?? "")),
    );
    if (!match?.boundingbox)
      throw new Error(
        `无法确认“${city}”的城市范围，请写更完整的城市名（例如广西南宁市）。`,
      );
    const [south, north, west, east] = match.boundingbox;
    if (
      !(
        south >= -90 &&
        north <= 90 &&
        west >= -180 &&
        east <= 180 &&
        south < north &&
        west < east
      )
    )
      throw new Error("服务返回了无效的城市范围。");
    return { south, north, west, east };
  };
  const geocodeStops = async (city: string, stops: TextStop[]) => {
    const bounds = await findCity(city);
    const rows: GeocodedStop[] = [];
    for (const stop of stops) {
      if (stop.lngLat) {
        const inside = withinBounds(stop.lngLat, bounds);
        rows.push({
          ...stop,
          lngLat: inside ? stop.lngLat : undefined,
          method: inside ? "manual" : "missing",
          matchedName: inside
            ? "用户指定 WGS-84 坐标（请自行核对依据）"
            : "手动坐标不在城市范围内",
        });
        continue;
      }
      const candidates: { query: string; method: MatchMethod }[] = [
        { query: stop.name, method: "name" },
      ];
      if (stop.address) {
        candidates.push({ query: stop.address, method: "address" });
        const street = streetFromAddress(stop.address);
        if (street && street !== stop.address)
          candidates.push({ query: street, method: "street" });
      }
      let found: GeocodedStop | undefined;
      for (const candidate of candidates) {
        const matches = await search({
          q: `${candidate.query}, ${city}`,
          viewbox: `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`,
          bounded: "1",
        });
        // 即使服务忽略 bounded 或缓存被改写，也不接受跨城结果。
        const result = matches.find((r) =>
          withinBounds([r.lon, r.lat], bounds),
        );
        if (!result) continue;
        found = {
          ...stop,
          lngLat: [result.lon, result.lat],
          method: isStreet(result) ? "street" : candidate.method,
          matchedName: result.display_name,
          sourceUrl: sourceUrl(result),
        };
        break;
      }
      rows.push(
        found ?? {
          ...stop,
          method: "missing",
          matchedName: "城市范围内没有匹配结果",
        },
      );
    }
    return { bounds, rows, stats: { ...stats } };
  };
  return { geocodeStops, stats };
};
