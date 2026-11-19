/**
 * 힌트 ② (MC-ORDER-PAREN-IGNORED): 아직 풀리지 않은 괄호 덩어리를 굵은 상자와 무늬로 감싼다.
 * 기준은 식 줄 SVG(`order-expr`)다. 어느 연산을 눌러야 하는지는 알려 주지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { currentTree, exprCanvasSize, layoutTokens, tokenize } from '../order-tree';
import type { AnyStepSolverConfig, AnyStepSolverState } from '../types';

const PATTERN_ID = 'order-group-box-pattern';

export function GroupBoxOverlay({ state }: OverlayProps<AnyStepSolverConfig, AnyStepSolverState>) {
  if (state.mode !== 'order-tree') return null;
  const tokenized = tokenize(currentTree(state));
  if (tokenized.groups.length === 0) return null;
  const { slots } = layoutTokens(tokenized.tokens);
  const size = exprCanvasSize(state);

  return (
    <CanvasAlignedOverlay
      testId="overlay-group-box"
      canvasSelector={'svg[data-testid="order-expr"]'}
      logicalWidth={size.width}
      logicalHeight={size.height}
    >
      <defs>
        <pattern id={PATTERN_ID} width={10} height={10} patternUnits="userSpaceOnUse">
          <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke="#e8872e" strokeWidth={2} />
        </pattern>
      </defs>
      {tokenized.groups.map(([start, end]) => {
        const first = slots[start];
        const last = slots[end - 1];
        if (first === undefined || last === undefined) return null;
        return (
          <rect
            key={`group-${start}`}
            x={first.x - 4}
            y={6}
            width={last.x + last.w - first.x + 8}
            height={size.height - 12}
            rx={16}
            fill={`url(#${PATTERN_ID})`}
            fillOpacity={0.35}
            stroke="#e8872e"
            strokeWidth={5}
          />
        );
      })}
    </CanvasAlignedOverlay>
  );
}
