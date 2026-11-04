/**
 * 힌트 ②: 버려진 뺀 결과 칸과 내림 칸을 점선·무늬로 보여 준다.
 * 값은 쓰지 않고 자리만 알린다. MC-DIV-BRING-DOWN용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeDivPlan, readRowValue } from '../grid-div';
import type { DivStepPlan } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  maxWidth: 'min(58%, 440px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px dashed #8a5a00',
  background: 'rgba(255, 253, 246, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const blink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  height: 34,
  padding: '0 0.2rem',
  border: '2px dashed #d99a00',
  borderRadius: 8,
  background: 'repeating-linear-gradient(45deg, #fff3d6 0 4px, #ffe6a8 4px 8px)',
  color: '#7a4a00',
  fontSize: '0.72rem',
  fontWeight: 700,
} as const;

function bringOnly(step: DivStepPlan): bigint | null {
  if (step.bringColumns.length === 0) return null;
  let value = 0n;
  for (const column of step.bringColumns) {
    value = value * 10n + BigInt(step.expectedBring[String(column)] ?? '0');
  }
  return value;
}

function culprit(
  state: ColumnCalcState,
  plan: ReturnType<typeof computeDivPlan>,
): DivStepPlan | null {
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    if (!step || step.diff === 0n) continue;
    const record = state.divDiffs[String(step.column)];
    const row = readRowValue(record, step.rowColumns);
    const only = bringOnly(step);
    if (only !== null && row !== null && row === only) return step;
    const missing = step.bringColumns.some((column) => record?.[String(column)] === undefined);
    if (index + 1 < plan.steps.length && missing) return step;
  }
  return null;
}

export function LeftoverBlinkOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div') return null;
  const plan = computeDivPlan(state);
  const step = culprit(state, plan);
  if (!step) return null;

  const columns = [...step.diffColumns].reverse();
  const brings = [...step.bringColumns];

  return (
    <div data-testid="overlay-leftover-blink" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.leftoverBlinkTitle}</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {columns.map((column) => (
          <span
            key={`diff-${column}`}
            style={blink}
            aria-label={S.divDiffCell(placeNameKo(column), step.column)}
          >
            {placeNameKo(column)}
          </span>
        ))}
        {brings.map((column) => (
          <span
            key={`bring-${column}`}
            style={blink}
            aria-label={S.divDiffCell(placeNameKo(column), step.column)}
          >
            ↓{placeNameKo(column)}
          </span>
        ))}
      </div>
      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.leftoverBlinkHint}
      </p>
    </div>
  );
}
