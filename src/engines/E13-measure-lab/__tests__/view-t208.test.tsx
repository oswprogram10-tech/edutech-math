/** @vitest-environment jsdom */
/** E13 T208 화면 테스트: estimate·mergeRule·unit-train 정답 비노출, 단추·키보드 조작, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EstimateView } from '../estimate/EstimateView';
import { CountCellsOverlay } from '../estimate/overlays/count-cells';
import { createEstimateState, reduceEstimate } from '../estimate/reduce';
import type { EstimateAction, EstimateConfig, EstimateState } from '../estimate/types';
import { LengthView } from '../length/LengthView';
import { Meter100 } from '../length/overlays/meter-100';
import { createLengthState, reduceLength } from '../length/reduce';
import type { LengthAction, LengthConfig, MeasureState } from '../length/types';
import { TrainView } from '../train/TrainView';
import { MeterOutlineOverlay } from '../train/overlays/meter-outline';
import { createTrainState, reduceTrain } from '../train/reduce';
import type { TrainAction, TrainConfig, TrainState } from '../train/types';

afterEach(cleanup);

const crayon: EstimateConfig = {
  mode: 'estimate',
  object: { name: 'crayon', lengthCm: '6.7' },
  ruler: { offsetCm: 3, draggable: true },
  estimateFirst: true,
};
const board: LengthConfig = {
  mode: 'length',
  units: ['cm-10-rod'],
  mergeRule: { from: 'cm-10-rod', count: 10, to: 'm-tape' },
  object: { name: 'blackboard', lengthCm: 320 },
};
const addTrain: TrainConfig = {
  mode: 'length',
  variant: 'unit-train',
  op: 'add',
  a: '1m 70cm',
  b: '2m 50cm',
};
const subTrain: TrainConfig = { ...addTrain, op: 'sub', a: '5m 20cm', b: '2m 60cm' };

function estimate(config: EstimateConfig, ...actions: EstimateAction[]): EstimateState {
  return actions.reduce(reduceEstimate, createEstimateState(config));
}
function merge(...actions: LengthAction[]): MeasureState {
  return actions.reduce(reduceLength, createLengthState(board));
}
function train(config: TrainConfig, ...actions: TrainAction[]): TrainState {
  return actions.reduce(reduceTrain, createTrainState(config));
}

function renderEstimate(state: EstimateState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <EstimateView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}
function renderTrain(state: TrainState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <TrainView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

/** 글과 data-·aria- 속성값을 모두 모은다(결과가 어디에도 새지 않는지 볼 때 쓴다). */
function everything(container: Element): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

describe('estimate 화면', () => {
  it('시작 화면 DOM·aria·data-에 물건 길이(6.7)가 없다', () => {
    for (const config of [crayon, { ...crayon, estimateFirst: false }]) {
      const { container, unmount } = renderEstimate(estimate(config));
      const text = everything(container);
      expect(text).not.toMatch(/6\.7|67\/10|6,7/);
      expect(text).not.toMatch(/정답|더 긴|길이는/);
      // 물건 끝 눈금(9.7)도 어디에도 쓰지 않는다.
      expect(text).not.toMatch(/9\.7|97\/10/);
      unmount();
    }
  });

  it('estimateFirst이면 어림을 넣기 전에는 자가 그려지지 않고 "먼저 어림해 보세요"가 보인다', () => {
    const { container } = renderEstimate(estimate(crayon));
    expect(container.querySelector('[data-part="ruler"]')).toBeNull();
    expect(container.querySelector('[data-part="ask-first"]')?.textContent).toBe(
      '먼저 어림해 보세요',
    );
    expect(container.querySelector('[data-part="estimate-bar"]')).toBeNull();
  });

  it('estimateFirst가 아니면 처음부터 자가 있고 키패드는 없다', () => {
    const { container } = renderEstimate(estimate({ ...crayon, estimateFirst: false }));
    expect(container.querySelector('[data-part="ruler"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '어림 넣기' })).toBeNull();
  });

  it('키패드로 7을 눌러 [어림 넣기]를 누르면 estimate Action을 보낸다', () => {
    const dispatch = vi.fn();
    renderEstimate(estimate(crayon), dispatch);
    expect(screen.getByTestId('estimate-draft').textContent).toBe('어림: □cm');
    fireEvent.click(screen.getByRole('button', { name: '숫자 7' }));
    expect(screen.getByTestId('estimate-draft').textContent).toBe('어림: 7cm');
    fireEvent.click(screen.getByRole('button', { name: '어림 넣기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'estimate', value: 7 });
  });

  it('두 자리까지 넣고 지우기·0 시작 거절·빈 칸 제출을 처리한다', () => {
    const dispatch = vi.fn();
    renderEstimate(estimate(crayon), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '어림 넣기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('1부터 99');
    fireEvent.click(screen.getByRole('button', { name: '숫자 0' }));
    expect(screen.getByTestId('estimate-draft').textContent).toBe('어림: □cm');
    fireEvent.click(screen.getByRole('button', { name: '숫자 1' }));
    fireEvent.click(screen.getByRole('button', { name: '숫자 2' }));
    fireEvent.click(screen.getByRole('button', { name: '숫자 3' }));
    expect(screen.getByTestId('estimate-draft').textContent).toBe('어림: 12cm');
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(screen.getByTestId('estimate-draft').textContent).toBe('어림: 1cm');
    fireEvent.click(screen.getByRole('button', { name: '어림 넣기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'estimate', value: 1 });
  });

  it('잠긴 뒤에는 자와 "내 어림" 점선 막대가 생기고 키패드는 꺼진다', () => {
    const { container } = renderEstimate(estimate(crayon, { type: 'estimate', value: 9 }));
    expect(container.querySelector('[data-part="ruler"]')).not.toBeNull();
    expect(container.querySelector('[data-part="estimate-bar"]')?.textContent).toBe('내 어림');
    expect(screen.getByTestId('estimate-draft').textContent).toBe('어림: 9cm');
    expect((screen.getByRole('button', { name: '숫자 3' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    // 어림 막대와 물건 끝 사이의 차이는 그림으로만: 막대 글에 숫자가 없다.
    expect(container.querySelector('[data-part="estimate-bar"]')?.textContent).not.toMatch(/\d/);
  });

  it('자를 ←→ 키로 0.5cm씩 옮긴다(← 는 눈금이 커진다)', () => {
    const dispatch = vi.fn();
    const state = estimate(crayon, { type: 'estimate', value: 9 });
    renderEstimate(state, dispatch);
    const ruler = screen.getByRole('button', { name: '자. ←→로 옮겨요' });
    fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move-ruler', offsetCm: '5/2' });
    fireEvent.keyDown(ruler, { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move-ruler', offsetCm: '7/2' });
  });

  it('영점에서 더 오른쪽으로 옮기려 하면 이유를 알리고 보내지 않는다', () => {
    const dispatch = vi.fn();
    const state = estimate({ ...crayon, estimateFirst: false, ruler: { offsetCm: 0 } });
    renderEstimate(state, dispatch);
    fireEvent.keyDown(screen.getByRole('button', { name: '자. ←→로 옮겨요' }), {
      key: 'ArrowRight',
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('옮길 수 없어요');
  });

  it('draggable이 false이면 자에 초점·단추 역할이 없다', () => {
    const { container } = renderEstimate(
      estimate({ ...crayon, estimateFirst: false, ruler: { offsetCm: 3, draggable: false } }),
    );
    expect(screen.queryByRole('button', { name: '자. ←→로 옮겨요' })).toBeNull();
    expect(container.querySelector('[data-part="ruler"]')?.getAttribute('tabindex')).toBeNull();
  });

  it('자의 눈금은 0~25 숫자뿐이고 mm 작은 눈금이 없다', () => {
    const { container } = renderEstimate(estimate({ ...crayon, estimateFirst: false }));
    expect(container.querySelectorAll('[data-part="ruler-tick"]')).toHaveLength(26);
    const numbers = [...container.querySelectorAll('[data-part="ruler-tick"] text')].map(
      (node) => node.textContent,
    );
    expect(numbers).toEqual(Array.from({ length: 26 }, (_, i) => String(i)));
  });

  it('readOnly이면 단추가 모두 꺼진다', () => {
    renderEstimate(estimate(crayon), vi.fn(), true);
    expect((screen.getByRole('button', { name: '어림 넣기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: '자 제자리로' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('설정 오류이면 오류 문구만 보인다', () => {
    const { container } = renderEstimate(estimate({ ...crayon, object: undefined }));
    expect(container.querySelector('[data-testid="measure-error"]')).not.toBeNull();
  });
});

describe('count-cells 오버레이', () => {
  it('물건이 시작한 눈금부터 1cm 칸을 번갈아 칠하고 마지막 짧은 칸은 점선, 숫자 글은 없다', () => {
    const { container } = render(
      <CountCellsOverlay config={{}} state={estimate({ ...crayon, estimateFirst: false })} />,
    );
    const cells = container.querySelectorAll('[data-part="cell"]');
    expect(cells).toHaveLength(6); // 6.7 → 1cm 칸 6개 + 0.7cm 점선
    expect(cells[0]?.getAttribute('fill')).not.toBe(cells[1]?.getAttribute('fill'));
    expect(cells[0]?.getAttribute('fill')).toBe(cells[2]?.getAttribute('fill'));
    const part = container.querySelector('[data-part="cell-part"]');
    expect(part?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(Number(part?.getAttribute('width'))).toBeCloseTo(21, 5);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('길이가 정수이면 점선 칸이 없고, 어림 전(자가 없음)과 오류에서는 그리지 않는다', () => {
    const whole = estimate({
      ...crayon,
      estimateFirst: false,
      object: { name: 'crayon', lengthCm: 7 },
    });
    const { container, unmount } = render(<CountCellsOverlay config={{}} state={whole} />);
    expect(container.querySelectorAll('[data-part="cell"]')).toHaveLength(7);
    expect(container.querySelector('[data-part="cell-part"]')).toBeNull();
    unmount();
    expect(
      render(<CountCellsOverlay config={{}} state={estimate(crayon)} />).container.querySelector(
        'svg',
      ),
    ).toBeNull();
  });
});

describe('length mergeRule 화면', () => {
  it('시작 화면 DOM·aria·data-에 물건 길이(320)가 없다', () => {
    const { container } = render(<LengthView state={merge()} dispatch={vi.fn()} targetSize={48} />);
    expect(everything(container)).not.toMatch(/\b320\b|3m 20/);
    expect(screen.getByRole('button', { name: '10cm 막대 놓기' })).toBeTruthy();
  });

  it('10개를 놓으면 1m 줄자 조각 하나로 그려지고 막대 눈금이 안에 있다', () => {
    const actions: LengthAction[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'add',
      unit: 'cm-10-rod',
      start: String(i * 10),
    }));
    const { container } = render(
      <LengthView state={merge(...actions)} dispatch={vi.fn()} targetSize={48} />,
    );
    const pieces = container.querySelectorAll('[data-part="piece"]');
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.getAttribute('data-unit')).toBe('m-tape');
    expect(pieces[0]?.getAttribute('aria-label')).toContain('1m 줄자');
    expect(pieces[0]?.querySelector('[data-part="unit-ticks"]')).not.toBeNull();
  });

  it('방향키는 10cm씩 옮긴다', () => {
    const dispatch = vi.fn();
    render(
      <LengthView
        state={merge({ type: 'add', unit: 'cm-10-rod', start: '0' })}
        dispatch={dispatch}
        targetSize={48}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: '1번째 조각, 10cm 막대' }), {
      key: 'ArrowRight',
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'move', index: 0, start: '10' });
  });
});

describe('meter-100 오버레이', () => {
  it('1m 줄자를 100칸으로 펼치고 10칸마다 굵은 선·숫자 10~100과 "1m" 이름표를 단다', () => {
    const { container } = render(<Meter100 canvasSelector="svg" logicalHeight={322} />);
    expect(container.querySelectorAll('[data-part="tick-10"]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-part="tick-1"]')).toHaveLength(90);
    const numbers = [...container.querySelectorAll('[data-part="tick-number"]')].map(
      (node) => node.textContent,
    );
    expect(numbers).toEqual(['10', '20', '30', '40', '50', '60', '70', '80', '90', '100']);
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('1m');
    const thick = Number(
      container.querySelector('[data-part="tick-10"]')?.getAttribute('stroke-width'),
    );
    const thin = Number(
      container.querySelector('[data-part="tick-1"]')?.getAttribute('stroke-width'),
    );
    expect(thick).toBeGreaterThan(thin);
  });
});

describe('unit-train 화면', () => {
  it('두 줄(m 칸·cm 칸)로 그리고 칸 수를 aria로 알린다', () => {
    const { container } = renderTrain(train(addTrain));
    expect(container.querySelectorAll('[data-part="m-cell"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-part="rod"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-part="block"]')).toHaveLength(0);
    expect(container.querySelector('[data-part="m-row"]')?.getAttribute('aria-label')).toBe(
      'm 칸 3개',
    );
    expect(container.querySelector('[data-part="cm-row"]')?.getAttribute('aria-label')).toBe(
      'cm 칸 10cm 막대 12개, 1cm 블록 0개',
    );
    expect(container.querySelector('[data-part="subtrahend"]')).toBeNull();
  });

  it('add에는 [빼기]가 없고 sub에는 있으며 "뺄 길이 b" 표가 보인다', () => {
    const add = renderTrain(train(addTrain));
    expect(screen.queryByRole('button', { name: '빼기' })).toBeNull();
    add.unmount();
    const sub = renderTrain(train(subTrain));
    expect(screen.getByRole('button', { name: '빼기' })).toBeTruthy();
    expect(sub.container.querySelector('[data-part="subtrahend"]')?.textContent).toBe(
      '뺄 길이 2m 60cm',
    );
  });

  it('[1m로 바꾸기]·[10cm 막대로 풀기]·[작게 풀기]·[빼기]·[처음으로]는 Action을 보낸다', () => {
    const dispatch = vi.fn();
    renderTrain(train(subTrain, { type: 'unpack' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1m로 바꾸기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'promote' });
    fireEvent.click(screen.getByRole('button', { name: '10cm 막대로 풀기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'unpack' });
    fireEvent.click(screen.getByRole('button', { name: '1cm 블록으로 풀기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'unpack-small' });
    fireEvent.click(screen.getByRole('button', { name: '빼기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'take-away' });
    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'reset' });
  });

  it('조건이 안 맞으면 보내지 않고 이유를 알린다(칸이 모자라요)', () => {
    const dispatch = vi.fn();
    renderTrain(train(subTrain), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '빼기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toBe('칸이 모자라요.');
    fireEvent.click(screen.getByRole('button', { name: '1m로 바꾸기' }));
    expect(screen.getByTestId('measure-message').textContent).toContain('10개');
  });

  it('칸이 많으면(m 칸 11개 이상) 작은 칸으로 줄여 그리지만 칸 수는 같다', () => {
    const { container } = renderTrain(train({ ...addTrain, a: '9m 90cm', b: '9m 90cm' }));
    expect(container.querySelectorAll('[data-part="m-cell"]')).toHaveLength(18);
    expect(container.querySelectorAll('[data-part="rod"]')).toHaveLength(18);
  });

  it('readOnly이면 단추가 모두 꺼진다', () => {
    renderTrain(train(subTrain), vi.fn(), true);
    for (const name of [
      '1m로 바꾸기',
      '10cm 막대로 풀기',
      '1cm 블록으로 풀기',
      '빼기',
      '처음으로',
    ]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('meter-outline 오버레이', () => {
  it('cm 줄이 100 이상이면 처음 10cm 막대 10개 둘레에 1m 칸 크기 점선 상자와 "1m"을 그린다', () => {
    const { container } = render(<MeterOutlineOverlay config={addTrain} state={train(addTrain)} />);
    const outline = container.querySelector('[data-part="outline"]');
    expect(outline?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('1m');
    // 상자는 1m 칸(정사각형) 크기 + 여유 10px
    expect(Number(outline?.getAttribute('width'))).toBe(Number(outline?.getAttribute('height')));
  });

  it('cm 줄이 100 미만이면 그리지 않는다(승격한 뒤도 포함)', () => {
    expect(
      render(
        <MeterOutlineOverlay config={addTrain} state={train(addTrain, { type: 'promote' })} />,
      ).container.querySelector('svg'),
    ).toBeNull();
    expect(
      render(
        <MeterOutlineOverlay config={addTrain} state={train({ ...addTrain, a: '1m', b: '1m' })} />,
      ).container.querySelector('svg'),
    ).toBeNull();
  });
});
