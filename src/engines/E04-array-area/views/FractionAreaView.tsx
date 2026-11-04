/**
 * T045 fraction-area: 1×1 정사각형에서 분수끼리 곱하는 넓이.
 *
 * - 조각 수·칠한 수는 학생이 만든 값이라 숫자로 보여도 된다.
 * - 곱 분수(예: 1/2)는 화면에 쓰지 않는다. `showCounts`일 때만 칸 수를 센다.
 * - E05를 import하지 않고 색·무늬만 같은 순서로 쓴다(카드 결정 6).
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { fractionSquareRect } from '../layout';
import { arrayAreaStrings as S } from '../strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState, FractionParts } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const YELLOW = '#b45309';
const BLUE = '#2f6fde';
const GREEN = '#215c2a';

function SideControls({
  side,
  parts,
  dispatch,
  locked,
}: {
  readonly side: 'a' | 'b';
  readonly parts: FractionParts;
  readonly dispatch: (action: ArrayAreaAction) => void;
  readonly locked: boolean;
}) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{S.fractionArea.parts(side)}</span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={S.fractionArea.removePartFor(side)}
        onClick={() => dispatch({ type: 'set-parts', side, n: parts.n - 1 })}
        disabled={locked || parts.n <= 1}
      >
        −
      </button>
      <span className={styles.count} data-testid={`parts-${side}`}>
        {parts.n}
      </span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={S.fractionArea.addPartFor(side)}
        onClick={() => dispatch({ type: 'set-parts', side, n: parts.n + 1 })}
        disabled={locked}
      >
        +
      </button>
      <span className={styles.groupLabel}>{S.fractionArea.shaded(side)}</span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={S.fractionArea.unshadeFor(side)}
        onClick={() => dispatch({ type: 'set-shaded', side, k: parts.k - 1 })}
        disabled={locked || parts.k <= 0}
      >
        −
      </button>
      <span className={styles.count} data-testid={`shaded-${side}`}>
        {parts.k}
      </span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={S.fractionArea.shadeFor(side)}
        onClick={() => dispatch({ type: 'set-shaded', side, k: parts.k + 1 })}
        disabled={locked || parts.k >= parts.n}
      >
        +
      </button>
    </div>
  );
}

export function FractionAreaView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>) {
  const fraction = state.fraction;
  if (fraction === null) return null;
  const { settings } = state;
  const square = fractionSquareRect();
  const cellWidth = square.width / fraction.a.n;
  const cellHeight = square.height / fraction.b.n;
  const locked = settings.locked || readOnly;

  const toggleCell = (col: number, row: number) => {
    if (locked) return;
    if (row === 0) {
      const next = col + 1 === fraction.a.k ? col : col + 1;
      dispatch({ type: 'set-shaded', side: 'a', k: next });
    } else {
      const next = row + 1 === fraction.b.k ? row : row + 1;
      dispatch({ type: 'set-shaded', side: 'b', k: next });
    }
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <SideControls side="a" parts={fraction.a} dispatch={dispatch} locked={locked} />
        <SideControls side="b" parts={fraction.b} dispatch={dispatch} locked={locked} />
        <span className={styles.hint}>{S.instructions['fraction-area']}</span>
      </div>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.fractionArea.canvasLabel}
        data-testid="array-canvas"
        data-cpa={cpa}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
        <defs>
          <pattern
            id="e04-frac-a"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={8} stroke={YELLOW} strokeWidth={2} />
          </pattern>
          <pattern
            id="e04-frac-b"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <line x1={0} y1={0} x2={0} y2={8} stroke={BLUE} strokeWidth={2} />
          </pattern>
          <pattern id="e04-frac-overlap" width={10} height={10} patternUnits="userSpaceOnUse">
            <path d="M0 0H10V10H0Z" fill={GREEN} fillOpacity={0.25} />
            <path d="M0 0L10 10M10 0L0 10" stroke={GREEN} strokeWidth={1.4} />
          </pattern>
        </defs>

        {Array.from({ length: fraction.b.n }, (_, row) =>
          Array.from({ length: fraction.a.n }, (_, col) => {
            const inA = col < fraction.a.k;
            const inB = row < fraction.b.k;
            const fill =
              inA && inB
                ? 'url(#e04-frac-overlap)'
                : inA
                  ? 'url(#e04-frac-a)'
                  : inB
                    ? 'url(#e04-frac-b)'
                    : '#ffffff';
            const stroke = inA && inB ? GREEN : inA ? YELLOW : inB ? BLUE : '#c9d2e0';
            return (
              <g
                key={`frac-${row}-${col}`}
                role="button"
                tabIndex={locked ? -1 : 0}
                aria-label={S.fractionArea.cellLabel(col, row)}
                data-cell={`${col},${row}`}
                onClick={() => toggleCell(col, row)}
                onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleCell(col, row);
                  }
                }}
              >
                <rect
                  x={square.x + col * cellWidth}
                  y={square.y + row * cellHeight}
                  width={cellWidth}
                  height={cellHeight}
                  fill={fill}
                  fillOpacity={inA || inB ? 0.6 : 1}
                  stroke={stroke}
                  strokeWidth={inA || inB ? 2 : 1}
                  pointerEvents="all"
                />
              </g>
            );
          }),
        )}

        <rect
          x={square.x}
          y={square.y}
          width={square.width}
          height={square.height}
          fill="none"
          stroke={INK}
          strokeWidth={2.6}
          pointerEvents="none"
        />

        {settings.showCounts ? (
          <text
            x={square.x}
            y={square.y + square.height + 30}
            fontSize={17}
            fill={GREEN}
            data-testid="overlap-count"
          >
            {S.fractionArea.count(fraction.a.k * fraction.b.k, fraction.a.n * fraction.b.n)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
