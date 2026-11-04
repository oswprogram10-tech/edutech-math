/**
 * 힌트 ②: 학생이 고른 몫 후보 k와 k±1의 막대를 나란히 보여 준다.
 * 배수 사다리가 꺼진 과제에서도 힌트로만 그린다. MC-DIV-ESTIMATE-OFF용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeDivPlan, estimatePartial } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 'min(58%, 430px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px solid #2f6fde',
  background: 'rgba(250, 252, 255, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const MAX_BAR_PX = 120;

function heightRatio(value: bigint, ceiling: bigint): string {
  if (ceiling <= 0n) return '12%';
  const ratio = Number((value * 1000n) / ceiling) / 1000;
  return `${Math.max(8, Math.round(ratio * MAX_BAR_PX))}px`;
}

export function LadderFocusOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div') return null;
  const plan = computeDivPlan(state);
  const column = state.selected?.row === 'quotient' ? state.selected.column : plan.reading.top;
  const tries = state.estimateTries[String(column)] ?? [];
  const chosen = tries[tries.length - 1] ?? 1;
  const maxMultiple = state.estimateMaxMultiple;
  const partial = estimatePartial(state, plan.reading, column);

  const candidates = [chosen - 1, chosen, chosen + 1].filter((k) => k >= 1 && k <= maxMultiple);
  if (candidates.length === 0) return null;
  const ceiling = plan.reading.divisor * BigInt(Math.max(...candidates));

  return (
    <div data-testid="overlay-ladder-focus" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.ladderFocusTitle}</strong>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: MAX_BAR_PX + 20 }}
      >
        {candidates.map((k) => {
          const value = plan.reading.divisor * BigInt(k);
          const over = value > partial;
          return (
            <div
              key={k}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '100%',
                  maxWidth: 54,
                  height: heightRatio(value, ceiling),
                  border: over ? '2px dashed #b4541c' : '2px solid #2f6fde',
                  borderRadius: '8px 8px 0 0',
                  background: over
                    ? 'repeating-linear-gradient(45deg, #ffe0c8 0 5px, #fff2e8 5px 10px)'
                    : '#dce8ff',
                  marginTop: 'auto',
                  boxShadow: k === chosen ? '0 0 0 3px #101828 inset' : undefined,
                }}
              />
              <span style={{ marginTop: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                {S.estimateCandidate(k)}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.ladderFocusHint}
      </p>
    </div>
  );
}
