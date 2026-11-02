/**
 * E08 줄 토큰 ↔ 식 문자열 변환과 줄 값 판정.
 *
 * 문자열을 손으로 파싱하지 않는다. 토큰에서 만든 식 문자열을 `core/math`의
 * `parse`·`evaluate`에 넘기고, 값은 `Rational`로만 다룬다.
 * 화면에 보이는 표기(약분 전 분수, 대분수)는 토큰에 그대로 남긴다.
 */
import { Rational, evaluate, parse } from '../../core/math';
import type { Ast } from '../../core/math';
import { containsBox } from '../../core/math/ast';
import type { NumberToken, Token, TokenField } from './types';

export interface LineValue {
  /** 화면·Observation에 쓰는 정규화된 식 문자열. 미완성 칸은 `?`로 둔다. */
  readonly expr: string;
  readonly value: Rational | null;
  readonly valid: boolean;
  /** 값이 없을 때 이유. 화면에는 내보내지 않는다. */
  readonly reason: 'empty' | 'incomplete' | 'box' | 'parse' | null;
}

function operatorToken(op: 'add' | 'sub' | 'mul' | 'div'): Token {
  return { kind: 'op', op };
}

/** `core/math` AST를 학생이 쓴 표기를 살린 토큰 배열로 바꾼다. */
export function tokensFromAst(ast: Ast): Token[] {
  switch (ast.kind) {
    case 'number': {
      if (ast.form === 'fraction') {
        return [
          {
            kind: 'fraction',
            num: ast.num ?? '0',
            den: ast.den ?? '1',
          },
        ];
      }
      if (ast.form === 'mixed') {
        return [
          {
            kind: 'mixed',
            whole: ast.whole ?? '1',
            num: ast.num ?? '1',
            den: ast.den ?? '1',
          },
        ];
      }
      if (ast.form === 'decimal') return [{ kind: 'decimal', value: ast.text }];
      return [{ kind: 'integer', value: ast.text }];
    }
    case 'box':
      return [{ kind: 'box' }];
    case 'group':
      return [{ kind: 'lparen' }, ...tokensFromAst(ast.expr), { kind: 'rparen' }];
    case 'binary':
      return [...tokensFromAst(ast.left), operatorToken(ast.op), ...tokensFromAst(ast.right)];
    case 'ratio':
      throw new Error('E08은 비( : ) 표기를 쓰지 않습니다.');
  }
}

/** 콘텐츠가 준 문제 문자열을 토큰으로 바꾼다. 읽을 수 없으면 오류를 던진다. */
export function tokensFromText(text: string): Token[] {
  return tokensFromAst(parse(text));
}

function numberTokenExpr(token: NumberToken): string {
  switch (token.kind) {
    case 'integer':
      return token.value.length > 0 ? token.value : '?';
    case 'decimal':
      return token.value.length > 0 ? token.value : '?';
    case 'fraction':
      return `${token.num.length > 0 ? token.num : '?'}/${token.den.length > 0 ? token.den : '?'}`;
    case 'mixed':
      return `${token.whole.length > 0 ? token.whole : '?'} ${
        token.num.length > 0 ? token.num : '?'
      }/${token.den.length > 0 ? token.den : '?'}`;
  }
}

function tokenExpr(token: Token): string {
  switch (token.kind) {
    case 'integer':
    case 'decimal':
    case 'fraction':
    case 'mixed':
      return numberTokenExpr(token);
    case 'op':
      return token.op === 'add' ? '+' : token.op === 'sub' ? '−' : token.op === 'mul' ? '×' : '÷';
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
    case 'box':
      return '□';
  }
}

/** 토큰 배열을 `core/math` 파서가 읽는 식 문자열로 바꾼다. */
export function exprOfTokens(tokens: readonly Token[]): string {
  return tokens.map(tokenExpr).join(' ');
}

function digitsOnly(value: string): boolean {
  return value.length > 0 && /^\d+$/.test(value);
}

/** 모든 수 칸이 채워졌는가. 괄호·연산의 짝은 파서가 판정한다. */
export function tokensComplete(tokens: readonly Token[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((token) => {
    switch (token.kind) {
      case 'integer':
        return digitsOnly(token.value);
      case 'decimal':
        return /^\d+\.\d+$/.test(token.value);
      case 'fraction':
        return digitsOnly(token.num) && digitsOnly(token.den);
      case 'mixed':
        return digitsOnly(token.whole) && digitsOnly(token.num) && digitsOnly(token.den);
      default:
        return true;
    }
  });
}

/** 한 줄의 값과 판정 가능 여부. □·미완성·읽을 수 없는 식은 값이 없다. */
export function analyzeLine(tokens: readonly Token[]): LineValue {
  const expr = exprOfTokens(tokens);
  if (tokens.length === 0) {
    return { expr, value: null, valid: false, reason: 'empty' };
  }
  if (!tokensComplete(tokens)) {
    return { expr, value: null, valid: false, reason: 'incomplete' };
  }
  let ast: Ast;
  try {
    ast = parse(expr);
  } catch {
    return { expr, value: null, valid: false, reason: 'parse' };
  }
  if (containsBox(ast)) {
    return { expr, value: null, valid: false, reason: 'box' };
  }
  try {
    return { expr, value: evaluate(ast), valid: true, reason: null };
  } catch {
    return { expr, value: null, valid: false, reason: 'parse' };
  }
}

export function equivalentAnalyses(previous: LineValue, current: LineValue): boolean | null {
  if (!previous.valid || !current.valid) return null;
  const left = previous.value;
  const right = current.value;
  if (left === null || right === null) return null;
  return left.equals(right);
}

/** 토큰 안에서 고를 수 있는 칸. */
export function fieldsOf(token: Token): readonly TokenField[] {
  if (token.kind === 'fraction') return ['num', 'den'];
  if (token.kind === 'mixed') return ['whole', 'num', 'den'];
  return ['value'];
}

export function firstField(token: Token | undefined): TokenField {
  return token === undefined ? 'value' : (fieldsOf(token)[0] ?? 'value');
}

export function lastField(token: Token | undefined): TokenField {
  if (token === undefined) return 'value';
  const fields = fieldsOf(token);
  return fields[fields.length - 1] ?? 'value';
}

function gcdBigInt(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

function lastNumberToken(tokens: readonly Token[]): NumberToken | null {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (
      token !== undefined &&
      (token.kind === 'integer' ||
        token.kind === 'decimal' ||
        token.kind === 'fraction' ||
        token.kind === 'mixed')
    ) {
      return token;
    }
  }
  return null;
}

/** 학생이 쓴 마지막 수 표기가 기약인가. 분수가 아니면 참으로 본다. */
export function notationIsIrreducible(tokens: readonly Token[]): boolean {
  const token = lastNumberToken(tokens);
  if (token === null) return true;
  if (token.kind === 'fraction') {
    const num = BigInt(token.num);
    const den = BigInt(token.den);
    return num === 0n || gcdBigInt(num, den) === 1n;
  }
  if (token.kind === 'mixed') {
    return gcdBigInt(BigInt(token.num), BigInt(token.den)) === 1n;
  }
  return true;
}

/** 마지막 수를 대분수로 썼는가. */
export function notationIsMixed(tokens: readonly Token[]): boolean {
  return lastNumberToken(tokens)?.kind === 'mixed';
}

/** 학생이 쓴 마지막 수 표기(값이 아니라 표기 그대로). */
export function finalNotation(tokens: readonly Token[]): string | null {
  const token = lastNumberToken(tokens);
  return token === null ? null : numberTokenExpr(token);
}
