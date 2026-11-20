/**
 * E03 range(수의 범위) 화면.
 *
 * 수직선을 눌러 경계점(빈 동그라미)을 놓고, 경계점을 누르면 속 찬/빈 동그라미가 바뀐다.
 * 경계가 하나면 방향 단추로 굵은 구간 화살표를 그린다. 지금 상태를 "이상·초과" 같은 말로
 * 풀어 쓰지 않는다(말로 쓰기 과제의 답이 된다). 모든 조작은 단추·키보드로도 할 수 있다.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { rangeComplete, rangeContains, rangeEnds, rangeSnap } from '../reduce-range';
import { numberLineStrings } from '../strings.ko';
import { floorRational, parseValue, xOfValue } from '../ticks';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';
import styles from '../View.module.css';
import { RangeStory } from './range-story/RangeStory';
import { prefersReducedMotion, RANGE_LINE_Y, RANGE_LOGICAL_HEIGHT } from './range-story/geometry';

const S = numberLineStrings.range;
const LOGICAL = { width: LOGICAL_WIDTH, height: RANGE_LOGICAL_HEIGHT };
const TAP_SLOP = 6;
const GATE_STEP_MS = 400;
const MIN_TICK_SPACING = 7;

interface Press {
  readonly pointerId: number;
  readonly start: Point;
  /** 경계점을 눌렀으면 그 경계의 값(정렬이 바뀌어도 값으로 다시 찾는다). */
  bound: string | null;
  /** 끄는 경계점의 정렬 자리. 화면이 다시 그려지기 전에 온 move도 놓치지 않게 따로 쥔다. */
  index: number;
  moved: boolean;
}

function boundIndexAt(state: NumberLineState, value: string | null): number {
  if (value === null) return -1;
  return state.range?.bounds.findIndex((bound) => bound.value === value) ?? -1;
}

export function RangeView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<NumberLineConfig, NumberLineState, NumberLineAction>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const renderedSize = useRenderedSize(svgRef);
  const press = useRef<Press | null>(null);
  const [focused, setFocused] = useState(false);
  const [progress, setProgress] = useState(0);
  const hitRadius = Math.max(22, Math.ceil(minTouchRadius(targetSize, renderedSize, LOGICAL)));

  const range = state.range;
  const min = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? min.add(Rational.of(1));
  const unit = parseValue(state.unit) ?? Rational.of(1);
  const labelEvery = state.subdivisions[0] ?? 10;
  const locked = readOnly || (range?.locked ?? false);
  const bounds = range?.bounds ?? [];
  const ends = range ? rangeEnds(range) : { lower: null, upper: null };
  const riders = range?.riders ?? [];
  const gateOpened = range?.gateOpened ?? false;
  const story = range?.story ?? 'none';
  const [cursor, setCursor] = useState<string>(state.min);

  const xOf = (value: Rational): number => xOfValue(value, min, max);

  // 게이트를 열면 한 명씩 결과를 낸다(명당 400ms). 움직임 줄이기면 한 번에.
  const riderCount = riders.length;
  const instant = prefersReducedMotion() || riderCount === 0;
  useEffect(() => {
    if (!gateOpened || instant) return undefined;
    const timer = setInterval(() => {
      setProgress((current) => (current >= riderCount ? current : current + 1));
    }, GATE_STEP_MS);
    return () => {
      clearInterval(timer);
      setProgress(0);
    };
  }, [gateOpened, instant, riderCount]);
  const shown = !gateOpened ? 0 : instant ? riderCount : progress;

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const valueAtX = (x: number): string => {
    const span = max.sub(min);
    const ratio = Math.min(Math.max((x - LINE_LEFT) / (LINE_RIGHT - LINE_LEFT), 0), 1);
    const raw = min.add(span.mul(Rational.of(BigInt(Math.round(ratio * 1_000_000)), 1_000_000n)));
    return (rangeSnap(state, raw.toJSON()) ?? min).toJSON();
  };

  const boundNear = (point: Point): string | null => {
    let best: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const bound of bounds) {
      const value = parseValue(bound.value);
      if (!value) continue;
      const dx = Math.abs(xOf(value) - point.x);
      const dy = Math.abs(RANGE_LINE_Y - point.y);
      if (dx <= hitRadius && dy <= hitRadius + 8 && dx < bestDistance) {
        best = bound.value;
        bestDistance = dx;
      }
    }
    return best;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    if (locked) return;
    const point = toPoint(event);
    const bound = boundNear(point);
    press.current = {
      pointerId: event.pointerId,
      start: point,
      bound,
      index: boundIndexAt(state, bound),
      moved: false,
    };
    event.currentTarget.focus();
    if (bound !== null) event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId || current.bound === null) return;
    const point = toPoint(event);
    if (Math.hypot(point.x - current.start.x, point.y - current.start.y) >= TAP_SLOP) {
      current.moved = true;
    }
    if (!current.moved) return;
    const index = current.index;
    if (index < 0) return;
    const target = valueAtX(point.x);
    if (target === current.bound) return;
    // 다른 경계점이 있는 눈금으로는 옮기지 않는다.
    if (bounds.some((bound, position) => position !== index && bound.value === target)) return;
    dispatch({ type: 'move-bound', index, value: target });
    // 둘이 서로를 넘어도 같은 경계점을 계속 끌 수 있게 값과 정렬 자리를 따라간다.
    const targetValue = parseValue(target);
    current.bound = target;
    current.index = bounds.filter((bound, position) => {
      const other = parseValue(bound.value);
      return (
        position !== index &&
        other !== null &&
        targetValue !== null &&
        other.compareTo(targetValue) < 0
      );
    }).length;
  };

  const finish = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const current = press.current;
    press.current = null;
    if (!current || current.pointerId !== event.pointerId || cancelled || locked) return;
    if (current.moved) return;
    if (current.bound !== null) {
      const index = boundIndexAt(state, current.bound);
      if (index >= 0) dispatch({ type: 'toggle-closed', index });
      return;
    }
    const point = toPoint(event);
    if (Math.abs(point.y - RANGE_LINE_Y) > 70) return;
    const value = valueAtX(point.x);
    dispatch({ type: 'place-bound', value });
    setCursor(value);
  };

  const stepCursor = (direction: -1 | 1) => {
    const current = parseValue(cursor) ?? min;
    const next = current.add(unit.mul(Rational.of(direction)));
    const clamped = next.compareTo(min) < 0 ? min : next.compareTo(max) > 0 ? max : next;
    setCursor(clamped.toJSON());
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (locked) return;
    const index = boundIndexAt(state, cursor);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      stepCursor(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (index < 0) dispatch({ type: 'place-bound', value: cursor });
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      if (index >= 0) dispatch({ type: 'toggle-closed', index });
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'remove-bound', ...(index >= 0 ? { index } : {}) });
    }
  };

  // 눈금: 너무 촘촘하면 일부만 그린다(놓을 자리는 그래도 모든 unit 눈금이다).
  const total = Number(floorRational(max.sub(min).div(unit)));
  const spacing = ((LINE_RIGHT - LINE_LEFT) * 1) / Math.max(total, 1);
  const every = Math.max(1, Math.ceil(MIN_TICK_SPACING / Math.max(spacing, 0.01)));
  const tickIndexes: number[] = [];
  for (let index = 0; index <= total; index += 1) {
    if (index % every === 0 || index % labelEvery === 0) tickIndexes.push(index);
  }

  const lowerX = ends.lower ? xOf(parseValue(ends.lower.value) ?? min) : null;
  const upperX = ends.upper ? xOf(parseValue(ends.upper.value) ?? max) : null;
  const intervalFrom = lowerX ?? LINE_LEFT;
  const intervalTo = upperX ?? LINE_RIGHT;
  const hasInterval = ends.lower !== null || ends.upper !== null;
  const cursorValue = parseValue(cursor) ?? min;

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-cpa={cpa}
      style={{ width: `${100 * scale}%` }}
    >
      <div className={styles.toolbar} data-testid="range-controls">
        {bounds.length === 1 ? (
          <div role="group" aria-label={S.directionGroup} className={styles.toolbar}>
            <button
              type="button"
              className={styles.button}
              aria-pressed={range?.direction === 'left'}
              data-selected={range?.direction === 'left'}
              disabled={locked}
              onClick={() => dispatch({ type: 'set-direction', dir: 'left' })}
            >
              {S.toLeft}
            </button>
            <button
              type="button"
              className={styles.button}
              aria-pressed={range?.direction === 'right'}
              data-selected={range?.direction === 'right'}
              disabled={locked}
              onClick={() => dispatch({ type: 'set-direction', dir: 'right' })}
            >
              {S.toRight}
            </button>
          </div>
        ) : null}
        {bounds.length > 0 ? (
          <div role="group" aria-label={S.boundGroup} className={styles.toolbar}>
            {bounds.map((bound, index) => (
              <button
                key={`toggle-${index}`}
                type="button"
                className={styles.button}
                disabled={locked}
                onClick={() => dispatch({ type: 'toggle-closed', index })}
              >
                {bounds.length > 1 ? S.toggle(bound.value) : S.toggleShort}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className={styles.button}
          disabled={locked || bounds.length === 0}
          onClick={() => dispatch({ type: 'remove-bound' })}
        >
          {S.removeOne}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={locked || bounds.length === 0}
          onClick={() => dispatch({ type: 'reset' })}
        >
          {S.resetAll}
        </button>
        {story !== 'none' ? (
          <button
            type="button"
            className={styles.button}
            disabled={!range || !rangeComplete(range)}
            onClick={() => dispatch({ type: 'open-gate' })}
          >
            {S.openGate}
          </button>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        style={{ aspectRatio: `${LOGICAL_WIDTH} / ${RANGE_LOGICAL_HEIGHT}` }}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${RANGE_LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.ariaCanvas}
        data-testid="number-line-canvas"
        data-mode="range"
        data-tick={unit.toJSON()}
        data-view-min={state.viewMin}
        data-view-max={state.viewMax}
        tabIndex={locked ? -1 : 0}
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
        <rect
          width={LOGICAL_WIDTH}
          height={RANGE_LOGICAL_HEIGHT}
          rx={16}
          className={styles.background}
        />
        <rect
          width={LOGICAL_WIDTH}
          height={RANGE_LOGICAL_HEIGHT}
          rx={16}
          fill="none"
          className={styles.edge}
          pointerEvents="none"
        />

        {story !== 'none' ? (
          <g pointerEvents="none">
            <RangeStory
              riders={riders}
              passes={(height) => (range ? rangeContains(range, Rational.of(height)) : false)}
              gateOpened={gateOpened}
              shown={shown}
              story={story}
            />
          </g>
        ) : null}

        <line
          x1={LINE_LEFT}
          y1={RANGE_LINE_Y}
          x2={LINE_RIGHT}
          y2={RANGE_LINE_Y}
          className={styles.line}
          pointerEvents="none"
        />

        {hasInterval ? (
          <g pointerEvents="none" data-testid="range-interval">
            <line
              x1={intervalFrom}
              y1={RANGE_LINE_Y}
              x2={intervalTo}
              y2={RANGE_LINE_Y}
              className={styles.rangeInterval}
            />
            {ends.lower && !ends.upper ? (
              <path
                d={`M ${LINE_RIGHT + 6} ${RANGE_LINE_Y} l -16 -12 l 0 24 z`}
                className={styles.arrowHead}
              />
            ) : null}
            {ends.upper && !ends.lower ? (
              <path
                d={`M ${LINE_LEFT - 6} ${RANGE_LINE_Y} l 16 -12 l 0 24 z`}
                className={styles.arrowHead}
              />
            ) : null}
          </g>
        ) : null}

        {tickIndexes.map((index) => {
          const value = min.add(unit.mul(Rational.of(index)));
          const major = index % labelEvery === 0;
          const x = xOf(value);
          return (
            <g key={`tick-${index}`} pointerEvents="none" data-tick-value={value.toJSON()}>
              <line
                x1={x}
                y1={RANGE_LINE_Y - (major ? 14 : 6)}
                x2={x}
                y2={RANGE_LINE_Y + (major ? 14 : 6)}
                className={major ? styles.majorTick : styles.tick}
              />
              {major ? (
                <text x={x} y={RANGE_LINE_Y + 38} className={styles.majorTickLabel}>
                  {value.toString()}
                </text>
              ) : null}
            </g>
          );
        })}

        {bounds.map((bound, index) => {
          const value = parseValue(bound.value);
          if (!value) return null;
          const x = xOf(value);
          return (
            <g
              key={`bound-${bound.value}`}
              className={styles.rangeBound}
              pointerEvents="none"
              data-testid={`range-bound-${index}`}
              data-value={bound.value}
              data-closed={bound.closed}
              role="img"
              aria-label={S.pointLabel(bound.value, bound.closed)}
            >
              <circle
                cx={x}
                cy={RANGE_LINE_Y}
                r={14}
                fill={bound.closed ? '#101828' : '#ffffff'}
                className={styles.rangeBoundBody}
              />
              <text x={x} y={RANGE_LINE_Y - 30} className={styles.pointLabel}>
                {value.toString()}
              </text>
            </g>
          );
        })}

        {focused && !locked ? (
          <g pointerEvents="none" data-testid="range-cursor">
            <line
              x1={xOf(cursorValue)}
              y1={RANGE_LINE_Y - 56}
              x2={xOf(cursorValue)}
              y2={RANGE_LINE_Y + 20}
              className={styles.cursor}
            />
          </g>
        ) : null}
      </svg>

      <p className={styles.instructions}>{S.instruction}</p>
      <p className={styles.hint}>{S.keyboardHint}</p>
    </div>
  );
}
