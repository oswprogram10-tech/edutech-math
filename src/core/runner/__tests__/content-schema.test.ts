import { describe, expect, it } from 'vitest';
import type { GoalSpec, HintRule, Task } from '../../engine-sdk';
import { ContentSchemaError, parseUnitContent } from '../content-schema';

function validContent() {
  return {
    unit: 'demo',
    title: '셈돌',
    activities: [
      {
        id: 'demo.A1',
        title: '놓기',
        tasks: [
          {
            id: 'demo.A1.T1',
            prompt: '셈돌을 5개 놓아 보세요.',
            engine: 'E00',
            mode: 'free',
            cpa: 'C',
            config: { gridSize: 100 },
            goal: { kind: 'equals', path: 'count', value: 5 },
            hints: [],
            concepts: [],
            submit: 'auto',
          },
        ],
      },
      {
        id: 'demo.A2',
        title: '연결',
        tasks: [
          {
            id: 'demo.A2.T1',
            prompt: '두 판을 연결해요.',
            engine: 'E00',
            mode: 'free',
            cpa: 'C',
            config: {},
            goal: { kind: 'predicate', name: 'has-group-of', args: { size: 3 } },
            hints: [],
            concepts: [],
            submit: 'button',
            views: [
              { slot: 'right', engine: 'E00', mode: 'free', cpa: 'C', config: {} },
              { slot: 'left', engine: 'E00', mode: 'free', cpa: 'C', config: {} },
            ],
            links: [{ from: 'left', event: 'counter-added', to: 'right' }],
          },
        ],
      },
    ],
  };
}

describe('parseUnitContent', () => {
  it('콘텐츠를 읽고 engine-sdk의 Task·GoalSpec·HintRule과 타입이 맞는다', () => {
    const content = parseUnitContent(validContent());
    const task = content.activities[0]?.tasks[0];
    const linked = content.activities[1]?.tasks[0];
    if (!task || !linked) throw new Error('과제가 없습니다.');

    const sdkTask: Task = task;
    const goal: GoalSpec = sdkTask.goal;
    const hints: HintRule[] = sdkTask.hints;
    expect(goal).toEqual({ kind: 'equals', path: 'count', value: 5 });
    expect(hints).toEqual([]);
    expect(linked.views?.[0]?.slot).toBe('right');
    expect(linked.links?.[0]).toEqual({ from: 'left', event: 'counter-added', to: 'right' });
  });

  it('형식이 틀리면 ContentSchemaError와 경로를 알려 준다', () => {
    const missingSubmit = validContent();
    delete (missingSubmit.activities[0]?.tasks[0] as Record<string, unknown>)['submit'];
    expect(() => parseUnitContent(missingSubmit)).toThrow(ContentSchemaError);
    try {
      parseUnitContent(missingSubmit);
    } catch (error) {
      expect(error).toBeInstanceOf(ContentSchemaError);
      expect((error as ContentSchemaError).issues.join(' ')).toContain('submit');
    }
  });

  it('과제 ID는 <활동ID>.T<n> 형식이어야 한다', () => {
    const content = validContent();
    const task = content.activities[0]?.tasks[0];
    if (task) task.id = 'demo.A1-1';
    expect(() => parseUnitContent(content)).toThrow(ContentSchemaError);
  });

  it('views가 없으면 links를 쓸 수 없고, 슬롯은 중복될 수 없다', () => {
    const noViews = validContent();
    const noViewsTask = noViews.activities[1]?.tasks[0] as { views?: unknown } | undefined;
    delete noViewsTask?.views;
    expect(() => parseUnitContent(noViews)).toThrow(ContentSchemaError);

    const duplicate = validContent();
    const duplicateTask = duplicate.activities[1]?.tasks[0] as
      { views?: { slot: string }[] } | undefined;
    if (duplicateTask?.views?.[1]) duplicateTask.views[1].slot = 'right';
    expect(() => parseUnitContent(duplicate)).toThrow(ContentSchemaError);
  });

  it('모르는 필드는 거부한다', () => {
    const content = validContent();
    (content.activities[0]?.tasks[0] as Record<string, unknown>)['answer'] = 5;
    expect(() => parseUnitContent(content)).toThrow(ContentSchemaError);
  });
});
