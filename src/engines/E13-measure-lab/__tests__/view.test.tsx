/** @vitest-environment jsdom */
/** E13 화면 테스트: 정답 비노출(DOM·aria·data-), 키보드·단추 조작, 틈·겹침 표기, 오버레이 그림. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompareView } from '../compare/CompareView';
import { EndpointLinesOverlay } from '../compare/overlays/endpoint-lines';
import { HalfStraightenOverlay } from '../compare/overlays/half-straighten';
import { SameTankOverlay } from '../compare/overlays/same-tank';
import { createCompareState, reduceCompare } from '../compare/reduce';
import type { CompareAction, CompareConfig, CompareState } from '../compare/types';
import { GapMarksOverlay } from '../length/overlays/gap-marks';
import { SpanCompareOverlay } from '../length/overlays/span-compare';
import { LengthView } from '../length/LengthView';
import { createLengthState, reduceLength } from '../length/reduce';
import type { LengthAction, LengthConfig, MeasureState } from '../length/types';

afterEach(cleanup);

const ropes: CompareConfig = {
  mode: 'compare-direct',
  attribute: 'length',
  items: [
    { id: 'a', label: '밧줄 가', kind: 'rope', shape: 'curvy', length: 7 },
    { id: 'b', label: '밧줄 나', kind: 'rope', shape: 'straight', length: 6, offset: 2 },
  ],
  baseline: true,
  straighten: true,
};
const areas: CompareConfig = {
  mode: 'compare-direct',
  attribute: 'area',
  items: [
    { id: 'h', label: '손수건', kind: 'handkerchief', w: 4, h: 3 },
    { id: 'k', label: '책', kind: 'book', w: 3, h: 5 },
  ],
};
const cups: CompareConfig = {
  mode: 'compare-direct',
  attribute: 'capacity',
  items: [
    { id: 't', label: '키 큰 컵', kind: 'cup', shape: 'tall', capacity: 4 },
    { id: 'w', label: '넓은 컵', kind: 'cup', shape: 'wide', capacity: 6 },
  ],
  pour: true,
};
const pencil: LengthConfig = {
  mode: 'length',
  object: { name: 'pencil', lengthCm: 12 },
  units: ['clip-3cm', 'cm-block'],
  buildRuler: true,
};

function isDisabled(name: string): boolean {
  return (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;
}

function compare(config: CompareConfig, ...actions: CompareAction[]): CompareState {
  return actions.reduce(reduceCompare, createCompareState(config));
}

function length(config: LengthConfig, ...actions: LengthAction[]): MeasureState {
  return actions.reduce(reduceLength, createLengthState(config));
}

function renderCompare(state: CompareState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <CompareView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

function renderLength(state: MeasureState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <LengthView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}

/** 화면 좌표·학생이 만든 자리를 담은 data- 속성은 수학 값이 아니라 제외한다. */
const POSITION_ATTRIBUTES = new Set([
  'data-x',
  'data-y',
  'data-start',
  'data-index',
  'data-tick',
  'data-target-size',
]);

/** 글과 data-·aria- 속성값을 모두 모은다(결과가 어디에도 새지 않는지 볼 때 쓴다). */
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

const RESULT_WORDS = /더 긴|더 길|가장 긴|제일 긴|더 짧|더 많|더 넓|더 좁|정답|longest|larger|more/;

describe('정답 비노출', () => {
  it('길이 비교 시작 화면에 길이(7·6)와 비교 결과 글이 없다', () => {
    const { container } = renderCompare(compare(ropes));
    const text = everything(container);
    expect(text).not.toMatch(/\b(7|6)\b/);
    expect(text).not.toMatch(RESULT_WORDS);
    expect(container.querySelector('[data-length]')).toBeNull();
  });

  it('넓이·들이 시작 화면에도 칸 수(3·4·5·6)와 결과 글이 없다', () => {
    for (const config of [areas, cups]) {
      const { container, unmount } = renderCompare(compare(config));
      const text = everything(container);
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(RESULT_WORDS);
      unmount();
    }
  });

  it('붓고 난 뒤에도 어느 컵이 더 많은지 글로 쓰지 않는다', () => {
    const { container } = renderCompare(
      compare(cups, { type: 'pour', id: 't' }, { type: 'pour', id: 'w' }),
    );
    expect(everything(container)).not.toMatch(RESULT_WORDS);
    expect(everything(container)).not.toMatch(/\d/);
    expect(container.querySelectorAll('[data-part="tank-water"]')).toHaveLength(2);
  });

  it('length 시작 화면에 물건 길이(12)와 결과 글이 없고, 뼘 시연의 수만 보인다', () => {
    const plain = renderLength(length(pencil));
    expect(everything(plain.container)).not.toMatch(/\b12\b/);
    expect(everything(plain.container)).not.toMatch(RESULT_WORDS);
    plain.unmount();
    const demo = renderLength(
      length({ ...pencil, demoSpans: { objectName: 'desk', objectCm: 60 } }),
    );
    expect(demo.container.textContent).toContain('4번');
    expect(demo.container.textContent).toContain('5번');
    expect(everything(demo.container)).not.toMatch(/\b12\b/);
  });

  it('자를 만든 뒤에도 눈금 번호(정답)는 aria에 "N번째"로만 있고 값은 놓은 뒤에만 생긴다', () => {
    const blocks: LengthAction[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'add',
      unit: 'cm-block',
      start: String(i),
    }));
    const { container } = renderLength(length(pencil, ...blocks, { type: 'make-ruler' }));
    const ticks = container.querySelectorAll('[data-part="tick"]');
    expect(ticks).toHaveLength(11);
    expect(ticks[3]?.getAttribute('aria-label')).toContain('4번째');
    expect(container.querySelectorAll('[data-part="tick-value"]')).toHaveLength(0);
  });
});

describe('compare-direct 조작', () => {
  it('펴기 단추는 곡선 밧줄에만 있고 누르면 straighten Action을 보낸다', () => {
    const dispatch = vi.fn();
    renderCompare(compare(ropes), dispatch);
    expect(screen.queryByRole('button', { name: '밧줄 나 펴기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '밧줄 가 펴기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'straighten', id: 'a' });
  });

  it('이미 편 밧줄의 펴기 단추는 꺼지고 끌 손잡이도 없다', () => {
    renderCompare(compare(ropes, { type: 'straighten', id: 'a' }));
    expect(isDisabled('밧줄 가 펴기')).toBe(true);
    expect(screen.queryByRole('button', { name: '밧줄 가 끝 잡아당기기' })).toBeNull();
  });

  it('끝 손잡이에서 Enter를 누르면 펴고, 방향키로 물건을 한 칸씩 옮긴다', () => {
    const dispatch = vi.fn();
    renderCompare(compare(ropes), dispatch);
    fireEvent.keyDown(screen.getByRole('button', { name: '밧줄 가 끝 잡아당기기' }), {
      key: 'Enter',
    });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'straighten', id: 'a' });
    const item = screen.getByRole('button', { name: '밧줄 나. 방향키로 옮겨요' });
    fireEvent.keyDown(item, { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'b', x: '1', y: '4' });
    fireEvent.keyDown(item, { key: 'ArrowDown' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'b', x: '2', y: '5' });
  });

  it('판 밖으로 가는 키 조작은 이유를 알리고 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderCompare(compare(ropes), dispatch);
    fireEvent.keyDown(screen.getByRole('button', { name: '밧줄 가. 방향키로 옮겨요' }), {
      key: 'ArrowLeft',
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('판 밖');
  });

  it('붓기 단추: 컵마다 있고 부은 컵은 꺼진다', () => {
    const dispatch = vi.fn();
    renderCompare(compare(cups, { type: 'pour', id: 't' }), dispatch);
    expect(isDisabled('키 큰 컵의 물을 같은 수조에 붓기')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '넓은 컵의 물을 같은 수조에 붓기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'pour', id: 'w' });
  });

  it('pour가 꺼져 있으면 붓기 단추와 수조가 없다', () => {
    const { container } = renderCompare(compare({ ...cups, pour: false }));
    expect(screen.queryByRole('button', { name: /붓기/ })).toBeNull();
    expect(container.querySelector('[data-part="tank"]')).toBeNull();
  });

  it('넓이: 물건 둘을 키보드로 옮기고 겹치면 위에 놓은 쪽은 반투명', () => {
    const dispatch = vi.fn();
    const { container } = renderCompare(
      compare(areas, { type: 'place', id: 'h', x: '7', y: '3' }),
      dispatch,
    );
    expect(container.querySelectorAll('[data-part="item"]')).toHaveLength(2);
    const last = container.querySelector('[data-id="h"] [role="button"]');
    expect(last?.getAttribute('opacity')).toBe('0.62');
    fireEvent.keyDown(screen.getByRole('button', { name: '책. 방향키로 옮겨요' }), {
      key: 'ArrowRight',
    });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'place', id: 'k', x: '8', y: '3' });
  });

  it('읽기 전용이면 단추가 꺼지고 키 조작은 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderCompare(compare(ropes), dispatch, true);
    expect(isDisabled('밧줄 가 펴기')).toBe(true);
    expect(isDisabled('처음으로')).toBe(true);
    fireEvent.keyDown(screen.getByRole('button', { name: '밧줄 나. 방향키로 옮겨요' }), {
      key: 'ArrowLeft',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderCompare(createCompareState({ mode: 'compare-direct', attribute: 'length', items: [] }));
    expect(screen.getByTestId('measure-error').textContent).toContain('설정');
    expect(screen.queryByTestId('compare-canvas')).toBeNull();
  });
});

describe('length 조작', () => {
  it('트레이 단추를 누르면 끝에 붙여 놓는다(첫 조각은 0, 다음은 앞 조각 끝)', () => {
    const dispatch = vi.fn();
    const { rerender } = renderLength(length(pencil), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '클립 놓기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'add', unit: 'clip-3cm', start: '0' });
    rerender(
      <LengthView
        state={length(pencil, { type: 'add', unit: 'clip-3cm', start: '0' })}
        dispatch={dispatch}
        targetSize={48}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1cm 블록 놓기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'add', unit: 'cm-block', start: '3' });
  });

  it('Backspace는 마지막 조각을 지우고, Delete는 초점 조각을 지우고, ←→는 0.5cm씩 옮긴다', () => {
    const dispatch = vi.fn();
    const state = length(
      pencil,
      { type: 'add', unit: 'clip-3cm', start: '0' },
      { type: 'add', unit: 'clip-3cm', start: '3' },
    );
    const { container } = renderLength(state, dispatch);
    fireEvent.keyDown(container.firstElementChild as Element, { key: 'Backspace' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'remove', index: 1 });
    const first = screen.getByRole('button', { name: '1번째 조각, 클립' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move', index: 0, start: '1/2' });
    fireEvent.keyDown(first, { key: 'Delete' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'remove', index: 0 });
  });

  it('띠 왼쪽 밖으로 가는 키 조작은 거절하고 이유를 알린다', () => {
    const dispatch = vi.fn();
    renderLength(length(pencil, { type: 'add', unit: 'clip-3cm', start: '0' }), dispatch);
    fireEvent.keyDown(screen.getByRole('button', { name: '1번째 조각, 클립' }), {
      key: 'ArrowLeft',
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('띠 밖');
  });

  it('[자 만들기]는 블록 10개가 이어지기 전에는 꺼져 있다', () => {
    const blocks: LengthAction[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'add',
      unit: 'cm-block',
      start: String(i),
    }));
    const first = renderLength(length(pencil, ...blocks.slice(0, 9)));
    expect(isDisabled('자 만들기')).toBe(true);
    first.unmount();
    const dispatch = vi.fn();
    renderLength(length(pencil, ...blocks), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '자 만들기' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'make-ruler' });
  });

  it('buildRuler가 꺼져 있으면 자 만들기 단추가 없다', () => {
    renderLength(length({ ...pencil, buildRuler: false }));
    expect(screen.queryByRole('button', { name: '자 만들기' })).toBeNull();
  });

  it('눈금에서 숫자 키로 놓고, 카드를 고른 뒤 눈금에서 Enter로도 놓는다(10은 1·0)', () => {
    const blocks: LengthAction[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'add',
      unit: 'cm-block',
      start: String(i),
    }));
    const dispatch = vi.fn();
    renderLength(length(pencil, ...blocks, { type: 'make-ruler' }), dispatch);
    const tick = screen.getByRole('button', { name: /^왼쪽에서 3번째 눈금/ });
    fireEvent.keyDown(tick, { key: '2' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'label', tick: 2, value: 2 });
    const last = screen.getByRole('button', { name: /^왼쪽에서 11번째 눈금/ });
    fireEvent.keyDown(last, { key: '1' });
    fireEvent.keyDown(last, { key: '0' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'label', tick: 10, value: 10 });
    // 카드 선택은 화면 상태라 dispatch 전에는 눈금 Enter가 아무것도 하지 않는다.
    dispatch.mockClear();
    fireEvent.keyDown(tick, { key: 'Enter' });
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '숫자 5' }));
    expect(screen.getByRole('button', { name: '숫자 5' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.keyDown(tick, { key: 'Enter' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'label', tick: 2, value: 5 });
  });

  it('자를 만든 뒤에는 단위 단추가 꺼진다', () => {
    const blocks: LengthAction[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'add',
      unit: 'cm-block',
      start: String(i),
    }));
    renderLength(length(pencil, ...blocks, { type: 'make-ruler' }));
    expect(isDisabled('클립 놓기')).toBe(true);
  });

  it('틈은 "틈" 글과 빗금 무늬, 겹침은 "겹침" 글과 줄무늬로 보인다(showGapOverlap)', () => {
    const state = length(
      pencil,
      { type: 'add', unit: 'clip-3cm', start: '0' },
      { type: 'add', unit: 'clip-3cm', start: '4' },
      { type: 'add', unit: 'clip-3cm', start: '6' },
    );
    const { container } = renderLength(state);
    expect(container.querySelectorAll('[data-part="gap"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="overlap"]')).toHaveLength(1);
    expect(container.querySelector('[data-part="gap"] text')?.textContent).toBe('틈');
    expect(container.querySelector('[data-part="overlap"] text')?.textContent).toBe('겹침');
    expect(container.querySelector('[data-part="gap"] rect')?.getAttribute('fill')).toContain(
      'url(#',
    );
  });

  it('showGapOverlap이 false면 틈·겹침을 그리지 않는다', () => {
    const { container } = renderLength(
      length(
        { ...pencil, showGapOverlap: false },
        { type: 'add', unit: 'clip-3cm', start: '0' },
        { type: 'add', unit: 'clip-3cm', start: '4' },
      ),
    );
    expect(container.querySelector('[data-part="gap-overlap-marks"]')).toBeNull();
  });

  it('읽기 전용이면 단추가 모두 꺼진다', () => {
    const dispatch = vi.fn();
    renderLength(length(pencil), dispatch, true);
    expect(isDisabled('클립 놓기')).toBe(true);
    expect(isDisabled('처음으로')).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('힌트 ② 오버레이', () => {
  it('endpoint-lines: 어긋난 물건에 괄호와 "어긋남", 모두 맞추면 그리지 않는다', () => {
    const { container, unmount } = render(
      <EndpointLinesOverlay config={{}} state={compare(ropes)} />,
    );
    expect(container.querySelectorAll('[data-part="endpoint"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="bracket"]')).toHaveLength(1);
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('어긋남');
    unmount();
    const aligned = compare(
      ropes,
      { type: 'place', id: 'a', x: '0', y: '2' },
      { type: 'place', id: 'b', x: '0', y: '4' },
    );
    const empty = render(<EndpointLinesOverlay config={{}} state={aligned} />);
    expect(empty.container.querySelector('svg')).toBeNull();
  });

  it('endpoint-lines는 넓이·들이에서는 그리지 않는다', () => {
    const { container } = render(<EndpointLinesOverlay config={{}} state={compare(areas)} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('half-straighten: id의 곡선 밧줄만 그리고, 폈거나 id가 없으면 그리지 않는다', () => {
    const drawn = render(
      <HalfStraightenOverlay config={{}} state={compare(ropes)} args={{ id: 'a' }} />,
    );
    expect(drawn.container.querySelector('[data-part="half-preview"] path')).not.toBeNull();
    expect(drawn.container.querySelector('path')?.getAttribute('stroke-dasharray')).toBeTruthy();
    drawn.unmount();
    for (const [state, args] of [
      [compare(ropes), undefined],
      [compare(ropes), { id: 'b' }],
      [compare(ropes), { id: 'zzz' }],
      [compare(ropes, { type: 'straighten', id: 'a' }), { id: 'a' }],
    ] as const) {
      const none = render(<HalfStraightenOverlay config={{}} state={state} args={args} />);
      expect(none.container.querySelector('svg')).toBeNull();
      none.unmount();
    }
  });

  it('same-tank: 두 컵 아래에 점선 수조와 화살표·글을 그리고 물 높이는 그리지 않는다', () => {
    const { container } = render(<SameTankOverlay config={{}} state={compare(cups)} />);
    expect(container.querySelectorAll('[data-part="tank-outline"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="arrow"]')).toHaveLength(2);
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe(
      '같은 수조에 부어 봐요',
    );
    expect(
      container.querySelector('[data-part="tank-outline"]')?.getAttribute('stroke-dasharray'),
    ).toBeTruthy();
    expect(container.querySelector('[data-part="tank-water"]')).toBeNull();
  });

  it('gap-marks: 틈·겹침이 있을 때만 "틈"·"겹침"을 크게 그린다', () => {
    const state = length(
      pencil,
      { type: 'add', unit: 'clip-3cm', start: '0' },
      { type: 'add', unit: 'clip-3cm', start: '4' },
      { type: 'add', unit: 'clip-3cm', start: '6' },
    );
    const { container, unmount } = render(<GapMarksOverlay config={{}} state={state} />);
    expect(container.querySelector('[data-part="gap-mark"] text')?.textContent).toBe('틈');
    expect(container.querySelector('[data-part="overlap-mark"] text')?.textContent).toBe('겹침');
    unmount();
    const exact = length(
      pencil,
      { type: 'add', unit: 'clip-3cm', start: '0' },
      { type: 'add', unit: 'clip-3cm', start: '3' },
    );
    expect(
      render(<GapMarksOverlay config={{}} state={exact} />).container.querySelector('svg'),
    ).toBeNull();
    expect(
      render(<GapMarksOverlay config={{}} state={length(pencil)} />).container.querySelector('svg'),
    ).toBeNull();
  });

  it('span-compare: demoSpans가 있을 때만 두 뼘을 왼쪽 끝을 맞춰 그리고 길이 숫자는 쓰지 않는다', () => {
    const state = length({ ...pencil, demoSpans: { objectName: 'desk', objectCm: 60 } });
    const { container, unmount } = render(<SpanCompareOverlay config={{}} state={state} />);
    const spans = container.querySelectorAll('[data-part="span"]');
    expect(spans).toHaveLength(2);
    expect(spans[0]?.getAttribute('x')).toBe(spans[1]?.getAttribute('x'));
    expect(Number(spans[0]?.getAttribute('width'))).toBeGreaterThan(
      Number(spans[1]?.getAttribute('width')),
    );
    expect(container.textContent).toBe('두 뼘의 크기');
    expect(container.textContent).not.toMatch(/\d/);
    unmount();
    expect(
      render(<SpanCompareOverlay config={{}} state={length(pencil)} />).container.querySelector(
        'svg',
      ),
    ).toBeNull();
  });
});
