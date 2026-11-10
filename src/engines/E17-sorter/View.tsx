/** E17 분류기 화면. 상태의 `mode`에 따라 세 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { SorterAction, SorterConfig, SorterState } from './types';
import { HierarchyView } from './views/HierarchyView';
import { TwentyQuestionsView } from './views/TwentyQuestionsView';
import { VennView } from './views/VennView';

export function SorterView(props: EngineViewProps<SorterConfig, SorterState, SorterAction>) {
  if (props.state.mode === 'venn') {
    return <VennView {...props} state={props.state} />;
  }
  if (props.state.mode === 'secret-rule') {
    return <TwentyQuestionsView {...props} state={props.state} />;
  }
  return <HierarchyView {...props} state={props.state} />;
}
