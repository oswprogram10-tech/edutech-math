import type { Ast, BinaryNode, BinaryOperator, NumberNode, OperatorSymbol, RatioNode } from './ast';
import { BINARY_SYMBOL, containsBox, containsNumberForm } from './ast';
import { evaluate } from './evaluate';
import { Rational } from './rational';
import { renderAst } from './render';

const ONE = Rational.of(1n);

export interface OperationStep {
  /** `root`, `root.left`, `root.right.expr`처럼 AST 안 위치를 가리키는 문자열. */
  readonly nodePath: string;
  readonly op: OperatorSymbol;
  readonly left: Rational;
  readonly right: Rational;
  readonly result: Rational;
  readonly before: string;
  readonly after: string;
}

type PathKey = 'left' | 'right' | 'expr';

interface Target {
  readonly keys: readonly PathKey[];
  readonly node: BinaryNode;
}

type Precedence = 'muldiv' | 'addsub';

function matchesPrecedence(op: BinaryOperator, precedence: Precedence): boolean {
  return precedence === 'muldiv' ? op === 'mul' || op === 'div' : op === 'add' || op === 'sub';
}

function pathString(keys: readonly PathKey[]): string {
  return keys.length === 0 ? 'root' : `root.${keys.join('.')}`;
}

/** 괄호 안에서 아직 계산할 연산을 먼저 찾는다(가장 왼쪽 그룹부터). */
function findInAnyGroup(node: Ast, keys: PathKey[]): Target | undefined {
  switch (node.kind) {
    case 'group':
      return findWithinGroup(node.expr, [...keys, 'expr']);
    case 'binary':
      return (
        findInAnyGroup(node.left, [...keys, 'left']) ??
        findInAnyGroup(node.right, [...keys, 'right'])
      );
    case 'ratio':
      return (
        findInAnyGroup(node.left, [...keys, 'left']) ??
        findInAnyGroup(node.right, [...keys, 'right'])
      );
    default:
      return undefined;
  }
}

function findWithinGroup(node: Ast, keys: PathKey[]): Target | undefined {
  const nestedGroup = findInAnyGroup(node, keys);
  if (nestedGroup !== undefined) return nestedGroup;
  return findFirstByPrecedence(node, keys, 'muldiv') ?? findFirstByPrecedence(node, keys, 'addsub');
}

/** 같은 층위에서 왼쪽부터 ×÷를 먼저, 그다음 +−를 찾는다. 그룹은 경계로 본다. */
function findFirstByPrecedence(
  node: Ast,
  keys: PathKey[],
  precedence: Precedence,
): Target | undefined {
  if (node.kind === 'group') return undefined;

  if (node.kind === 'binary' || node.kind === 'ratio') {
    const left = findFirstByPrecedence(node.left, [...keys, 'left'], precedence);
    if (left !== undefined) return left;
    const right = findFirstByPrecedence(node.right, [...keys, 'right'], precedence);
    if (right !== undefined) return right;
  }

  if (node.kind === 'binary' && matchesPrecedence(node.op, precedence) && !containsBox(node)) {
    return { keys, node };
  }
  return undefined;
}

function findNextTarget(ast: Ast): Target | undefined {
  const inGroup = findInAnyGroup(ast, []);
  if (inGroup !== undefined) return inGroup;
  return findFirstByPrecedence(ast, [], 'muldiv') ?? findFirstByPrecedence(ast, [], 'addsub');
}

function replaceAt(node: Ast, keys: readonly PathKey[], replacement: Ast): Ast {
  const key = keys[0];
  if (key === undefined) return replacement;
  const rest = keys.slice(1);

  if (node.kind === 'group') {
    return { kind: 'group', expr: replaceAt(node.expr, rest, replacement) };
  }
  if (node.kind === 'binary') {
    return {
      kind: 'binary',
      op: node.op,
      left: key === 'left' ? replaceAt(node.left, rest, replacement) : node.left,
      right: key === 'right' ? replaceAt(node.right, rest, replacement) : node.right,
    };
  }
  // 경로는 group/binary/ratio의 자식만 가리키므로 남은 경우는 ratio다.
  const ratio = node as RatioNode;
  return {
    kind: 'ratio',
    left: key === 'left' ? replaceAt(ratio.left, rest, replacement) : ratio.left,
    right: key === 'right' ? replaceAt(ratio.right, rest, replacement) : ratio.right,
  };
}

function withUnicodeMinus(text: string): string {
  return text.startsWith('-') ? `−${text.slice(1)}` : text;
}

function resultNode(value: Rational, left: Ast, right: Ast): NumberNode {
  const hasDecimal = containsNumberForm(left, 'decimal') || containsNumberForm(right, 'decimal');
  if (hasDecimal && value.isTerminatingDecimal()) {
    return {
      kind: 'number',
      form: 'decimal',
      value,
      text: withUnicodeMinus(value.toDecimalString()),
    };
  }

  const hasMixed = containsNumberForm(left, 'mixed') || containsNumberForm(right, 'mixed');
  if (hasMixed && value.compareTo(ONE) > 0 && !value.isInteger()) {
    const parts = value.toMixed();
    return {
      kind: 'number',
      form: 'mixed',
      value,
      text: `${parts.whole.toString()} ${parts.num.toString()}/${parts.den.toString()}`,
      whole: parts.whole.toString(),
      num: parts.num.toString(),
      den: parts.den.toString(),
    };
  }

  if (value.isInteger()) {
    return {
      kind: 'number',
      form: 'integer',
      value,
      text: withUnicodeMinus(value.toString()),
    };
  }
  return {
    kind: 'number',
    form: 'fraction',
    value,
    text: withUnicodeMinus(value.toString()),
    num: value.n.toString(),
    den: value.d.toString(),
  };
}

function operatorSymbol(node: BinaryNode): OperatorSymbol {
  return BINARY_SYMBOL[node.op];
}

/**
 * 혼합 계산을 괄호 → ×÷(왼쪽부터) → +−(왼쪽부터) 순서로 한 단계씩 계산한 목록.
 * 분수·대분수 리터럴은 단계가 아니다. 비(`:`)는 계산 단계로 세지 않는다.
 */
export function operationOrder(ast: Ast): OperationStep[] {
  const steps: OperationStep[] = [];
  let current = ast;

  for (;;) {
    const target = findNextTarget(current);
    if (target === undefined) return steps;

    const left = evaluate(target.node.left);
    const right = evaluate(target.node.right);
    const result = evaluate(target.node);

    const before = renderAst(current);
    current = replaceAt(
      current,
      target.keys,
      resultNode(result, target.node.left, target.node.right),
    );
    steps.push({
      nodePath: pathString(target.keys),
      op: operatorSymbol(target.node),
      left,
      right,
      result,
      before,
      after: renderAst(current),
    });
  }
}
