/**
 * 힌트 ②: 학생이 비워 둔 가운데 몫 칸과 그 열의 나누어지는 수 숫자를 함께 보여 준다.
 * 몫의 기대값은 쓰지 않는다. MC-DIV-QUOTIENT-ZERO용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeDivPlan } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  maxWidth: 'min(56%, 420px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px dashed #8a5a00',
  background: 'rgba(255, 253, 246, 0.96)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const dashed = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 30,
  height: 34,
  padding: '0 0.2rem',
  border: '2px dashed #8a5a00',
  borderRadius: 8,
  background: 'repeating-linear-gradient(45deg, #fff8e8 0 4px, #fdf0d2 4px 8px)',
  color: '#8a5a00',
  fontSize: '0.72rem',
  fontWeight: 700,
} as const;

export function QuotientGapOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div') return null;
  const plan = computeDivPlan(state);
  const highest = plan.reading.quotientHighest;
  if (highest === null) return null;

  const gaps: number[] = [];
  for (let column = highest - 1; column >= 0; column -= 1) {
    if (state.quotient[String(column)] === undefined) gaps.push(column);
  }
  if (gaps.length === 0) return null;

  return (
    <div data-testid="overlay-quotient-gap" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.quotientGapTitle}</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {gaps.map((column) => (
          <span key={column} style={dashed} aria-label={S.divGapCell(placeNameKo(column))}>
            <span aria-hidden="true">{placeNameKo(column)}</span>
            <span aria-hidden="true" style={{ marginLeft: 4 }}>
              {state.aText.charAt(plan.reading.top - column)}
            </span>
          </span>
        ))}
      </div>
      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.quotientGapHint}
      </p>
    </div>
  );
}
