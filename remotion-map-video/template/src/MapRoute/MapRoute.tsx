import { Fragment, useMemo, useRef } from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapConfig } from "../config/schema";
import { createRouteGeometry } from "./geometry";
import { getTimeline } from "./timeline";
import { getCamera, getDetailOpacity, getPlateSize } from "./camera";
import { useMapInstance } from "./useMapInstance";
import { RouteOverlay } from "./RouteOverlay";
import { TILE_GUTTER } from "./mosaic";
import { positionOnProjectedLeg } from "./projection";
import { PlaceLabels } from "./PlaceLabels";
import { ModeBadge } from "./ModeBadge";
import { smooth } from "./timeline";
import { getTiltScene, projectTiltedPoint } from "./tiltProjection";
import { TILT_STYLE } from "./styles";
import { layoutBubbleOffsets } from "./labels";
import { getAttributionOpacity } from "./attribution";
import { getBadgeOpacity } from "./bubbleAnimation";
import { TEXT_FONT } from "./fonts";

const MapScene = ({ config }: { config: MapConfig }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const container = useRef<HTMLDivElement>(null);
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const plate = useMemo(() => getPlateSize(width, height), [width, height]);
  const geometry = useMemo(() => createRouteGeometry(config), [config]);
  const ready = useMapInstance(container, config, geometry, viewport, plate);
  const bubbleOffsets = useMemo(
    () =>
      ready
        ? layoutBubbleOffsets(
            ready.route.stops,
            ready.plan.closeScale,
            config.tilt,
          )
        : [],
    [ready, config.tilt],
  );
  const state = getTimeline(frame, config);
  const camera = ready ? getCamera(ready.route, ready.plan, state) : null;
  const head = ready
    ? positionOnProjectedLeg(ready.route.legs[state.legIndex], state.progress)
    : null;
  const badge =
    camera && head
      ? projectTiltedPoint(head, camera, viewport, config.tilt)
      : null;
  const scene = getTiltScene(viewport, config.tilt);
  const badgeOpacity = getBadgeOpacity(state, config);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#e8eef3",
        overflow: "hidden",
        fontFamily: TEXT_FONT,
        textRendering: "geometricPrecision",
        isolation: "isolate",
      }}
    >
      {/* 初始化容器不参与输出；普通 div 避免 Studio 干预 MapLibre 子节点。 */}
      <div
        ref={container}
        style={{ position: "absolute", ...plate, opacity: 0 }}
      />
      {ready && camera && badge ? (
        // 每帧新建展示层，避免 SVG 滤镜/3D 栅格缓存依赖本标签页之前渲染过哪些帧；地图实例不重建。
        <Fragment key={frame}>
          <div
            style={{
              position: "absolute",
              ...viewport,
              zIndex: 0,
              perspective: scene.perspective,
              perspectiveOrigin: `${scene.origin.x}px ${scene.origin.y}px`,
            }}
          >
            <div
              style={{
                position: "absolute",
                ...viewport,
                transformOrigin: `${scene.origin.x}px ${scene.origin.y}px`,
                transform: `rotateX(${config.tilt}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* 全景按原生尺寸合并缩放；避免先放大成两万像素的中间图层被 Chromium 裁掉。 */}
              <Img
                src={ready.overview.image}
                style={{
                  position: "absolute",
                  width: ready.overview.width / ready.overview.ratio,
                  height: ready.overview.height / ready.overview.ratio,
                  transformOrigin: "0 0",
                  transform: `translate(${camera.x + ready.overview.x * camera.scale}px,${camera.y + ready.overview.y * camera.scale}px) scale(${camera.scale * ready.overview.ratio})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  ...ready.plan.plate,
                  transformOrigin: "0 0",
                  transform:
                    "translate(" +
                    camera.x +
                    "px," +
                    camera.y +
                    "px) scale(" +
                    camera.scale +
                    ")",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    ...ready.plan.plate,
                    opacity:
                      config.tilt === 0
                        ? getDetailOpacity(camera.scale)
                        : smooth(
                            (camera.scale / ready.plan.closeScale -
                              TILT_STYLE.detailStart) /
                              (TILT_STYLE.detailEnd - TILT_STYLE.detailStart),
                          ),
                  }}
                >
                  {ready.tiles.map((tile, index) => (
                    <div
                      key={index}
                      style={{
                        position: "absolute",
                        left: tile.x,
                        top: tile.y,
                        width: tile.width,
                        height: tile.height,
                        overflow: "hidden",
                      }}
                    >
                      <Img
                        src={tile.image}
                        style={{
                          position: "absolute",
                          left: -TILE_GUTTER,
                          top: -TILE_GUTTER,
                          width: tile.width + TILE_GUTTER * 2,
                          height: tile.height + TILE_GUTTER * 2,
                        }}
                      />
                    </div>
                  ))}
                </div>
                {ready.localTiles.map((tile, index) => (
                  <div
                    key={index}
                    style={{
                      position: "absolute",
                      left: tile.x,
                      top: tile.y,
                      width: tile.width,
                      height: tile.height,
                      overflow: "hidden",
                      transformOrigin: "0 0",
                      transform: `scale(${tile.ratio})`,
                      opacity: smooth(
                        (camera.scale / ready.plan.legScales![tile.legIndex] -
                          TILT_STYLE.detailStart) /
                          (TILT_STYLE.detailEnd - TILT_STYLE.detailStart),
                      ),
                    }}
                  >
                    <Img
                      src={tile.image}
                      style={{
                        position: "absolute",
                        left: -TILE_GUTTER,
                        top: -TILE_GUTTER,
                        width: tile.width + TILE_GUTTER * 2,
                        height: tile.height + TILE_GUTTER * 2,
                      }}
                    />
                  </div>
                ))}
                <RouteOverlay
                  config={config}
                  route={ready.route}
                  state={state}
                  plate={ready.plan.plate}
                  scale={camera.scale}
                />
              </div>
            </div>
          </div>
          <PlaceLabels
            config={config}
            route={ready.route}
            state={state}
            camera={camera}
            viewport={viewport}
            bubbleOffsets={bubbleOffsets}
            badge={
              <ModeBadge
                x={badge.x}
                y={badge.y}
                mode={config.stops[state.legIndex].mode}
                opacity={badgeOpacity}
                scale={badge.depthScale}
              />
            }
          />
        </Fragment>
      ) : null}
      {config.title ? (
        <div
          style={{
            position: "absolute",
            zIndex: 4,
            left: 48,
            top: 48,
            maxWidth: width - 96,
            fontSize: 48,
            fontWeight: 700,
            color: "#172b3a",
            backgroundColor: "rgba(255,255,255,0.88)",
            padding: "18px 24px",
            borderRadius: 16,
          }}
        >
          {config.title}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          zIndex: 4,
          right: 20,
          bottom: 20,
          fontSize: 20,
          textAlign: "right",
          opacity: getAttributionOpacity(frame, config),
          color: "#172b3a",
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: "6px 10px",
          borderRadius: 4,
        }}
      >
        © OpenStreetMap contributors · OpenFreeMap · OpenMapTiles
        <br />
        openstreetmap.org/copyright
      </div>
    </AbsoluteFill>
  );
};
export const MapRoute = (config: MapConfig) => (
  <MapScene key={JSON.stringify(config)} config={config} />
);
