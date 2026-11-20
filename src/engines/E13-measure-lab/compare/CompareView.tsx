/** E13 compare-direct 화면. 판은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다. */
import { Frame } from '../Frame';
import { CompareBoard } from './CompareBoard';
import { CompareControls } from './CompareControls';
import type { CompareAction, CompareState } from './types';
import { useCompareUi } from './useCompareUi';

export interface CompareViewProps {
  readonly state: CompareState;
  readonly dispatch: (action: CompareAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function CompareView({ state, dispatch, targetSize, readOnly = false }: CompareViewProps) {
  const ui = useCompareUi(state, dispatch, readOnly);
  return (
    <Frame
      mode="compare-direct"
      error={state.error}
      targetSize={targetSize}
      renderBoard={(svgStyle, className) => (
        <CompareBoard
          state={state}
          ui={ui}
          locked={readOnly}
          svgStyle={svgStyle}
          className={className}
        />
      )}
      controls={<CompareControls state={state} ui={ui} readOnly={readOnly} />}
    />
  );
}
