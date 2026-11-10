/** E10 도형 이동 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { TransformAction, TransformConfig, TransformState } from './types';
import { CongruenceView } from './views/CongruenceView';
import { LineSymmetryView } from './views/LineSymmetryView';
import { PointSymmetryView } from './views/PointSymmetryView';
import { PredictView } from './views/PredictView';
import { SlideFlipTurnView } from './views/SlideFlipTurnView';
import { TessellationView } from './views/TessellationView';

export function TransformView(
  props: EngineViewProps<TransformConfig, TransformState, TransformAction>,
) {
  switch (props.state.mode) {
    case 'slide-flip-turn':
      return <SlideFlipTurnView {...props} state={props.state} />;
    case 'predict':
      return <PredictView {...props} state={props.state} />;
    case 'tessellation':
      return <TessellationView {...props} state={props.state} />;
    case 'congruence':
      return <CongruenceView {...props} state={props.state} />;
    case 'line-symmetry':
      return <LineSymmetryView {...props} state={props.state} />;
    case 'point-symmetry':
      return <PointSymmetryView {...props} state={props.state} />;
  }
}
