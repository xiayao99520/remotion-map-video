import { Composition, type CalculateMetadataFunction } from "remotion";
import example from "../../examples/chengdu-citywalk.json";
import { MapRoute } from "./MapRoute/MapRoute";
import { getTiming } from "./MapRoute/timeline";
import {
  getDimensions,
  mapConfigSchema,
  parseMapConfig,
  type MapConfig,
} from "./config/schema";

const defaultProps = parseMapConfig(example);
export const calculateMapMetadata: CalculateMetadataFunction<MapConfig> = ({
  props,
}) => {
  const config = parseMapConfig(props);
  return {
    props: config,
    fps: config.fps,
    durationInFrames: getTiming(config).durationInFrames,
    ...getDimensions(config.aspect),
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MapRoute"
      component={MapRoute}
      schema={mapConfigSchema}
      defaultProps={defaultProps}
      calculateMetadata={calculateMapMetadata}
      durationInFrames={getTiming(defaultProps).durationInFrames}
      fps={defaultProps.fps}
      {...getDimensions(defaultProps.aspect)}
    />
  );
};
