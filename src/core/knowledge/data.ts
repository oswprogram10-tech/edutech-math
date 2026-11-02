/**
 * `data/concepts.json`·`data/units.json`을 지연 로딩해 그래프를 만든다.
 *
 * 명세 검사는 `check:specs`가 맡고, 실행 중에는 그래프를 한 번만 만들어
 * 여러 과제·부스터가 같은 객체를 쓴다. 테스트는 `buildKnowledgeGraph`를 직접 쓴다.
 */
import { buildKnowledgeGraph } from './graph';
import type { ConceptsInput, KnowledgeGraph, UnitsInput } from './graph';

interface JsonModule {
  readonly default: unknown;
}

const conceptLoaders = import.meta.glob<JsonModule>('../../../data/concepts.json');
const unitLoaders = import.meta.glob<JsonModule>('../../../data/units.json');

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstLoader(
  loaders: Readonly<Record<string, () => Promise<JsonModule>>>,
  name: string,
): () => Promise<JsonModule> {
  const loader = Object.values(loaders)[0];
  if (!loader) throw new Error(`지식 그래프 데이터를 찾을 수 없습니다: ${name}`);
  return loader;
}

function asConcepts(value: unknown): ConceptsInput {
  if (!isRecord(value) || !Array.isArray(value['concepts'])) {
    throw new Error('concepts.json에 concepts 배열이 없습니다.');
  }
  return value as unknown as ConceptsInput;
}

function asUnits(value: unknown): UnitsInput {
  if (!isRecord(value) || !Array.isArray(value['units'])) {
    throw new Error('units.json에 units 배열이 없습니다.');
  }
  return value as unknown as UnitsInput;
}

let graphPromise: Promise<KnowledgeGraph> | undefined;

/** 한 번 만든 그래프를 돌려준다. 실패하면 다음 호출에서 다시 시도한다. */
export function loadKnowledgeGraph(): Promise<KnowledgeGraph> {
  graphPromise ??= (async () => {
    const [concepts, units] = await Promise.all([
      firstLoader(conceptLoaders, 'concepts.json')(),
      firstLoader(unitLoaders, 'units.json')(),
    ]);
    return buildKnowledgeGraph(asConcepts(concepts.default), asUnits(units.default));
  })().catch((error: unknown) => {
    graphPromise = undefined;
    throw error;
  });
  return graphPromise;
}

/** 테스트에서 그래프 캐시를 비울 때. */
export function resetKnowledgeGraph(): void {
  graphPromise = undefined;
}
