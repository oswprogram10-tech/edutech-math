/**
 * 힌트 ②(T078): 수직선에 원래 나누어지는 수와 `학생 몫 × 원래 나누는 수`를 찍는다.
 * 학생 값과 문제의 수만 쓴다. 정답 몫은 쓰지 않는다. MC-DEC-POINT-PLACEMENT(몫)용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { computeDivPlan } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 'min(62%, 420px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px solid #b4541c',
  background: 'rgba(255, 250, 246, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const track = {
  position: 'relative',
  height: 26,
  marginTop: 10,
  borderTop: '2px solid #1d2330',
} as const;

function positionPercent(value: Rational, max: Rational): number {
  // 수직선 위 좌표(화면 좌표)만 number로 바꾼다.
  const ratio = value.div(max);
  return Math.max(0, Math.min(100, (Number(ratio.n) / Number(ratio.d)) * 100));
}

function textOf(text: string): Rational | null {
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

export function QuotientCheckLineOverlay({
  state,
}: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div' || !state.decimal) return null;
  const plan = computeDivPlan(state);
  const quotient = plan.reading.quotient;
  if (quotient === null) return null;
  const dividend = textOf(state.aText);
  const divisor = textOf(state.bText);
  if (!dividend || !divisor) return null;

  const product = quotient.mul(divisor);
  const max = dividend.compareTo(product) >= 0 ? dividend : product;
  if (max.isZero()) return null;

  const dividendAt = positionPercent(dividend, max);
  const productAt = positionPercent(product, max);

  return (
    <div data-testid="overlay-quotient-check-line" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.quotientCheckTitle}</strong>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{S.quotientCheckDividend}</span>
        <span>{dividend.toString()}</span>
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontWeight: 700 }}
      >
        <span>{S.quotientCheckProduct}</span>
        <span>{product.toString()}</span>
      </div>

      <div style={track} aria-hidden="true">
        <span
          style={{
            position: 'absolute',
            left: `${dividendAt}%`,
            top: -8,
            width: 14,
            height: 14,
            border: '2px solid #2f6fde',
            borderRadius: '50%',
            background: '#ffffff',
            transform: 'translateX(-50%)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: `${productAt}%`,
            top: 4,
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderBottom: '11px solid #b4541c',
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      <p style={{ margin: '0.55rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.quotientCheckHint}
      </p>
    </div>
  );
}
