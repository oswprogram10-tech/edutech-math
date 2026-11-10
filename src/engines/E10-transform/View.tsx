/** E10 도형 이동 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { TransformAction, TransformConfig, TransformState } from './types';
import { PredictView } from './views/PredictView';
import { SlideFlipTurnView } from './views/SlideFlipTurnView';

export function TransformView(
  props: EngineViewProps<TransformConfig, TransformState, TransformAction>,
) {
  if (props.state.mode === 'slide-flip-turn') {
    return <SlideFlipTurnView {...props} state={props.state} />;
  }
  return <PredictView {...props} state={props.state} />;
}
