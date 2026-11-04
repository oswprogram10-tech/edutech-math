/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fractionModelStrings as S } from '../strings.ko';
import { createInitialState, reduce } from '../reduce';
import type { FractionModelConfig, FractionModelState, MixedState } from '../types';
import { LOGICAL_WIDTH } from '../types';
import { FractionModelView } from '../View';

afterEach(cleanup);

function renderView(config: FractionModelConfig, state: FractionModelState, readOnly = false) {
  return render(
    <FractionModelView
      config={config}
      state={state}
      dispatch={() => {}}
      cpa="P"
      mode={state.mode}
      readOnly={readOnly}
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

describe('E05 decimal-grid 층 이름', () => {
  it('config.layerLabels가 있으면 그 이름을 층 버튼에 쓴다', () => {
    const config: FractionModelConfig = {
      mode: 'decimal-grid',
      size: 10,
      layers: 2,
      layerLabels: ['0.3', '0.25'],
    };
    const view = renderView(config, createInitialState(config));
    expect(view.getByRole('button', { name: '0.3' })).toBeTruthy();
    expect(view.getByRole('button', { name: '0.25' })).toBeTruthy();
  });

  it('config.layerLabels가 없으면 기본 층 이름을 쓴다', () => {
    const config: FractionModelConfig = { mode: 'decimal-grid', size: 10, layers: 2 };
    const view = renderView(config, createInitialState(config));
    expect(view.getByRole('button', { name: S.layerName(0) })).toBeTruthy();
    expect(view.getByRole('button', { name: S.layerName(1) })).toBeTruthy();
  });

  it('layerLabels가 모자라면 남은 층은 기본 이름을 쓴다', () => {
    const config: FractionModelConfig = {
      mode: 'decimal-grid',
      size: 10,
      layers: 2,
      layerLabels: ['0.3'],
    };
    const view = renderView(config, createInitialState(config));
    expect(view.getByRole('button', { name: '0.3' })).toBeTruthy();
    expect(view.getByRole('button', { name: S.layerName(1) })).toBeTruthy();
  });
});

describe('E05 decimal-grid 한 층짜리 모눈', () => {
  const config: FractionModelConfig = { mode: 'decimal-grid', size: 10, layers: 1 };

  it('층 버튼을 보여 주지 않는다', () => {
    const view = renderView(config, createInitialState(config));
    expect(view.queryByRole('button', { name: S.layerName(0) })).toBeNull();
    expect(view.getByRole('button', { name: S.clearCells })).toBeTruthy();
  });

  it('층을 바꾸라는 안내 대신 한 층용 안내를 보여 준다', () => {
    const text = renderView(config, createInitialState(config)).container.textContent ?? '';
    expect(text).toContain(S.instructions.decimalSingle);
    expect(text).not.toContain(S.instructions.decimal);
  });

  it('두 층 이상이면 층 버튼과 층 안내를 그대로 보여 준다', () => {
    const two: FractionModelConfig = { mode: 'decimal-grid', size: 10, layers: 2 };
    const view = renderView(two, createInitialState(two));
    expect(view.getByRole('button', { name: S.layerName(0) })).toBeTruthy();
    expect(view.container.textContent ?? '').toContain(S.instructions.decimal);
  });
});

describe('E05 decimal-grid 다른 층 겹쳐 보기', () => {
  const config: FractionModelConfig = {
    mode: 'decimal-grid',
    size: 10,
    layers: 2,
    overlayAlpha: 0.4,
  };

  function twoLayerState(): FractionModelState {
    let state = createInitialState(config);
    state = reduce(state, { type: 'shade-row', row: 0 });
    return reduce(state, { type: 'set-layer', layer: 1 });
  }

  it('고르지 않은 층의 칠한 칸을 반투명 빗금으로 겹쳐 그린다', () => {
    const state = twoLayerState();
    const view = renderView(config, state);
    const overlays = Array.from(view.container.querySelectorAll('[data-testid="decimal-overlay"]'));
    expect(overlays).toHaveLength(10);
    for (const overlay of overlays) {
      expect(overlay.getAttribute('data-overlay-layer')).toBe('0');
      expect(overlay.getAttribute('fill')).toBe('url(#e05-overlay-0)');
      expect(overlay.getAttribute('fill-opacity')).toBe('0.4');
      expect(overlay.getAttribute('pointer-events')).toBe('none');
      expect(overlay.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('칠하지 않은 다른 층은 겹쳐 그리지 않는다', () => {
    const state = reduce(createInitialState(config), { type: 'set-layer', layer: 1 });
    const view = renderView(config, state);
    expect(view.container.querySelectorAll('[data-testid="decimal-overlay"]')).toHaveLength(0);
  });

  it('layers 1에서는 겹쳐 그리지 않는다', () => {
    const single: FractionModelConfig = { mode: 'decimal-grid', size: 10, layers: 1 };
    let state = createInitialState(single);
    state = reduce(state, { type: 'shade-row', row: 0 });
    const view = renderView(single, state);
    expect(view.container.querySelectorAll('[data-testid="decimal-overlay"]')).toHaveLength(0);
  });

  it('읽기 전용에서는 겹쳐 그리지 않는다', () => {
    const view = renderView(config, twoLayerState(), true);
    expect(view.container.querySelectorAll('[data-testid="decimal-overlay"]')).toHaveLength(0);
  });
});

describe('E05 mixed 문제의 피연산자 표기', () => {
  it('config가 대분수면 대분수로 보여 준다', () => {
    const config: FractionModelConfig = {
      mode: 'mixed',
      op: '-',
      a: '3 1/6',
      b: '1 3/4',
      breakWhole: true,
      commonGrid: 12,
    };
    const text = textOf(config, createInitialState(config));
    expect(text).toContain('3 1/6');
    expect(text).toContain('1 3/4');
    expect(text).not.toContain('19/6');
    expect(text).not.toContain('7/4');
  });

  it('config가 가분수면 가분수 표기를 그대로 쓴다', () => {
    const config: FractionModelConfig = { mode: 'mixed', op: '+', a: '19/6', b: '7/4' };
    const text = textOf(config, createInitialState(config));
    expect(text).toContain('19/6');
    expect(text).toContain('7/4');
    expect(text).not.toContain('3 1/6');
    expect(text).not.toContain('1 3/4');
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

describe('E05 T049 정답 노출 금지', () => {
  it('multiply는 곱(1/2)을 쓰지 않는다', () => {
    const config: FractionModelConfig = {
      mode: 'multiply',
      a: '2/3',
      b: '3/4',
      build: 'preset',
    };
    const text = textOf(config, createInitialState(config));
    expect(text).not.toContain('1/2');
  });

  it('divide-measure는 자를 놓기 전에 몫(6)을 쓰지 않는다', () => {
    const config: FractionModelConfig = {
      mode: 'divide-measure',
      dividend: '3/4',
      divisor: '1/8',
    };
    const text = textOf(config, createInitialState(config));
    expect(text).not.toContain('6');
  });

  it('share는 접시에 합한 값(3/4)을 쓰지 않는다', () => {
    const config: FractionModelConfig = {
      mode: 'partition',
      variant: 'share',
      wholes: 3,
      people: 4,
      shape: 'circle',
    };
    let state = createInitialState(config);
    for (let whole = 0; whole < 3; whole += 1) {
      state = reduce(state, { type: 'cut-equal', whole, parts: 4 });
    }
    for (let whole = 0; whole < 3; whole += 1) {
      for (let piece = 0; piece < 4; piece += 1) {
        state = reduce(state, { type: 'deal-piece', whole, piece, plate: piece });
      }
    }
    const text = textOf(config, state);
    expect(text).not.toContain('3/4');
  });

  it('divide-whole은 남긴 값(4/15)과 1/3을 쓰지 않는다', () => {
    const config: FractionModelConfig = {
      mode: 'partition',
      variant: 'divide-whole',
      fraction: '4/5',
      divisor: 3,
    };
    let state = createInitialState(config);
    state = reduce(state, { type: 'set-rows', rows: 3 });
    state = reduce(state, { type: 'keep-row', row: 0 });
    const text = textOf(config, state);
    expect(text).not.toContain('4/15');
    expect(text).not.toContain('1/3');
  });

  it('showCounts가 꺼져 있으면 칸 수를 숨기고, 켜면 칸 수만 쓴다', () => {
    const config: FractionModelConfig = {
      mode: 'multiply',
      a: '2/3',
      b: '3/4',
      build: 'preset',
    };
    const state = createInitialState(config);
    expect(textOf(config, state)).not.toContain(S.multiplyCounts(12, 6));
    const shown = textOf({ ...config, showCounts: true }, state);
    expect(shown).toContain(S.multiplyCounts(12, 6));
    expect(shown).not.toContain('1/2');
  });

  it('plateLabel이 꺼져 있으면 조각 크기·개수를 숨기고, 켜면 합한 값 없이 쓴다', () => {
    const config: FractionModelConfig = {
      mode: 'partition',
      variant: 'share',
      wholes: 1,
      people: 2,
      shape: 'circle',
    };
    let state = createInitialState(config);
    state = reduce(state, { type: 'cut-equal', whole: 0, parts: 4 });
    for (let piece = 0; piece < 4; piece += 1) {
      state = reduce(state, { type: 'deal-piece', whole: 0, piece, plate: piece % 2 });
    }
    expect(textOf(config, state)).not.toContain(S.pieceCountLabel('1/4', 2));
    const labelled = textOf({ ...config, plateLabel: true }, state);
    expect(labelled).toContain(S.pieceCountLabel('1/4', 2));
    expect(labelled).not.toContain('1/2');
  });
});

describe('E05 T049 divide-measure 눈금·자 배치', () => {
  const config: FractionModelConfig = {
    mode: 'divide-measure',
    dividend: '3/4',
    divisor: '2/3',
  };

  function twoRulers(): FractionModelState {
    let state = createInitialState(config);
    state = reduce(state, { type: 'lay-ruler' });
    state = reduce(state, { type: 'lay-ruler' });
    return state;
  }

  it('자 두 번을 놓아도 모든 자 사각형이 캔버스 안에 들어온다', () => {
    const view = renderView(config, twoRulers());
    const rulers = [
      ...view.container.querySelectorAll(
        '[data-testid="measure-ruler"], [data-testid="measure-partial-ruler"]',
      ),
    ];
    expect(rulers).toHaveLength(2);
    for (const ruler of rulers) {
      const x = Number(ruler.getAttribute('x'));
      const width = Number(ruler.getAttribute('width'));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(LOGICAL_WIDTH);
    }
  });

  it('나뉨수 막대 위에 전체 눈금 숫자 0·1·2를 쓰고 분모 칸 선을 그린다', () => {
    const view = renderView(config, twoRulers());
    const labels = [...view.container.querySelectorAll('[data-testid="measure-whole-label"]')].map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(['0', '1', '2']);

    // 나뉨수 3/4은 1/4 칸 3개(경계선 4개), 자 2/3은 1/3 칸 2개(경계선 4개).
    expect(view.container.querySelectorAll('[data-testid="dividend-part-line"]')).toHaveLength(4);
    expect(view.container.querySelectorAll('[data-testid="ruler-part-line"]')).toHaveLength(4);
  });
});

describe('E05 T049 divide-whole 분모 칸 경계선', () => {
  it('칠한 부분 안에 세로 경계선을 그려 5칸을 셀 수 있게 한다', () => {
    const config: FractionModelConfig = {
      mode: 'partition',
      variant: 'divide-whole',
      fraction: '4/5',
      divisor: 2,
    };
    const view = renderView(config, createInitialState(config));
    const lines = view.container.querySelectorAll('[data-testid="divide-whole-column-line"]');
    expect(lines).toHaveLength(4);
  });
});
