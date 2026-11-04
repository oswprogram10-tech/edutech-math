/**
 * 힌트 ②(T078): 피제수 끝에 0을 붙이면 계속 나눌 수 있음을 자리로 보여 준다.
 * 숫자는 쓰지 않는다. MC-DIV-NO-EXTEND-ZERO용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { divGridNumbers } from '../grid-div-decimal';
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
  background: 'rgba(255, 253, 246, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const dashed = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 34,
  height: 36,
  padding: '0 0.25rem',
  border: '2px dashed #d99a00',
  borderRadius: 8,
  background: 'repeating-linear-gradient(45deg, #fff3d6 0 4px, #ffe6a8 4px 8px)',
  color: '#7a4a00',
  fontSize: '0.75rem',
  fontWeight: 700,
} as const;

export function ExtendZeroOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div' || !state.decimal) return null;
  const numbers = divGridNumbers(state);
  if (!numbers.gridOpen) return null;
  if (numbers.appended >= state.extendLimit) return null;

  return (
    <div data-testid="overlay-extend-zero" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.extendZeroTitle}</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={dashed} aria-label={S.appendedZeroCell(placeNameKo(numbers.low - 1))}>
          <span aria-hidden="true">↓</span>
        </span>
        <span aria-hidden="true" style={{ color: '#8a5a00', fontSize: '1.1rem' }}>
          ←
        </span>
        <span style={dashed} aria-hidden="true" />
      </div>
      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.extendZeroHint}
      </p>
    </div>
  );
}
