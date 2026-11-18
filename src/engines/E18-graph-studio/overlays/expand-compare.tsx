/**
 * 힌트 ② expand-compare (MC-GRAPH-ICON-COUNT-COMPARE).
 *
 * 대상 두 행(`args.cats`, 없으면 그림 개수가 가장 많은 행과 값이 가장 큰 행)을 모두 작은 그림 낱개로
 * 펼쳐 같은 크기의 줄 두 개로 그린다. 줄 끝에는 길이 괄호만 두고 수는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { pictoLayout } from '../picto-layout';
import { rowValueOf } from '../reduce';
import type { GraphConfig, GraphState } from '../types';
import { GraphOverlayFrame } from './frame';
import { argCats, CANVAS_SELECTOR, pictoRowsOf } from './helpers';

const ORANGE = '#b45309';
const INK = '#1d2330';

export function ExpandCompareOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  return (
    <GraphOverlayFrame testId="expand-compare" canvasSelector={CANVAS_SELECTOR}>
      {(info) => {
        const { rows, legendBig } = pictoRowsOf(state);
        const { categories } = state.settings;
        if (categories.length < 2 || info.icon <= 0) return null;
        const valueOf = (cat: string) => rowValueOf(rows[cat] ?? { big: 0, small: 0 }, legendBig);
        const countOf = (cat: string) => (rows[cat]?.big ?? 0) + (rows[cat]?.small ?? 0);

        let picked = argCats(args)
          .filter((cat) => categories.includes(cat))
          .slice(0, 2);
        if (picked.length < 2) {
          const mostIcons = [...categories].sort((a, b) => countOf(b) - countOf(a))[0];
          const byValue = [...categories].sort((a, b) => valueOf(b) - valueOf(a));
          // 그림 개수가 가장 많은 행과 값이 가장 큰 행. 같은 행이면 다음으로 큰 행을 짝으로 둔다.
          const partner = byValue[0] === mostIcons ? byValue[1] : byValue[0];
          picked = [mostIcons, partner].filter((cat): cat is string => cat !== undefined);
        }
        if (picked.length < 2) return null;

        const layout = pictoLayout(categories, rows, info.width, info.icon);
        const left = layout.labelWidth + 10;
        const longest = Math.max(1, ...picked.map(valueOf));
        const unit = Math.max(
          3,
          Math.min(layout.icon, Math.floor((layout.width - left - 24) / longest)),
        );
        const cellGap = unit >= 8 ? 2 : 0;
        const cellH = Math.max(10, Math.min(30, Math.floor((layout.height - 40) / 2) - 26));
        return (
          <g data-compare-cats={picked.join('|')}>
            <rect
              width={layout.width}
              height={layout.height}
              fill="#ffffff"
              fillOpacity={0.94}
              data-compare-backdrop="true"
            />
            {picked.map((cat, rowIndex) => {
              const value = valueOf(cat);
              const top = 16 + rowIndex * (cellH + 40);
              const length = value * unit;
              return (
                <g key={cat} data-compare-row={cat}>
                  <text
                    x={layout.labelWidth / 2}
                    y={top + cellH / 2 + 7}
                    textAnchor="middle"
                    fontSize={20}
                    fontWeight={700}
                    fill={INK}
                  >
                    {cat}
                  </text>
                  {Array.from({ length: value }, (_, index) => (
                    <rect
                      key={index}
                      data-compare-cell={index}
                      x={left + index * unit}
                      y={top}
                      width={unit - cellGap}
                      height={cellH}
                      fill="#f6c58a"
                      stroke="#7a3e00"
                      strokeWidth={unit >= 8 ? 1.5 : 0.5}
                    />
                  ))}
                  {/* 길이 괄호: 줄 끝에서 끝까지(수는 쓰지 않는다). */}
                  <path
                    data-compare-bracket={cat}
                    d={`M${left} ${top + cellH + 8} v8 H${left + length - cellGap} v-8`}
                    fill="none"
                    stroke={ORANGE}
                    strokeWidth={3}
                  />
                </g>
              );
            })}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
