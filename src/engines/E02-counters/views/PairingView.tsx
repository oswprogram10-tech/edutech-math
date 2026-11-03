/** 둘씩 짝짓기. 예측 → 결정적 짝짓기 → 남는 사람은 깃발로만 보여 준다. */
import type { EngineViewProps } from '../../../core/engine-sdk';
import { CounterIconShape } from '../icons';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const ICON_RADIUS = 26;

function personPoint(index: number): { x: number; y: number } {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return { x: 250 + column * 125, y: 175 + row * 105 };
}

export function PairingView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: Props) {
  if (state.mode !== 'pairing') return null;
  const labels = config.labels ?? S.pairLabels;
  const icon = config.icon ?? 'child';
  const people = Array.from({ length: state.count }, (_, index) => personPoint(index));
  const paired = state.phase === 'paired';
  const leftover = state.count % 2 === 1 ? state.count - 1 : null;

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {state.phase === 'predict' ? (
          <>
            <p className={styles.total}>{S.pairingPrompt}</p>
            {[0, 1].map((choice) => (
              <button
                key={`predict-${choice}`}
                type="button"
                className={styles.button}
                onClick={() => dispatch({ type: 'predict', choice: choice === 1 ? 1 : 0 })}
                disabled={readOnly}
              >
                {labels[choice === 1 ? 1 : 0]}
              </button>
            ))}
          </>
        ) : null}
        {state.phase === 'ready' ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'make-pairs' })}
            disabled={readOnly}
          >
            {S.makePairs}
          </button>
        ) : null}
        {paired ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'reset-pairs' })}
            disabled={readOnly}
          >
            {S.resetPairs}
          </button>
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
        {state.phase === 'predict' ? (
          <text x={500} y={320} textAnchor="middle" fontSize={26} fill={INK}>
            {S.pairingPrompt}
          </text>
        ) : null}
        {state.phase !== 'predict'
          ? people.map((point, index) => (
              <g
                key={`person-${index}`}
                role="img"
                aria-label={S.iconNames[icon]}
                data-person={index}
              >
                <CounterIconShape
                  icon={icon}
                  color={index % 2 === 0 ? 'red' : 'blue'}
                  x={point.x}
                  y={point.y}
                  r={ICON_RADIUS}
                />
              </g>
            ))
          : null}
        {paired
          ? Array.from({ length: Math.floor(state.count / 2) }, (_, pair) => {
              const first = people[pair * 2];
              const second = people[pair * 2 + 1];
              if (!first || !second) return null;
              return (
                <line
                  key={`pair-${pair}`}
                  className={styles.pairLink}
                  style={{ animationDelay: `${pair * 0.12}s` }}
                  x1={first.x + ICON_RADIUS * 0.8}
                  y1={first.y}
                  x2={second.x - ICON_RADIUS * 0.8}
                  y2={second.y}
                  stroke="#2f9e6b"
                  strokeWidth={7}
                  strokeLinecap="round"
                  opacity={0.55}
                />
              );
            })
          : null}
        {paired && leftover !== null && people[leftover] ? (
          <g aria-label={S.leftoverFlag}>
            <line
              x1={(people[leftover]?.x ?? 0) + 30}
              y1={(people[leftover]?.y ?? 0) - 20}
              x2={(people[leftover]?.x ?? 0) + 30}
              y2={(people[leftover]?.y ?? 0) - 90}
              stroke={INK}
              strokeWidth={4}
            />
            <polygon
              points={`${(people[leftover]?.x ?? 0) + 30},${(people[leftover]?.y ?? 0) - 90} ${(people[leftover]?.x ?? 0) + 86},${(people[leftover]?.y ?? 0) - 74} ${(people[leftover]?.x ?? 0) + 30},${(people[leftover]?.y ?? 0) - 58}`}
              fill="#e8872e"
            />
          </g>
        ) : null}
      </svg>

      <p className={styles.status}>{paired ? S.pairedHint : ''}</p>
    </div>
  );
}
