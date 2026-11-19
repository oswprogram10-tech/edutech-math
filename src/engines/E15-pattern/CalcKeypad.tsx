/**
 * calc-pattern 식 키패드. 0-9 + × =, 지우기, 모두 지우기. 단추는 모두 targetSize 이상이다
 * (CSS `.wrap[data-target-size]`). E16 키패드를 가져오지 않고 E15 안에 따로 둔다.
 */
import { patternStrings as S } from './strings.ko';
import styles from './View.module.css';

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const SYMBOLS: readonly string[] = ['+', '×', '='];

export interface CalcKeypadProps {
  readonly disabled: boolean;
  readonly onKey: (key: string) => void;
  readonly onBackspace: () => void;
  readonly onClear: () => void;
}

export function CalcKeypad({ disabled, onKey, onBackspace, onClear }: CalcKeypadProps) {
  return (
    <div className={styles.calcPad} role="group" aria-label={S.calc.pad} data-testid="calc-pad">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.calcPadButton}
          disabled={disabled}
          onClick={() => onKey(digit)}
        >
          {digit}
        </button>
      ))}
      {SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          type="button"
          className={styles.calcPadButton}
          disabled={disabled}
          onClick={() => onKey(symbol)}
        >
          {symbol}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.calcPadButton} ${styles.calcPadWide}`}
        disabled={disabled}
        onClick={onBackspace}
      >
        {S.calc.erase}
      </button>
      <button
        type="button"
        className={`${styles.calcPadButton} ${styles.calcPadFull}`}
        disabled={disabled}
        onClick={onClear}
      >
        {S.calc.clearAll}
      </button>
    </div>
  );
}
