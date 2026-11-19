/**
 * E06 조작 칸(SVG 밖): 예측, □ 넣어 보기, 양쪽·한쪽 더하기·빼기, 처음으로.
 * 숫자 키패드 하나를 지금 고른 수 칸(□에 넣을 수 / 더하거나 뺄 수)에 쓴다.
 * 물리 키보드: 숫자는 고른 칸에 쓰고, Backspace로 지우고, Enter(단추 밖)는 [넣어 보기]다.
 */
import { isLocked } from './reduce';
import { balanceStrings as S } from './strings.ko';
import type { BalanceAction, BalanceState } from './types';
import type { BalanceUi, Field } from './useBalanceUi';
import styles from './View.module.css';

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

interface FieldProps {
  readonly ui: BalanceUi;
  readonly field: Field;
  readonly label: string;
  readonly hint: string;
  readonly text: string;
}

function NumberField({ ui, field, label, hint, text }: FieldProps) {
  return (
    <div className={styles.fieldBlock}>
      <span className={styles.fieldHint}>{hint}</span>
      <div
        role="textbox"
        aria-readonly="true"
        aria-label={label}
        tabIndex={ui.disabled ? -1 : 0}
        className={styles.field}
        data-active={ui.active === field ? 'true' : undefined}
        data-testid={field === 'try' ? 'try-field' : 'amount-field'}
        onFocus={() => ui.select(field)}
        onClick={() => ui.select(field)}
      >
        {text}
      </div>
    </div>
  );
}

export interface ControlsProps {
  readonly state: BalanceState;
  readonly dispatch: (action: BalanceAction) => void;
  readonly ui: BalanceUi;
  readonly readOnly: boolean;
}

export function Controls({ state, dispatch, ui, readOnly }: ControlsProps) {
  const locked = isLocked(state);
  const { settings } = state;
  return (
    <div className={styles.sideStack} data-testid="balance-controls">
      <p className={styles.instructions}>{S.instructions}</p>

      {settings.predict ? (
        state.prediction === null ? (
          <div className={styles.group} role="group" aria-label={S.predict.group}>
            <p className={styles.question}>{S.predict.question}</p>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'predict', value: 'yes' })}
              >
                {S.predict.yes}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'predict', value: 'no' })}
              >
                {S.predict.no}
              </button>
            </div>
          </div>
        ) : (
          <p className={styles.made} data-testid="prediction-made">
            {S.predict.made(state.prediction)}
          </p>
        )
      ) : null}

      <div className={styles.row}>
        {ui.tryAvailable ? (
          <NumberField
            ui={ui}
            field="try"
            label={S.tryBlock.field}
            hint={S.tryBlock.fieldHint}
            text={ui.tryText}
          />
        ) : null}
        {ui.amountAvailable ? (
          <NumberField
            ui={ui}
            field="amount"
            label={S.amount.field}
            hint={S.amount.fieldHint}
            text={ui.amountText}
          />
        ) : null}
      </div>

      <div className={styles.pad} role="group" aria-label={S.keypad.group} data-testid="number-pad">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            className={styles.padButton}
            disabled={ui.disabled}
            onClick={() => ui.typeDigit(digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.padButton} ${styles.padWide}`}
          disabled={ui.disabled}
          onClick={ui.backspace}
        >
          {S.keypad.erase}
        </button>
      </div>

      {ui.tryAvailable ? (
        <div className={styles.row} role="group" aria-label={S.tryBlock.group}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={ui.disabled}
            onClick={ui.submitTry}
          >
            {S.tryBlock.button}
          </button>
        </div>
      ) : null}

      {settings.allowBothSides ? (
        <div className={styles.row} role="group" aria-label={S.both.group}>
          <button
            type="button"
            className={styles.button}
            disabled={ui.disabled}
            onClick={() => ui.both('add')}
          >
            {S.both.add}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={ui.disabled}
            onClick={() => ui.both('remove')}
          >
            {S.both.remove}
          </button>
        </div>
      ) : null}

      {settings.allowOneSide ? (
        <div className={styles.row} role="group" aria-label={S.one.group}>
          <button
            type="button"
            className={styles.button}
            disabled={ui.disabled}
            onClick={() => ui.one('add', 'left')}
          >
            {S.one.leftAdd}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={ui.disabled}
            onClick={() => ui.one('add', 'right')}
          >
            {S.one.rightAdd}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={ui.disabled}
            onClick={() => ui.one('remove', 'left')}
          >
            {S.one.leftRemove}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={ui.disabled}
            onClick={() => ui.one('remove', 'right')}
          >
            {S.one.rightRemove}
          </button>
        </div>
      ) : null}

      <div className={styles.row}>
        <button type="button" className={styles.button} disabled={readOnly} onClick={ui.reset}>
          {S.reset}
        </button>
      </div>

      <p className={styles.status} role="status" data-testid="balance-message">
        {ui.message ?? (locked ? S.predict.waiting : '')}
      </p>
    </div>
  );
}
