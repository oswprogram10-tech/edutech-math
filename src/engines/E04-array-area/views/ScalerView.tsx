/**
 * T045 fraction-area `variant: "scaler"`: 리본 길이를 분수배로 줄이거나 늘린다.
 *
 * - 예측을 먼저 받고(`predictFirst`) 그 뒤에 곱하는 수를 고른다.
 * - 결과 길이 숫자는 `showResult`일 때만 쓴다(과제 답이기 때문).
 */
import { Rational } from '../../../core/math';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { arrayAreaStrings as S } from '../strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#5b6577';
const BLUE = '#2f6fde';
const ORANGE = '#b45309';
const GRAY = '#6b7280';

function ratioOf(text: string): number {
  try {
    const value = Rational.parse(text);
    return Number(value.n) / Number(value.d);
  } catch {
    return 1;
  }
}

export function ScalerView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>) {
  const scaler = state.scaler;
  if (scaler === null) return null;
  const { settings } = state;
  const multipliers = settings.multipliers;
  const index = scaler.index;
  const multiplier = index === null ? null : (multipliers[index] ?? null);
  const lockedByPrediction = settings.predictFirst && scaler.prediction === null;
  const base = settings.base;
  const maxRatio = Math.max(
    1,
    ...multipliers.map((item) => {
      return ratioOf(item);
    }),
  );
  const pxPerUnit = 560 / Math.max(1, base * maxRatio);
  const originalWidth = base * pxPerUnit;
  const resultText =
    multiplier === null
      ? null
      : (() => {
          try {
            return Rational.of(base).mul(Rational.parse(multiplier)).toString();
          } catch {
            return null;
          }
        })();
  const resultRatio = multiplier === null ? null : ratioOf(multiplier);
  const trend =
    resultRatio === null
      ? null
      : resultRatio < 1
        ? 'smaller'
        : resultRatio === 1
          ? 'same'
          : 'larger';
  const resultColor = trend === 'smaller' ? BLUE : trend === 'same' ? GRAY : ORANGE;
  const ribbonX = 150;
  const ribbonY = 220;
  const ribbonHeight = 64;

  const select = (next: number) => {
    if (next < 0 || next >= multipliers.length) return;
    dispatch({ type: 'set-multiplier', index: next });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <span className={styles.groupLabel}>{S.scaler.title}</span>
        {(['smaller', 'same', 'larger'] as const).map((value) => (
          <button
            key={`predict-${value}`}
            type="button"
            className={styles.button}
            aria-pressed={scaler.prediction === value}
            onClick={() => dispatch({ type: 'predict', value })}
            disabled={readOnly}
          >
            {S.scaler[value]}
          </button>
        ))}
        <div className={styles.group}>
          <span className={styles.groupLabel}>{S.scaler.multiplier}</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={S.scaler.previous}
            onClick={() => select((index ?? 0) - 1)}
            disabled={readOnly || lockedByPrediction || index === null || index <= 0}
          >
            −
          </button>
          <span className={styles.count} data-testid="multiplier-value">
            {multiplier ?? '–'}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={S.scaler.next}
            onClick={() => select((index ?? -1) + 1)}
            disabled={
              readOnly || lockedByPrediction || (index !== null && index >= multipliers.length - 1)
            }
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, multipliers.length - 1)}
          step={1}
          value={index ?? 0}
          aria-label={S.scaler.multiplier}
          data-testid="multiplier-slider"
          disabled={readOnly || lockedByPrediction}
          onChange={(event) => select(Number(event.target.value))}
        />
        {scaler.tried.length > 0 ? (
          <span className={styles.badge} data-testid="tried-badge">
            {S.scaler.tried(scaler.tried.length)}
          </span>
        ) : null}
        <span className={styles.hint}>
          {lockedByPrediction ? S.scaler.predict : S.instructions['fraction-area']}
        </span>
      </div>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.scaler.canvasLabel}
        data-testid="array-canvas"
        data-cpa={cpa}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

        {/* 원래 리본은 흐린 윤곽으로 늘 보인다. */}
        <rect
          x={ribbonX}
          y={ribbonY - 110}
          width={originalWidth}
          height={ribbonHeight}
          rx={10}
          fill="#ffffff"
          stroke={MUTED}
          strokeWidth={2}
          strokeDasharray="7 5"
          data-ribbon="original"
        />
        <text x={ribbonX} y={ribbonY - 122} fontSize={16} fill={MUTED}>
          {base}m
        </text>

        {resultRatio !== null ? (
          <g data-ribbon="result" data-trend={trend ?? ''}>
            <rect
              x={ribbonX}
              y={ribbonY}
              width={Math.max(2, base * resultRatio * pxPerUnit)}
              height={ribbonHeight}
              rx={10}
              fill={resultColor}
              fillOpacity={0.22}
              stroke={resultColor}
              strokeWidth={3}
              strokeDasharray={trend === 'smaller' ? '10 6' : undefined}
            />
            <line
              x1={ribbonX + base * resultRatio * pxPerUnit}
              y1={ribbonY}
              x2={ribbonX + base * resultRatio * pxPerUnit}
              y2={ribbonY + ribbonHeight}
              stroke={resultColor}
              strokeWidth={4}
            />
          </g>
        ) : null}

        {settings.showResult && resultText !== null ? (
          <text
            x={ribbonX}
            y={ribbonY + ribbonHeight + 34}
            fontSize={20}
            fontWeight={700}
            fill={resultColor}
            data-testid="scaler-result"
          >
            {S.scaler.result(resultText)}
          </text>
        ) : null}

        {/* 1m 눈금 자 — 주어진 base 길이만 보여 준다. */}
        <line
          x1={ribbonX}
          y1={ribbonY + ribbonHeight + 72}
          x2={ribbonX + originalWidth}
          y2={ribbonY + ribbonHeight + 72}
          stroke={INK}
          strokeWidth={2}
        />
        {Array.from({ length: base + 1 }, (_, tick) => {
          const x = ribbonX + tick * pxPerUnit;
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={x}
                y1={ribbonY + ribbonHeight + 64}
                x2={x}
                y2={ribbonY + ribbonHeight + 80}
                stroke={INK}
              />
              <text
                x={x}
                y={ribbonY + ribbonHeight + 98}
                fontSize={13}
                textAnchor="middle"
                fill={MUTED}
              >
                {tick}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
