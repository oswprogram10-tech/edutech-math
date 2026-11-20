/**
 * 힌트 ② hour-60-split (MC-TIME-BASE-100). 칠한 구간이 지나는 블록 경계마다 "60분이 되면 다음 시"
 * 말풍선과 굵은 강조선을 그리고, 경계에서 나눈 조각마다 위쪽에 괄호(⌒)를 그린다. 조각마다 숫자는 쓰지 않는다.
 * 표시가 하나뿐이거나 구간이 경계를 지나지 않으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E14_MODE_STRINGS } from '../../strings-modes.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../types';
import { BAND, blocksOf, crossedBoundaries, gapCenterX, pieces, xInBlock } from '../layout';
import type { DurationConfig, DurationState } from '../types';

const ORANGE = '#e8872e';
const INK = '#1d2330';

export function Hour60SplitOverlay({ state }: OverlayProps<DurationConfig, DurationState>) {
  const { start, end } = state;
  if (state.error !== null || start === null || end === null) return null;
  const crossed = crossedBoundaries(state, start, end);
  if (crossed.length === 0) return null;
  const blocks = blocksOf(state);
  return (
    <CanvasAlignedOverlay
      testId="overlay-hour-60-split"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {crossed.map((minutes) => {
        const x = gapCenterX(state, minutes);
        return (
          <g key={minutes} data-part="split-boundary" data-x={x.toFixed(2)}>
            <line
              x1={x}
              y1={BAND.barTop - 20}
              x2={x}
              y2={BAND.barBottom + 14}
              stroke={ORANGE}
              strokeWidth={10}
              strokeLinecap="round"
            />
            <g transform={`translate(${x} ${BAND.barTop - 130})`}>
              <rect
                x={-120}
                y={-34}
                width={240}
                height={50}
                rx={14}
                fill="#fff4e3"
                stroke={ORANGE}
                strokeWidth={3}
              />
              <polygon points="-12,16 12,16 0,36" fill="#fff4e3" stroke={ORANGE} strokeWidth={3} />
              <rect x={-14} y={12} width={28} height={6} fill="#fff4e3" />
              <text x={0} y={-3} textAnchor="middle" fontSize={22} fontWeight={800} fill={INK}>
                {E14_MODE_STRINGS.duration.overlay.split}
              </text>
            </g>
          </g>
        );
      })}
      {pieces(state, start, end).map((piece) => {
        const block = blocks[piece.block];
        if (!block) return null;
        const x0 = xInBlock(block, piece.lo - block.base);
        const x1 = xInBlock(block, piece.hi - block.base);
        const top = BAND.barTop - 62;
        const foot = BAND.barTop - 12;
        const mid = (x0 + x1) / 2;
        return (
          <path
            key={piece.block}
            data-part="piece-bracket"
            data-block={piece.block}
            d={`M ${x0} ${foot} Q ${x0} ${top} ${mid} ${top} Q ${x1} ${top} ${x1} ${foot}`}
            fill="none"
            stroke={INK}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}
    </CanvasAlignedOverlay>
  );
}
