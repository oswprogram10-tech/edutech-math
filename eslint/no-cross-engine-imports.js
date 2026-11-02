// 절대 규칙 1: src/engines/Exx-*/ 안의 코드는 다른 엔진 폴더를 import하지 않는다.
// 상대 경로를 실제 위치로 풀어서 검사하므로 '../../E03-number-line/x' 같은 우회도 잡는다.
import path from 'node:path';

const ENGINE_DIR = /(?:^|[\\/])src[\\/]engines[\\/](E\d{2}[^\\/]*)(?:[\\/]|$)/;
const ENGINE_ALIAS = /^(?:@\/|~\/|\/)?(?:src\/)?engines\//;

function engineOf(p) {
  const m = ENGINE_DIR.exec(p);
  return m ? m[1] : null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: '엔진 폴더 사이의 import 금지 (연동은 src/core/runner 이벤트로만)' },
    messages: {
      crossEngine:
        '엔진 {{from}} 에서 다른 엔진 {{to}} 를 import할 수 없습니다. 연동은 src/core/runner 의 이벤트 연결로만 합니다.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename;
    const from = engineOf(filename);
    if (!from) return {};

    function check(node, source) {
      if (!source || typeof source.value !== 'string') return;
      const spec = source.value;
      let target;
      if (spec.startsWith('.')) {
        target = path.resolve(path.dirname(filename), spec);
      } else if (ENGINE_ALIAS.test(spec)) {
        // 별칭(@/engines/..., src/engines/...)으로 들어오는 경우
        target = 'src/engines/' + spec.replace(ENGINE_ALIAS, '');
      } else {
        return;
      }
      const to = engineOf(target);
      if (to && to !== from) {
        context.report({ node, messageId: 'crossEngine', data: { from, to } });
      }
    }

    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source.type === 'Literal' ? node.source : null),
    };
  },
};
