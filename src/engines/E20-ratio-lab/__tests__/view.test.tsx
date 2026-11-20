/** @vitest-environment jsdom */
/** E20 화면 테스트: 이름표·띠 표시 모양·data-* 상태, 정답 비노출, 조작·단축키. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrowthArrowsOverlay } from '../overlays/growth-arrows';
import { RatioGridOverlay } from '../overlays/ratio-grid';
import { SideBySideOverlay } from '../overlays/side-by-side';
import { UnitGroupsOverlay } from '../overlays/unit-groups';
import { createInitialState, reduce } from '../reduce';
import { shortcutsOf } from '../shortcuts';
import type { RatioAction, RatioConfig, RatioState } from '../types';
import { RatioView } from '../View';

afterEach(cleanup);

function play(config: RatioConfig, actions: readonly RatioAction[] = []): RatioState {
  return actions.reduce<RatioState>(reduce, createInitialState(config));
}

function renderState(state: RatioState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <RatioView
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

function canvas(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg[data-testid="ratio-canvas"]');
  if (!(svg instanceof SVGSVGElement)) throw new Error('canvas 없음');
  return svg;
}

function everything(container: HTMLElement): string {
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

const add = (ingredient: 'milk' | 'syrup', n = 1): RatioAction => ({ type: 'add', ingredient, n });
const repeat = (action: RatioAction, times: number): RatioAction[] =>
  Array.from({ length: times }, () => action);

describe('mix 화면', () => {
  it('학생 컵 이름과 양, 기준 컵 이름이 보인다', () => {
    const state = play({ mode: 'mix' }, [...repeat(add('milk'), 8), ...repeat(add('syrup'), 2)]);
    const { container } = renderState(state);
    expect(screen.getAllByText('내 컵').length).toBeGreaterThan(0);
    expect(screen.getAllByText('기준 컵').length).toBeGreaterThan(0);
    expect(screen.getByText('우유 8, 시럽 2')).toBeTruthy();
    expect(screen.getByText('우유 4, 시럽 1')).toBeTruthy();
    expect(canvas(container).getAttribute('data-cup-milk')).toBe('8');
    expect(canvas(container).getAttribute('data-cup-syrup')).toBe('2');
  });

  it('블록 개수가 양과 같고 시럽 블록은 점 무늬 층이 있다', () => {
    const state = play({ mode: 'mix', reference: null }, [
      ...repeat(add('milk'), 3),
      ...repeat(add('syrup'), 2),
    ]);
    const { container } = renderState(state);
    expect(container.querySelectorAll('[data-block="milk"]')).toHaveLength(3);
    const syrup = container.querySelectorAll('[data-block="syrup"]');
    expect(syrup).toHaveLength(2);
    expect(syrup[0]?.querySelectorAll('rect[fill^="url(#"]')).toHaveLength(1);
  });

  it('띠 위 표시는 모양이 다르다: 기준 세모, 내 컵 동그라미, 비교 컵 네모', () => {
    const state = play(
      {
        mode: 'mix',
        fixedCups: [{ id: 'a', label: '가', milk: 3, syrup: 1 }],
      },
      [add('milk'), add('milk'), add('milk'), add('syrup')],
    );
    const { container } = renderState(state);
    const reference = container.querySelector('[data-marker="reference"]');
    const mine = container.querySelector('[data-marker="cup"]');
    const fixed = container.querySelector('[data-marker="fixed"]');
    expect(reference?.querySelector('polygon')).not.toBeNull();
    expect(mine?.querySelector('circle')).not.toBeNull();
    expect(fixed?.querySelector('rect')).not.toBeNull();
    expect(fixed?.textContent).toBe('가');
    expect(mine?.textContent).toBe('내 컵');
  });

  it('빈 컵은 띠에 표시하지 않는다', () => {
    const { container } = renderState(play({ mode: 'mix' }));
    expect(container.querySelector('[data-marker="cup"]')).toBeNull();
    expect(container.querySelector('[data-marker="reference"]')).not.toBeNull();
  });

  it('같은 비는 같은 띠 위치, 다른 비는 다른 위치와 다른 갈색 단계', () => {
    const marker = (actions: readonly RatioAction[]) => {
      const { container } = renderState(play({ mode: 'mix' }, actions));
      const el = container.querySelector('[data-marker="cup"]');
      const ref = container.querySelector('[data-marker="reference"]');
      cleanup();
      return { x: el?.getAttribute('data-x'), refX: ref?.getAttribute('data-x') };
    };
    const same = marker([...repeat(add('milk'), 4), add('syrup'), { type: 'scale', k: 2 }]);
    expect(same.x).toBe(same.refX);
    const other = marker([...repeat(add('milk'), 5), ...repeat(add('syrup'), 2)]);
    expect(other.x).not.toBe(other.refX);
  });

  it('학생 컵이 띠 범위를 넘으면 오른쪽 끝에 두고 "▶ 더 진해요"로 구별한다', () => {
    const state = play({ mode: 'mix', stripMax: 0.3 }, [
      ...repeat(add('milk'), 1),
      ...repeat(add('syrup'), 3),
    ]);
    const { container } = renderState(state);
    const mine = container.querySelector('[data-marker="cup"]');
    expect(mine?.getAttribute('data-overflow')).toBe('true');
    expect(Number(mine?.getAttribute('data-x'))).toBe(920);
    expect(mine?.textContent).toBe('내 컵 ▶ 더 진해요');
    expect(
      container.querySelector('[data-marker="reference"]')?.getAttribute('data-overflow'),
    ).toBeNull();
  });

  it('띠 범위 끝(stripMax와 같은 진하기)은 넘침이 아니다', () => {
    const state = play({ mode: 'mix', stripMax: 0.5 }, [add('milk'), add('syrup')]);
    const { container } = renderState(state);
    expect(
      container.querySelector('[data-marker="cup"]')?.getAttribute('data-overflow'),
    ).toBeNull();
    expect(Number(container.querySelector('[data-marker="cup"]')?.getAttribute('data-x'))).toBe(
      920,
    );
  });

  it('컵 안에 실제 진하기 색이 칠해진다: 같은 비는 같은 색, 다른 비는 다른 색(띠 범위와 무관)', () => {
    const color = (stripMax: number, milk: number, syrup: number) => {
      const state = play({ mode: 'mix', stripMax }, [
        ...repeat(add('milk'), milk),
        ...repeat(add('syrup'), syrup),
      ]);
      const { container } = renderState(state);
      const value = container
        .querySelector('[data-cup="cup"] [data-part="mixed-color"]')
        ?.getAttribute('data-color');
      cleanup();
      return value;
    };
    expect(color(0.5, 4, 1)).toBe(color(0.9, 8, 2));
    expect(color(0.5, 4, 1)).not.toBe(color(0.5, 1, 1));
    expect(color(0.5, 0, 0)).toBeUndefined();
  });

  it('strip·ratio look은 글 옆에 같은 색 견본이 있다', () => {
    for (const look of ['strip', 'ratio'] as const) {
      const state = play({ mode: 'mix', look }, [add('milk'), add('syrup')]);
      const { container } = renderState(state);
      const swatch = container.querySelector('[data-cup="cup"] [data-part="swatch"]');
      expect(swatch?.getAttribute('data-color')).toMatch(/^#[0-9a-f]{6}$/);
      cleanup();
    }
  });

  it('showStrip:false면 띠가 없다', () => {
    const { container } = renderState(play({ mode: 'mix', showStrip: false }, [add('milk')]));
    expect(container.querySelector('[data-part="strip"]')).toBeNull();
  });

  it('ratio look은 컵·블록 없이 글자와 띠만', () => {
    const state = play({ mode: 'mix', look: 'ratio' }, [add('milk'), add('syrup')]);
    const { container } = renderState(state);
    expect(container.querySelectorAll('[data-block]')).toHaveLength(0);
    expect(container.querySelector('polygon[stroke="#4b566b"]')).toBeNull();
    expect(screen.getByText('우유 1 : 시럽 1')).toBeTruthy();
    expect(screen.getByText('우유 4 : 시럽 1')).toBeTruthy();
    expect(container.querySelector('[data-part="strip"]')).not.toBeNull();
  });

  it('strip look은 한 줄 띠 블록', () => {
    const state = play({ mode: 'mix', look: 'strip' }, [...repeat(add('milk'), 2), add('syrup')]);
    const { container } = renderState(state);
    expect(container.querySelectorAll('[data-cup="cup"] [data-block]')).toHaveLength(3);
  });

  it('목표 값(8·2 같은 정답)을 DOM에 쓰지 않는다', () => {
    const { container } = renderState(play({ mode: 'mix' }));
    const text = everything(container);
    expect(text).not.toContain('우유 8');
    expect(text).not.toContain('시럽 2');
  });

  it('조작 단추와 단축키가 reduce와 같은 Action을 보낸다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'mix' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '우유 넣기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'add', ingredient: 'milk', n: 1 });
    fireEvent.keyDown(screen.getByRole('button', { name: '시럽 넣기' }), { code: 'KeyS' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'add', ingredient: 'syrup', n: 1 });
  });

  it('거절된 조작은 이유를 글로 보이고 dispatch하지 않는다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'mix' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '우유 빼기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('ratio-message').textContent).toBe('뺄 것이 없어요.');
  });

  it('readOnly면 단추가 모두 막힌다', () => {
    renderState(play({ mode: 'mix' }), vi.fn(), true);
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('×k 단추는 scaleFactors대로, 단축키는 숫자', () => {
    renderState(play({ mode: 'mix', scaleFactors: [2, 5] }));
    expect(screen.getByRole('button', { name: '모두 ×2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '모두 ×5' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '모두 ×3' })).toBeNull();
  });

  it('설정 오류면 오류 문구만', () => {
    renderState(play({ mode: 'mix', reference: { milk: -1, syrup: 1 } }));
    expect(screen.getByTestId('ratio-error')).toBeTruthy();
    expect(screen.queryByTestId('ratio-canvas')).toBeNull();
  });
});

describe('resize 화면', () => {
  it('크기 글자와 data-size·data-distorted', () => {
    const state = play({ mode: 'resize' }, [{ type: 'add-both', n: 2 }]);
    const { container } = renderState(state);
    expect(canvas(container).getAttribute('data-size')).toBe('6x5');
    expect(canvas(container).getAttribute('data-distorted')).toBe('true');
    expect(screen.getByText('가로 6칸')).toBeTruthy();
    expect(screen.getByText('세로 5칸')).toBeTruthy();
    expect(screen.getByTestId('ratio-verdict').textContent).toBe('처음 모양과 달라요');
  });

  it('×2는 모양이 유지되고 사진 틀의 가로:세로 비가 처음과 같다', () => {
    const { container } = renderState(play({ mode: 'resize' }, [{ type: 'scale', k: 2 }]));
    expect(canvas(container).getAttribute('data-distorted')).toBe('false');
    expect(screen.getByTestId('ratio-verdict').textContent).toBe('처음 모양과 같아요');
    const transform = container
      .querySelector('svg[data-testid="ratio-canvas"] > [data-part="picture"]')
      ?.getAttribute('transform');
    const scale = /scale\(([\d.]+) ([\d.]+)\)/.exec(transform ?? '');
    expect(Number(scale?.[1])).toBeCloseTo(Number(scale?.[2]), 6);
  });

  it('+2는 가로·세로 확대 배율이 다르다(찌그러짐)', () => {
    const { container } = renderState(play({ mode: 'resize' }, [{ type: 'add-both', n: 2 }]));
    const transform = container
      .querySelector('svg[data-testid="ratio-canvas"] > [data-part="picture"]')
      ?.getAttribute('transform');
    const scale = /scale\(([\d.]+) ([\d.]+)\)/.exec(transform ?? '');
    expect(Number(scale?.[1])).not.toBeCloseTo(Number(scale?.[2]), 3);
  });

  it('showVerdict:false면 같아요/달라요 글이 없다', () => {
    renderState(play({ mode: 'resize', showVerdict: false }));
    expect(screen.queryByTestId('ratio-verdict')).toBeNull();
  });

  it('담은 크기가 목록(그림 + 글)에 보이고 table look은 표로 보인다', () => {
    const actions: RatioAction[] = [{ type: 'scale', k: 2 }, { type: 'save' }];
    const picture = renderState(play({ mode: 'resize' }, actions));
    expect(
      picture.container.querySelector('[data-saved="8x6"] [data-part="picture"]'),
    ).not.toBeNull();
    expect(screen.getAllByText('가로 8, 세로 6')).toHaveLength(2);
    cleanup();
    const table = renderState(play({ mode: 'resize', look: 'table' }, actions));
    expect(table.container.querySelector('[data-part="size-table"]')).not.toBeNull();
    expect(table.container.querySelector('[data-part="saved-list"]')).toBeNull();
    expect(table.container.querySelectorAll('[data-row]')).toHaveLength(3);
  });

  it('단추·단축키: 방향키와 B·S·R, 숫자', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'resize' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '가로 늘리기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'step', dim: 'w', delta: 1 });
    const anchor = screen.getByRole('button', { name: '이 크기 담기' });
    fireEvent.keyDown(anchor, { code: 'ArrowDown' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'step', dim: 'h', delta: -1 });
    fireEvent.keyDown(anchor, { code: 'KeyB' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'add-both', n: 2 });
    fireEvent.keyDown(anchor, { code: 'Digit3' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'scale', k: 3 });
    fireEvent.keyDown(anchor, { code: 'KeyS' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'save' });
    fireEvent.keyDown(anchor, { code: 'KeyS', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledTimes(5);
  });

  it('1칸 미만 거절 이유', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'resize', base: { w: 1, h: 1 } }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '가로 줄이기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('ratio-message').textContent).toBe('1칸보다 작게 만들 수 없어요.');
  });
});

describe('단축키 표', () => {
  it('단추마다 겹치지 않는 코드 하나', () => {
    for (const config of [{ mode: 'mix' }, { mode: 'resize' }] as const) {
      const list = shortcutsOf(play(config));
      expect(new Set(list.map((s) => s.code)).size).toBe(list.length);
    }
  });
});

describe('오버레이', () => {
  const empty = (node: React.ReactElement) => render(node).container.innerHTML;

  it('모드·look이 안 맞으면 아무것도 그리지 않는다', () => {
    const resize = play({ mode: 'resize' });
    const mix = play({ mode: 'mix' });
    expect(empty(<SideBySideOverlay config={{}} state={resize} />)).toBe('');
    expect(empty(<UnitGroupsOverlay config={{}} state={resize} />)).toBe('');
    expect(
      empty(<UnitGroupsOverlay config={{}} state={play({ mode: 'mix', look: 'ratio' })} />),
    ).toBe('');
    expect(empty(<RatioGridOverlay config={{}} state={mix} />)).toBe('');
    expect(empty(<GrowthArrowsOverlay config={{}} state={mix} />)).toBe('');
    expect(empty(<GrowthArrowsOverlay config={{}} state={resize} />)).toBe('');
  });

  it('빈 컵·기준 컵 없음이면 side-by-side·unit-groups는 그리지 않는다', () => {
    expect(empty(<SideBySideOverlay config={{}} state={play({ mode: 'mix' })} />)).toBe('');
    expect(
      empty(<UnitGroupsOverlay config={{}} state={play({ mode: 'mix', reference: null })} />),
    ).toBe('');
  });
});
