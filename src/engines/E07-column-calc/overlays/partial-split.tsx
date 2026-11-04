/**
 * 힌트 ②: `partial-products`에서 윗수를 자리별로 쪼갠 모양만 보여 준다.
 * 예: 46 → `40 + 6`. 곱·부분곱 값은 쓰지 않는다.
 * MC-MUL-PARTIAL-MISSING·MC-MUL-NO-PLACE-VALUE용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeMulPlan } from '../grid-mul';
import { parseNumber } from '../grid';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  left: 8,
  maxWidth: 'min(52%, 420px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px solid #2f6fde',
  background: 'rgba(255, 255, 255, 0.96)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.9rem',
} as const;

/** 수를 자리별 값으로 쪼갠 목록. 예: "46" → ["40", "6"]. */
function splitByPlace(text: string): string[] {
  const parsed = parseNumber(text);
  if (!parsed || parsed.fracDigits !== 0) return [];
  const parts: string[] = [];
  for (let place = parsed.intDigits - 1; place >= 0; place -= 1) {
    const digit = Number(parsed.digits[parsed.intDigits - 1 - place] ?? '0');
    if (digit === 0) continue;
    parts.push((BigInt(digit) * 10n ** BigInt(place)).toString());
  }
  return parts;
}

export function PartialSplitOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'mul') return null;
  const plan = computeMulPlan(state);
  if (!plan || plan.style !== 'partial-products') return null;
  const parts = splitByPlace(state.aText);
  if (parts.length === 0) return null;

  return (
    <div data-testid="overlay-partial-split" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.partialSplitTitle}</strong>
      <span style={{ fontSize: '1.2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {parts.join(' + ')}
      </span>
      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.partialSplitHint}
      </p>
    </div>
  );
}
