/**
 * E01 수 모형 화면.
 *
 * - 모든 포인터 위치는 SDK `pointerToLogical`로만 논리 좌표로 바꾼다.
 * - 블록은 끌어 옮기고, 두 번 톡 누르거나 골라서 "풀기"로 상위 블록을 푼다.
 * - 올가미는 SDK `useLasso`로 그리고, 고른 블록 ID만 Action에 담는다.
 * - 기본 설정에서는 나타내는 수를 화면에 숫자로 쓰지 않는다(카드 결정 15).
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  distance,
  minTouchRadius,
  pointerToLogical,
  selectInside,
  useDrag,
  useLasso,
  useRenderedSize,
} from '../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../core/engine-sdk';
import {
  ADD_A,
  ADD_B,
  ADD_SUM,
  bandsFor,
  blockRect,
  boxSlotRect,
  defaultDropPoint,
  inRect,
  STRIP,
  SUB_A,
  SUB_TAKE,
  TOOLBOX_RECT,
  TRASH_RECT,
  zoneAt,
} from './layout';
import type { Rect } from './layout';
import { canGroupTens } from './reduce';
import { baseTenStrings as S } from './strings.ko';
import { BUNDLE_THRESHOLD, DEFAULT_CHART_LABELS, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type {
  BaseTenAction,
  BaseTenBlock,
  BaseTenConfig,
  BaseTenState,
  BaseTenIcon,
  BlockValue,
  Zone,
} from './types';
import { canTake, columnNameOf, countsForColumn, placeCountOf } from './value';
import styles from './View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const TAP_SLOP = 8;
const KEY_STEP = 18;
const DOUBLE_TAP_MS = 450;

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#5b6577';
const SELECT = '#e8872e';
const BLUE = '#2f6fde';

interface BlockPalette {
  readonly top: string;
  readonly front: string;
  readonly side: string;
  readonly ink: string;
}

const PALETTE: Readonly<Record<BlockValue, BlockPalette>> = {
  1: { top: '#ffe6a3', front: '#f2b53c', side: '#d99a22', ink: '#8a5c00' },
  10: { top: '#a9cdf2', front: '#5b9bd5', side: '#3f7cb3', ink: '#1d4fa8' },
  100: { top: '#b3e4b8', front: '#6fbf73', side: '#4f9c55', ink: '#215c2a' },
  1000: { top: '#d6c5f7', front: '#9b7ede', side: '#7a5cbd', ink: '#3f2a7a' },
};

type RenderKind = 'isometric' | 'flat' | 'table';

function renderKindOf(config: BaseTenConfig, state: BaseTenState, cpa: string): RenderKind {
  const setting = config.render ?? state.settings.render;
  if (setting !== 'auto') return setting;
  if (cpa === 'C') return 'isometric';
  if (cpa === 'P') return 'flat';
  return 'table';
}

function chartLabelOf(config: BaseTenConfig, column: number): string {
  const name = columnNameOf(column);
  if (name === null) return '';
  return config.chartLabels?.[name] ?? DEFAULT_CHART_LABELS[name];
}

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(' ');
}

function IconGlyph({
  icon,
  cx,
  cy,
  size,
}: {
  readonly icon: BaseTenIcon;
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
}) {
  if (icon === 'star') {
    return (
      <polygon
        points={starPoints(cx, cy, size * 0.52, size * 0.24)}
        fill="#fffaf0"
        stroke="#8a5c00"
        strokeWidth={1.4}
        pointerEvents="none"
      />
    );
  }
  return (
    <g pointerEvents="none">
      <rect
        x={cx - size * 0.3}
        y={cy - size * 0.2}
        width={size * 0.6}
        height={size * 0.4}
        rx={size * 0.16}
        fill="#fffaf0"
        stroke="#8a5c00"
        strokeWidth={1.4}
      />
      <polygon
        points={`${cx - size * 0.3},${cy - size * 0.2} ${cx - size * 0.5},${cy - size * 0.36} ${cx - size * 0.5},${cy + size * 0.36}`}
        fill="#fffaf0"
        stroke="#8a5c00"
        strokeWidth={1.2}
      />
      <polygon
        points={`${cx + size * 0.3},${cy - size * 0.2} ${cx + size * 0.5},${cy - size * 0.36} ${cx + size * 0.5},${cy + size * 0.36}`}
        fill="#fffaf0"
        stroke="#8a5c00"
        strokeWidth={1.2}
      />
    </g>
  );
}

function GridLines({
  x,
  y,
  width,
  height,
  count,
  color,
}: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly count: number;
  readonly color: string;
}) {
  return (
    <g pointerEvents="none" stroke={color} strokeWidth={1} strokeOpacity={0.55}>
      {Array.from({ length: count - 1 }, (_, index) => (
        <line
          key={`v-${index}`}
          x1={x + (width * (index + 1)) / count}
          y1={y}
          x2={x + (width * (index + 1)) / count}
          y2={y + height}
        />
      ))}
      {Array.from({ length: count - 1 }, (_, index) => (
        <line
          key={`h-${index}`}
          x1={x}
          y1={y + (height * (index + 1)) / count}
          x2={x + width}
          y2={y + (height * (index + 1)) / count}
        />
      ))}
    </g>
  );
}

function FlatBlock({
  block,
  icon,
  simple,
}: {
  readonly block: BaseTenBlock;
  readonly icon: BaseTenIcon | null;
  readonly simple: boolean;
}) {
  const palette = PALETTE[block.value];
  const rect = blockRect(block);
  const segments = block.value === 10 ? 10 : 0;
  return (
    <g pointerEvents="none">
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={block.value === 1 ? 5 : 3}
        fill={palette.front}
        stroke={palette.ink}
        strokeWidth={block.value === 1000 ? 2.6 : 1.6}
      />
      {!simple && segments > 0 ? (
        <GridLines
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          count={segments}
          color={palette.ink}
        />
      ) : null}
      {!simple && block.value >= 100 ? (
        <GridLines
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          count={10}
          color={palette.ink}
        />
      ) : null}
      {icon !== null && block.value === 1 ? (
        <IconGlyph icon={icon} cx={block.x} cy={block.y} size={rect.width} />
      ) : null}
    </g>
  );
}

function IsometricBlock({
  block,
  icon,
  simple,
}: {
  readonly block: BaseTenBlock;
  readonly icon: BaseTenIcon | null;
  readonly simple: boolean;
}) {
  const palette = PALETTE[block.value];
  const rect = blockRect(block);
  const depth = block.value === 1 ? 5 : 8;
  const front = {
    x: rect.x,
    y: rect.y + depth,
    width: rect.width - depth,
    height: rect.height - depth,
  };
  const top = `${rect.x},${rect.y + depth} ${rect.x + depth},${rect.y} ${rect.x + rect.width},${rect.y} ${rect.x + rect.width - depth},${rect.y + depth}`;
  const side = `${rect.x + rect.width - depth},${rect.y + depth} ${rect.x + rect.width},${rect.y} ${rect.x + rect.width},${rect.y + rect.height - depth} ${rect.x + rect.width - depth},${rect.y + rect.height}`;

  return (
    <g pointerEvents="none">
      <polygon points={top} fill={palette.top} stroke={palette.ink} strokeWidth={1.4} />
      <polygon points={side} fill={palette.side} stroke={palette.ink} strokeWidth={1.4} />
      <rect
        x={front.x}
        y={front.y}
        width={front.width}
        height={front.height}
        rx={block.value === 1 ? 4 : 2}
        fill={palette.front}
        stroke={palette.ink}
        strokeWidth={block.value === 1000 ? 2.4 : 1.5}
      />
      {!simple && block.value === 10 ? (
        <GridLines
          x={front.x}
          y={front.y}
          width={front.width}
          height={front.height}
          count={10}
          color={palette.ink}
        />
      ) : null}
      {!simple && block.value >= 100 ? (
        <GridLines
          x={front.x}
          y={front.y}
          width={front.width}
          height={front.height}
          count={10}
          color={palette.ink}
        />
      ) : null}
      {icon !== null && block.value === 1 ? (
        <IconGlyph icon={icon} cx={block.x} cy={block.y + 2} size={rect.width} />
      ) : null}
    </g>
  );
}

function ToolboxGlyph({ value, rect }: { readonly value: BlockValue; readonly rect: Rect }) {
  const palette = PALETTE[value];
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const width = value === 10 ? 16 : value === 1 ? 24 : 40;
  const height = value === 10 ? 44 : value === 1 ? 24 : 40;
  return (
    <g pointerEvents="none">
      <rect
        x={centerX - width / 2}
        y={centerY - height / 2}
        width={width}
        height={height}
        rx={3}
        fill={palette.front}
        stroke={palette.ink}
        strokeWidth={value === 1000 ? 2.4 : 1.4}
      />
      {value >= 100 ? (
        <GridLines
          x={centerX - width / 2}
          y={centerY - height / 2}
          width={width}
          height={height}
          count={5}
          color={palette.ink}
        />
      ) : null}
    </g>
  );
}

interface SnapRegion {
  readonly key: string;
  readonly rect: Rect;
  readonly showLabels: boolean;
}

function snapRegionsOf(state: BaseTenState): SnapRegion[] {
  if (state.mode === 'add-sub') {
    if (state.settings.op === 'add') {
      return [
        { key: 'a', rect: ADD_A, showLabels: false },
        { key: 'b', rect: ADD_B, showLabels: false },
        { key: 'sum', rect: ADD_SUM, showLabels: true },
      ];
    }
    return [
      { key: 'a', rect: SUB_A, showLabels: false },
      { key: 'take', rect: SUB_TAKE, showLabels: true },
    ];
  }
  if (state.settings.snapColumns) {
    return [{ key: 'strip', rect: STRIP, showLabels: true }];
  }
  return [];
}

function zoneRectsOf(state: BaseTenState): { zone: Zone; rect: Rect }[] {
  if (state.mode !== 'add-sub') return [];
  if (state.settings.op === 'add') {
    return [
      { zone: 'a', rect: ADD_A },
      { zone: 'b', rect: ADD_B },
      { zone: 'sum', rect: ADD_SUM },
    ];
  }
  return [
    { zone: 'a', rect: SUB_A },
    { zone: 'take', rect: SUB_TAKE },
  ];
}

export function BaseTenView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<BaseTenConfig, BaseTenState, BaseTenAction>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const measured = minTouchRadius(targetSize, rendered, LOGICAL);
  const hitPad = Math.max(6, Math.ceil(measured - 14));

  const [selected, setSelected] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [hiddenAttempt, setHiddenAttempt] = useState<BaseTenState['lastAttempt']>(null);
  const [chartTarget, setChartTarget] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [draggingCard, setDraggingCard] = useState<number | null>(null);

  const dragId = useRef<string | null>(null);
  const spawnValue = useRef<BlockValue | null>(null);
  const lastTap = useRef<{ id: string; time: number } | null>(null);
  const downTime = useRef(0);
  const suppressClick = useRef(false);

  const toPoint = (event: { readonly clientX: number; readonly clientY: number }): Point =>
    pointerToLogical(event, svgRef.current, LOGICAL);

  const selectedBlock = state.blocks.find((block) => block.id === selected) ?? null;

  // 실패 배지는 같은 시도에만 1.5초 보인다(시도가 바뀌면 다시 보인다).
  const attempt = state.lastAttempt;
  const attemptVisible = attempt !== null && !attempt.ok && attempt !== hiddenAttempt;
  useEffect(() => {
    if (!attempt || attempt.ok) return;
    const timer = window.setTimeout(() => setHiddenAttempt(attempt), 1500);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  const shake = (id: string) => {
    setShakeId(id);
    window.setTimeout(() => setShakeId((current) => (current === id ? null : current)), 450);
  };

  function tapBlock(id: string, time: number) {
    const block = state.blocks.find((item) => item.id === id);
    if (!block) return;
    const previous = lastTap.current;
    if (previous && previous.id === id && time - previous.time <= DOUBLE_TAP_MS) {
      lastTap.current = null;
      if (block.value > 1) dispatch({ type: 'break', id });
      return;
    }
    lastTap.current = { id, time };
    setSelected(id);
    setChartTarget(null);
  }

  const drag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onEnd: ({ start, current }) => {
      const id = dragId.current;
      dragId.current = null;
      if (!id) return;
      const block = state.blocks.find((item) => item.id === id);
      if (!block) return;
      if (distance(start, current) < TAP_SLOP) {
        tapBlock(id, downTime.current);
        return;
      }
      if (inRect(current, TRASH_RECT)) {
        dispatch({ type: 'remove', id });
        setSelected(null);
        return;
      }
      const zone = zoneAt(current, state);
      if (zone === 'take' && !canTake(state, block.value, block.id)) {
        shake(id);
        return;
      }
      dispatch({ type: 'move', id, x: current.x, y: current.y });
    },
  });

  const spawnDrag = useDrag({
    getPoint: toPoint,
    disabled: readOnly,
    onEnd: ({ start, current }) => {
      const value = spawnValue.current;
      spawnValue.current = null;
      if (value === null) return;
      const moved = distance(start, current) >= TAP_SLOP;
      if (moved && inRect(current, TRASH_RECT)) return;
      const point = moved ? current : defaultDropPoint(state, value);
      dispatch({ type: 'add', value, x: point.x, y: point.y });
    },
  });

  const lasso = useLasso({
    getPoint: toPoint,
    disabled: readOnly || !state.settings.lasso,
    onGesture: ({ points, isTap }) => {
      if (isTap) {
        setSelected(null);
        setChartTarget(null);
        return;
      }
      const inside = selectInside(points, state.blocks, (block) => ({
        x: block.x,
        y: block.y,
      }));
      if (inside.length === 0) return;
      dispatch({ type: 'lasso-group', ids: inside.map((block) => block.id) });
      setSelected(null);
    },
  });

  const moveBy = (id: string, dx: number, dy: number) => {
    const block = state.blocks.find((item) => item.id === id);
    if (!block) return;
    dispatch({
      type: 'move',
      id,
      x: Math.max(0, Math.min(LOGICAL_WIDTH, block.x + dx)),
      y: Math.max(0, Math.min(LOGICAL_HEIGHT, block.y + dy)),
    });
  };

  const onBlockKeyDown = (event: ReactKeyboardEvent<SVGGElement>, id: string) => {
    if (readOnly) return;
    const block = state.blocks.find((item) => item.id === id);
    if (!block) return;
    const step = KEY_STEP * (event.shiftKey ? 5 : 1);
    const key = event.key;
    if (key === 'ArrowLeft') {
      event.preventDefault();
      moveBy(id, -step, 0);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      moveBy(id, step, 0);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      moveBy(id, 0, -step);
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      moveBy(id, 0, step);
    } else if (key === 'Enter') {
      event.preventDefault();
      if (block.value > 1) dispatch({ type: 'break', id });
    } else if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      setSelected((current) => (current === id ? null : id));
    } else if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'remove', id });
      setSelected(null);
    } else if (key === 'g' || key === 'G') {
      event.preventDefault();
      dispatch({ type: 'group-tens' });
    }
  };

  const onBlockPointerDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    if (readOnly) return;
    event.stopPropagation();
    dragId.current = id;
    downTime.current = event.timeStamp;
    setSelected(id);
    drag.handlers.onPointerDown(event);
  };

  const breakSelected = () => {
    if (!selectedBlock || selectedBlock.value === 1) return;
    dispatch({ type: 'break', id: selectedBlock.id });
  };

  const handleChartKey = (event: ReactKeyboardEvent<HTMLButtonElement>, column: number) => {
    if (readOnly || state.settings.chartFill === 'auto') return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      dispatch({ type: 'set-digit', column, digit: Number(event.key) });
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      dispatch({ type: 'set-digit', column, digit: null });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setChartTarget((current) => (current === column ? null : column));
    }
  };

  const handleChartClick = (column: number) => {
    if (readOnly || state.settings.chartFill === 'auto') return;
    if (state.mode === 'place-chart' && selectedCard !== null) {
      dispatch({ type: 'place-digit', index: selectedCard, column });
      setSelectedCard(null);
      return;
    }
    setChartTarget((current) => (current === column ? null : column));
  };

  const cardPointerUp = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (draggingCard !== index) return;
    setDraggingCard(null);
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cell = element instanceof Element ? element.closest('[data-chart-column]') : null;
    const columnAttr = cell?.getAttribute('data-chart-column') ?? null;
    if (columnAttr === null) return;
    const column = Number(columnAttr);
    if (!Number.isFinite(column)) return;
    dispatch({ type: 'place-digit', index, column });
    setSelectedCard(null);
    suppressClick.current = true;
  };

  const renderKind = renderKindOf(config, state, cpa);
  const showBlocks = renderKind !== 'table';
  const placeCount = placeCountOf(state.settings.maxValue);
  const snapRegions = snapRegionsOf(state);
  const zoneRects = zoneRectsOf(state);

  const bundled = new Set<BlockValue>();
  for (const value of [1, 10, 100, 1000] as BlockValue[]) {
    const count = state.blocks.filter((block) => block.value === value).length;
    if (count > BUNDLE_THRESHOLD) bundled.add(value);
  }

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'group-tens' })}
          disabled={readOnly || !canGroupTens(state)}
        >
          {S.groupTens}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={breakSelected}
          disabled={readOnly || !selectedBlock || selectedBlock.value === 1}
        >
          {S.breakBlock}
        </button>
        <p className={styles.hint} aria-live="polite">
          {selectedBlock ? S.selected : S.noneSelected}
        </p>
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.canvasLabel}
        data-testid="base-ten-canvas"
        data-cpa={cpa}
        onPointerDown={(event) => lasso.handlers.onPointerDown(event)}
        onPointerMove={(event) => {
          lasso.handlers.onPointerMove(event);
          drag.handlers.onPointerMove(event);
          spawnDrag.handlers.onPointerMove(event);
        }}
        onPointerUp={(event) => {
          lasso.handlers.onPointerUp(event);
          drag.handlers.onPointerUp(event);
          spawnDrag.handlers.onPointerUp(event);
        }}
        onPointerCancel={(event) => {
          lasso.handlers.onPointerCancel(event);
          drag.handlers.onPointerCancel(event);
          spawnDrag.handlers.onPointerCancel(event);
        }}
        onKeyDown={(event) => {
          if ((event.key === 'g' || event.key === 'G') && !readOnly) {
            event.preventDefault();
            dispatch({ type: 'group-tens' });
          }
        }}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

        {/* 블록 상자 */}
        <g role="group" aria-label={S.toolbox} data-testid="block-box">
          <rect
            x={TOOLBOX_RECT.x}
            y={TOOLBOX_RECT.y}
            width={TOOLBOX_RECT.width}
            height={TOOLBOX_RECT.height}
            rx={14}
            fill="#f1ede2"
            stroke="#d7deea"
            strokeWidth={2}
          />
          {state.settings.allowedBlocks.map((value, index) => {
            const slot = boxSlotRect(index, state.settings.allowedBlocks.length);
            return (
              <g
                key={value}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.addBlock(value)}
                data-toolbox-value={value}
                className={styles.tool}
                onPointerDown={(event) => {
                  if (readOnly) return;
                  event.stopPropagation();
                  spawnValue.current = value;
                  spawnDrag.handlers.onPointerDown(event);
                }}
                onKeyDown={(event) => {
                  if (readOnly) return;
                  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    event.preventDefault();
                    const point = defaultDropPoint(state, value);
                    dispatch({ type: 'add', value, x: point.x, y: point.y });
                  }
                }}
              >
                <rect
                  x={slot.x}
                  y={slot.y}
                  width={slot.width}
                  height={slot.height}
                  rx={10}
                  fill="#ffffff"
                  stroke="#c9d3e2"
                  strokeWidth={1.6}
                />
                <ToolboxGlyph value={value} rect={slot} />
                <text
                  x={slot.x + slot.width / 2}
                  y={slot.y + slot.height - 6}
                  textAnchor="middle"
                  fontSize={14}
                  fill={MUTED}
                  pointerEvents="none"
                >
                  {S.blockName[value]}
                </text>
              </g>
            );
          })}
        </g>

        {/* 휴지통 */}
        <g pointerEvents="none">
          <rect
            x={TRASH_RECT.x}
            y={TRASH_RECT.y}
            width={TRASH_RECT.width}
            height={TRASH_RECT.height}
            rx={12}
            fill="#ffffff"
            stroke="#aab4c6"
            strokeWidth={2}
            strokeDasharray="8 6"
          />
          <text
            x={TRASH_RECT.x + TRASH_RECT.width / 2}
            y={TRASH_RECT.y + TRASH_RECT.height / 2 + 7}
            textAnchor="middle"
            fontSize={18}
            fill={MUTED}
          >
            {S.trash}
          </text>
        </g>

        {/* add-sub 구역 */}
        {zoneRects.map(({ zone, rect }) => (
          <g key={`zone-${zone}`} pointerEvents="none">
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={18}
              fill={zone === 'take' ? '#fdeeee' : zone === 'sum' ? '#eef4ff' : '#f7f7f4'}
              fillOpacity={0.7}
              stroke={zone === 'take' ? '#d99a9a' : '#c9d3e2'}
              strokeWidth={2}
              strokeDasharray="10 7"
            />
            <text x={rect.x + 14} y={rect.y + 24} fontSize={18} fontWeight={700} fill={INK}>
              {S.zoneLabels[zone]}
            </text>
            <text x={rect.x + 14} y={rect.y + 46} fontSize={14} fill={MUTED}>
              {S.zoneHint[zone]}
            </text>
          </g>
        ))}

        {/* 자릿값 칸 */}
        {snapRegions.map(({ key, rect, showLabels }) => (
          <g key={`bands-${key}`} pointerEvents="none">
            {bandsFor(rect).map((band) => {
              const name = columnNameOf(band.column);
              const label = name === null ? '' : chartLabelOf(config, band.column);
              const visible = band.column < placeCount;
              if (!visible) return null;
              return (
                <g key={`band-${key}-${band.column}`}>
                  <line
                    x1={band.x}
                    y1={band.y + 4}
                    x2={band.x}
                    y2={band.y + band.height - 4}
                    stroke="#c9d3e2"
                    strokeWidth={1.4}
                    strokeDasharray="6 6"
                  />
                  {showLabels ? (
                    <text
                      x={band.x + band.width / 2}
                      y={band.y + band.height - 6}
                      textAnchor="middle"
                      fontSize={16}
                      fill={MUTED}
                    >
                      {label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ))}

        {/* 블록 */}
        {showBlocks ? (
          state.blocks.map((block) => {
            const rect = blockRect(block);
            const isSelected = selected === block.id;
            const simple = bundled.has(block.value);
            const shakeMe = shakeId === block.id;
            return (
              <g
                key={block.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.blockLabel(block.value)}
                aria-pressed={isSelected}
                data-block-id={block.id}
                data-block-value={block.value}
                data-shake={shakeMe ? 'true' : undefined}
                className={styles.block}
                onPointerDown={(event) => onBlockPointerDown(event, block.id)}
                onKeyDown={(event) => onBlockKeyDown(event, block.id)}
              >
                {/* 손가락이 작은 블록을 정확히 짚지 않아도 잡히도록 투명한 여백을 둔다. */}
                <rect
                  x={rect.x - hitPad}
                  y={rect.y - hitPad}
                  width={rect.width + hitPad * 2}
                  height={rect.height + hitPad * 2}
                  fill="transparent"
                  pointerEvents="all"
                />
                {isSelected ? (
                  <rect
                    x={rect.x - 5}
                    y={rect.y - 5}
                    width={rect.width + 10}
                    height={rect.height + 10}
                    rx={8}
                    fill="none"
                    stroke={SELECT}
                    strokeWidth={3}
                    strokeDasharray="8 5"
                    pointerEvents="none"
                  />
                ) : null}
                {renderKind === 'isometric' ? (
                  <IsometricBlock block={block} icon={state.settings.icon} simple={simple} />
                ) : (
                  <FlatBlock block={block} icon={state.settings.icon} simple={simple} />
                )}
              </g>
            );
          })
        ) : (
          <g pointerEvents="none">
            <rect
              x={24}
              y={140}
              width={952}
              height={360}
              rx={20}
              fill="#ffffff"
              stroke="#d7deea"
              strokeWidth={2}
              strokeDasharray="10 8"
            />
            <text x={500} y={324} textAnchor="middle" fontSize={24} fill={MUTED}>
              {state.chart ? S.chart : S.chartNoTable}
            </text>
          </g>
        )}

        {/* 올가미 미리보기 */}
        {lasso.path.length > 1 ? (
          <polygon
            points={lasso.path.map((point) => `${point.x},${point.y}`).join(' ')}
            fill={BLUE}
            fillOpacity={0.08}
            stroke={BLUE}
            strokeWidth={2}
            strokeDasharray="8 5"
            pointerEvents="none"
          />
        ) : null}

        {/* 실패 배지: 학생이 감싼 개수만 보여 준다 */}
        {attemptVisible && attempt ? (
          <g pointerEvents="none" data-testid="attempt-badge">
            <rect
              x={350}
              y={16}
              width={300}
              height={50}
              rx={14}
              fill="#fff3e0"
              stroke={SELECT}
              strokeWidth={2}
            />
            <text x={500} y={48} textAnchor="middle" fontSize={20} fill="#8a4b00">
              {S.attemptBadge(attempt.count)}
            </text>
          </g>
        ) : null}
      </svg>

      {/* 자릿값 표 */}
      {state.chart !== null ? (
        <div className={styles.chartWrapper}>
          <div className={styles.chart} role="group" aria-label={S.chart}>
            {state.settings.chartColumns.map((column, index) => {
              const label = chartLabelOf(config, column);
              const auto = state.settings.chartFill === 'auto';
              const text = auto
                ? String(countsForColumn(state, column))
                : (state.chart?.[index] ?? '');
              return (
                <div key={column} className={styles.chartColumn}>
                  <span className={styles.chartHeading}>{label}</span>
                  <button
                    type="button"
                    className={styles.chartCell}
                    data-chart-column={column}
                    aria-label={S.chartCell(label)}
                    aria-pressed={chartTarget === column}
                    aria-disabled={auto}
                    onClick={() => handleChartClick(column)}
                    onKeyDown={(event) => handleChartKey(event, column)}
                  >
                    {text === '' ? '–' : text}
                  </button>
                </div>
              );
            })}
          </div>
          <p className={styles.chartHint}>
            {state.settings.chartFill === 'auto' ? S.chartAutoHint : S.chartStudentHint}
          </p>
        </div>
      ) : null}

      {/* place-chart 숫자 카드 */}
      {state.mode === 'place-chart' && state.settings.digits.length > 0 ? (
        <div className={styles.cards} role="group" aria-label={S.digitCards}>
          {state.settings.digits.map((digit, index) => {
            const placedAt = state.digitPlacements[index] ?? -1;
            const placed = placedAt >= 0;
            const pressed = selectedCard === index;
            return (
              <button
                key={`${digit}-${index}`}
                type="button"
                className={styles.card}
                aria-label={S.digitCard(digit)}
                aria-pressed={pressed}
                disabled={readOnly || placed}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  setSelectedCard(pressed ? null : index);
                }}
                onPointerDown={(event) => {
                  if (readOnly || placed) return;
                  setDraggingCard(index);
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    // 캡처를 지원하지 않는 환경(테스트)은 클릭 경로로 쓴다.
                  }
                }}
                onPointerUp={(event) => cardPointerUp(event, index)}
                onPointerCancel={() => setDraggingCard(null)}
              >
                {digit}
              </button>
            );
          })}
          <p className={styles.chartHint}>{S.digitCardHint}</p>
        </div>
      ) : null}

      {/* 숫자 키패드 */}
      {chartTarget !== null ? (
        <div className={styles.keypad} role="group" aria-label={S.chartKeypad}>
          {Array.from({ length: 10 }, (_, digit) => (
            <button
              key={digit}
              type="button"
              className={styles.key}
              aria-label={S.chartDigit(digit)}
              onClick={() => {
                dispatch({ type: 'set-digit', column: chartTarget, digit });
                setChartTarget(null);
              }}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className={styles.key}
            onClick={() => {
              dispatch({ type: 'set-digit', column: chartTarget, digit: null });
              setChartTarget(null);
            }}
          >
            {S.chartClear}
          </button>
          <button type="button" className={styles.key} onClick={() => setChartTarget(null)}>
            {S.chartClose}
          </button>
        </div>
      ) : null}

      <p className={styles.instructions}>{S.instructions[state.mode]}</p>
    </div>
  );
}
