/**
 * 둘씩 짝짓기. 예측 → 결정적 짝짓기 → 남는 사람은 깃발로만 보여 준다.
 *
 * - 아이는 줄마다 두 쌍(4명)까지 놓아 짝 선이 줄을 넘지 않는다.
 * - 예측 단계에서도 아이를 보여 준다(수는 쓰지 않는다).
 * - 깃발은 남는 아이의 오른쪽 빈자리에 그려 다른 아이와 겹치지 않는다.
 */
import type { EngineViewProps } from '../../../core/engine-sdk';
import { CounterIconShape } from '../icons';
import { PAIRING_ICON_RADIUS, pairingPoint } from '../layout';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';

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
  const people = Array.from({ length: state.count }, (_, index) => pairingPoint(index));
  const paired = state.phase === 'paired';
  const leftover = state.count % 2 === 1 ? state.count - 1 : null;
  const leftoverPoint = leftover === null ? null : (people[leftover] ?? null);
  const radius = PAIRING_ICON_RADIUS;

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

        {/* 짝 선은 같은 줄의 두 아이 사이에만 그린다. */}
        {paired
          ? Array.from({ length: Math.floor(state.count / 2) }, (_, pair) => {
              const first = people[pair * 2];
              const second = people[pair * 2 + 1];
              if (!first || !second) return null;
              return (
                <line
                  key={`pair-${pair}`}
                  data-pair-line={pair}
                  className={styles.pairLink}
                  style={{ animationDelay: `${pair * 0.12}s` }}
                  x1={first.x + radius * 0.8}
                  y1={first.y}
                  x2={second.x - radius * 0.8}
                  y2={second.y}
                  stroke="#2f9e6b"
                  strokeWidth={7}
                  strokeLinecap="round"
                  opacity={0.55}
                />
              );
            })
          : null}

        {people.map((point, index) => (
          <g key={`person-${index}`} role="img" aria-label={S.iconNames[icon]} data-person={index}>
            <CounterIconShape icon={icon} color="red" x={point.x} y={point.y} r={radius} />
          </g>
        ))}

        {paired && leftoverPoint !== null ? (
          <g aria-label={S.leftoverFlag} data-leftover-flag="true">
            <line
              x1={leftoverPoint.x + radius + 12}
              y1={leftoverPoint.y - radius - 20}
              x2={leftoverPoint.x + radius + 12}
              y2={leftoverPoint.y + radius + 20}
              stroke="#1d2330"
              strokeWidth={4}
            />
            <polygon
              points={`${leftoverPoint.x + radius + 12},${leftoverPoint.y - radius - 20} ${leftoverPoint.x + radius + 66},${leftoverPoint.y - radius - 6} ${leftoverPoint.x + radius + 12},${leftoverPoint.y - radius + 8}`}
              fill="#e8872e"
            />
          </g>
        ) : null}
      </svg>

      <p className={styles.status}>{paired ? S.pairedHint : ''}</p>
    </div>
  );
}
