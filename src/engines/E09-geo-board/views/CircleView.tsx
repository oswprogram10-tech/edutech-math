/**
 * circle 모드 화면(T102).
 *
 * - 말뚝·밧줄·반지름·현·컴퍼스·제시 무늬를 그린다.
 * - 원 위의 점은 `pointAt`(정확한 유리 좌표)로 계산하고, 화면 좌표만 number다.
 * - 밧줄이 지나간 자리는 부채꼴 번호(0~71)만 상태에 남기고 화면 궤적은 저장하지 않는다.
 * - "지름" 이름표는 `snapDiameter`일 때 학생의 현이 중심을 지날 때만 쓴다.
 */
import { useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { clamp, minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import type { GPoint } from '../../../core/math';
import { boardRect, pegPoint, ratToScreen } from '../layout';
import type { BoardRect } from '../layout';
import {
  chordThroughCenter,
  mainRadius,
  patternMatched,
  pointAt,
  radiusLength2,
} from '../modes/circle/observe';
import type { CircleState, CircleTool } from '../modes/circle/types';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoAction, GeoConfig } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#8a93a5';
const GRID = '#d5dce8';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';
const GREEN = '#2f9e6b';
const PLAYGROUND = '#eaf5dc';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

function normalizeDegrees(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

type CircleViewProps = EngineViewProps<GeoConfig, CircleState, GeoAction>;

type CircleDrag =
  | { readonly kind: 'rope' }
  | { readonly kind: 'chord'; readonly end: 0 | 1 }
  | { readonly kind: 'compass'; readonly handle: 'needle' | 'pencil' }
  | null;

function screenOf(rect: BoardRect, point: GPoint): Point {
  return {
    x: rect.x + ratToScreen(point.x) * rect.spacing,
    y: rect.y + ratToScreen(point.y) * rect.spacing,
  };
}

function normalizeSector(value: number): number {
  return ((Math.round(value) % 72) + 72) % 72;
}

function normalizePos(value: number): number {
  return ((Math.round(value) % 48) + 48) % 48;
}

function sectorOf(point: Point, center: Point): number {
  const direction = normalizeDegrees(
    (Math.atan2(center.y - point.y, point.x - center.x) * 180) / Math.PI,
  );
  return normalizeSector(direction / 5);
}

function posOf(point: Point, center: Point): number {
  const direction = normalizeDegrees(
    (Math.atan2(center.y - point.y, point.x - center.x) * 180) / Math.PI,
  );
  return normalizePos(direction / 7.5);
}

function pointOnScreenCircle(center: Point, radius: number, sector: number): Point {
  const radians = (sector * 5 * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(radians), y: center.y - radius * Math.sin(radians) };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function halfScreen(rect: BoardRect, value: number): number {
  return (value * rect.spacing) / 2;
}

function halfPoint(rect: BoardRect, value: readonly [number, number]): Point {
  return {
    x: rect.x + halfScreen(rect, value[0]),
    y: rect.y + halfScreen(rect, value[1]),
  };
}

export function CircleView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: CircleViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(16, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const { settings } = state;
  const rect = boardRect(settings.grid, settings.grid);
  const center = pegPoint(rect, settings.stake);
  const mainRadiusScreen = mainRadius(settings) * rect.spacing;
  const [sector, setSector] = useState(0);
  const [ropeTaut, setRopeTaut] = useState(true);
  const [slackEnd, setSlackEnd] = useState<Point | null>(null);
  const [radiusPos, setRadiusPos] = useState(0);
  const [chordEnd, setChordEnd] = useState<0 | 1>(1);
  const [compassHandle, setCompassHandle] = useState<'needle' | 'pencil'>('needle');
  const dragRef = useRef<CircleDrag>(null);

  const tools: CircleTool[] = ['rope'];
  if (settings.measureTool) tools.push('radius');
  if (settings.chordExplorer) tools.push('chord');
  if (settings.compass.enabled) tools.push('compass');

  const point = (pos: number): Point => screenOf(rect, pointAt(settings, pos));
  const centerScreen: Point = center;
  const compassCenter = halfPoint(rect, state.compass.center);
  const compassWidth = halfScreen(rect, state.compass.width);
  const compassPencil = { x: compassCenter.x + compassWidth, y: compassCenter.y };
  const chord = state.chord ?? ([0, 17] as const);
  const chordFirst = point(chord[0]);
  const chordSecond = point(chord[1]);
  const chordMid = {
    x: (chordFirst.x + chordSecond.x) / 2,
    y: (chordFirst.y + chordSecond.y) / 2,
  };
  const chordRatio = state.chord
    ? clamp(distance(chordFirst, chordSecond) / (2.5 * mainRadiusScreen), 0, 1)
    : 0;
  const matched = patternMatched(state);
  const chordIsDiameter = settings.snapDiameter && chordThroughCenter(state);
  const trace = state.traces[String(state.ropeLength)] ?? [];

  const dispatchTrace = (nextSector: number) => {
    const safe = normalizeSector(nextSector);
    setSector(safe);
    dispatch({ type: 'trace', sector: safe });
  };

  const ropeEnd = pointOnScreenCircle(centerScreen, mainRadiusScreen, sector);

  const chooseTool = (tool: CircleTool) => {
    if (readOnly) return;
    setRopeTaut(true);
    setSlackEnd(null);
    dispatch({ type: 'select-circle-tool', tool });
  };

  const setRope = (length: number) => {
    if (readOnly) return;
    dispatch({ type: 'set-rope', length });
  };

  const stepRope = (direction: 1 | -1) => {
    const list = settings.ropeLengths;
    const index = list.indexOf(state.ropeLength);
    const nextIndex = clamp((index < 0 ? 0 : index) + direction, 0, list.length - 1);
    const next = list[nextIndex];
    if (next !== undefined) setRope(next);
  };

  const updateCompassFromPoint = (pointValue: Point, handle: 'needle' | 'pencil') => {
    if (handle === 'needle') {
      dispatch({
        type: 'set-compass',
        center: [
          ((pointValue.x - rect.x) / rect.spacing) * 2,
          ((pointValue.y - rect.y) / rect.spacing) * 2,
        ],
      });
      return;
    }
    const width = (distance(pointValue, compassCenter) / rect.spacing) * 2;
    dispatch({ type: 'set-compass', width });
  };

  const updateRopeFromPoint = (pointValue: Point) => {
    const reach = distance(pointValue, centerScreen);
    const taut = reach >= mainRadiusScreen * 0.9;
    setRopeTaut(taut);
    setSlackEnd(taut ? null : pointValue);
    if (!taut) return;
    const nextSector = sectorOf(pointValue, centerScreen);
    if (nextSector !== sector) dispatchTrace(nextSector);
  };

  const moveChord = (end: 0 | 1, pos: number) => {
    dispatch({ type: 'set-chord', end, pos: normalizePos(pos) });
  };

  const nearestChordEnd = (pointValue: Point): 0 | 1 => {
    return distance(pointValue, chordFirst) <= distance(pointValue, chordSecond) ? 0 : 1;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const pointValue = pointerToLogical(event, svgRef.current, LOGICAL);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }
    if (state.tool === 'rope') {
      dragRef.current = { kind: 'rope' };
      updateRopeFromPoint(pointValue);
      return;
    }
    if (state.tool === 'radius') {
      const pos = posOf(pointValue, centerScreen);
      const onCircle = Math.abs(distance(pointValue, centerScreen) - mainRadiusScreen) <= hitRadius;
      if (onCircle) dispatch({ type: 'add-radius', pos });
      return;
    }
    if (state.tool === 'chord') {
      const end = nearestChordEnd(pointValue);
      setChordEnd(end);
      dragRef.current = { kind: 'chord', end };
      moveChord(end, posOf(pointValue, centerScreen));
      return;
    }
    if (state.tool === 'compass') {
      if (distance(pointValue, compassCenter) <= hitRadius) {
        dragRef.current = { kind: 'compass', handle: 'needle' };
        setCompassHandle('needle');
        updateCompassFromPoint(pointValue, 'needle');
        return;
      }
      if (distance(pointValue, compassPencil) <= hitRadius) {
        dragRef.current = { kind: 'compass', handle: 'pencil' };
        setCompassHandle('pencil');
        updateCompassFromPoint(pointValue, 'pencil');
      }
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || readOnly) return;
    const pointValue = pointerToLogical(event, svgRef.current, LOGICAL);
    if (drag.kind === 'rope') updateRopeFromPoint(pointValue);
    else if (drag.kind === 'chord') moveChord(drag.end, posOf(pointValue, centerScreen));
    else updateCompassFromPoint(pointValue, drag.handle);
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === '[' || key === ']') {
      if (state.tool !== 'rope') return;
      event.preventDefault();
      stepRope(key === ']' ? 1 : -1);
      return;
    }
    if (key === '1' || key === '2') {
      if (state.tool !== 'chord') return;
      event.preventDefault();
      setChordEnd(key === '1' ? 0 : 1);
      return;
    }
    if ((key === 'n' || key === 'N') && state.tool === 'compass') {
      event.preventDefault();
      setCompassHandle('needle');
      return;
    }
    if ((key === 'p' || key === 'P') && state.tool === 'compass') {
      event.preventDefault();
      setCompassHandle('pencil');
      return;
    }
    if ((key === 'm' || key === 'M') && state.tool === 'radius') {
      event.preventDefault();
      dispatch({ type: 'measure-radius', pos: radiusPos });
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (state.tool !== 'rope') return;
      event.preventDefault();
      dispatch({ type: 'clear-trace' });
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      if (state.tool === 'radius') dispatch({ type: 'add-radius', pos: radiusPos });
      else if (state.tool === 'compass') dispatch({ type: 'draw-circle' });
      else if (state.tool === 'rope') dispatchTrace(sector);
      return;
    }
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const dy = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    if (state.tool === 'rope') {
      if (dx !== 0) dispatchTrace(sector + dx);
      return;
    }
    if (state.tool === 'radius') {
      if (dx !== 0) setRadiusPos(normalizePos(radiusPos + dx));
      return;
    }
    if (state.tool === 'chord') {
      if (dx !== 0) moveChord(chordEnd, chord[chordEnd] + dx);
      return;
    }
    if (state.tool === 'compass') {
      const step = settings.compass.gridSnap * 2;
      if (compassHandle === 'needle') {
        if (dx === 0 && dy === 0) return;
        dispatch({
          type: 'set-compass',
          center: [state.compass.center[0] + dx * step, state.compass.center[1] + dy * step],
        });
        return;
      }
      if (dx !== 0) {
        dispatch({ type: 'set-compass', width: state.compass.width + dx * step });
      }
    }
  };

  const ropePath = (): string => {
    if (ropeTaut || !slackEnd) {
      return `M ${centerScreen.x} ${centerScreen.y} L ${ropeEnd.x} ${ropeEnd.y}`;
    }
    const mid = {
      x: (centerScreen.x + slackEnd.x) / 2,
      y: (centerScreen.y + slackEnd.y) / 2 + 36,
    };
    return `M ${centerScreen.x} ${centerScreen.y} Q ${mid.x} ${mid.y} ${slackEnd.x} ${slackEnd.y}`;
  };

  const traceDots = (): ReactNode[] =>
    trace.map((value) => {
      const dot = pointOnScreenCircle(centerScreen, mainRadiusScreen, value);
      return (
        <circle
          key={`trace-${value}`}
          cx={dot.x}
          cy={dot.y}
          r={5}
          fill={ORANGE}
          fillOpacity={0.85}
          pointerEvents="none"
        />
      );
    });

  const radii = (): ReactNode[] =>
    state.radii.map((pos, index) => {
      const end = point(pos);
      const measured = state.measured.includes(pos);
      const labelPoint = {
        x: (centerScreen.x + end.x) / 2,
        y: (centerScreen.y + end.y) / 2 - 14,
      };
      const squared = radiusLength2(settings, pos);
      const length = Math.sqrt(Number(squared));
      return (
        <g key={`radius-${pos}`}>
          <line
            x1={centerScreen.x}
            y1={centerScreen.y}
            x2={end.x}
            y2={end.y}
            stroke={GREEN}
            strokeWidth={3.5}
            strokeLinecap="round"
            pointerEvents="none"
          />
          <circle cx={end.x} cy={end.y} r={7} fill={GREEN} pointerEvents="none" />
          {measured && Number.isInteger(length) ? (
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              fontSize={18}
              fontWeight={800}
              fill={INK}
              pointerEvents="none"
            >
              {S.circle.measuredLength(length)}
            </text>
          ) : null}
          <text
            x={end.x + 12}
            y={end.y - 10}
            fontSize={15}
            fontWeight={700}
            fill={GREEN}
            pointerEvents="none"
          >
            {`${S.circle.radiusLabel} ${index + 1}`}
          </text>
        </g>
      );
    });

  const chordHandles = (): ReactNode[] =>
    state.chord || settings.chordExplorer
      ? [0, 1].map((end) => {
          const handle = end === 0 ? chordFirst : chordSecond;
          return (
            <circle
              key={`chord-handle-${end}`}
              cx={handle.x}
              cy={handle.y}
              r={end === chordEnd ? 13 : 10}
              fill={end === chordEnd ? ORANGE : PAPER}
              stroke={ORANGE}
              strokeWidth={3}
              pointerEvents="none"
            />
          );
        })
      : [];

  const compassLegs = (): ReactNode => (
    <g pointerEvents="none">
      <circle cx={compassCenter.x} cy={compassCenter.y} r={10} fill={INK} />
      <circle
        cx={compassPencil.x}
        cy={compassPencil.y}
        r={9}
        fill={ORANGE}
        stroke={INK}
        strokeWidth={2}
      />
      <line
        x1={compassCenter.x}
        y1={compassCenter.y}
        x2={compassPencil.x}
        y2={compassPencil.y}
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line
        x1={compassCenter.x}
        y1={compassCenter.y - 26}
        x2={compassCenter.x}
        y2={compassCenter.y}
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </g>
  );

  const drawnCircles = (): ReactNode[] =>
    state.circles.map((circle) => {
      const circleCenter = halfPoint(rect, circle.center);
      const circleRadius = halfScreen(rect, circle.radius);
      return (
        <circle
          key={circle.id}
          cx={circleCenter.x}
          cy={circleCenter.y}
          r={circleRadius}
          fill="none"
          stroke={BLUE}
          strokeWidth={3}
          pointerEvents="none"
        />
      );
    });

  const patternCircles = (): ReactNode[] =>
    settings.targetPattern.map((pattern, index) => {
      const patternCenter = halfPoint(rect, pattern.center);
      const patternRadius = halfScreen(rect, pattern.radius);
      const done = matched.includes(index + 1);
      return (
        <g key={`pattern-${index}`} pointerEvents="none">
          <circle
            cx={patternCenter.x}
            cy={patternCenter.y}
            r={patternRadius}
            fill={done ? '#dff3e4' : 'none'}
            fillOpacity={done ? 0.4 : 0}
            stroke={done ? GREEN : MUTED}
            strokeWidth={done ? 4 : 2.5}
            strokeDasharray={done ? undefined : '10 7'}
          />
          {done ? (
            <path
              d={`M ${patternCenter.x - 12} ${patternCenter.y} l 9 10 l 17 -20`}
              fill="none"
              stroke={GREEN}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </g>
      );
    });

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.circle.toolGroup}>
        {tools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={styles.button}
            aria-pressed={state.tool === tool}
            onClick={() => chooseTool(tool)}
            disabled={readOnly}
          >
            {S.circle.tools[tool]}
          </button>
        ))}
        {state.tool === 'rope' && settings.ropeLengths.length > 1 ? (
          <span className={styles.group}>
            <span className={styles.groupLabel}>{S.circle.ropeLabel}</span>
            {settings.ropeLengths.map((length) => (
              <button
                key={`rope-${length}`}
                type="button"
                className={styles.button}
                aria-pressed={state.ropeLength === length}
                onClick={() => setRope(length)}
                disabled={readOnly}
              >
                {S.circle.ropeLength(length)}
              </button>
            ))}
          </span>
        ) : null}
        {state.tool === 'rope' ? (
          <>
            <span className={styles.badge}>{S.circle.traceCount(trace.length)}</span>
            <button
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'clear-trace' })}
              disabled={readOnly}
            >
              {S.circle.clearTrace}
            </button>
          </>
        ) : null}
      </div>

      <p className={styles.instructions}>{S.circle.instructions}</p>
      {state.tool === 'radius' ? <p className={styles.hint}>{S.circle.measureHint}</p> : null}
      {state.tool === 'chord' ? <p className={styles.hint}>{S.circle.chordHint}</p> : null}
      {state.tool === 'compass' ? <p className={styles.hint}>{S.circle.compassHint}</p> : null}

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.circle.canvasLabel}
          tabIndex={readOnly ? -1 : 0}
          data-testid="geo-canvas"
          data-cpa={cpa}
          onKeyDown={onCanvasKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <rect
            width={LOGICAL_WIDTH}
            height={LOGICAL_HEIGHT}
            fill={settings.scene === 'playground' ? PLAYGROUND : PAPER}
          />
          <g stroke={GRID} strokeWidth={1} pointerEvents="none">
            {Array.from({ length: settings.grid }, (_, index) => (
              <g key={`grid-${index}`}>
                <line
                  x1={rect.x + index * rect.spacing}
                  y1={rect.y}
                  x2={rect.x + index * rect.spacing}
                  y2={rect.y + (settings.grid - 1) * rect.spacing}
                />
                <line
                  x1={rect.x}
                  y1={rect.y + index * rect.spacing}
                  x2={rect.x + (settings.grid - 1) * rect.spacing}
                  y2={rect.y + index * rect.spacing}
                />
              </g>
            ))}
          </g>

          {settings.targetPattern.length > 0 ? (
            patternCircles()
          ) : (
            <circle
              cx={centerScreen.x}
              cy={centerScreen.y}
              r={mainRadiusScreen}
              fill="none"
              stroke={BLUE}
              strokeWidth={2.5}
              strokeOpacity={0.55}
              pointerEvents="none"
            />
          )}

          {settings.traceDots ? traceDots() : null}
          {drawnCircles()}
          {radii()}

          {state.tool === 'rope' ? (
            <g pointerEvents="none">
              <path
                d={ropePath()}
                fill="none"
                stroke={ORANGE}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={ropeTaut ? undefined : '8 6'}
              />
              <circle cx={centerScreen.x} cy={centerScreen.y} r={9} fill={INK} />
              <circle cx={ropeEnd.x} cy={ropeEnd.y} r={6} fill={ORANGE} />
            </g>
          ) : null}

          {state.tool === 'radius' ? (
            <circle
              cx={point(radiusPos).x}
              cy={point(radiusPos).y}
              r={12}
              fill="none"
              stroke={ORANGE}
              strokeWidth={3}
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          ) : null}

          {state.tool === 'chord' && settings.chordExplorer ? (
            <g pointerEvents="none">
              {state.chord ? (
                <line
                  x1={chordFirst.x}
                  y1={chordFirst.y}
                  x2={chordSecond.x}
                  y2={chordSecond.y}
                  stroke={INK}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              ) : null}
              {chordHandles()}
              {chordIsDiameter ? (
                <text
                  x={chordMid.x}
                  y={chordMid.y - 18}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={800}
                  fill={ORANGE}
                >
                  {S.circle.diameter}
                </text>
              ) : null}
            </g>
          ) : null}

          {state.tool === 'compass' && settings.compass.enabled ? compassLegs() : null}
        </svg>
      </div>

      {state.tool === 'chord' && settings.chordExplorer ? (
        <div aria-hidden="true" style={{ display: 'grid', gap: 4 }}>
          <svg
            viewBox="0 0 1000 60"
            role="img"
            aria-label={S.circle.chordBar}
            data-testid="chord-bar"
            style={{ width: '100%', maxWidth: 720, height: 46 }}
          >
            <rect
              x={220}
              y={12}
              width={560}
              height={26}
              rx={8}
              fill="#f2f4f8"
              stroke="#9aa4b5"
              strokeWidth={2}
            />
            <rect
              x={220}
              y={12}
              width={Math.max(0, 560 * chordRatio)}
              height={26}
              rx={8}
              fill={BLUE}
            />
          </svg>
        </div>
      ) : null}

      {settings.compass.enabled ? (
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'draw-circle' })}
            disabled={readOnly || state.tool !== 'compass'}
          >
            {S.circle.drawCircle}
          </button>
          <span className={styles.groupLabel}>{S.circle.drawnCircles}</span>
          {state.circles.map((circle, index) => (
            <button
              key={circle.id}
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'remove-circle', id: circle.id })}
              disabled={readOnly}
            >
              {S.circle.removeCircle(index + 1)}
            </button>
          ))}
        </div>
      ) : null}

      <p className={styles.hint}>
        {state.tool === 'radius'
          ? S.circle.radiusHint
          : state.tool === 'compass'
            ? S.circle.compassHint
            : S.circle.canvasHint}
      </p>
    </div>
  );
}
