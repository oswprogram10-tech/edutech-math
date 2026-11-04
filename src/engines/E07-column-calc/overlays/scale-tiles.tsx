/**
 * 힌트 ②(T078): 처음 두 수와 지금 옮긴 두 수의 막대 조각을 나란히 보여 준다.
 * 조각 개수는 숫자로 쓰지 않는다. MC-DEC-DIV-SCALE-ONE-SIDE용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { divGridNumbers } from '../grid-div-decimal';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 'min(66%, 440px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px dashed #8a5a00',
  background: 'rgba(255, 253, 246, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const track = {
  position: 'relative',
  display: 'flex',
  height: 18,
  marginTop: 4,
  border: '2px solid #2f6fde',
  borderRadius: 8,
  background: 'repeating-linear-gradient(45deg, #eef2f9 0 5px, #f8fafd 5px 10px)',
  overflow: 'hidden',
} as const;

const ZERO = 0n;

function piecePercent(part: bigint, whole: bigint): number {
  if (whole <= ZERO) return 0;
  return Number((part * 1000n) / whole) / 10;
}

function RationalBar({ dividend, divisor }: { dividend: Rational; divisor: Rational }) {
  if (dividend.isZero() || divisor.isZero()) return <div style={track} aria-hidden="true" />;
  const ratio = divisor.div(dividend);
  const percent = piecePercent(ratio.n, ratio.d);
  const whole = dividend.div(divisor).integerPart();
  const count = whole > 100n ? 100 : Number(whole);
  return (
    <div style={track} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          style={{ flex: '0 0 auto', width: `${percent}%`, background: '#cfe0ff' }}
        />
      ))}
    </div>
  );
}

function textOf(text: string): Rational | null {
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

export function ScaleTilesOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div' || !state.decimal) return null;
  const originalDividend = textOf(state.aText);
  const originalDivisor = textOf(state.bText);
  if (!originalDividend || !originalDivisor || originalDivisor.isZero()) return null;

  const numbers = divGridNumbers(state);

  return (
    <div data-testid="overlay-scale-tiles" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.scaleTilesTitle}</strong>

      <div data-testid="scale-tiles-original">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>{S.scaleTilesOriginal}</span>
          <span>{`${state.aText} ÷ ${state.bText}`}</span>
        </div>
        <RationalBar dividend={originalDividend} divisor={originalDivisor} />
      </div>

      <div data-testid="scale-tiles-current" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>{S.scaleTilesCurrent}</span>
          <span>{`${numbers.G.text} ÷ ${numbers.g.text}`}</span>
        </div>
        <RationalBar dividend={numbers.G.value} divisor={numbers.g.value} />
      </div>

      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.scaleTilesHint}
      </p>
    </div>
  );
}
