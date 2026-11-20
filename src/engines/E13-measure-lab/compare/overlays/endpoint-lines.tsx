/**
 * 힌트 ② endpoint-lines (MC-MEASURE-ENDPOINT). 길이 물건마다 왼쪽 끝에 세로 점선을 긋고,
 * 출발선과 어긋난 만큼 가로 괄호와 "어긋남" 글을 단다. 모두 맞춰져 있으면 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { num } from '../../rat';
import { E13_STRINGS as S } from '../../strings.ko';
import { BASE_X, BOARD, boardHeight, LENGTH_CELL, lengthX } from '../geometry';
import { COMPARE_CANVAS_SELECTOR } from '../types';
import type { CompareConfig, CompareState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';

export function EndpointLinesOverlay({ state }: OverlayProps<CompareConfig, CompareState>) {
  if (state.error !== null || state.attribute !== 'length') return null;
  const xs = state.items.map((item) => num(item.x));
  const reference = state.baseline ? 0 : Math.min(...xs);
  if (xs.every((x) => x === reference)) return null;
  const refPx = state.baseline ? BASE_X : lengthX(reference);
  return (
    <CanvasAlignedOverlay
      testId="overlay-endpoint-lines"
      canvasSelector={COMPARE_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      <line
        data-part="reference-line"
        x1={refPx}
        y1={40}
        x2={refPx}
        y2={boardHeight(state) - 20}
        stroke={ORANGE}
        strokeWidth={4}
        strokeDasharray="10 8"
      />
      {state.items.map((item) => {
        const x = num(item.x);
        const y = num(item.y) * LENGTH_CELL + 30;
        const px = lengthX(x);
        const off = x !== reference;
        return (
          <g key={item.id} data-part="endpoint" data-id={item.id}>
            <line
              data-part="end-line"
              x1={px}
              y1={y - 34}
              x2={px}
              y2={y + 46}
              stroke={INK}
              strokeWidth={3}
              strokeDasharray="6 5"
            />
            {off ? (
              <g data-part="bracket">
                <path
                  d={`M${refPx},${y + 40} v8 H${px} v-8`}
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth={4}
                />
                <text
                  data-part="label"
                  x={(refPx + px) / 2}
                  y={y + 76}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={800}
                  fill={INK}
                  stroke="#fffdf6"
                  strokeWidth={5}
                  paintOrder="stroke"
                >
                  {S.overlay.misaligned}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
