/**
 * 힌트 ② sixty-overflow (MC-TIME-BASE-100). 작은 단위 칸의 처음 60개 둘레에 큰 블록 크기의 점선 상자를
 * 그리고 "60분 = 1시간"(초 단위면 "60초 = 1분")을 쓴다. 옆에 시계 한 바퀴 그림 아이콘을 둔다.
 * 작은 단위가 60 미만이면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E14_MODE_STRINGS } from '../../strings-modes.ko';
import { BIG, BOARD_WIDTH, GROUP_W, ROD, boardHeight, geoOf, groupAt } from '../layout';
import { BASE } from '../settings';
import { TIMECALC_CANVAS_SELECTOR } from '../types';
import type { TimeCalcConfig, TimeCalcState } from '../types';

const ORANGE = '#e8872e';
const PAD = 6;

export function SixtyOverflowOverlay({ state }: OverlayProps<TimeCalcConfig, TimeCalcState>) {
  if (state.error !== null || state.small < BASE) return null;
  const geo = geoOf(state);
  const at = groupAt(geo, 0);
  const box = E14_MODE_STRINGS.timeCalc.units[state.units].box;
  // 큰 블록과 같은 크기(BIG.w × BIG.h = 60칸 묶음)라서 상자 크기는 묶음 크기다.
  const w = Math.max(GROUP_W, BIG.w);
  const h = Math.max(ROD.h, BIG.h);
  const clockX = at.x + 200;
  const clockY = at.y - 22;
  return (
    <CanvasAlignedOverlay
      testId="overlay-sixty-overflow"
      canvasSelector={TIMECALC_CANVAS_SELECTOR}
      logicalWidth={BOARD_WIDTH}
      logicalHeight={boardHeight(state)}
    >
      <rect
        data-part="box"
        x={at.x - PAD}
        y={at.y - PAD}
        width={w + 2 * PAD}
        height={h + 2 * PAD}
        rx={10}
        fill="rgba(232,135,46,0.1)"
        stroke={ORANGE}
        strokeWidth={5}
        strokeDasharray="12 8"
      />
      <text
        data-part="label"
        x={at.x - PAD}
        y={at.y - PAD - 8}
        fontSize={22}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#ffffff"
        strokeWidth={6}
        paintOrder="stroke"
      >
        {box}
      </text>
      <g data-part="clock" transform={`translate(${clockX} ${clockY})`}>
        <circle r={18} fill="#ffffff" stroke={ORANGE} strokeWidth={4} />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-12}
          stroke="#1d2330"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line x1={0} y1={0} x2={9} y2={4} stroke="#1d2330" strokeWidth={3} strokeLinecap="round" />
        {/* 한 바퀴 돌았다는 화살표 */}
        <path
          d="M -22 -6 A 24 24 0 1 1 -14 18"
          fill="none"
          stroke={ORANGE}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <polygon points="-20,-14 -26,-2 -14,-4" fill={ORANGE} />
      </g>
    </CanvasAlignedOverlay>
  );
}
