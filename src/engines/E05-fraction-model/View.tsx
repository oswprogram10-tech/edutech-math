/**
 * E05 분수 모델 화면.
 *
 * - C(구체물): SVG 패턴 질감, P(반구체): 단색·빗금, A(기호): 숫자와 옅은 칸.
 * - 모든 조작은 Pointer Events 또는 키보드(Enter/Space)로 한다.
 * - 정답을 직접 보여 주는 버튼·텍스트는 없다. 지금 만든 상태만 보여 준다.
 */
import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { minTouchRadius, pointerToLogical, useDrag, useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import {
  circleSectors,
  cutCandidates,
  distance,
  outlineFor,
  pointInPolygon,
  snapToCandidates,
} from './geometry';
import type { Piece } from './geometry';
import { denominatorNumber, gcd, numeratorNumber, parseFraction } from './fractions';
import { piecesOf } from './reduce';
import { fractionModelStrings as S } from './strings.ko';
import { CIRCLE_CENTER, CIRCLE_RADIUS, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type {
  AddSubState,
  CompareState,
  DecimalGridState,
  DiscreteState,
  FractionModelAction,
  FractionModelConfig,
  FractionModelState,
  FractionShape,
  MixedState,
  OverlayState,
  PartitionState,
  ShadeState,
  ShowValue,
} from './types';
import styles from './View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const INK = '#1d2330';
const BLUE = '#2f6fde';
const BLUE_SOFT = '#9dc0ff';
const ORANGE = '#e8872e';
const ORANGE_SOFT = '#f6b26b';
const GREEN = '#2f9e6b';
const PAPER = '#fbfaf6';
const TAP_SLOP = 10;

type FractionViewProps = EngineViewProps<
  FractionModelConfig,
  FractionModelState,
  FractionModelAction
>;

interface ModeProps<State> {
  config: FractionModelConfig;
  state: State;
  dispatch: (action: FractionModelAction) => void;
  cpa: 'C' | 'P' | 'A';
  readOnly: boolean;
  targetSize: 48 | 64;
}

function pathOf(points: readonly Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (!first) return '';
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')} Z`;
}

function boxOf(points: readonly Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function mixedTextOf(value: Rational): string {
  const mixed = value.toMixed();
  const whole = Number(mixed.whole);
  const numerator = Number(mixed.num);
  const denominator = Number(mixed.den);
  if (numerator === 0) return String(whole);
  if (whole === 0) return `${numerator}/${denominator}`;
  return `${whole} ${numerator}/${denominator}`;
}

/** 화면 수치 문구 수준. 기본은 숨김(정답 노출 금지). */
function showValueOf(config: FractionModelConfig): ShowValue {
  return config.showValue ?? 'none';
}

function fillFor(cpa: 'C' | 'P' | 'A', selected: boolean): string {
  if (selected) {
    if (cpa === 'C') return 'url(#e05-cake)';
    if (cpa === 'P') return 'url(#e05-hatch)';
    return '#c9dbfa';
  }
  return cpa === 'C' ? '#f4ecdb' : '#ffffff';
}

function ShapeDefs({ outline }: { outline?: readonly Point[] }) {
  return (
    <defs>
      <pattern id="e05-cake" width="18" height="18" patternUnits="userSpaceOnUse">
        <rect width="18" height="18" fill="#f6cf86" />
        <circle cx="4" cy="4" r="2.2" fill="#d9953a" />
        <circle cx="13" cy="12" r="2.6" fill="#d9953a" />
      </pattern>
      <pattern
        id="e05-hatch"
        width="12"
        height="12"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="12" height="12" fill="#dbe7ff" />
        <rect width="6" height="12" fill="#6d9ef0" />
      </pattern>
      <pattern
        id="e05-orange-hatch"
        width="12"
        height="12"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(-45)"
      >
        <rect width="12" height="12" fill="#ffe6cc" />
        <rect width="6" height="12" fill="#ee9a4d" />
      </pattern>
      <pattern id="e05-selected" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#cfe0ff" />
        <circle cx="7" cy="7" r="2" fill="#2f6fde" />
      </pattern>
      {outline ? (
        <clipPath id="e05-clip">
          <path d={pathOf(outline)} />
        </clipPath>
      ) : null}
    </defs>
  );
}

function ToolbarButton({
  children,
  onClick,
  pressed,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function CanvasFrame({
  svgRef,
  handlers,
  label,
  outline,
  children,
}: {
  svgRef: RefObject<SVGSVGElement>;
  handlers?: {
    onPointerDown: (event: ReactPointerEvent<Element>) => void;
    onPointerMove: (event: ReactPointerEvent<Element>) => void;
    onPointerUp: (event: ReactPointerEvent<Element>) => void;
    onPointerCancel: (event: ReactPointerEvent<Element>) => void;
  };
  label: string;
  outline?: readonly Point[];
  children: ReactNode;
}) {
  return (
    <svg
      ref={svgRef}
      className={styles.canvas}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="fraction-canvas"
      role="img"
      aria-label={label}
      {...(handlers ?? {})}
    >
      <ShapeDefs outline={outline} />
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
      {children}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// partition
// ─────────────────────────────────────────────────────────────

function PartitionView({
  config,
  state,
  dispatch,
  cpa,
  readOnly,
  targetSize,
}: ModeProps<PartitionState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const minRadius = minTouchRadius(targetSize, rendered, LOGICAL);
  const snapThreshold = Math.max(34, minRadius * 1.4);
  const [tool, setTool] = useState<'line' | 'radial'>(
    config.cutTool === 'radial' ? 'radial' : 'line',
  );

  const pieces = useMemo(() => piecesOf(state), [state]);
  const candidates = useMemo(
    () => cutCandidates(state.shape, state.outline),
    [state.shape, state.outline],
  );
  const box = useMemo(() => boxOf(state.outline), [state.outline]);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);
  const snap = (point: Point): Point =>
    snapToCandidates(point, candidates, state.outline, snapThreshold);

  const commitCut = (start: Point, end: Point) => {
    if (readOnly) return;
    if (tool === 'radial' && state.shape === 'circle') {
      dispatch({
        type: 'cut',
        tool: 'radial',
        points: [{ ...CIRCLE_CENTER }, snap(end)],
      });
      return;
    }
    const from = snap(start);
    const to = snap(end);
    if (distance(from, to) < 24) return;
    dispatch({ type: 'cut', tool: 'line', points: [from, to] });
  };

  const drag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onEnd: ({ start, current }) => {
      if (distance(start, current) < TAP_SLOP) {
        const index = pieces.findIndex((piece) => pointInPolygon(current, piece.points));
        if (index >= 0) dispatch({ type: 'shade-piece', index });
        return;
      }
      commitCut(start, current);
    },
  });

  const centerCut = () => {
    const x = (box.minX + box.maxX) / 2;
    dispatch({
      type: 'cut',
      tool: 'line',
      points: [
        { x, y: box.minY },
        { x, y: box.maxY },
      ],
    });
  };

  const radialCut = () => {
    dispatch({
      type: 'cut',
      tool: 'radial',
      points: [{ ...CIRCLE_CENTER }, { x: CIRCLE_CENTER.x + CIRCLE_RADIUS, y: CIRCLE_CENTER.y }],
    });
  };

  const previewStart = drag.start ? snap(drag.start) : null;
  const previewEnd = drag.current ? snap(drag.current) : null;
  const equal = pieces.length > 1 && piecesAreEqualSafe(pieces, state.tolerance);

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <ToolbarButton pressed={tool === 'line'} onClick={() => setTool('line')}>
          {S.toolLine}
        </ToolbarButton>
        {state.shape === 'circle' ? (
          <ToolbarButton pressed={tool === 'radial'} onClick={() => setTool('radial')}>
            {S.toolRadial}
          </ToolbarButton>
        ) : null}
        <ToolbarButton onClick={centerCut} disabled={readOnly}>
          {S.centerCut}
        </ToolbarButton>
        {state.shape === 'circle' ? (
          <ToolbarButton onClick={radialCut} disabled={readOnly}>
            {S.radialCut}
          </ToolbarButton>
        ) : null}
        <ToolbarButton
          onClick={() => dispatch({ type: 'clear-cuts' })}
          disabled={readOnly || state.cuts.length === 0}
        >
          {S.clearCuts}
        </ToolbarButton>
      </div>

      <CanvasFrame
        svgRef={svgRef}
        handlers={drag.handlers}
        label={S.canvasLabel}
        outline={state.shape === 'circle' ? undefined : state.outline}
      >
        <g clipPath={state.shape === 'circle' ? undefined : 'url(#e05-clip)'}>
          {pieces.map((piece, index) => {
            const selected = state.shaded.includes(index);
            return (
              <path
                key={`partition-piece-${index}`}
                d={pathOf(piece.points)}
                fill={fillFor(cpa, selected)}
                stroke={INK}
                strokeWidth={3}
                strokeLinejoin="round"
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-pressed={selected}
                aria-label={selected ? S.pieceSelected(index) : S.pieceLabel(index)}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onKeyDown={(event) => {
                  if (readOnly) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'shade-piece', index });
                  }
                }}
              />
            );
          })}
        </g>

        {state.cuts.map((cut) => {
          const [from, to] = cut.points;
          return (
            <line
              key={cut.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={cut.tool === 'radial' ? ORANGE : BLUE}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={cut.tool === 'radial' ? undefined : '10 7'}
              opacity={0.85}
            />
          );
        })}

        {drag.dragging && previewStart && previewEnd ? (
          <line
            x1={tool === 'radial' && state.shape === 'circle' ? CIRCLE_CENTER.x : previewStart.x}
            y1={tool === 'radial' && state.shape === 'circle' ? CIRCLE_CENTER.y : previewStart.y}
            x2={previewEnd.x}
            y2={previewEnd.y}
            stroke={ORANGE}
            strokeWidth={4}
            strokeDasharray="8 6"
            opacity={0.8}
          />
        ) : null}

        <AreaBars pieces={pieces} />
        {pieces.length === 1 ? (
          <text x={500} y={552} textAnchor="middle" fill={INK} fontSize={22}>
            {S.instructions.partition}
          </text>
        ) : (
          <text
            x={500}
            y={556}
            textAnchor="middle"
            fill={equal ? GREEN : '#a34a1f'}
            fontSize={26}
            fontWeight={700}
          >
            {equal ? S.equalStamp : S.notEqualStamp}
          </text>
        )}
      </CanvasFrame>

      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.cutHint} {S.keyboardHint}
      </p>
    </div>
  );
}

function piecesAreEqualSafe(pieces: readonly Piece[], tolerance: number): boolean {
  if (pieces.length === 0) return false;
  const areas = pieces.map((piece) => piece.area);
  const min = Math.min(...areas);
  const max = Math.max(...areas);
  const average = areas.reduce((sum, area) => sum + area, 0) / areas.length;
  if (average <= 1e-9) return false;
  return (max - min) / average <= tolerance;
}

function AreaBars({ pieces }: { pieces: readonly Piece[] }) {
  if (pieces.length === 0) return null;
  const maxArea = Math.max(...pieces.map((piece) => piece.area), 1);
  const width = Math.min(52, 700 / pieces.length - 6);
  const step = width + 6;
  const startX = 500 - (pieces.length * step) / 2;
  return (
    <g>
      <rect x={100} y={494} width={800} height={58} rx={10} fill="#ffffff" opacity={0.9} />
      <text x={112} y={512} fill={INK} fontSize={13} fontWeight={700}>
        {S.areaBarsLabel}
      </text>
      {pieces.map((piece, index) => {
        const height = Math.max(3, (piece.area / maxArea) * 34);
        return (
          <rect
            key={`area-${index}`}
            x={startX + index * step}
            y={540 - height}
            width={Math.max(4, width)}
            height={height}
            rx={3}
            fill={index % 2 === 0 ? BLUE : ORANGE}
            opacity={0.75}
          />
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// shade
// ─────────────────────────────────────────────────────────────

interface Cell {
  readonly points: readonly Point[];
  readonly center: Point;
}

function shadeCells(state: ShadeState): Cell[] {
  if (state.shape === 'circle') {
    const cuts = Array.from({ length: state.parts }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / state.parts;
      return {
        id: `shade-${index}`,
        tool: 'radial' as const,
        points: [
          { ...CIRCLE_CENTER },
          {
            x: CIRCLE_CENTER.x + CIRCLE_RADIUS * Math.cos(angle),
            y: CIRCLE_CENTER.y + CIRCLE_RADIUS * Math.sin(angle),
          },
        ] as const,
      };
    });
    return circleSectors(CIRCLE_CENTER, CIRCLE_RADIUS, cuts).map((piece) => ({
      points: piece.points,
      center: piece.centroid,
    }));
  }
  const outline = outlineFor(state.shape);
  const box = boxOf(outline);
  const width = (box.maxX - box.minX) / state.parts;
  return Array.from({ length: state.parts }, (_, index) => {
    const x = box.minX + width * index;
    return {
      points: [
        { x, y: box.minY },
        { x: x + width, y: box.minY },
        { x: x + width, y: box.maxY },
        { x, y: box.maxY },
      ],
      center: { x: x + width / 2, y: (box.minY + box.maxY) / 2 },
    };
  });
}

function ShadeView({ config, state, dispatch, cpa, readOnly, targetSize }: ModeProps<ShadeState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cells = useMemo(() => shadeCells(state), [state]);
  const outline = useMemo(() => outlineFor(state.shape), [state.shape]);
  const raw = `${state.shaded.length}/${state.parts}`;
  const reduced = Rational.of(state.shaded.length, state.parts).toString();
  const showValue = showValueOf(config);
  const refineFactors = (config.refine ?? []).filter((factor) => factor === 2 || factor === 3);
  const coarsenFactors = config.coarsen
    ? [2, 3, 5].filter((factor) => state.parts % factor === 0)
    : [];

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        {refineFactors.map((factor) => (
          <ToolbarButton
            key={`refine-${factor}`}
            onClick={() => dispatch({ type: 'refine', factor: factor as 2 | 3 })}
            disabled={readOnly}
          >
            {S.refine(factor)}
          </ToolbarButton>
        ))}
        {coarsenFactors.map((factor) => (
          <ToolbarButton
            key={`coarsen-${factor}`}
            onClick={() => dispatch({ type: 'coarsen', factor })}
            disabled={readOnly}
          >
            {S.coarsen(factor)}
          </ToolbarButton>
        ))}
      </div>

      <CanvasFrame svgRef={svgRef} label={S.canvasLabel} outline={outline}>
        <g clipPath={state.shape === 'circle' ? undefined : 'url(#e05-clip)'}>
          {cells.map((cell, index) => {
            const selected = state.shaded.includes(index);
            return (
              <g key={`shade-cell-${index}`}>
                <path
                  d={pathOf(cell.points)}
                  fill={fillFor(cpa, selected)}
                  stroke={INK}
                  strokeWidth={2.5}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-pressed={selected}
                  aria-label={selected ? S.cellSelected(index) : S.cellLabel(index)}
                  style={{ cursor: readOnly ? 'default' : 'pointer' }}
                  onClick={() => {
                    if (!readOnly) dispatch({ type: 'toggle-part', index });
                  }}
                  onKeyDown={(event) => {
                    if (readOnly) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      dispatch({ type: 'toggle-part', index });
                    }
                  }}
                />
                {cpa === 'A' || state.parts <= 10 ? (
                  <text
                    x={cell.center.x}
                    y={cell.center.y + 7}
                    textAnchor="middle"
                    fill={selected ? '#ffffff' : INK}
                    fontSize={18}
                    fontWeight={700}
                    pointerEvents="none"
                  >
                    {index + 1}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
        <path d={pathOf(outline)} fill="none" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      </CanvasFrame>

      <div className={styles.readoutRow}>
        {showValue !== 'none' ? (
          <p className={styles.readout}>
            {S.currentFraction(raw, showValue === 'raw-and-reduced' ? reduced : raw)}
          </p>
        ) : null}
        {readOnly ? <p className={styles.instructions}>{S.readOnlyHint}</p> : null}
      </div>
      <p className={styles.instructions}>
        {S.instructions.shade} {S.keyboardHint}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// compare
// ─────────────────────────────────────────────────────────────

function CompareView({
  state,
  config,
  dispatch,
  cpa,
  readOnly,
  targetSize,
}: ModeProps<CompareState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rowHeight = Math.min(110, 380 / Math.max(1, state.bars.length));
  const showValue = showValueOf(config);
  const top = 90;
  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
        {state.bars.map((bar, barIndex) => {
          const y = top + barIndex * (rowHeight + 34);
          const selected = state.selectedBar === barIndex;
          const cellWidth = 620 / bar.parts;
          return (
            <g key={`compare-bar-${barIndex}`}>
              <text
                x={state.align === 'right' ? 850 : 120}
                y={y + rowHeight / 2 + 8}
                textAnchor={state.align === 'right' ? 'start' : 'end'}
                fill={INK}
                fontSize={22}
                fontWeight={700}
              >
                {bar.label ?? S.barLabel(barIndex)}
              </text>
              <rect
                x={180}
                y={y}
                width={620}
                height={rowHeight}
                rx={10}
                fill="#ffffff"
                stroke={selected ? BLUE : '#c9d1df'}
                strokeWidth={selected ? 6 : 2}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onClick={() => {
                  if (!readOnly) dispatch({ type: 'select-bar', index: barIndex });
                }}
              />
              {Array.from({ length: bar.parts }, (_, index) => {
                const shaded = bar.shaded.includes(index);
                return (
                  <g key={`compare-${barIndex}-${index}`}>
                    <rect
                      x={180 + index * cellWidth}
                      y={y}
                      width={cellWidth}
                      height={rowHeight}
                      fill={fillFor(cpa, shaded)}
                      stroke={INK}
                      strokeWidth={1.5}
                      role="button"
                      tabIndex={readOnly ? -1 : 0}
                      aria-pressed={shaded}
                      aria-label={S.cellLabel(index)}
                      style={{ cursor: readOnly ? 'default' : 'pointer' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (readOnly) return;
                        dispatch({ type: 'select-bar', index: barIndex });
                        dispatch({ type: 'toggle-bar-part', bar: barIndex, index });
                      }}
                      onKeyDown={(event) => {
                        if (readOnly) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          dispatch({ type: 'select-bar', index: barIndex });
                          dispatch({ type: 'toggle-bar-part', bar: barIndex, index });
                        }
                      }}
                    />
                  </g>
                );
              })}
              {showValue !== 'none' ? (
                <text x={820} y={y + rowHeight / 2 + 8} fill={INK} fontSize={22}>
                  {S.barValue(
                    `${bar.shaded.length}/${bar.parts}`,
                    showValue === 'raw-and-reduced'
                      ? Rational.of(bar.shaded.length, bar.parts).toString()
                      : `${bar.shaded.length}/${bar.parts}`,
                  )}
                </text>
              ) : null}
            </g>
          );
        })}
      </CanvasFrame>
      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.compare} {S.keyboardHint}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// overlay-slicer
// ─────────────────────────────────────────────────────────────

function OverlayView({
  state,
  config,
  dispatch,
  cpa,
  readOnly,
  targetSize,
}: ModeProps<OverlayState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const showValue = showValueOf(config);
  const a = parseFraction(state.a, '1/2');
  const b = parseFraction(state.b, '1/3');
  const denA = denominatorNumber(a) ?? 2;
  const denB = denominatorNumber(b) ?? 3;
  const numA = numeratorNumber(a) ?? 1;
  const numB = numeratorNumber(b) ?? 1;
  const product = denA * denB;
  const minimum = lcmOf(denA, denB);
  const validGrids = Array.from(
    { length: Math.max(1, product / minimum) },
    (_, index) => minimum * (index + 1),
  );
  const grid = state.grid ?? product;
  const aCells = Math.round((numA * grid) / denA);
  const bCells = Math.round((numB * grid) / denB);

  const stepGrid = (direction: 'smaller' | 'bigger') => {
    const current = state.grid ?? product;
    if (direction === 'smaller') {
      const smaller = [...validGrids].reverse().find((size) => size < current);
      if (smaller !== undefined) dispatch({ type: 'set-grid', size: smaller });
      return;
    }
    const bigger = validGrids.find((size) => size > current);
    if (bigger !== undefined) dispatch({ type: 'set-grid', size: bigger });
  };

  const square = { x: 260, y: 90, size: 400 };
  const stripWidth = square.size / grid;

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <ToolbarButton onClick={() => dispatch({ type: 'overlay' })} disabled={readOnly}>
          {state.overlaid ? S.removeOverlay : S.overlay}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => stepGrid('smaller')}
          disabled={readOnly || !state.overlaid || grid <= minimum}
        >
          {S.gridSmaller}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => stepGrid('bigger')}
          disabled={readOnly || !state.overlaid || grid >= product}
        >
          {S.gridBigger}
        </ToolbarButton>
      </div>

      <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
        {!state.overlaid ? (
          <>
            <BandSquare
              x={110}
              y={120}
              size={300}
              den={denA}
              num={numA}
              color={BLUE}
              orientation="horizontal"
              cpa={cpa}
            />
            <BandSquare
              x={590}
              y={120}
              size={300}
              den={denB}
              num={numB}
              color={ORANGE}
              orientation="vertical"
              cpa={cpa}
            />
            <text x={260} y={470} textAnchor="middle" fill={INK} fontSize={20}>
              {state.a}: {numA}/{denA}
            </text>
            <text x={740} y={470} textAnchor="middle" fill={INK} fontSize={20}>
              {state.b}: {numB}/{denB}
            </text>
          </>
        ) : (
          <>
            <rect
              x={square.x}
              y={square.y}
              width={square.size}
              height={square.size}
              rx={14}
              fill="#ffffff"
              stroke={INK}
              strokeWidth={4}
            />
            {Array.from({ length: grid }, (_, index) => {
              const inA = index < aCells;
              const inB = index < bCells;
              const fill = inA && inB ? '#8a63c9' : inA ? BLUE_SOFT : inB ? ORANGE_SOFT : '#ffffff';
              return (
                <rect
                  key={`overlay-strip-${index}`}
                  x={square.x + index * stripWidth}
                  y={square.y}
                  width={stripWidth}
                  height={square.size}
                  fill={fill}
                  opacity={inA || inB ? 0.85 : 1}
                  stroke="#b9c2d2"
                  strokeWidth={1}
                />
              );
            })}
            {showValue !== 'none' ? (
              <>
                <text
                  x={square.x + square.size / 2}
                  y={square.y + square.size + 46}
                  textAnchor="middle"
                  fill={INK}
                  fontSize={22}
                  fontWeight={700}
                >
                  {S.commonGrid(grid)}
                </text>
                <text
                  x={square.x + square.size / 2}
                  y={square.y + square.size + 82}
                  textAnchor="middle"
                  fill={INK}
                  fontSize={20}
                >
                  {S.aCells(aCells)} · {S.bCells(bCells)}
                </text>
              </>
            ) : null}
          </>
        )}
      </CanvasFrame>
      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.overlay}
        {state.overlaid
          ? showValue !== 'none'
            ? ` ${S.commonGrid(grid)}`
            : null
          : ` ${S.commonGridNone}`}
      </p>
    </div>
  );
}

function lcmOf(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 1;
  return (a / gcd(a, b)) * b;
}

function BandSquare({
  x,
  y,
  size,
  den,
  num,
  color,
  orientation,
  cpa,
}: {
  x: number;
  y: number;
  size: number;
  den: number;
  num: number;
  color: string;
  orientation: 'horizontal' | 'vertical';
  cpa: 'C' | 'P' | 'A';
}) {
  const step = size / den;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={14}
        fill={cpa === 'C' ? '#f4ecdb' : '#ffffff'}
        stroke={INK}
        strokeWidth={4}
      />
      {Array.from({ length: den }, (_, index) => {
        const shaded = index < num;
        const cellX = orientation === 'vertical' ? x + index * step : x;
        const cellY = orientation === 'horizontal' ? y + index * step : y;
        const width = orientation === 'vertical' ? step : size;
        const height = orientation === 'horizontal' ? step : size;
        return (
          <rect
            key={`band-${index}`}
            x={cellX}
            y={cellY}
            width={width}
            height={height}
            fill={shaded ? color : 'transparent'}
            opacity={shaded ? 0.55 : 1}
            stroke="#c9d1df"
            strokeWidth={1.5}
          />
        );
      })}
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={14}
        fill="none"
        stroke={INK}
        strokeWidth={4}
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// discrete
// ─────────────────────────────────────────────────────────────

function DiscreteView({
  config,
  state,
  dispatch,
  cpa,
  readOnly,
  targetSize,
}: ModeProps<DiscreteState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const showValue = showValueOf(config);
  const groups = Math.max(1, Math.floor(state.items / state.groupSize));
  const options = (config.groupSizeOptions ?? [2, 3, 4, 6]).filter(
    (size) => size > 0 && state.items % size === 0,
  );
  const columns = state.groupSize;
  const rows = groups;
  const cell = Math.min(74, 640 / Math.max(1, columns), 380 / Math.max(1, rows));
  const width = columns * cell;
  const height = rows * cell;
  const startX = 500 - width / 2;
  const startY = 90 + Math.max(0, (390 - height) / 2);

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        {options.map((size) => (
          <ToolbarButton
            key={`group-${size}`}
            pressed={state.groupSize === size}
            onClick={() => dispatch({ type: 'set-group-size', size })}
            disabled={readOnly}
          >
            {S.groupBy(size)}
          </ToolbarButton>
        ))}
      </div>
      <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
        {Array.from({ length: groups }, (_, groupIndex) => {
          const selected = state.selectedGroups.includes(groupIndex);
          const y = startY + groupIndex * cell;
          return (
            <g key={`group-${groupIndex}`}>
              <rect
                x={startX + 6}
                y={y + 6}
                width={width - 12}
                height={cell - 12}
                rx={16}
                fill={selected ? (cpa === 'C' ? 'url(#e05-cake)' : BLUE_SOFT) : '#ffffff'}
                opacity={selected ? 0.72 : 0.9}
                stroke={selected ? BLUE : '#c9d1df'}
                strokeWidth={selected ? 6 : 2.5}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-pressed={selected}
                aria-label={
                  selected
                    ? S.groupSelected(groupIndex, state.groupSize)
                    : S.groupLabel(groupIndex, state.groupSize)
                }
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onClick={() => {
                  if (!readOnly) dispatch({ type: 'toggle-group', index: groupIndex });
                }}
                onKeyDown={(event) => {
                  if (readOnly) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'toggle-group', index: groupIndex });
                  }
                }}
              />
              {Array.from({ length: state.groupSize }, (_, columnIndex) => {
                const itemIndex = groupIndex * state.groupSize + columnIndex;
                if (itemIndex >= state.items) return null;
                return (
                  <ItemIcon
                    key={`item-${itemIndex}`}
                    icon={state.icon}
                    x={startX + columnIndex * cell + cell / 2}
                    y={y + cell / 2}
                    radius={Math.min(24, cell * 0.32)}
                    selected={selected}
                  />
                );
              })}
            </g>
          );
        })}
      </CanvasFrame>
      {showValue !== 'none' ? (
        <p className={styles.readout}>
          {showValue === 'raw-and-reduced'
            ? S.fractionOf(
                state.items,
                state.selectedGroups.length,
                groups,
                state.selectedGroups.length * state.groupSize,
              )
            : S.fractionOfRaw(state.items, state.selectedGroups.length, groups)}
        </p>
      ) : null}
      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.discrete} {S.keyboardHint}
      </p>
    </div>
  );
}

function ItemIcon({
  icon,
  x,
  y,
  radius,
  selected,
}: {
  icon: string;
  x: number;
  y: number;
  radius: number;
  selected: boolean;
}) {
  const fill = selected ? '#ffffff' : '#f7a8b8';
  if (icon === 'star') {
    const points = Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * index) / 5;
      const r = index % 2 === 0 ? radius : radius * 0.45;
      return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`;
    }).join(' ');
    return (
      <polygon
        points={points}
        fill={selected ? '#ffe08a' : '#f5c542'}
        stroke={INK}
        strokeWidth={2}
      />
    );
  }
  if (icon === 'dot') {
    return (
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={selected ? '#ffffff' : BLUE_SOFT}
        stroke={INK}
        strokeWidth={2}
      />
    );
  }
  return (
    <g>
      <circle cx={x} cy={y} r={radius} fill={fill} stroke={INK} strokeWidth={2} />
      <path
        d={`M ${x - radius * 0.7} ${y - radius * 0.2} Q ${x} ${y + radius * 0.35} ${x + radius * 0.7} ${y - radius * 0.2}`}
        fill="none"
        stroke="#c94b4b"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// mixed
// ─────────────────────────────────────────────────────────────

function MixedView({ state, config, dispatch, cpa, readOnly, targetSize }: ModeProps<MixedState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const showValue = showValueOf(config);
  if (state.kind === 'problem') {
    const a = parseFraction(state.a ?? undefined, '1/2');
    const b = parseFraction(state.b ?? undefined, '1/3');
    const broken = state.borrowed && state.naturalPart !== null && state.pieceCount !== null;
    const naturalPart = Math.min(state.naturalPart ?? 0, 8);
    const pieceCount = Math.min(state.pieceCount ?? 0, 42);
    const pieceColumns = 10;
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
        <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
          <ToolbarButton
            onClick={() => dispatch({ type: 'combine' })}
            disabled={readOnly || state.combined}
          >
            {state.op === '-' ? S.subtract : S.combine}
          </ToolbarButton>
          {state.allowBreakWhole ? (
            <ToolbarButton
              onClick={() => dispatch({ type: 'break-whole' })}
              disabled={readOnly || state.borrowed || state.wholes <= 0}
              pressed={state.borrowed}
            >
              {S.breakWhole}
            </ToolbarButton>
          ) : null}
        </div>
        <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
          {broken ? (
            <>
              {Array.from({ length: naturalPart }, (_, index) => (
                <WholeBox
                  key={`broken-whole-${index}`}
                  x={120 + index * 92}
                  y={70}
                  size={72}
                  shape={state.shape}
                  cpa={cpa}
                />
              ))}
              {Array.from({ length: pieceCount }, (_, index) => {
                const column = index % pieceColumns;
                const row = Math.floor(index / pieceColumns);
                return (
                  <circle
                    key={`broken-piece-${index}`}
                    cx={150 + column * 64}
                    cy={230 + row * 50}
                    r={18}
                    fill={fillFor(cpa, true)}
                    stroke={INK}
                    strokeWidth={2}
                  />
                );
              })}
              <ValueBars
                value={b}
                cells={Math.max(1, denominatorNumber(b) ?? 2)}
                y={390}
                label={state.b ?? ''}
                cpa={cpa}
                tone={ORANGE}
              />
            </>
          ) : (
            <>
              <ValueBars
                value={a}
                cells={Math.max(1, denominatorNumber(a) ?? 2)}
                y={120}
                label={state.a ?? ''}
                cpa={cpa}
              />
              <ValueBars
                value={b}
                cells={Math.max(1, denominatorNumber(b) ?? 2)}
                y={310}
                label={state.b ?? ''}
                cpa={cpa}
              />
            </>
          )}
          {showValue !== 'none' && state.result ? (
            <text x={500} y={560} textAnchor="middle" fill={INK} fontSize={26} fontWeight={700}>
              {S.resultLabel(
                showValue === 'raw-and-reduced'
                  ? mixedTextOf(Rational.parse(state.result))
                  : state.result,
              )}
            </text>
          ) : null}
        </CanvasFrame>
        <p className={styles.instructions}>{readOnly ? S.readOnlyHint : S.instructions.mixed}</p>
      </div>
    );
  }

  const total = state.wholes * state.denominator + state.pieces;
  const value = Rational.of(total, state.denominator);
  const mixedText = mixedTextOf(value);
  const improper = `${total}/${state.denominator}`;
  const canFuse = state.pieces >= state.denominator;
  const canBreak = state.allowBreakWhole && state.wholes > 0;
  const wholeBoxes = Math.min(state.wholes, 8);
  const pieceRadius = state.denominator > 12 ? 12 : 20;
  const conversionText =
    showValue === 'none'
      ? null
      : showValue === 'raw'
        ? S.improperOnly(improper)
        : S.mixedConversion(improper, mixedText);

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <ToolbarButton onClick={() => dispatch({ type: 'fuse' })} disabled={readOnly || !canFuse}>
          {S.fuse}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => dispatch({ type: 'break-whole' })}
          disabled={readOnly || !canBreak}
        >
          {S.breakWhole}
        </ToolbarButton>
      </div>
      <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
        {Array.from({ length: wholeBoxes }, (_, index) => (
          <WholeBox
            key={`whole-${index}`}
            x={120 + (index % 4) * 110}
            y={100 + Math.floor(index / 4) * 120}
            size={86}
            shape={state.shape}
            cpa={cpa}
          />
        ))}
        {conversionText !== null ? (
          <text x={500} y={70} textAnchor="middle" fill={INK} fontSize={22} fontWeight={700}>
            {conversionText}
          </text>
        ) : null}
        {Array.from({ length: Math.min(state.pieces, 60) }, (_, index) => {
          const columns = Math.min(10, Math.max(1, state.pieces));
          const column = index % columns;
          const row = Math.floor(index / columns);
          return (
            <circle
              key={`piece-${index}`}
              cx={180 + column * 70}
              cy={330 + row * 54}
              r={pieceRadius}
              fill={fillFor(cpa, true)}
              stroke={INK}
              strokeWidth={2}
            />
          );
        })}
        <text x={180} y={300} fill={INK} fontSize={20}>
          {S.remainingPieces(state.pieces)}
        </text>
      </CanvasFrame>
      {conversionText !== null ? <p className={styles.readout}>{conversionText}</p> : null}
      <p className={styles.instructions}>{readOnly ? S.readOnlyHint : S.instructions.mixed}</p>
    </div>
  );
}

function WholeBox({
  x,
  y,
  size,
  shape,
  cpa,
}: {
  x: number;
  y: number;
  size: number;
  shape: FractionShape;
  cpa: 'C' | 'P' | 'A';
}) {
  const fill = fillFor(cpa, true);
  if (shape === 'circle') {
    return (
      <circle
        cx={x + size / 2}
        cy={y + size / 2}
        r={size / 2}
        fill={fill}
        stroke={INK}
        strokeWidth={3}
      />
    );
  }
  return (
    <rect x={x} y={y} width={size} height={size} rx={10} fill={fill} stroke={INK} strokeWidth={3} />
  );
}

// ─────────────────────────────────────────────────────────────
// add-sub
// ─────────────────────────────────────────────────────────────

function AddSubView({
  config,
  state,
  dispatch,
  cpa,
  readOnly,
  targetSize,
}: ModeProps<AddSubState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const showValue = showValueOf(config);
  const a = parseFraction(state.a, '0');
  const b = parseFraction(state.b, '0');
  const denA = Math.max(1, denominatorNumber(a) ?? 1);
  const denB = Math.max(1, denominatorNumber(b) ?? 1);
  const cellsA = state.commonGrid !== null ? state.commonGrid : denA;
  const cellsB = state.commonGrid !== null ? state.commonGrid : denB;
  const result = state.result !== null ? Rational.parse(state.result) : null;
  const combined = state.combined && result !== null;
  const canCombine = !state.requireCommonGrid || state.commonGrid !== null;
  const strategies = config.strategyChoice ?? [];
  const shown = [a, b];

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <ToolbarButton onClick={() => dispatch({ type: 'overlay' })} disabled={readOnly}>
          {S.makeCommonGrid}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => dispatch({ type: 'combine' })}
          disabled={readOnly || !canCombine}
        >
          {state.op === '-' ? S.subtract : S.combine}
        </ToolbarButton>
        {state.allowBreakWhole ? (
          <ToolbarButton
            onClick={() => dispatch({ type: 'break-whole' })}
            disabled={readOnly}
            pressed={state.borrowed}
          >
            {S.breakWhole}
          </ToolbarButton>
        ) : null}
        {strategies.map((strategy) => (
          <ToolbarButton
            key={`strategy-${strategy}`}
            pressed={state.strategy === strategy}
            onClick={() => dispatch({ type: 'set-strategy', strategy })}
            disabled={readOnly}
          >
            {strategy === 'separate' ? S.strategySeparate : S.strategyImproper}
          </ToolbarButton>
        ))}
      </div>
      <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
        {shown.map((value, index) => (
          <ValueBars
            key={`operand-${index}`}
            value={value}
            cells={index === 0 ? cellsA : cellsB}
            y={90 + index * 150}
            label={index === 0 ? state.a : state.b}
            cpa={cpa}
            tone={index === 0 ? BLUE : ORANGE}
          />
        ))}
        {combined && result ? (
          <>
            <line
              x1={90}
              y1={400}
              x2={910}
              y2={400}
              stroke="#c9d1df"
              strokeWidth={2}
              strokeDasharray="8 6"
            />
            <ValueBars
              value={result}
              cells={Math.max(1, denominatorNumber(result) ?? 4)}
              y={430}
              label={showValue === 'none' ? '' : (state.result ?? '')}
              cpa={cpa}
              tone={GREEN}
            />
            {showValue !== 'none' ? (
              <text x={880} y={470} textAnchor="end" fill={INK} fontSize={22} fontWeight={700}>
                {S.resultLabel(
                  showValue === 'raw-and-reduced' ? mixedTextOf(result) : result.toString(),
                )}
              </text>
            ) : null}
          </>
        ) : null}
        {!canCombine ? (
          <text x={500} y={560} textAnchor="middle" fill="#a34a1f" fontSize={22}>
            {S.needCommonGrid}
          </text>
        ) : null}
      </CanvasFrame>
      <p className={styles.instructions}>{readOnly ? S.readOnlyHint : S.instructions.addSub}</p>
    </div>
  );
}

function ValueBars({
  value,
  cells,
  y,
  label,
  cpa,
  tone = BLUE,
}: {
  value: Rational;
  cells: number;
  y: number;
  label: string;
  cpa: 'C' | 'P' | 'A';
  tone?: string;
}) {
  const units = Math.max(1, Math.ceil(Number(value.n) / Number(value.d)));
  const safeCells = Math.max(1, Math.min(cells, 30));
  const width = Math.min(760, 720 / units);
  const startX = 500 - (units * (width + 10)) / 2;
  const totalShaded = Math.round((Number(value.n) / Number(value.d)) * safeCells);
  return (
    <g>
      <text x={110} y={y - 10} fill={INK} fontSize={20} fontWeight={700}>
        {label}
      </text>
      {Array.from({ length: units }, (_, unit) => {
        const unitX = startX + unit * (width + 10);
        return (
          <g key={`value-unit-${unit}`}>
            <rect
              x={unitX}
              y={y}
              width={width}
              height={62}
              rx={8}
              fill={cpa === 'C' ? '#f4ecdb' : '#ffffff'}
              stroke={INK}
              strokeWidth={2.5}
            />
            {Array.from({ length: safeCells }, (_, index) => {
              const global = unit * safeCells + index;
              const shaded = global < totalShaded;
              return (
                <rect
                  key={`value-cell-${unit}-${index}`}
                  x={unitX + (index * width) / safeCells}
                  y={y}
                  width={width / safeCells}
                  height={62}
                  fill={shaded ? (cpa === 'C' ? 'url(#e05-cake)' : tone) : 'transparent'}
                  opacity={shaded ? (cpa === 'C' ? 1 : 0.45) : 1}
                  stroke="#c9d1df"
                  strokeWidth={1}
                />
              );
            })}
            <rect
              x={unitX}
              y={y}
              width={width}
              height={62}
              rx={8}
              fill="none"
              stroke={INK}
              strokeWidth={2.5}
            />
          </g>
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// decimal-grid
// ─────────────────────────────────────────────────────────────

function DecimalGridView({
  state,
  config,
  dispatch,
  cpa,
  readOnly,
  targetSize,
}: ModeProps<DecimalGridState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const showValue = showValueOf(config);
  const total = state.size * state.size;
  const layerStart = state.layer * total;
  const square = 480;
  const startX = 260;
  const startY = 60;
  const cell = square / state.size;
  const layerValue = state.shaded.filter(
    (index) => index >= layerStart && index < layerStart + total,
  ).length;
  const value = Rational.of(layerValue, total);

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        {Array.from({ length: state.layers }, (_, layer) => (
          <ToolbarButton
            key={`layer-${layer}`}
            pressed={state.layer === layer}
            onClick={() => dispatch({ type: 'set-layer', layer })}
            disabled={readOnly}
          >
            {S.layerName(layer)}
          </ToolbarButton>
        ))}
        <ToolbarButton
          onClick={() => dispatch({ type: 'clear-cells' })}
          disabled={readOnly || state.shaded.length === 0}
        >
          {S.clearCells}
        </ToolbarButton>
      </div>
      <CanvasFrame svgRef={svgRef} label={S.canvasLabel}>
        <g>
          {Array.from({ length: state.size }, (_, row) => (
            <g key={`row-${row}`}>
              <rect
                x={startX - 52}
                y={startY + row * cell + 2}
                width={44}
                height={cell - 4}
                rx={8}
                fill="#ffffff"
                stroke="#c9d1df"
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.rowShade(row)}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onClick={() => {
                  if (!readOnly) dispatch({ type: 'shade-row', row });
                }}
                onKeyDown={(event) => {
                  if (readOnly) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'shade-row', row });
                  }
                }}
              />
              <text
                x={startX - 30}
                y={startY + row * cell + cell / 2 + 6}
                textAnchor="middle"
                fill={INK}
                fontSize={16}
                pointerEvents="none"
              >
                {row + 1}
              </text>
            </g>
          ))}
          {Array.from({ length: total }, (_, local) => {
            const index = layerStart + local;
            const row = Math.floor(local / state.size);
            const column = local % state.size;
            const selected = state.shaded.includes(index);
            return (
              <rect
                key={`decimal-cell-${index}`}
                x={startX + column * cell}
                y={startY + row * cell}
                width={cell}
                height={cell}
                fill={fillFor(cpa, selected)}
                stroke="#9aa7bd"
                strokeWidth={1}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-pressed={selected}
                aria-label={selected ? S.cellSelected(index) : S.cellLabel(index)}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onClick={() => {
                  if (!readOnly) dispatch({ type: 'toggle-cell', index });
                }}
                onKeyDown={(event) => {
                  if (readOnly) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'toggle-cell', index });
                  }
                }}
              />
            );
          })}
          <rect
            x={startX}
            y={startY}
            width={square}
            height={square}
            fill="none"
            stroke={INK}
            strokeWidth={4}
          />
        </g>
      </CanvasFrame>
      {showValue !== 'none' ? (
        <p className={styles.readout}>
          {S.decimalValue(
            value.toString(),
            showValue === 'raw-and-reduced' && value.isTerminatingDecimal()
              ? value.toDecimalString()
              : null,
          )}
        </p>
      ) : null}
      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.decimal} {S.keyboardHint}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// root
// ─────────────────────────────────────────────────────────────

export function FractionModelView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: FractionViewProps) {
  switch (state.mode) {
    case 'partition':
      return (
        <PartitionView
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'shade':
      return (
        <ShadeView
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'compare':
      return (
        <CompareView
          state={state}
          config={config}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'overlay-slicer':
      return (
        <OverlayView
          state={state}
          config={config}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'discrete':
      return (
        <DiscreteView
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'mixed':
      return (
        <MixedView
          state={state}
          config={config}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'add-sub':
      return (
        <AddSubView
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
    case 'decimal-grid':
      return (
        <DecimalGridView
          state={state}
          config={config}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
        />
      );
  }
}

export default FractionModelView;
