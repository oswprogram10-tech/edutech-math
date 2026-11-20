/**
 * 힌트 ② same-tank (들이, MC-SIZE-IS-WEIGHT). 두 컵 아래 같은 크기의 빈 수조 윤곽을 점선으로 그리고,
 * 컵에서 수조로 화살표를 긋고 "같은 수조에 부어 봐요" 글을 단다. 물 높이는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';
import { BOARD, CUP_BASE_Y, boardHeight, CUP_CENTERS, TANK } from '../geometry';
import { COMPARE_CANVAS_SELECTOR } from '../types';
import type { CompareConfig, CompareState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';

export function SameTankOverlay({ state }: OverlayProps<CompareConfig, CompareState>) {
  if (state.error !== null || state.attribute !== 'capacity') return null;
  const top = TANK.bottom - TANK.height;
  return (
    <CanvasAlignedOverlay
      testId="overlay-same-tank"
      canvasSelector={COMPARE_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      {state.items.map((item, index) => {
        const cx = CUP_CENTERS[index] ?? 250;
        const y1 = CUP_BASE_Y + 36;
        const y2 = top - 8;
        return (
          <g key={item.id} data-part="tank-guide" data-id={item.id}>
            <rect
              data-part="tank-outline"
              x={cx - TANK.width / 2}
              y={top}
              width={TANK.width}
              height={TANK.height}
              fill="none"
              stroke={ORANGE}
              strokeWidth={5}
              strokeDasharray="12 8"
            />
            <line
              data-part="arrow"
              x1={cx}
              y1={y1}
              x2={cx}
              y2={y2 - 10}
              stroke={ORANGE}
              strokeWidth={6}
            />
            <polygon
              points={`${cx - 12},${y2 - 14} ${cx + 12},${y2 - 14} ${cx},${y2}`}
              fill={ORANGE}
            />
          </g>
        );
      })}
      <text
        data-part="label"
        x={BOARD.width / 2}
        y={430}
        textAnchor="middle"
        fontSize={26}
        fontWeight={800}
        fill={INK}
        stroke="#fffdf6"
        strokeWidth={5}
        paintOrder="stroke"
      >
        {S.overlay.sameTank}
      </text>
    </CanvasAlignedOverlay>
  );
}
