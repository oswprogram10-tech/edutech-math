/** E10 도형 그림. 채움색 + 테두리 + 빗금 무늬로 그린다. 색만으로 구분하지 않는다. */
import { figureBounds } from '../../square';
import { ptXY } from '../../layout';
import type { BoardRect } from '../../layout';
import type { SquareFigure } from '../../types';

interface FigureShapeProps {
  readonly figure: SquareFigure;
  readonly rect: BoardRect;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth?: number;
  readonly dash?: string;
  readonly opacity?: number;
  readonly labels?: readonly string[];
  readonly labelSize?: number;
}

export function FigureShape({
  figure,
  rect,
  fill,
  stroke,
  strokeWidth = 4,
  dash,
  opacity = 1,
  labels,
  labelSize = 24,
}: FigureShapeProps) {
  const bounds = figureBounds(figure);
  const points = figure.outline
    .map((point) => {
      const xy = ptXY(rect, point);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(' ');
  const centroid = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  return (
    <g opacity={opacity}>
      <polygon
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinejoin="round"
        fillOpacity={0.86}
      />
      {labels
        ? figure.outline.map((point, index) => {
            const xy = ptXY(rect, point);
            const dx = point[0] - centroid.x;
            const dy = point[1] - centroid.y;
            const length = Math.hypot(dx, dy) || 1;
            const offset = Math.max(18, labelSize * 0.86);
            return (
              <text
                key={`label-${index}`}
                x={xy.x + (dx / length) * offset}
                y={xy.y + (dy / length) * offset + labelSize * 0.34}
                textAnchor="middle"
                fontSize={labelSize}
                fontWeight={800}
                fill={stroke}
                stroke="#ffffff"
                strokeWidth={4}
                paintOrder="stroke"
                pointerEvents="none"
                data-vertex-label={index}
              >
                {labels[index] ?? ''}
              </text>
            );
          })
        : null}
    </g>
  );
}
