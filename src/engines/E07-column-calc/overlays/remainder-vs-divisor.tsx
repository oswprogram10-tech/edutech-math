/**
 * 힌트 ②: 학생이 쓴 마지막 뺀 결과와 나누는 수를 길이 막대로 나란히 보여 준다.
 * 학생 값과 문제의 수만 쓴다. MC-DIV-REMAINDER-TOO-BIG용.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeDivPlan, readRowValue } from '../grid-div';
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
  height: 18,
  marginTop: 5,
  borderRadius: 9,
  background: '#f1eee9',
  overflow: 'hidden',
} as const;

function barWidth(value: bigint, ceiling: bigint): string {
  if (ceiling <= 0n) return '0%';
  const ratio = Number((value * 1000n) / ceiling) / 1000;
  return `${Math.max(3, Math.min(100, Math.round(ratio * 100)))}%`;
}

export function RemainderVsDivisorOverlay({
  state,
}: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (state.op !== 'div') return null;
  const plan = computeDivPlan(state);
  const last = plan.steps[plan.steps.length - 1];
  if (!last) return null;
  const remainder = readRowValue(state.divDiffs[String(last.column)], last.rowColumns);
  if (remainder === null) return null;
  const divisor = plan.reading.divisor;
  const ceiling = remainder > divisor ? remainder : divisor;

  return (
    <div data-testid="overlay-remainder-vs-divisor" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
        {S.remainderVsDivisorTitle}
      </strong>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{S.rowDivDiff(last.column)}</span>
        <span>{remainder.toString()}</span>
      </div>
      <div style={track} aria-hidden="true">
        <div
          style={{
            width: barWidth(remainder, ceiling),
            height: '100%',
            background: 'repeating-linear-gradient(45deg, #e8872e 0 6px, #f2a860 6px 12px)',
          }}
        />
      </div>

      <div
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 700 }}
      >
        <span>{S.divisorLabel}</span>
        <span>{divisor.toString()}</span>
      </div>
      <div style={track} aria-hidden="true">
        <div
          style={{
            width: barWidth(divisor, ceiling),
            height: '100%',
            background: 'repeating-linear-gradient(45deg, #2f6fde 0 6px, #6f9bea 6px 12px)',
          }}
        />
      </div>

      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.remainderVsDivisorHint}
      </p>
    </div>
  );
}
