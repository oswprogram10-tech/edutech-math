import { describe, expect, it } from 'vitest';
import { createHistory, pushHistory, redoHistory, undoHistory } from '../../engine-sdk';
import type { LoadedEngine } from '../../engine-sdk';
import type { DemoAction, DemoState } from '../../../engines/E00-demo/types';
import demoDefinition from '../../../engines/E00-demo';
import type { LearningEvent, JsonObject } from '../../storage';
import { applyActionWithLinks, applyControl, createSlotHistories, observationsOf } from '../links';
import { toJsonValue } from '../json';
import type { SlotView } from '../links';
import { ReplayError, replaySlots, replayTask } from '../replay';

const config = { gridSize: 100 };
const demoLoaded = demoDefinition as unknown as LoadedEngine;

function acted(slot: string, data: JsonObject, id: string): LearningEvent {
  return {
    id,
    t: Number(id.replace(/\D/g, '')) || 1,
    learner: '0',
    unit: 'demo',
    task: 'demo.A1.T1',
    engine: 'E00',
    verb: 'acted',
    data: { slot, ...data },
  };
}

function actionEvent(slot: string, action: DemoAction, id: string): LearningEvent {
  return acted(slot, { action: toJsonValue(action) }, id);
}

function controlEvent(slot: string, control: 'undo' | 'redo', id: string): LearningEvent {
  return acted(slot, { control }, id);
}

describe('replayTask', () => {
  it('놓기·옮기기·묶기·되돌리기·다시하기 기록으로 같은 상태를 만든다', () => {
    let history = createHistory<DemoState>(demoDefinition.createInitialState(config));
    const events: LearningEvent[] = [];

    const run = (action: DemoAction) => {
      events.push(actionEvent('main', action, `a${events.length + 1}`));
      history = pushHistory(history, demoDefinition.reduce(history.present, action));
    };
    const undo = () => {
      events.push(controlEvent('main', 'undo', `a${events.length + 1}`));
      history = undoHistory(history);
    };
    const redo = () => {
      events.push(controlEvent('main', 'redo', `a${events.length + 1}`));
      history = redoHistory(history);
    };

    run({ type: 'add', x: 200, y: 200 });
    run({ type: 'add', x: 300, y: 200 });
    run({ type: 'move', id: 'c1', x: 200, y: 400 });
    run({ type: 'group', ids: ['c1', 'c2'] });
    undo();
    redo();
    run({ type: 'add', x: 700, y: 300 });
    run({ type: 'ungroup', groupId: 'g1' });

    const replayed = replayTask(demoLoaded, config, events);
    expect(replayed.state).toEqual(history.present);
    expect(replayed.observation).toEqual(demoDefinition.observe(history.present, config));
  });

  it('acted가 아닌 이벤트는 건너뛴다', () => {
    const started: LearningEvent = {
      id: 's1',
      t: 1,
      learner: '0',
      unit: 'demo',
      task: 'demo.A1.T1',
      engine: 'E00',
      verb: 'started',
    };
    const replayed = replayTask(demoLoaded, config, [started]);
    expect(replayed.state).toEqual(demoDefinition.createInitialState(config));
  });

  it('action도 control도 없는 acted 기록은 ReplayError다', () => {
    expect(() => replayTask(demoLoaded, config, [acted('main', {}, 'a1')])).toThrow(ReplayError);
  });
});

describe('replaySlots', () => {
  it('연결로 생긴 Action까지 기록만으로 재생한다', () => {
    const views: SlotView[] = [
      { slot: 'right', definition: demoLoaded, config },
      { slot: 'left', definition: demoLoaded, config },
    ];
    let histories = createSlotHistories(views);
    const events: LearningEvent[] = [];

    for (const x of [200, 300, 400, 500]) {
      const result = applyActionWithLinks(
        views,
        [{ from: 'left', event: 'counter-added', to: 'right' }],
        histories,
        'left',
        { type: 'add', x, y: 200 },
      );
      histories = result.histories;
      for (const item of result.applied) {
        events.push(
          actionEvent(item.slot, item.action as unknown as DemoAction, `a${events.length + 1}`),
        );
      }
    }

    histories = applyControl(histories, 'left', 'undo');
    events.push(controlEvent('left', 'undo', `a${events.length + 1}`));

    const replayed = replaySlots(views, events);
    expect(replayed.observations).toEqual(observationsOf(views, histories));
    expect(replayed.observations['right']).toEqual({ count: 4, groups: [] });
    expect(replayed.observations['left']).toEqual({ count: 3, groups: [] });
  });

  it('기록에 없는 슬롯이면 ReplayError다', () => {
    const views: SlotView[] = [{ slot: 'main', definition: demoLoaded, config }];
    expect(() =>
      replaySlots(views, [actionEvent('ghost', { type: 'add', x: 1, y: 1 }, 'a1')]),
    ).toThrow(ReplayError);
  });
});
