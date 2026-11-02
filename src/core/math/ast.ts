import type { Rational } from './rational';

export type NumberForm = 'integer' | 'decimal' | 'fraction' | 'mixed';

export interface NumberNode {
  readonly kind: 'number';
  readonly value: Rational;
  readonly form: NumberForm;
  readonly text: string;
  /** 대분수일 때 정수부 문자열. */
  readonly whole?: string;
  /** 분수·대분수일 때 분자 문자열. */
  readonly num?: string;
  /** 분수·대분수일 때 분모 문자열. */
  readonly den?: string;
}

export interface BoxNode {
  readonly kind: 'box';
}

export interface GroupNode {
  readonly kind: 'group';
  readonly expr: Ast;
}

export type BinaryOperator = 'add' | 'sub' | 'mul' | 'div';

export interface BinaryNode {
  readonly kind: 'binary';
  readonly op: BinaryOperator;
  readonly left: Ast;
  readonly right: Ast;
}

/** 비 `a : b`. 가장 낮은 우선순위이고 최상위에 하나만 온다. */
export interface RatioNode {
  readonly kind: 'ratio';
  readonly left: Ast;
  readonly right: Ast;
}

export type Ast = NumberNode | BoxNode | GroupNode | BinaryNode | RatioNode;

export type ArithmeticSymbol = '+' | '−' | '×' | '÷';
export type OperatorSymbol = ArithmeticSymbol | ':';

export const BINARY_SYMBOL: Record<BinaryOperator, ArithmeticSymbol> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
};
