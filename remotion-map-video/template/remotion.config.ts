/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 拼接板需要依次加载多块瓦片；CLI 初始挂载超时也必须同步放宽。
Config.setDelayRenderTimeoutInMilliseconds(300000);
