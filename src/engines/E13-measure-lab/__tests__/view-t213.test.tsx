/** @vitest-environment jsdom */
/** E13 T213 화면 테스트: capacity·weight 정답(물의 양·무게) 비노출, 조작 단추, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapacityView } from '../capacity/CapacityView';
import { LiterCupsOverlay } from '../capacity/overlays/liter-cups';
import { MlMergeOverlay } from '../capacity/overlays/ml-merge';
import { SameBeakerOverlay } from '../capacity/overlays/same-beaker';
import { createCapacityState, reduceCapacity } from '../capacity/reduce';
import type { CapacityAction, CapacityConfig, CapacityState } from '../capacity/types';
import { SizeWeightBarsOverlay } from '../weight/overlays/size-weight-bars';
import { createWeightState, reduceWeight } from '../weight/reduce';
import type { WeightAction, WeightConfig, WeightState } from '../weight/types';
import { WeightView } from '../weight/WeightView';

afterEach(cleanup);

const cups: CapacityConfig = { mode: 'capacity' };
const puzzle: CapacityConfig = { mode: 'capacity', variant: 'puzzle' };
const weightConfig: WeightConfig = { mode: 'weight' };
/** 샌드박스 기본과 같은 물건(설정에 직접 쓸 때). */
const objects: WeightConfig['objects'] = [
  { id: 'beachball', kind: 'beachball', g: 200, visualSize: 'large' },
  { id: 'iron-ball', kind: 'iron-ball', g: 700, visualSize: 'small' },
  { id: 'book', kind: 'book', g: 450 },
];
const full: WeightConfig = {
  mode: 'weight',
  tools: ['pan-balance', 'spring-scale'],
  objects,
  unitObjects: { clip: 50 },
};

function capacity(config: CapacityConfig, ...actions: CapacityAction[]): CapacityState {
  return actions.reduce(reduceCapacity, createCapacityState(config));
}
function weight(config: WeightConfig, ...actions: WeightAction[]): WeightState {
  return actions.reduce(reduceWeight, createWeightState(config));
}

function renderCapacity(state: CapacityState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <CapacityView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}
function renderWeight(state: WeightState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <WeightView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

/** 글과 data-·aria- 속성값을 모두 모은다(결과가 어디에도 새지 않는지 볼 때 쓴다). 건너뛸 칸을 줄 수 있다. */
function everything(container: Element, skip?: string): string {
  const root = container.cloneNode(true) as Element;
  if (skip !== undefined) root.querySelectorAll(skip).forEach((node) => node.remove());
  const parts: string[] = [root.textContent ?? ''];
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

describe('capacity 화면', () => {
  it('cup-count: 들이(600·500)·컵 한 번의 양(100)이 글·data-·aria-에 없다', () => {
    const { container } = renderCapacity(capacity(cups));
    expect(everything(container)).not.toMatch(/\b(600|500|100)\b|mL|ml/);
  });

  it('cup-count: 붓는 중에도 물의 양 대신 학생이 센 컵 횟수만 보인다', () => {
    const state = capacity(
      cups,
      { type: 'pour-cup', id: 'bottle' },
      { type: 'pour-cup', id: 'bottle' },
    );
    const { container } = renderCapacity(state);
    expect(everything(container)).not.toMatch(/\b(600|500|200|100)\b|mL|ml/);
    const counts = [...container.querySelectorAll('[data-part="cup-count"]')].map(
      (n) => n.textContent,
    );
    expect(counts).toEqual(['컵 2번', '컵 0번']);
  });

  it('puzzle: 비커 들이(300·500)·목표(100)·물의 양이 어디에도 없다', () => {
    const state = capacity(
      puzzle,
      { type: 'fill', id: 'beaker-a' },
      { type: 'pour', from: 'beaker-a', to: 'beaker-b' },
    );
    const { container } = renderCapacity(state);
    expect(everything(container)).not.toMatch(/\b(300|500|100|200)\b|mL|ml/);
    // 물 높이는 그림(scaleY)으로만 보인다.
    const water = [...container.querySelectorAll('[data-part="water"]')];
    expect(water).toHaveLength(2);
  });

  it('cup-count 단추: 그릇마다 [컵으로 붓기]·[비우기], [처음으로]가 Action을 보낸다', () => {
    const dispatch = vi.fn();
    renderCapacity(capacity(cups), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '병 컵으로 붓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'pour-cup', id: 'bottle' });
    fireEvent.click(screen.getByRole('button', { name: '그릇 컵으로 붓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'pour-cup', id: 'bowl' });
    // 이미 빈 그릇의 [비우기]는 Action 없이 이유만 알린다.
    dispatch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '병 비우기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('이미 비었어요');
  });

  it('cup-count: 가득 찬 그릇에 또 부으면 거절 글을 보이고 Action을 보내지 않는다', () => {
    const state = capacity(
      { ...cups, containers: [{ id: 'a', capacityMl: 100 }], cupMl: 100 },
      { type: 'pour-cup', id: 'a' },
    );
    const dispatch = vi.fn();
    renderCapacity(state, dispatch);
    fireEvent.click(screen.getByRole('button', { name: '비커 컵으로 붓기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('가득');
  });

  it('puzzle 단추: [채우기]·[비우기]·[다른 비커로 붓기]가 Action을 보낸다(쉬운 말 이름)', () => {
    const dispatch = vi.fn();
    renderCapacity(capacity(puzzle, { type: 'fill', id: 'beaker-a' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '비커 나 채우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'fill', id: 'beaker-b' });
    fireEvent.click(screen.getByRole('button', { name: '비커 가의 물을 비커 나에 붓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'pour', from: 'beaker-a', to: 'beaker-b' });
    fireEvent.click(screen.getByRole('button', { name: '비커 가 비우기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'empty', id: 'beaker-a' });
  });

  it('puzzle: 수도꼭지·개수대와 비커 둘, 읽기 전용이면 단추가 꺼진다', () => {
    const { container } = renderCapacity(capacity(puzzle), vi.fn(), true);
    expect(container.querySelector('[data-part="faucet"]')).not.toBeNull();
    expect(container.querySelector('[data-part="sink"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-part="beaker"]')).toHaveLength(2);
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderCapacity(capacity({ ...cups, cupMl: 0 }));
    expect(screen.getByTestId('measure-error')).not.toBeNull();
  });
});

describe('capacity 오버레이', () => {
  it('same-beaker: 두 그릇 아래 점선 윤곽 둘과 두 줄 글, 수위는 없다', () => {
    const state = capacity(cups, { type: 'pour-cup', id: 'bottle' });
    const { container } = render(<SameBeakerOverlay config={cups} state={state} />);
    expect(container.querySelectorAll('[data-part="beaker-outline"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="arrow"]')).toHaveLength(2);
    expect(container.querySelector('[data-part="water"]')).toBeNull();
    expect(container.textContent).toContain('같은 모양 비커에');
    expect(container.textContent).toContain('옮겨 담으면?');
  });

  it('same-beaker: 그릇이 하나면 그리지 않는다', () => {
    const one: CapacityConfig = { ...cups, containers: [{ id: 'a', capacityMl: 300 }] };
    const { container } = render(<SameBeakerOverlay config={one} state={capacity(one)} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('liter-cups: 1L 병 하나와 100mL 컵 열 개와 고정 글', () => {
    const { container } = render(<LiterCupsOverlay config={cups} state={capacity(cups)} />);
    expect(container.querySelectorAll('[data-part="cup"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-part="liter-bottle"]')).toHaveLength(1);
    expect(container.textContent).toContain('1L = 100mL 컵 10번 = 1000mL');
  });

  it('ml-merge: 100칸 묶음 열 개와 화살표 하나와 1L 병 하나', () => {
    const { container } = render(<MlMergeOverlay config={cups} state={capacity(cups)} />);
    expect(container.querySelectorAll('[data-part="ml-group"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-part="arrow"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="liter-bottle"]')).toHaveLength(1);
    expect(container.textContent).toContain('1L = 1000mL');
  });

  it('오류 상태에서는 그리지 않는다', () => {
    const bad: CapacityConfig = { ...cups, cupMl: 0 };
    const { container } = render(<LiterCupsOverlay config={bad} state={capacity(bad)} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('weight 화면', () => {
  it('물건 g(200·700·450·150)·클립 g(50)가 물건·단추·선반 글, data-, aria-에 없다(눈금 숫자는 예외)', () => {
    const state = weight(
      weightConfig,
      { type: 'place', id: 'beachball', pan: 'left' },
      { type: 'place', id: 'iron-ball', pan: 'right' },
      { type: 'hang', id: 'book' },
    );
    const { container } = renderWeight(state);
    expect(everything(container, '[data-part="spring-ticks"]')).not.toMatch(
      /\b(200|700|450|150|50)\b/,
    );
    // 눈금 숫자는 0~1000을 100마다 쓴다.
    const numerals = [...container.querySelectorAll('[data-part="spring-ticks"] text')]
      .map((t) => t.textContent)
      .filter((t) => t !== 'g');
    expect(numerals).toEqual([
      '0',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
      '1000',
    ]);
  });

  it('용수철저울: 10g마다 작은 눈금, 100g마다 숫자(springMaxG 500이면 눈금 51개)', () => {
    const state = weight({
      ...full,
      tools: ['spring-scale'],
      unitObjects: undefined,
      springMaxG: 500,
      objects: [{ id: 'a', kind: 'book', g: 100 }],
    } as WeightConfig);
    const { container } = renderWeight(state);
    const ticks = container.querySelectorAll('[data-part="tick"]');
    expect(ticks).toHaveLength(51);
    expect(container.querySelectorAll('[data-part="tick"][data-kind="hundred"]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-part="tick"][data-kind="half"]')).toHaveLength(5);
  });

  it('윗접시저울: 기울기 글(왼쪽이 더 무거워요)과 data-tilt가 있고 g는 없다', () => {
    const state = weight(
      weightConfig,
      { type: 'place', id: 'iron-ball', pan: 'left' },
      { type: 'place', id: 'beachball', pan: 'right' },
    );
    const { container } = renderWeight(state);
    expect(screen.getByTestId('weight-result').textContent).toBe('왼쪽이 더 무거워요');
    expect(
      container.querySelector('[data-testid="weight-canvas"]')?.getAttribute('data-tilt'),
    ).toBe('left');
  });

  it('한쪽만 올리면 결과 글이 비어 있다', () => {
    renderWeight(weight(weightConfig, { type: 'place', id: 'iron-ball', pan: 'left' }));
    expect(screen.getByTestId('weight-result').textContent).toBe('');
  });

  it('물건을 고르고 [왼쪽 접시에 놓기]를 누르면 place를, [용수철저울에 걸기]는 hang을 보낸다', () => {
    const dispatch = vi.fn();
    renderWeight(weight(weightConfig), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '왼쪽 접시에 놓기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('물건을 골라');
    fireEvent.click(screen.getByRole('button', { name: '책' }));
    fireEvent.click(screen.getByRole('button', { name: '왼쪽 접시에 놓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', id: 'book', pan: 'left' });
    fireEvent.click(screen.getByRole('button', { name: '용수철저울에 걸기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'hang', id: 'book' });
    fireEvent.click(screen.getByRole('button', { name: '클립 하나 더' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'clip', delta: 1 });
  });

  it('판의 물건에서 Enter로 고를 수 있다(키보드)', () => {
    const dispatch = vi.fn();
    renderWeight(weight(weightConfig), dispatch);
    const item = screen.getByRole('button', { name: /^책\. Enter로/ });
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(screen.getByRole('button', { name: '책', pressed: true })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '오른쪽 접시에 놓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', id: 'book', pan: 'right' });
  });

  it('클립 수는 학생 행동이라 "클립 n개"로 보인다', () => {
    const state = weight(weightConfig, { type: 'clip', delta: 1 }, { type: 'clip', delta: 1 });
    const { container } = renderWeight(state);
    expect(container.querySelector('[data-part="clip-count"]')?.textContent).toBe('클립 2개');
    expect(container.querySelectorAll('[data-part="clip"]')).toHaveLength(2);
  });

  it('예측: 예측하기 전에는 물건 단추와 [예측하기]만 있고, 누르면 predict를 보낸다', () => {
    const dispatch = vi.fn();
    const state = weight({ ...full, predict: true });
    renderWeight(state, dispatch);
    expect(screen.queryByRole('button', { name: '왼쪽 접시에 놓기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '예측하기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('예측할 물건');
    fireEvent.click(screen.getByRole('button', { name: '쇠구슬' }));
    fireEvent.click(screen.getByRole('button', { name: '예측하기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'predict', id: 'iron-ball' });
  });

  it('예측한 뒤에는 놓을 곳 단추가 열리고 "내 예측"이 보인다', () => {
    const state = weight({ ...full, predict: true }, { type: 'predict', id: 'iron-ball' });
    renderWeight(state);
    expect(screen.getByTestId('weight-prediction').textContent).toBe('내 예측: 쇠구슬');
    expect(screen.getByRole('button', { name: '왼쪽 접시에 놓기' })).not.toBeNull();
  });

  it('저울이 하나만 있으면 그 저울 단추만 있다', () => {
    renderWeight(weight({ ...full, tools: ['spring-scale'], unitObjects: undefined }));
    expect(screen.queryByRole('button', { name: '왼쪽 접시에 놓기' })).toBeNull();
    expect(screen.getByRole('button', { name: '용수철저울에 걸기' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '클립 하나 더' })).toBeNull();
  });

  it('읽기 전용이면 단추가 꺼지고 물건 선택 Enter도 막는다', () => {
    renderWeight(weight(weightConfig), vi.fn(), true);
    for (const button of screen.getAllByRole('button')) {
      if (button.tagName === 'BUTTON') expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderWeight(weight({ ...full, tools: [] }));
    expect(screen.getByTestId('measure-error')).not.toBeNull();
  });
});

describe('weight 오버레이 size-weight-bars', () => {
  it('두 접시에 물건이 하나씩 있으면 크기 막대 둘과 무게 막대 둘을 그리고 숫자는 없다', () => {
    const state = weight(
      weightConfig,
      { type: 'place', id: 'beachball', pan: 'left' },
      { type: 'place', id: 'iron-ball', pan: 'right' },
    );
    const { container } = render(<SizeWeightBarsOverlay config={weightConfig} state={state} />);
    expect(container.querySelectorAll('[data-bar^="size-"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-bar^="weight-"]')).toHaveLength(2);
    const width = (selector: string) =>
      Number(container.querySelector(selector)?.getAttribute('width'));
    // 비치볼이 쇠구슬보다 크고(크기 막대), 쇠구슬이 더 무겁다(무게 막대).
    expect(width('[data-bar="size-left"]')).toBeGreaterThan(width('[data-bar="size-right"]'));
    expect(width('[data-bar="weight-right"]')).toBeGreaterThan(width('[data-bar="weight-left"]'));
    expect(container.textContent).toContain('크기');
    expect(container.textContent).toContain('무게');
    expect(container.textContent ?? '').not.toMatch(/\d/);
  });

  it('접시에 물건이 하나뿐이면 그리지 않는다', () => {
    const state = weight(weightConfig, { type: 'place', id: 'beachball', pan: 'left' });
    const { container } = render(<SizeWeightBarsOverlay config={weightConfig} state={state} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('용수철저울만 있는 설정에서는 그리지 않는다', () => {
    const config = { ...full, tools: ['spring-scale' as const], unitObjects: undefined };
    const { container } = render(<SizeWeightBarsOverlay config={config} state={weight(config)} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
