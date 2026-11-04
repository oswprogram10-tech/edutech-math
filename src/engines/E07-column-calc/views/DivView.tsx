/**
 * E07 나눗셈 세로셈 화면.
 *
 * - 몫 칸은 나누어지는 수의 모든 열에 연다(몫 자릿수를 미리 알려 주지 않는다).
 * - 단계는 학생이 쓴 몫에서 생긴다. 곱·뺄셈·내림 줄도 학생 값만 그린다.
 * - 기대값(정답 몫·곱·나머지)은 DOM 텍스트·aria-label·data-*에 쓰지 않는다.
 *   배수 사다리의 배수 표는 명세가 허용한 비계다.
 * - 모든 조작은 Pointer Events 또는 키보드로 한다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { computeDivPlan, divAlarm, divComplete, estimateOver, estimatePartial } from '../grid-div';
import type { DivPlan } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type {
  CellRef,
  ColumnCalcAction,
  ColumnCalcConfig,
  ColumnCalcState,
  EditableRow,
} from '../types';
import styles from '../View.module.css';
import divStyles from './DivView.module.css';
import { EstimateLadder } from './EstimateLadder';
import { Keypad } from './Keypad';

interface DivViewProps extends EngineViewProps<
  ColumnCalcConfig,
  ColumnCalcState,
  ColumnCalcAction
> {
  readonly showInstructions?: boolean;
}

interface VisualRow {
  readonly row: EditableRow;
  readonly index?: number;
}

function rowStyle(columns: number, targetSize: number): CSSProperties {
  return {
    gridTemplateColumns: `5.6rem repeat(${Math.max(columns, 1)}, minmax(${targetSize}px, 1fr))`,
  };
}

function divTop(state: ColumnCalcState): number {
  return Math.max(0, state.aText.replace(/\D/g, '').length - 1);
}

function visualRows(plan: DivPlan): VisualRow[] {
  const rows: VisualRow[] = [{ row: 'quotient' }];
  for (const step of plan.steps) {
    rows.push({ row: 'div-product', index: step.column });
    rows.push({ row: 'div-diff', index: step.column });
  }
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

export function DivView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
  showInstructions = true,
}: DivViewProps) {
  const plan = useMemo(() => computeDivPlan(state), [state]);
  const top = divTop(state);
  const allColumns: number[] = [];
  for (let column = 0; column <= top; column += 1) allColumns.push(column);
  // 높은 자리를 왼쪽에 그린다(세로셈 표기). 상태 계산은 낮은 자리부터 그대로 둔다.
  const renderedColumns = [...allColumns].reverse();

  const [candidate, setCandidate] = useState(1);
  const maxMultiple = state.estimateMaxMultiple;

  const defaultSelection: CellRef = { row: 'quotient', column: top };
  const keypadTarget = state.selected ?? defaultSelection;

  const barSetting = state.estimateBarShow;
  const barAllowed =
    barSetting !== false &&
    (barSetting === 'C-P'
      ? cpa === 'C' || cpa === 'P'
      : barSetting === 'C'
        ? cpa === 'C'
        : cpa === 'P');
  const onQuotient = keypadTarget.row === 'quotient';
  const showLadder = barAllowed && onQuotient && !readOnly;
  const ladderColumn = keypadTarget.column;

  function allowedColumns(cell: CellRef): readonly number[] {
    if (cell.row === 'quotient') return allColumns;
    const step = plan.steps.find((entry) => entry.column === cell.index);
    if (!step) return [];
    if (cell.row === 'div-product') return step.productColumns;
    if (cell.row === 'div-diff') return step.rowColumns;
    return [];
  }

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
    const allowed = allowedColumns(keypadTarget);
    const at = allowed.indexOf(keypadTarget.column);
    const next = at < 0 ? nearest(allowed, keypadTarget.column) : allowed[at + delta];
    if (next === undefined) return;
    selectAt({ ...keypadTarget, column: next });
  }

  function moveRow(delta: 1 | -1): void {
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
    const allowed = allowedColumns(targetCell);
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

  function preview(k: number): void {
    if (readOnly || !onQuotient) return;
    const bounded = Math.min(maxMultiple, Math.max(1, k));
    setCandidate(bounded);
    dispatch({ type: 'try-estimate', column: ladderColumn, k: bounded });
  }

  function choose(k: number): void {
    if (readOnly || !onQuotient) return;
    const bounded = Math.min(maxMultiple, Math.max(1, k));
    setCandidate(bounded);
    enterAt({ row: 'quotient', column: ladderColumn }, String(bounded));
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

      if (showLadder && event.key === '[') {
        event.preventDefault();
        preview(candidate - 1);
      } else if (showLadder && event.key === ']') {
        event.preventDefault();
        preview(candidate + 1);
      } else if (showLadder && event.key === 'Enter') {
        event.preventDefault();
        choose(candidate);
      } else if (/^[0-9]$/.test(event.key)) {
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

  const rowsStyle = rowStyle(allColumns.length, targetSize);
  const reading = plan.reading;
  const alarm = divAlarm(state, plan, state.alarmEnabled);
  const complete = divComplete(state, plan);

  function cellLabel(cell: CellRef): string {
    if (cell.row === 'quotient') return S.quotientCell(placeNameKo(cell.column));
    if (cell.row === 'div-product' && cell.index !== undefined) {
      return S.divProductCell(placeNameKo(cell.column), cell.index);
    }
    if (cell.row === 'div-diff' && cell.index !== undefined) {
      return S.divDiffCell(placeNameKo(cell.column), cell.index);
    }
    return placeNameKo(cell.column);
  }

  const keypadLabel = S.selectedCell(cellLabel(keypadTarget));

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      {showInstructions ? <p className={styles.instructions}>{S.instructions.div}</p> : null}

      <div className={divStyles.layout}>
        <div className={styles.gridScroll}>
          <div
            className={`${styles.grid} ${divStyles.grid}`}
            data-testid="column-grid"
            data-mode="div"
            role="group"
            aria-label={S.canvasLabel}
            tabIndex={0}
            onFocus={(event) => {
              if (event.target !== event.currentTarget || readOnly) return;
              if (!state.selected) selectAt(defaultSelection);
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

            <div className={styles.row} style={rowsStyle}>
              <span className={styles.rowLabel}>{S.rowQuotient}</span>
              {renderedColumns.map((column) => {
                const digit = state.quotient[String(column)] ?? '';
                const selected =
                  state.selected?.row === 'quotient' && state.selected.column === column;
                const gap =
                  state.flagSkippedZero &&
                  reading.skippedZero &&
                  digit === '' &&
                  reading.quotientHighest !== null &&
                  column < reading.quotientHighest;
                return (
                  <button
                    key={column}
                    type="button"
                    className={`${styles.cell} ${divStyles.quotient}`}
                    data-row="quotient"
                    data-column={column}
                    data-filled={digit !== ''}
                    data-selected={selected}
                    data-gap={gap || undefined}
                    data-flagged={isFlagged({ row: 'quotient', column })}
                    aria-label={S.quotientCell(placeNameKo(column))}
                    disabled={readOnly}
                    onClick={() => selectAt({ row: 'quotient', column })}
                  >
                    {digit}
                  </button>
                );
              })}
            </div>

            <div className={`${styles.row} ${divStyles.dividendRow}`} style={rowsStyle}>
              <span className={`${styles.rowLabel} ${divStyles.divisorLabel}`}>
                <span className={divStyles.divisor}>{state.bText}</span>
                <span aria-hidden="true">)</span>
              </span>
              {renderedColumns.map((column) => {
                const digit = state.aText.charAt(top - column);
                return (
                  <span
                    key={column}
                    className={styles.cell}
                    data-row="dividend"
                    data-column={column}
                  >
                    {digit}
                  </span>
                );
              })}
            </div>

            {plan.steps.map((step) => (
              <div key={`step-${step.column}`} className={divStyles.step}>
                <div className={styles.row} style={rowsStyle}>
                  <span className={styles.rowLabel}>{S.rowDivProduct(step.column)}</span>
                  {renderedColumns.map((column) => {
                    const active = step.productColumns.includes(column);
                    const selected =
                      state.selected?.row === 'div-product' &&
                      state.selected.index === step.column &&
                      state.selected.column === column;
                    const digit = state.divProducts[String(step.column)]?.[String(column)] ?? '';
                    if (!active) {
                      return (
                        <span
                          key={column}
                          className={`${styles.cell} ${styles.cellBlank}`}
                          data-row="div-product"
                          data-index={step.column}
                          data-column={column}
                        />
                      );
                    }
                    return (
                      <button
                        key={column}
                        type="button"
                        className={styles.cell}
                        data-row="div-product"
                        data-index={step.column}
                        data-column={column}
                        data-selected={selected}
                        data-flagged={isFlagged({
                          row: 'div-product',
                          column,
                          index: step.column,
                        })}
                        aria-label={S.divProductCell(placeNameKo(column), step.column)}
                        disabled={readOnly}
                        onClick={() => selectAt({ row: 'div-product', column, index: step.column })}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>

                <div className={`${styles.row} ${divStyles.diffRow}`} style={rowsStyle}>
                  <span className={styles.rowLabel}>{S.rowDivDiff(step.column)}</span>
                  {renderedColumns.map((column) => {
                    const active = step.rowColumns.includes(column);
                    const selected =
                      state.selected?.row === 'div-diff' &&
                      state.selected.index === step.column &&
                      state.selected.column === column;
                    const digit = state.divDiffs[String(step.column)]?.[String(column)] ?? '';
                    const isBring = step.bringColumns.includes(column);
                    if (!active) {
                      return (
                        <span
                          key={column}
                          className={`${styles.cell} ${styles.cellBlank}`}
                          data-row="div-diff"
                          data-index={step.column}
                          data-column={column}
                        />
                      );
                    }
                    return (
                      <button
                        key={column}
                        type="button"
                        className={`${styles.cell} ${isBring ? divStyles.bring : ''}`}
                        data-row="div-diff"
                        data-index={step.column}
                        data-column={column}
                        data-bring={isBring || undefined}
                        data-selected={selected}
                        data-flagged={isFlagged({
                          row: 'div-diff',
                          column,
                          index: step.column,
                        })}
                        aria-label={S.divDiffCell(placeNameKo(column), step.column)}
                        disabled={readOnly}
                        onClick={() => selectAt({ row: 'div-diff', column, index: step.column })}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showLadder ? (
          <EstimateLadder
            key={ladderColumn}
            cpa={cpa}
            targetSize={targetSize}
            divisor={plan.reading.divisor}
            partial={estimatePartial(state, reading, ladderColumn)}
            maxMultiple={maxMultiple}
            candidate={candidate}
            over={estimateOver(state, reading, ladderColumn, candidate)}
            onPreview={preview}
            onChoose={choose}
          />
        ) : null}
      </div>

      {alarm ? (
        <p className={divStyles.alarm} role="status" data-testid="div-alarm">
          <span aria-hidden="true">⚠</span> {S.alarmText}
        </p>
      ) : null}

      <Keypad
        disabled={readOnly}
        onDigit={(digit) => enterAt(keypadTarget, digit)}
        onClear={() => enterAt(keypadTarget, null)}
      />

      <div className={divStyles.footer}>
        <button
          type="button"
          className={divStyles.flagButton}
          aria-pressed={isFlagged(keypadTarget)}
          disabled={readOnly}
          onClick={toggleFlag}
        >
          {isFlagged(keypadTarget) ? S.unflagCell(cellLabel(keypadTarget)) : S.flagHint}
        </button>
        {state.rewindEnabled && complete ? (
          <button
            type="button"
            className={divStyles.rewindButton}
            disabled={readOnly || state.rewound}
            onClick={() => dispatch({ type: 'rewind' })}
          >
            {state.rewound ? S.rewoundText : S.rewind}
          </button>
        ) : null}
      </div>

      <p className={styles.hint} aria-live="polite">
        {keypadLabel} · {S.keyboardDivHint}
      </p>
    </div>
  );
}
