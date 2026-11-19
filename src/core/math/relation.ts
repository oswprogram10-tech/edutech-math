import type { BinaryOperator } from './ast';
import { BINARY_SYMBOL } from './ast';
import { MathError } from './errors';
import { Rational } from './rational';
import { tokenize } from './tokenize';
import type { NumberToken, Token } from './tokenize';

/** ○·□ 두 기호가 들어갈 수 있는 관계식의 항. */
export type RelTerm =
  | { kind: 'number'; value: Rational; text: string }
  | { kind: 'var'; name: 'circle' | 'box' }
  | { kind: 'group'; expr: RelTerm }
  | { kind: 'binary'; op: BinaryOperator; left: RelTerm; right: RelTerm };

export interface Relation {
  left: RelTerm;
  right: RelTerm;
}

export interface RelationInfo {
  usesCircle: boolean;
  usesBox: boolean;
  circleCount: number;
  boxCount: number;
  /** □만 있고 ○가 없다. */
  boxOnly: boolean;
  /** 한 변이 □ 하나이고 다른 변에 □가 없다. */
  solvedForBox: boolean;
}

class RelationParser {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly source: string,
  ) {}

  parse(): Relation {
    if (this.tokens.length === 0) {
      throw new MathError('PARSE', '수식이 비어 있습니다.', { position: 0 });
    }
    const left = this.parseAddSub();
    const eq = this.peek();
    if (eq === undefined) {
      throw this.error('= 가 필요합니다.', this.source.length);
    }
    if (eq.type !== 'equals') {
      throw this.error('= 가 필요합니다.', eq.start);
    }
    this.index += 1;
    const right = this.parseAddSub();
    const rest = this.peek();
    if (rest !== undefined) {
      throw this.error(
        rest.type === 'equals' ? '= 는 하나만 쓸 수 있습니다.' : '수식이 끝나지 않았습니다.',
        rest.start,
      );
    }
    return { left, right };
  }

  private parseAddSub(): RelTerm {
    let left = this.parseMulDiv();
    for (;;) {
      const token = this.peek();
      if (token === undefined || (token.type !== 'add' && token.type !== 'sub')) return left;
      this.index += 1;
      const right = this.parseMulDiv();
      left = { kind: 'binary', op: token.type, left, right };
    }
  }

  private parseMulDiv(): RelTerm {
    let left = this.parsePrimary();
    for (;;) {
      const token = this.peek();
      if (token === undefined || (token.type !== 'mul' && token.type !== 'div')) return left;
      this.index += 1;
      const right = this.parsePrimary();
      left = { kind: 'binary', op: token.type, left, right };
    }
  }

  private parsePrimary(): RelTerm {
    const token = this.peek();
    if (token === undefined) {
      throw this.error('수가 필요합니다.', this.source.length);
    }
    if (token.type === 'number') {
      this.index += 1;
      return this.numberTerm(token);
    }
    if (token.type === 'box') {
      this.index += 1;
      return { kind: 'var', name: 'box' };
    }
    if (token.type === 'circle') {
      this.index += 1;
      return { kind: 'var', name: 'circle' };
    }
    if (token.type === 'lparen') {
      this.index += 1;
      const expr = this.parseAddSub();
      const close = this.peek();
      if (close?.type !== 'rparen') {
        throw this.error('닫는 괄호가 필요합니다.', close?.start ?? this.source.length);
      }
      this.index += 1;
      return { kind: 'group', expr };
    }
    throw this.error('예상하지 못한 기호입니다.', token.start);
  }

  private numberTerm(token: NumberToken): RelTerm {
    if (token.form === 'fraction') {
      if (BigInt(token.den) === 0n) {
        throw new MathError('DIV_BY_ZERO', '분모가 0입니다.', { position: token.start });
      }
      return {
        kind: 'number',
        value: Rational.of(BigInt(token.num), BigInt(token.den)),
        text: token.text,
      };
    }
    if (token.form === 'decimal') {
      return { kind: 'number', value: Rational.parse(token.text), text: token.text };
    }
    return { kind: 'number', value: Rational.of(BigInt(token.text)), text: token.text };
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private error(message: string, position: number): MathError {
    return new MathError('PARSE', message, { position });
  }
}

/** 관계식 `좌변 = 우변`을 읽는다. 실패하면 MathError('PARSE', …, {position}). */
export function parseRelation(source: string): Relation {
  return new RelationParser(tokenize(source), source).parse();
}

export interface RelEnv {
  circle: Rational;
  box: Rational;
}

/** 항을 계산한다. 0으로 나누면 DIV_BY_ZERO. */
export function evaluateTerm(term: RelTerm, env: RelEnv): Rational {
  switch (term.kind) {
    case 'number':
      return term.value;
    case 'var':
      return term.name === 'circle' ? env.circle : env.box;
    case 'group':
      return evaluateTerm(term.expr, env);
    case 'binary': {
      const l = evaluateTerm(term.left, env);
      const r = evaluateTerm(term.right, env);
      switch (term.op) {
        case 'add':
          return l.add(r);
        case 'sub':
          return l.sub(r);
        case 'mul':
          return l.mul(r);
        case 'div':
          if (r.isZero()) throw new MathError('DIV_BY_ZERO');
          return l.div(r);
      }
    }
  }
}

/** 주어진 ○, □ 값에서 관계식이 성립하는지. 0으로 나누기는 false. */
export function relationHolds(rel: Relation, circle: Rational, box: Rational): boolean {
  try {
    const env = { circle, box };
    return evaluateTerm(rel.left, env).equals(evaluateTerm(rel.right, env));
  } catch (error) {
    if (error instanceof MathError && error.code === 'DIV_BY_ZERO') return false;
    throw error;
  }
}

/** 쌍은 [○, □]. 각 쌍의 성립 여부. */
export function checkPairs(
  rel: Relation,
  pairs: readonly (readonly [Rational, Rational])[],
): boolean[] {
  return pairs.map(([circle, box]) => relationHolds(rel, circle, box));
}

/** 각 쌍의 ○와 □를 바꿔 넣었을 때 모두 성립하는지. */
export function swappedHolds(
  rel: Relation,
  pairs: readonly (readonly [Rational, Rational])[],
): boolean {
  return pairs.every(([circle, box]) => relationHolds(rel, box, circle));
}

function countVars(term: RelTerm, name: 'circle' | 'box'): number {
  switch (term.kind) {
    case 'number':
      return 0;
    case 'var':
      return term.name === name ? 1 : 0;
    case 'group':
      return countVars(term.expr, name);
    case 'binary':
      return countVars(term.left, name) + countVars(term.right, name);
  }
}

function isBareBox(term: RelTerm): boolean {
  if (term.kind === 'group') return isBareBox(term.expr);
  return term.kind === 'var' && term.name === 'box';
}

export function relationInfo(rel: Relation): RelationInfo {
  const circleCount = countVars(rel.left, 'circle') + countVars(rel.right, 'circle');
  const boxCount = countVars(rel.left, 'box') + countVars(rel.right, 'box');
  const solvedForBox =
    (isBareBox(rel.left) && countVars(rel.right, 'box') === 0) ||
    (isBareBox(rel.right) && countVars(rel.left, 'box') === 0);
  return {
    usesCircle: circleCount > 0,
    usesBox: boxCount > 0,
    circleCount,
    boxCount,
    boxOnly: boxCount > 0 && circleCount === 0,
    solvedForBox,
  };
}

/** □에 대한 일차식 a·□ + b. ○는 값으로 대입한다. */
interface Linear {
  a: Rational;
  b: Rational;
}

function linearOf(term: RelTerm, circle: Rational): Linear {
  switch (term.kind) {
    case 'number':
      return { a: Rational.of(0), b: term.value };
    case 'var':
      return term.name === 'box'
        ? { a: Rational.of(1), b: Rational.of(0) }
        : { a: Rational.of(0), b: circle };
    case 'group':
      return linearOf(term.expr, circle);
    case 'binary': {
      const l = linearOf(term.left, circle);
      const r = linearOf(term.right, circle);
      switch (term.op) {
        case 'add':
          return { a: l.a.add(r.a), b: l.b.add(r.b) };
        case 'sub':
          return { a: l.a.sub(r.a), b: l.b.sub(r.b) };
        case 'mul':
          if (!l.a.isZero() && !r.a.isZero()) throw new MathError('NONLINEAR');
          return { a: l.a.mul(r.b).add(r.a.mul(l.b)), b: l.b.mul(r.b) };
        case 'div':
          if (!r.a.isZero()) throw new MathError('NONLINEAR');
          if (r.b.isZero()) throw new MathError('DIV_BY_ZERO');
          return { a: l.a.div(r.b), b: l.b.div(r.b) };
      }
    }
  }
}

/**
 * ○ 값을 넣었을 때 관계식을 □에 대해 푼다.
 * 해가 하나로 정해지지 않거나(a = 0) 0으로 나누면 null. □에 일차식이 아니면 NONLINEAR.
 */
export function solveBox(rel: Relation, circle: Rational): Rational | null {
  try {
    const l = linearOf(rel.left, circle);
    const r = linearOf(rel.right, circle);
    const a = l.a.sub(r.a);
    const b = l.b.sub(r.b);
    if (a.isZero()) return null;
    return b.neg().div(a);
  } catch (error) {
    if (error instanceof MathError && error.code === 'DIV_BY_ZERO') return null;
    throw error;
  }
}

/** 영역의 각 ○ 값에서 두 관계식이 같은 □ 값을 정하는지. */
export function sameOnDomain(a: Relation, b: Relation, domain: readonly Rational[]): boolean {
  let same = true;
  for (const circle of domain) {
    const x = solveBox(a, circle);
    const y = solveBox(b, circle);
    if (x === null || y === null || !x.equals(y)) same = false;
  }
  return same;
}

function formatTerm(term: RelTerm): string {
  switch (term.kind) {
    case 'number':
      return term.text;
    case 'var':
      return term.name === 'circle' ? '○' : '□';
    case 'group':
      return `(${formatTerm(term.expr)})`;
    case 'binary':
      return `${formatTerm(term.left)} ${BINARY_SYMBOL[term.op]} ${formatTerm(term.right)}`;
  }
}

/** 사람이 읽는 식. 예: "□ = ○ × 4". */
export function formatRelation(rel: Relation): string {
  return `${formatTerm(rel.left)} = ${formatTerm(rel.right)}`;
}
