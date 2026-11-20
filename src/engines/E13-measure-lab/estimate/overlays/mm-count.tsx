/**
 * 힌트 ② mm-count (MC-MEAS-UNIT-CONVERT). 확대 구간과 같은 크기(1cm = 240px)로 1cm 하나를 그리고,
 * 안의 mm 칸 10개에 1~10 번호를 붙인다. 과제 값과 상관없는 고정 그림이다.
 * mm 확대 칸이 있는 설정(zoomLevels ['cm','mm'])에서만 그린다. 확대 구간 왼쪽 빈자리에 놓인다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';
import { BOARD, ZOOM, ZOOM_PPC, boardHeight } from '../layout';
import { ESTIMATE_CANVAS_SELECTOR } from '../types';
import type { EstimateConfig, EstimateState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';
const BAR = { x: 30, top: ZOOM.stripTop + 30, height: 56 } as const;

export function MmCountOverlay({ state }: OverlayProps<EstimateConfig, EstimateState>) {
  if (state.error !== null || !state.zoomMm) return null;
  const cell = ZOOM_PPC / 10;
  return (
    <CanvasAlignedOverlay
      testId="overlay-mm-count"
      canvasSelector={ESTIMATE_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      <rect
        data-part="cm-bar"
        x={BAR.x - 6}
        y={BAR.top - 6}
        width={ZOOM_PPC + 12}
        height={BAR.height + 12}
        rx={8}
        fill="#fff4e3"
        stroke={ORANGE}
        strokeWidth={3}
      />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} data-part="mm-cell">
          <rect
            x={BAR.x + i * cell}
            y={BAR.top}
            width={cell}
            height={BAR.height}
            fill={i % 2 === 0 ? '#cfe0ff' : '#ffe3c2'}
            stroke={INK}
            strokeWidth={2}
          />
          <text
            x={BAR.x + i * cell + cell / 2}
            y={BAR.top + BAR.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            fontWeight={800}
            fill={INK}
          >
            {i + 1}
          </text>
        </g>
      ))}
      <text
        data-part="label"
        x={BAR.x + ZOOM_PPC / 2}
        y={BAR.top - 18}
        textAnchor="middle"
        fontSize={24}
        fontWeight={800}
        fill="#8a4b00"
        stroke="#ffffff"
        strokeWidth={5}
        paintOrder="stroke"
      >
        {S.overlay.mmCount}
      </text>
    </CanvasAlignedOverlay>
  );
}
