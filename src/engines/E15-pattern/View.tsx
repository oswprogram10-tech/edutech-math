/** E15 규칙·패턴 화면. 상태의 `mode`에 따라 두 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import { ChartView } from './ChartView';
import { SequenceView } from './SequenceView';
import type { PatternAction, PatternConfig, PatternState } from './types';

export function PatternView(props: EngineViewProps<PatternConfig, PatternState, PatternAction>) {
  if (props.state.mode === 'hundred-chart') {
    return <ChartView {...props} state={props.state} />;
  }
  return <SequenceView {...props} state={props.state} />;
}
