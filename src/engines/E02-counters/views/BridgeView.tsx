/**
 * 빈틈 채우는 막대 다리(part-whole `bridge`).
 *
 * - 막대 길이는 주어진 재료라 `face: 'numeral'`일 때만 숫자로 보여 준다.
 * - 틈 길이·놓은 막대의 합은 숫자로 쓰지 않는다. `noText`면 글자를 모두 감춘다(aria-label 유지).
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { bridgeCellWidth, BRIDGE_GROUND_Y, BRIDGE_START_X } from '../layout';
import { CounterIconShape } from '../icons';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#5b6577';
const GROUND_Y = BRIDGE_GROUND_Y;
const BANK_TOP = 120;
const BANK_BOTTOM = 400;
const START_X = BRIDGE_START_X;

export function BridgeView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: Props) {
  if (!(state.mode === 'part-whole' && 'variant' in state && state.variant === 'bridge'))
    return null;
  const bridge = state;
  const sum = bridge.placed.reduce((total, length) => total + length, 0);
  const span = Math.max(bridge.gap, sum, config.tenMarker ? 10 : 0);
  const cell = bridgeCellWidth(span);
  const gapWidth = bridge.gap * cell;
  const fits = sum === bridge.gap;
  const noText = config.noText === true;
  const face = config.face === 'numeral' ? 'numeral' : 'cells';

  const remove = (index: number) => {
    if (readOnly) return;
    dispatch({ type: 'remove-rod', index });
  };

  const onRodKey = (event: ReactKeyboardEvent<SVGGElement>, index: number) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    event.preventDefault();
    remove(index);
  };

  const placed = bridge.placed.map((length, index) => {
    const before = bridge.placed.slice(0, index).reduce((total, item) => total + item, 0);
    return { length, index, x: START_X + before * cell, width: length * cell };
  });

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {bridge.rods.map((length, index) => {
          const used = bridge.placed.filter((item) => item === length).length;
          const occurrence = bridge.rods.slice(0, index).filter((item) => item === length).length;
          const disabled = readOnly || bridge.placed.length >= bridge.maxRods || occurrence < used;
          return (
            <button
              key={`rod-${index}-${length}`}
              type="button"
              className={styles.button}
              onClick={() => dispatch({ type: 'place-rod', length })}
              disabled={disabled}
              aria-label={S.rodLabel(length)}
            >
              {face === 'numeral' ? (
                length
              ) : (
                <svg
                  width={2 + length * 7}
                  height={18}
                  viewBox={`0 0 ${2 + length * 7} 18`}
                  aria-hidden="true"
                >
                  {Array.from({ length }, (_, cellIndex) => (
                    <rect
                      key={`rod-button-cell-${cellIndex}`}
                      x={1 + cellIndex * 7}
                      y={3}
                      width={6}
                      height={12}
                      fill="#8fbf8a"
                      stroke="#3f7a49"
                      strokeWidth={1}
                    />
                  ))}
                </svg>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'record-bridge' })}
          disabled={readOnly || !fits}
        >
          {S.recordBridge}
        </button>
      </div>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.canvasLabel}
        data-testid="counters-canvas"
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
        <defs>
          <pattern
            id="e02-ten-hatch"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={8} stroke="#b25c32" strokeWidth={2.4} />
          </pattern>
        </defs>

        <rect
          x={START_X - 90}
          y={BANK_TOP}
          width={90}
          height={BANK_BOTTOM - BANK_TOP}
          rx={10}
          fill="#c9d6ea"
        />
        <rect
          x={START_X + gapWidth}
          y={BANK_TOP}
          width={90}
          height={BANK_BOTTOM - BANK_TOP}
          rx={10}
          fill="#c9d6ea"
        />
        <line
          x1={START_X}
          y1={GROUND_Y + 40}
          x2={START_X + gapWidth}
          y2={GROUND_Y + 40}
          stroke={MUTED}
          strokeWidth={3}
          strokeDasharray="10 8"
        />
        {face === 'cells'
          ? Array.from({ length: bridge.gap + 1 }, (_, tick) => (
              <line
                key={`gap-tick-${tick}`}
                data-gap-tick={tick}
                x1={START_X + tick * cell}
                y1={GROUND_Y + 26}
                x2={START_X + tick * cell}
                y2={GROUND_Y + 54}
                stroke={MUTED}
                strokeWidth={2}
              />
            ))
          : null}

        {config.tenMarker ? (
          <g>
            <line
              x1={START_X + 10 * cell}
              y1={BANK_TOP - 30}
              x2={START_X + 10 * cell}
              y2={GROUND_Y + 60}
              stroke="#e8872e"
              strokeWidth={4}
              strokeDasharray="8 6"
            />
            {!noText ? (
              <text
                x={START_X + 10 * cell}
                y={BANK_TOP - 40}
                textAnchor="middle"
                fontSize={18}
                fill={MUTED}
              >
                10
              </text>
            ) : null}
          </g>
        ) : null}

        {placed.map((rod) => {
          const overflows = rod.x + rod.width > START_X + gapWidth + 2;
          const before = bridge.placed.slice(0, rod.index).reduce((total, item) => total + item, 0);
          const overCells =
            config.tenMarker && face === 'cells'
              ? Array.from({ length: rod.length }, (_, cellIndex) => cellIndex).filter(
                  (cellIndex) => before + cellIndex >= 10,
                )
              : [];
          return (
            <g
              key={`placed-${rod.index}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={S.removeRod(rod.length)}
              className={styles.rod}
              onKeyDown={(event) => onRodKey(event, rod.index)}
              onPointerDown={(event) => {
                event.preventDefault();
                remove(rod.index);
              }}
            >
              <rect
                x={rod.x}
                y={GROUND_Y - 30}
                width={rod.width}
                height={60}
                rx={8}
                fill={overflows ? '#f6d7c4' : '#8fbf8a'}
                stroke={overflows ? '#b25c32' : '#3f7a49'}
                strokeWidth={3}
              />
              {overCells.map((cellIndex) => (
                <g key={`over-${rod.index}-${cellIndex}`} data-over-ten="true">
                  <rect
                    x={rod.x + cellIndex * cell}
                    y={GROUND_Y - 30}
                    width={cell}
                    height={60}
                    fill="#f0b27a"
                  />
                  <rect
                    x={rod.x + cellIndex * cell}
                    y={GROUND_Y - 30}
                    width={cell}
                    height={60}
                    fill="url(#e02-ten-hatch)"
                  />
                </g>
              ))}
              {face === 'cells' ? (
                Array.from({ length: rod.length }, (_, cellIndex) => (
                  <line
                    key={`cell-${rod.index}-${cellIndex}`}
                    x1={rod.x + cellIndex * cell}
                    y1={GROUND_Y - 30}
                    x2={rod.x + cellIndex * cell}
                    y2={GROUND_Y + 30}
                    stroke="#3f7a49"
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                ))
              ) : (
                <text
                  x={rod.x + rod.width / 2}
                  y={GROUND_Y + 9}
                  textAnchor="middle"
                  fontSize={24}
                  fontWeight={700}
                  fill={INK}
                >
                  {rod.length}
                </text>
              )}
            </g>
          );
        })}

        {fits ? (
          <g className={styles.bridgeWalk} aria-hidden="true">
            <CounterIconShape icon="child" color="red" x={START_X - 55} y={GROUND_Y - 34} r={20} />
          </g>
        ) : null}
      </svg>

      {!noText ? (
        <>
          <p className={styles.instructions}>{S.bridgeHint}</p>
          {bridge.recorded.length > 0 ? (
            <p className={styles.status}>
              {S.bridgeRecorded}: {bridge.recorded.map(() => '✓').join(' ')}
            </p>
          ) : (
            <p className={styles.status}>{S.bridgeNone}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
