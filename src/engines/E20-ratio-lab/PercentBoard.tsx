/**
 * E20 percent 판 그림(논리 1000×600 SVG). layout: grid(10×10 판) / strip(1×100 띠, 10칸마다 굵은 선).
 * 칸은 앞(왼쪽 위)에서부터 0~99번이다. 누르면 하나씩, 누른 채 끌면 지나간 칸을 처음 누른 칸의 새 상태로
 * 맞춘다(Pointer Events). 키보드: 방향키로 칸을 옮기고 Space로 바꾸며 Enter는 여기까지 앞에서부터 칠한다.
 * 칠한 칸은 색과 밝기 차이로 보이고, "칠한 칸 n / 100" 글로도 알린다(학생이 칠한 값이라 정답 노출이 아니다).
 */
import { useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { pointerToLogical } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import { PERCENT_GRID, PERCENT_STRIP, moveCursor, percentCellAt, percentCellRect } from './layout';
import { E20_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, PERCENT_CELLS } from './types';
import type { PercentState } from './types';
import type { RatioUi } from './useRatioUi';

const INK = '#1d2330';
const SHADED = '#2f6fde';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
/** 끌 때 두 점 사이를 이 간격(논리 좌표)마다 살펴 빠르게 지나간 칸도 놓치지 않는다. */
const SAMPLE_STEP = 4;

interface DragState {
  readonly desired: boolean;
  last: Point;
  /** 이번 끌기에서 이미 바꾸라고 보낸 칸(화면 상태가 아직 못 따라온 것까지 센다). */
  readonly sent: Map<number, boolean>;
}

export interface PercentBoardProps {
  readonly state: PercentState;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

export function PercentBoard({ state, ui, readOnly, svgStyle, className }: PercentBoardProps) {
  const { layout, editable, showCount } = state.settings;
  const svgRef = useRef<SVGSVGElement>(null);
  const focusRef = useRef<SVGGElement>(null);
  const drag = useRef<DragState | null>(null);
  const [cursor, setCursor] = useState(0);
  const [focused, setFocused] = useState(false);
  const shaded = new Set(state.cells);
  const canEdit = editable && !readOnly;

  const apply = (index: number) => {
    const current = drag.current;
    if (current === null) return;
    const now = current.sent.get(index) ?? shaded.has(index);
    if (now === current.desired) return;
    current.sent.set(index, current.desired);
    ui.send({ type: 'toggle', index });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!canEdit || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const index = percentCellAt(layout, point.x, point.y);
    if (index === null) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture?.(event.pointerId);
    drag.current = { desired: !shaded.has(index), last: point, sent: new Map() };
    apply(index);
    setCursor(index);
    focusRef.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (current === null) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const dx = point.x - current.last.x;
    const dy = point.y - current.last.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SAMPLE_STEP));
    let lastIndex: number | null = null;
    for (let i = 1; i <= steps; i += 1) {
      const index = percentCellAt(
        layout,
        current.last.x + (dx * i) / steps,
        current.last.y + (dy * i) / steps,
      );
      if (index !== null && index !== lastIndex) {
        apply(index);
        setCursor(index);
        lastIndex = index;
      }
    }
    current.last = point;
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    drag.current = null;
    svgRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code.startsWith('Arrow')) {
      event.preventDefault();
      setCursor(moveCursor(layout, cursor, event.code));
    } else if (event.code === 'Space') {
      event.preventDefault();
      if (canEdit) ui.send({ type: 'toggle', index: cursor });
    } else if (event.code === 'Enter') {
      event.preventDefault();
      if (canEdit) ui.send({ type: 'fill-to', count: cursor + 1 });
    }
  };

  const cells = [];
  for (let index = 0; index < PERCENT_CELLS; index += 1) {
    const r = percentCellRect(layout, index);
    const on = shaded.has(index);
    cells.push(
      <rect
        key={index}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill={on ? SHADED : '#ffffff'}
        stroke="#8b96ab"
        strokeWidth={1}
        data-index={index}
        data-shaded={on ? 'true' : 'false'}
      />,
    );
  }

  const thickLines = [];
  if (layout === 'strip') {
    const { x, y, cellW, cellH } = PERCENT_STRIP;
    for (let j = 0; j <= 10; j += 1) {
      thickLines.push(
        <line
          key={j}
          x1={x + j * 10 * cellW}
          y1={y}
          x2={x + j * 10 * cellW}
          y2={y + cellH}
          stroke={INK}
          strokeWidth={j === 0 || j === 10 ? 4 : 3}
        />,
      );
    }
    thickLines.push(
      <line key="top" x1={x} y1={y} x2={x + cellW * 100} y2={y} stroke={INK} strokeWidth={3} />,
      <line
        key="bottom"
        x1={x}
        y1={y + cellH}
        x2={x + cellW * 100}
        y2={y + cellH}
        stroke={INK}
        strokeWidth={3}
      />,
    );
  } else {
    const { x, y, cell } = PERCENT_GRID;
    thickLines.push(
      <rect
        key="frame"
        x={x}
        y={y}
        width={cell * 10}
        height={cell * 10}
        fill="none"
        stroke={INK}
        strokeWidth={4}
      />,
    );
  }

  const cursorRect = percentCellRect(layout, cursor);
  const countPos =
    layout === 'strip' ? { x: 500, y: 190, anchor: 'middle' } : { x: 640, y: 220, anchor: 'start' };
  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      style={{ ...svgStyle, touchAction: 'none' }}
      role="group"
      aria-label={layout === 'strip' ? S.percent.stripLabel : S.percent.gridLabel}
      data-testid="ratio-canvas"
      data-mode="percent"
      data-look={layout}
      data-layout={layout}
      data-shaded-count={shaded.size}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
      <g
        ref={focusRef}
        tabIndex={canEdit ? 0 : -1}
        role="application"
        aria-label={S.percent.cursorLabel(cursor + 1, shaded.has(cursor))}
        data-testid="percent-cells"
        data-cursor={cursor}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ outline: 'none' }}
      >
        {cells}
        {thickLines}
        {focused && canEdit ? (
          <rect
            x={cursorRect.x - 2}
            y={cursorRect.y - 2}
            width={cursorRect.w + 4}
            height={cursorRect.h + 4}
            fill="none"
            stroke="#e8872e"
            strokeWidth={4}
            data-part="cursor"
          />
        ) : null}
      </g>
      {showCount ? (
        <text
          x={countPos.x}
          y={countPos.y}
          textAnchor={countPos.anchor as 'start' | 'middle'}
          fontSize={40}
          fontWeight={800}
          fill={INK}
          role="status"
          data-testid="percent-count"
        >
          {S.percent.count(shaded.size)}
        </text>
      ) : null}
    </svg>
  );
}
