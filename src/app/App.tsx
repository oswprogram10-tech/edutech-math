import { lazy, Suspense, useEffect, useState } from 'react';
import { parseRoute } from './router';
import type { Route } from './router';
import { appStrings } from './strings.ko';
import { installUserGestureTracking } from './user-gesture';
import styles from './App.module.css';

// 화면마다 지연 로딩해 첫 화면 번들(70KB gzip 이하)을 지킨다.
const StartScreen = lazy(async () => ({ default: (await import('./StartScreen')).StartScreen }));
const MapScreen = lazy(async () => ({ default: (await import('./MapScreen')).MapScreen }));
const ActivityScreen = lazy(async () => ({
  default: (await import('./ActivityScreen')).ActivityScreen,
}));
const TeacherScreen = lazy(async () => ({
  default: (await import('./TeacherScreen')).TeacherScreen,
}));
const DemoScreen = lazy(async () => ({ default: (await import('./DemoScreen')).DemoScreen }));
const Runner = lazy(async () => ({ default: (await import('./Runner')).Runner }));
const Sandbox = lazy(async () => ({ default: (await import('./Sandbox')).Sandbox }));

function Loading() {
  return (
    <main className={styles.home}>
      <p role="status">{appStrings.loading}</p>
    </main>
  );
}

function screenFor(route: Route) {
  switch (route.kind) {
    case 'home':
      return <StartScreen />;
    case 'map':
      return <MapScreen />;
    case 'activity':
      return <ActivityScreen key={route.activityId} activityId={route.activityId} />;
    case 'teacher':
      return <TeacherScreen />;
    case 'demo':
      return <DemoScreen key={route.code ?? 'demo'} code={route.code} />;
    case 'sandbox':
      return <Sandbox key={route.engineId} engineId={route.engineId} />;
    case 'run':
      return <Runner key={route.unitId} unitId={route.unitId} />;
  }
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 아이패드 Safari의 자동 읽기는 사용자 동작 뒤에만 허용된다.
  useEffect(() => installUserGestureTracking(), []);

  return <Suspense fallback={<Loading />}>{screenFor(route)}</Suspense>;
}
