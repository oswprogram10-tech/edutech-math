/**
 * 힌트 ②: log-zoom에서 이전 단계 구간 띠를 깜빡여 "작아진 이전 구간"을 보여 준다.
 * 값이나 정답 위치는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { numberLineStrings } from '../strings.ko';
import { parseValue, xOfValue } from '../ticks';
import { LINE_LEFT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { NumberLineConfig, NumberLineState } from '../types';
import styles from '../View.module.css';

const LINE_Y = 380;

export function PrevBandOverlay({ state }: OverlayProps<NumberLineConfig, NumberLineState>) {
  const logZoom = state.logZoom;
  if (!logZoom || logZoom.level <= 0) return null;
  const max = parseValue(state.max);
  const previous = parseValue(logZoom.levels[logZoom.level - 1]);
  if (!max || !previous) return null;
  const right = xOfValue(previous, parseValue(state.min) ?? previous, max);
  const width = Math.max(0, right - LINE_LEFT);
  if (width <= 0) return null;
  return (
    <svg
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      width="100%"
      height="100%"
      data-testid="overlay-prev-band"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="e03-overlay-prev-hatch"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="14" height="14" fill="#dfe8ff" />
          <line x1="0" y1="0" x2="0" y2="14" stroke="#8ea8dc" strokeWidth="4" />
        </pattern>
      </defs>
      <rect
        x={LINE_LEFT}
        y={LINE_Y - 140}
        width={width}
        height={116}
        fill="url(#e03-overlay-prev-hatch)"
        stroke="#d64545"
        strokeWidth={3}
        className={styles.prevBandBlink}
      />
      <text x={LINE_LEFT + 8} y={LINE_Y - 148} fill="#1d2330" fontSize={17} fontWeight={700}>
        {numberLineStrings.logZoom.pastBand}
      </text>
    </svg>
  );
}
