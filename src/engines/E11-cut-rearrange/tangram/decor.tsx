/** 실루엣을 다 채웠을 때 덧그리는 인라인 그림. 외부 자산을 쓰지 않는다. */
import type { Point } from '../../../core/engine-sdk';
import type { PieceSet } from './pieces';

export interface SilhouetteDecorProps {
  readonly pieceSet: PieceSet;
  readonly silhouette: string;
  readonly points: readonly Point[];
}

function bounds(points: readonly Point[]) {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

export function SilhouetteDecor({ pieceSet, silhouette, points }: SilhouetteDecorProps) {
  const box = bounds(points);
  const small = Math.max(10, Math.min(box.width, box.height) * 0.18);
  return (
    <g data-testid="silhouette-picture" pointerEvents="none">
      {silhouette === 'square' ? (
        <>
          <rect
            x={box.cx - box.width * 0.22}
            y={box.cy - box.height * 0.22}
            width={box.width * 0.44}
            height={box.height * 0.44}
            rx={small * 0.35}
            fill="none"
            stroke="#fff7e8"
            strokeWidth={3}
            strokeOpacity={0.9}
          />
          <circle cx={box.cx} cy={box.cy} r={small * 0.4} fill="#fff7e8" fillOpacity={0.8} />
        </>
      ) : null}
      {silhouette === 'house' ? (
        <>
          <rect
            x={box.cx - small * 0.55}
            y={box.y + box.height * 0.55}
            width={small * 1.1}
            height={box.height * 0.45}
            fill="#fff7e8"
            fillOpacity={0.75}
          />
          <rect
            x={box.cx + box.width * 0.16}
            y={box.y + box.height * 0.42}
            width={small * 0.9}
            height={small * 0.9}
            fill="none"
            stroke="#fff7e8"
            strokeWidth={3}
          />
        </>
      ) : null}
      {silhouette === 'cat' ? (
        <>
          <circle
            cx={box.cx - small * 0.8}
            cy={box.y + box.height * 0.28}
            r={small * 0.16}
            fill="#fff7e8"
          />
          <circle
            cx={box.cx + small * 0.8}
            cy={box.y + box.height * 0.28}
            r={small * 0.16}
            fill="#fff7e8"
          />
          <path
            d={`M ${box.cx - small * 0.7} ${box.y + box.height * 0.4} L ${box.cx - small * 1.4} ${box.y + box.height * 0.34} M ${box.cx - small * 0.7} ${box.y + box.height * 0.46} L ${box.cx - small * 1.45} ${box.y + box.height * 0.47} M ${box.cx + small * 0.7} ${box.y + box.height * 0.4} L ${box.cx + small * 1.4} ${box.y + box.height * 0.34} M ${box.cx + small * 0.7} ${box.y + box.height * 0.46} L ${box.cx + small * 1.45} ${box.y + box.height * 0.47}`}
            stroke="#fff7e8"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}
      {silhouette === 'boat' ? (
        <>
          <path
            d={`M ${box.x + box.width * 0.12} ${box.y + box.height * 0.98} Q ${box.x + box.width * 0.28} ${box.y + box.height * 0.9} ${box.x + box.width * 0.44} ${box.y + box.height * 0.98} Q ${box.x + box.width * 0.6} ${box.y + box.height * 1.06} ${box.x + box.width * 0.76} ${box.y + box.height * 0.98}`}
            fill="none"
            stroke="#dff3ff"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {pieceSet === 'tangram' ? (
            <line
              x1={box.x + box.width * 0.62}
              y1={box.y + box.height * 0.2}
              x2={box.x + box.width * 0.62}
              y2={box.y + box.height * 0.72}
              stroke="#fff7e8"
              strokeWidth={3}
            />
          ) : null}
        </>
      ) : null}
    </g>
  );
}
