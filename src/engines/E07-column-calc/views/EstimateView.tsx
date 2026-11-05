/**
 * E07 어림(estimate) 화면.
 *
 * 1) 어림값 칸에 어림값을 쓴 뒤 "어림값 정하기"로 잠근다.
 * 2) op에 따라 기존 덧셈·뺄셈·곱셈 격자를 그대로 쓴다(새 격자를 만들지 않는다).
 * 3) 결과가 완성되면 학생이 쓴 어림값과 학생 결과의 차이로 신호등을 보여 준다.
 *
 * 신호등은 색 + 모양 + 말로만 보이고, 숫자 차이·기대값은 화면에 쓰지 않는다.
 */
import { useEffect, useRef } from 'react';
import { estimateDigits, estimateSignal } from '../estimate';
import { isForeignKeyTarget, isTextEntryTarget } from '../keyboard';
import { columnCalcStrings as S } from '../strings.ko';
import styles from '../View.module.css';
import { AddSubView } from './AddSubView';
import type { ColumnViewProps } from './AddSubView';
import { Keypad } from './Keypad';
import { MulView } from './MulView';

export function EstimateView(props: ColumnViewProps) {
  const { state, dispatch, readOnly = false } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const phase = state.phase;
  const digits = state.estimate;
  const signal = estimateSignal(state);

  useEffect(() => {
    if (phase !== 'estimate') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target) || isForeignKeyTarget(event.target, rootRef.current)) {
        return;
      }
      if (readOnly) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        dispatch({ type: 'enter-estimate', digit: event.key });
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'enter-estimate', digit: null });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div
      ref={rootRef}
      className={styles.wrap}
      data-target-size={props.targetSize}
      data-cpa={props.cpa}
    >
      <p className={styles.instructions}>{S.instructions.estimate}</p>

      <div className={styles.estimateBar} role="group" aria-label={S.estimateLabel}>
        <span className={styles.estimateLabel}>{S.estimateLabel}</span>
        <button
          type="button"
          className={styles.estimateCell}
          data-testid="estimate-cell"
          data-filled={digits !== null}
          data-locked={phase === 'calc'}
          aria-label={S.estimateInputLabel}
          disabled={readOnly}
        >
          {digits ?? S.estimatePlaceholder}
        </button>
        {phase === 'estimate' ? (
          <button
            type="button"
            className={styles.lockButton}
            data-testid="estimate-lock"
            disabled={readOnly || estimateDigits(state) === null}
            onClick={() => dispatch({ type: 'lock-estimate' })}
          >
            {S.estimateLock}
          </button>
        ) : (
          <button
            type="button"
            className={styles.lockButton}
            data-testid="estimate-unlock"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'unlock-estimate' })}
          >
            {S.estimateUnlock}
          </button>
        )}
      </div>

      {phase === 'estimate' ? (
        <Keypad
          disabled={readOnly}
          onDigit={(digit) => dispatch({ type: 'enter-estimate', digit })}
          onClear={() => dispatch({ type: 'enter-estimate', digit: null })}
        />
      ) : (
        <>
          {state.op === 'mul' ? (
            <MulView {...props} showInstructions={false} />
          ) : (
            <AddSubView {...props} showInstructions={false} />
          )}

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

          {state.hasSample && !state.rechecked ? (
            <div className={styles.recheckRow}>
              <button
                type="button"
                className={styles.lockButton}
                data-testid="estimate-recheck"
                disabled={readOnly}
                onClick={() => dispatch({ type: 'recheck' })}
              >
                {S.recheck}
              </button>
              <span className={styles.hint}>{S.recheckHint}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
