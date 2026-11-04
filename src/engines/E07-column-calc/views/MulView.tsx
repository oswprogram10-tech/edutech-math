/**
 * E07 곱셈 세로셈 화면.
 *
 * - b가 한 자리면 받아올림 한 줄, 두 자리면 자리마다 부분곱 줄을 그린다.
 * - `partial-products`는 a의 자리마다 부분곱 줄을 그린다.
 * - 칸 하나 = 입력 하나 = Action 하나. 오른쪽→왼쪽으로 자동 진행한다.
 * - 기대값은 화면에 쓰지 않는다. 자리 밀기 0만 점선으로 미리 보여 준다.
 */
import { useEffect, useMemo } from 'react';
import { computeGrid } from '../grid';
import { computeMulPlan, isPlaceholder } from '../grid-mul';
import type { MulPlan, MulRowPlan } from '../grid-mul';
import { paletteAt } from '../palette';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { CellRef, EditableRow } from '../types';
import styles from '../View.module.css';
import mulStyles from './MulView.module.css';
import { Keypad } from './Keypad';
import type { ColumnViewProps } from './AddSubView';

interface MulViewProps extends ColumnViewProps {
  readonly showInstructions?: boolean;
}

interface VisualRow {
  readonly row: EditableRow;
  readonly index?: number;
}

function rowStyle(columns: number, targetSize: number): React.CSSProperties {
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

export function MulView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
  showInstructions = true,
}: MulViewProps) {
  const grid = useMemo(() => computeGrid(state), [state]);
  const plan = useMemo(() => computeMulPlan(state), [state]);
  const columns = grid.displayColumns;
  // 높은 자리를 왼쪽에 그린다(세로셈 표기). 상태·격자 계산은 낮은 자리부터 그대로 둔다.
  const renderedColumns = [...columns].reverse();

  const defaultSelection = initialSelection(plan);
  const keypadTarget = state.selected ?? defaultSelection;

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
        <p className={styles.instructions}>{S.instructions.mul}</p>
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

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      {showInstructions ? <p className={styles.instructions}>{S.instructions.mul}</p> : null}

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
            if (!state.selected && defaultSelection) selectAt(defaultSelection);
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

          <div className={styles.row} style={rowsStyle}>
            <span className={styles.rowLabel} />
            {renderedColumns.map((column) => {
              const digit = grid.a ? (grid.a.digits[grid.a.intDigits - 1 - column] ?? '') : '';
              return (
                <span
                  key={column}
                  className={styles.cell}
                  data-row="top"
                  data-column={column}
                  data-filled={digit !== ''}
                >
                  {digit}
                </span>
              );
            })}
          </div>

          <div className={styles.row} style={rowsStyle}>
            <span className={`${styles.rowLabel} ${styles.op}`}>{S.operationSign.mul}</span>
            {renderedColumns.map((column) => {
              const digit = grid.b ? (grid.b.digits[grid.b.intDigits - 1 - column] ?? '') : '';
              return (
                <span
                  key={column}
                  className={styles.cell}
                  data-row="bottom"
                  data-column={column}
                  data-filled={digit !== ''}
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
                          disabled={readOnly}
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
                        disabled={readOnly}
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
                  aria-label={S.resultCell(placeNameKo(column))}
                  disabled={readOnly}
                  onClick={() => selectAt(cell)}
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

      <p className={styles.hint} aria-live="polite">
        {keypadLabel} · {S.keyboardHint}
      </p>
    </div>
  );
}
