/**
 * E13 estimate 화면. 판은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다.
 * 키패드 단추는 Tab으로 고르고 Enter로 누른다.
 */
import { useRef } from 'react';
import { Frame } from '../Frame';
import { boardHeight } from './layout';
import { EstimateBoard } from './EstimateBoard';
import { EstimateControls } from './EstimateControls';
import type { EstimateAction, EstimateState } from './types';
import { useEstimateUi } from './useEstimateUi';

export interface EstimateViewProps {
  readonly state: EstimateState;
  readonly dispatch: (action: EstimateAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function EstimateView({ state, dispatch, targetSize, readOnly = false }: EstimateViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useEstimateUi(state, dispatch, readOnly);
  return (
    <Frame
      mode="estimate"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight(state)}
      renderBoard={(svgStyle, className) => (
        <EstimateBoard
          svgRef={svgRef}
          state={state}
          ui={ui}
          locked={readOnly}
          svgStyle={svgStyle}
          className={className}
        />
      )}
      controls={<EstimateControls state={state} ui={ui} readOnly={readOnly} />}
    />
  );
}
