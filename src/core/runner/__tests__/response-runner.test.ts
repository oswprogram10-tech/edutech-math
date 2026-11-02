import { describe, expect, it } from 'vitest';
import { assertSerializable, loadEngine } from '../../engine-sdk';
import type { EngineId, LoadedEngine, Observation } from '../../engine-sdk';
import type { JsonObject, LearningEvent } from '../../storage';
import { evaluateGoal } from '../goal';
import { applyActionWithLinks, createSlotHistories, observationsOf } from '../links';
import { replaySlots } from '../replay';
import { judgeObservation, RESPONSE_SLOT } from '../response';
import type { ResponseAction } from '../response';
import { engineIdsOfContent, taskSlotViews } from '../views';
import type { ContentTask, UnitContent } from '../types';

const FRACTION_TASK: ContentTask = {
  id: 'demo.A3.T1',
  prompt: '1/2 + 1/3을 분수로 써 보세요.',
  engine: 'E00',
  mode: 'free',
  cpa: 'A',
  config: {},
  goal: { kind: 'equals', path: 'response.ans.value', value: '5/6' },
  hints: [],
  concepts: [],
  submit: 'button',
  response: { fields: [{ kind: 'number', id: 'ans', forms: ['fraction'] }] },
  showEngine: false,
};

async function definitionsFor(ids: readonly EngineId[]): Promise<Map<EngineId, LoadedEngine>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await loadEngine(id)] as const));
  return new Map(entries);
}

function typeFraction(
  views: ReturnType<typeof taskSlotViews>,
  state: ReturnType<typeof createSlotHistories>,
  keys: readonly string[],
) {
  let histories = state;
  for (const key of keys) {
    histories = applyActionWithLinks(views, [], histories, RESPONSE_SLOT, {
      type: 'number-key',
      field: 'ans',
      key,
    } satisfies ResponseAction).histories;
  }
  return histories;
}

function acted(slot: string, action: JsonObject, index: number): LearningEvent {
  return {
    id: `event-${index}`,
    t: index,
    learner: '0',
    unit: 'demo',
    task: 'demo.A3.T1',
    engine: 'E00',
    verb: 'acted',
    data: { slot, action },
  };
}

describe('응답 슬롯 실행기 연결', () => {
  it('판정 엔진 Observation과 응답 Observation을 합쳐 GoalSpec으로 채점한다', async () => {
    const definitions = await definitionsFor(['E00']);
    const judgeEngine = definitions.get('E00');
    if (!judgeEngine) throw new Error('E00 엔진을 불러오지 못했습니다.');
    const views = taskSlotViews(FRACTION_TASK, definitions);
    expect(views.map((view) => view.slot)).toEqual(['main', RESPONSE_SLOT]);

    const start = createSlotHistories(views);
    const wrong = typeFraction(views, start, ['5']);
    const wrongWithDenominator = applyActionWithLinks(views, [], wrong, RESPONSE_SLOT, {
      type: 'number-focus',
      field: 'ans',
      part: 'denominator',
    }).histories;
    const wrongTyped = typeFraction(views, wrongWithDenominator, ['7']);

    const wrongObservations = observationsOf(views, wrongTyped);
    const wrongMerged = judgeObservation(
      wrongObservations['main'],
      wrongObservations[RESPONSE_SLOT],
    );
    expect(wrongMerged?.['response']).toEqual({
      ans: { raw: '5/7', value: '5/7', form: 'fraction', valid: true, irreducible: true },
    });
    expect(wrongMerged?.['count']).toBe(0);
    expect(evaluateGoal(FRACTION_TASK.goal, wrongMerged as Observation, judgeEngine)).toBe(false);

    const correctTyped = typeFraction(views, wrongWithDenominator, ['6']);
    const correctMerged = judgeObservation(
      observationsOf(views, correctTyped)['main'],
      observationsOf(views, correctTyped)[RESPONSE_SLOT],
    );
    expect(correctMerged?.['response']).toEqual({
      ans: { raw: '5/6', value: '5/6', form: 'fraction', valid: true, irreducible: true },
    });
    expect(evaluateGoal(FRACTION_TASK.goal, correctMerged as Observation, judgeEngine)).toBe(true);
    assertSerializable(correctMerged);
  });

  it('응답 Action 기록만으로 최종 Observation을 재생한다', async () => {
    const definitions = await definitionsFor(['E00']);
    const views = taskSlotViews(FRACTION_TASK, definitions);
    const events: LearningEvent[] = [
      acted(RESPONSE_SLOT, { type: 'number-key', field: 'ans', key: '5' }, 0),
      acted(RESPONSE_SLOT, { type: 'number-focus', field: 'ans', part: 'denominator' }, 1),
      acted(RESPONSE_SLOT, { type: 'number-key', field: 'ans', key: '6' }, 2),
    ];

    const replayed = replaySlots(views, events);
    expect(replayed.observations[RESPONSE_SLOT]?.['ans']).toEqual({
      raw: '5/6',
      value: '5/6',
      form: 'fraction',
      valid: true,
      irreducible: true,
    });

    const undone = replaySlots(views, [
      ...events,
      {
        id: 'event-3',
        t: 3,
        learner: '0',
        unit: 'demo',
        task: 'demo.A3.T1',
        engine: 'E00',
        verb: 'acted',
        data: { control: 'undo' },
      },
    ]);
    expect(undone.observations[RESPONSE_SLOT]?.['ans']).toMatchObject({
      raw: '5/',
      value: null,
    });
  });

  it('그림 선택지 엔진도 미리 불러올 목록에 넣는다', () => {
    const content: UnitContent = {
      unit: 'demo',
      title: '데모',
      activities: [
        {
          id: 'demo.A3',
          title: '답',
          tasks: [
            {
              ...FRACTION_TASK,
              id: 'demo.A3.T2',
              response: {
                fields: [
                  {
                    kind: 'choice',
                    id: 'pick',
                    multiple: false,
                    options: [
                      {
                        id: 'a',
                        label: '가',
                        figure: {
                          engine: 'E05',
                          mode: 'shade',
                          cpa: 'P',
                          config: { mode: 'shade' },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(engineIdsOfContent(content)).toEqual(['E00', 'E05']);
  });

  it('없는 엔진 정의로 슬롯을 만들면 오류다', () => {
    expect(() => taskSlotViews(FRACTION_TASK, new Map())).toThrow();
  });
});
