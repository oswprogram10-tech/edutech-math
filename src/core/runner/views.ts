/**
 * 과제 하나의 슬롯 목록과 콘텐츠가 쓰는 엔진 ID 모음.
 *
 * 응답 슬롯은 `views`에 쓰지 않는다. 실행기가 과제의 `response`를 보고
 * 엔진 슬롯 뒤에 특별 슬롯 `response`를 붙인다. 판정 대상은 언제나 첫 슬롯이다.
 */
import type { CPA, EngineId, LoadedEngine } from '../engine-sdk';
import type { SlotView } from './links';
import type { ContentTask, UnitContent } from './types';
import { responseDefinition, RESPONSE_SLOT } from './response';
import type { ResponseField } from './response';

export interface TaskSlotView extends SlotView {
  readonly mode: string;
  readonly cpa: CPA;
}

function figureEngines(field: ResponseField): EngineId[] {
  if (field.kind === 'choice') {
    return field.options.flatMap((option) => (option.figure ? [option.figure.engine] : []));
  }
  if (field.kind === 'order') {
    return field.items.flatMap((item) => (item.figure ? [item.figure.engine] : []));
  }
  return [];
}

export function taskSlotViews(
  task: ContentTask,
  definitions: ReadonlyMap<EngineId, LoadedEngine>,
): TaskSlotView[] {
  const specs = task.views ?? [
    {
      slot: 'main',
      engine: task.engine,
      mode: task.mode,
      cpa: task.cpa,
      config: task.config,
    },
  ];

  const views: TaskSlotView[] = specs.map((spec) => {
    const definition = definitions.get(spec.engine);
    if (!definition) throw new Error(`엔진을 불러오지 못했습니다: ${spec.engine}`);
    return {
      slot: spec.slot,
      engine: spec.engine,
      mode: spec.mode,
      cpa: spec.cpa,
      config: spec.config,
      definition,
    };
  });

  if (task.response) {
    views.push({
      slot: RESPONSE_SLOT,
      // responseDefinition은 레지스트리에 없지만 슬롯 계약은 엔진과 같다.
      mode: 'response',
      cpa: 'A',
      config: { fields: task.response.fields },
      definition: responseDefinition,
    });
  }

  return views;
}

/** 실행기가 미리 불러와야 하는 엔진 ID(과제·views·그림 선택지). */
export function engineIdsOfContent(content: UnitContent): EngineId[] {
  const ids = new Set<EngineId>();
  for (const activity of content.activities) {
    for (const task of activity.tasks) {
      ids.add(task.engine);
      for (const view of task.views ?? []) ids.add(view.engine);
      for (const field of task.response?.fields ?? []) {
        for (const engine of figureEngines(field)) ids.add(engine);
      }
    }
  }
  return [...ids].sort();
}
