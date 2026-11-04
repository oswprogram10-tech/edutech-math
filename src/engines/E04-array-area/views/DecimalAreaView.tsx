/**
 * T045 decimal-area: 1×1 정사각형 안의 0.1 단위 넓이.
 *
 * - 값은 `Rational`로만 계산하고 상태에는 소수 문자열로 둔다.
 * - 곱(예: 0.18)은 화면에 쓰지 않는다. `showCounts`일 때만 겹친 칸 수를 쓴다.
 */
import { Rational } from '../../../core/math';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { decimalBoardRect } from '../layout';
import { arrayAreaStrings as S } from '../strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const BLUE = '#2f6fde';
const ORANGE = '#b45309';
const GREEN = '#215c2a';

function tenthsText(tenths: number): string {
  return Rational.of(tenths, 10).toDecimalString();
}

function clampedTenths(value: number, max: string): number {
  const maximum = Math.round(Number(max) * 10);
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

export function DecimalAreaView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>) {
  const decimal = state.decimal;
  if (decimal === null) return null;
  const { settings } = state;
  const board = decimalBoardRect(settings.maxA, settings.maxB);
  const aCells = Math.round(Number(decimal.a) * 10);
  const bCells = Math.round(Number(decimal.b) * 10);
  const cell = board.cell;
  const locked = settings.locked || readOnly;

  const setSide = (side: 'a' | 'b', tenths: number) => {
    const max = side === 'a' ? settings.maxA : settings.maxB;
    dispatch({ type: 'set-factor', side, value: tenthsText(clampedTenths(tenths, max)) });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {(['a', 'b'] as const).map((side) => {
          const value = side === 'a' ? decimal.a : decimal.b;
          const max = side === 'a' ? settings.maxA : settings.maxB;
          return (
            <div className={styles.group} key={`factor-${side}`}>
              <span className={styles.groupLabel}>
                {side === 'a' ? S.decimalArea.a : S.decimalArea.b}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.decimalArea.smaller(side)}
                onClick={() => setSide(side, Number(value) * 10 - 1)}
                disabled={locked || Number(value) <= 0}
              >
                −
              </button>
              <span className={styles.count} data-testid={`factor-${side}`}>
                {S.decimalArea.factorValue(value)}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={S.decimalArea.bigger(side)}
                onClick={() => setSide(side, Number(value) * 10 + 1)}
                disabled={locked || Number(value) >= Number(max)}
              >
                +
              </button>
              {settings.locked ? null : (
                <input
                  type="range"
                  min={0}
                  max={Number(max)}
                  step={0.1}
                  value={Number(value)}
                  aria-label={side === 'a' ? S.decimalArea.a : S.decimalArea.b}
                  disabled={readOnly}
                  onChange={(event) => setSide(side, Number(event.target.value) * 10)}
                />
              )}
            </div>
          );
        })}
        <span className={styles.hint}>{S.instructions['decimal-area']}</span>
      </div>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.decimalArea.canvasLabel}
        data-testid="array-canvas"
        data-cpa={cpa}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
        <defs>
          <pattern
            id="e04-dec-a"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={8} stroke={BLUE} strokeWidth={2} />
          </pattern>
          <pattern
            id="e04-dec-b"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <line x1={0} y1={0} x2={0} y2={8} stroke={ORANGE} strokeWidth={2} />
          </pattern>
          <pattern id="e04-dec-overlap" width={10} height={10} patternUnits="userSpaceOnUse">
            <path d="M0 0H10V10H0Z" fill={GREEN} fillOpacity={0.28} />
            <path d="M0 0L10 10M10 0L0 10" stroke={GREEN} strokeWidth={1.4} />
          </pattern>
        </defs>

        <rect
          x={board.x}
          y={board.y}
          width={board.width}
          height={board.height}
          fill="#ffffff"
          stroke={INK}
          strokeWidth={2}
        />
        {Array.from({ length: Math.max(0, Math.floor(board.width / cell)) }, (_, index) => (
          <line
            key={`dec-v-${index}`}
            x1={board.x + (index + 1) * cell}
            y1={board.y}
            x2={board.x + (index + 1) * cell}
            y2={board.y + board.height}
            stroke="#c9d2e0"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: Math.max(0, Math.floor(board.height / cell)) }, (_, index) => (
          <line
            key={`dec-h-${index}`}
            x1={board.x}
            y1={board.y + (index + 1) * cell}
            x2={board.x + board.width}
            y2={board.y + (index + 1) * cell}
            stroke="#c9d2e0"
            strokeWidth={1}
          />
        ))}

        {aCells > 0 ? (
          <rect
            x={board.x}
            y={board.y}
            width={aCells * cell}
            height={board.height}
            fill="url(#e04-dec-a)"
            fillOpacity={0.28}
            stroke={BLUE}
            strokeWidth={2}
            data-strip="a"
          />
        ) : null}
        {bCells > 0 ? (
          <rect
            x={board.x}
            y={board.y}
            width={board.width}
            height={bCells * cell}
            fill="url(#e04-dec-b)"
            fillOpacity={0.28}
            stroke={ORANGE}
            strokeWidth={2}
            data-strip="b"
          />
        ) : null}
        {aCells > 0 && bCells > 0 ? (
          <rect
            x={board.x}
            y={board.y}
            width={aCells * cell}
            height={bCells * cell}
            fill="url(#e04-dec-overlap)"
            stroke={GREEN}
            strokeWidth={2.4}
            data-overlap="true"
          />
        ) : null}

        {settings.showUnitLabel ? (
          <text x={board.x} y={board.y - 14} fontSize={16} fontWeight={700} fill={INK}>
            {S.decimalArea.unitLabel}
          </text>
        ) : null}
        {settings.showCounts ? (
          <text
            x={board.x}
            y={board.y + board.height + 28}
            fontSize={17}
            fill={GREEN}
            data-testid="overlap-count"
          >
            {S.decimalArea.overlapCount(aCells * bCells)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
