/**
 * E08 `order-tree`: 혼합 계산식의 연산 기호를 눌러 계산 순서를 정하는 순수 로직.
 *
 * 식은 `core/math`의 `parse`가 우선순위·왼쪽 결합을 담아 만든 AST를 쓴다. 누를 수 있는
 * 연산은 두 자식이 모두 수인 이항 노드뿐이다(그것이 곧 약속이다). 연산마다 처음 식의
 * 왼쪽부터 번호(`opIndex`)를 매기고, 줄어든 뒤에도 바뀌지 않는다.
 *
 * AST는 `Rational`(BigInt)을 담아 JSON이 되지 않으므로 상태에는 처음 식과 계산 기록만
 * 두고, 현재 식은 그 기록을 다시 적용해 만든다.
 */
import type { EngineEvent, JsonValue, Observation } from '../../core/engine-sdk';
import { parse, Rational } from '../../core/math';
import type { Ast, BinaryOperator } from '../../core/math';
import { stepSolverStrings as S } from './strings.ko';
import type {
  OrderTreeAction,
  AnyStepSolverState,
  OrderTreeConfig,
  OrderTreeReduction,
  OrderTreeState,
  StepSolverAction,
} from './types';

/** 수(또는 이미 계산된 값). `from`은 그 값을 만든 연산 번호, 처음부터 수면 null. */
export interface OtNum {
  readonly k: 'num';
  readonly value: Rational;
  readonly text: string;
  readonly from: number | null;
}
export interface OtGroup {
  readonly k: 'group';
  readonly expr: OtNode;
}
export interface OtBin {
  readonly k: 'bin';
  readonly op: BinaryOperator;
  readonly idx: number;
  readonly left: OtNode;
  readonly right: OtNode;
}
export type OtNode = OtNum | OtGroup | OtBin;

export const WRONG_CODES = {
  parenIgnored: 'MC-ORDER-PAREN-IGNORED',
  leftToRight: 'MC-ORDER-LEFT-TO-RIGHT',
  mulBeforeDiv: 'MC-ORDER-MUL-BEFORE-DIV',
} as const;

const SYMBOL: Record<BinaryOperator, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

export function symbolOf(op: BinaryOperator): string {
  return SYMBOL[op];
}

function configError(expr: string): Error {
  return new Error(S.configError(expr));
}

function numNode(value: Rational, from: number | null): OtNum {
  return { k: 'num', value, text: value.toString().replace('-', '−'), from };
}

function apply(op: BinaryOperator, left: Rational, right: Rational): Rational {
  switch (op) {
    case 'add':
      return left.add(right);
    case 'sub':
      return left.sub(right);
    case 'mul':
      return left.mul(right);
    case 'div':
      return left.div(right);
  }
}

/** 안이 수 하나가 된 괄호를 벗긴다. */
function normalize(node: OtNode): OtNode {
  switch (node.k) {
    case 'num':
      return node;
    case 'group': {
      const inner = normalize(node.expr);
      return inner.k === 'bin' ? { k: 'group', expr: inner } : inner;
    }
    case 'bin':
      return { ...node, left: normalize(node.left), right: normalize(node.right) };
  }
}

function fromAst(ast: Ast, counter: { next: number }, source: string): OtNode {
  switch (ast.kind) {
    case 'number':
      if (ast.form !== 'integer') throw configError(source);
      return numNode(ast.value, null);
    case 'group':
      return { k: 'group', expr: fromAst(ast.expr, counter, source) };
    case 'binary': {
      const left = fromAst(ast.left, counter, source);
      const idx = counter.next;
      counter.next += 1;
      const right = fromAst(ast.right, counter, source);
      return { k: 'bin', op: ast.op, idx, left, right };
    }
    case 'box':
    case 'ratio':
      throw configError(source);
  }
}

/** 값이 자연수로 떨어지는지(0으로 나누기·음수·분수 포함) 모든 연산을 미리 확인한다. */
function validate(node: OtNode, source: string): Rational {
  switch (node.k) {
    case 'num':
      return node.value;
    case 'group':
      return validate(node.expr, source);
    case 'bin': {
      const left = validate(node.left, source);
      const right = validate(node.right, source);
      if (node.op === 'div' && right.isZero()) throw configError(source);
      const value = apply(node.op, left, right);
      if (value.isNegative() || !value.isInteger()) throw configError(source);
      return value;
    }
  }
}

function countOps(node: OtNode): number {
  switch (node.k) {
    case 'num':
      return 0;
    case 'group':
      return countOps(node.expr);
    case 'bin':
      return 1 + countOps(node.left) + countOps(node.right);
  }
}

/** 처음 식의 트리. 설정 오류면 Error를 던진다. */
export function buildTree(expr: string): OtNode {
  let ast: Ast;
  try {
    ast = parse(expr);
  } catch {
    throw configError(expr);
  }
  const tree = normalize(fromAst(ast, { next: 0 }, expr));
  if (countOps(tree) === 0) throw configError(expr);
  validate(tree, expr);
  return tree;
}

/** 번호가 `idx`인 이항 노드. 이미 계산됐으면 undefined. */
export function findBin(node: OtNode, idx: number): OtBin | undefined {
  switch (node.k) {
    case 'num':
      return undefined;
    case 'group':
      return findBin(node.expr, idx);
    case 'bin':
      if (node.idx === idx) return node;
      return findBin(node.left, idx) ?? findBin(node.right, idx);
  }
}

function replaceBin(node: OtNode, idx: number, replacement: OtNode): OtNode {
  switch (node.k) {
    case 'num':
      return node;
    case 'group':
      return { k: 'group', expr: replaceBin(node.expr, idx, replacement) };
    case 'bin':
      if (node.idx === idx) return replacement;
      return {
        ...node,
        left: replaceBin(node.left, idx, replacement),
        right: replaceBin(node.right, idx, replacement),
      };
  }
}

/** 처음 식에 계산 기록을 차례로 적용한 현재 트리. */
export function treeAfter(
  expr: string,
  reductions: readonly Pick<OrderTreeReduction, 'opIndex' | 'result'>[],
): OtNode {
  let tree = buildTree(expr);
  for (const reduction of reductions) {
    tree = normalize(
      replaceBin(
        tree,
        reduction.opIndex,
        numNode(Rational.parse(reduction.result), reduction.opIndex),
      ),
    );
  }
  return tree;
}

export function currentTree(state: OrderTreeState): OtNode {
  return treeAfter(state.settings.expr, state.reductions);
}

export function isNum(node: OtNode): node is OtNum {
  return node.k === 'num';
}

/** 두 자식이 모두 수라서 지금 누를 수 있는 연산인가. */
export function isTappable(node: OtBin): boolean {
  return node.left.k === 'num' && node.right.k === 'num';
}

/** 노드 안의 연산 번호들(왼쪽부터). */
function opIndexesIn(node: OtNode): number[] {
  switch (node.k) {
    case 'num':
      return [];
    case 'group':
      return opIndexesIn(node.expr);
    case 'bin':
      return [...opIndexesIn(node.left), node.idx, ...opIndexesIn(node.right)];
  }
}

/** 남은 연산 번호(왼쪽부터). */
export function remainingOps(tree: OtNode): number[] {
  return opIndexesIn(tree);
}

function allBins(node: OtNode, out: OtBin[] = []): OtBin[] {
  switch (node.k) {
    case 'num':
      return out;
    case 'group':
      return allBins(node.expr, out);
    case 'bin':
      allBins(node.left, out);
      out.push(node);
      allBins(node.right, out);
      return out;
  }
}

function unresolvedGroups(node: OtNode, out: OtGroup[] = []): OtGroup[] {
  switch (node.k) {
    case 'num':
      return out;
    case 'group':
      out.push(node);
      unresolvedGroups(node.expr, out);
      return out;
    case 'bin':
      unresolvedGroups(node.left, out);
      unresolvedGroups(node.right, out);
      return out;
  }
}

/** 괄호를 건너지 않고 이어진 × ÷ 덩어리(맨 위 노드에서 아래로). */
function mulDivChain(node: OtNode, out: OtBin[] = []): OtBin[] {
  if (node.k === 'bin' && (node.op === 'mul' || node.op === 'div')) {
    mulDivChain(node.left, out);
    out.push(node);
    mulDivChain(node.right, out);
  }
  return out;
}

/** 부모를 따라 올라가며 같은 × ÷ 덩어리의 맨 위 노드를 찾는다. */
function mulDivTop(root: OtNode, target: OtBin): OtBin {
  let top: OtBin = target;
  for (;;) {
    const parent = parentOf(root, top);
    if (parent === undefined || (parent.op !== 'mul' && parent.op !== 'div')) return top;
    top = parent;
  }
}

function parentOf(node: OtNode, child: OtBin): OtBin | undefined {
  switch (node.k) {
    case 'num':
      return undefined;
    case 'group':
      return parentOf(node.expr, child);
    case 'bin':
      if (node.left === child || node.right === child) return node;
      return parentOf(node.left, child) ?? parentOf(node.right, child);
  }
}

/** 틀린 누름의 오개념 코드(위에서부터 처음 맞는 것 하나). 없으면 null. */
export function wrongCode(tree: OtNode, tapped: OtBin): string | null {
  const outside = unresolvedGroups(tree).some((group) => !opIndexesIn(group).includes(tapped.idx));
  if (outside) return WRONG_CODES.parenIgnored;

  const all = allBins(tree);
  if (
    (tapped.op === 'add' || tapped.op === 'sub') &&
    all.some((node) => node.op === 'mul' || node.op === 'div')
  ) {
    return WRONG_CODES.leftToRight;
  }

  if (tapped.op === 'mul') {
    const chain = mulDivChain(mulDivTop(tree, tapped));
    if (chain.some((node) => node.op === 'div' && node.idx < tapped.idx)) {
      return WRONG_CODES.mulBeforeDiv;
    }
  }
  return null;
}

export function valueOfNode(node: OtNode): Rational {
  switch (node.k) {
    case 'num':
      return node.value;
    case 'group':
      return valueOfNode(node.expr);
    case 'bin':
      return apply(node.op, valueOfNode(node.left), valueOfNode(node.right));
  }
}

/** 약속대로 끝까지 계산한 값(두 줄 비교 오버레이용). */
export function promisedValue(tree: OtNode): Rational {
  return valueOfNode(tree);
}

interface Chain {
  readonly operands: OtNode[];
  readonly ops: OtBin[];
}

function flatten(node: OtNode, chain: Chain): void {
  if (node.k === 'bin') {
    flatten(node.left, chain);
    chain.ops.push(node);
    flatten(node.right, chain);
  } else {
    chain.operands.push(node);
  }
}

function flatValue(node: OtNode, tapped: number): Rational | null {
  if (node.k === 'num') return node.value;
  if (node.k === 'group') return flatValue(node.expr, tapped);

  const chain: Chain = { operands: [], ops: [] };
  flatten(node, chain);
  const values: Rational[] = [];
  for (const operand of chain.operands) {
    const value = flatValue(operand, tapped);
    if (value === null) return null;
    values.push(value);
  }
  const ops = chain.ops.map((op) => ({ idx: op.idx, op: op.op }));

  const first = ops.findIndex((op) => op.idx === tapped);
  if (first >= 0) {
    const entry = ops[first];
    const left = values[first];
    const right = values[first + 1];
    if (entry === undefined || left === undefined || right === undefined) return null;
    if (entry.op === 'div' && right.isZero()) return null;
    values.splice(first, 2, apply(entry.op, left, right));
    ops.splice(first, 1);
  }

  let result = values[0];
  if (result === undefined) return null;
  for (let index = 0; index < ops.length; index += 1) {
    const entry = ops[index];
    const right = values[index + 1];
    if (entry === undefined || right === undefined) return null;
    if (entry.op === 'div' && right.isZero()) return null;
    result = apply(entry.op, result, right);
  }
  return result;
}

/** 누른 연산을 먼저 계산하고 나머지는 왼쪽부터 계산한 끝값. 계산할 수 없으면 null. */
export function pressedValue(tree: OtNode, opIndex: number): Rational | null {
  return flatValue(tree, opIndex);
}

// ───────────────────────── 식 줄·트리 그림의 공용 배치 ─────────────────────────

export type OtToken =
  | { readonly kind: 'num'; readonly text: string; readonly from: number | null }
  | { readonly kind: 'op'; readonly op: BinaryOperator; readonly idx: number }
  | { readonly kind: 'lparen' }
  | { readonly kind: 'rparen' };

export interface TokenizedTree {
  readonly tokens: readonly OtToken[];
  /** 연산 번호 → 그 연산이 묶는 토큰 범위 [시작, 끝). 감싼 괄호가 있으면 포함한다. */
  readonly spans: ReadonlyMap<number, readonly [number, number]>;
  /** 아직 풀리지 않은 괄호 덩어리의 토큰 범위 [시작, 끝). */
  readonly groups: readonly (readonly [number, number])[];
}

export function tokenize(tree: OtNode): TokenizedTree {
  const tokens: OtToken[] = [];
  const spans = new Map<number, readonly [number, number]>();
  const groups: (readonly [number, number])[] = [];

  const walk = (node: OtNode): void => {
    switch (node.k) {
      case 'num':
        tokens.push({ kind: 'num', text: node.text, from: node.from });
        return;
      case 'group': {
        const start = tokens.length;
        tokens.push({ kind: 'lparen' });
        walk(node.expr);
        tokens.push({ kind: 'rparen' });
        groups.push([start, tokens.length]);
        if (node.expr.k === 'bin') spans.set(node.expr.idx, [start, tokens.length]);
        return;
      }
      case 'bin': {
        const start = tokens.length;
        walk(node.left);
        tokens.push({ kind: 'op', op: node.op, idx: node.idx });
        walk(node.right);
        if (!spans.has(node.idx)) spans.set(node.idx, [start, tokens.length]);
        return;
      }
    }
  };
  walk(tree);
  return { tokens, spans, groups };
}

export const LAYOUT = {
  pad: 20,
  gap: 6,
  opWidth: 64,
  parenWidth: 20,
  digitWidth: 22,
  numPad: 10,
  numMin: 32,
} as const;

export interface Slot {
  readonly x: number;
  readonly w: number;
}

export function slotWidth(token: OtToken): number {
  switch (token.kind) {
    case 'op':
      return LAYOUT.opWidth;
    case 'lparen':
    case 'rparen':
      return LAYOUT.parenWidth;
    case 'num':
      return Math.max(LAYOUT.numMin, token.text.length * LAYOUT.digitWidth + LAYOUT.numPad);
  }
}

/** 토큰을 왼쪽에서부터 가로로 놓는다. */
export function layoutTokens(tokens: readonly OtToken[]): { slots: Slot[]; width: number } {
  const slots: Slot[] = [];
  let x: number = LAYOUT.pad;
  for (const token of tokens) {
    const w = slotWidth(token);
    slots.push({ x, w });
    x += w + LAYOUT.gap;
  }
  return { slots, width: x - LAYOUT.gap + LAYOUT.pad };
}

/** 식 줄 SVG의 논리 크기. 식 줄과 오버레이가 같은 값을 쓴다. */
export const EXPR_HEIGHT = 88;
export const EXPR_MIN_WIDTH = 360;

export function exprCanvasSize(state: OrderTreeState): { width: number; height: number } {
  const layout = layoutTokens(tokenize(currentTree(state)).tokens);
  return { width: Math.max(EXPR_MIN_WIDTH, layout.width), height: EXPR_HEIGHT };
}

/** 줄 k의 토큰(처음 식 = 0, 계산할 때마다 한 줄씩 늘어난다). */
export function rowsOf(state: OrderTreeState): TokenizedTree[] {
  const rows: TokenizedTree[] = [];
  for (let count = 0; count <= state.reductions.length; count += 1) {
    rows.push(tokenize(treeAfter(state.settings.expr, state.reductions.slice(0, count))));
  }
  return rows;
}

// ───────────────────────── 상태·Action ─────────────────────────

export function createOrderTreeState(config: OrderTreeConfig): OrderTreeState {
  const expr = config.expr ?? S.orderTree.defaultExpr;
  buildTree(expr);
  return {
    mode: 'order-tree',
    settings: { expr, showTree: config.showTree ?? true },
    reductions: [],
    wrongTaps: [],
    shake: null,
  };
}

function tap(state: OrderTreeState, opIndex: number): OrderTreeState {
  const tree = currentTree(state);
  const node = findBin(tree, opIndex);
  if (node === undefined) return state;

  if (isTappable(node)) {
    const left = valueOfNode(node.left);
    const right = valueOfNode(node.right);
    const result = apply(node.op, left, right);
    const reduction: OrderTreeReduction = {
      opIndex,
      op: symbolOf(node.op),
      left: left.toString(),
      right: right.toString(),
      result: result.toString(),
    };
    return { ...state, reductions: [...state.reductions, reduction], shake: null };
  }

  const wrongTaps = [...state.wrongTaps, { opIndex, code: wrongCode(tree, node) }];
  return { ...state, wrongTaps, shake: { opIndex, seq: wrongTaps.length } };
}

function isOrderTreeAction(action: StepSolverAction): action is OrderTreeAction {
  return action.type === 'tap' || action.type === 'undo' || action.type === 'reset';
}

export function reduceOrderTree(state: OrderTreeState, action: StepSolverAction): OrderTreeState {
  if (!isOrderTreeAction(action)) return state;
  switch (action.type) {
    case 'tap':
      return tap(state, action.opIndex);
    case 'undo':
      if (state.reductions.length === 0 && state.shake === null) return state;
      return { ...state, reductions: state.reductions.slice(0, -1), shake: null };
    case 'reset':
      if (state.reductions.length === 0 && state.shake === null) return state;
      return { ...state, reductions: [], shake: null };
  }
}

// ───────────────────────── Observation·이벤트 ─────────────────────────

export function isDone(state: OrderTreeState): boolean {
  return currentTree(state).k === 'num';
}

export function observeOrderTree(state: OrderTreeState): Observation {
  const tree = currentTree(state);
  const done = tree.k === 'num';
  const codes = [
    ...new Set(
      state.wrongTaps.map((entry) => entry.code).filter((code): code is string => code !== null),
    ),
  ];
  const current = tokenize(tree)
    .tokens.map((token) => {
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
    })
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');

  const record: Record<string, JsonValue> = {
    mode: 'order-tree',
    expr: state.settings.expr,
    current,
    reductionOrder: state.reductions.map((entry) => entry.opIndex),
    reductions: state.reductions.map((entry) => ({
      opIndex: entry.opIndex,
      op: entry.op,
      left: entry.left,
      right: entry.right,
      result: entry.result,
    })),
    done,
    finalValue: done && tree.k === 'num' ? tree.value.toString() : null,
    wrongTapCount: state.wrongTaps.length,
    wrongTaps: state.wrongTaps.map((entry) => ({ opIndex: entry.opIndex, code: entry.code })),
    misconceptions: codes,
  };
  return record;
}

export function emitOrderTree(
  prev: OrderTreeState,
  next: OrderTreeState,
  action: StepSolverAction,
): EngineEvent[] {
  void action;
  const events: EngineEvent[] = [];
  const reduced = next.reductions.at(-1);
  if (next.reductions.length > prev.reductions.length && reduced !== undefined) {
    events.push({
      name: 'reduced',
      payload: { opIndex: reduced.opIndex, result: reduced.result },
    });
  }
  const wrong = next.wrongTaps.at(-1);
  if (next.wrongTaps.length > prev.wrongTaps.length && wrong !== undefined) {
    events.push({ name: 'wrong-tap', payload: { opIndex: wrong.opIndex, code: wrong.code } });
  }
  return events;
}

export function isOrderTreeState(state: AnyStepSolverState): state is OrderTreeState {
  return state.mode === 'order-tree';
}
