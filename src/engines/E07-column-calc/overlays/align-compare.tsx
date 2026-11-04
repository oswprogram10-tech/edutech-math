/**
 * 힌트 ②: 소수 곱셈의 두 정렬(소수점 맞춤 / 오른쪽 끝 맞춤)을
 * 숫자 카드 배치 모양으로만 나란히 보여 준다.
 * MC-DEC-MULT-ALIGN-POINT용. 곱·결과값은 계산해 보이지 않는다.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import { parseNumber } from '../grid';
import type { ParsedNumber } from '../grid';
import { isDecimalMul } from '../grid';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  left: 8,
  maxWidth: 'min(58%, 460px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px solid #2f6d2f',
  background: 'rgba(252, 255, 252, 0.97)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.85rem',
} as const;

const cell: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 28,
  border: '2px solid #b9c6dc',
  borderRadius: 6,
  background: '#ffffff',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
};

const blank: CSSProperties = {
  ...cell,
  borderStyle: 'dashed',
  borderColor: '#d7deea',
  background: 'transparent',
};

const pointCell: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  width: 10,
  fontWeight: 900,
};

function Digit({ value, empty }: { readonly value?: string; readonly empty: boolean }) {
  if (empty || value === undefined) return <span style={blank} aria-hidden="true" />;
  return (
    <span style={cell} data-digit={value}>
      {value}
    </span>
  );
}

/** 소수점을 같은 열에 맞춘 배치. */
function PointAligned({
  parsed,
  intWidth,
  fracWidth,
}: {
  readonly parsed: ParsedNumber;
  readonly intWidth: number;
  readonly fracWidth: number;
}) {
  const intPart = parsed.digits.slice(0, parsed.intDigits);
  const fracPart = parsed.digits.slice(parsed.intDigits);
  const intPad = intWidth - intPart.length;
  const fracPad = fracWidth - fracPart.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {Array.from({ length: intPad }, (_, index) => (
        <Digit key={`i${index}`} empty />
      ))}
      {[...intPart].map((digit, index) => (
        <Digit key={`d${index}`} value={digit} empty={false} />
      ))}
      <span style={pointCell} aria-hidden="true">
        .
      </span>
      {[...fracPart].map((digit, index) => (
        <Digit key={`f${index}`} value={digit} empty={false} />
      ))}
      {Array.from({ length: fracPad }, (_, index) => (
        <Digit key={`p${index}`} empty />
      ))}
    </div>
  );
}

/** 맨 오른쪽 숫자를 같은 열에 맞춘 배치. */
function RightAligned({
  parsed,
  width,
}: {
  readonly parsed: ParsedNumber;
  readonly width: number;
}) {
  const pad = width - parsed.digits.length;
  const pointAfter = parsed.digits.length - parsed.fracDigits;
  const cells: ReactNode[] = [];
  for (let position = 0; position < width; position += 1) {
    if (position === pad + pointAfter) {
      cells.push(
        <span key={`point-${position}`} style={pointCell} aria-hidden="true">
          .
        </span>,
      );
    }
    const index = position - pad;
    const digit = index >= 0 && index < parsed.digits.length ? parsed.digits[index] : undefined;
    cells.push(<Digit key={`c${position}`} value={digit} empty={digit === undefined} />);
  }
  if (pad + pointAfter >= width) {
    cells.push(
      <span key="point-end" style={pointCell} aria-hidden="true">
        .
      </span>,
    );
  }
  return <div style={{ display: 'flex', alignItems: 'center' }}>{cells}</div>;
}

export function AlignCompareOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (!isDecimalMul(state)) return null;
  const a = parseNumber(state.aText);
  const b = parseNumber(state.bText);
  if (!a || !b) return null;
  if (a.fracDigits + b.fracDigits === 0) return null;

  const intWidth = Math.max(a.intDigits, b.intDigits);
  const fracWidth = Math.max(a.fracDigits, b.fracDigits);
  const totalWidth = Math.max(a.digits.length, b.digits.length);

  return (
    <div data-testid="overlay-align-compare" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.alignCompareTitle}</strong>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem' }}>
        <div>
          <span style={{ display: 'block', color: '#5a6478', fontSize: '0.75rem' }}>
            {S.alignComparePoint}
          </span>
          <PointAligned parsed={a} intWidth={intWidth} fracWidth={fracWidth} />
          <PointAligned parsed={b} intWidth={intWidth} fracWidth={fracWidth} />
        </div>

        <div>
          <span style={{ display: 'block', color: '#5a6478', fontSize: '0.75rem' }}>
            {S.alignCompareRight}
          </span>
          <RightAligned parsed={a} width={totalWidth} />
          <RightAligned parsed={b} width={totalWidth} />
        </div>
      </div>

      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {S.alignCompareHint}
      </p>
    </div>
  );
}
