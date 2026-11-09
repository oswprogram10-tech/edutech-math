/** E09 기하판 화면. 상태의 `mode`에 따라 두 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { GeoAction, GeoConfig, GeoState } from './types';
import { ConstructView } from './views/ConstructView';
import { GeoboardView } from './views/GeoboardView';

export function GeoView(props: EngineViewProps<GeoConfig, GeoState, GeoAction>) {
  if (props.state.mode === 'geoboard') {
    return <GeoboardView {...props} state={props.state} />;
  }
  return <ConstructView {...props} state={props.state} />;
}
