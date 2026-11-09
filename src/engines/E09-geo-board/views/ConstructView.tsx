/**
 * E09 construct 모드: 점을 골라 선분·반직선·직선을 긋고, 직각삼각자를 각에 댄다.
 *
 * - 점 고르기는 `pick` Action만 보낸다(첫 번째는 시작점, 두 번째는 객체 생성).
 * - 연장선(`showExtension`)은 화면 끝까지 그리는 계산만 number다.
 * - 삼각자의 결과는 학생이 댄 각(`squareOn`)에만 보인다. 다른 각의 직각 여부는
 *   미리 그리지 않는다(정답 노출 금지).
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { clamp, minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { gp, isRightAngle } from '../../../core/math';
import {
  allPegs,
  boardRect,
  extensionSegment,
  pegPoint,
  setSquareShape,
  snapPeg,
  starPoints,
} from '../layout';
import { objectHitsTarget } from '../observe';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type {
  ConstructState,
  ConstructTool,
  GeoAction,
  GeoAngle,
  GeoConfig,
  GeoNamedPoint,
  GeoObject,
  Peg,
} from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#8a93a5';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';
const BLUE = '#2f6fde';
const RED = '#c2410c';
const SQUARE = '#2f9e6b';

type ConstructViewProps = EngineViewProps<GeoConfig, ConstructState, GeoAction>;

const OBJECT_STYLE: Readonly<
  Record<ConstructTool, { readonly dash?: string; readonly width: number }>
> = {
  segment: { width: 5 },
  ray: { width: 5, dash: '18 7' },
  line: { width: 5, dash: '4 8' },
  'set-square': { width: 5 },
};

function labelOf(point: Peg, named: readonly GeoNamedPoint[]): string {
  const found = named.find((entry) => entry.at[0] === point[0] && entry.at[1] === point[1]);
  return found ? found.label : `${point[0]},${point[1]}`;
}

function normalizeVector(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: -1 };
  return { x: dx / length, y: dy / length };
}

function hitColor(cpa: string, index: number): string {
  if (cpa === 'P' || cpa === 'A') return INK;
  const palette = [BLUE, RED, SQUARE, '#7c3aed'];
  return palette[index % palette.length] ?? BLUE;
}

function squareMarkPath(vertex: Point, first: Point, second: Point, size: number): string {
  const u = normalizeVector(vertex, first);
  const v = normalizeVector(vertex, second);
  const p1 = { x: vertex.x + u.x * size, y: vertex.y + u.y * size };
  const p2 = { x: p1.x + v.x * size, y: p1.y + v.y * size };
  const p3 = { x: vertex.x + v.x * size, y: vertex.y + v.y * size };
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`;
}

function angleLabelPoint(vertex: Point, first: Point, second: Point): Point {
  const u = normalizeVector(vertex, first);
  const v = normalizeVector(vertex, second);
  const sum = { x: u.x + v.x, y: u.y + v.y };
  const length = Math.hypot(sum.x, sum.y);
  if (length < 0.1) return { x: vertex.x, y: vertex.y - 34 };
  return { x: vertex.x + (sum.x / length) * 40, y: vertex.y + (sum.y / length) * 40 + 6 };
}

export function ConstructView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: ConstructViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(14, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const { grid, points, targets, given, angles, showExtension } = state.settings;
  const rect = boardRect(grid, grid);
  const [cursor, setCursor] = useState<Peg>([0, 0]);
  const [focused, setFocused] = useState(false);

  const removable = state.objects[state.objects.length - 1] ?? null;

  const hitTarget = (target: Peg): boolean =>
    state.objects.some((object) => objectHitsTarget(object, target));

  const press = (peg: Peg) => {
    if (readOnly || state.tool === 'set-square') return;
    dispatch({ type: 'pick', at: peg });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    // 각 그룹은 자기 pointerdown에서 stopPropagation 하므로 여기에는 오지 않는다.
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const peg = snapPeg(rect, point, hitRadius);
    if (!peg) return;
    setCursor(peg);
    press(peg);
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const next: Peg = [
        key === 'ArrowLeft'
          ? clamp(cursor[0] - 1, 0, grid - 1)
          : key === 'ArrowRight'
            ? clamp(cursor[0] + 1, 0, grid - 1)
            : cursor[0],
        key === 'ArrowUp'
          ? clamp(cursor[1] - 1, 0, grid - 1)
          : key === 'ArrowDown'
            ? clamp(cursor[1] + 1, 0, grid - 1)
            : cursor[1],
      ];
      setCursor(next);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      press(cursor);
      return;
    }
    if (key === 'Delete' && removable) {
      event.preventDefault();
      dispatch({ type: 'remove-object', id: removable.id });
    }
  };

  const placeSquareOn = (angle: GeoAngle) => {
    if (readOnly || state.tool !== 'set-square') return;
    dispatch({ type: 'place-square', angle: angle.id });
  };

  const onAngleKeyDown = (event: ReactKeyboardEvent<SVGGElement>, angle: GeoAngle) => {
    if (readOnly || state.tool !== 'set-square') return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      placeSquareOn(angle);
    }
  };

  const onObjectKeyDown = (event: ReactKeyboardEvent<SVGGElement>, object: GeoObject) => {
    if (readOnly) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'remove-object', id: object.id });
    }
  };

  const squareAngle = angles.find((angle) => angle.id === state.squareOn) ?? null;
  const squareShape = squareAngle
    ? (() => {
        const vertex = pegPoint(rect, squareAngle.vertex);
        const a = pegPoint(rect, squareAngle.a);
        const b = pegPoint(rect, squareAngle.b);
        const right = isRightAngle(
          gp(squareAngle.a[0], squareAngle.a[1]),
          gp(squareAngle.vertex[0], squareAngle.vertex[1]),
          gp(squareAngle.b[0], squareAngle.b[1]),
        );
        const size = Math.max(48, Math.min(190, rect.spacing * 1.5));
        return { vertex, a, b, right, shape: setSquareShape(vertex, a, b, size, right) };
      })()
    : null;
  const markedSquare = squareAngle !== null && state.marked.includes(squareAngle.id);
  const starOuter = Math.max(13, Math.min(30, rect.spacing * 0.3));

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.construct.toolGroup}</span>
          {state.settings.tools.map((tool) => (
            <button
              key={tool}
              type="button"
              className={styles.button}
              aria-pressed={state.tool === tool}
              onClick={() => dispatch({ type: 'select-tool', tool })}
              disabled={readOnly}
            >
              {S.construct.tools[tool]}
            </button>
          ))}
        </span>

        {squareAngle ? (
          <>
            <button
              type="button"
              className={styles.button}
              aria-pressed={markedSquare}
              onClick={() => dispatch({ type: 'toggle-mark', angle: squareAngle.id })}
              disabled={readOnly}
            >
              {markedSquare ? S.construct.unmarkRight : S.construct.markRight}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'remove-square' })}
              disabled={readOnly}
            >
              {S.construct.removeSquare}
            </button>
          </>
        ) : null}

        <button
          type="button"
          className={styles.button}
          onClick={() => {
            if (removable) dispatch({ type: 'remove-object', id: removable.id });
          }}
          disabled={readOnly || removable === null}
        >
          {S.construct.removeObject}
        </button>
      </div>

      <p className={styles.instructions}>{S.instructions.construct}</p>
      <p className={styles.status} role="status" data-testid="geo-square-status">
        {squareShape
          ? squareShape.right
            ? S.construct.squareFit
            : S.construct.squareGap
          : state.tool === 'set-square'
            ? S.construct.angleHint
            : ''}
      </p>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel.construct}
          tabIndex={readOnly ? -1 : 0}
          data-testid="geo-canvas"
          data-cpa={cpa}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onCanvasKeyDown}
          onPointerDown={onPointerDown}
        >
          <defs>
            <marker
              id="e09-laser-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill={ORANGE} />
            </marker>
            <pattern
              id="e09-target-hit"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="10" height="10" fill="#fff1dd" />
              <line x1="0" y1="0" x2="0" y2="10" stroke={ORANGE} strokeWidth="3" />
            </pattern>
          </defs>

          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
          <g stroke={GRID} strokeWidth={1} strokeOpacity={0.5} pointerEvents="none">
            {Array.from({ length: grid }, (_, index) => (
              <line
                key={`h-${index}`}
                x1={rect.x}
                y1={pegPoint(rect, [0, index]).y}
                x2={rect.x + rect.width}
                y2={pegPoint(rect, [0, index]).y}
              />
            ))}
            {Array.from({ length: grid }, (_, index) => (
              <line
                key={`v-${index}`}
                x1={pegPoint(rect, [index, 0]).x}
                y1={rect.y}
                x2={pegPoint(rect, [index, 0]).x}
                y2={rect.y + rect.height}
              />
            ))}
          </g>

          {given.map((object) => {
            const from = pegPoint(rect, object.from);
            const to = pegPoint(rect, object.to);
            const style = OBJECT_STYLE[object.kind];
            return (
              <g
                key={`given-${object.id}`}
                data-given={object.id}
                aria-label={S.construct.given}
                pointerEvents="none"
              >
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={MUTED}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 12}
                  textAnchor="middle"
                  fontSize={14}
                  fill={MUTED}
                >
                  {S.construct.given}
                </text>
              </g>
            );
          })}

          {state.objects.map((object, index) => {
            const from = pegPoint(rect, object.from);
            const to = pegPoint(rect, object.to);
            const style = OBJECT_STYLE[object.kind];
            return (
              <g
                key={object.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.construct.removeObjectLabel(
                  S.construct.objectLabel(
                    object.kind,
                    labelOf(object.from, points),
                    labelOf(object.to, points),
                  ),
                )}
                data-object={object.id}
                data-kind={object.kind}
                onKeyDown={(event) => onObjectKeyDown(event, object)}
              >
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={hitColor(cpa, index)}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={Math.max(24, hitRadius)}
                />
              </g>
            );
          })}

          {showExtension
            ? state.objects.map((object) => {
                if (object.kind === 'segment') return null;
                const from = pegPoint(rect, object.from);
                const to = pegPoint(rect, object.to);
                const extension = extensionSegment(from, to, object.kind);
                return (
                  <line
                    key={`ext-${object.id}`}
                    className={styles.laser}
                    x1={extension.start.x}
                    y1={extension.start.y}
                    x2={extension.end.x}
                    y2={extension.end.y}
                    stroke={ORANGE}
                    strokeWidth={6}
                    strokeOpacity={0.55}
                    strokeDasharray="16 10"
                    markerEnd="url(#e09-laser-arrow)"
                    markerStart={object.kind === 'line' ? 'url(#e09-laser-arrow)' : undefined}
                    pointerEvents="none"
                  />
                );
              })
            : null}

          {angles.map((angle, index) => {
            const vertex = pegPoint(rect, angle.vertex);
            const a = pegPoint(rect, angle.a);
            const b = pegPoint(rect, angle.b);
            return (
              <g key={angle.id} data-angle={angle.id}>
                <line
                  x1={vertex.x}
                  y1={vertex.y}
                  x2={a.x}
                  y2={a.y}
                  stroke={MUTED}
                  strokeWidth={3}
                  pointerEvents="none"
                />
                <line
                  x1={vertex.x}
                  y1={vertex.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={MUTED}
                  strokeWidth={3}
                  pointerEvents="none"
                />
                <g
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={S.construct.angleLabel(index + 1)}
                  onPointerDown={(event) => {
                    if (state.tool !== 'set-square') return;
                    event.stopPropagation();
                    event.preventDefault();
                    placeSquareOn(angle);
                  }}
                  onKeyDown={(event) => onAngleKeyDown(event, angle)}
                >
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r={Math.max(26, hitRadius)}
                    fill="transparent"
                  />
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r={7}
                    fill={state.squareOn === angle.id ? SQUARE : MUTED}
                    pointerEvents="none"
                  />
                </g>
              </g>
            );
          })}

          {targets.map((target, index) => {
            const point = pegPoint(rect, target);
            const hit = hitTarget(target);
            return (
              <g key={`target-${index}`} pointerEvents="none" data-target={index + 1}>
                <polygon
                  role="img"
                  aria-label={S.construct.targetAria(index + 1)}
                  points={starPoints(point.x, point.y, starOuter, starOuter * 0.45)}
                  fill={hit ? 'url(#e09-target-hit)' : '#ffffff'}
                  stroke={hit ? ORANGE : MUTED}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  data-hit={hit ? 'true' : 'false'}
                />
                {hit ? (
                  <path
                    d={`M ${point.x - 6} ${point.y} L ${point.x - 1} ${point.y + 5} L ${point.x + 7} ${point.y - 6}`}
                    fill="none"
                    stroke={RED}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </g>
            );
          })}

          {squareShape && squareAngle ? (
            <g pointerEvents="none" data-square={squareAngle.id}>
              <polygon
                points={`${squareShape.shape.vertex.x},${squareShape.shape.vertex.y} ${squareShape.shape.legA.x},${squareShape.shape.legA.y} ${squareShape.shape.legB.x},${squareShape.shape.legB.y}`}
                fill={SQUARE}
                fillOpacity={0.14}
                stroke={SQUARE}
                strokeWidth={4}
                strokeLinejoin="round"
              />
              {squareShape.shape.gapPath ? (
                <path d={squareShape.shape.gapPath} fill={RED} fillOpacity={0.28} stroke={RED} />
              ) : null}
              {squareShape.right ? (
                <path
                  d={squareMarkPath(
                    squareShape.vertex,
                    squareShape.shape.legA,
                    squareShape.shape.legB,
                    Math.min(34, rect.spacing * 0.5),
                  )}
                  fill="none"
                  stroke={SQUARE}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </g>
          ) : null}

          {/* 각 이름표는 삼각자 위에 그린다. 흰 테두리로 삼각자 색과 겹쳐도 읽힌다. */}
          {angles.map((angle, index) => {
            const vertex = pegPoint(rect, angle.vertex);
            const label = angleLabelPoint(vertex, pegPoint(rect, angle.a), pegPoint(rect, angle.b));
            return (
              <text
                key={`angle-label-${angle.id}`}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontSize={17}
                fontWeight={700}
                fill={INK}
                stroke="#ffffff"
                strokeWidth={5}
                paintOrder="stroke"
                strokeLinejoin="round"
                pointerEvents="none"
                data-angle-label={angle.id}
              >
                {S.construct.angleLabel(index + 1)}
              </text>
            );
          })}

          {angles.map((angle) => {
            if (!state.marked.includes(angle.id)) return null;
            const vertex = pegPoint(rect, angle.vertex);
            return (
              <path
                key={`mark-${angle.id}`}
                d={squareMarkPath(
                  vertex,
                  pegPoint(rect, angle.a),
                  pegPoint(rect, angle.b),
                  Math.max(20, Math.min(30, rect.spacing * 0.45)),
                )}
                fill="none"
                stroke={INK}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
                data-mark={angle.id}
              />
            );
          })}

          {points.map((point) => {
            const at = pegPoint(rect, point.at);
            return (
              <g key={`point-${point.label}`} pointerEvents="none">
                <circle cx={at.x} cy={at.y} r={9} fill={PAPER} stroke={INK} strokeWidth={3} />
                <text
                  x={at.x}
                  y={at.y - 18}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={700}
                  fill={INK}
                >
                  {point.label}
                </text>
              </g>
            );
          })}

          {allPegs(rect).map((peg) => {
            const point = pegPoint(rect, peg);
            return (
              <circle
                key={`peg-${peg[0]}-${peg[1]}`}
                cx={point.x}
                cy={point.y}
                r={Math.max(3, Math.min(6, rect.spacing * 0.055))}
                fill={INK}
                pointerEvents="none"
              />
            );
          })}

          {state.pendingStart ? (
            <g pointerEvents="none">
              <line
                x1={pegPoint(rect, state.pendingStart).x}
                y1={pegPoint(rect, state.pendingStart).y}
                x2={pegPoint(rect, cursor).x}
                y2={pegPoint(rect, cursor).y}
                stroke={ORANGE}
                strokeWidth={3}
                strokeDasharray="10 8"
              />
              <circle
                cx={pegPoint(rect, state.pendingStart).x}
                cy={pegPoint(rect, state.pendingStart).y}
                r={11}
                fill={ORANGE}
                fillOpacity={0.25}
                stroke={ORANGE}
                strokeWidth={3}
              />
            </g>
          ) : null}

          {focused || state.pendingStart ? (
            <circle
              cx={pegPoint(rect, cursor).x}
              cy={pegPoint(rect, cursor).y}
              r={Math.max(16, hitRadius * 0.62)}
              fill="none"
              stroke={ORANGE}
              strokeWidth={2.5}
              strokeDasharray="7 5"
              pointerEvents="none"
              data-testid="geo-cursor"
            />
          ) : null}
        </svg>
      </div>

      <p className={styles.hint}>{S.construct.canvasHint}</p>
    </div>
  );
}
