/**
 * 힌트 ②: 각 열의 자릿값 이름과 학생이 쓴 숫자가 뜻하는 수를 보여 준다.
 * 기대값·정답은 보여 주지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeGrid, digitAt, digitValue } from '../grid';
import { columnCalcStrings as S } from '../strings.ko';
import { placeNameKo } from '../types';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const cellStyle = {
  padding: '0.15rem 0.35rem',
  borderBottom: '1px solid #d7deea',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
} as const;

const headStyle = {
  padding: '0.15rem 0.35rem',
  color: '#5a6478',
  fontWeight: 600,
  borderBottom: '2px solid #b9c6dc',
  whiteSpace: 'nowrap',
} as const;

function digitText(digit: string | null, column: number): string {
  if (digit === null) return '—';
  return S.placeValueDigit(digit, digitValue(digit, column));
}

export function PlaceValueOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  const grid = computeGrid(state);
  const a = grid.a;
  const b = grid.b;
  if (a === null || b === null) return null;
  if (state.mode === 'decimal' && (state.aPoint === null || state.bPoint === null)) return null;

  const columns = grid.columns
    .map((entry) => entry.column)
    .filter((column) => {
      const top = digitAt(a, state.aPoint ?? 0, column, state.aPads);
      const bottom = digitAt(b, state.bPoint ?? 0, column, state.bPads);
      return top !== null || bottom !== null || state.result[String(column)] !== undefined;
    });
  if (columns.length === 0) return null;
  const shown = columns.slice(0, 8);

  return (
    <div
      data-testid="overlay-place-value"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        maxWidth: 'min(52%, 420px)',
        padding: '0.55rem 0.7rem',
        borderRadius: 14,
        border: '2px solid #2f6fde',
        background: 'rgba(255, 255, 255, 0.96)',
        color: '#1d2330',
        boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
        fontSize: '0.85rem',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.placeValueTitle}</strong>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headStyle}>{S.placeHeader}</th>
            {shown.map((column) => (
              <th key={column} style={headStyle}>
                {placeNameKo(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th style={headStyle}>{S.rowTop}</th>
            {shown.map((column) => (
              <td key={column} style={cellStyle}>
                {digitText(digitAt(a, state.aPoint ?? 0, column, state.aPads), column)}
              </td>
            ))}
          </tr>
          <tr>
            <th style={headStyle}>{S.rowBottom}</th>
            {shown.map((column) => (
              <td key={column} style={cellStyle}>
                {digitText(digitAt(b, state.bPoint ?? 0, column, state.bPads), column)}
              </td>
            ))}
          </tr>
          <tr>
            <th style={headStyle}>{S.rowResult}</th>
            {shown.map((column) => (
              <td key={column} style={cellStyle}>
                {digitText(state.result[String(column)] ?? null, column)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
