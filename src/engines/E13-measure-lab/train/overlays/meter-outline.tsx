/**
 * 힌트 ② meter-outline (MC-LENGTH-NO-PROMOTE). cm 줄의 처음 10cm 막대 10개 둘레에 1m 칸 크기의 점선
 * 상자를 그리고 "1m"을 쓴다. cm가 100 미만이면(10cm 막대가 10개 미만이면) 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';
import { BOARD, geoOf, groupAt } from '../layout';
import { cmOf } from '../settings';
import { TRAIN_CANVAS_SELECTOR } from '../types';
import type { TrainConfig, TrainState } from '../types';

const ORANGE = '#e8872e';
const PAD = 5;

export function MeterOutlineOverlay({ state }: OverlayProps<TrainConfig, TrainState>) {
  if (state.error !== null || cmOf(state) < 100 || state.rods < 10) return null;
  const geo = geoOf(state);
  const at = groupAt(geo, 0);
  return (
    <CanvasAlignedOverlay
      testId="overlay-meter-outline"
      canvasSelector={TRAIN_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={BOARD.height}
    >
      <rect
        data-part="outline"
        x={at.x - PAD}
        y={at.y - PAD}
        width={geo.cell + 2 * PAD}
        height={geo.cell + 2 * PAD}
        rx={8}
        fill="rgba(232,135,46,0.1)"
        stroke={ORANGE}
        strokeWidth={5}
        strokeDasharray="12 8"
      />
      <text
        data-part="label"
        x={at.x + geo.cell / 2}
        y={at.y - PAD - 10}
        textAnchor="middle"
        fontSize={30}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#ffffff"
        strokeWidth={6}
        paintOrder="stroke"
      >
        {S.overlay.meterOutline}
      </text>
    </CanvasAlignedOverlay>
  );
}
