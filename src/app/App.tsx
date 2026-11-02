import { useEffect, useState } from 'react';
import type { EngineId } from '../core/engine-sdk';
import { Runner } from './Runner';
import { Sandbox } from './Sandbox';
import { appStrings } from './strings.ko';
import styles from './App.module.css';

type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'sandbox'; readonly engineId: EngineId }
  | { readonly kind: 'run'; readonly unitId: string };

function parseRoute(hash: string): Route {
  const sandbox = /^#\/sandbox\/(E\d{2})$/.exec(hash);
  if (sandbox?.[1]) return { kind: 'sandbox', engineId: sandbox[1] as EngineId };

  const run = /^#\/run\/([A-Za-z0-9_-]+)$/.exec(hash);
  if (run?.[1]) return { kind: 'run', unitId: run[1] };

  return { kind: 'home' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.kind === 'sandbox') {
    return <Sandbox key={route.engineId} engineId={route.engineId} />;
  }

  if (route.kind === 'run') {
    return <Runner key={route.unitId} unitId={route.unitId} />;
  }

  return (
    <main className={styles.home}>
      <h1>{appStrings.title}</h1>
      <p>{appStrings.tagline}</p>
      <p className={styles.note}>{appStrings.comingSoon}</p>
    </main>
  );
}
