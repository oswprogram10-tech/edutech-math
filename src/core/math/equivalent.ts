import type { Ast } from './ast';
import { evaluate } from './evaluate';
import { parse } from './parse';

function asAst(value: Ast | string): Ast {
  return typeof value === 'string' ? parse(value) : value;
}

/** 두 식의 값이 정확히 같은지 비교한다. `equivalent("2:3", "4:6")`은 true. */
export function equivalent(a: Ast | string, b: Ast | string): boolean {
  return evaluate(asAst(a)).equals(evaluate(asAst(b)));
}
