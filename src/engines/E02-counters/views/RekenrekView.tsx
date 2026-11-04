/** 구슬셈판(rekenrek). 줄마다 왼쪽으로 민 구슬만큼 수를 나타낸다. */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { REKENREK_BEAD_GAP, REKENREK_LEFT_X, REKENREK_RIGHT_X, rekenrekRowY } from '../layout';
import { rekenrekTotalOf } from '../reduce';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const RED = '#d64545';
const BLUE = '#2f6fde';
const BEAD_RADIUS = 22;

function beadX(slot: number, left: number): number {
  if (slot < left) return REKENREK_LEFT_X + slot * REKENREK_BEAD_GAP;
  return REKENREK_RIGHT_X - (10 - slot - 1) * REKENREK_BEAD_GAP;
}

export function RekenrekView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: Props) {
  if (state.mode !== 'rekenrek') return null;
  const showNumeral = config.showNumeral === 'always';
  const breakAt = Math.max(1, Math.min(9, Math.round(config.colorBreak ?? 5)));
  const skips = [
    ...new Set(
      (config.skipBy ?? [1])
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 10)
        .map((value) => Math.trunc(value)),
    ),
  ].sort((a, b) => a - b);
  const skipFirst = skips[0] ?? 1;

  const onRowKey = (event: ReactKeyboardEvent<SVGGElement>, row: number) => {
    if (readOnly) return;
    let count: number | null = null;
    if (event.key === 'ArrowLeft') count = skipFirst;
    else if (event.key === 'ArrowRight') count = -1;
    else if (event.key === '1') count = 1;
    else if (event.key === '2') count = 2;
    else if (event.key === '5') count = 5;
    else if (event.key === '0') count = 10;
    if (count === null) return;
    event.preventDefault();
    if (count < 0) dispatch({ type: 'pull', row, count: -count });
    else dispatch({ type: 'push', row, count });
  };

  const onBead = (row: number, slot: number) => {
    if (readOnly) return;
    const left = state.left[row] ?? 0;
    if (slot < left) dispatch({ type: 'pull', row, count: left - slot });
    else dispatch({ type: 'push', row, count: slot - left + 1 });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {showNumeral ? (
          <p className={styles.total} data-testid="counter-total">
            {S.total(rekenrekTotalOf(state))}
          </p>
        ) : null}
      </div>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.canvasLabel}
        data-testid="counters-canvas"
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
        {state.left.map((left, row) => {
          const y = rekenrekRowY(state.rows, row);
          return (
            <g
              key={`row-${row}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={S.rekenrekRow(row)}
              className={styles.item}
              onKeyDown={(event) => onRowKey(event, row)}
            >
              <line
                x1={REKENREK_LEFT_X - 40}
                y1={y}
                x2={REKENREK_RIGHT_X + 40}
                y2={y}
                stroke="#9aa6ba"
                strokeWidth={6}
                strokeLinecap="round"
              />
              {Array.from({ length: 10 }, (_, slot) => {
                const x = beadX(slot, left);
                const firstHalf = slot < breakAt;
                return (
                  <g key={`bead-${row}-${slot}`} onPointerDown={() => onBead(row, slot)}>
                    <circle
                      cx={x}
                      cy={y}
                      r={BEAD_RADIUS}
                      fill={firstHalf ? RED : BLUE}
                      stroke={INK}
                      strokeOpacity={0.25}
                      strokeWidth={1.5}
                    />
                    {firstHalf ? null : (
                      <circle cx={x} cy={y} r={BEAD_RADIUS * 0.34} fill="#ffffff" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <p className={styles.instructions}>{S.rekenrekHint}</p>

      <div className={styles.plateControls}>
        {state.left.map((_, row) => (
          <div key={`controls-${row}`} className={styles.plateControl}>
            <span className={styles.plateName}>{S.rekenrekRow(row)}</span>
            <div className={styles.buttonRow}>
              {skips.map((skip) => (
                <button
                  key={`push-${row}-${skip}`}
                  type="button"
                  className={styles.button}
                  onClick={() => dispatch({ type: 'push', row, count: skip })}
                  disabled={readOnly}
                  aria-label={`${S.rekenrekRow(row)} ${S.rekenrekPush(skip)}`}
                >
                  +{skip}
                </button>
              ))}
              <button
                type="button"
                className={styles.button}
                onClick={() => dispatch({ type: 'pull', row, count: 1 })}
                disabled={readOnly}
                aria-label={`${S.rekenrekRow(row)} ${S.rekenrekPull}`}
              >
                −1
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
