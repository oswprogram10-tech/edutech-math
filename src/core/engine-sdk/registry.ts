/**
 * 엔진 레지스트리.
 *
 * `import.meta.glob`으로 `src/engines` 아래의 엔진 `index.ts`를 자동 등록한다.
 * 엔진을 추가할 때 이 파일을 고치지 않는다(여러 에이전트가 동시에 만들어도 충돌 없음).
 */
import type { EngineId, LoadedEngine } from './types';

interface EngineModule {
  default: LoadedEngine;
}

type EngineLoader = () => Promise<EngineModule>;

const modules = import.meta.glob<EngineModule>('../../engines/E*/index.ts');

const loaders = new Map<EngineId, EngineLoader>();
for (const [path, loader] of Object.entries(modules)) {
  const match = /\/engines\/(E\d{2})-[\w-]+\/index\.ts$/.exec(path.replaceAll('\\', '/'));
  if (!match?.[1]) continue;
  const id = match[1] as EngineId;
  if (loaders.has(id)) throw new Error(`엔진 ID가 중복됩니다: ${id}`);
  loaders.set(id, loader);
}

/** 등록된 엔진 ID 목록(정렬). */
export function listEngineIds(): EngineId[] {
  return [...loaders.keys()].sort();
}

export function hasEngine(id: EngineId): boolean {
  return loaders.has(id);
}

/** 엔진 정의를 지연 로딩한다. 처음 여는 단원만 내려받기 위해서다. */
export async function loadEngine(id: EngineId): Promise<LoadedEngine> {
  const loader = loaders.get(id);
  if (!loader) throw new Error(`등록되지 않은 엔진입니다: ${id}`);
  const module = await loader();
  const definition = module.default;
  if (definition.id !== id) {
    throw new Error(`엔진 폴더 ID(${id})와 정의 ID(${definition.id})가 다릅니다.`);
  }
  return definition;
}
