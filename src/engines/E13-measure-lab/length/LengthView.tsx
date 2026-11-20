/**
 * E13 length 화면. 판은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다.
 * Backspace는 마지막 조각을 지운다(화면 어디에서든).
 */
import { useRef } from 'react';
import { Frame } from '../Frame';
import { LengthBoard } from './LengthBoard';
import { LengthControls } from './LengthControls';
import type { LengthAction, MeasureState } from './types';
import { useLengthUi } from './useLengthUi';

export interface LengthViewProps {
  readonly state: MeasureState;
  readonly dispatch: (action: LengthAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function LengthView({ state, dispatch, targetSize, readOnly = false }: LengthViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useLengthUi(state, dispatch, readOnly);
  return (
    <Frame
      mode="length"
      error={state.error}
      targetSize={targetSize}
      onKeyDown={(event) => {
        if (readOnly || event.key !== 'Backspace') return;
        event.preventDefault();
        ui.removeLast();
      }}
      renderBoard={(svgStyle, className) => (
        <LengthBoard
          svgRef={svgRef}
          state={state}
          ui={ui}
          locked={readOnly}
          svgStyle={svgStyle}
          className={className}
        />
      )}
      controls={<LengthControls svgRef={svgRef} state={state} ui={ui} readOnly={readOnly} />}
    />
  );
}
