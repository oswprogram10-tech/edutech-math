/**
 * 힌트 ② count-cells (MC-MEASURE-ENDPOINT). 물건 아래, 물건이 시작한 눈금부터 1cm 칸마다 색과 빗금으로
 * 번갈아 칠한다. 칸 번호와 개수 글은 쓰지 않는다. 마지막 칸이 1cm보다 짧으면 그 부분은 점선으로 칠한다.
 * 어림 먼저인데 아직 어림을 넣지 않아 자가 보이지 않으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { Rational } from '../../../../core/math';
import { CELLS, BOARD, boardHeight, OBJECT_LEFT, PPC, r2 } from '../layout';
import { objectLength, rulerHidden } from '../settings';
import { ESTIMATE_CANVAS_SELECTOR } from '../types';
import type { EstimateConfig, EstimateState } from '../types';

const INK = '#1d2330';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';

export function CountCellsOverlay({ state }: OverlayProps<EstimateConfig, EstimateState>) {
  if (state.error !== null || rulerHidden(state)) return null;
  const length = objectLength(state);
  const whole = Number(length.integerPart());
  const rest = length.sub(Rational.of(whole));
  const partial = rest.isZero() ? 0 : Number(rest.n) / Number(rest.d);
  return (
    <CanvasAlignedOverlay
      testId="overlay-count-cells"
      canvasSelector={ESTIMATE_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight()}
    >
      <defs>
        <pattern id="e13-ov-cell-hatch" width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={10} fill="#ffe3c2" />
          <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke={ORANGE} strokeWidth={2.5} />
        </pattern>
      </defs>
      {Array.from({ length: whole }, (_, i) => (
        <rect
          key={i}
          data-part="cell"
          x={r2(OBJECT_LEFT + i * PPC)}
          y={CELLS.top}
          width={PPC}
          height={CELLS.height}
          fill={i % 2 === 0 ? '#cfe0ff' : 'url(#e13-ov-cell-hatch)'}
          stroke={i % 2 === 0 ? BLUE : ORANGE}
          strokeWidth={2.5}
        />
      ))}
      {partial > 0 ? (
        <rect
          data-part="cell-part"
          x={r2(OBJECT_LEFT + whole * PPC)}
          y={CELLS.top}
          width={r2(partial * PPC)}
          height={CELLS.height}
          fill="none"
          stroke={INK}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
      ) : null}
    </CanvasAlignedOverlay>
  );
}
