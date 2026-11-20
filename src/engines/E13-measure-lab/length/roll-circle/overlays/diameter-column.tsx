/**
 * 힌트 ② diameter-column (MC-GEO-RADIUS-DIAMETER). 기록표 "지름" 칸 전체(머리칸과 모든 줄)를 굵은 점선
 * 테두리로 두르고 위에 "지름" 꼬리표를 단다. 기록이 0줄이어도 머리칸에 그린다. 기록표가 없으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../../strings.ko';
import { BOARD, boardHeight, geoOf } from '../layout';
import { ROLL_CANVAS_SELECTOR } from '../types';
import type { RollConfig, RollState } from '../types';

const ORANGE = '#e8872e';
const PAD = 4;

export function DiameterColumnOverlay({ state }: OverlayProps<RollConfig, RollState>) {
  if (state.error !== null) return null;
  const table = geoOf(state).table;
  if (table === null) return null;
  const x = table.colX[0];
  const w = table.colW[0];
  return (
    <CanvasAlignedOverlay
      testId="overlay-diameter-column"
      canvasSelector={ROLL_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      <rect
        data-part="column"
        x={x - PAD}
        y={table.top - PAD}
        width={w + 2 * PAD}
        height={table.height + 2 * PAD}
        rx={6}
        fill="rgba(232,135,46,0.1)"
        stroke={ORANGE}
        strokeWidth={5}
        strokeDasharray="12 8"
      />
      <text
        data-part="label"
        x={x + w / 2}
        y={table.top - PAD - 10}
        textAnchor="middle"
        fontSize={26}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#ffffff"
        strokeWidth={6}
        paintOrder="stroke"
      >
        {S.overlay.diameterColumn}
      </text>
    </CanvasAlignedOverlay>
  );
}
