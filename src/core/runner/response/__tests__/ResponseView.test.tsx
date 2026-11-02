// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createInitialState, observe, reduce } from '..';
import { ResponseView } from '../ResponseView';
import { responseStrings } from '../strings.ko';
import type { NumberForm, ResponseAction, ResponseConfig } from '..';

afterEach(cleanup);

function Harness({
  configuration,
  readOnly = false,
}: {
  configuration: ResponseConfig;
  readOnly?: boolean;
}) {
  const [state, setState] = useState(() => createInitialState(configuration));
  return (
    <>
      <ResponseView
        config={configuration}
        state={state}
        dispatch={(action: ResponseAction) => setState((current) => reduce(current, action))}
        cpa="A"
        mode="response"
        targetSize={48}
        readOnly={readOnly}
      />
      <output data-testid="obs">{JSON.stringify(observe(state, configuration))}</output>
    </>
  );
}

function observation(): string {
  return screen.getByTestId('obs').textContent ?? '';
}

function numberConfig(forms: readonly NumberForm[]): ResponseConfig {
  return { fields: [{ kind: 'number', id: 'ans', label: '합', forms }] };
}

describe('응답 화면', () => {
  it('키패드와 칸 고르기로 분수를 쓴다', () => {
    render(<Harness configuration={numberConfig(['fraction'])} />);
    const panel = screen.getByTestId('response');

    for (const key of ['4']) fireEvent.click(within(panel).getByRole('button', { name: key }));
    fireEvent.click(within(panel).getByRole('button', { name: '분모: 빈칸' }));
    for (const key of ['1', '0']) fireEvent.click(within(panel).getByRole('button', { name: key }));

    expect(observation()).toContain('"raw":"4/10"');
    expect(observation()).toContain('"value":"2/5"');
    expect(within(panel).getByRole('button', { name: '분자: 4' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: '분모: 10' })).toBeDefined();
  });

  it('실제 키보드로 분수를 쓰고 지운다', () => {
    render(<Harness configuration={numberConfig(['fraction'])} />);
    const widget = screen.getByTestId('response').querySelector('[data-response-kind="number"]');
    if (!widget) throw new Error('수 입력 위젯이 없습니다.');

    fireEvent.keyDown(widget, { key: '5' });
    fireEvent.keyDown(widget, { key: '/' });
    fireEvent.keyDown(widget, { key: '6' });
    expect(observation()).toContain('"raw":"5/6"');

    fireEvent.keyDown(widget, { key: 'Backspace' });
    expect(observation()).toContain('"raw":"5/"');
    fireEvent.keyDown(widget, { key: 'Delete' });
    expect(observation()).toContain('"raw":"5/"');
    fireEvent.keyDown(widget, { key: 'Escape' });
    expect(observation()).toContain('"raw":"5/"');
  });

  it('입력 틀 단추로 소수와 분수를 바꾼다', () => {
    render(<Harness configuration={numberConfig(['fraction', 'decimal'])} />);
    const panel = screen.getByTestId('response');
    fireEvent.click(within(panel).getByRole('button', { name: responseStrings.forms.decimal }));
    fireEvent.click(within(panel).getByRole('button', { name: '0' }));
    fireEvent.click(within(panel).getByRole('button', { name: '.' }));
    fireEvent.click(within(panel).getByRole('button', { name: '5' }));
    expect(observation()).toContain('"raw":"0.5"');
    expect(observation()).toContain('"value":"1/2"');
  });

  it('보기·순서·부등호·카드 분류를 조작한다', () => {
    const configuration: ResponseConfig = {
      fields: [
        {
          kind: 'choice',
          id: 'pick',
          label: '그림',
          multiple: false,
          options: [
            { id: 'a', label: '가' },
            { id: 'b', label: '나' },
          ],
        },
        {
          kind: 'order',
          id: 'seq',
          label: '차례',
          items: [
            { id: 'b', label: '2/3' },
            { id: 'c', label: '3/4' },
            { id: 'a', label: '1/2' },
          ],
        },
        { kind: 'compare', id: 'cmp', label: '부등호', left: '3/5', right: '2/3' },
        {
          kind: 'sort',
          id: 'sort',
          label: '카드',
          cards: [
            { id: 'a', label: '3/4' },
            { id: 'b', label: '5/4' },
          ],
          bins: [
            { id: 'small', label: '작아요' },
            { id: 'large', label: '커요' },
          ],
        },
      ],
    };
    render(<Harness configuration={configuration} />);
    const panel = screen.getByTestId('response');

    fireEvent.click(within(panel).getByRole('button', { name: '가' }));
    expect(observation()).toContain('"selected":["a"]');

    fireEvent.click(within(panel).getByRole('button', { name: '1/2 위로' }));
    expect(observation()).toContain('"order":["b","a","c"]');
    fireEvent.click(within(panel).getByRole('button', { name: '1/2 위로' }));
    expect(observation()).toContain('"order":["a","b","c"]');

    fireEvent.click(within(panel).getByRole('button', { name: '작다' }));
    expect(observation()).toContain('"symbol":"<"');

    fireEvent.click(within(panel).getByRole('button', { name: '3/4 옮길 카드로 고르기' }));
    fireEvent.click(within(panel).getByRole('button', { name: '작아요 여기에 놓기' }));
    expect(observation()).toContain('"bins":{"large":[],"small":["a"]}');
    expect(observation()).toContain('"unsorted":["b"]');
  });

  it('정답을 보여 주는 단추·문구가 없다', () => {
    const { container } = render(<Harness configuration={numberConfig(['fraction', 'mixed'])} />);
    expect(container.textContent ?? '').not.toContain('5/6');
    expect(screen.queryByRole('button', { name: /정답/ })).toBeNull();
    expect(JSON.stringify(responseStrings)).not.toContain('정답');
    expect(container.querySelectorAll('[data-answer], [data-solution]')).toHaveLength(0);
  });

  it('채점이 끝난 화면은 조작할 수 없다', () => {
    render(<Harness configuration={numberConfig(['fraction'])} readOnly />);
    const panel = screen.getByTestId('response');
    for (const button of within(panel).getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
