/**
 * 각기둥 전개도 작은 그림(보기 카드·힌트 오버레이 공용). 자리 이름이나 판정 이유는 그리지 않는다.
 */
import type { PlacedPiece } from '../prismnet/layout';
import { baseMarkerPoints, pieceStyle, pointsAttr, toScreen, type Fit } from '../prismnet/visuals';

interface MiniNetProps {
  readonly placed: readonly PlacedPiece[];
  readonly fit: Fit;
  /** 빗금을 칠할 조각의 `placed` 배열 번호. */
  readonly hatched?: ReadonlySet<number>;
  readonly hatchId?: string;
  readonly strokeWidth?: number;
}

export function MiniNet({ placed, fit, hatched, hatchId, strokeWidth = 1.4 }: MiniNetProps) {
  return (
    <g>
      {placed.map((piece, i) => {
        const screen = piece.points.map((p) => toScreen(fit, p));
        const style = pieceStyle(piece.type);
        return (
          <g key={`mini-${piece.id}`}>
            <polygon
              points={pointsAttr(screen)}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
            {piece.type === 'base' ? (
              <polygon
                points={baseMarkerPoints(screen)}
                fill="none"
                stroke={style.stroke}
                strokeWidth={Math.max(1, strokeWidth * 0.8)}
                strokeLinejoin="round"
              />
            ) : null}
            {hatched?.has(i) && hatchId ? (
              <polygon
                points={pointsAttr(screen)}
                fill={`url(#${hatchId})`}
                fillOpacity={0.7}
                stroke="#dc2626"
                strokeWidth={strokeWidth + 0.6}
                strokeLinejoin="round"
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

export function HatchPattern({ id }: { readonly id: string }) {
  return (
    <pattern
      id={id}
      width={7}
      height={7}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1={0} y1={0} x2={0} y2={7} stroke="#dc2626" strokeWidth={2} />
    </pattern>
  );
}
