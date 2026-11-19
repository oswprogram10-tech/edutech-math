/**
 * E08 `order-tree` 화면.
 *
 * - 식 줄(SVG `order-expr`): 연산 기호만 누를 수 있는 단추다. 수는 단추가 아니다.
 * - 트리 SVG(`order-tree-canvas`): 계산할 때마다 한 줄씩 아래로 늘고, 계산한 부분은
 *   묶음 괄호와 가지 선으로 값에 이어진다.
 * - 정답 위치는 알려 주지 않는다. ✓/✕도 그리지 않는다. 틀린 누름은 흔들림과 문구뿐이다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../core/engine-sdk';
import {
  EXPR_HEIGHT,
  EXPR_MIN_WIDTH,
  LAYOUT,
  currentTree,
  layoutTokens,
  remainingOps,
  rowsOf,
  symbolOf,
  tokenize,
} from './order-tree';
import type { OtToken, TokenizedTree } from './order-tree';
import { stepSolverStrings as S } from './strings.ko';
import type { AnyStepSolverConfig, OrderTreeState, StepSolverAction } from './types';
import styles from './OrderTreeView.module.css';

const ROW_HEIGHT = 86;
const TREE_FONT = 32;

function tokenLabel(token: OtToken): string {
  switch (token.kind) {
    case 'num':
      return token.text;
    case 'op':
      return symbolOf(token.op);
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
  }
}

function nearestOp(ops: readonly number[], target: number): number | null {
  let best: number | null = null;
  for (const op of ops) {
    if (best === null || Math.abs(op - target) < Math.abs(best - target)) best = op;
  }
  return best;
}

interface TreeRowsProps {
  readonly rows: readonly TokenizedTree[];
  readonly order: readonly number[];
}

function TreeCanvas({ rows, order }: TreeRowsProps) {
  const layouts = rows.map((row) => layoutTokens(row.tokens));
  const width = Math.max(EXPR_MIN_WIDTH, ...layouts.map((layout) => layout.width));
  const height = rows.length * ROW_HEIGHT;

  return (
    <svg
      className={styles.tree}
      data-testid="order-tree-canvas"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={S.orderTree.treeLabel}
    >
      {rows.map((row, rowIndex) => {
        const layout = layouts[rowIndex];
        if (layout === undefined) return null;
        const centerY = rowIndex * ROW_HEIGHT + 30;
        return (
          <g key={`row-${rowIndex}`} data-testid={`tree-row-${rowIndex}`}>
            {row.tokens.map((token, index) => {
              const slot = layout.slots[index];
              if (slot === undefined) return null;
              const isResult = token.kind === 'num' && token.from !== null;
              return (
                <text
                  key={`t-${rowIndex}-${index}`}
                  x={slot.x + slot.w / 2}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={TREE_FONT}
                  className={isResult ? styles.treeResult : styles.treeText}
                >
                  {tokenLabel(token)}
                </text>
              );
            })}
          </g>
        );
      })}
      {order.map((opIndex, step) => {
        const above = rows[step];
        const below = rows[step + 1];
        const aboveLayout = layouts[step];
        const belowLayout = layouts[step + 1];
        const span = above?.spans.get(opIndex);
        if (!above || !below || !aboveLayout || !belowLayout || span === undefined) return null;
        const first = aboveLayout.slots[span[0]];
        const last = aboveLayout.slots[span[1] - 1];
        const resultAt = below.tokens.findIndex(
          (token) => token.kind === 'num' && token.from === opIndex,
        );
        const result = belowLayout.slots[resultAt];
        if (first === undefined || last === undefined || result === undefined) return null;
        const left = first.x;
        const right = last.x + last.w;
        const bracketY = step * ROW_HEIGHT + 60;
        const mid = (left + right) / 2;
        const targetX = result.x + result.w / 2;
        const targetY = (step + 1) * ROW_HEIGHT + 10;
        return (
          <path
            key={`branch-${step}`}
            className={styles.treeBranch}
            data-testid={`tree-branch-${step}`}
            d={`M ${left} ${bracketY - 8} V ${bracketY} H ${right} V ${bracketY - 8} M ${mid} ${bracketY} L ${targetX} ${targetY}`}
          />
        );
      })}
    </svg>
  );
}

export function OrderTreeView({
  state,
  dispatch,
  readOnly = false,
  targetSize,
}: EngineViewProps<AnyStepSolverConfig, OrderTreeState, StepSolverAction>) {
  const tree = useMemo(() => currentTree(state), [state]);
  const tokenized = useMemo(() => tokenize(tree), [tree]);
  const layout = useMemo(() => layoutTokens(tokenized.tokens), [tokenized]);
  const rows = useMemo(() => (state.settings.showTree ? rowsOf(state) : []), [state]);
  const ops = useMemo(() => remainingOps(tree), [tree]);
  const exprRef = useRef<SVGSVGElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [focusOp, setFocusOp] = useState<number | null>(null);
  const activeOp = focusOp !== null && ops.includes(focusOp) ? focusOp : (ops[0] ?? null);

  const width = Math.max(EXPR_MIN_WIDTH, layout.width);
  const rootStyle = { '--target': `${targetSize}px` } as CSSProperties;

  const focusOpElement = (opIndex: number): void => {
    setFocusOp(opIndex);
    exprRef.current?.querySelector<SVGGElement>(`[data-op="${opIndex}"]`)?.focus();
  };

  // 키보드로 계산하면 지워진 기호 대신 가까운 기호로 초점을 옮긴다.
  useEffect(() => {
    const pressed = pendingFocus.current;
    if (pressed === null) return;
    pendingFocus.current = null;
    const next = nearestOp(ops, pressed);
    if (next !== null) focusOpElement(next);
  });

  const tap = (opIndex: number, fromKeyboard: boolean): void => {
    if (readOnly) return;
    if (fromKeyboard) pendingFocus.current = opIndex;
    dispatch({ type: 'tap', opIndex });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (readOnly) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    const opElement = target instanceof Element ? target.closest('[data-op]') : null;
    const current = opElement ? Number(opElement.getAttribute('data-op')) : null;

    if (event.key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'undo' });
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (ops.length === 0) return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      if (current === null) {
        const edge = delta === 1 ? ops[0] : ops[ops.length - 1];
        if (edge !== undefined) focusOpElement(edge);
        return;
      }
      const next = ops[ops.indexOf(current) + delta];
      if (next !== undefined) focusOpElement(next);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && current !== null) {
      event.preventDefault();
      tap(current, true);
    }
  };

  const centerY = EXPR_HEIGHT / 2;
  const opHeight = LAYOUT.opWidth;

  return (
    <div
      className={`${styles.root} ${readOnly ? styles.readOnly : ''}`}
      style={rootStyle}
      data-testid="step-solver"
      data-mode="order-tree"
      data-target-size={targetSize}
      tabIndex={0}
      role="group"
      aria-label={S.canvasLabel}
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>{S.instructions['order-tree']}</p>

      <div className={styles.exprScroll}>
        <svg
          ref={exprRef}
          className={styles.expr}
          data-testid="order-expr"
          viewBox={`0 0 ${width} ${EXPR_HEIGHT}`}
          width={width}
          height={EXPR_HEIGHT}
          role="group"
          aria-label={S.orderTree.exprLabel}
        >
          {tokenized.tokens.map((token, index) => {
            const slot = layout.slots[index];
            if (slot === undefined) return null;
            const cx = slot.x + slot.w / 2;
            if (token.kind === 'op') {
              const shaking = state.shake !== null && state.shake.opIndex === token.idx;
              return (
                <g
                  key={`op-${token.idx}`}
                  className={styles.op}
                  data-op={token.idx}
                  data-testid={`op-${token.idx}`}
                  role="button"
                  tabIndex={activeOp === token.idx ? 0 : -1}
                  aria-label={S.orderTree.opAria(symbolOf(token.op))}
                  aria-disabled={readOnly}
                  onClick={() => tap(token.idx, false)}
                  onFocus={() => setFocusOp(token.idx)}
                >
                  <g
                    key={shaking ? `shake-${state.shake?.seq ?? 0}` : 'still'}
                    className={shaking ? styles.shake : undefined}
                    data-shaking={shaking ? 'true' : undefined}
                  >
                    <rect
                      className={styles.opRect}
                      x={slot.x}
                      y={centerY - opHeight / 2}
                      width={slot.w}
                      height={opHeight}
                      rx={14}
                    />
                    <text
                      className={styles.opText}
                      x={cx}
                      y={centerY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={40}
                    >
                      {symbolOf(token.op)}
                    </text>
                  </g>
                </g>
              );
            }
            return (
              <text
                key={`tok-${index}`}
                className={token.kind === 'num' ? styles.numText : styles.parenText}
                x={cx}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={token.kind === 'num' ? 40 : 52}
              >
                {tokenLabel(token)}
              </text>
            );
          })}
        </svg>
      </div>

      <p className={styles.wrongMessage} role="status" data-testid="order-wrong-message">
        {state.shake !== null ? S.orderTree.wrongTap : ''}
      </p>

      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          data-testid="order-undo"
          disabled={readOnly || state.reductions.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
        >
          {S.orderTree.undo}
        </button>
        <button
          type="button"
          className={styles.button}
          data-testid="order-reset"
          disabled={readOnly || state.reductions.length === 0}
          onClick={() => dispatch({ type: 'reset' })}
        >
          {S.orderTree.reset}
        </button>
      </div>

      {state.settings.showTree ? (
        <div
          className={styles.treeScroll}
          tabIndex={0}
          role="group"
          aria-label={S.orderTree.treeLabel}
        >
          <TreeCanvas rows={rows} order={state.reductions.map((entry) => entry.opIndex)} />
        </div>
      ) : null}

      <p className={styles.keyboardHint}>{S.orderTree.keyboardHint}</p>
    </div>
  );
}
