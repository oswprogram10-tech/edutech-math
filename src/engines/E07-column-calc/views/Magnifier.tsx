/**
 * 소수 ÷ 소수 확대경(T078).
 *
 * 두 수를 같은 배수로 키워도 몫이 같다는 것을 막대 조각으로 보여 준다.
 * 조각 개수는 숫자로 쓰지 않는다(학생이 센다). 값 계산은 `Rational`·`BigInt`로만
 * 하고, 화면 좌표(막대 너비)만 number를 쓴다. 정답 몫은 쓰지 않는다.
 */
import type { ColumnCalcAction, ColumnCalcState } from '../types';
import { Rational } from '../../../core/math';
import { columnCalcStrings as S } from '../strings.ko';
import { divGridNumbers } from '../grid-div-decimal';
import styles from './Magnifier.module.css';

interface MagnifierProps {
  readonly state: ColumnCalcState;
  readonly dispatch: (action: ColumnCalcAction) => void;
  readonly targetSize: number;
  readonly readOnly: boolean;
}

const ZERO = 0n;
const HUNDRED = 100n;

const FACTOR_SCALE: Readonly<Record<number, number>> = { 10: 1, 100: 2, 1000: 3 };

/** 조각 너비(%). 화면 좌표만 number다. */
function piecePercent(part: bigint, whole: bigint): number {
  if (whole <= ZERO) return 0;
  const permille = (part * 1000n) / whole;
  return Number(permille) / 10;
}

function pieceCount(dividend: Rational, divisor: Rational): number {
  if (divisor.isZero()) return 0;
  const count = dividend.div(divisor).integerPart();
  if (count > HUNDRED) return Number(HUNDRED);
  return Number(count);
}

export function Magnifier({ state, dispatch, targetSize, readOnly }: MagnifierProps) {
  const numbers = divGridNumbers(state);
  if (!state.decimal) return null;

  const scaledDividend = numbers.G.value;
  const scaledDivisor = numbers.g.value;
  // 격자 수의 비율만 쓴다. 몫(정답)은 계산하지 않는다.
  const ratio = scaledDivisor.div(scaledDividend);
  const percent = piecePercent(ratio.n, ratio.d);
  const count = pieceCount(scaledDividend, scaledDivisor);

  const buttonStyle = { minHeight: targetSize, minWidth: targetSize };

  function scaleBoth(factor: number): void {
    if (readOnly) return;
    const to = FACTOR_SCALE[factor];
    if (to === undefined) return;
    dispatch({ type: 'scale', side: 'both', to });
  }

  function scaleOne(side: 'dividend' | 'divisor'): void {
    if (readOnly) return;
    const to = side === 'dividend' ? state.scaleA + 1 : state.scaleB + 1;
    if (to > 3) return;
    dispatch({ type: 'scale', side, to });
  }

  return (
    <section className={styles.magnifier} data-testid="magnifier" aria-label={S.magnifierTitle}>
      <strong className={styles.title}>{S.magnifierTitle}</strong>

      <p className={styles.numbers} data-testid="magnifier-numbers">
        <span>{numbers.G.text}</span>
        <span aria-hidden="true"> ÷ </span>
        <span>{numbers.g.text}</span>
      </p>

      <div className={styles.buttons}>
        {state.magnifier.map((factor) => (
          <button
            key={factor}
            type="button"
            className={styles.button}
            style={buttonStyle}
            data-factor={factor}
            disabled={readOnly}
            onClick={() => scaleBoth(factor)}
          >
            {S.magnifierTimes(factor)}
          </button>
        ))}
        <button
          type="button"
          className={styles.button}
          style={buttonStyle}
          data-reset="true"
          disabled={readOnly || (state.scaleA === 0 && state.scaleB === 0)}
          onClick={() => {
            if (!readOnly) dispatch({ type: 'scale', side: 'both', to: 0 });
          }}
        >
          {S.magnifierReset}
        </button>
      </div>

      {state.allowOneSideScale ? (
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.oneSide}
            style={buttonStyle}
            data-one-side="dividend"
            disabled={readOnly || state.scaleA >= 3}
            onClick={() => scaleOne('dividend')}
          >
            {S.magnifierOneDividend}
          </button>
          <button
            type="button"
            className={styles.oneSide}
            style={buttonStyle}
            data-one-side="divisor"
            disabled={readOnly || state.scaleB >= 3}
            onClick={() => scaleOne('divisor')}
          >
            {S.magnifierOneDivisor}
          </button>
        </div>
      ) : null}

      <div
        className={styles.track}
        role="img"
        aria-label={S.magnifierBars}
        data-testid="magnifier-bars"
      >
        <div className={styles.pieces} aria-hidden="true">
          {Array.from({ length: count }, (_, index) => (
            <span key={index} className={styles.piece} style={{ width: `${percent}%` }} />
          ))}
        </div>
      </div>

      <p className={styles.hint}>{numbers.gridOpen ? S.magnifierHint : S.divisorNotWhole}</p>
    </section>
  );
}
