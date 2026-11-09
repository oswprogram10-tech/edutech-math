/**
 * E04 배열판 화면.
 *
 * - 모든 포인터 위치는 SDK `pointerToLogical`로만 논리 좌표로 바꾼다.
 * - 전체 곱(행×열)은 화면에 쓰지 않는다. 부분곱은 학생이 만든 분할의
 *   조각 크기·곱으로만 보여 준다(카드 결정 10).
 * - 모든 조작은 단추·키보드로도 끝낼 수 있다(카드 결정 12).
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  clamp,
  distance,
  minTouchRadius,
  pointerToLogical,
  useDrag,
  useRenderedSize,
} from '../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../core/engine-sdk';
import { boundariesFor } from './area';
import {
  areaPieceRects,
  areaRect,
  areaSplitAtFromPoint,
  areaX,
  areaY,
  arrayRect,
  cellCenter,
  diagonalSegment,
  colsFromPoint,
  resizeHandle,
  rowsFromPoint,
  splitAtFromPoint,
  splitPieceRects,
  splitSegment,
  tableCellRect,
  tableRect,
} from './layout';
import type { AreaRect, PieceRect } from './layout';
import { canPlaceSplit, defaultSplitAt } from './reduce';
import { arrayAreaStrings as S } from './strings.ko';
import { GRID_LIMIT, LOGICAL_HEIGHT, LOGICAL_WIDTH, PARTIAL_PALETTE } from './types';
import type {
  ArrayAreaAction,
  ArrayAreaConfig,
  ArrayAreaState,
  ArrayIcon,
  SplitOrientation,
} from './types';
import { DecimalAreaView } from './views/DecimalAreaView';
import { FractionAreaView } from './views/FractionAreaView';
import { PuzzleView } from './views/PuzzleView';
import { ScalerView } from './views/ScalerView';
import { TilingView } from './views/TilingView';
import styles from './View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const TAP_SLOP = 8;
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#5b6577';
const BLUE = '#2f6fde';
const SELECT = '#e8872e';
const NEGATIVE = '#c2410c';

type LineTarget =
  | { readonly kind: 'dot-line'; readonly orientation: SplitOrientation; readonly at: number }
  | {
      readonly kind: 'split';
      readonly orientation: SplitOrientation;
      readonly at: number;
      readonly index: number;
    }
  | { readonly kind: 'area'; readonly side: 'a' | 'b'; readonly at: number };

function iconGlyph(icon: ArrayIcon, cx: number, cy: number, radius: number, key: string) {
  if (icon === 'tree') {
    return (
      <g key={key} pointerEvents="none">
        <rect x={cx - 2.5} y={cy} width={5} height={radius} rx={1.5} fill="#8a5c00" />
        <polygon
          points={`${cx},${cy - radius} ${cx + radius * 0.9},${cy + radius * 0.3} ${cx - radius * 0.9},${cy + radius * 0.3}`}
          fill="#3f8f52"
          stroke="#215c2a"
          strokeWidth={1}
        />
      </g>
    );
  }
  if (icon === 'candy') {
    return (
      <g key={key} pointerEvents="none">
        <circle
          cx={cx}
          cy={cy}
          r={radius * 0.8}
          fill="#f2b53c"
          stroke="#8a5c00"
          strokeWidth={1.2}
        />
        <polygon
          points={`${cx - radius * 0.8},${cy} ${cx - radius * 1.5},${cy - radius * 0.55} ${cx - radius * 1.4},${cy + radius * 0.6}`}
          fill="#f7d27a"
          stroke="#8a5c00"
          strokeWidth={1}
        />
        <polygon
          points={`${cx + radius * 0.8},${cy} ${cx + radius * 1.5},${cy - radius * 0.55} ${cx + radius * 1.4},${cy + radius * 0.6}`}
          fill="#f7d27a"
          stroke="#8a5c00"
          strokeWidth={1}
        />
      </g>
    );
  }
  if (icon === 'strawberry') {
    return (
      <g key={key} pointerEvents="none">
        <path
          d={`M ${cx} ${cy - radius} C ${cx + radius} ${cy - radius * 0.4} ${cx + radius * 0.6} ${cy + radius} ${cx} ${cy + radius} C ${cx - radius * 0.6} ${cy + radius} ${cx - radius} ${cy - radius * 0.4} ${cx} ${cy - radius} Z`}
          fill="#e2554f"
          stroke="#9b2c2c"
          strokeWidth={1}
        />
        <polygon
          points={`${cx},${cy - radius * 1.25} ${cx + radius * 0.5},${cy - radius * 0.8} ${cx - radius * 0.5},${cy - radius * 0.8}`}
          fill="#3f8f52"
        />
      </g>
    );
  }
  return (
    <circle
      key={key}
      cx={cx}
      cy={cy}
      r={radius * 0.62}
      fill={BLUE}
      fillOpacity={0.85}
      pointerEvents="none"
    />
  );
}

function PartialPatterns() {
  return (
    <defs>
      {PARTIAL_PALETTE.map((entry, index) => (
        <pattern
          key={`pat-${index}`}
          id={`e04-pattern-${index}`}
          width={9}
          height={9}
          patternUnits="userSpaceOnUse"
          patternTransform={
            entry.pattern === 'left'
              ? 'rotate(-45)'
              : entry.pattern === 'dots'
                ? undefined
                : 'rotate(45)'
          }
        >
          {entry.pattern === 'dots' ? (
            <circle cx={4.5} cy={4.5} r={1.6} fill={entry.ink} fillOpacity={0.5} />
          ) : entry.pattern === 'cross' ? (
            <g stroke={entry.ink} strokeOpacity={0.45} strokeWidth={1.4}>
              <line x1={0} y1={0} x2={9} y2={9} />
              <line x1={9} y1={0} x2={0} y2={9} />
            </g>
          ) : (
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={9}
              stroke={entry.ink}
              strokeOpacity={0.45}
              strokeWidth={1.6}
            />
          )}
        </pattern>
      ))}
    </defs>
  );
}

function pieceFill(index: number, show: ArrayAreaState['settings']['showPartials']): string | null {
  if (show === 'none') return null;
  return `url(#e04-pattern-${index % PARTIAL_PALETTE.length})`;
}

function PieceShape({
  piece,
  index,
  show,
  negative,
  order = 'rows-cols',
}: {
  readonly piece: PieceRect;
  readonly index: number;
  readonly show: ArrayAreaState['settings']['showPartials'];
  readonly negative: boolean;
  /** area-model은 가로×세로(넓이) 순서로 쓴다. */
  readonly order?: 'rows-cols' | 'cols-rows';
}) {
  const palette = PARTIAL_PALETTE[index % PARTIAL_PALETTE.length];
  if (!palette) return null;
  const fill = pieceFill(index, show);
  const first = order === 'rows-cols' ? piece.rows : piece.cols;
  const second = order === 'rows-cols' ? piece.cols : piece.rows;
  return (
    <g pointerEvents="none">
      <rect
        x={piece.x}
        y={piece.y}
        width={piece.width}
        height={piece.height}
        fill={negative ? '#fdeeee' : show === 'none' ? 'none' : palette.fill}
        fillOpacity={negative ? 0.7 : 0.55}
        stroke={negative ? NEGATIVE : palette.ink}
        strokeWidth={negative ? 2.4 : 1.6}
        strokeDasharray={negative ? '8 5' : undefined}
      />
      {fill ? (
        <rect
          x={piece.x}
          y={piece.y}
          width={piece.width}
          height={piece.height}
          fill={fill}
          stroke="none"
        />
      ) : null}
      {show !== 'none' && piece.width >= 54 && piece.height >= 30 ? (
        <>
          <text
            x={piece.x + piece.width / 2}
            y={piece.y + piece.height / 2 + (show === 'color' ? -3 : 6)}
            textAnchor="middle"
            fontSize={16}
            fontWeight={700}
            fill={negative ? NEGATIVE : palette.ink}
          >
            {negative ? S.pieceNegative(first, second) : S.pieceDims(first, second)}
          </text>
          {show === 'color' ? (
            <text
              x={piece.x + piece.width / 2}
              y={piece.y + piece.height / 2 + 17}
              textAnchor="middle"
              fontSize={15}
              fill={negative ? NEGATIVE : palette.ink}
            >
              {`${piece.sign === -1 ? '−' : ''}${piece.rows * piece.cols}`}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function AreaPieceGrid({
  rect,
  a,
  b,
  thick,
}: {
  readonly rect: AreaRect;
  readonly a: number;
  readonly b: number;
  readonly thick: boolean;
}) {
  const cols = Math.max(0, Math.round(a));
  const rows = Math.max(0, Math.round(b));
  return (
    <g pointerEvents="none" stroke="#33415c" strokeOpacity={0.28} strokeWidth={1}>
      {Array.from({ length: Math.max(0, cols - 1) }, (_, index) =>
        thick && (index + 1) % 10 !== 0 ? null : (
          <line
            key={`av-${index}`}
            x1={areaX(rect, a, index + 1)}
            y1={rect.y}
            x2={areaX(rect, a, index + 1)}
            y2={rect.y + rect.height}
            strokeWidth={thick && (index + 1) % 10 === 0 ? 2.2 : 1}
          />
        ),
      )}
      {Array.from({ length: Math.max(0, rows - 1) }, (_, index) =>
        thick && (index + 1) % 10 !== 0 ? null : (
          <line
            key={`ah-${index}`}
            x1={rect.x}
            y1={areaY(rect, b, index + 1)}
            x2={rect.x + rect.width}
            y2={areaY(rect, b, index + 1)}
            strokeWidth={thick && (index + 1) % 10 === 0 ? 2.2 : 1}
          />
        ),
      )}
    </g>
  );
}

interface EntryState {
  readonly r: number;
  readonly c: number;
  readonly text: string;
}

function SquareArrayView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const measured = minTouchRadius(targetSize, rendered, LOGICAL);
  const hitRadius = Math.max(12, Math.ceil(measured));

  const [draft, setDraft] = useState<{ rows: number; cols: number } | null>(null);
  const [linePreview, setLinePreview] = useState<{
    orientation: SplitOrientation;
    at: number;
  } | null>(null);
  const [areaPreview, setAreaPreview] = useState<{ side: 'a' | 'b'; at: number } | null>(null);
  const [entry, setEntry] = useState<EntryState | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [paintColor, setPaintColor] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState<string | null>(null);

  const [lineTarget, setLineTarget] = useState<LineTarget | null>(null);
  const resizeTarget = useRef(false);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const rows = draft?.rows ?? state.rows;
  const cols = draft?.cols ?? state.cols;
  const rect = arrayRect(rows, cols, state.settings.maxRows, state.settings.maxCols);
  const resetDraft = () => {
    setDraft(null);
    setLinePreview(null);
    setAreaPreview(null);
    setLineTarget(null);
    resizeTarget.current = false;
  };

  const shake = (key: string) => {
    setShakeKey(key);
    window.setTimeout(() => setShakeKey((current) => (current === key ? null : current)), 420);
  };

  const resizeDrag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onEnd: ({ start, current }) => {
      if (!resizeTarget.current) return;
      resizeTarget.current = false;
      if (distance(start, current) < TAP_SLOP) {
        setDraft(null);
        return;
      }
      const base = arrayRect(
        state.rows,
        state.cols,
        state.settings.maxRows,
        state.settings.maxCols,
      );
      const nextRows = rowsFromPoint(base, current, state.settings.maxRows);
      const nextCols = colsFromPoint(base, current, state.settings.maxCols);
      setDraft(null);
      dispatch({ type: 'resize', rows: nextRows, cols: nextCols });
    },
  });

  const lineDrag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onEnd: ({ current }) => {
      const target = lineTarget;
      setLineTarget(null);
      setLinePreview(null);
      setAreaPreview(null);
      if (!target) return;
      if (target.kind === 'dot-line') {
        const at = splitAtFromPoint(
          rect,
          current,
          target.orientation,
          target.orientation === 'rows' ? rows : cols,
        );
        if (at !== null) dispatch({ type: 'set-split-line', orientation: target.orientation, at });
        return;
      }
      if (target.kind === 'split') {
        const count = target.orientation === 'rows' ? state.rows : state.cols;
        const at = splitAtFromPoint(rect, current, target.orientation, count);
        if (at === null) return;
        dispatch({ type: 'remove-split', index: target.index });
        dispatch({ type: 'place-split', orientation: target.orientation, at });
        return;
      }
      const count = target.side === 'a' ? state.settings.a : state.settings.b;
      const at = areaSplitAtFromPoint(
        areaRect(state.settings.a, state.settings.b),
        current,
        target.side,
        count,
      );
      if (at === null) return;
      dispatch({ type: 'remove-area-split', side: target.side, at: target.at });
      dispatch({ type: 'set-area-split', side: target.side, at });
    },
  });

  const startResize = (event: ReactPointerEvent<SVGElement>) => {
    if (readOnly) return;
    event.stopPropagation();
    resizeTarget.current = true;
    resizeDrag.handlers.onPointerDown(event);
  };

  const startLine = (event: ReactPointerEvent<SVGElement>, target: LineTarget) => {
    if (readOnly) return;
    event.stopPropagation();
    setLineTarget(target);
    lineDrag.handlers.onPointerDown(event);
  };

  const stepResize = (dRows: number, dCols: number) => {
    if (readOnly) return;
    dispatch({
      type: 'resize',
      rows: clamp(state.rows + dRows, 0, state.settings.maxRows),
      cols: clamp(state.cols + dCols, 0, state.settings.maxCols),
    });
  };

  const moveSplit = (target: LineTarget, delta: number) => {
    if (readOnly) return;
    if (target.kind === 'dot-line') {
      const count = target.orientation === 'rows' ? state.rows : state.cols;
      const at = clamp(target.at + delta, 1, Math.max(1, count - 1));
      dispatch({ type: 'set-split-line', orientation: target.orientation, at });
      return;
    }
    if (target.kind === 'split') {
      const count = target.orientation === 'rows' ? state.rows : state.cols;
      const at = clamp(target.at + delta, 1, Math.max(1, count - 1));
      dispatch({ type: 'remove-split', index: target.index });
      dispatch({ type: 'place-split', orientation: target.orientation, at });
      return;
    }
    const count = target.side === 'a' ? state.settings.a : state.settings.b;
    const at = clamp(target.at + delta, 1, Math.max(1, count - 1));
    dispatch({ type: 'remove-area-split', side: target.side, at: target.at });
    dispatch({ type: 'set-area-split', side: target.side, at });
  };

  const addSplit = (orientation: SplitOrientation) => {
    if (readOnly) return;
    const at = defaultSplitAt(state, orientation);
    dispatch({ type: 'place-split', orientation, at });
  };

  const addAreaSplit = (side: 'a' | 'b') => {
    if (readOnly) return;
    const count = side === 'a' ? state.settings.a : state.settings.b;
    const existing = side === 'a' ? state.areaSplitsA : state.areaSplitsB;
    const placeValue =
      side === 'a'
        ? state.settings.splitA === 'place-value'
        : state.settings.splitB === 'place-value';
    const candidates = placeValue
      ? boundariesFor(count, [], 'rows').slice(1, -1)
      : [Math.floor(count / 2)];
    const at = [...candidates, Math.floor(count / 2)].find(
      (candidate) => candidate >= 1 && candidate <= count - 1 && !existing.includes(candidate),
    );
    if (at === undefined) {
      shake(`area-${side}`);
      return;
    }
    dispatch({ type: 'set-area-split', side, at });
  };

  const openEntry = (r: number, c: number) => {
    if (readOnly) return;
    const current = state.cells[`${r},${c}`];
    setEntry({ r, c, text: current === undefined ? '' : String(current) });
  };

  const commitEntry = () => {
    if (!entry) return;
    const text = entry.text.trim();
    if (text === '') {
      dispatch({ type: 'set-cell', r: entry.r, c: entry.c, value: null });
    } else {
      dispatch({ type: 'set-cell', r: entry.r, c: entry.c, value: Number(text) });
    }
    setEntry(null);
  };

  const cellAction = (r: number, c: number) => {
    if (readOnly) return;
    if (paintColor !== null) {
      dispatch({ type: 'paint', r, c, color: paintColor });
      return;
    }
    if (selectMode) {
      dispatch({ type: 'select-cell', r, c });
      return;
    }
    openEntry(r, c);
  };

  const focusCell = (r: number, c: number) => {
    const table = tableRect(
      state.settings.tableRows,
      state.settings.tableCols,
      state.settings.includeZero,
    );
    const start = table.start;
    const nextR = clamp(r, start, state.settings.tableRows);
    const nextC = clamp(c, start, state.settings.tableCols);
    const node = document.querySelector<SVGGElement>(`[data-cell="${nextR},${nextC}"]`);
    node?.focus();
  };

  const onCellKeyDown = (event: ReactKeyboardEvent<SVGGElement>, r: number, c: number) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      if (key === 'ArrowUp') focusCell(r - 1, c);
      if (key === 'ArrowDown') focusCell(r + 1, c);
      if (key === 'ArrowLeft') focusCell(r, c - 1);
      if (key === 'ArrowRight') focusCell(r, c + 1);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      cellAction(r, c);
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'set-cell', r, c, value: null });
      return;
    }
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      const current = state.cells[`${r},${c}`];
      const base =
        entry && entry.r === r && entry.c === c
          ? entry.text
          : current === undefined
            ? ''
            : String(current);
      setEntry({ r, c, text: `${base}${key}`.slice(0, 2) });
    }
  };

  const renderDotArray = () => {
    const arrayRows = rows;
    const arrayCols = cols;
    const handle = resizeHandle(rect);
    const showSentence = state.settings.showSentence === 'dims' && arrayRows > 0 && arrayCols > 0;

    return (
      <>
        <rect
          x={rect.x}
          y={rect.y}
          width={Math.max(rect.width, rect.cell)}
          height={Math.max(rect.height, rect.cell)}
          rx={10}
          fill="#ffffff"
          stroke="#d7deea"
          strokeWidth={2}
          strokeDasharray={arrayRows === 0 || arrayCols === 0 ? '10 7' : undefined}
        />
        {Array.from({ length: arrayRows }, (_, row) =>
          Array.from({ length: arrayCols }, (_, col) => {
            const point = cellCenter(rect, row, col);
            return iconGlyph(
              state.settings.icon,
              point.x,
              point.y,
              Math.max(6, rect.cell * 0.3),
              `icon-${row}-${col}`,
            );
          }),
        )}

        {state.settings.showSplitLines && state.splitLine ? (
          <g
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={S.splitLine(state.splitLine.orientation, state.splitLine.at)}
            className={styles.line}
            onPointerDown={(event) =>
              startLine(event, {
                kind: 'dot-line',
                orientation: state.splitLine?.orientation ?? 'rows',
                at: state.splitLine?.at ?? 1,
              })
            }
            onKeyDown={(event) => {
              const target: LineTarget = {
                kind: 'dot-line',
                orientation: state.splitLine?.orientation ?? 'rows',
                at: state.splitLine?.at ?? 1,
              };
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveSplit(target, -1);
              } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveSplit(target, 1);
              }
            }}
          >
            {(() => {
              const segment = splitSegment(rect, state.splitLine.orientation, state.splitLine.at);
              return (
                <>
                  <line
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    stroke={SELECT}
                    strokeWidth={3}
                    strokeDasharray="10 6"
                    pointerEvents="none"
                  />
                  <line
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    stroke="transparent"
                    strokeWidth={hitRadius * 2}
                  />
                </>
              );
            })()}
          </g>
        ) : null}

        {linePreview && linePreview.orientation === (state.splitLine?.orientation ?? 'rows') ? (
          <line
            x1={splitSegment(rect, linePreview.orientation, linePreview.at).x1}
            y1={splitSegment(rect, linePreview.orientation, linePreview.at).y1}
            x2={splitSegment(rect, linePreview.orientation, linePreview.at).x2}
            y2={splitSegment(rect, linePreview.orientation, linePreview.at).y2}
            stroke={BLUE}
            strokeWidth={2}
            strokeDasharray="8 6"
            pointerEvents="none"
          />
        ) : null}

        <g
          role="button"
          tabIndex={readOnly ? -1 : 0}
          aria-label={S.handle}
          className={styles.handle}
          onPointerDown={startResize}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              stepResize(1, 0);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              stepResize(-1, 0);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              stepResize(0, 1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              stepResize(0, -1);
            }
          }}
        >
          <circle cx={handle.x} cy={handle.y} r={hitRadius} fill="transparent" />
          <circle cx={handle.x} cy={handle.y} r={10} fill={BLUE} stroke="#ffffff" strokeWidth={2} />
          <line
            x1={handle.x + 4}
            y1={handle.y - 9}
            x2={handle.x + 9}
            y2={handle.y - 4}
            stroke="#ffffff"
            strokeWidth={2}
            pointerEvents="none"
          />
        </g>

        {showSentence ? (
          <text x={rect.x} y={rect.y - 16} fontSize={20} fontWeight={700} fill={INK}>
            {S.sentence(arrayRows, arrayCols)}
          </text>
        ) : null}

        {state.settings.factFamily && arrayRows > 0 && arrayCols > 0 ? (
          <g pointerEvents="none">
            <polygon
              points="790,180 960,420 620,420"
              fill="#eef4ff"
              stroke={BLUE}
              strokeWidth={2}
            />
            <text x={790} y={176} textAnchor="middle" fontSize={20} fontWeight={700} fill={INK}>
              {state.settings.factHide === 'product' ? S.hidden : String(arrayRows * arrayCols)}
            </text>
            <text x={624} y={446} textAnchor="middle" fontSize={20} fontWeight={700} fill={INK}>
              {state.settings.factHide === 'rows' ? S.hidden : String(arrayRows)}
            </text>
            <text x={956} y={446} textAnchor="middle" fontSize={20} fontWeight={700} fill={INK}>
              {state.settings.factHide === 'cols' ? S.hidden : String(arrayCols)}
            </text>
            <text x={790} y={470} textAnchor="middle" fontSize={14} fill={MUTED}>
              {S.factTitle}
            </text>
          </g>
        ) : null}
      </>
    );
  };

  const renderSplit = () => {
    const splitRect = arrayRect(
      state.rows,
      state.cols,
      state.settings.maxRows,
      state.settings.maxCols,
    );
    const rowBounds = boundariesFor(state.rows, state.splits, 'rows');
    const colBounds = boundariesFor(state.cols, state.splits, 'cols');
    const pieces = splitPieceRects(
      splitRect,
      state.rows,
      state.cols,
      rowBounds,
      colBounds,
      state.extendedRows,
    );
    // 분할이 없으면 조각 라벨(크기·곱)을 쓰지 않는다 — 전체 곱 노출 금지.
    const showPartials =
      state.splits.length === 0 && state.extendedRows === 0 ? 'none' : state.settings.showPartials;

    return (
      <>
        <rect
          x={splitRect.x}
          y={splitRect.y}
          width={Math.max(0, splitRect.width)}
          height={Math.max(0, splitRect.height)}
          rx={8}
          fill="#ffffff"
          stroke="#d7deea"
          strokeWidth={2}
        />
        {Array.from({ length: state.rows }, (_, row) =>
          Array.from({ length: state.cols }, (_, col) => {
            const point = cellCenter(splitRect, row, col);
            return iconGlyph(
              'dot',
              point.x,
              point.y,
              Math.max(5, splitRect.cell * 0.26),
              `dot-${row}-${col}`,
            );
          }),
        )}
        {Array.from({ length: state.extendedRows }, (_, extraRow) =>
          Array.from({ length: state.cols }, (_, col) => {
            const point = {
              x: splitRect.x + (col + 0.5) * splitRect.cell,
              y: splitRect.y + (state.rows + extraRow + 0.5) * splitRect.cell,
            };
            return (
              <circle
                key={`ext-${extraRow}-${col}`}
                cx={point.x}
                cy={point.y}
                r={Math.max(3, splitRect.cell * 0.16)}
                fill={NEGATIVE}
                fillOpacity={0.28}
                pointerEvents="none"
              />
            );
          }),
        )}
        {pieces.map((piece, index) => (
          <PieceShape
            key={`piece-${index}`}
            piece={piece}
            index={index}
            show={showPartials}
            negative={piece.sign === -1}
          />
        ))}

        {state.splits.map((split, index) => {
          const segment = splitSegment(splitRect, split.orientation, split.at);
          return (
            <g
              key={`split-${split.orientation}-${split.at}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={S.splitLine(split.orientation, split.at)}
              className={styles.line}
              data-split-index={index}
              onPointerDown={(event) =>
                startLine(event, {
                  kind: 'split',
                  orientation: split.orientation,
                  at: split.at,
                  index,
                })
              }
              onKeyDown={(event) => {
                const target: LineTarget = {
                  kind: 'split',
                  orientation: split.orientation,
                  at: split.at,
                  index,
                };
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveSplit(target, -1);
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveSplit(target, 1);
                } else if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault();
                  dispatch({ type: 'remove-split', index });
                }
              }}
            >
              <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={BLUE}
                strokeWidth={3}
                pointerEvents="none"
              />
              <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke="transparent"
                strokeWidth={hitRadius * 2}
              />
            </g>
          );
        })}
      </>
    );
  };

  const renderAreaModel = () => {
    const area = areaRect(state.settings.a, state.settings.b);
    const pieces = areaPieceRects(
      area,
      state.settings.a,
      state.settings.b,
      state.areaSplitsA,
      state.areaSplitsB,
    );
    const dense = state.settings.a * state.settings.b > GRID_LIMIT;
    const showGrid =
      state.settings.showGrid === 'always' || (state.settings.showGrid === 'C-only' && cpa === 'C');
    // 분할이 없으면 조각 라벨(크기·곱)을 쓰지 않는다 — 전체 곱 노출 금지.
    const showPartials =
      state.areaSplitsA.length === 0 && state.areaSplitsB.length === 0
        ? 'none'
        : state.settings.showPartials;

    return (
      <>
        <rect
          x={area.x}
          y={area.y}
          width={area.width}
          height={area.height}
          fill="#ffffff"
          stroke="#33415c"
          strokeWidth={2.4}
        />
        {showGrid ? (
          <AreaPieceGrid rect={area} a={state.settings.a} b={state.settings.b} thick={dense} />
        ) : null}
        {pieces.map((piece, index) => (
          <PieceShape
            key={`area-piece-${index}`}
            piece={piece}
            index={index}
            show={showPartials}
            negative={false}
            order="cols-rows"
          />
        ))}

        {state.areaSplitsA.map((at) => {
          const x = areaX(area, state.settings.a, at);
          return (
            <g
              key={`area-a-${at}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={S.areaSplitLine('a', at)}
              className={styles.line}
              onPointerDown={(event) => startLine(event, { kind: 'area', side: 'a', at })}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveSplit({ kind: 'area', side: 'a', at }, -1);
                } else if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveSplit({ kind: 'area', side: 'a', at }, 1);
                } else if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault();
                  dispatch({ type: 'remove-area-split', side: 'a', at });
                }
              }}
            >
              <line
                x1={x}
                y1={area.y}
                x2={x}
                y2={area.y + area.height}
                stroke={BLUE}
                strokeWidth={3}
                pointerEvents="none"
              />
              <line
                x1={x}
                y1={area.y}
                x2={x}
                y2={area.y + area.height}
                stroke="transparent"
                strokeWidth={hitRadius * 2}
              />
            </g>
          );
        })}
        {state.areaSplitsB.map((at) => {
          const y = areaY(area, state.settings.b, at);
          return (
            <g
              key={`area-b-${at}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={S.areaSplitLine('b', at)}
              className={styles.line}
              onPointerDown={(event) => startLine(event, { kind: 'area', side: 'b', at })}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveSplit({ kind: 'area', side: 'b', at }, -1);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveSplit({ kind: 'area', side: 'b', at }, 1);
                } else if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault();
                  dispatch({ type: 'remove-area-split', side: 'b', at });
                }
              }}
            >
              <line
                x1={area.x}
                y1={y}
                x2={area.x + area.width}
                y2={y}
                stroke={BLUE}
                strokeWidth={3}
                pointerEvents="none"
              />
              <line
                x1={area.x}
                y1={y}
                x2={area.x + area.width}
                y2={y}
                stroke="transparent"
                strokeWidth={hitRadius * 2}
              />
            </g>
          );
        })}

        {areaPreview?.side === 'a' ? (
          <line
            x1={areaX(area, state.settings.a, areaPreview.at)}
            y1={area.y}
            x2={areaX(area, state.settings.a, areaPreview.at)}
            y2={area.y + area.height}
            stroke={SELECT}
            strokeWidth={2}
            strokeDasharray="8 6"
            pointerEvents="none"
          />
        ) : null}
        {areaPreview?.side === 'b' ? (
          <line
            x1={area.x}
            y1={areaY(area, state.settings.b, areaPreview.at)}
            x2={area.x + area.width}
            y2={areaY(area, state.settings.b, areaPreview.at)}
            stroke={SELECT}
            strokeWidth={2}
            strokeDasharray="8 6"
            pointerEvents="none"
          />
        ) : null}

        <text
          x={area.x + area.width / 2}
          y={area.y - 18}
          textAnchor="middle"
          fontSize={18}
          fill={MUTED}
        >
          {`${S.areaWidth} ${state.settings.a}`}
        </text>
        <text
          x={area.x - 18}
          y={area.y + area.height / 2}
          textAnchor="middle"
          fontSize={18}
          fill={MUTED}
          transform={`rotate(-90 ${area.x - 18} ${area.y + area.height / 2})`}
        >
          {`${S.areaHeight} ${state.settings.b}`}
        </text>
      </>
    );
  };

  const renderTable = () => {
    const table = tableRect(
      state.settings.tableRows,
      state.settings.tableCols,
      state.settings.includeZero,
    );
    const start = table.start;
    const rowValues = Array.from(
      { length: state.settings.tableRows - start + 1 },
      (_, index) => start + index,
    );
    const colValues = Array.from(
      { length: state.settings.tableCols - start + 1 },
      (_, index) => start + index,
    );
    const line = diagonalSegment(table);

    return (
      <>
        <rect
          x={table.x}
          y={table.y}
          width={table.header + colValues.length * table.cell}
          height={table.header + rowValues.length * table.cell}
          fill="#ffffff"
          stroke="#d7deea"
          strokeWidth={2}
        />
        {colValues.map((value, index) => (
          <text
            key={`col-${value}`}
            x={table.x + table.header + (index + 0.5) * table.cell}
            y={table.y + table.header / 2 + 6}
            textAnchor="middle"
            fontSize={Math.min(18, table.cell * 0.5)}
            fontWeight={700}
            fill={MUTED}
          >
            {value}
          </text>
        ))}
        {rowValues.map((value, index) => (
          <text
            key={`row-${value}`}
            x={table.x + table.header / 2}
            y={table.y + table.header + (index + 0.5) * table.cell + 6}
            textAnchor="middle"
            fontSize={Math.min(18, table.cell * 0.5)}
            fontWeight={700}
            fill={MUTED}
          >
            {value}
          </text>
        ))}

        {state.folded ? (
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={SELECT}
            strokeWidth={3}
            strokeDasharray="9 6"
            pointerEvents="none"
          />
        ) : null}

        {rowValues.map((r) =>
          colValues.map((c) => {
            const key = `${r},${c}`;
            const cell = tableCellRect(table, r, c);
            const written = state.cells[key];
            const paintedIndex = state.painted[key];
            const palette =
              paintedIndex === undefined
                ? undefined
                : PARTIAL_PALETTE[paintedIndex % PARTIAL_PALETTE.length];
            const selected = state.selected.includes(key);
            const hidden = state.folded && c < r;
            return (
              <g
                key={`cell-${key}`}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.tableCell(r, c)}
                aria-pressed={selected}
                data-cell={key}
                data-flash={state.flash === key ? 'true' : undefined}
                data-hidden={hidden ? 'true' : undefined}
                className={styles.cell}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => cellAction(r, c)}
                onKeyDown={(event) => onCellKeyDown(event, r, c)}
              >
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={cell.width}
                  height={cell.height}
                  fill={palette ? palette.fill : '#ffffff'}
                  fillOpacity={hidden ? 0.15 : 1}
                  stroke={selected ? SELECT : '#d7deea'}
                  strokeWidth={selected ? 3 : 1.2}
                />
                {paintedIndex !== undefined ? (
                  <rect
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    fill={`url(#e04-pattern-${paintedIndex % PARTIAL_PALETTE.length})`}
                    fillOpacity={hidden ? 0.08 : 0.7}
                    pointerEvents="none"
                  />
                ) : null}
                {written !== undefined ? (
                  <text
                    x={cell.x + cell.width / 2}
                    y={cell.y + cell.height / 2 + 6}
                    textAnchor="middle"
                    fontSize={Math.min(20, table.cell * 0.52)}
                    fontWeight={700}
                    fill={INK}
                    fillOpacity={hidden ? 0.2 : 1}
                    pointerEvents="none"
                  >
                    {written}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
      </>
    );
  };

  const mode = state.mode;
  const table = tableRect(
    state.settings.tableRows,
    state.settings.tableCols,
    state.settings.includeZero,
  );

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {mode === 'dot-array' ? (
          <>
            <div className={styles.group}>
              <span className={styles.groupLabel}>{S.rows}</span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.removeRow}
                onClick={() => stepResize(-1, 0)}
                disabled={readOnly || state.rows <= 0}
              >
                −
              </button>
              <span className={styles.count} data-testid="row-count">
                {state.rows}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.addRow}
                onClick={() => stepResize(1, 0)}
                disabled={readOnly || state.rows >= state.settings.maxRows}
              >
                +
              </button>
            </div>
            <div className={styles.group}>
              <span className={styles.groupLabel}>{S.cols}</span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.removeCol}
                onClick={() => stepResize(0, -1)}
                disabled={readOnly || state.cols <= 0}
              >
                −
              </button>
              <span className={styles.count} data-testid="col-count">
                {state.cols}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.addCol}
                onClick={() => stepResize(0, 1)}
                disabled={readOnly || state.cols >= state.settings.maxCols}
              >
                +
              </button>
            </div>
            {state.settings.rotate ? (
              <button
                type="button"
                className={styles.button}
                onClick={() => dispatch({ type: 'rotate' })}
                disabled={readOnly || state.rows === 0 || state.cols === 0}
              >
                {S.rotate}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'record-arrangement' })}
              disabled={readOnly || state.rows === 0 || state.cols === 0}
            >
              {S.recordArrangement}
            </button>
            {state.recorded.length > 0 ? (
              <span className={styles.badge} data-testid="recorded-badge">
                {S.recorded(state.recorded.length)}
              </span>
            ) : null}
          </>
        ) : null}

        {mode === 'split' ? (
          <>
            <button
              type="button"
              className={styles.button}
              onClick={() => addSplit('rows')}
              disabled={readOnly || !canPlaceSplit(state, 'rows')}
            >
              {S.addSplit('rows')}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => addSplit('cols')}
              disabled={readOnly || !canPlaceSplit(state, 'cols')}
            >
              {S.addSplit('cols')}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'record-split' })}
              disabled={readOnly || state.splits.length === 0}
            >
              {S.recordSplit}
            </button>
            {state.settings.allowExtend ? (
              <div className={styles.group}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={S.extend}
                  onClick={() => dispatch({ type: 'extend', rows: state.extendedRows + 1 })}
                  disabled={readOnly}
                >
                  +
                </button>
                <span className={styles.count} data-testid="extended-count">
                  {state.extendedRows}
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={S.shrink}
                  onClick={() => dispatch({ type: 'extend', rows: state.extendedRows - 1 })}
                  disabled={readOnly || state.extendedRows <= 0}
                >
                  −
                </button>
              </div>
            ) : null}
            {state.recordedSplits.length > 0 ? (
              <span className={styles.badge} data-testid="recorded-splits-badge">
                {S.recordedSplits(state.recordedSplits.length)}
              </span>
            ) : null}
          </>
        ) : null}

        {mode === 'area-model' ? (
          <>
            <button
              type="button"
              className={styles.button}
              onClick={() => addAreaSplit('a')}
              disabled={
                readOnly || state.settings.splitA === 'none' || state.areaSplitsA.length >= 3
              }
            >
              {S.addAreaSplitA}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => addAreaSplit('b')}
              disabled={
                readOnly || state.settings.splitB === 'none' || state.areaSplitsB.length >= 3
              }
            >
              {S.addAreaSplitB}
            </button>
            {state.settings.showGrid === 'never' ? null : (
              <span className={styles.hint}>
                {state.settings.a * state.settings.b > GRID_LIMIT ? S.gridHidden : ''}
              </span>
            )}
          </>
        ) : null}

        {mode === 'times-table' ? (
          <>
            <button
              type="button"
              className={styles.button}
              aria-pressed={selectMode}
              onClick={() => {
                setSelectMode((current) => !current);
                setPaintColor(null);
              }}
              disabled={readOnly}
            >
              {selectMode ? S.selecting : S.selectMode}
            </button>
            <div className={styles.group} role="group" aria-label={S.paintMode}>
              {PARTIAL_PALETTE.map((entry, index) => (
                <button
                  key={`paint-${index}`}
                  type="button"
                  className={styles.swatch}
                  style={{ background: entry.fill, borderColor: entry.ink }}
                  aria-label={S.paintColor(index)}
                  aria-pressed={paintColor === index}
                  onClick={() => {
                    setPaintColor((current) => (current === index ? null : index));
                    setSelectMode(false);
                  }}
                  disabled={readOnly || !state.settings.colorSameValue}
                />
              ))}
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.eraseColor}
                onClick={() => setPaintColor(null)}
                disabled={readOnly || !state.settings.colorSameValue}
              >
                ×
              </button>
            </div>
            <button
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'fold' })}
              disabled={readOnly}
            >
              {state.folded ? S.unfold : S.fold}
            </button>
            {entry ? (
              <span className={styles.badge} data-testid="entry-badge">
                {S.tableInput(entry.text)}
              </span>
            ) : null}
          </>
        ) : null}

        <span className={styles.hint} data-testid="mode-hint">
          {mode === 'dot-array' ? S.handleHint : mode === 'split' ? S.splitHint : ''}
        </span>
      </div>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel}
          data-testid="array-canvas"
          data-cpa={cpa}
          onPointerMove={(event) => {
            resizeDrag.handlers.onPointerMove(event);
            lineDrag.handlers.onPointerMove(event);
            if (resizeTarget.current) {
              const base = arrayRect(
                state.rows,
                state.cols,
                state.settings.maxRows,
                state.settings.maxCols,
              );
              setDraft({
                rows: rowsFromPoint(base, toPoint(event), state.settings.maxRows),
                cols: colsFromPoint(base, toPoint(event), state.settings.maxCols),
              });
            }
            const target = lineTarget;
            if (target) {
              const point = toPoint(event);
              if (target.kind === 'dot-line') {
                const count = target.orientation === 'rows' ? rows : cols;
                const at = splitAtFromPoint(rect, point, target.orientation, count);
                if (at !== null) setLinePreview({ orientation: target.orientation, at });
              } else if (target.kind === 'split') {
                const count = target.orientation === 'rows' ? state.rows : state.cols;
                const at = splitAtFromPoint(rect, point, target.orientation, count);
                if (at !== null) setLinePreview({ orientation: target.orientation, at });
              } else {
                const count = target.side === 'a' ? state.settings.a : state.settings.b;
                const at = areaSplitAtFromPoint(
                  areaRect(state.settings.a, state.settings.b),
                  point,
                  target.side,
                  count,
                );
                if (at !== null) setAreaPreview({ side: target.side, at });
              }
            }
          }}
          onPointerUp={(event) => {
            resizeDrag.handlers.onPointerUp(event);
            lineDrag.handlers.onPointerUp(event);
          }}
          onPointerCancel={(event) => {
            resizeDrag.handlers.onPointerCancel(event);
            lineDrag.handlers.onPointerCancel(event);
            resetDraft();
            setDraft(null);
          }}
        >
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
          <PartialPatterns />
          {mode === 'dot-array' ? renderDotArray() : null}
          {mode === 'split' ? renderSplit() : null}
          {mode === 'area-model' ? renderAreaModel() : null}
          {mode === 'times-table' ? renderTable() : null}

          {shakeKey ? (
            <g pointerEvents="none" data-testid="shake-badge">
              <rect
                x={table.x}
                y={table.y - 46}
                width={220}
                height={34}
                rx={10}
                fill="#fff3e0"
                stroke={SELECT}
              />
              <text
                x={table.x + 110}
                y={table.y - 23}
                textAnchor="middle"
                fontSize={15}
                fill="#8a4b00"
              >
                {S.splitHint}
              </text>
            </g>
          ) : null}
        </svg>

        {state.settings.shelf ? (
          <section className={styles.factorShelf} data-testid="factor-shelf" aria-label={S.shelf}>
            <h3 className={styles.factorShelfTitle}>{S.shelf}</h3>
            {state.recorded.length === 0 ? (
              <p className={styles.factorShelfEmpty}>{S.shelfEmpty}</p>
            ) : (
              <ul className={styles.factorShelfList}>
                {state.recorded.map((item) => (
                  <li key={`shelf-${item.rows}-${item.cols}`}>
                    {S.shelfRecorded(item.rows, item.cols)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      {entry ? (
        <div className={styles.keypad} role="group" aria-label={S.tableKeypad}>
          {Array.from({ length: 10 }, (_, digit) => (
            <button
              key={`key-${digit}`}
              type="button"
              className={styles.key}
              aria-label={S.tableDigit(digit)}
              onClick={() =>
                setEntry((current) =>
                  current ? { ...current, text: `${current.text}${digit}`.slice(0, 2) } : current,
                )
              }
            >
              {digit}
            </button>
          ))}
          <button type="button" className={styles.key} onClick={commitEntry}>
            {S.tableConfirm}
          </button>
          <button
            type="button"
            className={styles.key}
            onClick={() => setEntry((current) => (current ? { ...current, text: '' } : current))}
          >
            {S.tableClear}
          </button>
          <button type="button" className={styles.key} onClick={() => setEntry(null)}>
            {S.tableClose}
          </button>
        </div>
      ) : null}

      <p className={styles.instructions}>{S.instructions[mode]}</p>
    </div>
  );
}

/** 모드에 따라 화면을 고르기만 한다. 새 화면은 `views/`에 있다. */
export function ArrayAreaView(
  props: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>,
) {
  const { state } = props;
  if (state.mode === 'tiling') return <TilingView {...props} />;
  if (state.mode === 'decimal-area') return <DecimalAreaView {...props} />;
  if (state.mode === 'fraction-area') {
    return state.settings.variant === 'scaler' ? (
      <ScalerView {...props} />
    ) : (
      <FractionAreaView {...props} />
    );
  }
  if (state.mode === 'area-model' && state.settings.puzzle !== null) {
    return <PuzzleView {...props} />;
  }
  return <SquareArrayView {...props} />;
}
