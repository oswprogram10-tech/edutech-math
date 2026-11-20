/** @vitest-environment jsdom */
/** E19 화면 테스트: 정답(평균) 비노출, 조작·키보드, 예측 잠금, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArmsOverlay } from '../overlays/arms';
import { LevelTryOverlay } from '../overlays/level-try';
import { MeanPullOverlay } from '../overlays/mean-pull';
import { SumTowerOverlay } from '../overlays/sum-tower';
import { createInitialState, reduce } from '../reduce';
import type { ChanceAction, ChanceConfig, ChanceState } from '../types';
import { ChanceView } from '../View';

afterEach(cleanup);

function play(config: ChanceConfig, actions: readonly ChanceAction[] = []): ChanceState {
  return actions.reduce<ChanceState>(reduce, createInitialState(config));
}

function renderState(state: ChanceState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <ChanceView
      config={{}}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
      readOnly={readOnly}
    />,
  );
}

/** 화면 좌표를 담은 data- 속성(숫자 모양이 값과 우연히 겹친다). 수학 값이 아니라 제외한다. */
const POSITION_ATTRIBUTES = new Set(['data-cx', 'data-x', 'data-from', 'data-to', 'data-length']);

/** 글과 data-·aria- 속성값을 모두 모은다(정답이 어디에도 새지 않는지 볼 때 쓴다). */
function everything(container: Element): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (POSITION_ATTRIBUTES.has(attribute.name)) continue;
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('\n');
}

function canvas(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg[data-testid="chance-canvas"]');
  if (!(svg instanceof SVGSVGElement)) throw new Error('canvas 없음');
  return svg;
}

const SAMPLE = [7, 4, 9, 3, 7];

describe('leveling 화면', () => {
  it('시작 화면에는 평균(6)이 기둥 높이 숫자 말고는 어디에도 없다', () => {
    const { container } = renderState(play({ mode: 'leveling', data: SAMPLE }));
    expect(everything(container)).not.toMatch(/6/);
    const heights = [...container.querySelectorAll('[data-part="height"]')].map(
      (t) => t.textContent,
    );
    expect(heights).toEqual(['7', '4', '9', '3', '7']);
    expect(container.querySelectorAll('[data-block]')).toHaveLength(30);
    expect(screen.getAllByText(/번$/).length).toBeGreaterThan(0);
  });

  it('이름과 이름표(label)가 보인다', () => {
    renderState(play({ mode: 'leveling', data: [2, 4], names: ['가', '나'], label: '줄넘기(번)' }));
    expect(screen.getByText('줄넘기(번)')).toBeTruthy();
    expect(screen.getByText('가')).toBeTruthy();
  });

  it('단추로 기둥을 고르고 집어서 놓으면 move를 보낸다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'leveling', data: SAMPLE }), dispatch);
    // 첫 기둥(7) 집기 → 오른쪽 기둥(4)으로 → 놓기. 단추는 상태가 바뀌어 다시 그려지지 않으므로
    // 지역 상태(cursor·holding)만 확인한다.
    fireEvent.click(screen.getByRole('button', { name: '맨 위 블록 집기' }));
    expect(screen.getByRole('button', { name: '여기에 놓기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '오른쪽 기둥 고르기' }));
    fireEvent.click(screen.getByRole('button', { name: '여기에 놓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'move', from: 0, to: 1 });
  });

  it('키보드: ←→ Enter Enter로 옮기고 Esc로 취소한다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play({ mode: 'leveling', data: SAMPLE }), dispatch);
    const svg = canvas(container);
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: 'Enter' });
    expect(svg.getAttribute('data-holding')).toBe('2');
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(svg.getAttribute('data-holding')).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.keyDown(svg, { key: 'Enter' });
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    fireEvent.keyDown(svg, { key: ' ' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'move', from: 2, to: 1 });
  });

  it('거절은 이유를 글로 알린다(같은 기둥·빈 기둥)', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play({ mode: 'leveling', data: [0, 4] }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '맨 위 블록 집기' }));
    expect(screen.getByTestId('chance-message').textContent).toBe('옮길 블록이 없어요.');
    fireEvent.keyDown(canvas(container), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: '맨 위 블록 집기' }));
    fireEvent.click(screen.getByRole('button', { name: '여기에 놓기' }));
    expect(screen.getByTestId('chance-message').textContent).toBe('다른 기둥에 놓아 주세요.');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('읽기 전용이면 단추가 꺼지고 키보드가 듣지 않는다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play({ mode: 'leveling', data: SAMPLE }), dispatch, true);
    expect(screen.getByRole('button', { name: '맨 위 블록 집기' }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.keyDown(canvas(container), { key: 'Enter' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('설정 오류는 오류 문구만 보인다', () => {
    const { container } = renderState(play({ mode: 'leveling', data: [1, 2] }));
    expect(screen.getByTestId('chance-error')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('seesaw 화면', () => {
  it('기울기 글과 받침점 위치 숫자, 평균 글자는 없다', () => {
    const state = play({ mode: 'seesaw', data: SAMPLE, step: '1/2' }, [
      { type: 'set-fulcrum', value: '11/2' },
    ]);
    const { container } = renderState(state);
    expect(screen.getByTestId('chance-tilt').textContent).toBe('오른쪽으로 기울어요');
    expect(container.querySelector('[data-part="fulcrum-value"]')?.textContent).toBe('받침점 5.5');
    expect(everything(container)).not.toContain('평균');
    expect(container.querySelectorAll('[data-part="weight"]')).toHaveLength(5);
    expect(canvas(container).getAttribute('data-tilt')).toBe('right');
  });

  it('수평이면 각도 0, 기울면 4°~12°', () => {
    const level = renderState(
      play({ mode: 'seesaw', data: SAMPLE }, [{ type: 'set-fulcrum', value: '6' }]),
    );
    expect(screen.getByTestId('chance-tilt').textContent).toBe('수평이에요');
    expect(
      level.container.querySelector('[data-part="plank-group"]')?.getAttribute('data-angle'),
    ).toBe('0.00');
    cleanup();
    const tilted = renderState(
      play({ mode: 'seesaw', data: SAMPLE }, [{ type: 'set-fulcrum', value: '7' }]),
    );
    const angle = Number(
      tilted.container.querySelector('[data-part="plank-group"]')?.getAttribute('data-angle'),
    );
    expect(angle).toBeLessThanOrEqual(-4);
    expect(angle).toBeGreaterThanOrEqual(-12);
    expect(screen.getByTestId('chance-tilt').textContent).toBe('왼쪽으로 기울어요');
  });

  it('최대 기울기 12°: 받침점이 끝이고 모든 추가 반대쪽 끝일 때', () => {
    const { container } = renderState(play({ mode: 'seesaw', data: [10, 10], min: 0, max: 10 }));
    const angle = Number(
      container.querySelector('[data-part="plank-group"]')?.getAttribute('data-angle'),
    );
    expect(angle).toBe(12);
  });

  it('받침점 슬라이더: ←→는 step씩, 끝에서는 안내 글', () => {
    const dispatch = vi.fn();
    const { container } = renderState(
      play({ mode: 'seesaw', data: SAMPLE, step: '1/2' }),
      dispatch,
    );
    const handle = container.querySelector('[role="slider"]');
    if (!handle) throw new Error('slider 없음');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-fulcrum', value: '5/2' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(screen.getByTestId('chance-message').textContent).toBe('더 갈 수 없어요.');
    fireEvent.click(screen.getByRole('button', { name: '받침점 오른쪽으로' }));
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});

describe('outlier 화면', () => {
  const config: ChanceConfig = { mode: 'outlier', data: SAMPLE, dragIndex: 4, predict: true };

  it('예측 전에는 평균선·처음 평균·평균 글자가 없다', () => {
    const { container } = renderState(play(config));
    expect(container.querySelector('[data-part="mean-line"]')).toBeNull();
    expect(container.querySelector('[data-part="initial-mean"]')).toBeNull();
    // 안내 글(조작 칸)의 '평균'은 개념 이름이다. 판 안에는 평균 이름표·값이 없어야 한다.
    expect(everything(canvas(container))).not.toContain('평균');
    expect(canvas(container).getAttribute('data-locked')).toBe('true');
    expect(container.querySelector('[data-part="drag-hint"]')?.textContent).toBe('끌 수 있어요');
    expect(container.querySelector('[data-part="drag-point"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('키패드로 예측을 쓰고 [예측하기]를 누르면 predict를 보낸다', () => {
    const dispatch = vi.fn();
    renderState(play(config), dispatch);
    for (const key of ['1', '0', '.', '6'])
      fireEvent.click(screen.getByRole('button', { name: key }));
    expect(screen.getByTestId('chance-draft').textContent).toBe('10.6');
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(screen.getByTestId('chance-draft').textContent).toBe('10.');
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '예측하기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'predict', value: '10.6' });
  });

  it('자판으로도 쓴다: 숫자·/·Backspace·Enter', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play(config), dispatch);
    const wrap = container.firstElementChild as HTMLElement;
    for (const key of ['5', '3', '/', '5']) fireEvent.keyDown(wrap, { key });
    fireEvent.keyDown(wrap, { key: 'Backspace' });
    fireEvent.keyDown(wrap, { key: '5' });
    expect(screen.getByTestId('chance-draft').textContent).toBe('53/5');
    fireEvent.keyDown(wrap, { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'predict', value: '53/5' });
  });

  it('잘못된 예측은 거절하고 안내한다', () => {
    const dispatch = vi.fn();
    renderState(play(config), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '예측하기' }));
    expect(screen.getByTestId('chance-message').textContent).toBe(
      '예측을 숫자(소수·분수)로 써 주세요.',
    );
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '예측하기' }));
    expect(screen.getByTestId('chance-message').textContent).toBe(
      '수직선 범위 안의 수로 써 주세요.',
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('예측 전 값 바꾸기는 막고 이유를 알린다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play(config), dispatch);
    const handle = container.querySelector('[role="slider"]');
    if (!handle) throw new Error('slider 없음');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(screen.getByTestId('chance-message').textContent).toBe('먼저 예측해 보세요.');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('예측을 잠그면 평균선과 내 예측 표시가 생기고 값 글은 대분수와 소수', () => {
    const state = play(config, [
      { type: 'predict', value: '10.6' },
      { type: 'set-value', value: 30 },
    ]);
    const { container } = renderState(state);
    expect(container.querySelector('[data-part="mean-label"]')?.textContent).toBe(
      '평균 10과 3/5 (10.6)',
    );
    expect(container.querySelector('[data-part="initial-mean"]')).not.toBeNull();
    expect(container.querySelector('[data-part="prediction"]')?.textContent).toContain('내 예측');
    expect(screen.queryByTestId('chance-draft')).toBeNull();
    const meanX = Number(
      container.querySelector('[data-part="mean-line"]')?.getAttribute('data-x'),
    );
    const initialX = Number(
      container.querySelector('[data-part="initial-mean"]')?.getAttribute('data-x'),
    );
    expect(meanX).toBeGreaterThan(initialX);
  });

  it('predict가 꺼진 설정은 처음부터 평균선이 있다', () => {
    const { container } = renderState(play({ ...config, predict: false } as ChanceConfig));
    expect(container.querySelector('[data-part="mean-line"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '예측하기' })).toBeNull();
    expect(container.querySelector('[data-part="mean-label"]')?.textContent).toBe('평균 6');
  });

  it('유한소수가 아닌 평균은 대분수만 쓴다', () => {
    const { container } = renderState(
      play({ mode: 'outlier', data: [1, 1, 2], dragIndex: 2, predict: false }),
    );
    expect(container.querySelector('[data-part="mean-label"]')?.textContent).toBe('평균 1과 1/3');
  });
});

describe('오버레이', () => {
  const props = (state: ChanceState, args?: unknown) => ({
    config: {} as ChanceConfig,
    state,
    args,
  });

  it('level-try: value가 없으면 그리지 않는다', () => {
    const state = play({ mode: 'leveling', data: SAMPLE });
    const { container } = render(<LevelTryOverlay {...props(state)} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('level-try: 남는 블록은 빗금, 모자란 칸은 점선 빈 칸, 개수 글', () => {
    const state = play({ mode: 'leveling', data: SAMPLE });
    const { container } = render(<LevelTryOverlay {...props(state, { value: 5 })} />);
    // 7,4,9,3,7에서 5 위: 2+0+4+0+2 = 8, 모자람: 0+1+0+2+0 = 3
    expect(container.querySelectorAll('[data-part="extra"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-part="lack"]')).toHaveLength(3);
    expect(container.querySelector('[data-part="counts"]')?.textContent).toBe(
      '남는 블록 8개 / 모자란 칸 3개',
    );
    expect(container.querySelector('[data-part="level-line"]')).not.toBeNull();
  });

  it('level-try: 경계 높이 0과 maxHeight, 범위 밖은 그리지 않는다', () => {
    const state = play({ mode: 'leveling', data: [2, 4] });
    const zero = render(<LevelTryOverlay {...props(state, { value: 0 })} />);
    expect(zero.container.querySelectorAll('[data-part="extra"]')).toHaveLength(6);
    expect(zero.container.querySelectorAll('[data-part="lack"]')).toHaveLength(0);
    cleanup();
    const out = render(<LevelTryOverlay {...props(state, { value: 7 })} />);
    expect(out.container.querySelector('svg')).toBeNull();
    cleanup();
    const odd = render(<LevelTryOverlay {...props(state, { value: '5/2' })} />);
    expect(odd.container.querySelector('svg')).toBeNull();
  });

  it('sum-tower: 탑 블록 수는 모든 블록, 빈 자리는 기둥 수, 숫자 글 없음', () => {
    const state = play({ mode: 'leveling', data: SAMPLE });
    const { container } = render(<SumTowerOverlay {...props(state)} />);
    expect(container.querySelectorAll('[data-part="tower-block"]')).toHaveLength(30);
    expect(container.querySelectorAll('[data-part="empty-slot"]')).toHaveLength(5);
    expect(container.querySelector('[data-part="tower-label"]')?.textContent).toBe(
      '모두 합친 기둥',
    );
    expect(container.textContent).toBe('모두 합친 기둥');
  });

  it('arms: 왼쪽·오른쪽 막대와 두 줄 합계, 길이 글은 없다', () => {
    const state = play({ mode: 'seesaw', data: SAMPLE }, [{ type: 'set-fulcrum', value: '6' }]);
    const { container } = render(<ArmsOverlay {...props(state)} />);
    expect(container.querySelectorAll('[data-part="arm-left"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="arm-right"]')).toHaveLength(3);
    const left = Number(
      container.querySelector('[data-part="sum-left"]')?.getAttribute('data-length'),
    );
    const right = Number(
      container.querySelector('[data-part="sum-right"]')?.getAttribute('data-length'),
    );
    // 평균 6에서는 왼쪽 거리 합(2+3=5 … 6−4, 6−3)과 오른쪽 거리 합(1+3+1=5)이 같다.
    expect(left).toBeGreaterThan(0);
    expect(left).toBeCloseTo(right, 5);
    expect(container.textContent).toBe('왼쪽 합오른쪽 합');
  });

  it('arms: 기울어 있으면 두 줄 길이가 다르고, 거리 0인 추는 막대가 없다', () => {
    const state = play({ mode: 'seesaw', data: [3, 5, 5] }, [{ type: 'set-fulcrum', value: '5' }]);
    const { container } = render(<ArmsOverlay {...props(state)} />);
    expect(container.querySelectorAll('[data-part="arm-right"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-part="arm-left"]')).toHaveLength(1);
    expect(
      Number(container.querySelector('[data-part="sum-right"]')?.getAttribute('data-length')),
    ).toBe(0);
  });

  it('mean-pull: 점을 끌기 전에는 없고, 끈 뒤에는 화살표 둘과 값 없는 글', () => {
    const config: ChanceConfig = { mode: 'outlier', data: SAMPLE, dragIndex: 4, predict: true };
    const before = render(
      <MeanPullOverlay {...props(play(config, [{ type: 'predict', value: '6' }]))} />,
    );
    expect(before.container.querySelector('svg')).toBeNull();
    cleanup();
    const locked = play(config);
    expect(
      render(<MeanPullOverlay {...props(locked)} />).container.querySelector('svg'),
    ).toBeNull();
    cleanup();
    const moved = play(config, [
      { type: 'predict', value: '6' },
      { type: 'set-value', value: 30 },
    ]);
    const { container } = render(<MeanPullOverlay {...props(moved)} />);
    expect(container.querySelector('[data-part="point-arrow"]')).not.toBeNull();
    expect(container.querySelector('[data-part="mean-arrow"]')).not.toBeNull();
    expect(container.textContent).toBe('점이 움직인 거리평균이 움직인 거리');
    // 점은 오른쪽으로 끌려 갔으므로 점 화살표는 왼쪽(처음 자리)을 향한다.
    const point = container.querySelector('[data-part="point-arrow"]');
    expect(Number(point?.getAttribute('data-to'))).toBeLessThan(
      Number(point?.getAttribute('data-from')),
    );
    const mean = container.querySelector('[data-part="mean-arrow"]');
    expect(Number(mean?.getAttribute('data-to'))).toBeGreaterThan(
      Number(mean?.getAttribute('data-from')),
    );
  });
});
