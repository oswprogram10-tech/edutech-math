/** E11 자르고 붙이기 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { CutAction, CutConfig, CutState } from './types';
import { AngleGatherView } from './views/AngleGatherView';
import { PiecesView } from './views/PiecesView';

export function CutView(props: EngineViewProps<CutConfig, CutState, CutAction>) {
  if (props.state.mode === 'angle-gather') {
    return <AngleGatherView {...props} state={props.state} />;
  }
  return <PiecesView {...props} state={props.state} />;
}
