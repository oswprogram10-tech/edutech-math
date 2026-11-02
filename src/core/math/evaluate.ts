import type { Ast, BinaryOperator } from './ast';
import { MathError } from './errors';
import { Rational } from './rational';

const ZERO = Rational.of(0n);
const ONE = Rational.of(1n);

/** □가 들어 있는 식을 `a·□ + b` 꼴로 본 결과. */
interface LinearForm {
  readonly a: Rational;
  readonly b: Rational;
}

function applyOperator(op: BinaryOperator, left: Rational, right: Rational): Rational {
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

/** 수식을 정확한 유리수 값으로 계산한다. □가 있으면 NO_BOX. */
export function evaluate(ast: Ast): Rational {
  switch (ast.kind) {
    case 'number':
      return ast.value;
    case 'box':
      throw new MathError(
        'NO_BOX',
        '□가 들어 있는 식은 값으로 계산할 수 없습니다. solveForBox를 쓰세요.',
      );
    case 'group':
      return evaluate(ast.expr);
    case 'binary':
      return applyOperator(ast.op, evaluate(ast.left), evaluate(ast.right));
    case 'ratio':
      return evaluate(ast.left).div(evaluate(ast.right));
  }
}

function toLinear(ast: Ast): LinearForm {
  switch (ast.kind) {
    case 'number':
      return { a: ZERO, b: ast.value };
    case 'box':
      return { a: ONE, b: ZERO };
    case 'group':
      return toLinear(ast.expr);
    case 'binary':
      return applyLinearOperator(ast.op, toLinear(ast.left), toLinear(ast.right));
    case 'ratio': {
      const left = toLinear(ast.left);
      const right = toLinear(ast.right);
      return divideLinear(left, right);
    }
  }
}

function applyLinearOperator(op: BinaryOperator, left: LinearForm, right: LinearForm): LinearForm {
  switch (op) {
    case 'add':
      return { a: left.a.add(right.a), b: left.b.add(right.b) };
    case 'sub':
      return { a: left.a.sub(right.a), b: left.b.sub(right.b) };
    case 'mul':
      return multiplyLinear(left, right);
    case 'div':
      return divideLinear(left, right);
  }
}

function multiplyLinear(left: LinearForm, right: LinearForm): LinearForm {
  if (!left.a.isZero() && !right.a.isZero()) {
    throw new MathError('NONLINEAR', '□끼리 곱하면 일차식이 아닙니다.');
  }
  return {
    a: left.a.mul(right.b).add(right.a.mul(left.b)),
    b: left.b.mul(right.b),
  };
}

function divideLinear(left: LinearForm, right: LinearForm): LinearForm {
  if (!right.a.isZero()) {
    throw new MathError('NONLINEAR', '□가 있는 식으로 나눌 수 없습니다.');
  }
  if (right.b.isZero()) {
    throw new MathError('DIV_BY_ZERO', '0으로 나눌 수 없습니다.');
  }
  return { a: left.a.div(right.b), b: left.b.div(right.b) };
}

function countBoxes(ast: Ast): number {
  switch (ast.kind) {
    case 'number':
      return 0;
    case 'box':
      return 1;
    case 'group':
      return countBoxes(ast.expr);
    case 'binary':
      return countBoxes(ast.left) + countBoxes(ast.right);
    case 'ratio':
      return countBoxes(ast.left) + countBoxes(ast.right);
  }
}

/**
 * □가 정확히 하나 들어 있는 일차식 `ast = rhs`를 푼다.
 * □×□나 □가 있는 식으로 나누는 식은 NONLINEAR.
 */
export function solveForBox(ast: Ast, rhs: Rational): Rational {
  // 곱셈·나눗셈의 비선형성을 먼저 판정한다(□×□는 MULTIPLE_BOX가 아니라 NONLINEAR).
  const linear = toLinear(ast);
  const boxes = countBoxes(ast);
  if (boxes === 0) throw new MathError('NO_BOX', '식을 풀 □가 없습니다.');
  if (boxes > 1) throw new MathError('MULTIPLE_BOX', '□가 여러 개 있습니다.');

  const target = rhs.sub(linear.b);
  if (linear.a.isZero()) {
    if (target.isZero()) {
      throw new MathError('INFINITE_SOLUTIONS', '□가 어떤 값이어도 참입니다.');
    }
    throw new MathError('NO_SOLUTION', '□가 어떤 값이어도 참이 될 수 없습니다.');
  }
  return target.div(linear.a);
}
