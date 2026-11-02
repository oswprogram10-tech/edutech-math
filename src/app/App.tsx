import { useEffect, useState } from 'react';
import type { EngineId } from '../core/engine-sdk';
import { Sandbox } from './Sandbox';
import { appStrings } from './strings.ko';
import styles from './App.module.css';

function currentEngineId(): EngineId | null {
  const match = /^#\/sandbox\/(E\d{2})$/.exec(window.location.hash);
  return (match?.[1] as EngineId | undefined) ?? null;
}

export function App() {
  const [engineId, setEngineId] = useState<EngineId | null>(currentEngineId);

  useEffect(() => {
    const onHashChange = () => setEngineId(currentEngineId());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (engineId) return <Sandbox key={engineId} engineId={engineId} />;

  return (
    <main className={styles.home}>
      <h1>{appStrings.title}</h1>
      <p>{appStrings.tagline}</p>
      <p className={styles.note}>{appStrings.comingSoon}</p>
    </main>
  );
}
