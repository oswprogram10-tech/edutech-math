/**
 * 힌트 ② tens-brackets.
 * 다 칠해진 10칸 줄마다 괄호와 "10"을 붙이고, 아직 10칸을 못 채운 칠한 칸은 점선으로 묶는다.
 * 학생이 칠한 칸을 10칸씩 세어 주는 그림이다. 정답(몇 칸을 칠해야 하는지)은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { decadeRect, percentCellRect } from '../layout';
import { E20_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

const INK = '#1d2330';
const GOLD = '#b8860b';

export function TensBracketsOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'percent' || state.error !== null) return null;
  const { layout } = state.settings;
  const shaded = new Set(state.cells);
  const parts = [];
  for (let j = 0; j < 10; j += 1) {
    const mine = Array.from({ length: 10 }, (_, k) => j * 10 + k).filter((i) => shaded.has(i));
    if (mine.length === 0) continue;
    const box = decadeRect(layout, j);
    if (mine.length === 10) {
      if (layout === 'grid') {
        const x = box.x + box.w + 10;
        parts.push(
          <g key={`ten-${j}`} data-part="ten-bracket" data-decade={j}>
            <path
              d={`M ${x} ${box.y + 4} h 10 v ${box.h - 8} h -10`}
              fill="none"
              stroke={GOLD}
              strokeWidth={4}
            />
            <text
              x={x + 18}
              y={box.y + box.h / 2 + 8}
              fontSize={24}
              fontWeight={800}
              fill={INK}
              data-part="ten-label"
            >
              {S.percent.overlay.ten}
            </text>
          </g>,
        );
      } else {
        const y = box.y - 10;
        parts.push(
          <g key={`ten-${j}`} data-part="ten-bracket" data-decade={j}>
            <path
              d={`M ${box.x + 4} ${y} v -10 h ${box.w - 8} v 10`}
              fill="none"
              stroke={GOLD}
              strokeWidth={4}
            />
            <text
              x={box.x + box.w / 2}
              y={y - 18}
              textAnchor="middle"
              fontSize={24}
              fontWeight={800}
              fill={INK}
              data-part="ten-label"
            >
              {S.percent.overlay.ten}
            </text>
          </g>,
        );
      }
      continue;
    }
    const rects = mine.map((i) => percentCellRect(layout, i));
    const x0 = Math.min(...rects.map((r) => r.x));
    const y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.w));
    const y1 = Math.max(...rects.map((r) => r.y + r.h));
    parts.push(
      <rect
        key={`rest-${j}`}
        x={x0 - 2}
        y={y0 - 2}
        width={x1 - x0 + 4}
        height={y1 - y0 + 4}
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeDasharray="8 5"
        data-part="rest-ring"
        data-decade={j}
      />,
    );
  }
  return (
    <CanvasAlignedOverlay
      testId="overlay-tens-brackets"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {parts}
    </CanvasAlignedOverlay>
  );
}
