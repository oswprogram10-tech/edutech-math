/**
 * 힌트 ② share-bracket.
 * 한 사람 줄의 칸들을 괄호로 묶고 "a칸 = 한 칸 × a"를 쓴다. 그 사람 몫 = 한 칸 크기 × a가 보이게 하되 값은 쓰지 않는다.
 * 고르는 줄: 아직 몫을 안 쓴 사람(알려 준 사람은 빼고) 중 첫 사람, 없으면 첫 사람.
 * symbols look에서는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { ROW_H, barLayout } from '../barLayout';
import { E20_STRINGS as S } from '../strings.ko';
import { BAR_LOGICAL_HEIGHT, CANVAS_SELECTOR, LOGICAL_WIDTH } from '../types';
import type { BarState, RatioConfig, RatioState } from '../types';

const INK = '#1d2330';
const GOLD = '#b8860b';

/** 괄호로 묶을 사람(parts 번호). */
function bracketPart(state: BarState): number {
  const open = state.partValues.findIndex(
    (value, i) => value === null && state.settings.known?.part !== i,
  );
  return open < 0 ? 0 : open;
}

export function ShareBracketOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'bar-model' || state.error !== null || state.settings.look === 'symbols') {
    return null;
  }
  const row = barLayout(state.settings).rows[bracketPart(state)];
  if (!row) return null;
  const x0 = row.cells[0]?.x ?? 0;
  const width = row.end - x0;
  const y = row.y + ROW_H + 6;
  return (
    <CanvasAlignedOverlay
      testId="overlay-share-bracket"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={BAR_LOGICAL_HEIGHT}
    >
      <g data-part="share-bracket" data-row={row.part} data-terms={row.terms}>
        <path d={`M ${x0} ${y} v 12 h ${width} v -12`} fill="none" stroke={GOLD} strokeWidth={4} />
        <text
          x={x0 + width / 2}
          y={y + 36}
          textAnchor="middle"
          fontSize={22}
          fontWeight={800}
          fill={INK}
          data-part="share-label"
        >
          {S.bar.overlay.shareCells(row.terms)}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
