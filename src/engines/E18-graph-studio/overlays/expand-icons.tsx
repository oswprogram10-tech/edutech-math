/**
 * 힌트 ② expand-icons (MC-GRAPH-ICON-VALUE).
 *
 * 대상 행(`args.cat`, 없으면 큰 그림이 있는 첫 행)의 큰 그림 하나 옆에, 그것을 펼친 작은 그림
 * `legendBig`개를 반투명 줄로 그린다. 행 전체 값은 쓰지 않는다(범례 값만 그림으로 보인다).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { PictoIcon } from '../icons';
import { pictoLayout } from '../picto-layout';
import type { GraphConfig, GraphState } from '../types';
import { GraphOverlayFrame } from './frame';
import { argCat, CANVAS_SELECTOR, pictoRowsOf } from './helpers';

const ORANGE = '#b45309';
const GHOST_GAP = 3;
const MIN_SIDE = 10;

export function ExpandIconsOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  return (
    <GraphOverlayFrame testId="expand-icons" canvasSelector={CANVAS_SELECTOR}>
      {(info) => {
        const { rows, legendBig } = pictoRowsOf(state);
        const { categories } = state.settings;
        const requested = argCat(args);
        const cat =
          requested ?? categories.find((name) => (rows[name]?.big ?? 0) >= 1) ?? categories[0];
        if (cat === undefined || info.icon <= 0) return null;
        const layout = pictoLayout(categories, rows, info.width, info.icon);
        const row = layout.rows.find((item) => item.cat === cat);
        const big = row?.items.find((item) => item.kind === 'big');
        if (!row || !big) return null;

        const equalsX = big.x + big.side + 8;
        const startX = equalsX + 22;
        const available = layout.width - 10 - startX;
        const side = Math.max(
          MIN_SIDE,
          Math.min(layout.icon, Math.floor((available - (legendBig - 1) * GHOST_GAP) / legendBig)),
        );
        const centerY = big.y + big.side / 2;
        const top = centerY - side / 2;
        const length = legendBig * side + (legendBig - 1) * GHOST_GAP;
        return (
          <g data-expand-cat={cat}>
            <rect
              x={startX - 6}
              y={top - 6}
              width={length + 12}
              height={side + 12}
              rx={10}
              fill="#ffffff"
              fillOpacity={0.9}
              stroke={ORANGE}
              strokeWidth={3}
              strokeDasharray="8 6"
            />
            <text
              x={equalsX + 4}
              y={centerY + 11}
              textAnchor="middle"
              fontSize={32}
              fontWeight={800}
              fill={ORANGE}
            >
              =
            </text>
            <g opacity={0.6}>
              {Array.from({ length: legendBig }, (_, index) => (
                <g key={index} data-ghost-icon={index}>
                  <PictoIcon
                    kind={state.settings.icon}
                    x={startX + index * (side + GHOST_GAP)}
                    y={top}
                    side={side}
                  />
                </g>
              ))}
            </g>
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
