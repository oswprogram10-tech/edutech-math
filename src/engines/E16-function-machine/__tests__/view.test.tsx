/** @vitest-environment jsdom */
/** E16 화면 테스트: 숨은 규칙·빈칸 정답이 DOM에 없고, 빈칸 줄 장면에 □ 글자가 없다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiffArrowsOverlay } from '../overlays/diff-arrows';
import { FailColsOverlay } from '../overlays/fail-cols';
import { LongChainOverlay } from '../overlays/long-chain';
import { SwapCheckOverlay } from '../overlays/swap-check';
import { createInitialState, reduce } from '../reduce';
import type { FunctionAction, FunctionConfig, FunctionState } from '../types';
import { FunctionView } from '../View';

afterEach(cleanup);

function play(config: FunctionConfig, actions: readonly FunctionAction[]): FunctionState {
  return actions.reduce<FunctionState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function keys(text: string, target: 'input' | 'rule' = 'input'): FunctionAction[] {
  return [...text].map((key): FunctionAction => ({ type: 'type', target, key }));
}

function renderState(state: FunctionState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <FunctionView
      config={{ mode: state.mode } as FunctionConfig}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
      readOnly={readOnly}
    />,
  );
}

/** 글자와 data-·aria-·title 속성 값을 모두 이은 문자열(화면에 닿는 값). */
function visibleStrings(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ''];
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
        parts.push(attribute.value);
      }
    }
  }
  return parts.join('|');
}

const SECRET: FunctionConfig = { mode: 'black-box', rule: '□ = ○ × 7' };

describe('E16 화면: 정답 노출 금지', () => {
  it('black-box DOM에 숨은 규칙(× 7)이 없다(data-·aria 포함)', () => {
    const state = play(SECRET, [
      ...keys('3'),
      { type: 'insert-input' },
      { type: 'focus', target: 'rule' },
      ...keys('□=○+2', 'rule'),
      { type: 'test-rule' },
    ]);
    const { container } = renderState(state);
    const html = visibleStrings(container);
    expect(html).not.toContain('× 7');
    expect(html).not.toContain('×7');
    expect(html).not.toContain('□ = ○ ×');
    // 넣은 쌍은 보인다.
    expect(container.querySelector('[data-col="0"]')?.textContent).toContain('21');
  });

  it('table 빈칸 DOM에 정답 수가 없다(□ 빈칸 84, ○ 빈칸 13)', () => {
    const config: FunctionConfig = {
      mode: 'table',
      rule: '□ = ○ × 7',
      rows: [
        { x: '12', y: null },
        { x: null, y: '91' },
        { x: '2', y: '14' },
      ],
    };
    const { container } = renderState(createInitialState(config));
    const html = visibleStrings(container);
    expect(html).not.toContain('84');
    expect(html).not.toContain('13');
    const blanks = container.querySelectorAll('[data-cell]');
    expect(blanks).toHaveLength(2);
    for (const blank of blanks) {
      expect(blank.textContent).toBe('?');
      expect(blank.getAttribute('aria-label')).toBe(
        blank.getAttribute('data-cell') === '0.y' ? '□ 빈칸' : '○ 빈칸',
      );
    }
  });

  it('table: 학생이 쓴 수는 칸에 보이지만 맞고 틀림은 표시하지 않는다', () => {
    const config: FunctionConfig = {
      mode: 'table',
      rule: '□ = ○ × 7',
      rows: [{ x: '12', y: null }],
    };
    const state = play(config, [{ type: 'activate', cell: '0.y' }, ...keys('85')]);
    const { container } = renderState(state);
    expect(container.querySelector('[data-cell="0.y"]')?.textContent).toBe('85');
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(0);
  });

  it('covary 빈칸 줄: 장면 아래 글자에 □가 없고 그림은 그대로 그린다', () => {
    const config: FunctionConfig = {
      mode: 'covary',
      scene: 'chairs-legs',
      rule: '□ = ○ × 4',
      x: { min: 1, max: 10 },
      blankRows: [5],
    };
    const first = renderState(createInitialState(config));
    expect(first.getByTestId('scene-readout').textContent).toBe('○ = 1, □ = 4');
    first.unmount();

    const state = play(config, [{ type: 'set-x', x: '5' }]);
    const { container, getByTestId } = renderState(state);
    const readout = getByTestId('scene-readout').textContent ?? '';
    expect(readout).toBe('○ = 5');
    expect(readout).not.toContain('□');
    expect(readout).not.toContain('20');
    expect(container.querySelectorAll('[data-testid="scene-canvas"] [data-chair]')).toHaveLength(5);
    // 의자마다 다리 네 개
    expect(
      container.querySelectorAll('[data-testid="scene-canvas"] [data-chair] path'),
    ).toHaveLength(20);
    expect(container.querySelector('[data-cell="5.y"]')?.textContent).toBe('?');
    expect(visibleStrings(container)).not.toContain('20');
  });

  it('covary look: none이면 장면 그림이 없고, dots면 그림 대신 점을 그린다', () => {
    const base: FunctionConfig = { mode: 'covary', scene: 'chairs-legs', x: { min: 1, max: 6 } };
    const none = renderState(createInitialState({ ...base, look: 'none' } as FunctionConfig));
    expect(none.container.querySelector('[data-testid="scene-canvas"]')).toBeNull();
    none.unmount();
    const dots = renderState(
      play({ ...base, look: 'dots' } as FunctionConfig, [{ type: 'set-x', x: '3' }]),
    );
    expect(dots.container.querySelectorAll('[data-chair]')).toHaveLength(0);
    expect(dots.container.querySelectorAll('[data-testid="scene-canvas"] circle')).toHaveLength(12);
  });

  it('학년·점수 글자가 없다', () => {
    for (const mode of ['black-box', 'table', 'covary'] as const) {
      const { container } = renderState(createInitialState({ mode } as FunctionConfig));
      expect(container.textContent).not.toMatch(/학년|점수|랭킹/);
    }
  });
});

describe('E16 화면: 조작', () => {
  it('수 키패드 단추는 type Action, 넣기는 insert-input을 보낸다', () => {
    const dispatch = vi.fn();
    const state = play(SECRET, keys('4'));
    const { getByRole } = renderState(state, dispatch);
    fireEvent.click(getByRole('button', { name: '7' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'type', target: 'input', key: '7' });
    fireEvent.click(getByRole('button', { name: '넣기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'insert-input' });
  });

  it('식 칸이 target이면 식 키패드가 열리고 시험 단추가 test-rule을 보낸다', () => {
    const dispatch = vi.fn();
    const state = play(SECRET, [{ type: 'focus', target: 'rule' }]);
    const { getByRole } = renderState(state, dispatch);
    fireEvent.click(getByRole('button', { name: '○' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'type', target: 'rule', key: '○' });
    fireEvent.click(getByRole('button', { name: '규칙 시험하기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'test-rule' });
  });

  it('물리 키보드: 숫자·o·b·Backspace·Enter', () => {
    const dispatch = vi.fn();
    const state = play(SECRET, [{ type: 'focus', target: 'rule' }]);
    const { getByTestId } = renderState(state, dispatch);
    const field = getByTestId('rule-input');
    fireEvent.keyDown(field, { key: 'o' });
    fireEvent.keyDown(field, { key: 'B' });
    fireEvent.keyDown(field, { key: '*' });
    fireEvent.keyDown(field, { key: '7' });
    fireEvent.keyDown(field, { key: 'Backspace' });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.keyDown(field, { key: 'q' });
    expect(dispatch.mock.calls.map((call) => call[0])).toEqual([
      { type: 'type', target: 'rule', key: '○' },
      { type: 'type', target: 'rule', key: '□' },
      { type: 'type', target: 'rule', key: '×' },
      { type: 'type', target: 'rule', key: '7' },
      { type: 'backspace', target: 'rule' },
      { type: 'test-rule' },
    ]);
  });

  it('읽기 전용에서는 키 입력·단추가 막힌다', () => {
    const dispatch = vi.fn();
    const { getByTestId, getByRole } = renderState(play(SECRET, []), dispatch, true);
    fireEvent.keyDown(getByTestId('input-draft'), { key: '5' });
    expect(dispatch).not.toHaveBeenCalled();
    expect((getByRole('button', { name: '5' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('식을 읽지 못하면 다시 확인 문구와 밑줄을 보이고 ✓/✕는 식을 고치면 사라진다', () => {
    const bad = play(SECRET, [
      { type: 'focus', target: 'rule' },
      ...keys('□=○×', 'rule'),
      { type: 'test-rule' },
    ]);
    const view = renderState(bad);
    expect(view.getByTestId('rule-recheck').textContent).toBe('식을 다시 확인해 볼까요?');
    expect(view.getByTestId('rule-error-mark')).toBeTruthy();
    view.unmount();

    const good = play(SECRET, [
      ...keys('3'),
      { type: 'insert-input' },
      ...keys('4'),
      { type: 'insert-input' },
      { type: 'focus', target: 'rule' },
      ...keys('□=○×7', 'rule'),
      { type: 'test-rule' },
    ]);
    const shown = renderState(good);
    expect(shown.container.querySelectorAll('[data-mark="ok"]')).toHaveLength(2);
    shown.unmount();
    const edited = renderState(reduce(good, { type: 'backspace', target: 'rule' }));
    expect(edited.container.querySelectorAll('[data-mark]')).toHaveLength(0);
  });

  it('설정이 잘못되면 설정 오류 빈 판을 그린다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getByTestId, container } = renderState(
      createInitialState({ mode: 'black-box', rule: '□ + ○ = 3' }),
    );
    expect(getByTestId('function-error').textContent).toContain('설정을 확인해 주세요.');
    expect(container.querySelector('button')).toBeNull();
    warn.mockRestore();
  });
});

describe('E16 오버레이', () => {
  const THREE: FunctionAction[] = [
    ...keys('1'),
    { type: 'insert-input' },
    ...keys('2'),
    { type: 'insert-input' },
    ...keys('5'),
    { type: 'insert-input' },
  ];
  const config: FunctionConfig = { mode: 'black-box', rule: '□ = ○ × 3' };

  function rule(text: string): FunctionAction[] {
    return [
      { type: 'focus', target: 'rule' },
      { type: 'clear', target: 'rule' },
      ...keys(text, 'rule'),
      { type: 'test-rule' },
    ];
  }

  const props = (state: FunctionState, args?: unknown) => ({
    config: { mode: 'black-box' } as FunctionConfig,
    state,
    args,
  });

  it('fail-cols: 성립하지 않는 열마다 상자 하나', () => {
    const state = play(config, [...THREE, ...rule('□=○+2')]);
    const { container } = render(<FailColsOverlay {...props(state)} />);
    expect(container.querySelectorAll('[data-testid="fail-col"]')).toHaveLength(2);
    expect(container.textContent).toContain('이 줄에서는 맞지 않아요');
  });

  it('fail-cols: 식을 시험하지 않았으면 그리지 않는다', () => {
    const { container } = render(<FailColsOverlay {...props(play(config, THREE))} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('diff-arrows: 표에 있는 수끼리의 차이만 쓴다(+1, +3)', () => {
    const { container } = render(<DiffArrowsOverlay {...props(play(config, THREE))} />);
    expect(container.querySelectorAll('[data-testid="diff-arrow"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="diff-arrow-x"]')?.textContent).toBe('+1');
    expect(container.querySelector('[data-testid="diff-arrow-y"]')?.textContent).toBe('+3');
  });

  it('diff-arrows: ○가 1 커지는 이웃이 없으면 차이가 가장 작은 쌍 하나', () => {
    const state = play(config, [
      ...keys('2'),
      { type: 'insert-input' },
      ...keys('7'),
      { type: 'insert-input' },
      ...keys('5'),
      { type: 'insert-input' },
    ]);
    const { container } = render(<DiffArrowsOverlay {...props(state)} />);
    // 열 순서 2, 7, 5: 이웃 (2,7) 차이 5, (7,5) 차이 −2 → 가장 작은 |차이| = 2
    expect(container.querySelector('[data-testid="diff-arrow-x"]')?.textContent).toBe('−2');
    expect(container.querySelector('[data-testid="diff-arrow-y"]')?.textContent).toBe('−6');
  });

  it('long-chain: 처음 3개와 "… 97번 더", □ 값은 쓰지 않는다', () => {
    const { container } = render(<LongChainOverlay {...props(play(config, THREE), { x: 100 })} />);
    expect(container.querySelectorAll('[data-testid="long-chain-step"]')).toHaveLength(3);
    expect(container.querySelector('[data-testid="long-chain-more"]')?.textContent).toContain(
      '… 97번 더',
    );
    expect(container.textContent).not.toContain('300');
    // 인자가 없으면 100
    const basic = render(<LongChainOverlay {...props(play(config, THREE))} />);
    expect(basic.container.textContent).toContain('… 97번 더');
  });

  it('swap-check: 첫 열의 ○를 내 식에 넣은 □와 표의 □를 나란히, chairs-legs면 다리 반 개', () => {
    const state = play(config, [...THREE, ...rule('○=□×3')]);
    const { container } = render(<SwapCheckOverlay {...props(state)} />);
    expect(container.querySelector('[data-testid="swap-check-mine"]')?.textContent).toBe(
      '○ = 1일 때 내 식의 □ = 1/3',
    );
    expect(container.querySelector('[data-testid="swap-check-actual"]')?.textContent).toBe(
      '표에서 같은 줄의 □ = 3',
    );
    expect(container.querySelector('[data-testid="swap-check-chair"]')).toBeNull();

    const covary = play({ mode: 'covary', scene: 'chairs-legs', x: { min: 1, max: 6 } }, [
      ...rule('○=□×4'),
    ]);
    const chairs = render(<SwapCheckOverlay {...props(covary)} />);
    expect(chairs.container.querySelector('[data-testid="swap-check-chair"]')).not.toBeNull();
    expect(chairs.container.querySelector('[data-testid="swap-check-mine"]')?.textContent).toBe(
      '○ = 1일 때 내 식의 □ = 1/4',
    );
  });
});
