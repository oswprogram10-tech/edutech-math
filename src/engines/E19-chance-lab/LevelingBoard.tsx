/**
 * E19 leveling 판(논리 1000×600 SVG). 기둥마다 블록을 쌓고, 맨 위 블록을 끌어 다른 기둥 위에 놓는다.
 * 기둥 아래에 이름, 위에 높이 숫자(학생이 만든 상태)를 쓴다. 평균 값은 어디에도 쓰지 않는다.
 * 키보드: svg에 초점을 두고 ←→ 기둥 고르기, Enter·Space 집기/놓기, Esc 취소.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { pointerToLogical, useDrag } from '../../core/engine-sdk';
import { LEVEL, columnAt, levelGeometry } from './layout';
import { E19_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { LevelingState } from './types';
import type { ChanceUi } from './useChanceUi';

const INK = '#1d2330';
const BLOCK_FILL = '#9cc3ff';
const BLOCK_STROKE = '#2f6fde';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

interface Props {
  readonly state: LevelingState;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function LevelingBoard({ state, ui, readOnly, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fromRef = useRef<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const geometry = levelGeometry(state);
  const { blockW, blockH, colW } = geometry;

  const drag = useDrag({
    disabled: readOnly,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      const column = columnAt(geometry, info.start.x);
      const from = column !== null && (state.heights[column] ?? 0) > 0 ? column : null;
      fromRef.current = from;
      setDragFrom(from);
    },
    onEnd: (info) => {
      const from = fromRef.current;
      fromRef.current = null;
      setDragFrom(null);
      if (from === null) return;
      const to = columnAt(geometry, info.current.x);
      if (to !== null) ui.send({ type: 'move', from, to });
    },
    onCancel: () => {
      fromRef.current = null;
      setDragFrom(null);
    },
  });

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || readOnly) return;
    if (event.key === 'ArrowLeft') ui.moveCursor(-1);
    else if (event.key === 'ArrowRight') ui.moveCursor(1);
    else if (event.key === 'Enter' || event.key === ' ') ui.pickOrPlace();
    else if (event.key === 'Escape') ui.cancelHold();
    else return;
    event.preventDefault();
  };

  const overColumn = drag.dragging && drag.current ? columnAt(geometry, drag.current.x) : null;
  const showCursor = focused || ui.holding !== null;

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.leveling.boardLabel}
      tabIndex={readOnly ? -1 : 0}
      data-testid="chance-canvas"
      data-mode="leveling"
      data-moves={state.moves}
      data-holding={ui.holding ?? undefined}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...drag.handlers}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfcff" />
      {state.label !== '' ? (
        <text x={LEVEL.left} y={52} fontSize={26} fontWeight={800} fill={INK}>
          {state.label}
        </text>
      ) : null}
      <line
        x1={LEVEL.left - 10}
        y1={LEVEL.baseY}
        x2={LEVEL.right + 10}
        y2={LEVEL.baseY}
        stroke={INK}
        strokeWidth={4}
      />
      {geometry.columns.map((column) => {
        const height = state.heights[column.index] ?? 0;
        const lifted = dragFrom === column.index || ui.holding === column.index;
        const solid = lifted ? height - 1 : height;
        const name = state.names[column.index] ?? '';
        const target = overColumn === column.index && dragFrom !== null && dragFrom !== overColumn;
        return (
          <g
            key={column.index}
            data-column={column.index}
            data-height={height}
            data-cx={column.cx.toFixed(2)}
            role="img"
            aria-label={S.leveling.columnLabel(name, height)}
          >
            {target || (showCursor && ui.cursor === column.index) ? (
              <rect
                x={column.left + 2}
                y={LEVEL.topLimit - 30}
                width={colW - 4}
                height={LEVEL.baseY - LEVEL.topLimit + 30 + 70}
                rx={10}
                fill="none"
                stroke="#e8872e"
                strokeWidth={4}
                strokeDasharray="10 6"
                data-part={target ? 'drop-target' : 'cursor'}
              />
            ) : null}
            {Array.from({ length: solid }, (_, k) => (
              <rect
                key={k}
                data-block=""
                x={column.cx - blockW / 2}
                y={LEVEL.baseY - (k + 1) * blockH}
                width={blockW}
                height={blockH}
                fill={BLOCK_FILL}
                stroke={BLOCK_STROKE}
                strokeWidth={2}
              />
            ))}
            {lifted ? (
              <rect
                data-part="lifted"
                x={column.cx - blockW / 2}
                y={LEVEL.baseY - height * blockH}
                width={blockW}
                height={blockH}
                fill="none"
                stroke={BLOCK_STROKE}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            ) : null}
            <text
              data-part="height"
              x={column.cx}
              y={LEVEL.baseY - solid * blockH - 14}
              textAnchor="middle"
              fontSize={26}
              fontWeight={800}
              fill={INK}
            >
              {height}
            </text>
            <text
              data-part="name"
              x={column.cx}
              y={LEVEL.baseY + 38}
              textAnchor="middle"
              fontSize={22}
              fontWeight={700}
              fill={INK}
            >
              {name}
            </text>
            {showCursor && ui.cursor === column.index ? (
              <polygon
                points={`${column.cx - 12},${LEVEL.baseY + 66} ${column.cx + 12},${LEVEL.baseY + 66} ${column.cx},${LEVEL.baseY + 50}`}
                fill="#e8872e"
                stroke={INK}
                strokeWidth={2}
              />
            ) : null}
          </g>
        );
      })}
      {drag.dragging && drag.current && dragFrom !== null ? (
        <rect
          data-part="ghost"
          x={drag.current.x - blockW / 2}
          y={drag.current.y - blockH / 2}
          width={blockW}
          height={blockH}
          fill={BLOCK_FILL}
          fillOpacity={0.85}
          stroke={BLOCK_STROKE}
          strokeWidth={3}
        />
      ) : null}
    </svg>
  );
}
