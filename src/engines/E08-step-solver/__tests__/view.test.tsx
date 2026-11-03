/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { stepSolverStrings as S } from '../strings.ko';
import type { StepSolverConfig } from '../types';
import { StepSolverView } from '../View';

afterEach(cleanup);

// jsdom에는 scrollIntoView가 없다. 줄 목록 스크롤은 브라우저 E2E에서 본다.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe('E08 단계 이름표 화면', () => {
  const config: StepSolverConfig = {
    mode: 'fraction-steps',
    start: '3/4 + 1/6',
    stepLabels: ['통분', '계산', '약분'],
  };

  it('주어진 첫 줄에는 이름표 고르기를 두지 않고, 풀이 줄에만 둔다', () => {
    const state = reduce(createInitialState(config), { type: 'add-line' });
    const view = render(
      <StepSolverView
        config={config}
        state={state}
        dispatch={() => {}}
        cpa="A"
        mode={state.mode}
        readOnly={false}
        targetSize={48}
      />,
    );
    expect(view.queryByLabelText(S.stepLabelFor(0))).toBeNull();
    expect(view.getByLabelText(S.stepLabelFor(1))).toBeTruthy();
    expect(view.getByLabelText(S.stepLabelFor(2))).toBeTruthy();
  });
});
