/**
 * 힌트 ②: 학생이 고른 열의 윗수·아랫수·받아온 수를 블록으로 보여 준다.
 * 결과 칸(합·차)은 채우지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeGrid } from '../grid';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const COLORS = {
  top: '#2f6fde',
  bottom: '#e8872e',
  carry: '#2f9e6b',
} as const;

function columnFromArgs(args: unknown): number | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  const value = (args as { column?: unknown }).column;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function Blocks({ count, color }: { count: number; color: string }) {
  if (count === 0) {
    return <span style={{ color: '#5a6478', fontWeight: 600 }}>0</span>;
  }
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3 }}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          style={{
            width: 15,
            height: 15,
            borderRadius: 3,
            background: color,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function BlockRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 22 }}>
      <span style={{ width: '4.5rem', color: '#3c4658', fontWeight: 600 }}>{label}</span>
      <Blocks count={count} color={color} />
    </div>
  );
}

export function ColumnSumOverlay({ state, args }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  const grid = computeGrid(state);
  if (grid.columns.length === 0) return null;
  const requested = columnFromArgs(args);
  const selected = state.selected?.column ?? grid.resultColumns[0] ?? grid.low;
  const column = requested ?? selected;
  const computation = grid.byColumn.get(column);
  if (!computation) return null;

  return (
    <div
      data-testid="overlay-column-sum"
      style={{
        position: 'absolute',
        left: 8,
        bottom: 8,
        padding: '0.55rem 0.75rem',
        borderRadius: 14,
        border: '2px solid #2f9e6b',
        background: 'rgba(255, 255, 255, 0.96)',
        color: '#1d2330',
        boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
        fontSize: '0.9rem',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
        {S.columnSumTitle} · {placeNameKo(column)}
      </strong>
      <BlockRow label={S.columnSumTop} count={computation.top} color={COLORS.top} />
      <BlockRow label={S.columnSumBottom} count={computation.bottom} color={COLORS.bottom} />
      {state.op === 'add' ? (
        <BlockRow label={S.columnSumCarry} count={computation.carryIn} color={COLORS.carry} />
      ) : null}
      <p style={{ margin: '0.35rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.columnSumHint}
      </p>
    </div>
  );
}
