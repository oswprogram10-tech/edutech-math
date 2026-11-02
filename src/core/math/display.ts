import type { Ast, OperatorSymbol } from './ast';
import { BINARY_SYMBOL } from './ast';
import type { Rational } from './rational';

export type RationalDisplayForm = 'fraction' | 'mixed' | 'decimal';

export type DisplayNode =
  | { readonly kind: 'int'; readonly text: string }
  | { readonly kind: 'decimal'; readonly text: string }
  | {
      readonly kind: 'fraction';
      readonly whole?: string;
      readonly num: string;
      readonly den: string;
    }
  | { readonly kind: 'op'; readonly symbol: OperatorSymbol }
  | { readonly kind: 'group'; readonly children: readonly DisplayNode[] }
  | { readonly kind: 'box' };

function numberToDisplay(node: Extract<Ast, { kind: 'number' }>): DisplayNode {
  switch (node.form) {
    case 'integer':
      return { kind: 'int', text: node.text };
    case 'decimal':
      return { kind: 'decimal', text: node.text };
    case 'fraction':
    case 'mixed':
      return fractionNode(node.whole, node.num, node.den, node.value);
  }
}

function fractionNode(
  whole: string | undefined,
  num: string | undefined,
  den: string | undefined,
  value: Rational,
): DisplayNode {
  if (num !== undefined && den !== undefined) {
    return whole === undefined
      ? { kind: 'fraction', num, den }
      : { kind: 'fraction', whole, num, den };
  }
  const parts = value.toMixed();
  return {
    kind: 'fraction',
    whole: whole ?? parts.whole.toString(),
    num: num ?? parts.num.toString(),
    den: den ?? parts.den.toString(),
  };
}

/**
 * React 없이 쓸 수 있는 표시용 구조. 이진 연산은 `[왼쪽, op, 오른쪽]` 순서의
 * 노드 배열로 펼쳐지고, 괄호는 `group` 노드로 남는다.
 */
export function toDisplay(ast: Ast): DisplayNode[] {
  switch (ast.kind) {
    case 'number':
      return [numberToDisplay(ast)];
    case 'box':
      return [{ kind: 'box' }];
    case 'group':
      return [{ kind: 'group', children: toDisplay(ast.expr) }];
    case 'binary':
      return [
        ...toDisplay(ast.left),
        { kind: 'op', symbol: BINARY_SYMBOL[ast.op] },
        ...toDisplay(ast.right),
      ];
    case 'ratio':
      return [...toDisplay(ast.left), { kind: 'op', symbol: ':' }, ...toDisplay(ast.right)];
  }
}

/** `Rational`을 표시 노드로 바꾼다. `decimal`은 유한소수가 아니면 NOT_TERMINATING. */
export function rationalToDisplay(value: Rational, form: RationalDisplayForm): DisplayNode {
  if (form === 'decimal') {
    return { kind: 'decimal', text: value.toDecimalString() };
  }
  if (value.isInteger()) {
    return { kind: 'int', text: value.toString() };
  }
  if (form === 'fraction') {
    return { kind: 'fraction', num: value.n.toString(), den: value.d.toString() };
  }
  const parts = value.toMixed();
  if (parts.whole === 0n) {
    return { kind: 'fraction', num: parts.num.toString(), den: parts.den.toString() };
  }
  return {
    kind: 'fraction',
    whole: parts.whole.toString(),
    num: parts.num.toString(),
    den: parts.den.toString(),
  };
}
