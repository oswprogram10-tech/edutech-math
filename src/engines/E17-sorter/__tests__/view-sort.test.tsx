/** @vitest-environment jsdom */
/** E17 sort·predict 화면 테스트(T217): 비밀 기준·정답 개수가 DOM에 없고, 카드·단추 이름이 쉬운 한국어다. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../reduce';
import { currentOf, matchesRule } from '../secret-rule-predict/reduce';
import { deckDefinition } from '../decks';
import type { SorterAction, SorterConfig, SorterState } from '../types';
import { SorterView } from '../View';

afterEach(cleanup);

function renderState(
  config: SorterConfig,
  state: SorterState,
  options: { dispatch?: (action: SorterAction) => void; targetSize?: 48 | 64 } = {},
) {
  return render(
    <SorterView
      config={config}
      state={state}
      dispatch={options.dispatch ?? (() => {})}
      cpa="C"
      mode={state.mode}
      targetSize={options.targetSize ?? 48}
    />,
  );
}

function renderConfig(config: SorterConfig, targetSize: 48 | 64 = 48) {
  return renderState(config, createInitialState(config), { targetSize });
}

function play(config: SorterConfig, actions: readonly SorterAction[]): SorterState {
  return actions.reduce<SorterState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

const COLORS = [
  'red',
  'red',
  'red',
  'red',
  'red',
  'blue',
  'blue',
  'blue',
  'blue',
  'yellow',
  'yellow',
  'yellow',
];

describe('sort 화면', () => {
  it('단추 카드 12장의 aria-label이 색·모양·구멍 수를 말한다', () => {
    const { container } = renderConfig({ mode: 'sort' });
    const cards = [...container.querySelectorAll('[data-card]')];
    expect(cards).toHaveLength(12);
    expect(cards[0]?.getAttribute('aria-label')).toBe('빨강 동그라미 단추, 구멍 2개');
    expect(cards[3]?.getAttribute('aria-label')).toBe('빨강 세모 단추, 구멍 4개');
    expect(cards[5]?.getAttribute('aria-label')).toBe('파랑 동그라미 단추, 구멍 2개');
  });

  it('사물 카드의 aria-label은 이름이다', () => {
    const { container } = renderConfig({ mode: 'sort', deck: 'classroom-objects-12' });
    const labels = [...container.querySelectorAll('[data-card]')].map((card) =>
      card.getAttribute('aria-label'),
    );
    expect(labels).toContain('지우개');
    expect(labels).toContain('캔(눕힘)');
    expect(labels).toHaveLength(12);
  });

  it('색만으로 구별하지 않는다: 파랑은 빗금, 노랑은 점무늬 칠을 쓰고 빨강은 꽉 찬 칠이다', () => {
    const { container } = renderConfig({ mode: 'sort' });
    const html = (id: string) => container.querySelector(`[data-card="${id}"]`)?.innerHTML ?? '';
    expect(html('b06')).toContain('url(#sort-pat-blue)');
    expect(html('b10')).toContain('url(#sort-pat-yellow)');
    expect(html('b01')).toContain('#d64545');
    expect(container.querySelector('#sort-pat-blue')).not.toBeNull();
    expect(container.querySelector('#sort-pat-yellow')).not.toBeNull();
  });

  it('render:gray이면 색·무늬 없이 회색으로 그린다', () => {
    const { container } = renderConfig({ mode: 'sort', render: 'gray' });
    const cards = container.querySelector('[data-card="b06"]')?.innerHTML ?? '';
    expect(cards).not.toContain('url(#sort-pat-blue)');
    expect(cards).toContain('#c9ced8');
  });

  it('기준 고르기 전에는 상자가 없고 안내만 있다, 고르면 값 이름 상자가 생긴다', () => {
    const config: SorterConfig = { mode: 'sort', criterionChoice: ['color', 'shape'] };
    const first = renderConfig(config);
    expect(first.container.querySelectorAll('[data-bin]')).toHaveLength(0);
    expect(first.container.textContent).toContain('먼저 나누는 기준을 골라요');
    const buttons = [...first.container.querySelectorAll('[data-criterion]')];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      '색깔(으)로 나누기',
      '모양(으)로 나누기',
    ]);
    cleanup();

    const state = play(config, [{ type: 'choose-criterion', criterion: 'color' }]);
    const second = renderState(config, state);
    const bins = [...second.container.querySelectorAll('[data-bin]')];
    expect(bins.map((bin) => bin.getAttribute('aria-label'))).toEqual(['빨강', '파랑', '노랑']);
    expect(second.container.textContent).toContain('기준 바꾸기');
  });

  it('기준 단추 이름이 쉬운 말이다(단추 이름에 내부 영어 이름이 없다)', () => {
    const { container } = renderConfig({
      mode: 'sort',
      criterionChoice: ['color', 'shape', 'holes', 'pretty'],
    });
    const text = container.querySelector('[data-testid="sorter-controls"]')?.textContent ?? '';
    for (const word of ['색깔', '모양', '구멍 수', '예쁜 것']) expect(text).toContain(word);
    expect(text).not.toMatch(/[A-Za-z]{3,}/);
  });

  it('countTable student: 모든 카드를 넣기 전에는 개수 칸이 없고, 넣은 뒤 칸은 비어 있다', () => {
    const config: SorterConfig = {
      mode: 'sort',
      criterionChoice: ['color'],
      countTable: 'student',
    };
    const actions: SorterAction[] = [{ type: 'choose-criterion', criterion: 'color' }];
    const bins = { red: 'bin1', blue: 'bin2', yellow: 'bin3' } as const;
    COLORS.forEach((color, index) => {
      actions.push({
        type: 'move',
        card: `b${String(index + 1).padStart(2, '0')}`,
        to: bins[color as keyof typeof bins],
      });
    });
    const partial = renderState(config, play(config, actions.slice(0, 5)));
    expect(partial.container.querySelectorAll('input[type="number"]')).toHaveLength(0);
    cleanup();

    const full = renderState(config, play(config, actions));
    const inputs = [
      ...full.container.querySelectorAll('input[type="number"]'),
    ] as HTMLInputElement[];
    expect(inputs).toHaveLength(3);
    for (const input of inputs) expect(input.value).toBe('');
    // 정답 개수(5·4·3)와 "n장" 표시는 어디에도 없다.
    expect(full.container.textContent).not.toMatch(/\d+장/);
    const html = full.container.innerHTML;
    expect(html).not.toContain('valueCounts');
    expect(html).not.toContain('data-count="');
  });

  it('countTable student: 단추와 수 칸이 보내는 Action', () => {
    const config: SorterConfig = {
      mode: 'sort',
      cards: ['b01'],
      bins: 1,
      countTable: 'student',
    };
    const state = play(config, [{ type: 'move', card: 'b01', to: 'bin1' }]);
    const dispatch = vi.fn<(action: SorterAction) => void>();
    const { container } = renderState(config, state, { dispatch });
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'count', bin: 'bin1', value: 12 });
    const plus = container.querySelector('button[aria-label$="하나 늘리기"]') as HTMLElement;
    fireEvent.click(plus);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'count', bin: 'bin1', value: 1 });
    const minus = container.querySelector('button[aria-label$="하나 줄이기"]') as HTMLElement;
    fireEvent.click(minus);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'count', bin: 'bin1', value: 0 });
  });

  it('countTable auto: 모든 카드를 넣은 뒤에만 상자별 개수를 보인다', () => {
    const config: SorterConfig = {
      mode: 'sort',
      cards: ['b01', 'b02'],
      bins: 2,
      countTable: 'auto',
    };
    const before = renderState(config, play(config, [{ type: 'move', card: 'b01', to: 'bin1' }]));
    expect(before.container.textContent).not.toMatch(/\d+장/);
    cleanup();
    const after = renderState(
      config,
      play(config, [
        { type: 'move', card: 'b01', to: 'bin1' },
        { type: 'move', card: 'b02', to: 'bin1' },
      ]),
    );
    expect(after.container.textContent).toContain('2장');
  });

  it('상자 이름 아이콘: 상자마다 아이콘 단추 묶음이 있고 눌린 아이콘이 이름이 된다', () => {
    const config: SorterConfig = {
      mode: 'sort',
      deck: 'classroom-objects-12',
      binLabels: 'student-choice-icon',
    };
    const { container } = renderConfig(config);
    const groups = container.querySelectorAll('[role="group"][aria-label$="이름 붙이기"]');
    expect(groups).toHaveLength(3);
    const first = groups[0] as HTMLElement;
    expect([...first.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      '상자 모양',
      '둥근기둥 모양',
      '공 모양',
    ]);
    cleanup();
    const named = play(config, [{ type: 'label-bin', bin: 'bin2', icon: 'shapeFamily:cylinder' }]);
    const second = renderState(config, named);
    const labels = [...second.container.querySelectorAll('[data-bin]')].map((bin) =>
      bin.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['상자 1', '둥근기둥 모양', '상자 3']);
  });

  it('카드에 초점을 두고 숫자 키를 누르면 그 상자로 넣는 Action을 보낸다', () => {
    const config: SorterConfig = { mode: 'sort', bins: 3 };
    const dispatch = vi.fn<(action: SorterAction) => void>();
    const { container } = renderState(config, createInitialState(config), { dispatch });
    const card = container.querySelector('[data-card="b05"]') as SVGElement;
    fireEvent.keyDown(card, { key: '2' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move', card: 'b05', to: 'bin2' });
    fireEvent.keyDown(card, { key: '0' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move', card: 'b05', to: 'tray' });
    fireEvent.keyDown(card, { key: 'Backspace' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move', card: 'b05', to: 'tray' });
    // 없는 상자 번호(4)는 보내지 않는다.
    dispatch.mockClear();
    fireEvent.keyDown(card, { key: '4' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('기준을 고르기 전에 숫자 키로 넣으려 하면 Action 없이 안내를 보인다', () => {
    const config: SorterConfig = { mode: 'sort', criterionChoice: ['color'] };
    const dispatch = vi.fn<(action: SorterAction) => void>();
    const { container } = renderState(config, createInitialState(config), { dispatch });
    fireEvent.keyDown(container.querySelector('[data-card="b01"]') as SVGElement, { key: '1' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('컨베이어: 벨트에는 지금 카드 하나만 보인다', () => {
    const config: SorterConfig = {
      mode: 'sort',
      conveyor: true,
      cards: ['b03', 'b01', 'b02'],
      bins: 2,
    };
    const { container } = renderConfig(config);
    const cards = [...container.querySelectorAll('[data-card]')];
    expect(cards.map((card) => card.getAttribute('data-card'))).toEqual(['b03']);
    expect(container.textContent).toContain('남은 카드 3장');
  });

  it('64px 모드에서는 틀에 data-target-size 64가 걸리고 단추가 같은 변수를 쓴다', () => {
    const { container } = renderConfig(
      { mode: 'sort', criterionChoice: ['color'], countTable: 'student' },
      64,
    );
    expect(container.querySelector('[data-target-size="64"]')).not.toBeNull();
  });

  it('설정 오류면 오류 안내만 보인다', () => {
    const { container } = renderConfig({ mode: 'sort', cards: ['zz'] });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      '선생님께 알려 주세요',
    );
    expect(container.querySelectorAll('[data-card]')).toHaveLength(0);
  });
});

describe('predict 화면은 비밀 기준을 맞히기 전에 드러내지 않는다', () => {
  const OPTIONS = [
    { attribute: 'color', value: 'red' },
    { attribute: 'color', value: 'blue' },
    { attribute: 'color', value: 'yellow' },
    { attribute: 'holes', value: 4 },
  ];

  function config(rule: { attribute: string; value: string | number }): SorterConfig {
    return {
      mode: 'secret-rule',
      variant: 'predict',
      deck: 'buttons-12',
      rule,
      guessOptions: OPTIONS,
      seed: 4,
    } as SorterConfig;
  }

  function allAttributes(container: HTMLElement): string {
    const parts: string[] = [];
    for (const element of container.querySelectorAll('*')) {
      for (const attribute of element.getAttributeNames()) {
        parts.push(`${attribute}=${element.getAttribute(attribute) ?? ''}`);
      }
    }
    return parts.join('\n');
  }

  it.each([
    ['노랑', { attribute: 'color', value: 'yellow' }],
    ['구멍 4개', { attribute: 'holes', value: 4 }],
  ])('시작 화면(%s 기준): rule 전용 표시·기준 고르기 칸이 없다', (_name, rule) => {
    const cfg = config(rule);
    const { container } = renderConfig(cfg);
    const attributes = allAttributes(container);
    // rule·secret 같은 이름의 속성이나 값이 없고, 기준 고르기 칸·"기준은" 글이 없다.
    expect(attributes).not.toMatch(/rule/i);
    expect(attributes).not.toMatch(/secret/i);
    expect(container.querySelector('[data-testid="guess-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="guess-result"]')).toBeNull();
    const text = container.textContent ?? '';
    expect(text).not.toContain('기준은');
    for (const name of ['빨간색', '파란색', '노란색', '구멍 4개']) expect(text).not.toContain(name);
    // 상자는 "예"·"아니요"일 뿐이다.
    const bins = [...container.querySelectorAll('[data-bin]')].map((bin) =>
      bin.getAttribute('aria-label'),
    );
    expect(bins).toEqual(['예 상자', '아니요 상자']);
    // 새 카드는 하나, 상자에는 예시가 있다(데이터 속성에 정답 상자 표시가 없다).
    expect(container.querySelectorAll('[data-new-card]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-card]').length).toBeGreaterThan(4);
  });

  it('예측 단추는 [예 상자]·[아니요 상자]이고 눌리면 predict Action을 보낸다', () => {
    const cfg = config({ attribute: 'color', value: 'yellow' });
    const dispatch = vi.fn<(action: SorterAction) => void>();
    const { container } = renderState(cfg, createInitialState(cfg), { dispatch });
    const buttons = [...container.querySelectorAll('button[data-predict]')];
    expect(buttons.map((button) => button.textContent)).toEqual(['예 상자', '아니요 상자']);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'predict', bin: 'yes' });
    fireEvent.click(buttons[1] as HTMLElement);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'predict', bin: 'no' });
  });

  it('연속 3번 맞히면 기준 고르기 칸이 열리고, 맞히면 그제야 기준 이름이 나온다', () => {
    const cfg = config({ attribute: 'color', value: 'yellow' });
    let state = createInitialState(cfg);
    for (let step = 0; step < 3; step += 1) {
      if (state.mode !== 'predict') throw new Error('predict 상태가 아니다');
      const id = currentOf(state);
      const card = deckDefinition('buttons-12').cards.find((candidate) => candidate.id === id);
      if (!card) throw new Error('새 카드 없음');
      state = reduce(state, {
        type: 'predict',
        bin: matchesRule(card, state.settings.rule) ? 'yes' : 'no',
      });
    }
    const open = renderState(cfg, state);
    const panel = open.container.querySelector('[data-testid="guess-panel"]');
    expect(panel).not.toBeNull();
    expect([...(panel?.querySelectorAll('button') ?? [])].map((b) => b.textContent)).toEqual([
      '빨간색',
      '파란색',
      '노란색',
      '구멍 4개',
    ]);
    cleanup();

    const solved = reduce(state, { type: 'guess', attribute: 'color', value: 'yellow' });
    const done = renderState(cfg, solved);
    expect(done.container.querySelector('[data-testid="guess-result"]')?.textContent).toContain(
      '노란색',
    );
  });

  it('틀린 기준 뒤에는 "카드를 더 보고 다시 골라요"를 보이고 기준 고르기 칸이 닫힌다', () => {
    const cfg = config({ attribute: 'color', value: 'yellow' });
    let state = createInitialState(cfg);
    for (let step = 0; step < 3; step += 1) {
      if (state.mode !== 'predict') throw new Error('predict 상태가 아니다');
      const id = currentOf(state);
      const card = deckDefinition('buttons-12').cards.find((candidate) => candidate.id === id);
      if (!card) throw new Error('새 카드 없음');
      state = reduce(state, {
        type: 'predict',
        bin: matchesRule(card, state.settings.rule) ? 'yes' : 'no',
      });
    }
    state = reduce(state, { type: 'guess', attribute: 'color', value: 'blue' });
    const { container } = renderState(cfg, state);
    expect(container.textContent).toContain('카드를 더 보고 다시 골라요');
    expect(container.querySelector('[data-testid="guess-panel"]')).toBeNull();
  });

  it('새 카드에 초점을 두고 1·2를 누르면 예·아니요로 예측한다', () => {
    const cfg = config({ attribute: 'color', value: 'yellow' });
    const dispatch = vi.fn<(action: SorterAction) => void>();
    const { container } = renderState(cfg, createInitialState(cfg), { dispatch });
    const card = container.querySelector('[data-new-card]') as SVGElement;
    fireEvent.keyDown(card, { key: '1' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'predict', bin: 'yes' });
    fireEvent.keyDown(card, { key: '2' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'predict', bin: 'no' });
  });

  it('설정 오류면 오류 안내만 보인다', () => {
    const cfg = { ...config({ attribute: 'color', value: 'green' }) } as SorterConfig;
    const { container } = renderConfig(cfg);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-card]')).toHaveLength(0);
  });
});
