/**
 * E03 수직선 화면.
 *
 * - 빈 곳 탭: 가장 가까운 눈금에 점 찍기
 * - 점 끌기: 옮기기(놓을 때 Action 한 번). 다른 점 위에 놓으면 점프 화살표
 * - 카드 탭·끌기: 카드 선택 후 수직선에 꽂기
 * - 줌: 두 손가락 핀치, Ctrl+휠, +/− 버튼, 키보드 +/−
 * - 키보드: 점 선택 후 ←/→ 한 눈금(Shift 5눈금), Enter 점 찍기, Delete 점 지우기
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  clamp,
  minTouchRadius,
  pointerToLogical,
  usePinch,
  useRenderedSize,
} from '../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../core/engine-sdk';
import { Rational } from '../../core/math/rational';
import { rowsOf } from './reduce';
import {
  formatValue,
  moveValue,
  nearestTick,
  parseValue,
  snapFromPosition,
  visibleTicks,
  xOfValue,
  zoomDeltaForPinch,
} from './ticks';
import type { TickRow } from './ticks';
import { numberLineStrings } from './strings.ko';
import { LINE_LEFT, LINE_RIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { NumberLineAction, NumberLineConfig, NumberLineMode, NumberLineState } from './types';
import styles from './View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const TAP_SLOP = 5;
const CARD_GAP = 10;
const CARD_HEIGHT = 52;
const CARD_MAX_WIDTH = 120;

interface CardRect {
  readonly card: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface PressBase {
  readonly pointerId: number;
  readonly start: Point;
  readonly current: Point;
  readonly moved: boolean;
}

type Press =
  | (PressBase & { readonly kind: 'point'; readonly id: string })
  | (PressBase & { readonly kind: 'card'; readonly card: string })
  | (PressBase & { readonly kind: 'line' });

function cardLayout(cards: readonly string[], minHeight: number): CardRect[] {
  if (cards.length === 0) return [];
  const perRow = Math.min(cards.length, 6);
  const width = Math.min(
    CARD_MAX_WIDTH,
    (LOGICAL_WIDTH - 160 - CARD_GAP * (perRow - 1)) / Math.max(perRow, 1),
  );
  const height = Math.max(CARD_HEIGHT, minHeight);
  const result: CardRect[] = [];
  cards.forEach((card, index) => {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    const countInRow = Math.min(perRow, cards.length - row * perRow);
    const totalWidth = countInRow * width + (countInRow - 1) * CARD_GAP;
    const startX = (LOGICAL_WIDTH - totalWidth) / 2;
    result.push({
      card,
      x: startX + column * (width + CARD_GAP),
      y: 52 + row * (height + 12),
      width,
      height,
    });
  });
  return result;
}

function pointInRect(point: Point, rect: CardRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function rowForValue(
  value: string,
  rows: readonly TickRow[],
  min: Rational,
  max: Rational,
): number {
  const parsed = parseValue(value);
  if (!parsed) return 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;
    const tick = nearestTick(min, max, row.step, index, parsed);
    if (tick.value.equals(parsed)) return index;
  }
  return 0;
}

export function NumberLineView({
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
  const rows = rowsOf(state);
  const min = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? min.add(Rational.of(1));
  const hitRadius = Math.max(18, Math.ceil(minTouchRadius(targetSize, renderedSize, LOGICAL)));
  const pointRadius = Math.max(12, Math.min(22, Math.ceil(hitRadius * 0.55)));
  const touchDiameter = Math.max(
    48,
    Math.ceil(2 * minTouchRadius(targetSize, renderedSize, LOGICAL)),
  );
  const cards = cardLayout(state.cards, touchDiameter);
  const mode = state.mode;

  const [press, setPress] = useState<Press | null>(null);
  const [focused, setFocused] = useState(false);
  const pointers = useRef(new Set<number>());
  const pinchBaseScale = useRef(1);
  const pinchBaseLevel = useRef(state.zoomLevel);
  const levelRef = useRef(state.zoomLevel);
  const boundsRef = useRef({ min: state.zoomMin, max: state.zoomMax });
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    levelRef.current = state.zoomLevel;
  }, [state.zoomLevel]);
  useEffect(() => {
    boundsRef.current = { min: state.zoomMin, max: state.zoomMax };
  }, [state.zoomMin, state.zoomMax]);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const zoomBy = useCallback(
    (delta: number) => {
      if (readOnly) return;
      const level = clamp(state.zoomLevel + delta, state.zoomMin, state.zoomMax);
      if (level !== state.zoomLevel) dispatch({ type: 'zoom', level });
    },
    [dispatch, readOnly, state.zoomLevel, state.zoomMin, state.zoomMax],
  );

  const pinch = usePinch({
    initialScale: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    onChange: (next) => {
      if (readOnlyRef.current) return;
      const bounds = boundsRef.current;
      const target = clamp(
        pinchBaseLevel.current + zoomDeltaForPinch(pinchBaseScale.current, next, 0.25),
        bounds.min,
        bounds.max,
      );
      if (target !== levelRef.current) {
        dispatch({ type: 'zoom', level: target });
      }
    },
  });

  // Ctrl+휠은 React 합성 이벤트가 passive라 preventDefault가 안 될 수 있어
  // SVG에 직접 non-passive 리스너를 붙인다. 줌 단계는 DOM data 속성에서 읽어
  // 여러 휠 이벤트가 연달아 와도 최신 커밋 상태를 쓴다.
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (readOnlyRef.current) return;
      const current = Number(element.dataset.zoomLevel ?? '0');
      const min = Number(element.dataset.zoomMin ?? '0');
      const max = Number(element.dataset.zoomMax ?? '0');
      const next = clamp(current + (event.deltaY < 0 ? 1 : -1), min, max);
      if (next !== current) dispatch({ type: 'zoom', level: next });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const snapped = (point: Point) => snapFromPosition(point, min, max, rows);

  const pointPosition = (value: string): { x: number; y: number } => {
    const parsed = parseValue(value) ?? min;
    const row = rows[rowForValue(value, rows, min, max)] ?? rows[0];
    return { x: xOfValue(parsed, min, max), y: row?.y ?? 300 };
  };

  const findPoint = (point: Point, exclude: string | null = null) => {
    for (const candidate of state.points) {
      if (candidate.id === exclude) continue;
      const position = pointPosition(candidate.value);
      if (Math.abs(position.x - point.x) <= hitRadius && Math.abs(position.y - point.y) <= 72) {
        return candidate;
      }
    }
    return null;
  };

  const findCard = (point: Point): CardRect | null =>
    cards.find((rect) => pointInRect(point, rect)) ?? null;

  const isOverLine = (point: Point): boolean =>
    point.x >= LINE_LEFT - 30 && point.x <= LINE_RIGHT + 30 && point.y >= 175 && point.y <= 430;

  const handleTap = (point: Point) => {
    const hitPoint = findPoint(point);
    if (hitPoint) {
      dispatch({ type: 'select-point', id: hitPoint.id });
      return;
    }
    const hitCard = findCard(point);
    if (hitCard) {
      dispatch({ type: 'select-card', card: hitCard.card });
      return;
    }
    if (!isOverLine(point)) return;
    const snap = snapped(point);
    if (state.selectedCard) {
      dispatch({
        type: 'place-card',
        card: state.selectedCard,
        value: snap.value.toJSON(),
      });
      return;
    }
    dispatch({ type: 'place-point', value: snap.value.toJSON() });
  };

  const moveSelectedPoint = (id: string, steps: number) => {
    const point = state.points.find((candidate) => candidate.id === id);
    if (!point) return;
    const value = parseValue(point.value);
    if (!value) return;
    const row = rows[rowForValue(point.value, rows, min, max)] ?? rows[0];
    if (!row) return;
    dispatch({
      type: 'move-point',
      id,
      value: moveValue(value, steps, row, min, max).toJSON(),
    });
  };

  const handleDragEnd = (finished: Press) => {
    if (!finished.moved) {
      handleTap(finished.current);
      return;
    }
    if (finished.kind === 'point') {
      const target = findPoint(finished.current, finished.id);
      const source = state.points.find((point) => point.id === finished.id);
      if (target && source) {
        dispatch({ type: 'add-jump', from: source.value, to: target.value });
        return;
      }
      const snap = snapped(finished.current);
      dispatch({ type: 'move-point', id: finished.id, value: snap.value.toJSON() });
      return;
    }
    if (finished.kind === 'card') {
      if (isOverLine(finished.current)) {
        const snap = snapped(finished.current);
        dispatch({
          type: 'place-card',
          card: finished.card,
          value: snap.value.toJSON(),
        });
      } else {
        dispatch({ type: 'select-card', card: finished.card });
      }
      return;
    }
    if (isOverLine(finished.current)) {
      const snap = snapped(finished.current);
      dispatch({ type: 'place-point', value: snap.value.toJSON() });
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    pointers.current.add(event.pointerId);
    pinch.handlers.onPointerDown(event);
    if (readOnly) return;
    if (pointers.current.size === 1) {
      pinchBaseScale.current = pinch.scale;
      pinchBaseLevel.current = levelRef.current;
      const point = toPoint(event);
      const hitPoint = findPoint(point);
      const hitCard = hitPoint ? null : findCard(point);
      const base = { pointerId: event.pointerId, start: point, current: point, moved: false };
      if (hitPoint) setPress({ ...base, kind: 'point', id: hitPoint.id });
      else if (hitCard) setPress({ ...base, kind: 'card', card: hitCard.card });
      else setPress({ ...base, kind: 'line' });
    } else {
      setPress(null);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    pinch.handlers.onPointerMove(event);
    if (!press || press.pointerId !== event.pointerId || pointers.current.size !== 1) return;
    const point = toPoint(event);
    const moved =
      press.moved || Math.hypot(point.x - press.start.x, point.y - press.start.y) >= TAP_SLOP;
    setPress({ ...press, current: point, moved });
  };

  const finishPointer = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    event.stopPropagation();
    pinch.handlers.onPointerUp(event);
    pointers.current.delete(event.pointerId);
    if (!press || press.pointerId !== event.pointerId) return;
    const current = toPoint(event);
    const moved =
      press.moved || Math.hypot(current.x - press.start.x, current.y - press.start.y) >= TAP_SLOP;
    const finished: Press = { ...press, current, moved };
    setPress(null);
    if (!cancelled) handleDragEnd(finished);
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      event.stopPropagation();
      zoomBy(1);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      event.stopPropagation();
      zoomBy(-1);
      return;
    }
    const step = event.shiftKey ? 5 : 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === 'ArrowLeft' ? -step : step;
      if (state.selectedPointId) {
        moveSelectedPoint(state.selectedPointId, delta);
        return;
      }
      const row = rows[0];
      const cursor = parseValue(state.cursor);
      if (!row || !cursor) return;
      dispatch({ type: 'set-cursor', value: moveValue(cursor, delta, row, min, max).toJSON() });
      return;
    }
    if (event.key === 'Enter') {
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!state.selectedPointId) return;
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'remove-point', id: state.selectedPointId });
      return;
    }
    if (event.key === 'Escape') {
      dispatch({ type: 'select-point', id: null });
      dispatch({ type: 'select-card', card: null });
    }
  };

  const onPointKeyDown = (id: string, event: ReactKeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'select-point', id });
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      moveSelectedPoint(id, event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'remove-point', id });
      return;
    }
    if (event.key === 'Escape') {
      dispatch({ type: 'select-point', id: null });
    }
  };

  const onCardKeyDown = (card: string, event: ReactKeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (state.selectedCard === card) {
        dispatch({
          type: 'place-card',
          card,
          value: state.cardCursor ?? state.cursor,
        });
      } else {
        dispatch({ type: 'select-card', card });
      }
      return;
    }
    if (event.key === 'Escape') {
      dispatch({ type: 'select-card', card: null });
    }
  };

  const zoomTick = rows[0] ? formatValue(rows[0].step, mode) : '1';
  const selectedPoint = state.points.find((point) => point.id === state.selectedPointId) ?? null;
  const cursorValue = parseValue(state.cursor);
  const cursorX = cursorValue ? xOfValue(cursorValue, min, max) : 100;
  const rowCount = rows.length;
  const laserGroups = findSameGroups(state, min, max);

  const dragPreview =
    press && press.moved
      ? press.kind === 'point'
        ? { kind: 'point' as const, at: snapped(press.current) }
        : { kind: press.kind, at: snapped(press.current) }
      : null;

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-cpa={cpa}
      style={{ width: `${100 * scale}%` }}
    >
      <div className={styles.toolbar}>
        {state.zoomMax > state.zoomMin ? (
          <>
            <button
              type="button"
              className={styles.button}
              aria-label={numberLineStrings.zoomOutLabel}
              onClick={() => zoomBy(-1)}
              disabled={readOnly || state.zoomLevel <= state.zoomMin}
            >
              −
            </button>
            <span className={styles.zoomLabel} aria-live="polite">
              {numberLineStrings.zoomTick(zoomTick)}
            </span>
            <button
              type="button"
              className={styles.button}
              aria-label={numberLineStrings.zoomInLabel}
              onClick={() => zoomBy(1)}
              disabled={readOnly || state.zoomLevel >= state.zoomMax}
            >
              +
            </button>
          </>
        ) : null}
        {state.selectedCard ? (
          <span className={styles.badge}>{numberLineStrings.selectedCard(state.selectedCard)}</span>
        ) : null}
        {state.jumps.length > 0 ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'clear-jumps' })}
            disabled={readOnly}
          >
            {numberLineStrings.clearJumps}
          </button>
        ) : null}
        {selectedPoint ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'remove-point', id: selectedPoint.id })}
            disabled={readOnly}
          >
            {numberLineStrings.removePoint}
          </button>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={numberLineStrings.canvasLabel}
        data-testid="number-line-canvas"
        data-mode={mode}
        data-tick={rows[0]?.step.toJSON() ?? '1'}
        data-zoom-level={state.zoomLevel}
        data-zoom-min={state.zoomMin}
        data-zoom-max={state.zoomMax}
        tabIndex={readOnly ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finishPointer(event, false)}
        onPointerCancel={(event) => finishPointer(event, true)}
        onKeyDown={onCanvasKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocused(false);
        }}
      >
        <defs>
          <marker
            id="e03-jump-arrow"
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

        {state.cards.length > 0 ? (
          <text x={60} y={38} className={styles.trayLabel} pointerEvents="none">
            {numberLineStrings.cardTray}
          </text>
        ) : null}

        {cards.map((rect) => {
          const selected = state.selectedCard === rect.card;
          const placed = state.cardValues[rect.card] ?? null;
          return (
            <g
              key={rect.card}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={numberLineStrings.cardLabel(rect.card)}
              aria-pressed={selected}
              data-card={rect.card}
              data-placed={placed ?? ''}
              onKeyDown={(event) => onCardKeyDown(rect.card, event)}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={12}
                className={styles.cardBody}
                data-selected={selected}
                data-placed={placed !== null}
              />
              <text
                x={rect.x + rect.width / 2}
                y={rect.y + rect.height / 2}
                className={styles.cardText}
                pointerEvents="none"
              >
                {rect.card}
              </text>
              {placed !== null ? (
                <circle
                  cx={rect.x + rect.width - 12}
                  cy={rect.y + rect.height - 12}
                  r={6}
                  className={styles.cardPlacedDot}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}

        {rows.map((row, rowIndex) => {
          const rowTicks = visibleTicks(row, min, max);
          return (
            <g key={`row-${rowIndex}`} data-row={rowIndex}>
              <line
                x1={100}
                y1={row.y}
                x2={900}
                y2={row.y}
                className={styles.line}
                pointerEvents="none"
              />
              {rowTicks.map((tick) => {
                const major = tick.value.isInteger();
                const labelEvery = labelInterval(row, min, max);
                const showLabel =
                  config.labels !== 'none' &&
                  (config.labels === 'partial' ? major : tick.index % labelEvery === 0);
                return (
                  <g key={`tick-${rowIndex}-${tick.index}`} pointerEvents="none">
                    <line
                      x1={tick.x}
                      y1={row.y - (major ? 12 : 7)}
                      x2={tick.x}
                      y2={row.y + (major ? 12 : 7)}
                      className={major ? styles.majorTick : styles.tick}
                    />
                    {showLabel ? (
                      <text
                        x={tick.x}
                        y={row.y + 34}
                        className={major ? styles.majorTickLabel : styles.tickLabel}
                      >
                        {formatValue(tick.value, mode)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {rowCount > 1 ? (
                <text
                  x={84}
                  y={row.y - 14}
                  className={styles.rowLabel}
                  textAnchor="end"
                  pointerEvents="none"
                >
                  {numberLineStrings.tickRow(row.subdivisions)}
                </text>
              ) : null}
            </g>
          );
        })}

        {state.linkedValue ? (
          <LinkedPoint value={state.linkedValue} state={state} min={min} max={max} rows={rows} />
        ) : null}

        {config.laser ? <SamePointLasers groups={laserGroups} rows={rows} /> : null}

        {config.showJumps === false
          ? null
          : state.jumps.map((jump, index) => (
              <JumpArrow
                key={`jump-${index}-${jump.from}-${jump.to}`}
                jump={jump}
                mode={mode}
                min={min}
                max={max}
                rows={rows}
                index={index}
              />
            ))}

        {state.points.map((point) => {
          const position = pointPosition(point.value);
          const selected = point.id === state.selectedPointId;
          return (
            <g
              key={point.id}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={numberLineStrings.pointLabel(
                formatValue(parseValue(point.value) ?? min, mode),
              )}
              aria-pressed={selected}
              data-point-id={point.id}
              data-value={point.value}
              onKeyDown={(event) => onPointKeyDown(point.id, event)}
            >
              <circle
                cx={position.x}
                cy={position.y}
                r={hitRadius}
                className={styles.pointHit}
                pointerEvents="none"
              />
              <circle
                cx={position.x}
                cy={position.y}
                r={pointRadius}
                className={styles.pointBody}
                data-selected={selected}
                pointerEvents="none"
              />
              <circle
                cx={position.x}
                cy={position.y}
                r={Math.max(4, pointRadius * 0.32)}
                className={styles.pointCenter}
                pointerEvents="none"
              />
              <text
                x={position.x}
                y={position.y - pointRadius - 10}
                className={styles.pointLabel}
                pointerEvents="none"
              >
                {formatValue(parseValue(point.value) ?? min, mode)}
              </text>
            </g>
          );
        })}

        {focused && !readOnly && !state.selectedPointId && !state.selectedCard ? (
          <g pointerEvents="none" data-testid="number-line-cursor">
            <circle
              cx={cursorX}
              cy={rows[0]?.y ?? 300}
              r={pointRadius + 6}
              className={styles.cursor}
            />
            <text
              x={cursorX}
              y={(rows[0]?.y ?? 300) - pointRadius - 16}
              className={styles.cursorLabel}
            >
              {numberLineStrings.cursorLabel(formatValue(cursorValue ?? min, mode))}
            </text>
          </g>
        ) : null}

        {state.selectedCard && state.cardCursor ? (
          <CardGhost
            card={state.selectedCard}
            value={state.cardCursor}
            min={min}
            max={max}
            rows={rows}
            mode={mode}
          />
        ) : null}

        {dragPreview && press?.kind === 'card' ? (
          <g pointerEvents="none">
            <rect
              x={press.current.x - 55}
              y={press.current.y - 24}
              width={110}
              height={48}
              rx={12}
              className={styles.cardGhost}
            />
            <text x={press.current.x} y={press.current.y + 6} className={styles.cardGhostText}>
              {press.card}
            </text>
          </g>
        ) : null}

        {dragPreview && press?.kind === 'point' ? (
          <circle
            cx={dragPreview.at.x}
            cy={rows[dragPreview.at.row]?.y ?? 300}
            r={pointRadius + 4}
            className={styles.pointPreview}
            pointerEvents="none"
          />
        ) : null}

        {press?.kind === 'point' ? (
          <JumpPreview
            from={state.points.find((point) => point.id === press.id)?.value ?? null}
            to={press.moved ? snapped(press.current).value.toJSON() : null}
            min={min}
            max={max}
            rows={rows}
          />
        ) : null}
      </svg>

      <p className={styles.instructions}>{numberLineStrings.instructions[mode]}</p>
      {state.cards.length > 0 ? <p className={styles.hint}>{numberLineStrings.cardHint}</p> : null}
    </div>
  );
}

function labelInterval(row: TickRow, min: Rational, max: Rational): number {
  const span = max.sub(min).div(row.step);
  const count = Number(span.n) / Number(span.d);
  if (count <= 12) return 1;
  if (count <= 30) return 2;
  if (count <= 60) return 5;
  return 10;
}

interface SameGroup {
  readonly value: string;
  readonly x: number;
}

function findSameGroups(state: NumberLineState, min: Rational, max: Rational): SameGroup[] {
  const seen = new Map<string, number>();
  const add = (value: string) => {
    const parsed = parseValue(value);
    if (!parsed) return;
    const key = parsed.toJSON();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  };
  for (const point of state.points) add(point.value);
  for (const card of state.cards) {
    const placed = state.cardValues[card];
    if (placed) add(placed);
  }
  const result: SameGroup[] = [];
  for (const [value, count] of seen) {
    if (count <= 1) continue;
    const parsed = parseValue(value);
    if (!parsed) continue;
    result.push({ value, x: xOfValue(parsed, min, max) });
  }
  return result;
}

function SamePointLasers({
  groups,
  rows,
}: {
  groups: readonly SameGroup[];
  rows: readonly TickRow[];
}) {
  if (groups.length === 0) return null;
  const top = Math.min(...rows.map((row) => row.y)) - 40;
  const bottom = Math.max(...rows.map((row) => row.y)) + 46;
  return (
    <g pointerEvents="none" data-testid="same-point-lasers">
      {groups.map((group) => (
        <g key={group.value}>
          <line x1={group.x} y1={top} x2={group.x} y2={bottom} className={styles.laser} />
          <text x={group.x + 8} y={top} className={styles.laserLabel}>
            {numberLineStrings.samePoint}
          </text>
        </g>
      ))}
    </g>
  );
}

function LinkedPoint({
  value,
  state,
  min,
  max,
  rows,
}: {
  value: string;
  state: NumberLineState;
  min: Rational;
  max: Rational;
  rows: readonly TickRow[];
}) {
  const parsed = parseValue(value);
  if (!parsed) return null;
  const row = rows[rowForValue(value, rows, min, max)] ?? rows[0];
  const x = xOfValue(parsed, min, max);
  const y = row?.y ?? 300;
  const size = 15;
  const formatted = formatValue(parsed, state.mode);
  return (
    <g pointerEvents="none" data-testid="linked-point" data-value={value}>
      <rect
        x={x - size}
        y={y - size}
        width={size * 2}
        height={size * 2}
        transform={`rotate(45 ${x} ${y})`}
        className={styles.linkedBody}
      />
      <text x={x} y={y - size - 12} className={styles.linkedLabel}>
        {numberLineStrings.linkedPoint} {formatted}
      </text>
    </g>
  );
}

function JumpArrow({
  jump,
  mode,
  min,
  max,
  rows,
  index,
}: {
  jump: { readonly from: string; readonly to: string };
  mode: NumberLineMode;
  min: Rational;
  max: Rational;
  rows: readonly TickRow[];
  index: number;
}) {
  const from = parseValue(jump.from);
  const to = parseValue(jump.to);
  if (!from || !to) return null;
  const x1 = xOfValue(from, min, max);
  const x2 = xOfValue(to, min, max);
  if (Math.abs(x1 - x2) < 1) return null;
  const row = rows[rowForValue(jump.to, rows, min, max)] ?? rows[0];
  const y = row?.y ?? 300;
  const lift = 58 + (index % 3) * 22;
  const top = Math.min(y - lift, y - 30);
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y - 26} Q ${midX} ${top} ${x2} ${y - 26}`;
  const size = to.sub(from);
  const text = `${size.isNegative() ? '−' : '+'}${formatValue(size.abs(), mode)}`;
  return (
    <g pointerEvents="none">
      <path d={path} className={styles.jump} markerEnd="url(#e03-jump-arrow)" fill="none" />
      <text x={midX} y={top + 18} className={styles.jumpLabel}>
        {numberLineStrings.jumpSize(text)}
      </text>
    </g>
  );
}

function JumpPreview({
  from,
  to,
  min,
  max,
  rows,
}: {
  from: string | null;
  to: string | null;
  min: Rational;
  max: Rational;
  rows: readonly TickRow[];
}) {
  if (!from || !to) return null;
  const start = parseValue(from);
  const end = parseValue(to);
  if (!start || !end || start.equals(end)) return null;
  const x1 = xOfValue(start, min, max);
  const x2 = xOfValue(end, min, max);
  const row = rows[rowForValue(to, rows, min, max)] ?? rows[0];
  const y = row?.y ?? 300;
  return (
    <line
      x1={x1}
      y1={y - 30}
      x2={x2}
      y2={y - 30}
      className={styles.jumpPreview}
      pointerEvents="none"
    />
  );
}

function CardGhost({
  card,
  value,
  min,
  max,
  rows,
  mode,
}: {
  card: string;
  value: string;
  min: Rational;
  max: Rational;
  rows: readonly TickRow[];
  mode: NumberLineMode;
}) {
  const parsed = parseValue(value);
  if (!parsed) return null;
  const row = rows[rowForValue(value, rows, min, max)] ?? rows[0];
  const x = xOfValue(parsed, min, max);
  const y = row?.y ?? 300;
  return (
    <g pointerEvents="none" data-testid="card-ghost">
      <rect x={x - 54} y={y - 82} width={108} height={42} rx={10} className={styles.cardGhost} />
      <text x={x} y={y - 55} className={styles.cardGhostText}>
        {card}
      </text>
      <line x1={x} y1={y - 40} x2={x} y2={y - 14} className={styles.cursor} />
      <text x={x} y={y + 34} className={styles.cursorLabel}>
        {formatValue(parsed, mode)}
      </text>
    </g>
  );
}
