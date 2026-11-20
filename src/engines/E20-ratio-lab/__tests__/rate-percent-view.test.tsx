/** @vitest-environment jsdom */
/** E20 rate·percent 화면 테스트: 입력·예측·경주 끝 장면, 정답 비노출, 키보드, 오버레이. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FootprintsOverlay } from '../overlays/footprints';
import { SameTimeOverlay } from '../overlays/same-time';
import { TensBracketsOverlay } from '../overlays/tens-brackets';
import { createInitialState, reduce } from '../reduce';
import { shortcutsOf } from '../shortcuts';
import type { RatioAction, RatioConfig, RatioState } from '../types';
import { RatioView } from '../View';

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduced && query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => mockReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 실제 reducer로 상태를 바꾸는 작은 틀(입력·예측·경주를 이어서 볼 수 있다). */
function Harness({ config }: { config: RatioConfig }) {
  const [state, setState] = useState<RatioState>(() => createInitialState(config));
  return (
    <RatioView
      config={config}
      state={state}
      dispatch={(action: RatioAction) => setState((s) => reduce(s, action))}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />
  );
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

function canvas(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg[data-testid="ratio-canvas"]');
  if (!(svg instanceof SVGSVGElement)) throw new Error('canvas 없음');
  return svg;
}

function racerX(container: HTMLElement, id: string): number {
  const node = container.querySelector(`g[data-racer="${id}"][data-at-finish]`);
  return Number(node?.getAttribute('data-x'));
}

describe('rate 화면', () => {
  it('기본 장면: 이름·거리·시간이 보이고 결과 글·속력은 어디에도 없다', () => {
    const { container } = render(<Harness config={{ mode: 'rate' }} />);
    expect(canvas(container).getAttribute('data-mode')).toBe('rate');
    expect(screen.getByText('토끼 120 m · 20 초')).toBeTruthy();
    expect(screen.getByText('거북 200 m · 40 초')).toBeTruthy();
    const all = everything(container);
    expect(all).not.toMatch(/1초에/);
    expect(all).not.toMatch(/더 빨라요|더 빠릅|빠른 쪽|느린 쪽/);
    expect(all).not.toMatch(/MC-/);
    expect(all).not.toMatch(/fastest|speed/i);
  });

  it('예측 전에는 경주 시작을 거절하고 이유를 글로 알린다', () => {
    const { container } = render(<Harness config={{ mode: 'rate' }} />);
    fireEvent.click(screen.getByRole('button', { name: '경주 시작' }));
    expect(screen.getByTestId('ratio-message').textContent).toBe(
      '먼저 누가 더 빠를지 예측해 주세요.',
    );
    expect(canvas(container).getAttribute('data-ran')).toBe('false');
  });

  it('예측 뒤 경주: reduced-motion이면 끝 장면(각자 자기 거리), 예측 단추는 사라진다', () => {
    const { container } = render(<Harness config={{ mode: 'rate' }} />);
    const start = racerX(container, 'rabbit');
    fireEvent.click(screen.getByRole('button', { name: '토끼' }));
    expect(screen.getByTestId('rate-prediction').textContent).toBe('내 예측: 토끼');
    expect(screen.queryByRole('button', { name: '토끼' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '경주 시작' }));
    const svg = canvas(container);
    expect(svg.getAttribute('data-ran')).toBe('true');
    expect(svg.getAttribute('data-playing')).toBe('false');
    expect(racerX(container, 'rabbit')).toBeGreaterThan(start);
    // 도착선 위치와 같다(자기 거리)
    const finish = container.querySelector('[data-part="finish"][data-racer="rabbit"]');
    expect(racerX(container, 'rabbit')).toBe(Number(finish?.getAttribute('data-x')));
    expect(racerX(container, 'turtle')).toBeGreaterThan(racerX(container, 'rabbit'));
    expect(screen.getByRole('button', { name: '다시 보기' })).toBeTruthy();
  });

  it('값을 바꾸면 시작 장면으로 돌아간다', () => {
    const config: RatioConfig = {
      mode: 'rate',
      racers: [
        { id: 'a', name: '가', distance: 60, time: 10 },
        { id: 'b', name: '나', distance: null, time: 20 },
      ],
    };
    const { container } = render(<Harness config={config} />);
    const input = screen.getByLabelText('나 거리(m)');
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '경주 시작' }));
    expect(racerX(container, 'b')).toBeGreaterThan(150);
    fireEvent.change(input, { target: { value: '120' } });
    expect(racerX(container, 'b')).toBe(150);
    expect(canvas(container).getAttribute('data-ran')).toBe('true');
  });

  it('입력 칸: 잠긴 칸은 글자만, 범위 밖·숫자 아님은 안내', () => {
    const config: RatioConfig = {
      mode: 'rate',
      racers: [
        { id: 'a', name: '가', distance: 60, time: null },
        { id: 'b', name: '나', distance: null, time: null },
      ],
    };
    render(<Harness config={config} />);
    expect(screen.queryByLabelText('가 거리(m)')?.tagName).toBe('SPAN');
    const input = screen.getByLabelText('나 시간(초)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '500' } });
    expect(screen.getByTestId('ratio-message').textContent).toBe(
      '시간은 1부터 120까지 정수로 넣어 주세요.',
    );
    fireEvent.change(input, { target: { value: 'a1' } });
    expect(screen.getByTestId('ratio-message').textContent).toBe('숫자만 넣어 주세요.');
    fireEvent.change(input, { target: { value: '30' } });
    expect(screen.getByTestId('ratio-message').textContent).toBe('');
    expect(input.value).toBe('30');
  });

  it('입력 칸에서 숫자·R·G를 쳐도 단축키가 작동하지 않는다', () => {
    const config: RatioConfig = {
      mode: 'rate',
      racers: [
        { id: 'a', name: '가', distance: 60, time: 10 },
        { id: 'b', name: '나', distance: null, time: 20 },
      ],
    };
    render(<Harness config={config} />);
    const input = screen.getByLabelText('나 거리(m)');
    fireEvent.keyDown(input, { code: 'Digit1', key: '1' });
    fireEvent.keyDown(input, { code: 'KeyR', key: 'r' });
    expect(screen.queryByTestId('rate-prediction')).toBeNull();
  });

  it('단축키: 1·2·3 예측, G 경주, R 처음으로', () => {
    const { container } = render(<Harness config={{ mode: 'rate' }} />);
    const wrap = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(wrap, { code: 'KeyG' });
    expect(canvas(container).getAttribute('data-ran')).toBe('false');
    fireEvent.keyDown(wrap, { code: 'Digit2' });
    expect(screen.getByTestId('rate-prediction').getAttribute('data-value')).toBe('turtle');
    fireEvent.keyDown(wrap, { code: 'KeyG' });
    expect(canvas(container).getAttribute('data-ran')).toBe('true');
  });

  it('단축키 코드는 겹치지 않는다', () => {
    const list = shortcutsOf(createInitialState({ mode: 'rate' }));
    expect(new Set(list.map((s) => s.code)).size).toBe(list.length);
    const percent = shortcutsOf(createInitialState({ mode: 'percent' }));
    expect(new Set(percent.map((s) => s.code)).size).toBe(percent.length);
  });

  it('table look: 표(이름·거리·시간)만 있고 속력 열은 없다', () => {
    const { container } = render(<Harness config={{ mode: 'rate', look: 'table' }} />);
    expect(canvas(container).getAttribute('data-look')).toBe('table');
    expect(screen.getByText('거리(m)')).toBeTruthy();
    expect(screen.getByText('시간(초)')).toBeTruthy();
    expect(everything(container)).not.toMatch(/속력|1초/);
    expect(container.querySelectorAll('[data-row]')).toHaveLength(2);
  });

  it('읽기 전용이면 단추·입력이 꺼진다', () => {
    const state = createInitialState({ mode: 'rate' });
    render(
      <RatioView
        config={{}}
        state={state}
        dispatch={vi.fn()}
        cpa="C"
        mode="rate"
        targetSize={48}
        readOnly
      />,
    );
    expect((screen.getByRole('button', { name: '경주 시작' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('설정 오류는 오류 문구만', () => {
    render(<Harness config={{ mode: 'rate', racers: [] }} />);
    expect(screen.getByTestId('ratio-error')).toBeTruthy();
  });
});

describe('percent 화면', () => {
  it('grid: 100칸, 칠한 칸 수 글, 학년·점수 표시 없음', () => {
    const { container } = render(<Harness config={{ mode: 'percent', shaded: 25 }} />);
    expect(container.querySelectorAll('rect[data-index]')).toHaveLength(100);
    expect(container.querySelectorAll('rect[data-shaded="true"]')).toHaveLength(25);
    expect(screen.getByTestId('percent-count').textContent).toBe('칠한 칸 25 / 100');
    expect(everything(container)).not.toMatch(/학년|점수|%|1\/4/);
  });

  it('showCount false면 개수 글을 숨긴다', () => {
    render(<Harness config={{ mode: 'percent', showCount: false }} />);
    expect(screen.queryByTestId('percent-count')).toBeNull();
  });

  it('strip: 1×100 띠, 굵은 선 11개', () => {
    const { container } = render(<Harness config={{ mode: 'percent', layout: 'strip' }} />);
    expect(canvas(container).getAttribute('data-look')).toBe('strip');
    const cells = Array.from(container.querySelectorAll('rect[data-index]'));
    expect(cells).toHaveLength(100);
    const ys = new Set(cells.map((c) => c.getAttribute('y')));
    expect(ys.size).toBe(1);
  });

  it('키보드: 방향키로 옮기고 Space로 바꾸고 Enter는 여기까지 칠한다', () => {
    const { container } = render(<Harness config={{ mode: 'percent' }} />);
    const group = screen.getByTestId('percent-cells');
    fireEvent.keyDown(group, { code: 'ArrowRight' });
    fireEvent.keyDown(group, { code: 'ArrowRight' });
    fireEvent.keyDown(group, { code: 'ArrowDown' });
    expect(group.getAttribute('data-cursor')).toBe('12');
    fireEvent.keyDown(group, { code: 'Space' });
    expect(container.querySelector('rect[data-index="12"]')?.getAttribute('data-shaded')).toBe(
      'true',
    );
    fireEvent.keyDown(group, { code: 'Space' });
    expect(container.querySelector('rect[data-index="12"]')?.getAttribute('data-shaded')).toBe(
      'false',
    );
    fireEvent.keyDown(group, { code: 'Enter' });
    expect(container.querySelectorAll('rect[data-shaded="true"]')).toHaveLength(13);
    expect(screen.getByTestId('percent-count').textContent).toBe('칠한 칸 13 / 100');
  });

  it('키보드 커서는 판 밖으로 나가지 않고 줄 끝에서 다음 줄로 넘어가지 않는다', () => {
    render(<Harness config={{ mode: 'percent' }} />);
    const group = screen.getByTestId('percent-cells');
    fireEvent.keyDown(group, { code: 'ArrowLeft' });
    fireEvent.keyDown(group, { code: 'ArrowUp' });
    expect(group.getAttribute('data-cursor')).toBe('0');
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(group, { code: 'ArrowRight' });
    expect(group.getAttribute('data-cursor')).toBe('9');
  });

  it('모두 지우기·처음으로 단추와 단축키 C·R', () => {
    const { container } = render(<Harness config={{ mode: 'percent', shaded: 5 }} />);
    fireEvent.click(screen.getByRole('button', { name: '모두 지우기' }));
    expect(container.querySelectorAll('rect[data-shaded="true"]')).toHaveLength(0);
    fireEvent.keyDown(container.firstElementChild as HTMLElement, { code: 'KeyR' });
    expect(container.querySelectorAll('rect[data-shaded="true"]')).toHaveLength(5);
    fireEvent.keyDown(container.firstElementChild as HTMLElement, { code: 'KeyC' });
    expect(container.querySelectorAll('rect[data-shaded="true"]')).toHaveLength(0);
  });

  it('editable false면 칠할 수 없고 단추도 없다', () => {
    const { container } = render(
      <Harness config={{ mode: 'percent', shaded: 5, editable: false }} />,
    );
    const group = screen.getByTestId('percent-cells');
    fireEvent.keyDown(group, { code: 'Space' });
    expect(container.querySelectorAll('rect[data-shaded="true"]')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: '모두 지우기' })).toBeNull();
  });
});

describe('rate·percent 오버레이', () => {
  const empty = (node: React.ReactElement) => render(node).container.innerHTML;

  it('모드가 안 맞으면 아무것도 그리지 않는다', () => {
    const rateState = createInitialState({ mode: 'rate' });
    const percentState = createInitialState({ mode: 'percent' });
    const mixState = createInitialState({ mode: 'mix' });
    expect(empty(<FootprintsOverlay config={{}} state={percentState} />)).toBe('');
    expect(empty(<SameTimeOverlay config={{}} state={mixState} />)).toBe('');
    expect(empty(<TensBracketsOverlay config={{}} state={rateState} />)).toBe('');
  });

  it('footprints: 처음 3초, 거리 글 없음. 시간이 짧으면 도착 뒤엔 찍지 않는다', () => {
    const state = createInitialState({
      mode: 'rate',
      racers: [
        { id: 'a', name: '가', distance: 60, time: 10 },
        { id: 'b', name: '나', distance: 8, time: 2 },
      ],
    });
    const { container } = render(<FootprintsOverlay config={{}} state={state} />);
    const prints = (id: string) =>
      container.querySelectorAll(`[data-racer="${id}"] [data-part="footprint"]`).length;
    expect(prints('a')).toBe(3);
    expect(prints('b')).toBe(2);
    expect(container.querySelectorAll('text')).toHaveLength(0);
  });

  it('same-time: 점선 둘과 "같은 시간" 글, 값 글 없음', () => {
    const state = createInitialState({ mode: 'rate' });
    const { container } = render(<SameTimeOverlay config={{}} state={state} />);
    const lines = container.querySelectorAll('[data-part="time-line"]');
    expect(lines).toHaveLength(2);
    // 짧은 쪽 시간 t=20초: 토끼는 도착(120m), 거북은 100m 지점
    const xs = Array.from(lines).map((l) => Number(l.getAttribute('data-x')));
    expect(xs[0]).toBeGreaterThan(xs[1] ?? 0);
    expect(container.querySelector('[data-part="same-time-label"]')?.textContent).toBe('같은 시간');
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('same-time: 값이 비면 그리지 않는다', () => {
    const state = createInitialState({
      mode: 'rate',
      racers: [
        { id: 'a', name: '가', distance: null, time: null },
        { id: 'b', name: '나', distance: 8, time: 2 },
      ],
    });
    expect(empty(<SameTimeOverlay config={{}} state={state} />)).toBe('');
  });

  it('tens-brackets: 다 찬 10칸마다 괄호와 10, 남은 칸은 점선', () => {
    const state = createInitialState({ mode: 'percent', shaded: 25 });
    const { container } = render(<TensBracketsOverlay config={{}} state={state} />);
    expect(container.querySelectorAll('[data-part="ten-bracket"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="ten-label"]')).toHaveLength(2);
    expect(container.querySelector('[data-part="ten-label"]')?.textContent).toBe('10');
    expect(container.querySelectorAll('[data-part="rest-ring"]')).toHaveLength(1);
  });

  it('tens-brackets: 0칸은 비어 있고 100칸은 괄호 열 개, strip도 같은 규칙', () => {
    const none = createInitialState({ mode: 'percent' });
    expect(container(<TensBracketsOverlay config={{}} state={none} />)).toBe(0);
    const full = createInitialState({ mode: 'percent', layout: 'strip', shaded: 100 });
    const { container: node } = render(<TensBracketsOverlay config={{}} state={full} />);
    expect(node.querySelectorAll('[data-part="ten-bracket"]')).toHaveLength(10);
    expect(node.querySelectorAll('[data-part="rest-ring"]')).toHaveLength(0);
  });
});

function container(node: React.ReactElement): number {
  const { container: rendered } = render(node);
  return rendered.querySelectorAll('[data-part]').length;
}

describe('경주 재생(움직임 켜짐)', () => {
  it('3초 동안 위치가 단조 증가하고 끝에서 data-playing이 false', () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { container } = render(<Harness config={{ mode: 'rate' }} />);
    fireEvent.click(screen.getByRole('button', { name: '토끼' }));
    fireEvent.click(screen.getByRole('button', { name: '경주 시작' }));
    expect(canvas(container).getAttribute('data-playing')).toBe('true');
    const seen: number[] = [];
    for (const t of [0, 750, 1500, 2250, 3000]) {
      now = t;
      const cb = callbacks.shift();
      if (cb) act(() => cb(t));
      seen.push(racerX(container, 'turtle'));
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen[0]).toBe(150);
    expect(canvas(container).getAttribute('data-playing')).toBe('false');
    expect(canvas(container).getAttribute('data-step')).toBe('1000');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
