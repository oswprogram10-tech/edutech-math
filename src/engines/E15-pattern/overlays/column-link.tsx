/**
 * 힌트 ② column-link (MC-PATTERN-RECURSIVE-ONLY 등 열과 식의 대응).
 *
 * `args.step` 단계(없으면 stepsShown)의 열마다 그 열 높이를 열 위에 쓰고,
 * 열 가운데를 지나는 점선으로 식의 같은 자리 수와 잇는다. 보여 준 단계만 쓴다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { calcLayout, EXPR_H } from '../calc-layout';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { CALC_CANVAS, argsOf, calcOf } from './helpers';

export function ColumnLinkOverlay({ state, args }: OverlayProps<PatternConfig, PatternState>) {
  const calc = calcOf(state);
  if (!calc || calc.settings.error !== null) return null;
  const layout = calcLayout(calc.settings);
  if (!layout.drawBlocks) return null;
  const requested = argsOf(args)['step'];
  const step =
    typeof requested === 'number' &&
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= calc.settings.stepsShown
      ? requested
      : calc.settings.stepsShown;
  const row = layout.rows[step - 1];
  if (!row) return null;

  return (
    <CanvasAlignedOverlay
      testId="column-link"
      canvasSelector={CALC_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      {row.cols.map((col) => {
        const cx = col.x + col.w / 2;
        const term = row.terms[col.col];
        const termTop = (term?.cy ?? row.exprY) - EXPR_H / 2 + 2;
        return (
          <g key={col.col} data-testid="column-link-item" data-col={col.col}>
            <line
              x1={cx}
              y1={col.y - 2}
              x2={cx}
              y2={termTop}
              stroke="#1d2330"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            <text
              x={cx}
              y={col.y - 12}
              fontSize={17}
              fontWeight={800}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1d2330"
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {S.overlay.columnLinkLabel(col.height)}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
