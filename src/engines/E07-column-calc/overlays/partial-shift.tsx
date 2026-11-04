/**
 * 힌트 ②: 둘째 이후 부분곱 줄의 빈 일의 자리(자리 밀기)를 점선으로 보여 준다.
 * 값(부분곱·기대값)은 쓰지 않는다. MC-MUL-PARTIAL-SHIFT용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeMulPlan } from '../grid-mul';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  maxWidth: 'min(52%, 420px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px solid #8a5a00',
  background: 'rgba(255, 253, 246, 0.96)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const dashed = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 32,
  border: '2px dashed #8a5a00',
  borderRadius: 8,
  background: '#fff8e8',
  color: '#8a5a00',
  fontSize: '0.7rem',
  fontWeight: 700,
} as const;

export function PartialShiftOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'mul') return null;
  const plan = computeMulPlan(state);
  if (!plan) return null;
  const shifted = plan.rows.filter((row) => row.shift > 0);
  if (shifted.length === 0) return null;

  return (
    <div data-testid="overlay-partial-shift" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.partialShiftTitle}</strong>
      {shifted.map((row) => (
        <div
          key={row.index}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}
        >
          <span style={{ minWidth: '4.2rem', color: '#5a6478', fontWeight: 600 }}>
            {S.rowPartial(row.index)}
          </span>
          {Array.from({ length: row.shift }, (_, index) => (
            <span key={index} style={dashed} aria-hidden="true">
              {placeNameKo(index)}
            </span>
          ))}
        </div>
      ))}
      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.partialShiftHint}
      </p>
    </div>
  );
}
