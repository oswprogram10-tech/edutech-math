/**
 * `#/run/<unitId>` 화면 틀.
 *
 * 콘텐츠와 엔진만 불러오고, 과제 진행·채점·기록 UI는
 * `src/core/runner`의 ActivityRunner가 맡는다.
 */
import { useEffect, useState } from 'react';
import { loadEngine } from '../core/engine-sdk';
import type { EngineId, LoadedEngine } from '../core/engine-sdk';
import { ActivityRunner, engineIdsOfContent, loadUnitContent, runnerStrings } from '../core/runner';
import type { UnitContent } from '../core/runner';
import { getStorage } from '../core/storage';
import type { Storage } from '../core/storage';
import styles from './Runner.module.css';

interface LoadedContent {
  readonly content: UnitContent;
  readonly definitions: ReadonlyMap<EngineId, LoadedEngine>;
  readonly storage?: Storage;
}

function exitToHome(): void {
  window.location.hash = '';
}

interface RunnerProps {
  readonly unitId: string;
}

export function Runner({ unitId }: RunnerProps) {
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const content = await loadUnitContent(unitId);
        const engineIds = engineIdsOfContent(content);
        const entries = await Promise.all(
          engineIds.map(async (id) => [id, await loadEngine(id)] as const),
        );
        const storage = await getStorage().catch(() => undefined);
        if (!cancelled) {
          setLoaded({ content, definitions: new Map(entries), storage });
        }
      } catch (reason) {
        console.warn('[runner] 콘텐츠를 불러오지 못했습니다.', reason);
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (error) {
    return (
      <main className={styles.shell}>
        <p role="alert">{runnerStrings.loadError}</p>
        <a className={styles.back} href="#">
          {runnerStrings.back}
        </a>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className={styles.shell}>
        <p role="status">{runnerStrings.loading}</p>
      </main>
    );
  }

  return (
    <ActivityRunner
      key={loaded.content.unit}
      content={loaded.content}
      definitions={loaded.definitions}
      storage={loaded.storage}
      onExit={exitToHome}
    />
  );
}
