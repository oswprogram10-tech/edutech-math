/**
 * 소수 곱셈의 어림값 입력 상자(순수 표시 + Action).
 *
 * - 숫자·소수점 하나를 받는다. 형식 검사·잠금은 reduce가 한다.
 * - Tab으로 들어와 숫자·`.`·Backspace·Enter로 조작할 수 있다.
 * - 신호등은 학생이 쓴 어림값과 학생 결과만 견준다(정답 값은 쓰지 않는다).
 */
import type { KeyboardEvent } from 'react';
import { decimalEstimate, decimalSignal } from '../grid-decimal';
import { columnCalcStrings as S } from '../strings.ko';
import styles from '../View.module.css';
import type { ColumnViewProps } from './AddSubView';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

export function EstimateBox({ state, dispatch, readOnly = false }: ColumnViewProps) {
  const phase = state.phase;
  const signal = decimalSignal(state);
  const ready = decimalEstimate(state) !== null;

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (readOnly || phase !== 'estimate') return;
    const key = event.key;
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'enter-estimate', digit: key });
    } else if (key === '.') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'enter-estimate', digit: '.' });
    } else if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'enter-estimate', digit: null });
    } else if (key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'lock-estimate' });
    }
  }

  function press(digit: string | null): void {
    if (readOnly) return;
    dispatch({ type: 'enter-estimate', digit });
  }

  return (
    <section
      className={styles.estimateSection}
      data-testid="decimal-estimate"
      data-estimate-box="true"
      aria-label={S.decimalEstimateLabel}
    >
      <div className={styles.estimateBar} role="group" aria-label={S.decimalEstimateLabel}>
        <span className={styles.estimateLabel}>{S.decimalEstimateLabel}</span>
        {phase === 'estimate' ? (
          <button
            type="button"
            className={styles.estimateCell}
            data-testid="decimal-estimate-cell"
            data-filled={state.estimate !== null}
            aria-label={S.decimalEstimateInput}
            disabled={readOnly}
            onKeyDown={onKeyDown}
            onClick={(event) => event.currentTarget.focus()}
          >
            {state.estimate ?? S.estimatePlaceholder}
          </button>
        ) : (
          <span
            className={styles.estimateCell}
            data-testid="decimal-estimate-cell"
            data-filled={state.estimate !== null}
            data-locked="true"
            aria-label={S.estimateLocked(state.estimate ?? '')}
          >
            {state.estimate ?? S.estimatePlaceholder}
          </span>
        )}

        {phase === 'estimate' ? (
          <button
            type="button"
            className={styles.lockButton}
            data-testid="decimal-estimate-lock"
            disabled={readOnly || !ready}
            onClick={() => dispatch({ type: 'lock-estimate' })}
          >
            {S.estimateApply}
          </button>
        ) : (
          <button
            type="button"
            className={styles.lockButton}
            data-testid="decimal-estimate-unlock"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'unlock-estimate' })}
          >
            {S.estimateUnlock}
          </button>
        )}
      </div>

      {phase === 'estimate' ? (
        <div className={styles.keypad} role="group" aria-label={S.decimalEstimateInput}>
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              className={styles.key}
              aria-label={S.estimateDigitKey(digit)}
              disabled={readOnly}
              onClick={() => press(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className={styles.key}
            aria-label={S.estimateDotKey}
            disabled={readOnly}
            onClick={() => press('.')}
          >
            .
          </button>
          <button
            type="button"
            className={`${styles.key} ${styles.keyClear}`}
            aria-label={S.clearCell}
            disabled={readOnly}
            onClick={() => press(null)}
          >
            {S.clearKey}
          </button>
        </div>
      ) : null}

      {signal === null ? null : (
        <div
          className={styles.signal}
          data-testid="estimate-signal"
          data-signal={signal}
          role="status"
          aria-label={S.signalLabel}
        >
          <span className={styles.signalShape} aria-hidden="true">
            {S.signalShape[signal]}
          </span>
          <span>{S.signalWord[signal]}</span>
        </div>
      )}

      <p className={styles.hint}>{S.decimalEstimateHint}</p>
    </section>
  );
}
