/**
 * E03 log-zoom(큰 수 줌아웃) 화면.
 *
 * 화면 범위는 언제나 `[0, levels[level]]`이다. −/＋ 버튼·키보드·Ctrl+휠·핀치로
 * 단계를 바꾸고, 이전 단계 구간은 빗금 띠로 남긴다. 범위 밖 점·카드는 지우지 않고
 * 오른쪽 끝에 "→"로 표시한다(카드 5·10번).
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  minTouchRadius,
  pointerToLogical,
  usePinch,
  useRenderedSize,
} from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math/rational';
import { bigTickOf, logTickLabel } from '../log';
import { numberLineStrings } from '../strings.ko';
import { parseValue, snapFromPosition, xOfValue } from '../ticks';
import type { TickRow } from '../ticks';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineAction, NumberLineConfig, NumberLineState } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const LINE_Y = 380;
const TAP_SLOP = 6;
const MIN_STEP_LABEL_WIDTH = 28;

interface PressState {
  readonly pointerId: number;
  readonly start: Point;
  moved: boolean;
  pointers: number;
}

export function LogZoomView({
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
  const pinchBaseScale = useRef(1);
  const pinchBaseLevel = useRef(0);
  const levelRef = useRef(0);
  const readOnlyRef = useRef(readOnly);
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, renderedSize, LOGICAL)));

  const levels = (state.logZoom?.levels ?? [])
    .map((level) => parseValue(level))
    .filter((level): level is Rational => level !== null);
  const level = state.logZoom?.level ?? 0;
  const count = Math.max(levels.length, 1);
  const max = parseValue(state.max) ?? levels[level] ?? Rational.of(10);
  const big = bigTickOf(max);
  const minor = big.div(Rational.of(10));
  const unit = parseValue(state.unit) ?? minor;
  const previousMax = level > 0 ? levels[level - 1] : null;
  const snapRow: TickRow = { index: 0, step: unit, subdivisions: 0, y: LINE_Y };
  const cursor = parseValue(state.cursor) ?? Rational.of(0);
  const skip = state.skip;
  const skipStart = parseValue(skip?.start);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const xOf = (value: Rational): number => xOfValue(value, Rational.of(0), max);

  const zoomTo = (next: number) => {
    if (readOnly) return;
    dispatch({ type: 'log-zoom', level: next });
  };

  const pinch = usePinch({
    initialScale: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    onChange: (next) => {
      if (readOnlyRef.current) return;
      const delta = Math.round((next - pinchBaseScale.current) / 0.25);
      // 두 손가락을 오므리면(배율 감소) 더 넓은 단계로 간다.
      const target = Math.min(
        Math.max(pinchBaseLevel.current - delta, 0),
        Math.max(levels.length - 1, 0),
      );
      if (target !== levelRef.current) dispatch({ type: 'log-zoom', level: target });
    },
  });

  // Ctrl+휠은 React 합성 이벤트가 passive일 수 있어 SVG에 직접 붙인다.
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (readOnlyRef.current) return;
      const current = Number(element.dataset.logLevel ?? '0');
      const last = Number(element.dataset.logMaxLevel ?? '0');
      const next = Math.min(Math.max(current + (event.deltaY > 0 ? 1 : -1), 0), last);
      if (next !== current) dispatch({ type: 'log-zoom', level: next });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const placeAt = (point: Point) => {
    const snap = snapFromPosition(point, Rational.of(0), Rational.of(0), max, [snapRow]);
    if (state.selectedCard) {
      const cardValue = parseValue(state.selectedCard);
      // 범위 밖 카드는 값을 지우지 않고 그대로 두어 "→"로 보이게 한다.
      const value =
        cardValue && cardValue.compareTo(max) > 0 ? cardValue.toJSON() : snap.value.toJSON();
      dispatch({ type: 'place-card', card: state.selectedCard, value });
      return;
    }
    dispatch({ type: 'place-point', value: snap.value.toJSON() });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    pinch.handlers.onPointerDown(event);
    if (readOnly) return;
    const pointers = (press.current?.pointers ?? 0) + 1;
    if (pointers === 1) {
      pinchBaseScale.current = pinch.scale;
      pinchBaseLevel.current = levelRef.current;
      press.current = {
        pointerId: event.pointerId,
        start: toPoint(event),
        moved: false,
        pointers,
      };
    } else {
      const current = press.current;
      if (current) current.pointers = pointers;
      press.current = current
        ? { ...current, pointers, moved: true }
        : { pointerId: event.pointerId, start: toPoint(event), moved: true, pointers };
    }
    event.currentTarget.focus();
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    pinch.handlers.onPointerMove(event);
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId || current.pointers > 1) return;
    const point = toPoint(event);
    if (Math.hypot(point.x - current.start.x, point.y - current.start.y) >= TAP_SLOP) {
      current.moved = true;
    }
  };

  const finish = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    pinch.handlers.onPointerUp(event);
    const current = press.current;
    press.current = null;
    if (!current || current.pointerId !== event.pointerId || cancelled) return;
    if (current.pointers > 1 || current.moved) return;
    placeAt(toPoint(event));
  };

  const hop = () => {
    if (!readOnly) dispatch({ type: 'hop', row: 0 });
  };
  const unhop = () => {
    if (!readOnly) dispatch({ type: 'unhop', row: 0 });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === '-' || key === '_' || key === 'PageDown') {
      event.preventDefault();
      event.stopPropagation();
      zoomTo(level + 1);
      return;
    }
    if (key === '+' || key === '=' || key === 'PageUp') {
      event.preventDefault();
      event.stopPropagation();
      zoomTo(level - 1);
      return;
    }
    if (key === 'j' || key === 'J' || key === ' ') {
      if (!skip) return;
      event.preventDefault();
      event.stopPropagation();
      hop();
      return;
    }
    if (key === 'Backspace') {
      if (!skip) return;
      event.preventDefault();
      event.stopPropagation();
      unhop();
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({
        type: 'set-cursor',
        value: cursor.add(unit.mul(Rational.of(key === 'ArrowLeft' ? -1 : 1))).toJSON(),
      });
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
    if (key === 'Escape') dispatch({ type: 'select-card', card: null });
  };

  const bigTicks: { index: number; value: Rational }[] = [];
  for (let index = 0; index <= 10; index += 1) {
    bigTicks.push({ index, value: big.mul(Rational.of(index)) });
  }
  const minorTicks: { index: number; value: Rational }[] = [];
  for (let index = 0; index <= 100; index += 1) {
    const value = minor.mul(Rational.of(index));
    if (value.compareTo(max) > 0) break;
    minorTicks.push({ index, value });
  }
  const hopPoints = skip
    ? [skip.start, ...(skip.rows[0]?.hops ?? [])]
        .map((value) => parseValue(value))
        .filter((value): value is Rational => value !== null)
    : [];
  const offRangePoints = state.points
    .map((point) => ({ source: point.id, value: point.value, parsed: parseValue(point.value) }))
    .filter(
      (entry): entry is { source: string; value: string; parsed: Rational } =>
        entry.parsed !== null && entry.parsed.compareTo(max) > 0,
    );
  const offRangeCards = state.cards
    .map((card) => ({
      source: card,
      value: state.cardValues[card] ?? '',
      parsed: parseValue(state.cardValues[card] ?? undefined),
    }))
    .filter(
      (entry): entry is { source: string; value: string; parsed: Rational } =>
        entry.parsed !== null && entry.parsed.compareTo(max) > 0,
    );

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-cpa={cpa}
      style={{ width: `${100 * scale}%` }}
    >
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          onClick={() => zoomTo(level + 1)}
          disabled={readOnly || level >= count - 1}
          aria-label={numberLineStrings.logZoom.zoomOutLabel}
        >
          −
        </button>
        <span className={styles.zoomLabel} aria-live="polite">
          {numberLineStrings.logZoom.level(level + 1, count)}
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={() => zoomTo(level - 1)}
          disabled={readOnly || level <= 0}
          aria-label={numberLineStrings.logZoom.zoomInLabel}
        >
          +
        </button>
        <span className={styles.badge}>
          {numberLineStrings.logZoom.range(logTickLabel(max, config.labelStyle))}
        </span>
        {skip ? (
          <>
            <button
              type="button"
              className={styles.button}
              onClick={hop}
              disabled={readOnly || !skip.rows[0]?.step}
            >
              {numberLineStrings.skip.hop}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={unhop}
              disabled={readOnly || (skip.rows[0]?.hops.length ?? 0) === 0}
            >
              {numberLineStrings.skip.unhop}
            </button>
          </>
        ) : null}
        {state.selectedCard ? (
          <span className={styles.badge}>{numberLineStrings.selectedCard(state.selectedCard)}</span>
        ) : null}
      </div>

      {state.cards.length > 0 ? (
        <div
          role="group"
          aria-label={numberLineStrings.logZoom.cardTray}
          className={styles.toolbar}
        >
          {state.cards.map((card) => {
            const selected = state.selectedCard === card;
            const placed = state.cardValues[card] ?? null;
            return (
              <button
                key={card}
                type="button"
                className={styles.button}
                aria-label={numberLineStrings.logZoom.card(card)}
                aria-pressed={selected}
                data-selected={selected}
                data-placed={placed ?? ''}
                data-testid={`log-card-${card}`}
                onClick={() => dispatch({ type: 'select-card', card: selected ? null : card })}
                disabled={readOnly}
              >
                {card}
              </button>
            );
          })}
        </div>
      ) : null}

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={numberLineStrings.canvasLabel}
        data-testid="number-line-canvas"
        data-mode="log-zoom"
        data-tick={unit.toJSON()}
        data-log-level={level}
        data-log-max-level={count - 1}
        data-zoom-level={level}
        data-zoom-min={0}
        data-zoom-max={count - 1}
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
          <pattern
            id="e03-prev-band-hatch"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="14" height="14" fill="#dfe8ff" />
            <line x1="0" y1="0" x2="0" y2="14" stroke="#8ea8dc" strokeWidth="4" />
          </pattern>
          <marker
            id="e03-log-arrow"
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

        {previousMax ? (
          <g pointerEvents="none" data-testid="log-prev-band">
            <rect
              x={LINE_LEFT}
              y={LINE_Y - 140}
              width={Math.max(0, xOf(previousMax) - LINE_LEFT)}
              height={116}
              className={styles.prevBand}
              fill="url(#e03-prev-band-hatch)"
            />
            <text x={LINE_LEFT + 8} y={LINE_Y - 148} className={styles.rowLabel} textAnchor="start">
              {numberLineStrings.logZoom.pastBand}
            </text>
          </g>
        ) : null}

        <line
          x1={LINE_LEFT}
          y1={LINE_Y}
          x2={LINE_RIGHT}
          y2={LINE_Y}
          className={styles.line}
          pointerEvents="none"
        />

        {minorTicks.map((tick) => {
          const major = tick.index % 10 === 0;
          return (
            <g
              key={`log-tick-${tick.index}`}
              pointerEvents="none"
              data-tick-index={tick.index}
              data-tick-value={tick.value.toJSON()}
            >
              <line
                x1={xOf(tick.value)}
                y1={LINE_Y - (major ? 14 : 6)}
                x2={xOf(tick.value)}
                y2={LINE_Y + (major ? 14 : 6)}
                className={major ? styles.majorTick : styles.tick}
              />
            </g>
          );
        })}
        {bigTicks.map((tick) => (
          <text
            key={`log-label-${tick.index}`}
            x={xOf(tick.value)}
            y={LINE_Y + 40}
            className={styles.majorTickLabel}
            pointerEvents="none"
          >
            {logTickLabel(tick.value, config.labelStyle)}
          </text>
        ))}

        {config.landmarks?.map((landmark) => {
          const value = parseValue(String(landmark.value));
          if (!value || value.compareTo(max) > 0 || value.isNegative()) return null;
          return (
            <g key={`landmark-${landmark.label}`} pointerEvents="none">
              <line
                x1={xOf(value)}
                y1={LINE_Y - 24}
                x2={xOf(value)}
                y2={LINE_Y + 18}
                className={styles.landmark}
              />
              <text x={xOf(value)} y={LINE_Y - 32} className={styles.rowLabel} textAnchor="middle">
                {landmark.label}
              </text>
            </g>
          );
        })}

        {skipStart ? (
          <g pointerEvents="none" data-testid="log-start">
            <path
              d={`M ${xOf(skipStart)} ${LINE_Y - 10} l 7 12 l -7 12 l -7 -12 z`}
              fill="#1d2330"
            />
          </g>
        ) : null}

        {hopPoints.slice(1).map((point, index) => {
          const from = hopPoints[index];
          if (!from) return null;
          const x1 = xOf(from);
          const x2 = xOf(point);
          const lift = 46;
          const top = LINE_Y - lift;
          const showStep =
            skip?.rows[0]?.step !== undefined && Math.abs(x2 - x1) >= MIN_STEP_LABEL_WIDTH;
          return (
            <g key={`log-hop-${index}`} pointerEvents="none">
              <path
                d={`M ${x1} ${LINE_Y - 14} Q ${(x1 + x2) / 2} ${top} ${x2} ${LINE_Y - 14}`}
                fill="none"
                className={styles.jump}
                markerEnd="url(#e03-log-arrow)"
              />
              {showStep && skip?.rows[0]?.step ? (
                <text
                  x={(x1 + x2) / 2}
                  y={top + 16}
                  className={styles.jumpLabel}
                  data-testid="log-hop-step-label"
                >
                  {logTickLabel(parseValue(skip.rows[0].step) ?? minor, config.labelStyle)}
                </text>
              ) : null}
            </g>
          );
        })}

        {state.points.map((point) => {
          const parsed = parseValue(point.value);
          if (!parsed || parsed.compareTo(max) > 0) return null;
          return (
            <g
              key={point.id}
              pointerEvents="none"
              data-point-id={point.id}
              data-value={point.value}
            >
              <circle
                cx={xOf(parsed)}
                cy={LINE_Y}
                r={hitRadius * 0.55}
                className={styles.pointBody}
              />
              <text x={xOf(parsed)} y={LINE_Y - 38} className={styles.pointLabel}>
                {logTickLabel(parsed, config.labelStyle)}
              </text>
            </g>
          );
        })}

        {state.cards.map((card) => {
          const placed = parseValue(state.cardValues[card] ?? undefined);
          if (!placed || placed.compareTo(max) > 0) return null;
          return (
            <g key={`placed-${card}`} pointerEvents="none" data-card-value={placed.toJSON()}>
              <rect
                x={xOf(placed) - 12}
                y={LINE_Y - 12}
                width={24}
                height={24}
                rx={5}
                transform={`rotate(45 ${xOf(placed)} ${LINE_Y})`}
                className={styles.cardPlacedDot}
              />
              <text x={xOf(placed)} y={LINE_Y + 36} className={styles.tickLabel}>
                {state.cardValues[card] ? card : ''}
              </text>
            </g>
          );
        })}

        {offRangePoints.length + offRangeCards.length > 0 ? (
          <g pointerEvents="none" data-testid="log-off-range">
            <text
              x={LINE_RIGHT - 2}
              y={LINE_Y - 28}
              className={styles.offRangeArrow}
              textAnchor="end"
            >
              →
            </text>
            <text x={LINE_RIGHT} y={LINE_Y + 54} className={styles.rowLabel} textAnchor="end">
              {numberLineStrings.logZoom.offRange}
            </text>
            {[...offRangePoints, ...offRangeCards].map((entry, index) => (
              <text
                key={`off-${entry.source}`}
                x={LINE_RIGHT}
                y={LINE_Y - 52 - index * 18}
                className={styles.rowLabel}
                textAnchor="end"
              >
                {entry.source}
              </text>
            ))}
          </g>
        ) : null}

        {focused && !readOnly ? (
          <g pointerEvents="none" data-testid="log-cursor">
            <line
              x1={xOf(cursor)}
              y1={LINE_Y - 24}
              x2={xOf(cursor)}
              y2={LINE_Y + 24}
              className={styles.cursor}
            />
            <text
              x={xOf(cursor)}
              y={LINE_Y + 58}
              className={styles.cursorLabel}
              textAnchor="middle"
            >
              {logTickLabel(cursor, config.labelStyle)}
            </text>
          </g>
        ) : null}
      </svg>

      <p className={styles.instructions}>{numberLineStrings.instructions['log-zoom']}</p>
    </div>
  );
}
