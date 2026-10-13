import { z } from "zod";
import { TRAVEL_MODE_KEYS } from "./travelModes.ts";
import { isPlaceIcon } from "./placeIcons.ts";

const coordinate = z.tuple([
  z
    .number()
    .min(-180, "经度必须在 -180 到 180 之间")
    .max(180, "经度必须在 -180 到 180 之间"),
  z
    .number()
    .min(-90, "纬度必须在 -90 到 90 之间")
    .max(90, "纬度必须在 -90 到 90 之间"),
]);
const color = z
  .string()
  .regex(/^#[\da-fA-F]{6}$/, "颜色请使用六位十六进制格式，例如 #e8432e");

export const mapConfigSchema = z.object({
  title: z.string().default(""),
  aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  fps: z.number().int("fps 必须是整数").min(1).max(120).default(30),
  stops: z
    .array(
      z.object({
        name: z.string().trim().min(1, "地名不能为空"),
        lngLat: coordinate,
        address: z.string().trim().optional(),
        mode: z.enum(TRAVEL_MODE_KEYS).default("walk"),
        icon: z
          .string()
          .trim()
          .refine(isPlaceIcon, "icon 必须是一个 emoji")
          .optional(),
      }),
    )
    .min(2, "stops 至少需要两个地点"),
  lineStyle: z.enum(["straight", "greatCircle"]).default("straight"),
  closeZoom: z.number().min(12).max(18).default(16.5),
  tilt: z.number().min(0).max(60).default(50),
  attribution: z.enum(["end", "always"]).default("end"),
  secondsPerLeg: z.number().positive("secondsPerLeg 必须大于 0").default(3),
  holdSeconds: z.number().nonnegative("holdSeconds 不能小于 0").default(1),
  introSeconds: z.number().positive("introSeconds 必须大于 0").default(1.5),
  outroSeconds: z.number().positive("outroSeconds 必须大于 0").default(1.5),
  mapStyle: z
    .string()
    .url("mapStyle 必须是完整的样式 JSON URL")
    .default("https://tiles.openfreemap.org/styles/liberty"),
  colors: z
    .object({
      line: color.default("#ff5a1f"),
      marker: color.default("#ed7b20"),
      future: color.optional(),
    })
    .default({ line: "#ff5a1f", marker: "#ed7b20" }),
});

export type MapConfig = z.infer<typeof mapConfigSchema>;
export type LngLat = [number, number];

export const parseMapConfig = (input: unknown): MapConfig => {
  const result = mapConfigSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `地图配置错误：\n${result.error.issues.map((issue) => `${issue.path.join(".") || "配置"}：${issue.message}`).join("\n")}`,
    );
  }
  return result.data;
};

export const getDimensions = (aspect: MapConfig["aspect"]) => {
  switch (aspect) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    default:
      return { width: 1080, height: 1920 };
  }
};
