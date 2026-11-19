/**
 * growth 숫자 패드. 0-9, 지우기, 모두 지우기. 단추는 모두 targetSize 이상이다
 * (CSS `.wrap[data-target-size]`). calc 패드와 같은 모양 클래스를 쓴다.
 */
import { patternStrings as S } from './strings.ko';
import styles from './View.module.css';

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export interface GrowthKeypadProps {
  readonly disabled: boolean;
  readonly onKey: (key: string) => void;
  readonly onBackspace: () => void;
  readonly onClear: () => void;
}

export function GrowthKeypad({ disabled, onKey, onBackspace, onClear }: GrowthKeypadProps) {
  return (
    <div className={styles.calcPad} role="group" aria-label={S.growth.pad} data-testid="growth-pad">
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
      <button
        type="button"
        className={`${styles.calcPadButton} ${styles.calcPadWide}`}
        disabled={disabled}
        onClick={onBackspace}
      >
        {S.growth.erase}
      </button>
      <button
        type="button"
        className={`${styles.calcPadButton} ${styles.calcPadWide}`}
        disabled={disabled}
        onClick={onClear}
      >
        {S.growth.clearAll}
      </button>
    </div>
  );
}
