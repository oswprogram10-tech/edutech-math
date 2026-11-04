/**
 * 10의 보수 방울(part-whole `bubble-pairs`).
 *
 * - 방울 숫자는 주어진 재료라 보여 준다.
 * - 목표 수·정답 짝은 화면에 쓰지 않는다.
 * - 틀리면 1.5초 동안 방울이 튕기고, `showSumOnMiss`면 '학생이 고른 합'만 보여 준다(반례).
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { bubblePoint } from '../layout';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const BUBBLE_RADIUS = 46;

export function BubblePairsView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: Props) {
  const bubbleState = state.mode === 'part-whole' && 'variant' in state ? state : null;
  const miss = bubbleState?.variant === 'bubble-pairs' ? bubbleState.lastMiss : null;

  if (!bubbleState || bubbleState.variant !== 'bubble-pairs') return null;
  const showSum = config.showSumOnMiss !== false;
  const face = config.face === 'dots' ? 'dots' : 'numeral';
  const selected = new Set(bubbleState.selected);
  const missKey = miss ? `${miss.sum}-${miss.ids.join('')}` : 'ok';

  const onKey = (event: ReactKeyboardEvent<SVGGElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (readOnly) return;
    dispatch(selected.has(id) ? { type: 'unpick', id } : { type: 'pick', id });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {miss && showSum ? (
          <p className={styles.missBadge} role="status" data-testid="bubble-miss">
            {S.bubbleMiss(miss.sum)}
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
        {bubbleState.bubbles
          .filter((bubble) => !bubble.popped)
          .map((bubble, index) => {
            const point = bubblePoint(index);
            const picked = selected.has(bubble.id);
            return (
              <g
                key={`${bubble.id}-${missKey}`}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={`${S.bubbleFace} ${bubble.value}`}
                aria-pressed={picked}
                className={[
                  styles.bubble,
                  picked ? styles.bubblePicked : '',
                  miss ? styles.bubbleMiss : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ animationDelay: `${(index % 6) * 0.4}s` }}
                data-value={bubble.value}
                onKeyDown={(event) => onKey(event, bubble.id)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  if (readOnly) return;
                  dispatch(
                    picked ? { type: 'unpick', id: bubble.id } : { type: 'pick', id: bubble.id },
                  );
                }}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={BUBBLE_RADIUS}
                  fill={picked ? '#ffe6bf' : '#e9f2ff'}
                  stroke={picked ? '#e8872e' : '#2f6fde'}
                  strokeWidth={picked ? 6 : 3}
                />
                {face === 'dots' ? (
                  <g aria-hidden="true">
                    {Array.from({ length: bubble.value }, (_, dot) => (
                      <circle
                        key={`dot-${dot}`}
                        cx={point.x - 24 + (dot % 3) * 24}
                        cy={point.y - 24 + Math.floor(dot / 3) * 24}
                        r={7}
                        fill={INK}
                      />
                    ))}
                  </g>
                ) : (
                  <text
                    x={point.x}
                    y={point.y + 12}
                    textAnchor="middle"
                    fontSize={38}
                    fontWeight={700}
                    fill={INK}
                  >
                    {bubble.value}
                  </text>
                )}
              </g>
            );
          })}
      </svg>

      <p className={styles.instructions}>{S.bubbleHint}</p>
    </div>
  );
}
