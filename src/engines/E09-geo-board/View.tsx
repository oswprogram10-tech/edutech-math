/** E09 기하판 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { GeoAction, GeoConfig, GeoState } from './types';
import { ClassifyView } from './views/ClassifyView';
import { ConstructView } from './views/ConstructView';
import { DiagonalView } from './views/DiagonalView';
import { DragTestView } from './views/DragTestView';
import { GeoboardView } from './views/GeoboardView';
import { PerimeterView } from './views/PerimeterView';
import { CircleView } from './views/CircleView';
import { AngleView } from './views/AngleView';

export function GeoView(props: EngineViewProps<GeoConfig, GeoState, GeoAction>) {
  if (props.state.mode === 'geoboard') {
    if (props.state.settings.constraint) {
      return <PerimeterView {...props} state={props.state} />;
    }
    return <GeoboardView {...props} state={props.state} />;
  }
  if (props.state.mode === 'diagonal') {
    return <DiagonalView {...props} state={props.state} />;
  }
  if (props.state.mode === 'classify') {
    return <ClassifyView {...props} state={props.state} />;
  }
  if (props.state.mode === 'drag-test') {
    return <DragTestView {...props} state={props.state} />;
  }
  if (props.state.mode === 'circle') {
    return <CircleView {...props} state={props.state} />;
  }
  if (props.state.mode === 'angle') {
    return <AngleView {...props} state={props.state} />;
  }
  return <ConstructView {...props} state={props.state} />;
}
