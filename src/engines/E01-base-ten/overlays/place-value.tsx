/**
 * 힌트 ②: 자릿값 칸마다 이름과 지금 그 칸 블록이 나타내는 수를 보여 준다.
 * 목표 수가 아니라 학생이 지금 놓은 상태만 읽어 준다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { bandsFor, regionFor } from '../layout';
import { DEFAULT_CHART_LABELS } from '../types';
import type { BaseTenConfig, BaseTenState } from '../types';
import { columnNameOf, placeValueOf } from '../value';

export function PlaceValueOverlay({ state }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const region = regionFor(state);
  const bands = bandsFor(region);

  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      {bands.map((band) => {
        const name = columnNameOf(band.column);
        const label = name === null ? '' : DEFAULT_CHART_LABELS[name];
        const place = placeValueOf(band.column);
        const count = state.blocks.filter(
          (block) =>
            block.value === place &&
            block.x >= band.x &&
            block.x <= band.x + band.width &&
            block.y >= band.y &&
            block.y <= band.y + band.height,
        ).length;
        const total = place === null ? 0 : count * place;
        return (
          <g key={`place-${band.column}`}>
            <rect
              x={band.x + 3}
              y={band.y + 3}
              width={band.width - 6}
              height={band.height - 6}
              rx={12}
              fill="#2f6fde"
              fillOpacity={0.05}
              stroke="#2f6fde"
              strokeOpacity={0.35}
              strokeWidth={2}
            />
            <text
              x={band.x + band.width / 2}
              y={band.y + 30}
              textAnchor="middle"
              fontSize={22}
              fontWeight={700}
              fill="#1d4fa8"
            >
              {label}
            </text>
            <text
              x={band.x + band.width / 2}
              y={band.y + band.height - 18}
              textAnchor="middle"
              fontSize={20}
              fill="#1d2330"
            >
              {total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
