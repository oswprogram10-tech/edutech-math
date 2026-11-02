import { MathError } from './errors';

export type NumberTokenForm = 'integer' | 'decimal' | 'fraction';

interface NumberTokenBase {
  readonly type: 'number';
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface IntegerToken extends NumberTokenBase {
  readonly form: 'integer';
}

export interface DecimalToken extends NumberTokenBase {
  readonly form: 'decimal';
}

export interface FractionToken extends NumberTokenBase {
  readonly form: 'fraction';
  readonly num: string;
  readonly den: string;
}

export type NumberToken = IntegerToken | DecimalToken | FractionToken;

export type OperatorTokenType = 'add' | 'sub' | 'mul' | 'div' | 'ratio';

export interface OperatorToken {
  readonly type: OperatorTokenType;
  readonly start: number;
  readonly end: number;
}

export interface ParenToken {
  readonly type: 'lparen' | 'rparen';
  readonly start: number;
  readonly end: number;
}

export interface BoxToken {
  readonly type: 'box';
  readonly start: number;
  readonly end: number;
}

export type Token = NumberToken | OperatorToken | ParenToken | BoxToken;

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isSpace(char: string): boolean {
  return /\s/.test(char);
}

/**
 * 유니코드 `+ − × ÷`와 ASCII `+ - * /`를 모두 받는다.
 * `/`는 양쪽이 공백 없이 붙은 자연수일 때만 분수 리터럴 토큰이 된다.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source.charAt(index);

    if (isSpace(char)) {
      index += 1;
      continue;
    }

    if (isDigit(char)) {
      const start = index;
      while (index < source.length && isDigit(source.charAt(index))) index += 1;
      const whole = source.slice(start, index);

      if (source.charAt(index) === '.' && isDigit(source.charAt(index + 1))) {
        index += 1;
        while (index < source.length && isDigit(source.charAt(index))) index += 1;
        tokens.push({
          type: 'number',
          form: 'decimal',
          start,
          end: index,
          text: source.slice(start, index),
        });
        continue;
      }

      if (source.charAt(index) === '/' && isDigit(source.charAt(index + 1))) {
        index += 1;
        const denominatorStart = index;
        while (index < source.length && isDigit(source.charAt(index))) index += 1;
        tokens.push({
          type: 'number',
          form: 'fraction',
          start,
          end: index,
          text: source.slice(start, index),
          num: whole,
          den: source.slice(denominatorStart, index),
        });
        continue;
      }

      tokens.push({ type: 'number', form: 'integer', start, end: index, text: whole });
      continue;
    }

    const operator = operatorAt(char);
    if (operator !== undefined) {
      tokens.push({ type: operator, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: char === '(' ? 'lparen' : 'rparen', start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (char === '□') {
      tokens.push({ type: 'box', start: index, end: index + 1 });
      index += 1;
      continue;
    }

    throw new MathError('PARSE', `알 수 없는 문자입니다: ${char}`, { position: index });
  }

  return tokens;
}

function operatorAt(char: string): OperatorTokenType | undefined {
  switch (char) {
    case '+':
      return 'add';
    case '-':
    case '−':
      return 'sub';
    case '*':
    case '×':
      return 'mul';
    case '/':
    case '÷':
      return 'div';
    case ':':
      return 'ratio';
    default:
      return undefined;
  }
}
