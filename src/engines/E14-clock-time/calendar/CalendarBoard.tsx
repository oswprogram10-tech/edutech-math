/**
 * E14 calendar 판(논리 1000×600 SVG). 7열 격자 달력. 가려진 칸은 "?"와 점선 테두리로 그리고
 * 학생이 넣은 수만 보여 준다. 가려진 날짜의 값은 DOM·aria·data- 어디에도 쓰지 않는다.
 * 칸을 누르면 고르기/수 넣을 칸 고르기, 같은 열에서 아래로 쓸면 +7 화살표가 그려진다.
 * 쓸기 도중 좌표는 지역 미리보기에만 두고, 손을 뗄 때 Action 하나만 보낸다.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { pointerToLogical, useDrag } from '../../../core/engine-sdk';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import { GRID, arrowShape, cellAt, cellRect } from './layout';
import { colOf, dayAt, rowCount, rowOf } from './settings';
import type { CalendarState } from './types';
import type { CalendarUi } from './useCalendarUi';

const S = E14_MODE_STRINGS.calendar;
const INK = '#1d2330';
const BLUE = '#2f6fde';
const ORANGE = '#e8872e';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
/** 이 거리(논리 px) 이상 움직이면 쓸기, 아니면 누르기다. */
const SWIPE_DISTANCE = 14;

interface Props {
  readonly state: CalendarState;
  readonly ui: CalendarUi;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

interface Preview {
  readonly col: number;
  readonly fromRow: number;
  readonly toRow: number;
}

export function ArrowMark({
  col,
  row,
  dashed,
  color,
  part,
}: {
  readonly col: number;
  readonly row: number;
  readonly dashed?: boolean;
  readonly color: string;
  readonly part: string;
}) {
  const a = arrowShape(col, row);
  return (
    <g data-part={part} data-col={col} data-row={row}>
      <line
        x1={a.x}
        y1={a.y1}
        x2={a.x}
        y2={a.y2 - 8}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={dashed ? '6 5' : undefined}
      />
      <polygon
        points={`${a.x - 8},${a.y2 - 10} ${a.x + 8},${a.y2 - 10} ${a.x},${a.y2 + 1}`}
        fill={color}
      />
      <text
        x={a.labelX}
        y={a.labelY}
        fontSize={20}
        fontWeight={800}
        fill={color}
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {S.plusSeven}
      </text>
    </g>
  );
}

interface CellProps {
  readonly state: CalendarState;
  readonly ui: CalendarUi;
  readonly col: number;
  readonly row: number;
  readonly day: number;
  readonly cursor: number;
  readonly focusedDay: number | null;
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly onPreview: (preview: Preview | null) => void;
  readonly onCursor: (day: number) => void;
  readonly onFocusDay: (day: number | null) => void;
}

function Cell(props: CellProps) {
  const { state, ui, col, row, day, cursor, focusedDay, svgRef } = props;
  const hidden = state.hidden.includes(day);
  const selected = state.selected.includes(day);
  const active = ui.activeDay === day;
  const filled = state.filled[String(day)];
  const weekday = S.weekdays[col] ?? '';
  const rect = cellRect(col, row);
  const focused = focusedDay === day;

  const drag = useDrag({
    disabled: ui.locked,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onMove: (info) => {
      if (!state.canArrow) return;
      const end = cellAt(info.current.x, info.current.y);
      const far = Math.hypot(info.delta.x, info.delta.y) >= SWIPE_DISTANCE;
      props.onPreview(
        far && end !== null && end.col === col && end.row > row
          ? { col, fromRow: row, toRow: end.row }
          : null,
      );
    },
    onEnd: (info) => {
      props.onPreview(null);
      props.onCursor(day);
      const far = Math.hypot(info.delta.x, info.delta.y) >= SWIPE_DISTANCE;
      if (!far) {
        ui.tapDay(day);
        return;
      }
      if (!state.canArrow) return;
      const end = cellAt(info.current.x, info.current.y);
      if (end !== null && end.col === col && end.row > row) ui.drawArrows(col, row, end.row);
      else ui.arrowShapeRejected();
    },
    onCancel: () => props.onPreview(null),
  });

  const focusDay = (target: number) => {
    const next = svgRef.current?.querySelector<SVGElement>(
      `[data-part="cell"][data-col="${colOf(state, target)}"][data-row="${rowOf(state, target)}"]`,
    );
    next?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGGElement>) => {
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const move = delta[event.key];
    if (move !== undefined) {
      event.preventDefault();
      const target = day + move;
      if (target >= 1 && target <= state.days) focusDay(target);
      return;
    }
    if (ui.locked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (hidden && state.canFill && active && ui.buffer !== '') ui.put();
      else ui.tapDay(day);
    } else if (/^[0-9]$/.test(event.key) && ui.activeDay !== null) {
      event.preventDefault();
      ui.pressDigit(Number(event.key));
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      ui.clearBuffer();
    } else if (event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      if (dayAt(state, col, row + 1) !== null) ui.drawArrows(col, row, row + 1);
      else ui.arrowShapeRejected();
    }
  };

  let label = hidden ? S.hiddenCell(weekday) : S.dayCell(day, weekday);
  if (hidden && filled !== undefined) label += S.filledSuffix(filled);
  if (selected) label += S.selectedSuffix;

  return (
    <g
      data-part="cell"
      data-col={col}
      data-row={row}
      data-day={hidden ? undefined : day}
      data-hidden={hidden ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      role="button"
      tabIndex={cursor === day ? 0 : -1}
      aria-label={label}
      aria-pressed={state.canSelect ? selected : undefined}
      aria-disabled={ui.locked ? true : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => {
        props.onCursor(day);
        props.onFocusDay(day);
      }}
      onBlur={() => props.onFocusDay(null)}
      style={{ outline: 'none', cursor: ui.locked ? 'default' : 'pointer', touchAction: 'none' }}
      {...drag.handlers}
    >
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        rx={10}
        fill={hidden ? '#f6f8fc' : selected ? '#e8f0ff' : '#ffffff'}
        stroke={focused || active ? ORANGE : selected ? BLUE : hidden ? INK : '#9aa6bd'}
        strokeWidth={focused || active ? 6 : selected ? 6 : hidden ? 3 : 2}
        strokeDasharray={hidden || focused ? '9 6' : undefined}
      />
      <text
        x={rect.x + rect.w / 2}
        y={rect.y + rect.h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={hidden && filled === undefined ? 40 : 34}
        fontWeight={800}
        fill={hidden && filled === undefined ? '#6b7690' : INK}
      >
        {hidden ? (filled === undefined ? '?' : String(filled)) : String(day)}
      </text>
      {selected ? (
        <text
          data-part="check"
          x={rect.x + rect.w - 10}
          y={rect.y + 24}
          textAnchor="end"
          fontSize={24}
          fontWeight={800}
          fill={BLUE}
        >
          ✓
        </text>
      ) : null}
    </g>
  );
}

export function CalendarBoard({ state, ui, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cursor, setCursor] = useState(1);
  const [focusedDay, setFocusedDay] = useState<number | null>(null);

  const cells: { col: number; row: number; day: number }[] = [];
  for (let row = 0; row < rowCount(state); row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const day = dayAt(state, col, row);
      if (day !== null) cells.push({ col, row, day });
    }
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="clock-canvas"
      data-mode="calendar"
      role="group"
      aria-label={S.boardLabel}
    >
      <text
        data-part="month-name"
        x={GRID.left / 2}
        y={GRID.headerY + GRID.headerH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={24}
        fontWeight={800}
        fill={INK}
      >
        {`${state.month}월`}
      </text>
      {state.weekdayHeader
        ? S.weekdays.map((name, col) => (
            <text
              key={name}
              data-part="weekday"
              x={GRID.left + col * GRID.colW + GRID.colW / 2}
              y={GRID.headerY + GRID.headerH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={26}
              fontWeight={800}
              fill={INK}
            >
              {name}
            </text>
          ))
        : null}
      {cells.map((cell) => (
        <Cell
          key={cell.day}
          state={state}
          ui={ui}
          col={cell.col}
          row={cell.row}
          day={cell.day}
          cursor={cursor}
          focusedDay={focusedDay}
          svgRef={svgRef}
          onPreview={setPreview}
          onCursor={setCursor}
          onFocusDay={setFocusedDay}
        />
      ))}
      <g data-part="arrows" pointerEvents="none">
        {state.segments.map((key) => {
          const [col = 0, row = 0] = key.split(':').map(Number);
          return <ArrowMark key={key} part="arrow" col={col} row={row} color={BLUE} />;
        })}
        {preview
          ? Array.from({ length: preview.toRow - preview.fromRow }, (_, i) => (
              <ArrowMark
                key={i}
                part="arrow-preview"
                col={preview.col}
                row={preview.fromRow + i}
                color="#7f8ba3"
                dashed
              />
            ))
          : null}
      </g>
    </svg>
  );
}
