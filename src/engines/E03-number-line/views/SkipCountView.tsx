/**
 * E03 skip-count(뛰어 세기) 화면.
 *
 * 버튼·키보드로만 끝까지 조작할 수 있다(카드 3·11번).
 * 뛴 횟수는 `showHopCount`가 참일 때만 쓰고, 기본값은 거짓이다(정답 노출 금지).
 * 여러 줄에서는 겹치는 눈금을 강조하지 않는다 — 줄마다 무늬만 다르게 한다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { numberLineStrings } from '../strings.ko';
import { formatValue, parseValue, rowYs, snapFromPosition, visibleTicks, xOfValue } from '../ticks';
import type { TickRow } from '../ticks';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const TAP_SLOP = 6;
const MIN_STEP_LABEL_WIDTH = 28;
const ROW_COLORS = ['#0f7b6c', '#8a3bd8', '#b35c00', '#2f6fde'];
const ROW_DASHES = ['', '10 6', '3 5', '14 5 3 5'];

interface PressState {
  readonly pointerId: number;
  readonly start: Point;
  moved: boolean;
}

function stepValues(config: NumberLineConfig): Rational[] {
  const raw = config.stepChoices ?? [2, 3, 4, 5];
  const values: Rational[] = [];
  for (const item of raw) {
    const parsed = parseValue(String(item));
    if (!parsed || parsed.isZero() || parsed.isNegative()) continue;
    if (!values.some((value) => value.equals(parsed))) values.push(parsed);
  }
  if (values.length === 0) {
    for (const fallback of [2, 3, 4, 5]) values.push(Rational.of(fallback));
  }
  return values;
}

export function SkipCountView({
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
  const [focused, setFocused] = useState(false);
  const [row, setRow] = useState(0);
  const press = useRef<PressState | null>(null);
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, renderedSize, LOGICAL)));
  const pointRadius = Math.max(10, Math.min(20, Math.ceil(hitRadius * 0.55)));

  const skip = state.skip;
  const min = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? min.add(Rational.of(1));
  const viewMin = parseValue(state.viewMin) ?? min;
  const viewMax = parseValue(state.viewMax) ?? max;
  const unit = parseValue(state.unit) ?? Rational.of(1);
  const rows = skip?.rows ?? [];
  const rowCount = Math.max(1, rows.length);
  const ys = rowYs(rowCount);
  const activeRow = Math.min(Math.max(row, 0), rowCount - 1);
  const firstY = ys[0] ?? 300;
  const tickRows: TickRow[] = ys.map((y, index) => ({
    index,
    step: unit,
    subdivisions: 0,
    y,
  }));
  const primaryRow: TickRow = tickRows[0] ?? {
    index: 0,
    step: unit,
    subdivisions: 0,
    y: 300,
  };
  const fixedStep = (config.steps?.length ?? 0) > 0 || config.step !== undefined;
  const choices = stepValues(config);
  const showCount = config.showHopCount === true;
  const selectedRow = rows[activeRow];
  const activeY = ys[activeRow] ?? 300;

  const start = parseValue(skip?.start);
  const cursor = parseValue(state.cursor) ?? start ?? min;

  const xOf = (value: Rational): number => xOfValue(value, viewMin, viewMax);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    if (readOnly) return;
    press.current = { pointerId: event.pointerId, start: toPoint(event), moved: false };
    event.currentTarget.focus();
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = toPoint(event);
    if (Math.hypot(point.x - current.start.x, point.y - current.start.y) >= TAP_SLOP) {
      current.moved = true;
    }
  };

  const finish = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const current = press.current;
    press.current = null;
    if (!current || current.pointerId !== event.pointerId || cancelled || current.moved) return;
    const point = toPoint(event);
    const nearest = snapFromPosition(point, min, viewMin, viewMax, [primaryRow]);
    if (state.selectedCard) {
      dispatch({ type: 'place-card', card: state.selectedCard, value: nearest.value.toJSON() });
      return;
    }
    dispatch({ type: 'place-point', value: nearest.value.toJSON() });
  };

  const chooseStep = (step: Rational) => {
    if (readOnly) return;
    dispatch({ type: 'choose-step', row: activeRow, step: step.toJSON() });
  };

  const hop = () => {
    if (readOnly) return;
    dispatch({ type: 'hop', row: activeRow });
  };

  const unhop = () => {
    if (readOnly) return;
    dispatch({ type: 'unhop', row: activeRow });
  };

  const moveCursor = (direction: -1 | 1) => {
    if (readOnly) return;
    dispatch({
      type: 'set-cursor',
      value: cursor.add(unit.mul(Rational.of(direction))).toJSON(),
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'j' || key === 'J' || key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      hop();
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      unhop();
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const next = key === 'ArrowUp' ? activeRow - 1 : activeRow + 1;
      setRow(Math.min(Math.max(next, 0), rowCount - 1));
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      moveCursor(key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (state.selectedCard) {
        dispatch({
          type: 'place-card',
          card: state.selectedCard,
          value: state.cardCursor ?? state.cursor,
        });
        return;
      }
      dispatch({ type: 'place-point', value: state.cursor });
      return;
    }
    if (key === 'Escape') {
      dispatch({ type: 'select-card', card: null });
      return;
    }
    if (/^[1-9]$/.test(key) && !fixedStep) {
      const choice = choices[Number(key) - 1];
      if (choice) {
        event.preventDefault();
        event.stopPropagation();
        chooseStep(choice);
      }
    }
  };

  const formattedUnit = formatValue(unit, 'integer');

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-cpa={cpa}
      style={{ width: `${100 * scale}%` }}
    >
      <div className={styles.toolbar}>
        {fixedStep ? (
          <span className={styles.badge}>
            {numberLineStrings.skip.stepFixed(
              formatValue(parseValue(selectedRow?.step ?? unit.toString()) ?? unit, 'integer'),
            )}
          </span>
        ) : (
          <div
            role="group"
            aria-label={numberLineStrings.skip.stepGroup}
            className={styles.toolbar}
          >
            {choices.map((choice) => {
              const text = formatValue(choice, 'integer');
              const active = selectedRow?.step === choice.toJSON();
              return (
                <button
                  key={text}
                  type="button"
                  className={styles.button}
                  aria-pressed={active}
                  data-selected={active}
                  onClick={() => chooseStep(choice)}
                  disabled={readOnly}
                >
                  {numberLineStrings.skip.stepChoice(text)}
                </button>
              );
            })}
          </div>
        )}
        {rowCount > 1 ? (
          <div role="group" aria-label={numberLineStrings.skip.rowGroup} className={styles.toolbar}>
            {rows.map((_, index) => (
              <button
                key={`row-${index}`}
                type="button"
                className={styles.button}
                aria-pressed={index === activeRow}
                data-selected={index === activeRow}
                onClick={() => setRow(index)}
                disabled={readOnly}
              >
                {numberLineStrings.skip.rowChoice(index + 1)}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className={styles.button}
          onClick={hop}
          disabled={readOnly || selectedRow?.step === null}
        >
          {numberLineStrings.skip.hop}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={unhop}
          disabled={readOnly || (selectedRow?.hops.length ?? 0) === 0}
        >
          {numberLineStrings.skip.unhop}
        </button>
        {showCount ? (
          <span className={styles.badge} data-testid="skip-hop-count" aria-live="polite">
            {numberLineStrings.skip.hopCount(selectedRow?.hops.length ?? 0)}
          </span>
        ) : null}
        {state.selectedCard ? (
          <span className={styles.badge}>{numberLineStrings.selectedCard(state.selectedCard)}</span>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={numberLineStrings.canvasLabel}
        data-testid="number-line-canvas"
        data-mode="skip-count"
        data-tick={formattedUnit}
        data-row-count={rowCount}
        data-view-min={state.viewMin}
        data-view-max={state.viewMax}
        tabIndex={readOnly ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocused(false);
        }}
      >
        <defs>
          <marker
            id="e03-skip-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowHead} />
          </marker>
        </defs>
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} rx={16} className={styles.background} />
        <rect
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          rx={16}
          fill="none"
          className={styles.edge}
          pointerEvents="none"
        />

        {tickRows.map((tickRow, index) => {
          const ticks = visibleTicks(tickRow, min, viewMin, viewMax);
          return (
            <g key={`line-${index}`} data-row={index} data-active={index === activeRow}>
              <line
                x1={LINE_LEFT}
                y1={tickRow.y}
                x2={LINE_RIGHT}
                y2={tickRow.y}
                className={styles.line}
                pointerEvents="none"
              />
              {ticks.map((tick) => {
                const major = tick.value.div(Rational.of(5)).isInteger();
                return (
                  <g
                    key={`tick-${index}-${tick.index}`}
                    pointerEvents="none"
                    data-tick-index={tick.index}
                    data-tick-value={tick.value.toJSON()}
                  >
                    <line
                      x1={tick.x}
                      y1={tickRow.y - (major ? 11 : 6)}
                      x2={tick.x}
                      y2={tickRow.y + (major ? 11 : 6)}
                      className={major ? styles.majorTick : styles.tick}
                    />
                    {index === 0 && tick.index % 5 === 0 ? (
                      <text x={tick.x} y={tickRow.y + 32} className={styles.majorTickLabel}>
                        {formatValue(tick.value, 'integer')}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}

        {start ? (
          <g pointerEvents="none" data-testid="skip-start">
            <path d={`M ${xOf(start)} ${firstY - 14} l 8 14 l -8 14 l -8 -14 z`} fill="#1d2330" />
            <text x={xOf(start)} y={firstY - 22} className={styles.rowLabel} textAnchor="middle">
              {formatValue(start, 'integer')}
            </text>
          </g>
        ) : null}

        {rows.map((skipRow, rowIndex) => {
          const y = ys[rowIndex] ?? 300;
          const dash = ROW_DASHES[rowIndex % ROW_DASHES.length] ?? '';
          const color = ROW_COLORS[rowIndex % ROW_COLORS.length] ?? '#0f7b6c';
          const points = [skip?.start ?? state.cursor, ...skipRow.hops]
            .map((value) => parseValue(value))
            .filter((value): value is Rational => value !== null);
          const stepValue = parseValue(skipRow.step ?? undefined);
          const arcs: { from: Rational; to: Rational; index: number }[] = [];
          for (let index = 1; index < points.length; index += 1) {
            const from = points[index - 1];
            const to = points[index];
            if (from && to) arcs.push({ from, to, index });
          }
          return (
            <g key={`hops-${rowIndex}`} pointerEvents="none" data-hop-row={rowIndex}>
              {arcs.map((arc) => {
                const x1 = xOf(arc.from);
                const x2 = xOf(arc.to);
                const lift = 48 + rowIndex * 6;
                const top = y - lift;
                const mid = (x1 + x2) / 2;
                const showStep = stepValue !== null && Math.abs(x2 - x1) >= MIN_STEP_LABEL_WIDTH;
                return (
                  <g key={`arc-${rowIndex}-${arc.index}`}>
                    <path
                      d={`M ${x1} ${y - 16} Q ${mid} ${top} ${x2} ${y - 16}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={rowIndex === activeRow ? 3.5 : 2.5}
                      strokeDasharray={dash}
                      markerEnd="url(#e03-skip-arrow)"
                    />
                    {showStep && stepValue ? (
                      <text
                        x={mid}
                        y={top + 16}
                        textAnchor="middle"
                        fill={color}
                        className={styles.jumpLabel}
                        data-testid="skip-hop-step-label"
                      >
                        {formatValue(stepValue, 'integer')}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {rowIndex === activeRow
                ? skipRow.hops.map((hopValue, hopIndex) => {
                    const parsed = parseValue(hopValue);
                    if (!parsed) return null;
                    return (
                      <circle
                        key={`landing-${rowIndex}-${hopIndex}`}
                        cx={xOf(parsed)}
                        cy={y}
                        r={pointRadius * 0.7}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  })
                : null}
            </g>
          );
        })}

        {state.points.map((point) => {
          const parsed = parseValue(point.value);
          if (!parsed) return null;
          return (
            <g
              key={point.id}
              pointerEvents="none"
              data-point-id={point.id}
              data-value={point.value}
            >
              <circle
                cx={xOf(parsed)}
                cy={ys[0] ?? 300}
                r={pointRadius}
                className={styles.pointBody}
              />
              <text
                x={xOf(parsed)}
                y={(ys[0] ?? 300) - pointRadius - 10}
                className={styles.pointLabel}
              >
                {formatValue(parsed, 'integer')}
              </text>
            </g>
          );
        })}

        {focused && !readOnly ? (
          <g pointerEvents="none" data-testid="skip-cursor">
            <line
              x1={xOf(cursor)}
              y1={activeY - 26}
              x2={xOf(cursor)}
              y2={activeY + 26}
              className={styles.cursor}
            />
            <text
              x={xOf(cursor)}
              y={activeY + 54}
              className={styles.cursorLabel}
              textAnchor="middle"
            >
              {formatValue(cursor, 'integer')}
            </text>
          </g>
        ) : null}
      </svg>

      <p className={styles.instructions}>{numberLineStrings.instructions['skip-count']}</p>
    </div>
  );
}
