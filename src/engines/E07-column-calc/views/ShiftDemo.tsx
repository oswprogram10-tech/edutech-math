/**
 * E07 자릿값 기둥 시프트 데모(T077).
 *
 * - 기둥 8개(천 … 소수 넷째)를 고정해 그리고, 소수점은 일과 소수 첫째 사이에 고정한다.
 * - 숫자 카드는 Action으로만 움직이고, 기둥 밖으로 나가는 걸음은 버튼을 막는다.
 * - 값은 카드로만 보인다. "37.5" 같은 숫자 글자를 따로 쓰지 않는다.
 * - CPA A 단계에서는 숨긴다.
 */
import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { SHIFT_HIGH, SHIFT_LOW, shiftCards, shiftFits } from '../grid-decimal';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import styles from './ShiftDemo.module.css';
import type { ColumnViewProps } from './AddSubView';

const COLUMNS: readonly number[] = (() => {
  const values: number[] = [];
  for (let column = SHIFT_HIGH; column >= SHIFT_LOW; column -= 1) values.push(column);
  return values;
})();

const SLOTS = COLUMNS.length;

export function ShiftDemo({ state, dispatch, cpa, readOnly = false, targetSize }: ColumnViewProps) {
  if (cpa === 'A' || state.shiftBase === null) return null;

  const cards = shiftCards(state);
  const byColumn = new Map<number, string>();
  for (const card of cards) byColumn.set(card.column, card.digit);

  return (
    <section
      className={styles.wrap}
      data-testid="shift-demo"
      data-target-size={targetSize}
      aria-label={S.shiftLabel}
    >
      <div className={styles.header}>
        <span className={styles.title}>{S.shiftTitle}</span>
        <span className={styles.note}>{S.shiftPoint}</span>
      </div>

      <div className={styles.track}>
        <div className={styles.pillars}>
          {COLUMNS.map((column) => {
            const digit = byColumn.get(column);
            return (
              <span
                key={column}
                className={styles.pillar}
                data-column={column}
                data-filled={digit !== undefined}
                role="img"
                aria-label={
                  digit === undefined
                    ? S.shiftEmpty(placeNameKo(column))
                    : S.shiftCard(placeNameKo(column), digit)
                }
              />
            );
          })}
        </div>

        <div className={styles.cards} aria-hidden="true">
          {cards.map((card, index) => {
            const slot = SHIFT_HIGH - card.column;
            if (slot < 0 || slot >= SLOTS) return null;
            const style: CSSProperties = {
              transform: `translateX(${slot * 100}%)`,
            };
            return (
              <Fragment key={`${card.column}-${index}`}>
                {index > 0 ? ' ' : null}
                <span className={styles.card} style={style}>
                  {card.digit}
                </span>
              </Fragment>
            );
          })}
        </div>

        <span className={styles.point} aria-hidden="true" />
      </div>

      <div className={styles.labels} aria-hidden="true">
        {COLUMNS.map((column) => (
          <span key={column} className={styles.placeLabel}>
            {placeNameKo(column)}
          </span>
        ))}
      </div>

      <div className={styles.buttons} role="group" aria-label={S.shiftLabel}>
        {state.shiftOps.map((op) => (
          <button
            key={op}
            type="button"
            className={styles.shiftButton}
            disabled={readOnly || !shiftFits(state, op)}
            onClick={() => dispatch({ type: 'shift', op })}
            aria-label={S.shiftOp(op)}
          >
            {op}
          </button>
        ))}
        <button
          type="button"
          className={styles.resetButton}
          disabled={readOnly || state.shiftExponent === 0}
          onClick={() => dispatch({ type: 'shift-reset' })}
          aria-label={S.shiftReset}
        >
          {S.shiftReset}
        </button>
      </div>

      {state.shiftHistory.length === 0 ? (
        <p className={styles.hint}>{S.shiftHint}</p>
      ) : (
        <p className={styles.hint} aria-live="polite">
          {state.shiftHistory.join(' → ')}
        </p>
      )}
    </section>
  );
}
