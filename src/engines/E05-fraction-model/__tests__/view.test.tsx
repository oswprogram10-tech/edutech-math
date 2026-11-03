/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fractionModelStrings as S } from '../strings.ko';
import { createInitialState, reduce } from '../reduce';
import type { FractionModelConfig, FractionModelState, MixedState } from '../types';
import { FractionModelView } from '../View';

afterEach(cleanup);

function renderView(config: FractionModelConfig, state: FractionModelState) {
  return render(
    <FractionModelView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="P"
      mode={state.mode}
      targetSize={48}
    />,
  );
}

function textOf(config: FractionModelConfig, state: FractionModelState): string {
  return renderView(config, state).container.textContent ?? '';
}

function shadeState(shaded: number[]): FractionModelState {
  return createInitialState({
    mode: 'shade',
    whole: { shape: 'bar', partsX: 4, shaded },
  });
}

describe('E05 기본 showValue=none (정답 노출 금지)', () => {
  it('shade의 currentFraction을 숨긴다', () => {
    const config: FractionModelConfig = {
      mode: 'shade',
      whole: { shape: 'bar', partsX: 4, shaded: [0, 1, 2] },
    };
    const text = textOf(config, shadeState([0, 1, 2]));
    expect(text).not.toContain(S.currentFraction('3/4', '3/4'));
    expect(text).not.toContain('지금');
  });

  it('compare의 barValue를 숨긴다', () => {
    const config: FractionModelConfig = {
      mode: 'compare',
      bars: [
        { parts: 2, shaded: [0] },
        { parts: 3, shaded: [0, 1, 2] },
      ],
    };
    const state = createInitialState(config);
    const text = textOf(config, state);
    expect(text).not.toContain(S.barValue('1/2', '1/2'));
    expect(text).not.toContain('1/2 = 1/2');
  });

  it('overlay-slicer의 공통 격자 칸 수와 aCells/bCells를 숨긴다', () => {
    const config: FractionModelConfig = { mode: 'overlay-slicer', a: '1/2', b: '1/3' };
    const state = reduce(createInitialState(config), { type: 'overlay' });
    const text = textOf(config, state);
    expect(text).not.toContain(S.commonGrid(6));
    expect(text).not.toContain(S.aCells(3));
    expect(text).not.toContain(S.bCells(2));
  });

  it('discrete의 fractionOf를 숨긴다', () => {
    const config: FractionModelConfig = {
      mode: 'discrete',
      items: 12,
      groupSizeOptions: [2, 3, 4, 6],
    };
    let state = createInitialState(config);
    state = reduce(state, { type: 'set-group-size', size: 4 });
    state = reduce(state, { type: 'toggle-group', index: 0 });
    const text = textOf(config, state);
    expect(text).not.toContain(S.fractionOf(12, 1, 3, 4));
    expect(text).not.toContain(S.fractionOfRaw(12, 1, 3));
  });

  it('mixed의 mixedConversion과 resultLabel을 숨긴다', () => {
    const convertConfig: FractionModelConfig = {
      mode: 'mixed',
      direction: 'improper-to-mixed',
      value: '11/4',
    };
    const convert = textOf(convertConfig, createInitialState(convertConfig));
    expect(convert).not.toContain(S.mixedConversion('11/4', '2 3/4'));

    const problemConfig: FractionModelConfig = {
      mode: 'mixed',
      op: '-',
      a: '3 1/6',
      b: '1 3/4',
      breakWhole: true,
      commonGrid: 12,
    };
    let state = createInitialState(problemConfig) as MixedState;
    state = reduce(state, { type: 'break-whole' }) as MixedState;
    state = reduce(state, { type: 'combine' }) as MixedState;
    const problem = textOf(problemConfig, state);
    expect(problem).not.toContain(S.resultLabel('17/12'));
    expect(problem).not.toContain('17/12');
    expect(problem).not.toContain('결과');
  });

  it('add-sub의 resultLabel을 숨긴다', () => {
    const config: FractionModelConfig = { mode: 'add-sub', op: '+', a: '1/2', b: '1/3' };
    let state = createInitialState(config);
    state = reduce(state, { type: 'overlay' });
    state = reduce(state, { type: 'combine' });
    const text = textOf(config, state);
    expect(text).not.toContain(S.resultLabel('5/6'));
    expect(text).not.toContain('결과');
  });

  it('decimal-grid의 decimalValue를 숨긴다', () => {
    const config: FractionModelConfig = { mode: 'decimal-grid', size: 10, layers: 2 };
    let state = createInitialState(config);
    state = reduce(state, { type: 'shade-row', row: 0 });
    const text = textOf(config, state);
    expect(text).not.toContain(S.decimalValue('1/10', '0.1'));
    expect(text).not.toContain('값 ');
  });
});

describe('E05 읽기 전용 partition (선택지 그림)', () => {
  it('넓이 막대와 등분 도장을 숨겨 정답을 알려 주지 않는다', () => {
    const equalConfig: FractionModelConfig = { mode: 'partition', fixedParts: 4 };
    const equalState = createInitialState(equalConfig);
    const equalView = render(
      <FractionModelView
        config={equalConfig}
        state={equalState}
        dispatch={() => {}}
        cpa="P"
        mode="partition"
        readOnly
        targetSize={48}
      />,
    );
    const equalText = equalView.container.textContent ?? '';
    expect(equalText).not.toContain(S.equalStamp);
    expect(equalText).not.toContain(S.notEqualStamp);
    expect(equalText).not.toContain(S.areaBarsLabel);
    // 선택지 <button> 안에 도구 막대 <button>이 겹치지 않는다.
    expect(equalView.queryByRole('toolbar')).toBeNull();

    const unequalConfig: FractionModelConfig = {
      mode: 'partition',
      presetCuts: [
        {
          points: [
            { x: 300, y: 150 },
            { x: 300, y: 450 },
          ],
        },
        {
          points: [
            { x: 500, y: 150 },
            { x: 500, y: 450 },
          ],
        },
        {
          points: [
            { x: 700, y: 150 },
            { x: 700, y: 450 },
          ],
        },
      ],
    };
    const unequalView = render(
      <FractionModelView
        config={unequalConfig}
        state={createInitialState(unequalConfig)}
        dispatch={() => {}}
        cpa="P"
        mode="partition"
        readOnly
        targetSize={48}
      />,
    );
    const unequalText = unequalView.container.textContent ?? '';
    expect(unequalText).not.toContain(S.equalStamp);
    expect(unequalText).not.toContain(S.notEqualStamp);
    expect(unequalText).not.toContain(S.areaBarsLabel);
  });

  it('읽기 전용이 아니면 같은 그림에서 도장과 넓이 막대를 보여 준다', () => {
    const config: FractionModelConfig = { mode: 'partition', fixedParts: 4 };
    const text = textOf(config, createInitialState(config));
    expect(text).toContain(S.equalStamp);
    expect(text).toContain(S.areaBarsLabel);
  });
});

describe('E05 미리 나뉜 partition (자를 수 없음)', () => {
  it('fixedParts로 미리 나뉘면 칼선 도구를 숨기고 색칠 안내를 보여 준다', () => {
    const config: FractionModelConfig = { mode: 'partition', shape: 'bar', fixedParts: 10 };
    const view = renderView(config, createInitialState(config));
    expect(view.queryByRole('button', { name: S.clearCuts })).toBeNull();
    expect(view.queryByRole('button', { name: S.centerCut })).toBeNull();
    expect(view.queryByRole('button', { name: S.toolLine })).toBeNull();
    expect(view.container.textContent).toContain(S.presetHint);
    expect(view.container.textContent).not.toContain(S.cutHint);
  });

  it('미리 나누지 않은 partition은 칼선 도구를 그대로 보여 준다', () => {
    const config: FractionModelConfig = { mode: 'partition', shape: 'rect' };
    const view = renderView(config, createInitialState(config));
    expect(view.getByRole('button', { name: S.clearCuts })).toBeTruthy();
    expect(view.container.textContent).toContain(S.cutHint);
  });
});

describe('E05 showValue 단계', () => {
  it("'raw'는 약분 전 표기만, 'raw-and-reduced'는 약분된 값까지 보여 준다", () => {
    const config: FractionModelConfig = {
      mode: 'shade',
      whole: { shape: 'bar', partsX: 4, shaded: [0, 1] },
    };
    const state = shadeState([0, 1]);

    const raw = textOf({ ...config, showValue: 'raw' }, state);
    expect(raw).toContain('지금 2/4');
    expect(raw).not.toContain('= 1/2');

    const full = textOf({ ...config, showValue: 'raw-and-reduced' }, state);
    expect(full).toContain('지금 2/4 = 1/2');
  });

  it("'raw'는 mixed 변환에서 가분수만 보여 준다", () => {
    const config: FractionModelConfig = {
      mode: 'mixed',
      direction: 'improper-to-mixed',
      value: '11/4',
    };
    const state = createInitialState(config);

    const raw = textOf({ ...config, showValue: 'raw' }, state);
    expect(raw).toContain(S.improperOnly('11/4'));
    expect(raw).not.toContain('= 2 3/4');

    const full = textOf({ ...config, showValue: 'raw-and-reduced' }, state);
    expect(full).toContain(S.mixedConversion('11/4', '2 3/4'));
  });
});

describe('E05 약분 탐정 partition (묶음 조작)', () => {
  const config: FractionModelConfig = {
    mode: 'partition',
    fraction: '18/24',
    groupChoices: [1, 2, 3, 4, 5, 6, 8],
    showGcdShortcut: true,
  };

  function groupedState(size: number): FractionModelState {
    return reduce(createInitialState(config), { type: 'set-group-size', size });
  }

  it('1은 빼고 groupChoices마다 묶기 버튼을 만든다', () => {
    const view = renderView(config, createInitialState(config));
    for (const size of [2, 3, 4, 5, 6, 8]) {
      expect(view.getByRole('button', { name: S.groupByCells(size) })).toBeTruthy();
    }
    expect(view.queryByRole('button', { name: S.groupByCells(1) })).toBeNull();
  });

  it('고른 크기의 버튼만 눌린 상태가 된다', () => {
    const view = renderView(config, groupedState(6));
    expect(view.getByRole('button', { name: S.groupByCells(6) }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(view.getByRole('button', { name: S.groupByCells(2) }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('묶기 버튼을 누르면 set-group-size를 보낸다', () => {
    const dispatch = vi.fn();
    const view = render(
      <FractionModelView
        config={config}
        state={createInitialState(config)}
        dispatch={dispatch}
        cpa="P"
        mode="partition"
        targetSize={48}
      />,
    );
    fireEvent.click(view.getByRole('button', { name: S.groupByCells(6) }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-group-size', size: 6 });
  });

  it('나누어떨어지면 확정 문구를 보여 주고 showValue none에서는 수치를 쓰지 않는다', () => {
    const text = textOf(config, groupedState(6));
    expect(text).toContain(S.groupConfirmed);
    expect(text).not.toContain('3/4');
  });

  it("'raw-and-reduced'면 확정된 새 이름 수치를 보여 준다", () => {
    const text = textOf({ ...config, showValue: 'raw-and-reduced' }, groupedState(6));
    expect(text).toContain(S.groupConfirmedValue('18/24', '3/4'));
  });

  it('최대공약수로 묶을 때만 한 번에! 도장을 보여 준다', () => {
    const gcdView = renderView(config, groupedState(6));
    expect(gcdView.getByTestId('gcd-stamp').textContent).toBe(S.gcdShortcut);
    const otherView = renderView(config, groupedState(3));
    expect(otherView.container.querySelector('[data-testid="gcd-stamp"]')).toBeNull();
  });

  it('막대 끝을 넘거나 색칠 경계를 가로지르면 그 까닭을 알려 준다', () => {
    expect(textOf(config, groupedState(5))).toContain(S.groupOverflow);
    const crossing = textOf(config, groupedState(4));
    expect(crossing).toContain(S.groupCrossing);
    expect(crossing).not.toContain(S.groupConfirmed);
  });

  it('묶음 테두리 개수는 전체 칸을 크기로 나눈 올림이다', () => {
    const view = renderView(config, groupedState(5));
    const overlay = view.getByTestId('simplify-groups');
    expect(overlay.querySelectorAll('rect')).toHaveLength(5);
  });

  it('읽기 전용이면 묶기 도구를 숨긴다', () => {
    const view = render(
      <FractionModelView
        config={config}
        state={createInitialState(config)}
        dispatch={() => {}}
        cpa="P"
        mode="partition"
        readOnly
        targetSize={48}
      />,
    );
    expect(view.queryByRole('button', { name: S.groupByCells(6) })).toBeNull();
  });
});
