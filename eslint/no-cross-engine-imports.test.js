import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-cross-engine-imports.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const E05 = '/repo/src/engines/E05-fraction-model/reduce.ts';
const E05_OVERLAY = '/repo/src/engines/E05-fraction-model/overlays/Counter.tsx';
const crossEngine = [{ messageId: 'crossEngine' }];

tester.run('no-cross-engine-imports', rule, {
  valid: [
    { filename: E05, code: "import { x } from './types';" },
    { filename: E05_OVERLAY, code: "import { x } from '../types';" },
    { filename: E05, code: "import { Rational } from '../../core/math';" },
    { filename: E05, code: "import React from 'react';" },
    // 엔진 밖(runner)에서는 여러 엔진을 import해도 된다
    {
      filename: '/repo/src/core/runner/registry.ts',
      code: "import e from '../../engines/E03-number-line';",
    },
  ],
  invalid: [
    { filename: E05, code: "import e from '../E03-number-line';", errors: crossEngine },
    {
      filename: E05_OVERLAY,
      code: "import { s } from '../../E03-number-line/reduce';",
      errors: crossEngine,
    },
    { filename: E05, code: "export * from '../E07-column-grid/types';", errors: crossEngine },
    { filename: E05, code: "const m = import('../E12-blocks-3d');", errors: crossEngine },
    { filename: E05, code: "import e from '@/engines/E03-number-line';", errors: crossEngine },
    {
      filename: E05,
      code: "import e from 'src/engines/E03-number-line/index';",
      errors: crossEngine,
    },
  ],
});
