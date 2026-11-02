import type { Ast } from './ast';
import { BINARY_SYMBOL } from './ast';

/** 화면에 보여 줄 식 문자열. ASCII 기호는 유니코드로 바꾼다. */
export function renderAst(ast: Ast): string {
  switch (ast.kind) {
    case 'number':
      return ast.text;
    case 'box':
      return '□';
    case 'group': {
      const inner = renderAst(ast.expr);
      return ast.expr.kind === 'binary' || ast.expr.kind === 'ratio' ? `(${inner})` : inner;
    }
    case 'binary':
      return `${renderAst(ast.left)} ${BINARY_SYMBOL[ast.op]} ${renderAst(ast.right)}`;
    case 'ratio':
      return `${renderAst(ast.left)} : ${renderAst(ast.right)}`;
  }
}
