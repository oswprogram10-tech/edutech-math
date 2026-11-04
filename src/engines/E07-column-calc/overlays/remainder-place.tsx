/**
 * 힌트 ②(T078): 처음 소수점 자리에서 나머지 줄까지 세로 안내선을 내린다.
 * 나머지 값은 쓰지 않는다. MC-DIV-REMAINDER-SCALED용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeDivPlan } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  maxWidth: 'min(52%, 380px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px dashed #8a5a00',
  background: 'rgba(255, 253, 246, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const line = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0,
  height: 84,
  marginTop: 4,
} as const;

const dot = {
  width: 16,
  height: 16,
  border: '2px solid #2f6fde',
  borderRadius: '50%',
  background: '#ffffff',
} as const;

const dash = {
  width: 0,
  flex: 1,
  borderLeft: '2px dashed #2f6fde',
} as const;

const arrow = {
  color: '#2f6fde',
  fontSize: '0.95rem',
  lineHeight: 1,
} as const;

export function RemainderPlaceOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div' || !state.decimal) return null;
  const plan = computeDivPlan(state);
  if (plan.steps.length === 0) return null;

  return (
    <div data-testid="overlay-remainder-place" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.2rem' }}>{S.remainderPlaceTitle}</strong>
      <div style={line} aria-hidden="true">
        <span style={dot} />
        <span style={dash} />
        <span style={arrow}>▼</span>
      </div>
      <p style={{ margin: '0.2rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.remainderPlaceHint}
      </p>
    </div>
  );
}
