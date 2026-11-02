import type { Ast, NumberNode } from './ast';
import { MathError } from './errors';
import { Rational } from './rational';
import { tokenize } from './tokenize';
import type { FractionToken, IntegerToken, NumberToken, Token } from './tokenize';

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly source: string,
  ) {}

  parse(): Ast {
    if (this.tokens.length === 0) {
      throw new MathError('PARSE', '수식이 비어 있습니다.', { position: 0 });
    }
    const ast = this.parseRatio();
    const rest = this.peek();
    if (rest !== undefined) {
      throw this.error('수식이 끝나지 않았습니다.', rest.start);
    }
    return ast;
  }

  private parseRatio(): Ast {
    const left = this.parseAddSub();
    const colon = this.peek();
    if (colon?.type !== 'ratio') return left;

    this.index += 1;
    const right = this.parseAddSub();
    const second = this.peek();
    if (second?.type === 'ratio') {
      throw this.error('비는 최상위에 한 번만 쓸 수 있습니다.', second.start);
    }
    return { kind: 'ratio', left, right };
  }

  private parseAddSub(): Ast {
    let left = this.parseMulDiv();
    for (;;) {
      const token = this.peek();
      if (token === undefined || (token.type !== 'add' && token.type !== 'sub')) return left;
      this.index += 1;
      const right = this.parseMulDiv();
      left = { kind: 'binary', op: token.type, left, right };
    }
  }

  private parseMulDiv(): Ast {
    let left = this.parsePrimary();
    for (;;) {
      const token = this.peek();
      if (token === undefined || (token.type !== 'mul' && token.type !== 'div')) return left;
      this.index += 1;
      const right = this.parsePrimary();
      left = { kind: 'binary', op: token.type, left, right };
    }
  }

  private parsePrimary(): Ast {
    const token = this.peek();
    if (token === undefined) {
      throw this.error('수가 필요합니다.', this.source.length);
    }

    if (token.type === 'number') {
      this.index += 1;
      const next = this.peek();
      if (
        token.form === 'integer' &&
        next !== undefined &&
        next.type === 'number' &&
        next.form === 'fraction'
      ) {
        this.index += 1;
        return this.mixedNode(token, next);
      }
      return this.numberNode(token);
    }

    if (token.type === 'box') {
      this.index += 1;
      return { kind: 'box' };
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

  private numberNode(token: NumberToken): NumberNode {
    if (token.form === 'decimal') {
      return {
        kind: 'number',
        form: 'decimal',
        value: Rational.parse(token.text),
        text: token.text,
      };
    }

    if (token.form === 'fraction') {
      const num = token.num;
      const den = token.den;
      if (BigInt(den) === 0n) {
        throw new MathError('DIV_BY_ZERO', '분모가 0입니다.', { position: token.start });
      }
      return {
        kind: 'number',
        form: 'fraction',
        value: Rational.of(BigInt(num), BigInt(den)),
        text: token.text,
        num,
        den,
      };
    }

    return {
      kind: 'number',
      form: 'integer',
      value: Rational.of(BigInt(token.text)),
      text: token.text,
    };
  }

  private mixedNode(wholeToken: IntegerToken, fractionToken: FractionToken): NumberNode {
    const whole = BigInt(wholeToken.text);
    const num = BigInt(fractionToken.num);
    const den = BigInt(fractionToken.den);
    if (den === 0n) {
      throw new MathError('DIV_BY_ZERO', '분모가 0입니다.', { position: fractionToken.start });
    }
    if (num >= den) {
      throw this.error('대분수의 분수 부분은 1보다 작아야 합니다.', fractionToken.start);
    }
    return {
      kind: 'number',
      form: 'mixed',
      value: Rational.of(whole * den + num, den),
      text: `${wholeToken.text} ${fractionToken.num}/${fractionToken.den}`,
      whole: wholeToken.text,
      num: fractionToken.num,
      den: fractionToken.den,
    };
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private error(message: string, position: number): MathError {
    return new MathError('PARSE', message, { position });
  }
}

/** 수식 문자열을 AST로 바꾼다. */
export function parse(source: string): Ast {
  return new Parser(tokenize(source), source).parse();
}
