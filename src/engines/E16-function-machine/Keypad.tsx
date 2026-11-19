/**
 * 수 키패드와 식 키패드. 모든 단추는 targetSize 이상이다(CSS `--target`).
 * 단추 이름은 키 글자 그대로이고, 물리 키보드 입력은 View가 받는다.
 */
import { functionStrings as S } from './strings.ko';
import styles from './View.module.css';

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const SYMBOLS: readonly string[] = ['○', '□', '+', '−', '×', '÷', '(', ')', '='];

interface PadProps {
  readonly disabled: boolean;
  readonly onKey: (key: string) => void;
  readonly onBackspace: () => void;
}

export interface NumberPadProps extends PadProps {
  /** 없으면 "다 썼어요" 단추를 그리지 않는다. */
  readonly onDone: (() => void) | null;
}

export function NumberPad({ disabled, onKey, onBackspace, onDone }: NumberPadProps) {
  return (
    <div
      className={styles.pad}
      role="group"
      aria-label={S.keypad.numberPad}
      data-testid="number-pad"
    >
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.padButton}
          disabled={disabled}
          onClick={() => onKey(digit)}
        >
          {S.keypad.digit(digit)}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.padButton} ${styles.padWide}`}
        disabled={disabled}
        onClick={onBackspace}
      >
        {S.keypad.erase}
      </button>
      {onDone === null ? null : (
        <button
          type="button"
          className={`${styles.padButton} ${styles.padWide}`}
          disabled={disabled}
          onClick={onDone}
        >
          {S.keypad.done}
        </button>
      )}
    </div>
  );
}

export interface ExprPadProps extends PadProps {
  readonly onClear: () => void;
  readonly onTest: () => void;
}

export function ExprPad({ disabled, onKey, onBackspace, onClear, onTest }: ExprPadProps) {
  return (
    <div className={styles.pad} role="group" aria-label={S.keypad.exprPad} data-testid="expr-pad">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.padButton}
          disabled={disabled}
          onClick={() => onKey(digit)}
        >
          {S.keypad.digit(digit)}
        </button>
      ))}
      {SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          type="button"
          className={styles.padButton}
          disabled={disabled}
          onClick={() => onKey(symbol)}
        >
          {symbol}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.padButton} ${styles.padWide}`}
        disabled={disabled}
        onClick={onBackspace}
      >
        {S.keypad.erase}
      </button>
      <button
        type="button"
        className={`${styles.padButton} ${styles.padWide}`}
        disabled={disabled}
        onClick={onClear}
      >
        {S.keypad.clearAll}
      </button>
      <button
        type="button"
        className={`${styles.padButton} ${styles.padWide} ${styles.padPrimary}`}
        disabled={disabled}
        onClick={onTest}
      >
        {S.keypad.test}
      </button>
    </div>
  );
}
