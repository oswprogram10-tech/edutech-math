/**
 * 힌트 ②: 학생이 만든 조각들의 넓이를 한 줄로 겹쳐 크기 차이를 보여 준다.
 * 조각을 바꾸거나 정답 상태로 만들지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { piecesOf } from '../reduce';
import { fractionModelStrings } from '../strings.ko';
import type { FractionModelConfig, FractionModelState } from '../types';

const COLORS = ['#2f6fde', '#e8872e', '#2f9e6b', '#b455c8', '#c94b4b', '#5b728f'];

export function SizeCompareOverlay({
  state,
}: OverlayProps<FractionModelConfig, FractionModelState>) {
  if (state.mode !== 'partition' || 'variant' in state) return null;
  const pieces = piecesOf(state);
  if (pieces.length === 0) return null;
  const maxArea = Math.max(...pieces.map((piece) => piece.area), 1);
  const rowHeight = Math.min(34, 300 / pieces.length);
  const top = 470 - (pieces.length * rowHeight) / 2;
  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-size-compare"
      aria-hidden="true"
    >
      <rect
        x={60}
        y={top - 40}
        width={880}
        height={pieces.length * rowHeight + 70}
        rx={16}
        fill="#ffffff"
        opacity={0.92}
      />
      <text x={80} y={top - 14} fill="#1d2330" fontSize={22} fontWeight={700}>
        {fractionModelStrings.areaBarsLabel}
      </text>
      {pieces.map((piece, index) => {
        const width = (piece.area / maxArea) * 700;
        return (
          <g key={`piece-area-${index}`}>
            <rect
              x={120}
              y={top + index * rowHeight}
              width={Math.max(4, width)}
              height={Math.max(6, rowHeight - 8)}
              rx={5}
              fill={COLORS[index % COLORS.length] ?? COLORS[0]}
              opacity={0.62}
              stroke="#1d2330"
              strokeWidth={1.5}
            />
            <text
              x={830}
              y={top + index * rowHeight + rowHeight / 2 + 6}
              fill="#1d2330"
              fontSize={16}
            >
              {fractionModelStrings.pieceLabel(index)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
