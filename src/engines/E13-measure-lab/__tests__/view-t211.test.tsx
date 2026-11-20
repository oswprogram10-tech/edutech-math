/** @vitest-environment jsdom */
/** E13 T211 화면 테스트: map-route 정답 비노출·조작, estimate 확대(zoomLevels) 그림, mm-count 오버레이. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EstimateView } from '../estimate/EstimateView';
import { MmCountOverlay } from '../estimate/overlays/mm-count';
import { createEstimateState, reduceEstimate } from '../estimate/reduce';
import type { EstimateAction, EstimateConfig, EstimateState } from '../estimate/types';
import { RouteView } from '../route/RouteView';
import { createRouteState, reduceRoute } from '../route/reduce';
import type { RouteAction, RouteConfig, RouteState } from '../route/types';

afterEach(cleanup);

const pencilLead: EstimateConfig = {
  mode: 'estimate',
  object: { name: 'pencil', lengthCm: '3.7' },
  ruler: { offsetCm: 0, draggable: true },
  zoomLevels: ['cm', 'mm'],
};
const town: RouteConfig = {
  mode: 'map-route',
  map: 'sample-town-01',
  segmentsM: { 'school-library': 450, 'library-park': 620, 'school-park': 980 },
  targetM: 1000,
  from: 'school',
};

function estimate(config: EstimateConfig, ...actions: EstimateAction[]): EstimateState {
  return actions.reduce(reduceEstimate, createEstimateState(config));
}
function route(config: RouteConfig, ...actions: RouteAction[]): RouteState {
  return actions.reduce(reduceRoute, createRouteState(config));
}
const seg = (key: string): RouteAction => ({ type: 'add-segment', key });

function renderEstimate(state: EstimateState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <EstimateView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
  );
}
function renderRoute(state: RouteState, dispatch = vi.fn(), readOnly = false) {
  return render(
    <RouteView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />,
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

describe('estimate 확대(zoomLevels)', () => {
  it('시작 화면 DOM·aria·data-에 37(mm 길이)이 없고, 확대 칸은 안내 글만 있다', () => {
    const { container } = renderEstimate(estimate(pencilLead));
    const text = everything(container);
    expect(text).not.toMatch(/37|3\.7|3,7/);
    expect(container.querySelector('[data-part="zoom"]')?.getAttribute('data-zoomed')).toBe(
      'false',
    );
    expect(container.querySelectorAll('[data-part="zoom-tick"]')).toHaveLength(0);
  });

  it('[눈금 크게]를 누르면 zoom {on:true}를 보내고, 확대 중에는 [눈금 작게]가 된다', () => {
    const dispatch = vi.fn();
    const { unmount } = renderEstimate(estimate(pencilLead), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '눈금 크게' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'zoom', on: true });
    unmount();
    const off = vi.fn();
    renderEstimate(estimate(pencilLead, { type: 'zoom', on: true }), off);
    expect(screen.queryByRole('button', { name: '눈금 크게' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '눈금 작게' }));
    expect(off).toHaveBeenCalledWith({ type: 'zoom', on: false });
  });

  it('확대하면 2cm 구간에 1mm 눈금 21개(10칸 + 양끝), cm 숫자 둘만 있고 mm 숫자는 없다', () => {
    const { container } = renderEstimate(estimate(pencilLead, { type: 'zoom', on: true }));
    const ticks = [...container.querySelectorAll('[data-part="zoom-tick"]')];
    expect(ticks).toHaveLength(21);
    expect(ticks.filter((t) => t.getAttribute('data-kind') === 'cm')).toHaveLength(2);
    // 5mm 눈금은 mm 눈금보다 길다.
    const length = (tick: Element) => {
      const line = tick.querySelector('line');
      return Math.abs(Number(line?.getAttribute('y2')) - Number(line?.getAttribute('y1')));
    };
    const half = ticks.find((t) => t.getAttribute('data-kind') === 'half');
    const mm = ticks.find((t) => t.getAttribute('data-kind') === 'mm');
    const whole = ticks.find((t) => t.getAttribute('data-kind') === 'cm');
    expect(length(half as Element)).toBeGreaterThan(length(mm as Element));
    expect(length(whole as Element)).toBeGreaterThan(length(half as Element));
    // 3.7cm 끝의 확대 구간은 2.7~4.7: 숫자 3과 4만, "37"은 어디에도 없다.
    const numerals = [...container.querySelectorAll('[data-part="zoom-tick"] text')].map(
      (t) => t.textContent,
    );
    expect(numerals).toEqual(['3', '4']);
    expect(everything(container)).not.toMatch(/\b37\b|3\.7/);
    // 물건 끝 표시선이 확대 그림 가운데에 있다.
    expect(container.querySelector('[data-part="zoom-end"]')).not.toBeNull();
    expect(container.querySelector('[data-part="zoom-object"]')).not.toBeNull();
  });

  it('확대 구간의 숫자는 물건 끝(눈금 위치)에 따라 바뀐다(끝 6.7이면 6과 7)', () => {
    const { container } = renderEstimate(
      estimate(
        { ...pencilLead, object: { name: 'pencil', lengthCm: '6.7' } },
        { type: 'zoom', on: true },
      ),
    );
    const numerals = [...container.querySelectorAll('[data-part="zoom-tick"] text')].map(
      (t) => t.textContent,
    );
    expect(numerals).toEqual(['6', '7']);
  });

  it('끝이 정수 cm이면 가운데 눈금이 cm 눈금이고 숫자 셋이다(끝 4.0이면 3, 4, 5)', () => {
    const { container } = renderEstimate(
      estimate(
        { ...pencilLead, object: { name: 'pencil', lengthCm: '4' } },
        { type: 'zoom', on: true },
      ),
    );
    const numerals = [...container.querySelectorAll('[data-part="zoom-tick"] text')].map(
      (t) => t.textContent,
    );
    expect(numerals).toEqual(['3', '4', '5']);
  });

  it('zoomLevels가 없으면 확대 칸과 [눈금 크게] 단추가 없다', () => {
    const { container } = renderEstimate(estimate({ ...pencilLead, zoomLevels: ['cm'] }));
    expect(container.querySelector('[data-part="zoom"]')).toBeNull();
    expect(screen.queryByRole('button', { name: '눈금 크게' })).toBeNull();
  });

  it('어림 먼저에서 어림을 넣기 전에 [눈금 크게]를 누르면 이유를 알리고 Action을 보내지 않는다', () => {
    const dispatch = vi.fn();
    renderEstimate(estimate({ ...pencilLead, estimateFirst: true }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '눈금 크게' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('어림');
  });

  it('읽기 전용에서는 [눈금 크게]가 눌리지 않는다', () => {
    const dispatch = vi.fn();
    renderEstimate(estimate(pencilLead), dispatch, true);
    expect((screen.getByRole('button', { name: '눈금 크게' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('mm-count 오버레이', () => {
  const props = (state: EstimateState) => ({ config: pencilLead, state });

  it('1cm 막대에 mm 칸 10개를 1~10으로 번호 붙이고, 과제 값과 무관한 고정 그림이다', () => {
    const { container } = render(<MmCountOverlay {...props(estimate(pencilLead))} />);
    const cells = [...container.querySelectorAll('[data-part="mm-cell"] text')].map(
      (t) => t.textContent,
    );
    expect(cells).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('1cm');
    // 다른 길이여도 같은 그림.
    cleanup();
    const other = render(
      <MmCountOverlay
        {...props(estimate({ ...pencilLead, object: { name: 'pencil', lengthCm: '8.2' } }))}
      />,
    );
    expect(other.container.querySelectorAll('[data-part="mm-cell"]')).toHaveLength(10);
  });

  it('mm 확대가 없는 설정이나 설정 오류에서는 그리지 않는다', () => {
    expect(
      render(<MmCountOverlay {...props(estimate({ ...pencilLead, zoomLevels: ['cm'] }))} />)
        .container.firstChild,
    ).toBeNull();
    cleanup();
    expect(
      render(<MmCountOverlay {...props(estimate({ ...pencilLead, zoomLevels: ['x'] }))} />)
        .container.firstChild,
    ).toBeNull();
  });
});

describe('map-route 화면', () => {
  it('DOM·aria·data-에 경로 합계(1070·980 등)가 없다. 구간 길이 글만 있다', () => {
    const state = route(town, seg('school-library'), seg('library-park'));
    const { container } = renderRoute(state);
    const text = everything(container);
    expect(text).not.toMatch(/1070|1,070|1\.07|980\s*[+=]|합계|합/);
    // 문제에 주어진 구간 길이 글은 있다.
    const labels = [...container.querySelectorAll('[data-part="road"] text')].map(
      (t) => t.textContent,
    );
    expect(labels).toEqual(['450m', '620m', '980m']);
    // 목표 눈금 이름표
    expect(container.querySelector('[data-part="goal-label"]')?.textContent).toBe('1km');
  });

  it('칠한 막대는 합만큼 그려지되 숫자 글은 없다', () => {
    const none = renderRoute(route(town));
    expect(none.container.querySelector('[data-part="goal-fill"]')).toBeNull();
    cleanup();
    const some = renderRoute(route(town, seg('school-park')));
    const fill = some.container.querySelector('[data-part="goal-fill"]');
    expect(Number(fill?.getAttribute('width'))).toBeCloseTo((980 / 1200) * 800, 1);
    expect(fill?.textContent).toBe('');
  });

  it('쓴 길은 표시가 바뀌고(색 말고 data-used와 aria-pressed로도) 단추도 눌린 모양이다', () => {
    const state = route(town, seg('school-library'));
    const { container } = renderRoute(state);
    const used = [...container.querySelectorAll('[data-part="road"]')].filter(
      (road) => road.getAttribute('data-used') === 'true',
    );
    expect(used).toHaveLength(1);
    expect(screen.getByRole('button', { name: '학교–도서관' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '도서관–공원' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('구간 단추를 누르면 add-segment를 보내고, 닿지 않은 구간·이미 쓴 구간은 이유를 알린다', () => {
    const dispatch = vi.fn();
    const { unmount } = renderRoute(route(town), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '학교–도서관' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'add-segment', key: 'school-library' });
    dispatch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '도서관–공원' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('이어진 길이 아니에요');
    unmount();
    const again = vi.fn();
    renderRoute(route(town, seg('school-library')), again);
    fireEvent.click(screen.getByRole('button', { name: '학교–도서관' }));
    expect(again).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('이미 지나온');
  });

  it('길(선)을 눌러도 구간이 이어진다', () => {
    const dispatch = vi.fn();
    const { container } = renderRoute(route(town), dispatch);
    const hit = container.querySelector('[data-part="road"] [data-part="road-hit"]');
    fireEvent.click(hit as Element);
    expect(dispatch).toHaveBeenCalledWith({ type: 'add-segment', key: 'school-library' });
  });

  it('출발이 정해지지 않았으면 출발 단추(와 노드)를 먼저 보이고, 출발하면 길 단추로 바뀐다', () => {
    const dispatch = vi.fn();
    const free = { ...town, from: undefined };
    const { container, unmount } = renderRoute(route(free), dispatch);
    expect(screen.queryByRole('button', { name: '학교–도서관' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '도서관에서 출발' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'start', node: 'library' });
    // 지도의 노드를 눌러도 출발한다.
    dispatch.mockClear();
    fireEvent.click(container.querySelector('[data-node="park"]') as Element);
    expect(dispatch).toHaveBeenCalledWith({ type: 'start', node: 'park' });
    unmount();
    renderRoute(route(free, { type: 'start', node: 'school' }));
    expect(screen.getByRole('button', { name: '학교–도서관' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '도서관에서 출발' })).toBeNull();
  });

  it('[하나 지우기]·[처음으로]가 undo·reset을 보내고, 지울 것이 없으면 이유를 알린다', () => {
    const dispatch = vi.fn();
    const { unmount } = renderRoute(route(town), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '하나 지우기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('지울 길이 없어요');
    unmount();
    const go = vi.fn();
    renderRoute(route(town, seg('school-park')), go);
    fireEvent.click(screen.getByRole('button', { name: '하나 지우기' }));
    expect(go).toHaveBeenCalledWith({ type: 'undo' });
    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(go).toHaveBeenCalledWith({ type: 'reset' });
  });

  it('설정 오류이면 오류 문구만 보인다', () => {
    renderRoute(route({ ...town, segmentsM: { 'school-zoo': 5 } }));
    expect(screen.getByTestId('measure-error')).not.toBeNull();
    expect(screen.queryByTestId('route-canvas')).toBeNull();
  });

  it('읽기 전용이면 단추가 모두 꺼진다', () => {
    renderRoute(route(town), vi.fn(), true);
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
