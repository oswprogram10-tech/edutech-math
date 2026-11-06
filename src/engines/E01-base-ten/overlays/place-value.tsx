/**
 * 힌트 ②: 자릿값 칸마다 이름과 지금 그 칸 블록이 나타내는 수를 보여 준다.
 * 목표 수가 아니라 학생이 지금 놓은 상태만 읽어 준다.
 */
import { Rational } from '../../../core/math';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { bandsForState, regionFor } from '../layout';
import { baseTenStrings as S } from '../strings.ko';
import { DEFAULT_CHART_LABELS } from '../types';
import type { BaseTenConfig, BaseTenState } from '../types';
import {
  columnNameOf,
  exponentOfShapeColumn,
  isDecimal,
  placeValueOf,
  rationalOfShape,
} from '../value';

export function PlaceValueOverlay({ state }: OverlayProps<BaseTenConfig, BaseTenState>) {
  const region = regionFor(state);
  const bands = bandsForState(state, region);
  const decimal = isDecimal(state.settings);

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="base-ten-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      {bands.map((band) => {
        const column = exponentOfShapeColumn(band.column, state.settings.interpretation);
        const name = columnNameOf(column);
        const label = decimal
          ? (S.decimalPlaceLabels[column] ?? '')
          : name === null
            ? ''
            : DEFAULT_CHART_LABELS[name];
        const place = placeValueOf(band.column);
        const count = state.blocks.filter(
          (block) =>
            block.value === place &&
            block.x >= band.x &&
            block.x <= band.x + band.width &&
            block.y >= band.y &&
            block.y <= band.y + band.height,
        ).length;
        const total = Rational.of(count).mul(
          place === null ? Rational.of(0) : rationalOfShape(place, state.settings.interpretation),
        );
        const shown = decimal ? total.toDecimalString() : Number(total.n).toString();
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
              {shown}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
