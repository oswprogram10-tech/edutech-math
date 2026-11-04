/**
 * E07 덧셈·뺄셈·소수 세로셈 화면.
 *
 * - 칸 하나 = 입력 하나 = Action 하나. 결과 줄은 오른쪽에서 왼쪽으로 자동 이동한다.
 * - 칸마다 기대값을 계산하지만 화면에는 맞음·틀림 색을 칠하지 않는다(T014 결정 7).
 * - 모든 조작은 Pointer Events 또는 키보드로 한다. 터치 타깃은 targetSize 이상.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDrag } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { computeGrid, digitAt } from '../grid';
import type { ParsedNumber } from '../grid';
import { columnCalcStrings as S } from '../strings.ko';
import { linkKey, placeNameKo } from '../types';
import type {
  CellRef,
  ColumnCalcAction,
  ColumnCalcConfig,
  ColumnCalcState,
  EditableRow,
} from '../types';
import styles from '../View.module.css';
import { Keypad } from './Keypad';

export type ColumnViewProps = EngineViewProps<ColumnCalcConfig, ColumnCalcState, ColumnCalcAction>;

interface AddSubViewProps extends ColumnViewProps {
  readonly showInstructions?: boolean;
}

function digitOf(
  parsed: ParsedNumber | null,
  point: number | null,
  pads: readonly number[],
  column: number,
): string | null {
  if (!parsed || point === null) return null;
  return digitAt(parsed, point, column, pads);
}

function styleFor(columns: number, targetSize: number): CSSProperties {
  return {
    gridTemplateColumns: `3.6rem repeat(${Math.max(columns, 1)}, minmax(${targetSize}px, 1fr))`,
  };
}

function pointOn(
  parsed: ParsedNumber | null,
  point: number | null,
  column: number,
  shownPoint: number | null,
): boolean {
  if (!parsed || point === null || parsed.fracDigits === 0) return false;
  return shownPoint !== null && column === shownPoint;
}

export function AddSubView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
  showInstructions = true,
}: AddSubViewProps) {
  const grid = useMemo(() => computeGrid(state), [state]);
  const alignment = grid.alignment;
  const a = grid.a;
  const b = grid.b;
  const columns = grid.displayColumns;
  // 높은 자리를 왼쪽에 그린다(세로셈 표기). 상태·격자 계산은 낮은 자리부터 그대로 둔다.
  const renderedColumns = [...columns].reverse();
  const [cardChoice, setCardChoice] = useState<{
    readonly mode: string;
    readonly card: 'a' | 'b' | null;
  }>({ mode: state.mode, card: null });
  const [dropColumn, setDropColumn] = useState(0);
  const topRowRef = useRef<HTMLDivElement>(null);
  const movedA = useRef(false);
  const movedB = useRef(false);

  const magnetOn = (config.magnetAlign ?? 'C-P') !== false && cpa !== 'A';
  const isDecimal = state.mode === 'decimal';
  // 모드가 바뀌면 앞 모드에서 고른 카드는 없는 것으로 본다(효과 없이 파생).
  const selectedCard = cardChoice.mode === state.mode ? cardChoice.card : null;

  function setSelectedCard(card: 'a' | 'b' | null): void {
    setCardChoice({ mode: state.mode, card });
  }

  function snapFor(_number: 'a' | 'b', column: number): number {
    if (!magnetOn) return column;
    const other = _number === 'a' ? state.bPoint : state.aPoint;
    return other ?? 0;
  }

  function placeCard(number: 'a' | 'b', column: number): void {
    if (readOnly) return;
    dispatch({ type: 'place', number, pointColumn: snapFor(number, column) });
    setSelectedCard(null);
  }

  function columnFromClient(clientX: number): number | null {
    const row = topRowRef.current;
    if (!row) return null;
    for (const cell of row.querySelectorAll<HTMLElement>('[data-column]')) {
      const rect = cell.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const value = Number(cell.dataset['column']);
        return Number.isInteger(value) ? value : null;
      }
    }
    return null;
  }

  function endDrag(number: 'a' | 'b', clientX: number): void {
    const column = columnFromClient(clientX);
    if (column === null) return;
    placeCard(number, column);
  }

  const dragA = useDrag({
    getPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    disabled: readOnly || !isDecimal,
    onStart: () => {
      movedA.current = false;
    },
    onMove: (info) => {
      if (Math.abs(info.delta.x) + Math.abs(info.delta.y) > 6) movedA.current = true;
    },
    onEnd: (info) => {
      if (movedA.current) endDrag('a', info.current.x);
    },
  });
  const dragB = useDrag({
    getPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    disabled: readOnly || !isDecimal,
    onStart: () => {
      movedB.current = false;
    },
    onMove: (info) => {
      if (Math.abs(info.delta.x) + Math.abs(info.delta.y) > 6) movedB.current = true;
    },
    onEnd: (info) => {
      if (movedB.current) endDrag('b', info.current.x);
    },
  });

  function canPad(number: 'a' | 'b', column: number): boolean {
    if (!isDecimal || state.padZeros !== 'optional') return false;
    if (state.aPoint === null || state.bPoint === null) return false;
    if (!a || !b) return false;
    const parsed = number === 'a' ? a : b;
    const point = number === 'a' ? state.aPoint : state.bPoint;
    const pads = number === 'a' ? state.aPads : state.bPads;
    if (digitAt(parsed, point, column, pads) !== null) return false;
    const low = Math.min(state.aPoint - a.fracDigits, state.bPoint - b.fracDigits);
    const high = Math.max(state.aPoint + a.intDigits - 1, state.bPoint + b.intDigits - 1);
    return column >= low && column <= high;
  }

  function onTopCell(column: number): void {
    if (readOnly) return;
    if (isDecimal && selectedCard !== null) {
      placeCard(selectedCard, column);
      return;
    }
    if (state.op === 'sub' && digitOf(a, state.aPoint, state.aPads, column) !== null) {
      dispatch({ type: 'toggle-cross', column });
      return;
    }
    if (canPad('a', column)) dispatch({ type: 'pad-zero', number: 'a', column });
  }

  function onBottomCell(column: number): void {
    if (readOnly) return;
    if (canPad('b', column)) dispatch({ type: 'pad-zero', number: 'b', column });
  }

  function defaultSelection(): CellRef | null {
    const column = grid.requiredColumns[0] ?? grid.resultColumns[0];
    return column === undefined ? null : { row: 'result', column };
  }

  function enterAt(cell: CellRef | null, digit: string | null): void {
    if (readOnly || !cell) return;
    dispatch({ type: 'enter', row: cell.row, column: cell.column, digit });
  }

  function moveSelection(delta: 1 | -1): void {
    const current = state.selected ?? defaultSelection();
    if (!current) return;
    const column = current.column + delta;
    if (current.row === 'result') {
      if (!grid.resultColumns.includes(column)) return;
    } else if (column < grid.low || column > grid.high) {
      return;
    }
    dispatch({ type: 'select', row: current.row, column });
  }

  function moveRow(row: EditableRow): void {
    const current = state.selected ?? defaultSelection();
    if (!current) return;
    if (row === 'carry' && state.op !== 'add') return;
    if (row === 'regroup' && state.op !== 'sub') return;
    let column = current.column;
    if (row === 'result' && !grid.resultColumns.includes(column)) {
      column = grid.resultColumns[0] ?? column;
    }
    if (column < grid.low || column > grid.high) return;
    dispatch({ type: 'select', row, column });
  }

  function selectCard(number: 'a' | 'b'): void {
    if (readOnly) return;
    const moved = number === 'a' ? movedA : movedB;
    if (moved.current) {
      moved.current = false;
      return;
    }
    setSelectedCard(selectedCard === number ? null : number);
    setDropColumn(number === 'a' ? (state.aPoint ?? 0) : (state.bPoint ?? 0));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (selectedCard !== null && isDecimal) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          placeCard(selectedCard, dropColumn);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setSelectedCard(null);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setDropColumn((value) => Math.min(12, value + 1));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          setDropColumn((value) => Math.max(-20, value - 1));
        }
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        enterAt(state.selected ?? defaultSelection(), event.key);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        enterAt(state.selected ?? defaultSelection(), null);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveRow(state.op === 'add' ? 'carry' : 'regroup');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveRow('result');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const rowStyle = styleFor(columns.length, targetSize);
  const keypadTarget = state.selected ?? defaultSelection();
  const selectedLabel = keypadTarget
    ? S.selectedCell(
        keypadTarget.row === 'result'
          ? S.resultCell(placeNameKo(keypadTarget.column))
          : keypadTarget.row === 'carry'
            ? S.carryCell(placeNameKo(keypadTarget.column))
            : S.regroupCell(placeNameKo(keypadTarget.column)),
      )
    : '';

  const rowCellProps = (row: string, column: number) => ({
    'data-row': row,
    'data-column': column,
  });

  // E01 연결(hint)로 강조할 칸. 다음 입력에서 reduce가 지운다.
  const linked = (kind: 'carry' | 'cross' | 'regroup' | 'ten', column: number): boolean =>
    state.linkHighlights.includes(linkKey(kind, column));

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      {showInstructions ? (
        <p className={styles.instructions}>{S.instructions[state.mode]}</p>
      ) : null}

      {isDecimal ? (
        <div className={styles.cards} role="group" aria-label={S.cardsLabel}>
          {(['a', 'b'] as const).map((number) => {
            const text = number === 'a' ? state.aText : state.bText;
            const placed = number === 'a' ? state.aPoint !== null : state.bPoint !== null;
            const handlers = number === 'a' ? dragA.handlers : dragB.handlers;
            return (
              <button
                key={number}
                type="button"
                className={styles.card}
                data-testid={`card-${number}`}
                data-placed={placed}
                aria-pressed={selectedCard === number}
                aria-label={selectedCard === number ? S.cardSelected(text) : S.cardPick(text)}
                disabled={readOnly}
                {...handlers}
                onClick={() => selectCard(number)}
              >
                <span className={styles.cardNumber}>{text}</span>
                <span className={styles.cardState}>{placed ? S.placed : S.notPlaced}</span>
              </button>
            );
          })}
          {cpa === 'A' ? null : (
            <span className={styles.badge}>{magnetOn ? S.magnetOn : S.magnetOff}</span>
          )}
        </div>
      ) : null}

      {isDecimal && selectedCard !== null ? <p className={styles.hint}>{S.cardDragHint}</p> : null}

      <div className={styles.gridScroll}>
        <div
          className={styles.grid}
          data-testid="column-grid"
          role="group"
          aria-label={S.canvasLabel}
          tabIndex={0}
          onFocus={(event) => {
            if (event.target !== event.currentTarget || readOnly) return;
            const fallback = defaultSelection();
            if (!state.selected && fallback) {
              dispatch({ type: 'select', row: fallback.row, column: fallback.column });
            }
          }}
        >
          {cpa === 'C' ? (
            <div className={styles.row} style={rowStyle} aria-hidden="true">
              <span className={styles.rowLabel} />
              {renderedColumns.map((column) => (
                <span key={column} className={styles.placeHead}>
                  {placeNameKo(column)}
                </span>
              ))}
            </div>
          ) : null}

          <div className={styles.row} style={rowStyle}>
            <span className={styles.rowLabel}>
              {state.op === 'add' ? S.rowCarry : S.rowRegroup}
            </span>
            {renderedColumns.map((column) => {
              const selected =
                state.selected?.row === (state.op === 'add' ? 'carry' : 'regroup') &&
                state.selected.column === column;
              if (state.op === 'add') {
                return (
                  <button
                    key={column}
                    type="button"
                    className={`${styles.cell} ${styles.markCell}`}
                    {...rowCellProps('carry', column)}
                    data-selected={selected}
                    data-linked={linked('carry', column)}
                    aria-label={S.carryCell(placeNameKo(column))}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'select', row: 'carry', column })}
                  >
                    {state.carries[String(column)] ?? ''}
                  </button>
                );
              }
              const ten = state.tens.includes(column);
              return (
                <div key={column} className={styles.subMark}>
                  <button
                    type="button"
                    className={`${styles.cell} ${styles.markCell}`}
                    {...rowCellProps('regroup', column)}
                    data-selected={selected}
                    data-linked={linked('regroup', column)}
                    aria-label={S.regroupCell(placeNameKo(column))}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'select', row: 'regroup', column })}
                  >
                    {state.regroups[String(column)] ?? ''}
                  </button>
                  <button
                    type="button"
                    className={styles.tenToggle}
                    data-ten-column={column}
                    data-linked={linked('ten', column)}
                    aria-pressed={ten}
                    aria-label={
                      ten ? S.tenOn(placeNameKo(column)) : S.tenToggle(placeNameKo(column))
                    }
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'toggle-ten', column })}
                  >
                    {S.tenMark}
                  </button>
                </div>
              );
            })}
          </div>

          <div className={styles.row} style={rowStyle} ref={topRowRef}>
            <span className={styles.rowLabel} />
            {renderedColumns.map((column) => {
              const digit = digitOf(a, state.aPoint, state.aPads, column);
              const crossed = state.crosses.includes(column);
              const pad = canPad('a', column);
              const placeable = isDecimal && selectedCard !== null;
              const clickable = placeable || pad || (state.op === 'sub' && digit !== null);
              const point = pointOn(a, state.aPoint, column, state.aPoint);
              const common = {
                ...rowCellProps('top', column),
                'data-filled': digit !== null,
                'data-crossed': crossed,
                'data-linked': state.op === 'sub' && linked('cross', column),
                'data-point': point ? 'true' : undefined,
              };
              if (!clickable) {
                return (
                  <span key={column} className={styles.cell} {...common}>
                    {digit ?? ''}
                  </span>
                );
              }
              return (
                <button
                  key={column}
                  type="button"
                  className={`${styles.cell} ${pad ? styles.cellPad : ''}`}
                  {...common}
                  aria-label={
                    placeable
                      ? S.placeCursor(placeNameKo(column))
                      : pad
                        ? S.padCell(placeNameKo(column))
                        : S.topCell(placeNameKo(column))
                  }
                  disabled={readOnly}
                  onClick={() => onTopCell(column)}
                >
                  {digit ?? ''}
                </button>
              );
            })}
          </div>

          <div className={styles.row} style={rowStyle}>
            <span className={`${styles.rowLabel} ${styles.op}`}>{S.operationSign[state.op]}</span>
            {renderedColumns.map((column) => {
              const digit = digitOf(b, state.bPoint, state.bPads, column);
              const pad = canPad('b', column);
              const point = pointOn(b, state.bPoint, column, state.bPoint);
              const common = {
                ...rowCellProps('bottom', column),
                'data-filled': digit !== null,
                'data-point': point ? 'true' : undefined,
              };
              if (!pad) {
                return (
                  <span key={column} className={styles.cell} {...common}>
                    {digit ?? ''}
                  </span>
                );
              }
              return (
                <button
                  key={column}
                  type="button"
                  className={`${styles.cell} ${styles.cellPad}`}
                  {...common}
                  aria-label={S.padCell(placeNameKo(column))}
                  disabled={readOnly}
                  onClick={() => onBottomCell(column)}
                >
                  {digit ?? ''}
                </button>
              );
            })}
          </div>

          <div className={styles.ruleRow} aria-hidden="true" />

          <div className={styles.row} style={rowStyle}>
            <span className={`${styles.rowLabel} ${styles.op}`}>=</span>
            {renderedColumns.map((column) => {
              const enabled = grid.resultColumns.includes(column);
              const digit = state.result[String(column)] ?? '';
              const selected = state.selected?.row === 'result' && state.selected.column === column;
              const point =
                alignment.alignment === 'point' &&
                alignment.pointColumn !== null &&
                grid.resultColumns.length > 0 &&
                (grid.resultColumns[0] ?? alignment.pointColumn) < alignment.pointColumn &&
                column === alignment.pointColumn;
              const common = {
                ...rowCellProps('result', column),
                'data-filled': digit !== '',
                'data-selected': selected,
                'data-point': point ? 'true' : undefined,
              };
              if (!enabled) {
                return (
                  <span key={column} className={`${styles.cell} ${styles.cellBlank}`} {...common} />
                );
              }
              return (
                <button
                  key={column}
                  type="button"
                  className={styles.cell}
                  {...common}
                  aria-label={S.resultCell(placeNameKo(column))}
                  disabled={readOnly}
                  onClick={() => dispatch({ type: 'select', row: 'result', column })}
                >
                  {digit}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Keypad
        disabled={readOnly}
        onDigit={(digit) => enterAt(keypadTarget, digit)}
        onClear={() => enterAt(keypadTarget, null)}
      />

      <p className={styles.hint} aria-live="polite">
        {selectedLabel} · {S.keyboardHint}
      </p>
    </div>
  );
}
