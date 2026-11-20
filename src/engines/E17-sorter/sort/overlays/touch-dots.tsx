/**
 * 힌트 ② touch-dots (MC-COUNT-ONE-TO-ONE).
 * 상자 안 카드마다 짚는 점 하나를 차례로 찍는다(200ms 간격, 움직임 줄이기면 한 번에).
 * 번호는 쓰지 않는다: 번호의 끝이 개수 정답이 되기 때문이다.
 */
import type { OverlayProps } from '../../../../core/engine-sdk';
import type { SorterConfig, SorterState } from '../../types';
import { SortOverlayFrame } from './frame';
import { slotsOf, sortStateOf } from './helpers';
import styles from './Overlays.module.css';

export function TouchDotsOverlay({ state }: OverlayProps<SorterConfig, SorterState>) {
  const sort = sortStateOf(state);
  if (!sort) return null;
  const counters = new Map<string, number>();
  const dots = slotsOf(sort)
    .filter((slot) => slot.where !== 'tray' && slot.where !== 'belt')
    .map((slot) => {
      const n = counters.get(slot.where) ?? 0;
      counters.set(slot.where, n + 1);
      return { slot, order: n };
    });
  return (
    <SortOverlayFrame testId="touch-dots">
      {dots.map(({ slot, order }) => (
        <circle
          key={slot.id}
          className={styles.dot}
          cx={slot.center.x}
          cy={slot.center.y}
          r={9}
          fill="#e8872e"
          stroke="#ffffff"
          strokeWidth={3}
          data-dot={slot.where}
          style={{ animationDelay: `${order * 200}ms` }}
        />
      ))}
    </SortOverlayFrame>
  );
}
