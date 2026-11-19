/**
 * 힌트 ② (MC-ORDER-LEFT-TO-RIGHT·MC-ORDER-MUL-BEFORE-DIV): 마지막으로 잘못 누른 곳을 기준으로
 * 두 계산 결과를 나란히 보여 준다. 명세 ②가 두 결과를 함께 보이라고 하므로 끝값 노출을 허용한다.
 *
 * 기준은 식 줄 SVG(`order-expr`)다. 두 줄은 식 줄 아래 빈 자리에 그리므로, 오버레이 svg가
 * 자기 상자 밖으로 그릴 수 있게 View CSS가 `overflow: visible`을 준다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import {
  WRONG_CODES,
  currentTree,
  exprCanvasSize,
  findBin,
  isNum,
  pressedValue,
  promisedValue,
} from '../order-tree';
import { stepSolverStrings as S } from '../strings.ko';
import type { AnyStepSolverConfig, AnyStepSolverState } from '../types';

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 170;

export function TwoWaysOverlay({ state }: OverlayProps<AnyStepSolverConfig, AnyStepSolverState>) {
  if (state.mode !== 'order-tree') return null;
  const last = [...state.wrongTaps]
    .reverse()
    .find(
      (entry) => entry.code === WRONG_CODES.leftToRight || entry.code === WRONG_CODES.mulBeforeDiv,
    );
  if (last === undefined) return null;
  const tree = currentTree(state);
  if (isNum(tree) || findBin(tree, last.opIndex) === undefined) return null;

  const pressed = pressedValue(tree, last.opIndex);
  const promised = promisedValue(tree);
  const size = exprCanvasSize(state);
  const top = size.height + 8;

  return (
    <CanvasAlignedOverlay
      testId="overlay-two-ways"
      canvasSelector={'svg[data-testid="order-expr"]'}
      logicalWidth={size.width}
      logicalHeight={size.height}
    >
      <rect
        x={0}
        y={top}
        width={Math.max(size.width, PANEL_WIDTH)}
        height={PANEL_HEIGHT}
        rx={16}
        fill="#ffffff"
        fillOpacity={0.96}
        stroke="#e8b27a"
        strokeWidth={2}
      />
      <text x={24} y={top + 42} fontSize={22} fill="#1d2330" data-testid="two-ways-pressed">
        {S.orderTree.twoWaysPressed}
        {'  '}
        <tspan fontWeight={700}>
          {pressed === null ? S.orderTree.twoWaysUnknown : pressed.toString()}
        </tspan>
      </text>
      <text x={24} y={top + 86} fontSize={22} fill="#1d2330" data-testid="two-ways-rule">
        {S.orderTree.twoWaysRule}
        {'  '}
        <tspan fontWeight={700}>{promised.toString()}</tspan>
      </text>
      <text x={24} y={top + 134} fontSize={22} fill="#b25a0a" fontWeight={700}>
        {S.orderTree.twoWaysQuestion}
      </text>
    </CanvasAlignedOverlay>
  );
}
