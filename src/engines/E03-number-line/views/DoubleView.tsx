/**
 * E03 double(이중 수직선) 화면.
 *
 * 두 줄의 x 비율은 첫 anchor의 top/bottom 비로 고정해 대응선이 늘 수직이다.
 * 새 쌍의 기본 라벨은 값이 아니라 만든 식(`2/3 ÷ 2`, `1 ÷ 2 × 3`)이다(카드 6·10번).
 * 화면 구간은 `max(top.max, 모든 쌍의 top) × 1.1`까지 자동으로 늘어난다.
 */
import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { minTouchRadius, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { doubleRatio, pairOps, pairTexts } from '../double';
import { integerFactor } from '../state-helpers';
import { numberLineStrings } from '../strings.ko';
import { formatValue, parseValue, xOfValue } from '../ticks';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type {
  DoubleLabelStyle,
  DoubleOpKind,
  NumberLineAction,
  NumberLineConfig,
  NumberLineState,
} from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const TOP_Y = 245;
const BOTTOM_Y = 415;
const LABEL_GAP = 96;

function fractionText(value: Rational): string {
  return formatValue(value, 'fraction');
}

export function DoubleView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<NumberLineConfig, NumberLineState, NumberLineAction>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const renderedSize = useRenderedSize(svgRef);
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, renderedSize, LOGICAL)));

  const line = state.double;
  const pairs = line?.pairs ?? [];
  const selected = Math.min(Math.max(line?.selected ?? 0, 0), Math.max(pairs.length - 1, 0));
  const viewMax = parseValue(state.max) ?? Rational.of(1);
  const unit = parseValue(state.unit) ?? Rational.of(1);
  const ratio = doubleRatio(
    pairs.map((pair) => ({
      top: parseValue(pair.top) ?? Rational.of(0),
      bottom: parseValue(pair.bottom) ?? Rational.of(0),
    })),
  );
  const style = (config.labels === 'values' ? 'values' : 'expression') as DoubleLabelStyle;
  const ops = pairOps(pairs, selected);
  const divisorValues = (config.divisors ?? [2, 3])
    .map((value) => integerFactor(value))
    .filter((value): value is number => value !== null);
  const multiplierValues = (config.multipliers ?? [2, 3])
    .map((value) => integerFactor(value))
    .filter((value): value is number => value !== null);

  const xOf = (value: Rational): number => xOfValue(value, Rational.of(0), viewMax);
  const topLabel = config.top?.label ?? numberLineStrings.double.topDefault;
  const bottomLabel = config.bottom?.label ?? numberLineStrings.double.bottomDefault;

  // 기본(expression)에서는 눈금 숫자를 0과 anchor 값에만 쓴다. 새 쌍의 값은
  // 눈금 라벨로도 드러나지 않는다(정답 노출 금지). values만 모든 눈금을 쓴다.
  const anchorTops = pairs
    .filter((pair) => pair.from === null)
    .map((pair) => parseValue(pair.top))
    .filter((value): value is Rational => value !== null);
  const anchorBottoms = pairs
    .filter((pair) => pair.from === null)
    .map((pair) => parseValue(pair.bottom))
    .filter((value): value is Rational => value !== null);
  const tickNumberAt = (value: Rational, anchors: readonly Rational[]): boolean => {
    if (style === 'values') return true;
    return value.isZero() || anchors.some((anchor) => anchor.equals(value));
  };

  // 쌍 라벨은 위 줄 위쪽·아래 줄 아래쪽에 두고, x가 가까우면 높이를 엇갈린다.
  const pairLabelLevels: number[] = [];
  const lastLabelX: number[] = [];
  for (const pair of pairs) {
    const top = parseValue(pair.top);
    const x = top ? xOf(top) : 0;
    let level = lastLabelX.findIndex((previous) => Math.abs(previous - x) >= LABEL_GAP);
    if (level < 0) {
      level = lastLabelX.length;
      lastLabelX.push(x);
    } else {
      lastLabelX[level] = x;
    }
    pairLabelLevels.push(level);
  }

  const scalePair = (kind: DoubleOpKind, factor: number) => {
    if (readOnly) return;
    dispatch({ type: 'scale-pair', kind, factor });
  };

  const removePair = () => {
    if (readOnly) return;
    dispatch({ type: 'remove-pair' });
  };

  const onPairKeyDown = (index: number, event: ReactKeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'select-pair', index });
    }
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === 'ArrowUp' ? selected - 1 : selected + 1;
      if (next >= 0 && next < pairs.length) dispatch({ type: 'select-pair', index: next });
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      removePair();
    }
  };

  const stepCount = Math.max(0, Math.min(2000, Number(viewMax.div(unit).n / viewMax.div(unit).d)));
  const labelEvery = stepCount <= 12 ? 1 : Math.max(1, Math.ceil(stepCount / 10));
  const ticks: { index: number; top: Rational; bottom: Rational }[] = [];
  for (let index = 0; index <= stepCount; index += 1) {
    const top = unit.mul(Rational.of(index));
    ticks.push({ index, top, bottom: top.mul(ratio) });
  }

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-cpa={cpa}
      style={{ width: `${100 * scale}%` }}
    >
      <div className={styles.toolbar}>
        <div
          role="group"
          aria-label={numberLineStrings.double.pairGroup}
          className={styles.toolbar}
        >
          {pairs.map((_, index) => (
            <button
              key={`pair-${index}`}
              type="button"
              className={styles.button}
              aria-pressed={index === selected}
              data-selected={index === selected}
              onClick={() => dispatch({ type: 'select-pair', index })}
              disabled={readOnly}
            >
              {numberLineStrings.double.pairLabel(index)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={numberLineStrings.double.opGroup} className={styles.toolbar}>
          {divisorValues.map((factor) => (
            <button
              key={`divide-${factor}`}
              type="button"
              className={styles.button}
              onClick={() => scalePair('divide', factor)}
              disabled={readOnly}
            >
              {numberLineStrings.double.op('divide', factor)}
            </button>
          ))}
          {multiplierValues.map((factor) => (
            <button
              key={`multiply-${factor}`}
              type="button"
              className={styles.button}
              onClick={() => scalePair('multiply', factor)}
              disabled={readOnly}
            >
              {numberLineStrings.double.op('multiply', factor)}
            </button>
          ))}
          <button
            type="button"
            className={styles.button}
            onClick={removePair}
            disabled={readOnly || pairs.length <= 1}
          >
            {numberLineStrings.double.remove}
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={numberLineStrings.canvasLabel}
        data-testid="number-line-canvas"
        data-mode="double"
        data-tick={unit.toJSON()}
        data-pair-count={pairs.length}
        data-view-min={state.viewMin}
        data-view-max={state.viewMax}
        tabIndex={readOnly ? -1 : 0}
        onKeyDown={onCanvasKeyDown}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} rx={16} className={styles.background} />
        <rect
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          rx={16}
          fill="none"
          className={styles.edge}
          pointerEvents="none"
        />

        <text x={LINE_LEFT - 12} y={TOP_Y - 36} className={styles.rowLabel} textAnchor="end">
          {topLabel}
        </text>
        <text x={LINE_LEFT - 12} y={BOTTOM_Y - 36} className={styles.rowLabel} textAnchor="end">
          {bottomLabel}
        </text>

        <line x1={LINE_LEFT} y1={TOP_Y} x2={LINE_RIGHT} y2={TOP_Y} className={styles.line} />
        <line x1={LINE_LEFT} y1={BOTTOM_Y} x2={LINE_RIGHT} y2={BOTTOM_Y} className={styles.line} />

        {ticks.map((tick) => {
          const x = xOf(tick.top);
          const showTopLabel =
            style === 'values' ? tick.index % labelEvery === 0 : tickNumberAt(tick.top, anchorTops);
          const showBottomLabel =
            style === 'values'
              ? tick.index % labelEvery === 0
              : tickNumberAt(tick.bottom, anchorBottoms);
          return (
            <g
              key={`double-tick-${tick.index}`}
              pointerEvents="none"
              data-tick-value={tick.top.toJSON()}
            >
              <line
                x1={x}
                y1={TOP_Y - 9}
                x2={x}
                y2={TOP_Y + 9}
                className={tick.index % (labelEvery * 2) === 0 ? styles.majorTick : styles.tick}
              />
              <line
                x1={x}
                y1={BOTTOM_Y - 9}
                x2={x}
                y2={BOTTOM_Y + 9}
                className={tick.index % (labelEvery * 2) === 0 ? styles.majorTick : styles.tick}
              />
              {showTopLabel ? (
                <text x={x} y={TOP_Y - 20} className={styles.tickLabel}>
                  {fractionText(tick.top)}
                </text>
              ) : null}
              {showBottomLabel ? (
                <text x={x} y={BOTTOM_Y + 32} className={styles.tickLabel}>
                  {fractionText(tick.bottom)}
                </text>
              ) : null}
            </g>
          );
        })}

        {pairs.map((pair, index) => {
          const top = parseValue(pair.top);
          const bottom = parseValue(pair.bottom);
          if (!top || !bottom) return null;
          const isSelected = index === selected;
          const x = xOf(top);
          const texts = pairTexts(pairs, index, style);
          const level = pairLabelLevels[index] ?? 0;
          return (
            <g
              key={`double-pair-${index}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={numberLineStrings.double.pairLabel(index)}
              aria-pressed={isSelected}
              data-pair-index={index}
              data-top={pair.top}
              data-bottom={pair.bottom}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!readOnly) dispatch({ type: 'select-pair', index });
              }}
              onKeyDown={(event) => onPairKeyDown(index, event)}
            >
              <line
                x1={x}
                y1={TOP_Y}
                x2={x}
                y2={BOTTOM_Y}
                className={styles.doubleConnector}
                data-selected={isSelected}
                pointerEvents="none"
              />
              <circle
                cx={x}
                cy={TOP_Y}
                r={isSelected ? hitRadius + 4 : hitRadius}
                className={styles.doubleHit}
              />
              <circle
                cx={x}
                cy={TOP_Y}
                r={isSelected ? 13 : 10}
                className={styles.pointBody}
                data-selected={isSelected}
                pointerEvents="none"
              />
              <circle
                cx={x}
                cy={BOTTOM_Y}
                r={isSelected ? 13 : 10}
                className={styles.pointBody}
                data-selected={isSelected}
                pointerEvents="none"
              />
              <text
                x={x}
                y={TOP_Y - 48 - level * 22}
                className={styles.doubleLabel}
                textAnchor="middle"
                data-testid={`pair-label-top-${index}`}
                data-label-level={level}
                pointerEvents="none"
              >
                {texts.top}
              </text>
              <text
                x={x}
                y={BOTTOM_Y + 56 + level * 22}
                className={styles.doubleLabel}
                textAnchor="middle"
                data-testid={`pair-label-bottom-${index}`}
                data-label-level={level}
                pointerEvents="none"
              >
                {texts.bottom}
              </text>
            </g>
          );
        })}
      </svg>

      <div className={styles.opsBand} data-testid="double-ops-band">
        <span className={styles.opsLabel}>{numberLineStrings.double.opsBand}</span>
        {ops.length === 0 ? (
          <span className={styles.opsItem}>{numberLineStrings.double.anchor}</span>
        ) : (
          ops.map((op, index) => (
            <span key={`op-${index}`} className={styles.opsItem}>
              {numberLineStrings.double.op(op.kind, op.factor)}
            </span>
          ))
        )}
      </div>

      <p className={styles.instructions}>{numberLineStrings.instructions.double}</p>
    </div>
  );
}
