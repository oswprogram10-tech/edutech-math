/**
 * E07 나눗셈 세로셈 화면.
 *
 * - 몫 칸은 나누어지는 수의 모든 열(소수면 low … top)에 연다.
 * - 단계는 학생이 쓴 몫에서 생긴다. 곱·뺄셈·내림 줄도 학생 값만 그린다.
 * - T078: 소수 피제수·몫 소수점·0 붙이기·확대경·소수점 옮기기를 더한다.
 *   decimal이 아니면 T047 화면과 같다(low = 0).
 * - 기대값(정답 몫·곱·나머지·점 자리·확대 배수)은 DOM 텍스트·aria-label·title·data-*에
 *   쓰지 않는다. 배수 사다리의 배수 표는 명세가 허용한 비계다.
 * - 모든 조작은 Pointer Events 또는 키보드로 한다.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { computeDivPlan, divAlarm, divComplete, estimateOver, estimatePartial } from '../grid-div';
import type { DivPlan } from '../grid-div';
import { divGridNumbers, firstQuotientColumn, gridDividendDigit } from '../grid-div-decimal';
import { isForeignKeyTarget, isTextEntryTarget } from '../keyboard';
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
import { Magnifier } from './Magnifier';

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

/** 처음 두 수의 소수점을 속이 빈 점으로 보인다(교과서 표기). */
function OriginalNumber({ text }: { text: string }) {
  const at = text.indexOf('.');
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={divStyles.hollowDot} aria-hidden="true">
        ·
      </span>
      {text.slice(at + 1)}
    </>
  );
}

export function DivView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
  showInstructions = true,
}: DivViewProps) {
  const numbers = useMemo(() => divGridNumbers(state), [state]);
  const plan = useMemo(() => computeDivPlan(state), [state]);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const top = numbers.top;
  const low = numbers.low;
  const closed = state.decimal && !numbers.gridOpen;
  const allColumns: number[] = [];
  for (let column = low; column <= top; column += 1) allColumns.push(column);
  // 높은 자리를 왼쪽에 그린다(세로셈 표기). 상태 계산은 낮은 자리부터 그대로 둔다.
  const renderedColumns = [...allColumns].reverse();

  const maxMultiple = state.estimateMaxMultiple;

  const firstColumn = state.decimal ? firstQuotientColumn(state) : null;
  const defaultColumn = state.decimal
    ? Math.min(top, Math.max(low, Math.max(0, firstColumn ?? 0)))
    : top;
  const defaultSelection: CellRef = { row: 'quotient', column: defaultColumn };
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
  const showLadder = barAllowed && onQuotient && !readOnly && !closed;
  const ladderColumn = keypadTarget.column;
  const tries = state.estimateTries[String(ladderColumn)] ?? [];
  const selected: number | null = tries.length === 0 ? null : (tries[tries.length - 1] ?? null);

  function allowedColumns(cell: CellRef): readonly number[] {
    if (cell.row === 'quotient') return closed ? [] : allColumns;
    const step = plan.steps.find((entry) => entry.column === cell.index);
    if (!step) return [];
    if (cell.row === 'div-product') return step.productColumns;
    if (cell.row === 'div-diff') return step.rowColumns;
    return [];
  }

  function enterAt(cell: CellRef | null, digit: string | null): void {
    if (readOnly || closed || !cell) return;
    dispatch({
      type: 'enter',
      row: cell.row,
      column: cell.column,
      digit,
      ...(cell.index === undefined ? {} : { index: cell.index }),
    });
  }

  function selectAt(cell: CellRef): void {
    if (readOnly || closed) return;
    dispatch({
      type: 'select',
      row: cell.row,
      column: cell.column,
      ...(cell.index === undefined ? {} : { index: cell.index }),
    });
  }

  function placePoint(column: number | null): void {
    if (readOnly || !state.decimal || closed) return;
    dispatch({ type: 'place-point', target: 'quotient', column });
  }

  function appendZero(): void {
    if (readOnly || !state.decimal || closed) return;
    dispatch({ type: 'pad-zero', number: 'a', column: low - 1 });
  }

  function removeZero(): void {
    if (readOnly || !state.decimal || closed) return;
    dispatch({ type: 'pad-zero', number: 'a', column: low });
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
    dispatch({ type: 'try-estimate', column: ladderColumn, k: bounded });
  }

  function choose(k: number): void {
    if (readOnly || !onQuotient) return;
    const bounded = Math.min(maxMultiple, Math.max(1, k));
    enterAt({ row: 'quotient', column: ladderColumn }, String(bounded));
  }

  function scale(side: 'dividend' | 'divisor', delta: 1 | -1): void {
    if (readOnly || !state.decimal) return;
    const current = side === 'dividend' ? state.scaleA : state.scaleB;
    const to = Math.min(3, Math.max(0, current + delta));
    if (to === current) return;
    dispatch({ type: 'scale', side, to });
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target) || isForeignKeyTarget(event.target, rootRef.current)) {
        return;
      }
      if (readOnly) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // 격자에 초점이 있을 때만 0 붙이기/떼기 키를 가로챈다(실행기 확대·축소와 겹치지 않게).
      const gridFocused =
        gridRef.current !== null &&
        (document.activeElement === gridRef.current ||
          (document.activeElement !== null && gridRef.current.contains(document.activeElement)));
      const zeroKey =
        event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_';
      if (state.decimal && gridFocused && zeroKey && !closed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === '+' || event.key === '=') appendZero();
        else removeZero();
        return;
      }

      if (state.decimal && event.key === '.' && keypadTarget.row === 'quotient' && !closed) {
        event.preventDefault();
        placePoint(keypadTarget.column);
      } else if (showLadder && event.key === '[') {
        event.preventDefault();
        preview((selected ?? 1) - 1);
      } else if (showLadder && event.key === ']') {
        event.preventDefault();
        preview((selected ?? 1) + 1);
      } else if (showLadder && event.key === 'Enter' && selected !== null) {
        event.preventDefault();
        choose(selected);
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
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  const rowsStyle = rowStyle(allColumns.length, targetSize);
  const reading = plan.reading;
  const alarm = divAlarm(state, plan, state.alarmEnabled);
  const complete = divComplete(state, plan);
  const showScalePanel = state.decimal && numbers.b.fracDigits > 0;
  const dividendText = `${numbers.G.text}${'0'.repeat(numbers.appended)}`;
  const pointMarker = (
    <span className={styles.pointDot} data-point-mark="true" aria-hidden="true">
      .
    </span>
  );

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
    <div ref={rootRef} className={styles.wrap} data-target-size={targetSize} data-cpa={cpa}>
      {showInstructions ? (
        <p className={styles.instructions}>
          {state.decimal ? S.divDecimalInstruction : S.instructions.div}
        </p>
      ) : null}

      {showScalePanel ? (
        <div className={divStyles.scalePanel} data-testid="scale-panel">
          <strong className={divStyles.scaleTitle}>{S.scaleTitle}</strong>
          <div className={divStyles.scaleRow}>
            <span className={divStyles.scaleLabel}>{S.dividendLabel}</span>
            <span className={divStyles.scaleNumber}>
              <OriginalNumber text={state.aText} />
            </span>
            <button
              type="button"
              className={divStyles.scaleButton}
              style={{ minHeight: targetSize, minWidth: targetSize }}
              data-testid="scale-dividend-right"
              aria-label={S.scaleRight(S.dividendLabel)}
              disabled={readOnly || state.scaleA >= 3}
              onClick={() => scale('dividend', 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className={divStyles.scaleButton}
              style={{ minHeight: targetSize, minWidth: targetSize }}
              data-testid="scale-dividend-left"
              aria-label={S.scaleLeft(S.dividendLabel)}
              disabled={readOnly || state.scaleA <= 0}
              onClick={() => scale('dividend', -1)}
            >
              <span aria-hidden="true">←</span>
            </button>
          </div>
          <div className={divStyles.scaleRow}>
            <span className={divStyles.scaleLabel}>{S.divisorLabel}</span>
            <span className={divStyles.scaleNumber}>
              <OriginalNumber text={state.bText} />
            </span>
            <button
              type="button"
              className={divStyles.scaleButton}
              style={{ minHeight: targetSize, minWidth: targetSize }}
              data-testid="scale-divisor-right"
              aria-label={S.scaleRight(S.divisorLabel)}
              disabled={readOnly || state.scaleB >= 3}
              onClick={() => scale('divisor', 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className={divStyles.scaleButton}
              style={{ minHeight: targetSize, minWidth: targetSize }}
              data-testid="scale-divisor-left"
              aria-label={S.scaleLeft(S.divisorLabel)}
              disabled={readOnly || state.scaleB <= 0}
              onClick={() => scale('divisor', -1)}
            >
              <span aria-hidden="true">←</span>
            </button>
          </div>
          <p className={divStyles.scaleHint}>{S.scaleHint}</p>
        </div>
      ) : null}

      {state.decimal && state.magnifier.length > 0 && cpa !== 'A' ? (
        <Magnifier state={state} dispatch={dispatch} targetSize={targetSize} readOnly={readOnly} />
      ) : null}

      <div className={divStyles.layout}>
        <div className={styles.gridScroll}>
          <div
            ref={gridRef}
            className={`${styles.grid} ${divStyles.grid}`}
            data-testid="column-grid"
            data-mode="div"
            data-decimal={state.decimal || undefined}
            data-closed={closed || undefined}
            role="group"
            aria-label={S.canvasLabel}
            tabIndex={0}
            onFocus={(event) => {
              if (event.target !== event.currentTarget || readOnly || closed) return;
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

            {closed ? (
              <p className={divStyles.closedNote} data-testid="grid-closed">
                {S.divisorNotWhole}
              </p>
            ) : null}

            <div className={styles.row} style={rowsStyle} data-testid="quotient-row">
              <span className={styles.rowLabel}>{S.rowQuotient}</span>
              {renderedColumns.map((column) => {
                const digit = state.quotient[String(column)] ?? '';
                const isSelected =
                  state.selected?.row === 'quotient' && state.selected.column === column;
                const gap =
                  state.flagSkippedZero &&
                  reading.skippedZero &&
                  digit === '' &&
                  reading.quotientHighest !== null &&
                  column < reading.quotientHighest;
                const point = state.decimal && state.quotientPoint === column;
                return (
                  <button
                    key={column}
                    type="button"
                    className={`${styles.cell} ${divStyles.quotient}`}
                    data-row="quotient"
                    data-column={column}
                    data-filled={digit !== ''}
                    data-selected={isSelected}
                    data-gap={gap || undefined}
                    data-point={point || undefined}
                    data-flagged={isFlagged({ row: 'quotient', column })}
                    aria-label={S.quotientCell(placeNameKo(column))}
                    disabled={readOnly || closed}
                    onClick={() => selectAt({ row: 'quotient', column })}
                  >
                    {digit}
                    {point ? pointMarker : null}
                  </button>
                );
              })}
            </div>

            {state.decimal ? (
              <div className={styles.row} style={rowsStyle} data-testid="quotient-point-row">
                <span className={styles.rowLabel}>{S.pointRow}</span>
                {renderedColumns.map((column) => {
                  const on = state.quotientPoint === column;
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
                        on
                          ? S.quotientPointCellOn(placeNameKo(column))
                          : S.quotientPointCell(placeNameKo(column))
                      }
                      disabled={readOnly || closed}
                      onClick={() => placePoint(column)}
                    >
                      {S.pointMark}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div
              className={`${styles.row} ${divStyles.dividendRow}`}
              style={rowsStyle}
              role="group"
              aria-label={S.dividendRowLabel(dividendText)}
            >
              <span className={`${styles.rowLabel} ${divStyles.divisorLabel}`}>
                <span className={divStyles.divisor}>{numbers.g.text}</span>
                <span aria-hidden="true">)</span>
              </span>
              {renderedColumns.map((column) => {
                const digit = gridDividendDigit(numbers, column);
                const appended = state.decimal && numbers.decimal && column < numbers.baseLow;
                const point = state.decimal && numbers.decimal && numbers.low < 0 && column === 0;
                return (
                  <span
                    key={column}
                    className={`${styles.cell} ${appended ? styles.cellPad : ''}`}
                    data-row="dividend"
                    data-column={column}
                    data-appended={appended || undefined}
                    data-point={point || undefined}
                    aria-label={appended ? S.appendedZeroCell(placeNameKo(column)) : undefined}
                  >
                    {digit}
                    {point ? pointMarker : null}
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
                    const isSelected =
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
                        data-selected={isSelected}
                        data-flagged={isFlagged({
                          row: 'div-product',
                          column,
                          index: step.column,
                        })}
                        aria-label={S.divProductCell(placeNameKo(column), step.column)}
                        disabled={readOnly || closed}
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
                    const isSelected =
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
                        data-selected={isSelected}
                        data-flagged={isFlagged({
                          row: 'div-diff',
                          column,
                          index: step.column,
                        })}
                        aria-label={S.divDiffCell(placeNameKo(column), step.column)}
                        disabled={readOnly || closed}
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
            selected={selected}
            over={selected === null ? false : estimateOver(state, reading, ladderColumn, selected)}
            onPreview={preview}
            onChoose={choose}
          />
        ) : null}
      </div>

      {state.decimal && state.extendLimit > 0 && !closed ? (
        <div className={divStyles.zeroRow}>
          <button
            type="button"
            className={divStyles.zeroButton}
            style={{ minHeight: targetSize }}
            data-testid="append-zero"
            disabled={readOnly || numbers.appended >= state.extendLimit}
            onClick={appendZero}
          >
            {S.appendZero}
          </button>
          {numbers.appended > 0 ? (
            <button
              type="button"
              className={divStyles.zeroButton}
              style={{ minHeight: targetSize }}
              data-testid="remove-zero"
              disabled={readOnly}
              onClick={removeZero}
            >
              {S.removeZero}
            </button>
          ) : null}
          {numbers.appended >= state.extendLimit ? (
            <span className={divStyles.zeroNote}>{S.extendZeroLimit}</span>
          ) : null}
        </div>
      ) : null}

      {alarm ? (
        <p className={divStyles.alarm} role="status" data-testid="div-alarm">
          <span aria-hidden="true">⚠</span> {S.alarmText}
        </p>
      ) : null}

      <Keypad
        disabled={readOnly || closed}
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
