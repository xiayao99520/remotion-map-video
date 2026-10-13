import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Map,
  LngLatBounds,
  LngLat as MapLngLat,
  setWorkerUrl,
} from "maplibre-gl";
import { cancelRender, staticFile, useDelayRender } from "remotion";
import type { MapConfig, LngLat } from "../config/schema";
import type { RouteGeometry } from "./geometry";
import { createCameraPlan, type CameraPlan, type PlateSize } from "./camera";
import type { ProjectedRoute } from "./projection";
import { createLegDetailPlan } from "./legZoom";
import { getTiming } from "./timeline";
import {
  createMosaicPlan,
  placeOverview,
  projectOnMosaic,
  TILE_GUTTER,
  projectWorld,
  unprojectWorld,
  type MosaicTile,
} from "./mosaic";
import { getGroundBounds } from "./tiltProjection";
import { TILT_STYLE } from "./styles";
import { getArrivalOffset } from "./labelMorph";
import { waitForFonts } from "./fonts";

export type ReadyPlate = {
  overview: PlateSize & { image: string; x: number; y: number; ratio: number };
  tiles: (MosaicTile & { image: string })[];
  localTiles: (MosaicTile & {
    image: string;
    ratio: number;
    zoom: number;
    legIndex: number;
  })[];
  route: ProjectedRoute;
  plan: CameraPlan;
};

export const useMapInstance = (
  container: RefObject<HTMLDivElement | null>,
  config: MapConfig,
  geometry: RouteGeometry,
  viewport: PlateSize,
  plate: PlateSize,
) => {
  const { delayRender, continueRender } = useDelayRender();
  const [loadingHandle] = useState(() =>
    delayRender("加载全景、高清拼接底图和中文字体", {
      timeoutInMilliseconds: 300000,
    }),
  );
  const [ready, setReady] = useState<ReadyPlate | null>(null);
  const instance = useRef<Map | null>(null);
  // 等 ready 的 React 提交及 Img 的加载屏障建立后再放行，避免截到初始化中间态。
  useEffect(() => {
    if (ready) continueRender(loadingHandle);
  }, [ready, continueRender, loadingHandle]);
  useEffect(() => {
    if (!container.current || instance.current) return;
    const started = performance.now();
    const mosaic = createMosaicPlan(
      geometry.coordinates,
      viewport,
      config.closeZoom,
      config.tilt,
      16,
    );
    const detail = createLegDetailPlan(geometry, mosaic, viewport, config);
    detail.warnings.forEach((warning) => console.info(warning));
    if (mosaic.zoom < config.closeZoom)
      console.info(`路线较长，近景已自动调整为 ${mosaic.zoom} 级`);
    // 固定底图方案来源：官方 maplibre/references/render-stability.md。
    setWorkerUrl(staticFile("maplibre-gl-worker.mjs"));
    const map = new Map({
      container: container.current,
      style: config.mapStyle,
      center: geometry.stops[0],
      zoom: 0,
      interactive: false,
      attributionControl: false,
      // 固定为 1，避免高 DPI 预览把 3840 的逻辑尺寸变成超过 4096 的画布。
      pixelRatio: 1,
      fadeDuration: 0,
      // 展开的经度可能超过 180°，需要相邻世界副本承载日期变更线两侧的底图。
      renderWorldCopies: true,
      localIdeographFontFamily:
        '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    instance.current = map;
    map.on("error", (event) =>
      cancelRender(new Error("地图资源加载失败：" + event.error.message)),
    );
    // 先注册 idle 再移动相机；同一视角也触发重绘，确保有完成事件。
    const capture = (
      center: LngLat,
      zoom: number,
      size: PlateSize,
    ): Promise<string> =>
      new Promise((resolve, reject) => {
        map.once("idle", () => {
          try {
            resolve(map.getCanvas().toDataURL("image/png"));
          } catch (error) {
            reject(error);
          }
        });
        container.current!.style.width = `${size.width}px`;
        container.current!.style.height = `${size.height}px`;
        map.resize();
        map.jumpTo({ center, zoom, bearing: 0, pitch: 0 });
        map.triggerRepaint();
      });
    map.on("load", async () => {
      try {
        await waitForFonts(config);
        for (const layer of map.getStyle().layers) {
          if (layer.type === "symbol" && layer.layout?.["text-field"]) {
            map.setLayoutProperty(layer.id, "text-field", [
              "coalesce",
              ["get", "name:zh"],
              ["get", "name:nonlatin"],
              ["get", "name"],
            ]);
          }
        }
        const bounds = new LngLatBounds();
        geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate));
        const camera = map.cameraForBounds(bounds, {
          // 留出近景半个画幅再加标签边距，使跟随任一线头都不会越出底图。
          padding: {
            left: viewport.width / 2 + 100,
            right: viewport.width / 2 + 100,
            top: viewport.height / 2 + 100,
            bottom: viewport.height / 2 + 100,
          },
          // 极短或重复路线也必须先全景再推近，不能让全景比近景更近。
          maxZoom: mosaic.zoom,
        });
        if (!camera) throw new Error("无法拟合路线范围");
        if (!camera.center || camera.zoom === undefined)
          throw new Error("无法确定全景相机");
        const center = MapLngLat.convert(camera.center).toArray() as LngLat;
        // 拍摄逆投影视野的包围盒：远处不仅需要更多高度，也需要更大的横向覆盖。
        const ground = getGroundBounds(viewport, config.tilt);
        const overviewSize =
          config.tilt === 0 ? plate : getOverviewSize(ground);
        const overviewScale = Math.max(
          ground.width / overviewSize.width,
          ground.height / overviewSize.height,
        );
        const worldCenter = projectWorld(center, camera.zoom);
        const captureCenter = unprojectWorld(
          {
            x:
              worldCenter.x +
              ((ground.left + ground.right) / 2 - viewport.width / 2) /
                overviewScale,
            y:
              worldCenter.y +
              ((ground.top + ground.bottom) / 2 - viewport.height / 2) /
                overviewScale,
          },
          camera.zoom,
        );
        const overviewImage = await capture(
          captureCenter,
          camera.zoom,
          overviewSize,
        );
        console.info("全景底图已加载，开始加载近景拼接块");
        const placement = placeOverview(
          captureCenter,
          camera.zoom,
          overviewSize,
          mosaic,
        );
        const tiles: ReadyPlate["tiles"] = [];
        for (const tile of mosaic.tiles) {
          const image = await capture(tile.center, mosaic.zoom, {
            width: tile.width + TILE_GUTTER * 2,
            height: tile.height + TILE_GUTTER * 2,
          });
          tiles.push({ ...tile, image });
          console.info(
            `近景底图 ${tiles.length}/${mosaic.tiles.length} 已加载`,
          );
        }
        const localTiles: ReadyPlate["localTiles"] = [];
        for (const patch of detail.patches) {
          for (const tile of patch.mosaic.tiles) {
            const image = await capture(tile.center, patch.mosaic.zoom, {
              width: tile.width + TILE_GUTTER * 2,
              height: tile.height + TILE_GUTTER * 2,
            });
            localTiles.push({
              ...tile,
              image,
              x: patch.x + tile.x * patch.ratio,
              y: patch.y + tile.y * patch.ratio,
              ratio: patch.ratio,
              zoom: patch.mosaic.zoom,
              legIndex: patch.legIndex,
            });
          }
          console.info(
            `第 ${patch.legIndex + 1} 段局部高清 ${patch.mosaic.tiles.length} 块，${patch.mosaic.zoom} 级`,
          );
        }
        const oldPlan = createCameraPlan(viewport, overviewSize);
        setReady({
          overview: { ...placement, image: overviewImage },
          tiles,
          localTiles,
          route: detail.route,
          plan: {
            ...oldPlan,
            plate: { width: mosaic.width, height: mosaic.height },
            overviewScale: overviewScale / placement.ratio,
            overviewCenter: projectOnMosaic(center, mosaic),
            closeScale: config.tilt === 0 ? 1 : TILT_STYLE.closeScale,
            followOffset: viewport.height * (TILT_STYLE.originY - 0.5),
            legScales: detail.scales,
            holdFrames: getTiming(config).holdFrames,
            arrivalConfig: config,
            arrivalOffsets: config.stops.map((_, i) =>
              getArrivalOffset(config, i, viewport),
            ),
            departureFrames: Math.min(
              config.fps * 0.5,
              getTiming(config).travelFrames - 1,
            ),
          },
        });
        console.info(
          `底图加载完成：近景 ${mosaic.tiles.length} 块，局部高清 ${localTiles.length} 块，${mosaic.zoom} 级，耗时 ${((performance.now() - started) / 1000).toFixed(2)} 秒`,
        );
      } catch (error) {
        cancelRender(error);
      }
    });
    // 按官方 Core rules 不调用 map.remove()，保留初始化资源到本渲染页面退出。
  }, [
    config,
    container,
    continueRender,
    geometry,
    loadingHandle,
    viewport,
    plate,
  ]);
  return ready;
};

const getOverviewSize = (ground: PlateSize): PlateSize => {
  const factor = Math.min(2, 4096 / Math.max(ground.width, ground.height));
  return {
    width: Math.round(ground.width * factor),
    height: Math.round(ground.height * factor),
  };
};
