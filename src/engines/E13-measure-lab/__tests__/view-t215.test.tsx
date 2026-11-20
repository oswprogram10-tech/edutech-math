/** @vitest-environment jsdom */
/** E13 T215 화면 테스트: roll-circle 시작 화면에 원주·비 숫자가 없고, 단추·기록표·오버레이가 그려진다. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiameterColumnOverlay } from '../length/roll-circle/overlays/diameter-column';
import { PiPrecisionOverlay } from '../length/roll-circle/overlays/pi-precision';
import { createRollState, reduceRoll } from '../length/roll-circle/reduce';
import { RollView } from '../length/roll-circle/RollView';
import type { RollAction, RollConfig, RollState } from '../length/roll-circle/types';

afterEach(cleanup);

const config: RollConfig = { mode: 'length', variant: 'roll-circle' };

function make(extra: Partial<RollConfig> = {}, ...actions: RollAction[]): RollState {
  return actions.reduce(reduceRoll, createRollState({ ...config, ...extra }));
}

function renderView(state: RollState, dispatch = vi.fn(), readOnly = false) {
  return render(<RollView state={state} dispatch={dispatch} targetSize={48} readOnly={readOnly} />);
}

/** 글과 data-·aria- 속성값을 모은다(좌표 같은 그림 속성은 제외). */
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

const SECRETS = /6\.3|9\.4|15\.7|25\.1|31\.4|3\.14|3\.15|3\.13/;

describe('roll-circle 화면', () => {
  it('시작 DOM에는 원주·비 숫자가 없다(지름 단추 글만 있다)', () => {
    const { container } = renderView(make());
    expect(everything(container)).not.toMatch(SECRETS);
    expect(screen.getByRole('button', { name: '지름 2cm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '지름 10cm' })).toBeTruthy();
    expect(container.querySelector('[data-part="mark"]')).toBeNull();
  });

  it('굴리기만 하고 기록하지 않았을 때도 원주 숫자가 글·aria·data-에 없다', () => {
    const { container } = renderView(make({}, { type: 'roll' }));
    expect(everything(container)).not.toMatch(SECRETS);
    expect(container.querySelectorAll('[data-part="mark"]')).toHaveLength(2);
  });

  it('기록한 뒤에만 표 칸에 값이 보인다', () => {
    const { container } = renderView(make({}, { type: 'roll' }, { type: 'record' }));
    const cells = [...container.querySelectorAll('[data-part="cell"]')].map((n) => n.textContent);
    expect(cells).toEqual(['2', '6.3', '3.15']);
  });

  it('단추가 Action을 보낸다(굴리기·지름 고르기·기록하기·막대)', () => {
    const dispatch = vi.fn();
    renderView(make({}, { type: 'roll' }), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '지름 막대 잇기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'stick', delta: 1 });
    fireEvent.click(screen.getByRole('button', { name: '기록하기' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'record' });
    fireEvent.click(screen.getByRole('button', { name: '지름 5cm' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'choose', d: '5' });
  });

  it('굴리기 전 막대·다시 굴리기는 안내 글만 보이고 Action을 보내지 않는다', () => {
    const dispatch = vi.fn();
    const { rerender } = renderView(make(), dispatch);
    fireEvent.click(screen.getByRole('button', { name: '지름 막대 잇기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('먼저');
    rerender(<RollView state={make({}, { type: 'roll' })} dispatch={dispatch} targetSize={48} />);
    fireEvent.click(screen.getByRole('button', { name: '굴리기' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-message').textContent).toContain('이미 굴렸어요');
  });

  it('굴렁쇠에서 Enter·Space로도 굴린다', () => {
    const dispatch = vi.fn();
    renderView(make(), dispatch);
    const ring = screen.getByRole('button', { name: /굴렁쇠/ });
    fireEvent.keyDown(ring, { key: 'Enter' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'roll' });
    fireEvent.keyDown(ring, { key: ' ' });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('도구를 끄면 막대 단추·기록 단추·기록표가 없다', () => {
    const { container } = renderView(make({ diameterStickTool: false, log: false }));
    expect(screen.queryByRole('button', { name: '지름 막대 잇기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '기록하기' })).toBeNull();
    expect(container.querySelector('[data-part="log-table"]')).toBeNull();
  });

  it('막대 4개: 네 번째 막대는 자국을 넘는 부분이 빗금으로 보인다', () => {
    const plus: RollAction = { type: 'stick', delta: 1 };
    const three = renderView(make({}, { type: 'roll' }, plus, plus, plus));
    expect(three.container.querySelectorAll('[data-part="stick"]')).toHaveLength(3);
    expect(three.container.querySelector('[data-part="overflow"]')).toBeNull();
    cleanup();
    const four = renderView(make({}, { type: 'roll' }, plus, plus, plus, plus));
    expect(four.container.querySelectorAll('[data-part="stick"]')).toHaveLength(4);
    expect(four.container.querySelectorAll('[data-part="overflow"]')).toHaveLength(1);
  });

  it('설정 오류면 오류 문구만 보인다', () => {
    renderView(make({ diameters: ['11'] }));
    expect(screen.getByTestId('measure-error')).toBeTruthy();
  });

  it('읽기 전용이면 단추를 못 누른다', () => {
    const dispatch = vi.fn();
    renderView(make(), dispatch, true);
    expect((screen.getByRole('button', { name: '굴리기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('roll-circle 오버레이', () => {
  const overlayProps = (state: RollState) => ({
    config,
    state,
    observation: {},
  });

  it('diameter-column: 기록이 0줄이어도 지름 칸(머리칸)에 그리고 "지름" 꼬리표를 단다', () => {
    const state = make();
    const { container } = render(<DiameterColumnOverlay {...overlayProps(state)} />);
    expect(container.querySelector('[data-part="column"]')).not.toBeNull();
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('지름');
  });

  it('diameter-column: 기록표가 없으면 그리지 않는다', () => {
    const { container } = render(<DiameterColumnOverlay {...overlayProps(make({ log: false }))} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('pi-precision: 기록이 2줄보다 적으면 아무것도 그리지 않는다', () => {
    const none = render(<PiPrecisionOverlay {...overlayProps(make())} />);
    expect(none.container.querySelector('svg')).toBeNull();
    cleanup();
    const one = render(
      <PiPrecisionOverlay {...overlayProps(make({}, { type: 'roll' }, { type: 'record' }))} />,
    );
    expect(one.container.querySelector('svg')).toBeNull();
  });

  it('pi-precision: 2줄부터 줄마다 비를 0.001로 보인다', () => {
    const state = make(
      {},
      { type: 'roll' },
      { type: 'record' },
      { type: 'choose', d: '3' },
      { type: 'roll' },
      { type: 'record' },
    );
    const { container } = render(<PiPrecisionOverlay {...overlayProps(state)} />);
    const cells = [...container.querySelectorAll('[data-part="cell"]')].map((n) => n.textContent);
    expect(cells).toEqual(['3.150', '3.133']);
    expect(container.querySelector('[data-part="head"]')?.textContent).toContain('0.001');
  });
});
