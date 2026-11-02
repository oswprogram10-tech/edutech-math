import type { Ast, BinaryOperator } from './ast';
import { containsBox } from './ast';
import { MathError } from './errors';
import { Rational } from './rational';

const ZERO = Rational.of(0n);
const ONE = Rational.of(1n);

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

/** 차수 2까지의 다항식. 계수는 모두 정확한 유리수다. */
interface Poly {
  readonly c0: Rational;
  readonly c1: Rational;
  readonly c2: Rational;
}

const ONE_POLY: Poly = { c0: ONE, c1: ZERO, c2: ZERO };
const X_POLY: Poly = { c0: ZERO, c1: ONE, c2: ZERO };

function polyConst(value: Rational): Poly {
  return { c0: value, c1: ZERO, c2: ZERO };
}

function polyAdd(left: Poly, right: Poly): Poly {
  return {
    c0: left.c0.add(right.c0),
    c1: left.c1.add(right.c1),
    c2: left.c2.add(right.c2),
  };
}

function polySub(left: Poly, right: Poly): Poly {
  return {
    c0: left.c0.sub(right.c0),
    c1: left.c1.sub(right.c1),
    c2: left.c2.sub(right.c2),
  };
}

function polyMul(left: Poly, right: Poly): Poly {
  const c0 = left.c0.mul(right.c0);
  const c1 = left.c0.mul(right.c1).add(left.c1.mul(right.c0));
  const c2 = left.c0.mul(right.c2).add(left.c1.mul(right.c1)).add(left.c2.mul(right.c0));
  const c3 = left.c1.mul(right.c2).add(left.c2.mul(right.c1));
  const c4 = left.c2.mul(right.c2);
  if (!c3.isZero() || !c4.isZero()) {
    throw new MathError('NONLINEAR', '□에 대한 일차식이 아닙니다.');
  }
  return { c0, c1, c2 };
}

function polyIsZero(poly: Poly): boolean {
  return poly.c0.isZero() && poly.c1.isZero() && poly.c2.isZero();
}

function polyHasX(poly: Poly): boolean {
  return !poly.c1.isZero() || !poly.c2.isZero();
}

function polyEval(poly: Poly, x: Rational): Rational {
  return poly.c0.add(poly.c1.mul(x)).add(poly.c2.mul(x).mul(x));
}

/** 분자·분모가 각각 차수 2 이하인 유리식. */
interface FractionForm {
  readonly num: Poly;
  readonly den: Poly;
}

function fractionConst(value: Rational): FractionForm {
  return { num: polyConst(value), den: ONE_POLY };
}

function fractionX(): FractionForm {
  return { num: X_POLY, den: ONE_POLY };
}

function fractionAdd(left: FractionForm, right: FractionForm, subtract: boolean): FractionForm {
  const first = polyMul(left.num, right.den);
  const second = polyMul(right.num, left.den);
  return {
    num: subtract ? polySub(first, second) : polyAdd(first, second),
    den: polyMul(left.den, right.den),
  };
}

function fractionMul(left: FractionForm, right: FractionForm): FractionForm {
  return {
    num: polyMul(left.num, right.num),
    den: polyMul(left.den, right.den),
  };
}

function fractionDiv(left: FractionForm, right: FractionForm): FractionForm {
  if (polyIsZero(right.num)) {
    throw new MathError('DIV_BY_ZERO', '0으로 나눌 수 없습니다.');
  }
  return {
    num: polyMul(left.num, right.den),
    den: polyMul(left.den, right.num),
  };
}

function toFractionForm(ast: Ast): FractionForm {
  switch (ast.kind) {
    case 'number':
      return fractionConst(ast.value);
    case 'box':
      return fractionX();
    case 'group':
      return toFractionForm(ast.expr);
    case 'binary': {
      const left = toFractionForm(ast.left);
      const right = toFractionForm(ast.right);
      switch (ast.op) {
        case 'add':
          return fractionAdd(left, right, false);
        case 'sub':
          return fractionAdd(left, right, true);
        case 'mul':
          return fractionMul(left, right);
        case 'div':
          if (containsBox(ast.left) && containsBox(ast.right)) {
            throw new MathError('NONLINEAR', '□가 양쪽에 있는 나눗셈은 일차식이 아닙니다.');
          }
          return fractionDiv(left, right);
      }
      break;
    }
    case 'ratio': {
      if (containsBox(ast.right)) {
        throw new MathError('NONLINEAR', '비의 기준량에 □가 있으면 일차식이 아닙니다.');
      }
      return fractionDiv(toFractionForm(ast.left), toFractionForm(ast.right));
    }
  }
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
 * 나누는 수에만 □가 있는 식도 푼다. □×□나 □가 양쪽에 있는 나눗셈은 NONLINEAR.
 */
export function solveForBox(ast: Ast, rhs: Rational): Rational {
  const form = toFractionForm(ast);
  const equation = polySub(form.num, polyMul(polyConst(rhs), form.den));

  // □×□처럼 이차식이 되는 경우는 상수항·일차항만으로 풀 수 없다.
  if (!equation.c2.isZero()) {
    throw new MathError('NONLINEAR', '□에 대한 일차식이 아닙니다.');
  }

  const boxes = countBoxes(ast);
  if (boxes === 0) throw new MathError('NO_BOX', '식을 풀 □가 없습니다.');
  if (boxes > 1) throw new MathError('MULTIPLE_BOX', '□가 여러 개 있습니다.');

  // 나누는 수에 □가 있는 식의 결과가 0이면 해가 없다.
  if (rhs.isZero() && polyHasX(form.den)) {
    throw new MathError('NO_SOLUTION', '나눗셈의 결과가 0이 되는 해는 없습니다.');
  }

  if (equation.c1.isZero()) {
    if (equation.c0.isZero()) {
      throw new MathError('INFINITE_SOLUTIONS', '□가 어떤 값이어도 참입니다.');
    }
    throw new MathError('NO_SOLUTION', '□가 어떤 값이어도 참이 될 수 없습니다.');
  }

  const solution = equation.c0.neg().div(equation.c1);
  if (polyEval(form.den, solution).isZero()) {
    throw new MathError('NO_SOLUTION', '나누는 수가 0이 되는 해는 없습니다.');
  }
  return solution;
}
