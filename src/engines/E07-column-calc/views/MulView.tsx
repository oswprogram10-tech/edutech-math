/**
 * E07 곱셈 세로셈 화면.
 *
 * - b가 한 자리면 받아올림 한 줄, 두 자리면 자리마다 부분곱 줄을 그린다.
 * - `partial-products`는 a의 자리마다 부분곱 줄을 그린다.
 * - 소수 곱셈(decimal + mul)은 소수점을 뺀 숫자열을 자연수로 보고 같은 격자를 쓴다.
 *   결과 줄에 소수점을 놓고, 필요하면 어림값·자릿값 기둥 시프트 데모를 함께 보인다.
 * - 칸 하나 = 입력 하나 = Action 하나. 오른쪽→왼쪽으로 자동 진행한다.
 * - 기대값은 화면에 쓰지 않는다. 자리 밀기 0만 점선으로 미리 보여 준다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDrag } from '../../../core/engine-sdk';
import { computeGrid, isDecimalMul, mulAlignment } from '../grid';
import type { ParsedNumber } from '../grid';
import { computeMulPlan, isPlaceholder } from '../grid-mul';
import type { MulPlan, MulRowPlan } from '../grid-mul';
import { paletteAt } from '../palette';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { CellRef, EditableRow } from '../types';
import styles from '../View.module.css';
import mulStyles from './MulView.module.css';
import { EstimateBox } from './EstimateBox';
import { Keypad } from './Keypad';
import { ShiftDemo } from './ShiftDemo';
import type { ColumnViewProps } from './AddSubView';

interface MulViewProps extends ColumnViewProps {
  readonly showInstructions?: boolean;
}

interface VisualRow {
  readonly row: EditableRow;
  readonly index?: number;
}

function rowStyle(columns: number, targetSize: number): CSSProperties {
  return {
    gridTemplateColumns: `5.2rem repeat(${Math.max(columns, 1)}, minmax(${targetSize}px, 1fr))`,
  };
}

function initialSelection(plan: MulPlan | null): CellRef | null {
  if (!plan) return null;
  const first = plan.rows[0];
  const column = first?.columns[0];
  if (first && column !== undefined) {
    return { row: 'partial', column, index: first.index };
  }
  const low = plan.requiredColumns[0];
  return low === undefined ? null : { row: 'result', column: low };
}

function allowedColumns(
  selection: CellRef,
  plan: MulPlan,
  displayColumns: readonly number[],
): readonly number[] {
  if (selection.row === 'result') return plan.resultColumns;
  if (selection.row === 'partial') {
    return plan.rows[selection.index ?? 0]?.columns ?? [];
  }
  if (selection.row === 'partial-carry') {
    return plan.rows[selection.index ?? 0]?.carryColumns ?? [];
  }
  if (selection.row === 'carry') return displayColumns;
  return [];
}

function visualRows(plan: MulPlan): VisualRow[] {
  const rows: VisualRow[] = [];
  if (plan.style === 'carry' && plan.rows.length === 0) {
    rows.push({ row: 'carry' });
  }
  for (const row of plan.rows) {
    if (plan.style === 'carry') rows.push({ row: 'partial-carry', index: row.index });
    rows.push({ row: 'partial', index: row.index });
  }
  rows.push({ row: 'result' });
  return rows;
}

function nearest(columns: readonly number[], column: number): number | undefined {
  if (columns.length === 0) return undefined;
  let best = columns[0];
  for (const candidate of columns) {
    if (best === undefined) best = candidate;
    else if (Math.abs(candidate - column) < Math.abs(best - column)) best = candidate;
  }
  return best;
}

/**
 * 격자 열에 놓인 수의 숫자. 소수 곱셈은 소수점을 뺀 숫자열을 오른쪽 끝(0)에
 * 맞춰 그린다. `point`가 null이면(카드를 아직 안 놓음) 빈칸이다.
 */
function operandDigit(parsed: ParsedNumber | null, point: number | null, column: number): string {
  if (!parsed || point === null) return '';
  const rightmost = point - parsed.fracDigits;
  const index = parsed.digits.length - 1 - (column - rightmost);
  if (index < 0 || index >= parsed.digits.length) return '';
  return parsed.digits[index] ?? '';
}

function pointAt(parsed: ParsedNumber | null, point: number | null, column: number): boolean {
  if (!parsed || point === null || parsed.fracDigits === 0) return false;
  return column === point;
}

export function MulView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
  showInstructions = true,
}: MulViewProps) {
  const grid = useMemo(() => computeGrid(state), [state]);
  const plan = useMemo(() => computeMulPlan(state), [state]);
  const decimalMul = isDecimalMul(state);
  const alignment = decimalMul ? mulAlignment(state) : grid.alignment;
  const aligned = alignment.aligned;
  const columns = grid.displayColumns;
  // 높은 자리를 왼쪽에 그린다(세로셈 표기). 상태·격자 계산은 낮은 자리부터 그대로 둔다.
  const renderedColumns = [...columns].reverse();

  const [cardMode, setCardMode] = useState(state.mode);
  const [cardSelected, setCardSelected] = useState(false);
  const [dropColumn, setDropColumn] = useState(0);
  const topRowRef = useRef<HTMLDivElement>(null);
  const movedB = useRef(false);

  const activeCard = decimalMul && state.placeCards && cardMode === state.mode && cardSelected;
  const magnetOn = (config.magnetAlign ?? 'C-P') !== false && cpa !== 'A';

  const defaultSelection = initialSelection(plan);
  const keypadTarget = aligned ? (state.selected ?? defaultSelection) : null;

  function enterAt(cell: CellRef | null, digit: string | null): void {
    if (readOnly || !cell) return;
    dispatch({
      type: 'enter',
      row: cell.row,
      column: cell.column,
      digit,
      ...(cell.index === undefined ? {} : { index: cell.index }),
    });
  }

  function selectAt(cell: CellRef): void {
    if (readOnly) return;
    dispatch({
      type: 'select',
      row: cell.row,
      column: cell.column,
      ...(cell.index === undefined ? {} : { index: cell.index }),
    });
  }

  function moveColumn(delta: 1 | -1): void {
    if (!plan || !keypadTarget) return;
    const allowed = allowedColumns(keypadTarget, plan, columns);
    const at = allowed.indexOf(keypadTarget.column);
    const next = at < 0 ? nearest(allowed, keypadTarget.column) : allowed[at + delta];
    if (next === undefined) return;
    selectAt({ ...keypadTarget, column: next });
  }

  function moveRow(delta: 1 | -1): void {
    if (!plan || !keypadTarget) return;
    const rows = visualRows(plan);
    const at = rows.findIndex(
      (entry) => entry.row === keypadTarget.row && entry.index === keypadTarget.index,
    );
    if (at < 0) return;
    const target = rows[at + delta];
    if (!target) return;
    const targetCell: CellRef = {
      row: target.row,
      column: keypadTarget.column,
      ...(target.index === undefined ? {} : { index: target.index }),
    };
    const allowed = allowedColumns(targetCell, plan, columns);
    const column = allowed.includes(keypadTarget.column)
      ? keypadTarget.column
      : nearest(allowed, keypadTarget.column);
    if (column === undefined) return;
    selectAt({ ...targetCell, column });
  }

  function isFlagged(cell: CellRef | null): boolean {
    if (!cell) return false;
    return state.flagged.some(
      (entry) =>
        entry.row === cell.row && entry.column === cell.column && entry.index === cell.index,
    );
  }

  function toggleFlag(): void {
    if (readOnly || !keypadTarget) return;
    dispatch({
      type: 'flag-cell',
      row: keypadTarget.row,
      column: keypadTarget.column,
      ...(keypadTarget.index === undefined ? {} : { index: keypadTarget.index }),
    });
  }

  function placePoint(column: number | null): void {
    if (readOnly || !decimalMul) return;
    dispatch({ type: 'place-point', target: 'result', column });
  }

  function selectBCard(): void {
    if (readOnly || !decimalMul || !state.placeCards) return;
    if (movedB.current) {
      movedB.current = false;
      return;
    }
    setCardMode(state.mode);
    setCardSelected(!activeCard);
    setDropColumn(state.bPoint ?? grid.b?.fracDigits ?? 0);
  }

  function snapFor(column: number): number {
    if (!magnetOn || !grid.b) return column;
    // 소수 곱셈의 자석은 맨 오른쪽 숫자를 맞춘다.
    return grid.b.fracDigits;
  }

  function placeCard(column: number): void {
    if (readOnly || !decimalMul || !state.placeCards) return;
    dispatch({ type: 'place', number: 'b', pointColumn: snapFor(column) });
    setCardSelected(false);
  }

  function columnFromClient(clientX: number): number | null {
    const row = topRowRef.current;
    if (!row) return null;
    for (const cellElement of row.querySelectorAll<HTMLElement>('[data-column]')) {
      const rect = cellElement.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const value = Number(cellElement.dataset['column']);
        return Number.isInteger(value) ? value : null;
      }
    }
    return null;
  }

  const dragB = useDrag({
    getPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    disabled: readOnly || !decimalMul || !state.placeCards,
    onStart: () => {
      movedB.current = false;
    },
    onMove: (info) => {
      if (Math.abs(info.delta.x) + Math.abs(info.delta.y) > 6) movedB.current = true;
    },
    onEnd: (info) => {
      if (!movedB.current) return;
      const column = columnFromClient(info.current.x);
      if (column !== null) placeCard(column);
    },
  });

  function onTopCell(column: number): void {
    if (readOnly) return;
    if (activeCard) placeCard(column);
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

      // 어림값 입력 상자 안에서는 EstimateBox가 직접 처리한다.
      if (
        state.phase === 'estimate' &&
        target instanceof Element &&
        target.closest('[data-estimate-box="true"]') !== null
      ) {
        return;
      }

      if (activeCard) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          placeCard(dropColumn);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setCardSelected(false);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setDropColumn((value) => Math.min(plan?.high ?? value, value + 1));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          setDropColumn((value) => Math.max(0, value - 1));
        }
        return;
      }

      if (decimalMul && event.key === '.') {
        event.preventDefault();
        if (keypadTarget?.row === 'result') placePoint(keypadTarget.column);
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        enterAt(keypadTarget, event.key);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        enterAt(keypadTarget, null);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveColumn(1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveColumn(-1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveRow(-1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveRow(1);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFlag();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!plan) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
        <p className={styles.instructions}>
          {decimalMul ? S.decimalMulInstruction : S.instructions.mul}
        </p>
      </div>
    );
  }

  const rowsStyle = rowStyle(columns.length, targetSize);
  const colorOf = (row: MulRowPlan): number | null => {
    const color = state.rowColors[String(row.index)];
    return color === undefined ? null : color;
  };

  function cellLabel(cell: CellRef): string {
    if (cell.row === 'partial' && cell.index !== undefined) {
      return S.partialCell(placeNameKo(cell.column), cell.index);
    }
    if (cell.row === 'partial-carry' && cell.index !== undefined) {
      return S.partialCarryCell(placeNameKo(cell.column), cell.index);
    }
    if (cell.row === 'carry') return S.carryCell(placeNameKo(cell.column));
    return S.resultCell(placeNameKo(cell.column));
  }

  const keypadLabel = keypadTarget ? S.selectedCell(cellLabel(keypadTarget)) : '';
  const pointBlocked = decimalMul && state.requireEstimate && state.phase === 'estimate';

  if (decimalMul && state.shiftHideGrid) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
        {showInstructions ? <p className={styles.instructions}>{S.decimalMulInstruction}</p> : null}
        <ShiftDemo
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
          mode={state.mode}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      {showInstructions ? (
        <p className={styles.instructions}>
          {decimalMul ? S.decimalMulInstruction : S.instructions.mul}
        </p>
      ) : null}

      {decimalMul && state.placeCards ? (
        <>
          <div className={styles.cards} role="group" aria-label={S.cardsLabel}>
            <div className={styles.card} data-testid="card-a" data-placed={state.aPoint !== null}>
              <span className={styles.cardNumber}>{state.aText}</span>
              <span className={styles.cardState}>{S.placed}</span>
            </div>
            <button
              type="button"
              className={styles.card}
              data-testid="card-b"
              data-placed={state.bPoint !== null}
              aria-pressed={activeCard}
              aria-label={activeCard ? S.cardSelected(state.bText) : S.cardPick(state.bText)}
              disabled={readOnly}
              {...dragB.handlers}
              onClick={selectBCard}
            >
              <span className={styles.cardNumber}>{state.bText}</span>
              <span className={styles.cardState}>
                {state.bPoint === null ? S.notPlaced : S.placed}
              </span>
            </button>
            {cpa === 'A' ? null : (
              <span className={styles.badge}>{magnetOn ? S.magnetOn : S.magnetOff}</span>
            )}
          </div>
          {activeCard ? <p className={styles.hint}>{S.cardDragHint}</p> : null}
        </>
      ) : null}

      {decimalMul ? (
        <EstimateBox
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
          mode={state.mode}
        />
      ) : null}

      <div className={styles.gridScroll}>
        <div
          className={styles.grid}
          data-testid="column-grid"
          data-mul-style={plan.style}
          role="group"
          aria-label={S.canvasLabel}
          tabIndex={0}
          onFocus={(event) => {
            if (event.target !== event.currentTarget || readOnly) return;
            if (!state.selected && defaultSelection && keypadTarget) selectAt(defaultSelection);
          }}
        >
          {cpa === 'C' ? (
            <div className={styles.row} style={rowsStyle} aria-hidden="true">
              <span className={styles.rowLabel} />
              {renderedColumns.map((column) => (
                <span key={column} className={styles.placeHead}>
                  {placeNameKo(column)}
                </span>
              ))}
            </div>
          ) : null}

          {plan.style === 'carry' && plan.rows.length === 0 ? (
            <div className={styles.row} style={rowsStyle}>
              <span className={styles.rowLabel}>{S.rowCarry}</span>
              {renderedColumns.map((column) => {
                const selected =
                  state.selected?.row === 'carry' && state.selected.column === column;
                return (
                  <button
                    key={column}
                    type="button"
                    className={`${styles.cell} ${styles.markCell}`}
                    data-row="carry"
                    data-column={column}
                    data-selected={selected}
                    aria-label={S.carryCell(placeNameKo(column))}
                    disabled={readOnly}
                    onClick={() => selectAt({ row: 'carry', column })}
                  >
                    {state.carries[String(column)] ?? ''}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className={styles.row} style={rowsStyle} ref={topRowRef}>
            <span className={styles.rowLabel} />
            {renderedColumns.map((column) => {
              const digit = operandDigit(grid.a, state.aPoint, column);
              const point = decimalMul && pointAt(grid.a, state.aPoint, column);
              const common = {
                'data-row': 'top',
                'data-column': column,
                'data-filled': digit !== '',
                'data-point': point ? 'true' : undefined,
              };
              if (activeCard) {
                return (
                  <button
                    key={column}
                    type="button"
                    className={`${styles.cell} ${styles.cellPad}`}
                    {...common}
                    aria-label={S.placeCursor(placeNameKo(column))}
                    disabled={readOnly}
                    onClick={() => onTopCell(column)}
                  >
                    {digit}
                  </button>
                );
              }
              return (
                <span key={column} className={styles.cell} {...common}>
                  {digit}
                </span>
              );
            })}
          </div>

          <div className={styles.row} style={rowsStyle}>
            <span className={`${styles.rowLabel} ${styles.op}`}>{S.operationSign.mul}</span>
            {renderedColumns.map((column) => {
              const digit = operandDigit(grid.b, state.bPoint, column);
              const point = decimalMul && pointAt(grid.b, state.bPoint, column);
              return (
                <span
                  key={column}
                  className={styles.cell}
                  data-row="bottom"
                  data-column={column}
                  data-filled={digit !== ''}
                  data-point={point ? 'true' : undefined}
                >
                  {digit}
                </span>
              );
            })}
          </div>

          {plan.rows.map((row) => {
            const color = colorOf(row);
            const entry = color === null ? null : paletteAt(color);
            return (
              <div key={`row-${row.index}`} className={mulStyles.rowGroup}>
                {plan.style === 'carry' ? (
                  <div className={styles.row} style={rowsStyle}>
                    <span className={styles.rowLabel}>{S.rowPartialCarry}</span>
                    {renderedColumns.map((column) => {
                      const active = row.carryColumns.includes(column);
                      const selected =
                        state.selected?.row === 'partial-carry' &&
                        state.selected.index === row.index &&
                        state.selected.column === column;
                      const digit = state.partialCarries[row.index]?.[String(column)] ?? '';
                      if (!active) {
                        return (
                          <span
                            key={column}
                            className={`${styles.cell} ${styles.cellBlank}`}
                            data-row="partial-carry"
                            data-index={row.index}
                            data-column={column}
                          />
                        );
                      }
                      return (
                        <button
                          key={column}
                          type="button"
                          className={`${styles.cell} ${styles.markCell}`}
                          data-row="partial-carry"
                          data-index={row.index}
                          data-column={column}
                          data-selected={selected}
                          aria-label={S.partialCarryCell(placeNameKo(column), row.index)}
                          disabled={readOnly || !aligned}
                          onClick={() =>
                            selectAt({ row: 'partial-carry', column, index: row.index })
                          }
                        >
                          {digit}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className={styles.row} style={rowsStyle}>
                  <span className={styles.rowLabel}>
                    {entry ? (
                      <span
                        className={mulStyles.band}
                        data-pattern={entry.pattern}
                        style={{ backgroundColor: entry.fill, color: entry.ink }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {S.rowPartial(row.index)}
                  </span>
                  {renderedColumns.map((column) => {
                    const active = row.columns.includes(column);
                    const placeholder = isPlaceholder(row, column);
                    const selected =
                      state.selected?.row === 'partial' &&
                      state.selected.index === row.index &&
                      state.selected.column === column;
                    const digit = state.partials[row.index]?.[String(column)] ?? '';
                    const cellStyle = entry
                      ? { backgroundColor: entry.fill, borderColor: entry.ink, color: entry.ink }
                      : undefined;
                    const colorAttr = color === null ? undefined : color;
                    if (placeholder) {
                      return (
                        <span
                          key={column}
                          className={`${styles.cell} ${styles.cellPad} ${mulStyles.placeholder}`}
                          data-row="partial"
                          data-index={row.index}
                          data-column={column}
                          data-placeholder="true"
                          data-row-color={colorAttr}
                          aria-label={S.placeholderCell(placeNameKo(column))}
                        >
                          0
                        </span>
                      );
                    }
                    if (!active) {
                      return (
                        <span
                          key={column}
                          className={`${styles.cell} ${styles.cellBlank}`}
                          data-row="partial"
                          data-index={row.index}
                          data-column={column}
                          data-row-color={colorAttr}
                        />
                      );
                    }
                    return (
                      <button
                        key={column}
                        type="button"
                        className={styles.cell}
                        style={cellStyle}
                        data-row="partial"
                        data-index={row.index}
                        data-column={column}
                        data-row-color={colorAttr}
                        data-selected={selected}
                        data-flagged={isFlagged({
                          row: 'partial',
                          column,
                          index: row.index,
                        })}
                        aria-label={S.partialCell(placeNameKo(column), row.index)}
                        disabled={readOnly || !aligned}
                        onClick={() => selectAt({ row: 'partial', column, index: row.index })}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className={styles.ruleRow} aria-hidden="true" />

          <div className={styles.row} style={rowsStyle}>
            <span className={`${styles.rowLabel} ${styles.op}`}>=</span>
            {renderedColumns.map((column) => {
              const enabled = plan.resultColumns.includes(column);
              const digit = state.result[String(column)] ?? '';
              const selected = state.selected?.row === 'result' && state.selected.column === column;
              const cell: CellRef = { row: 'result', column };
              if (!enabled) {
                return (
                  <span
                    key={column}
                    className={`${styles.cell} ${styles.cellBlank}`}
                    data-row="result"
                    data-column={column}
                  />
                );
              }
              return (
                <button
                  key={column}
                  type="button"
                  className={styles.cell}
                  data-row="result"
                  data-column={column}
                  data-filled={digit !== ''}
                  data-selected={selected}
                  data-flagged={isFlagged(cell)}
                  data-point={decimalMul && state.resultPoint === column ? 'true' : undefined}
                  aria-label={S.resultCell(placeNameKo(column))}
                  disabled={readOnly || !aligned}
                  onClick={() => selectAt(cell)}
                >
                  {digit}
                </button>
              );
            })}
          </div>

          {decimalMul ? (
            <div className={styles.row} style={rowsStyle}>
              <span className={styles.rowLabel}>{S.pointRow}</span>
              {renderedColumns.map((column) => {
                const enabled = plan.resultColumns.includes(column);
                const on = state.resultPoint === column;
                if (!enabled) {
                  return (
                    <span
                      key={column}
                      className={`${styles.cell} ${styles.cellBlank}`}
                      data-row="point"
                      data-column={column}
                    />
                  );
                }
                return (
                  <button
                    key={column}
                    type="button"
                    className={`${styles.cell} ${styles.pointButton}`}
                    data-row="point"
                    data-column={column}
                    data-on={on}
                    aria-pressed={on}
                    aria-label={
                      on ? S.pointCellOn(placeNameKo(column)) : S.pointCell(placeNameKo(column))
                    }
                    disabled={readOnly || !aligned || pointBlocked}
                    onClick={() => placePoint(column)}
                  >
                    {S.pointMark}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {pointBlocked ? <p className={styles.hint}>{S.estimateFirst}</p> : null}

      <Keypad
        disabled={readOnly || !keypadTarget}
        onDigit={(digit) => enterAt(keypadTarget, digit)}
        onClear={() => enterAt(keypadTarget, null)}
      />

      <div className={mulStyles.flagRow}>
        <button
          type="button"
          className={mulStyles.flagButton}
          aria-pressed={isFlagged(keypadTarget)}
          disabled={readOnly || !keypadTarget}
          onClick={toggleFlag}
        >
          {keypadTarget && isFlagged(keypadTarget)
            ? S.unflagCell(cellLabel(keypadTarget))
            : S.flagHint}
        </button>
      </div>

      {decimalMul && state.shiftBase !== null ? (
        <ShiftDemo
          config={config}
          state={state}
          dispatch={dispatch}
          cpa={cpa}
          readOnly={readOnly}
          targetSize={targetSize}
          mode={state.mode}
        />
      ) : null}

      <p className={styles.hint} aria-live="polite">
        {keypadLabel} · {S.keyboardHint}
      </p>
    </div>
  );
}
