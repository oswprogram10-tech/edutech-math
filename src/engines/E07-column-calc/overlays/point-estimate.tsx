/**
 * 힌트 ②: 소수 곱셈에서 학생 어림값과 학생 결과를 수직선에 함께 찍는다.
 * MC-DEC-POINT-PLACEMENT용. 두 학생 값만 쓰고 기대값은 계산해 쓰지 않는다.
 */
import { Rational } from '../../../core/math';
import type { CSSProperties } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import { decimalEstimate, readDecimalResult } from '../grid-decimal';
import { isDecimalMul } from '../grid';
import { columnCalcStrings as S } from '../strings.ko';
import type { ColumnCalcConfig, ColumnCalcState } from '../types';

const card = {
  position: 'absolute',
  top: 8,
  left: 8,
  maxWidth: 'min(56%, 440px)',
  padding: '0.55rem 0.7rem',
  borderRadius: 14,
  border: '2px solid #2f6fde',
  background: 'rgba(255, 255, 255, 0.96)',
  color: '#1d2330',
  boxShadow: '0 6px 18px rgba(16, 24, 40, 0.16)',
  fontSize: '0.9rem',
} as const;

/** 화면 좌표(0~100%). 값 계산은 Rational로 하고 마지막에만 number로 바꾼다. */
function percentOf(value: Rational, max: Rational): number {
  if (max.isZero()) return 0;
  const hundred = Rational.of(100n);
  let percent = value.div(max).mul(hundred);
  if (percent.compareTo(hundred) > 0) percent = hundred;
  if (percent.compareTo(Rational.of(0n)) < 0) return 0;
  return Number(percent.integerPart());
}

function dotStyle(percent: number): CSSProperties {
  return { left: `${percent}%` };
}

export function PointEstimateOverlay({ state }: OverlayProps<ColumnCalcConfig, ColumnCalcState>) {
  if (!isDecimalMul(state)) return null;
  const estimate = decimalEstimate(state);
  const reading = readDecimalResult(state);
  const result = reading.value === null ? null : Rational.parse(reading.value);
  if (estimate === null && result === null) return null;

  const values = [estimate, result].filter((value): value is Rational => value !== null);
  let max = values.reduce(
    (high, value) => (value.compareTo(high) > 0 ? value : high),
    values[0] ?? Rational.of(0n),
  );
  // 눈금은 두 값 중 큰 값의 1.2배까지.
  max = max.mul(Rational.of(6n, 5n));
  if (max.isZero()) max = Rational.of(1n);

  return (
    <div data-testid="overlay-point-estimate" style={card}>
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{S.pointEstimateTitle}</strong>

      <div style={{ position: 'relative', height: 112, margin: '0.4rem 0 0.2rem' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 2,
            background: '#9db4dd',
          }}
        />
        {estimate === null ? null : (
          <span
            data-testid="point-estimate-estimate"
            style={{
              ...dotStyle(percentOf(estimate, max)),
              position: 'absolute',
              bottom: 0,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#2f6fde',
              transform: 'translate(-50%, 50%)',
            }}
          />
        )}
        {result === null ? null : (
          <span
            data-testid="point-estimate-result"
            style={{
              ...dotStyle(percentOf(result, max)),
              position: 'absolute',
              bottom: 0,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#b45309',
              transform: 'translate(-50%, 50%)',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', fontSize: '0.8rem' }}>
        {estimate === null ? null : (
          <span>
            {S.decimalEstimateLabel} <strong>{state.estimate}</strong>
          </span>
        )}
        {reading.raw === null ? null : (
          <span>
            {S.rowResult} <strong>{reading.raw}</strong>
          </span>
        )}
      </div>

      <p style={{ margin: '0.45rem 0 0', color: '#5a6478', fontSize: '0.8rem' }}>
        {estimate === null ? S.pointEstimateNoEstimate : S.pointEstimateHint}
      </p>
    </div>
  );
}
