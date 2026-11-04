/** E07 숫자 키패드. add/sub·mul·estimate 화면이 같은 모양을 쓴다. */
import { columnCalcStrings as S } from '../strings.ko';
import styles from '../View.module.css';

interface KeypadProps {
  readonly onDigit: (digit: string) => void;
  readonly onClear: () => void;
  readonly disabled?: boolean;
}

export function Keypad({ onDigit, onClear, disabled = false }: KeypadProps) {
  return (
    <div className={styles.keypad} role="group" aria-label={S.keypadLabel}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.key}
          aria-label={S.digitKey(digit)}
          disabled={disabled}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.key} ${styles.keyClear}`}
        aria-label={S.clearCell}
        disabled={disabled}
        onClick={onClear}
      >
        {S.clearKey}
      </button>
    </div>
  );
}
