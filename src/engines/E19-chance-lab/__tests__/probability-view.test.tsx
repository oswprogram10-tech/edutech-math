/** @vitest-environment jsdom */
/** E19 가능성 모드 화면 테스트: 무늬+이름 글, 단추 조작, 키보드, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AfterStreakOverlay } from '../overlays/after-streak';
import { SmallBatchesOverlay } from '../overlays/small-batches';
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

const props = (state: ChanceState) => ({ config: {} as ChanceConfig, state, args: undefined });

describe('words 화면', () => {
  it('카드 5장과 칸 5개, 칸 이름은 말과 수를 함께 보인다', () => {
    const { container } = renderState(play({ mode: 'words' }));
    expect(container.querySelectorAll('[data-part="card"]')).toHaveLength(5);
    const names = [...container.querySelectorAll('[data-part="slot-name"]')].map(
      (t) => t.textContent,
    );
    expect(names.join('|')).toContain('불가능하다');
    expect(names.join('|')).toContain('확실하다');
    expect(container.textContent).toContain('1/4');
  });

  it('slotLabels: words는 수가 없고 numbers는 말이 없다', () => {
    const w = renderState(play({ mode: 'words', slotLabels: 'words', slots: 'three' }));
    expect(w.container.querySelectorAll('[data-part="slot"]')).toHaveLength(3);
    const text = [...w.container.querySelectorAll('[data-part="slot-name"]')]
      .map((t) => t.textContent)
      .join('');
    expect(text).not.toMatch(/[0-9]/);
    cleanup();
    const n = renderState(play({ mode: 'words', slotLabels: 'numbers' }));
    const nt = [...n.container.querySelectorAll('[data-part="slot-name"]')]
      .map((t) => t.textContent)
      .join('|');
    expect(nt).toBe('0|1/4|1/2|3/4|1');
  });

  it('단추로 칸을 고르고 놓으면 place를 보낸다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'words' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '오른쪽 칸 고르기' }));
    fireEvent.click(screen.getByRole('button', { name: '고른 칸에 놓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', cardId: 'c1', slot: '3/4' });
  });

  it('카드에서 ←→ Enter로 놓고 Delete로 뺀다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play({ mode: 'words' }), dispatch);
    const card = container.querySelector('[data-card="c2"]') as SVGGElement;
    fireEvent.focus(card);
    fireEvent.keyDown(card, { key: 'ArrowLeft' });
    fireEvent.keyDown(card, { key: 'ArrowLeft' });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', cardId: 'c2', slot: '0' });
  });

  it('놓은 카드는 칸 안에 쌓이고 정답 글은 없다', () => {
    const state = play({ mode: 'words' }, [
      { type: 'place', cardId: 'c1', slot: '1' },
      { type: 'place', cardId: 'c2', slot: '1' },
    ]);
    const { container } = renderState(state);
    const a = container.querySelector('[data-card="c1"] rect');
    const b = container.querySelector('[data-card="c2"] rect');
    expect(Number(a?.getAttribute('x'))).toBe(Number(b?.getAttribute('x')));
    expect(Number(b?.getAttribute('y'))).toBeLessThan(Number(a?.getAttribute('y')));
    expect(container.querySelector('[data-card="c1"]')?.getAttribute('aria-label')).toContain(
      '확실하다 1',
    );
  });

  it('읽기 전용이면 단추가 잠기고 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'words' }), dispatch, true);
    expect(
      (screen.getByRole('button', { name: '고른 칸에 놓기' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('spinner 화면', () => {
  it('회전판 칸과 화살표, 색별 횟수 표는 이름 글과 무늬를 함께 둔다', () => {
    const { container } = renderState(play({ mode: 'spinner' }));
    expect(container.querySelectorAll('[data-part="sector"]')).toHaveLength(2);
    expect(container.querySelector('[data-part="arrow"]')).not.toBeNull();
    const rows = container.querySelectorAll('[data-part="count-row"]');
    expect(rows).toHaveLength(4);
    expect(container.textContent).toContain('빨강 0번');
    expect(container.textContent).toContain('파랑 0번');
    expect(container.textContent).toContain('노랑 0번');
    expect(container.textContent).toContain('초록 0번');
    // 무늬 4종(색 말고도 구분)
    expect(container.querySelectorAll('pattern')).toHaveLength(4);
    expect(container.textContent).toContain('아직 안 돌렸어요.');
  });

  it('돌리기는 0 이상 2^32 미만 정수 seed로 spin을 보낸다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'spinner' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '돌리기' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]?.[0] as { type: string; seed: number };
    expect(action.type).toBe('spin');
    expect(Number.isInteger(action.seed)).toBe(true);
    expect(action.seed).toBeGreaterThanOrEqual(0);
    expect(action.seed).toBeLessThan(2 ** 32);
  });

  it('칸을 눌러 고르고 색 바꾸기·크기 키우기를 보낸다', () => {
    const dispatch = vi.fn();
    const { container } = renderState(play({ mode: 'spinner' }), dispatch);
    fireEvent.pointerDown(
      container.querySelector('[data-part="sector"][data-index="1"]') as Element,
    );
    fireEvent.click(screen.getByRole('button', { name: '칸 색 바꾸기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'sector-color', index: 1, color: 'yellow' });
    fireEvent.click(screen.getByRole('button', { name: '칸 키우기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'sector-size', index: 1, size: 2 });
  });

  it('한계에서는 안내 글로 이유를 알리고 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'spinner' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '칸 줄이기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('chance-message').textContent).toBe('칸 크기는 1부터 4까지예요.');
  });

  it('editable: false이면 편집 단추가 잠긴다', () => {
    renderState(play({ mode: 'spinner', editable: false }));
    expect((screen.getByRole('button', { name: '칸 더하기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: '돌리기' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('주머니: 색별 구슬 개수 단추와 꺼내기', () => {
    const dispatch = vi.fn();
    const { container } = renderState(
      play({
        mode: 'spinner',
        device: {
          type: 'bag',
          marbles: [
            { color: 'red', count: 2 },
            { color: 'blue', count: 1 },
          ],
        },
      }),
      dispatch,
    );
    expect(container.querySelectorAll('[data-part="marble"]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '노랑 구슬 더하기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'marble-set', color: 'yellow', count: 1 });
    fireEvent.click(screen.getByRole('button', { name: '빨강 구슬 빼기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'marble-set', color: 'red', count: 1 });
    expect(screen.getByTestId('marble-count-red').textContent).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: '꺼내기' }));
    expect((dispatch.mock.calls.at(-1)?.[0] as { type: string }).type).toBe('spin');
  });

  it('시행 뒤 최근 결과 줄에 무늬 칸이 쌓이고 이름이 나온다', () => {
    const state = play(
      { mode: 'spinner', device: { type: 'bag', marbles: [{ color: 'green', count: 2 }] } },
      [
        { type: 'spin', seed: 1 },
        { type: 'spin', seed: 2 },
      ],
    );
    const { container } = renderState(state);
    expect(container.querySelectorAll('[data-part="last"]')).toHaveLength(2);
    expect(container.querySelector('[data-part="last-name"]')?.textContent).toBe('초록');
    expect(container.textContent).toContain('초록 2번');
    expect(container.querySelector('[data-part="picked"]')).not.toBeNull();
  });
});

describe('simulate 화면', () => {
  it('비교 칸 셋과 돌리기 단추 셋, 돌리기 전에는 막대가 없다', () => {
    const { container } = renderState(play({ mode: 'simulate' }));
    expect(container.querySelectorAll('[data-part="column"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-part="bar"]')).toHaveLength(0);
    for (const n of [10, 1000, 10000]) {
      expect(screen.getByRole('button', { name: `${n}회 돌리기` })).toBeTruthy();
    }
    expect(container.textContent).toContain('아직 안 돌렸어요');
  });

  it('showExpected: 가능성 점선과 이름표, false이면 없다', () => {
    const on = renderState(play({ mode: 'simulate' }));
    expect(on.container.querySelectorAll('[data-part="expected"]')).toHaveLength(12);
    expect(on.container.textContent).toContain('가능성');
    // 빨강·파랑 1/2 → 점선 높이가 같다(축 0~1의 가운데)
    const ys = [...on.container.querySelectorAll('[data-part="expected"][data-outcome="red"]')].map(
      (l) => l.getAttribute('data-y'),
    );
    expect(new Set(ys).size).toBe(1);
    cleanup();
    const off = renderState(play({ mode: 'simulate', showExpected: false }));
    expect(off.container.querySelectorAll('[data-part="expected"]')).toHaveLength(0);
    expect(off.container.textContent).not.toContain('가능성');
  });

  it('돌리기 단추는 그 칸의 batch와 seed로 run을 보낸다', () => {
    const dispatch = vi.fn();
    renderState(play({ mode: 'simulate' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '1000회 돌리기' }));
    const action = dispatch.mock.calls[0]?.[0] as { type: string; batch: number; seed: number };
    expect(action).toMatchObject({ type: 'run', batch: 1000 });
    expect(Number.isInteger(action.seed)).toBe(true);
  });

  it('돌린 칸에는 색마다 막대와 "n번 중 k번" 글이 생기고 같은 축척이다', () => {
    const state = play({ mode: 'simulate' }, [{ type: 'run', batch: 10, seed: 1 }]);
    const { container } = renderState(state);
    const bars = container.querySelectorAll('[data-part="bar"]');
    expect(bars).toHaveLength(4);
    const red = Number(container.querySelector('[data-part="bar"]')?.getAttribute('data-count'));
    expect(container.textContent).toContain('10번 중');
    expect(container.textContent).toContain(`${red}번`);
    const rel = [...bars].map((b) => Number(b.getAttribute('data-rel')));
    expect(rel.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    // 막대 높이 = 상대도수 × 280
    const first = container.querySelector('[data-part="bar"]');
    expect(Number(first?.getAttribute('height'))).toBeCloseTo((rel[0] ?? 0) * 280, 1);
  });

  it('batches 설정에 따라 칸 수가 달라진다', () => {
    const { container } = renderState(play({ mode: 'simulate', batches: [5, 50, 500, 5000] }));
    expect(container.querySelectorAll('[data-part="column"]')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '5회 돌리기' })).toBeTruthy();
  });

  it('작은 회전판 그림과 장치 편집 단추가 조작 칸에 있다', () => {
    renderState(play({ mode: 'simulate' }));
    expect(screen.getByTestId('chance-mini-device')).toBeTruthy();
    expect(screen.getByRole('button', { name: '칸 더하기' })).toBeTruthy();
  });
});

describe('가능성 오버레이', () => {
  it('small-batches: 묶음 5개 × 막대 4개, 글은 이름만', () => {
    const { container } = render(<SmallBatchesOverlay {...props(play({ mode: 'spinner' }))} />);
    expect(container.querySelectorAll('[data-part="batch"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-part="bar"]')).toHaveLength(20);
    expect(container.textContent).toContain('10번씩 5묶음');
    // 순수: 같은 상태면 같은 그림
    const again = render(<SmallBatchesOverlay {...props(play({ mode: 'spinner' }))} />);
    expect(again.container.innerHTML.replace(/e19-[a-zA-Z0-9-]+/g, 'ID')).toBe(
      container.innerHTML.replace(/e19-[a-zA-Z0-9-]+/g, 'ID'),
    );
  });

  it('small-batches: 다른 모드에서는 그리지 않는다', () => {
    const { container } = render(<SmallBatchesOverlay {...props(play({ mode: 'words' }))} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('after-streak: 묶음 막대 둘(5번 이어진 다음 / 전체)', () => {
    const { container } = render(<AfterStreakOverlay {...props(play({ mode: 'simulate' }))} />);
    expect(container.querySelector('[data-part="after"]')).not.toBeNull();
    expect(container.querySelector('[data-part="whole"]')).not.toBeNull();
    expect(container.textContent).toContain('빨강이 5번 이어진 바로 다음');
    expect(container.textContent).toContain('전체');
    const wholeRed = container.querySelector('[data-part="whole"] [data-outcome="red"]');
    expect(Number(wholeRed?.getAttribute('data-rel'))).toBeGreaterThan(0.45);
    expect(Number(wholeRed?.getAttribute('data-rel'))).toBeLessThan(0.55);
  });

  it('after-streak: 빨강이 없으면 그리지 않는다', () => {
    const state = play({
      mode: 'spinner',
      device: { type: 'bag', marbles: [{ color: 'blue', count: 2 }] },
    });
    const { container } = render(<AfterStreakOverlay {...props(state)} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('after-streak: 5번 이어진 적이 없으면 안내 글만 두고 전체 막대는 그린다', () => {
    const state = play({
      mode: 'spinner',
      device: {
        type: 'bag',
        marbles: [
          { color: 'red', count: 1 },
          { color: 'blue', count: 10 },
          { color: 'yellow', count: 9 },
        ],
      },
    });
    const { container } = render(<AfterStreakOverlay {...props(state)} />);
    expect(container.querySelector('[data-part="after"]')).toBeNull();
    expect(container.textContent).toContain('5번 이어진 적이 없어요');
    expect(container.querySelector('[data-part="whole"]')).not.toBeNull();
  });
});
