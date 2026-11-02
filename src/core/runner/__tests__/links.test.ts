import { describe, expect, it } from 'vitest';
import type { EngineDefinition, LoadedEngine } from '../../engine-sdk';
import demoDefinition from '../../../engines/E00-demo';
import { observe } from '../../../engines/E00-demo/observe';
import {
  applyActionWithLinks,
  applyControl,
  createSlotHistories,
  observationsOf,
  statesOf,
} from '../links';
import type { SlotView } from '../links';

type BumpAction = { readonly type: 'bump' };
type BumpState = { readonly n: number };

const NullView: EngineDefinition<null, BumpState, BumpAction>['View'] = () => null;

function bumpEngine(id: 'E90' | 'E91', outEvent: string, receiveEvent: string): LoadedEngine {
  const definition: EngineDefinition<null, BumpState, BumpAction> = {
    id,
    name: id,
    modes: ['free'],
    createInitialState: () => ({ n: 0 }),
    reduce: (state) => ({ n: state.n + 1 }),
    View: NullView,
    observe: (state) => ({ n: state.n }),
    events: [outEvent],
    emit: () => [{ name: outEvent }],
    receive: (_state, event) => (event.name === receiveEvent ? { type: 'bump' } : null),
  };
  return definition as unknown as LoadedEngine;
}

const demoConfig = { gridSize: 100 };
const demoLoaded = demoDefinition as unknown as LoadedEngine;

describe('linkedViews', () => {
  it('E00 왼쪽 판에 놓으면 오른쪽 판에도 Action이 적용된다', () => {
    const views: SlotView[] = [
      { slot: 'left', definition: demoLoaded, config: demoConfig },
      { slot: 'right', definition: demoLoaded, config: demoConfig },
    ];
    const histories = createSlotHistories(views);
    const result = applyActionWithLinks(
      views,
      [{ from: 'left', event: 'counter-added', to: 'right' }],
      histories,
      'left',
      { type: 'add', x: 200, y: 300 },
    );

    expect(result.applied).toEqual([
      { slot: 'left', action: { type: 'add', x: 200, y: 300 } },
      { slot: 'right', action: { type: 'add', x: 200, y: 300 } },
    ]);
    const states = statesOf(result.histories);
    expect(
      observe(states['left'] as ReturnType<typeof demoDefinition.createInitialState>, {}),
    ).toEqual({ count: 1, groups: [] });
    expect(
      observe(states['right'] as ReturnType<typeof demoDefinition.createInitialState>, {}),
    ).toEqual({ count: 1, groups: [] });
    expect(observationsOf(views, result.histories)).toEqual({
      left: { count: 1, groups: [] },
      right: { count: 1, groups: [] },
    });
  });

  it('연결이 순환해도 같은 Action 처리 안에서 연결선을 한 번만 지난다', () => {
    const a = bumpEngine('E90', 'go', 'back');
    const b = bumpEngine('E91', 'back', 'go');
    const views: SlotView[] = [
      { slot: 'a', definition: a, config: null },
      { slot: 'b', definition: b, config: null },
    ];
    const result = applyActionWithLinks(
      views,
      [
        { from: 'a', event: 'go', to: 'b' },
        { from: 'b', event: 'back', to: 'a' },
      ],
      createSlotHistories(views),
      'a',
      { type: 'bump' },
    );

    expect(result.applied.map((item) => item.slot)).toEqual(['a', 'b', 'a']);
    expect(statesOf(result.histories)).toEqual({ a: { n: 2 }, b: { n: 1 } });
  });

  it('연결이 없으면 그 슬롯만 바꾼다', () => {
    const views: SlotView[] = [
      { slot: 'left', definition: demoLoaded, config: demoConfig },
      { slot: 'right', definition: demoLoaded, config: demoConfig },
    ];
    const result = applyActionWithLinks(views, [], createSlotHistories(views), 'left', {
      type: 'add',
      x: 100,
      y: 100,
    });
    expect(result.applied).toHaveLength(1);
    expect(observationsOf(views, result.histories)).toEqual({
      left: { count: 1, groups: [] },
      right: { count: 0, groups: [] },
    });
  });

  it('되돌리기·다시하기는 그 슬롯의 스냅숏만 움직인다', () => {
    const views: SlotView[] = [
      { slot: 'left', definition: demoLoaded, config: demoConfig },
      { slot: 'right', definition: demoLoaded, config: demoConfig },
    ];
    let histories = createSlotHistories(views);
    histories = applyActionWithLinks(
      views,
      [{ from: 'left', event: 'counter-added', to: 'right' }],
      histories,
      'left',
      { type: 'add', x: 100, y: 100 },
    ).histories;

    histories = applyControl(histories, 'left', 'undo');
    expect(observationsOf(views, histories)).toEqual({
      left: { count: 0, groups: [] },
      right: { count: 1, groups: [] },
    });

    histories = applyControl(histories, 'left', 'redo');
    expect(observationsOf(views, histories)).toEqual({
      left: { count: 1, groups: [] },
      right: { count: 1, groups: [] },
    });
  });
});
