/**
 * E03 rounding(어림) 화면.
 *
 * 원래 값은 점, 어림한 자리는 삼각 깃발로만 보여 준다. 결과 값을 따로 글자로 쓰지 않고
 * 큰 눈금 라벨로만 읽게 한다(카드 4·10번). 버튼과 키보드로 끌기 없이 끝낼 수 있다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { formatNumber } from '../rounding';
import { roundingPlaceOf } from '../reduce-rounding';
import { numberLineStrings } from '../strings.ko';
import { parseValue, visibleTicks, xOfValue } from '../ticks';
import type { TickRow } from '../ticks';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineAction, NumberLineConfig, NumberLineState, RoundingMethod } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const METHODS: readonly RoundingMethod[] = ['up', 'down', 'half-up'];
const TAP_SLOP = 6;
const LINE_Y = 330;

interface PressState {
  readonly pointerId: number;
  readonly start: Point;
  moved: boolean;
  dragging: boolean;
}

export function RoundingView({
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
  const press = useRef<PressState | null>(null);
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, renderedSize, LOGICAL)));

  const rounding = state.rounding;
  const items = rounding?.items ?? [];
  const selected = Math.min(Math.max(rounding?.selected ?? 0, 0), Math.max(items.length - 1, 0));
  const item = items[selected];
  const min = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? min.add(Rational.of(1));
  const viewMin = parseValue(state.viewMin) ?? min;
  const viewMax = parseValue(state.viewMax) ?? max;
  const unit = parseValue(state.unit) ?? Rational.of(1);
  const place = roundingPlaceOf(state) ?? unit.mul(Rational.of(10));
  const row: TickRow = { index: 0, step: unit, subdivisions: 0, y: LINE_Y };
  const ticks = visibleTicks(row, min, viewMin, viewMax);
  const dragMode = config.controls === 'drag';
  const methods = (config.methods ?? METHODS).filter((method) => METHODS.includes(method));
  const itemValue = parseValue(item?.value);
  const markerValue = parseValue(item?.marker ?? undefined);

  const bigTicks = ticks
    .filter((tick) => tick.value.div(place).isInteger())
    .map((tick) => tick.value);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const xOf = (value: Rational): number => xOfValue(value, viewMin, viewMax);

  const bigTickAt = (point: Point): Rational | null => {
    let best: Rational | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const tick of bigTicks) {
      const distance = Math.abs(xOf(tick) - point.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = tick;
      }
    }
    return best;
  };

  const selectItem = (index: number) => {
    if (readOnly) return;
    dispatch({ type: 'select-item', item: index });
  };

  const round = (method: RoundingMethod) => {
    if (readOnly) return;
    dispatch({ type: 'round', item: selected, method });
  };

  const moveMarkerTo = (value: Rational) => {
    if (readOnly) return;
    dispatch({ type: 'move-marker', item: selected, value: value.toJSON() });
  };

  const nudgeMarker = (direction: -1 | 1) => {
    if (readOnly) return;
    const base = markerValue ?? itemValue;
    if (!base) return;
    moveMarkerTo(base.add(place.mul(Rational.of(direction))));
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    if (readOnly) return;
    const point = toPoint(event);
    const nearMarker =
      dragMode && markerValue !== null && Math.abs(xOf(markerValue) - point.x) <= hitRadius;
    press.current = {
      pointerId: event.pointerId,
      start: point,
      moved: false,
      dragging: nearMarker,
    };
    event.currentTarget.focus();
    if (nearMarker) event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = toPoint(event);
    if (Math.hypot(point.x - current.start.x, point.y - current.start.y) >= TAP_SLOP) {
      current.moved = true;
    }
    if (dragMode && current.moved) {
      const target = bigTickAt(point);
      if (target) moveMarkerTo(target);
    }
  };

  const finish = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const current = press.current;
    press.current = null;
    if (!current || current.pointerId !== event.pointerId || cancelled) return;
    if (dragMode && !current.dragging) {
      const point = toPoint(event);
      const target = bigTickAt(point);
      if (target) moveMarkerTo(target);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < items.length) {
        event.preventDefault();
        event.stopPropagation();
        selectItem(index);
      }
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!dragMode) return;
      event.preventDefault();
      event.stopPropagation();
      nudgeMarker(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.key === 'Enter') {
      if (!dragMode) return;
      event.preventDefault();
      event.stopPropagation();
      const base = markerValue ?? itemValue;
      if (base) moveMarkerTo(base);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'clear-marker', item: selected });
    }
  };

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
          aria-label={numberLineStrings.rounding.itemGroup}
          className={styles.toolbar}
        >
          {items.map((entry, index) => (
            <button
              key={`item-${index}`}
              type="button"
              className={styles.button}
              aria-pressed={index === selected}
              data-selected={index === selected}
              onClick={() => selectItem(index)}
              disabled={readOnly}
            >
              {numberLineStrings.rounding.item(entry.value)}
            </button>
          ))}
        </div>
        {!dragMode ? (
          <div
            role="group"
            aria-label={numberLineStrings.rounding.methodGroup}
            className={styles.toolbar}
          >
            {methods.map((method) => (
              <button
                key={method}
                type="button"
                className={styles.button}
                aria-pressed={item?.method === method}
                data-selected={item?.method === method}
                onClick={() => round(method)}
                disabled={readOnly}
              >
                {numberLineStrings.rounding.method(method)}
              </button>
            ))}
          </div>
        ) : null}
        {dragMode ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => nudgeMarker(-1)}
            disabled={readOnly}
            aria-label={numberLineStrings.rounding.moveLeft}
          >
            ◀
          </button>
        ) : null}
        {dragMode ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => nudgeMarker(1)}
            disabled={readOnly}
            aria-label={numberLineStrings.rounding.moveRight}
          >
            ▶
          </button>
        ) : null}
        {item?.marker !== null && item?.marker !== undefined ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'clear-marker', item: selected })}
            disabled={readOnly}
          >
            {numberLineStrings.rounding.clear}
          </button>
        ) : null}
        <span className={styles.badge}>
          {numberLineStrings.rounding.placeHint(formatNumber(place))}
        </span>
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={numberLineStrings.canvasLabel}
        data-testid="number-line-canvas"
        data-mode="rounding"
        data-tick={unit.toJSON()}
        data-place={place.toJSON()}
        data-controls={dragMode ? 'drag' : 'buttons'}
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
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} rx={16} className={styles.background} />
        <rect
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          rx={16}
          fill="none"
          className={styles.edge}
          pointerEvents="none"
        />
        <line
          x1={LINE_LEFT}
          y1={LINE_Y}
          x2={LINE_RIGHT}
          y2={LINE_Y}
          className={styles.line}
          pointerEvents="none"
        />

        {ticks.map((tick) => {
          const major = tick.value.div(place).isInteger();
          return (
            <g
              key={`tick-${tick.index}`}
              pointerEvents="none"
              data-tick-index={tick.index}
              data-tick-value={tick.value.toJSON()}
            >
              <line
                x1={tick.x}
                y1={LINE_Y - (major ? 14 : 6)}
                x2={tick.x}
                y2={LINE_Y + (major ? 14 : 6)}
                className={major ? styles.majorTick : styles.tick}
              />
              {major ? (
                <text x={tick.x} y={LINE_Y + 38} className={styles.majorTickLabel}>
                  {formatNumber(tick.value)}
                </text>
              ) : null}
            </g>
          );
        })}

        {items.map((entry, index) => {
          const value = parseValue(entry.value);
          if (!value) return null;
          const isSelected = index === selected;
          return (
            <g
              key={`value-${index}`}
              pointerEvents="none"
              data-testid={`rounding-value-${index}`}
              data-value={entry.value}
              data-selected={isSelected}
            >
              <circle
                cx={xOf(value)}
                cy={LINE_Y}
                r={isSelected ? 15 : 12}
                className={styles.pointBody}
                data-selected={isSelected}
              />
              <text
                x={xOf(value)}
                y={LINE_Y - 30}
                className={styles.pointLabel}
                textAnchor="middle"
              >
                {formatNumber(value)}
              </text>
            </g>
          );
        })}

        {items.map((entry, index) => {
          const marker = parseValue(entry.marker ?? undefined);
          if (!marker) return null;
          const isSelected = index === selected;
          return (
            <g
              key={`marker-${index}`}
              pointerEvents="none"
              data-testid={`rounding-marker-${index}`}
              data-marker={entry.marker}
              data-method={entry.method ?? ''}
              className={styles.roundingMarker}
              transform={`translate(${xOf(marker)} ${LINE_Y - 6})`}
            >
              <path
                d="M 0 0 L -14 -30 L 14 -30 Z"
                fill={isSelected ? '#e08a1e' : '#f0b357'}
                stroke="#101828"
                strokeWidth={isSelected ? 4 : 2.5}
              />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={-30}
                stroke="#101828"
                strokeWidth={isSelected ? 4 : 2.5}
              />
            </g>
          );
        })}

        {dragMode && focused && !readOnly ? (
          <g pointerEvents="none" data-testid="rounding-cursor">
            <line
              x1={xOf(markerValue ?? itemValue ?? min)}
              y1={LINE_Y - 58}
              x2={xOf(markerValue ?? itemValue ?? min)}
              y2={LINE_Y + 18}
              className={styles.cursor}
            />
          </g>
        ) : null}
      </svg>

      <p className={styles.instructions}>{numberLineStrings.instructions.rounding}</p>
      {dragMode ? <p className={styles.hint}>{numberLineStrings.rounding.dragHint}</p> : null}
    </div>
  );
}
