import { describe, expect, it } from 'vitest';
import type { EngineId, GoalSpec, HintRule, LoadedEngine } from '../../engine-sdk';
import { hasEngine, listEngineIds, loadEngine } from '../../engine-sdk';
import { parseUnitContent } from '../content-schema';
import type { UnitContent } from '../types';

interface UnitsFile {
  readonly units: readonly { readonly id: string }[];
}

interface ConceptsFile {
  readonly concepts: readonly { readonly id: string }[];
}

type JsonModule = { readonly default: unknown };

const dataModules = import.meta.glob<JsonModule>('../../../../data/*.json', { eager: true });
const contentModules = import.meta.glob<JsonModule>('../../../../data/content/*.json', {
  eager: true,
});

function moduleAt<T>(modules: Readonly<Record<string, JsonModule>>, suffix: string): T {
  const entry = Object.entries(modules).find(([path]) => path.endsWith(suffix));
  if (!entry) throw new Error(`데이터 파일을 찾을 수 없습니다: ${suffix}`);
  return entry[1].default as T;
}

function predicateNames(goal: GoalSpec, names: Set<string>): void {
  switch (goal.kind) {
    case 'predicate':
      names.add(goal.name);
      return;
    case 'all':
    case 'any':
      for (const child of goal.of) predicateNames(child, names);
      return;
    default:
      return;
  }
}

function hintPredicateNames(hint: HintRule, names: Set<string>): void {
  if ('kind' in hint.when) predicateNames(hint.when, names);
}

describe('data/content 파일', () => {
  const files = Object.entries(contentModules).map(([path, module]) => ({
    name: path.slice(path.lastIndexOf('/') + 1),
    input: module.default,
  }));
  const units = moduleAt<UnitsFile>(dataModules, '/units.json');
  const concepts = moduleAt<ConceptsFile>(dataModules, '/concepts.json');
  const unitIds = new Set(units.units.map((unit) => unit.id));
  const conceptIds = new Set(concepts.concepts.map((concept) => concept.id));
  const engineIds = new Set<EngineId>(listEngineIds());
  const engineCache = new Map<string, Promise<LoadedEngine>>();

  function definitionOf(engine: string): Promise<LoadedEngine> {
    const cached = engineCache.get(engine);
    if (cached) return cached;
    const loaded = loadEngine(engine as EngineId);
    engineCache.set(engine, loaded);
    return loaded;
  }

  it('파일이 하나 이상 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file.name}: 스키마와 참조가 모두 맞다`, async () => {
      const content = parseUnitContent(file.input);
      const errors: string[] = [];
      const check = (condition: boolean, message: string) => {
        if (!condition) errors.push(message);
      };

      check(file.name === `${content.unit}.json`, `파일 이름과 unit이 다릅니다: ${content.unit}`);
      if (content.unit !== 'demo') {
        check(unitIds.has(content.unit), `units.json에 없는 단원입니다: ${content.unit}`);
      }

      const activityIds = new Set<string>();
      const taskIds = new Set<string>();

      for (const activity of content.activities) {
        check(!activityIds.has(activity.id), `활동 ID가 중복됩니다: ${activity.id}`);
        activityIds.add(activity.id);
        check(
          activity.id.startsWith(`${content.unit}.A`),
          `활동 ID가 단원 ID로 시작하지 않습니다: ${activity.id}`,
        );

        for (const task of activity.tasks) {
          check(!taskIds.has(task.id), `과제 ID가 중복됩니다: ${task.id}`);
          taskIds.add(task.id);
          check(
            task.id.startsWith(`${activity.id}.T`),
            `과제 ID가 활동 ID로 시작하지 않습니다: ${task.id}`,
          );

          const engine = await definitionOf(task.engine);
          check(engine.modes.includes(task.mode), `${task.id}: 없는 모드입니다: ${task.mode}`);

          if (content.unit !== 'demo') {
            for (const concept of task.concepts) {
              check(
                conceptIds.has(concept),
                `${task.id}: concepts.json에 없는 개념입니다: ${concept}`,
              );
            }
          }

          const predicates = new Set<string>();
          predicateNames(task.goal, predicates);
          for (const hint of task.hints) hintPredicateNames(hint, predicates);
          for (const name of predicates) {
            check(
              engine.predicates?.[name] !== undefined,
              `${task.id}: 엔진 ${task.engine}에 없는 predicate입니다: ${name}`,
            );
          }

          for (const hint of task.hints) {
            if (hint.backtrack) {
              check(
                unitIds.has(hint.backtrack) ||
                  (content.unit !== 'demo' && conceptIds.has(hint.backtrack)),
                `${task.id}: 없는 개념·단원입니다: ${hint.backtrack}`,
              );
            }
            const show = hint.show;
            if (!show) continue;
            check(engineIds.has(show.engine), `${task.id}: 없는 엔진입니다: ${show.engine}`);
            if (engineIds.has(show.engine)) {
              const overlayEngine = await definitionOf(show.engine);
              check(
                overlayEngine.overlays?.[show.overlay] !== undefined,
                `${task.id}: ${show.engine}에 없는 overlay입니다: ${show.overlay}`,
              );
            }
          }

          const views = task.views;
          if (!views) continue;
          const slots = new Set(views.map((view) => view.slot));
          check(slots.size === views.length, `${task.id}: 슬롯 이름이 중복됩니다.`);

          const viewDefinitions = new Map<string, LoadedEngine>();
          for (const view of views) {
            check(engineIds.has(view.engine), `${task.id}: 없는 엔진입니다: ${view.engine}`);
            if (!engineIds.has(view.engine)) continue;
            const viewEngine = await definitionOf(view.engine);
            viewDefinitions.set(view.slot, viewEngine);
            check(
              viewEngine.modes.includes(view.mode),
              `${task.id}/${view.slot}: 없는 모드입니다: ${view.mode}`,
            );
          }

          for (const link of task.links ?? []) {
            check(slots.has(link.from), `${task.id}: 연결 시작 슬롯이 없습니다: ${link.from}`);
            check(slots.has(link.to), `${task.id}: 연결 대상 슬롯이 없습니다: ${link.to}`);
            const from = viewDefinitions.get(link.from);
            const to = viewDefinitions.get(link.to);
            if (from) {
              check(
                from.events.includes(link.event),
                `${task.id}: ${link.from} 엔진에 없는 이벤트입니다: ${link.event}`,
              );
            }
            if (to) {
              check(
                typeof to.receive === 'function',
                `${task.id}: ${link.to} 엔진에 receive가 없습니다.`,
              );
            }
          }
        }
      }

      expect(errors).toEqual([]);
    });
  }

  it('demo 단원은 units.json에 없어도 된다', () => {
    const demo = files.find((file) => file.name === 'demo.json');
    if (!demo) throw new Error('demo.json이 없습니다.');
    const content: UnitContent = parseUnitContent(demo.input);
    expect(content.unit).toBe('demo');
    expect(hasEngine('E00')).toBe(true);
  });
});
