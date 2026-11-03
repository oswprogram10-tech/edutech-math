/**
 * `#/map` — S2 나의 수학 별자리.
 *
 * 세션(학습자·저장소)만 확인하고, 별자리 코드는 `src/app/map/`에 맡긴다.
 * 이 화면은 App이 지연 로딩하므로 첫 화면 번들에 들어가지 않는다.
 */
import { useEffect, useState } from 'react';
import { StarMap } from './map/StarMap';
import { readPreferences } from './preferences';
import { navigate } from './router';
import { starMapStrings } from './strings.ko';
import { useStudentSession } from './useStudentSession';
import styles from './MapScreen.module.css';

export function MapScreen() {
  const session = useStudentSession();
  const [targetSize, setTargetSize] = useState(48);

  useEffect(() => {
    if (session.phase === 'missing') navigate({ kind: 'home' });
  }, [session.phase]);

  useEffect(() => {
    if (session.phase !== 'ready') return;
    let cancelled = false;
    readPreferences(session.storage)
      .then((preferences) => {
        if (!cancelled) setTargetSize(preferences.largeTarget === true ? 64 : 48);
      })
      .catch((reason: unknown) => {
        console.warn('[map] 설정을 읽지 못했습니다.', reason);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (session.phase === 'loading' || session.phase === 'missing') {
    return (
      <main className={styles.screen}>
        <p role="status">{starMapStrings.loading}</p>
      </main>
    );
  }

  if (session.phase === 'error') {
    return (
      <main className={styles.screen}>
        <p role="alert">{starMapStrings.loadError}</p>
        <a className={styles.homeLink} href="#/">
          {starMapStrings.home}
        </a>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <a className={styles.brand} href="#/">
          MathExplorer
        </a>
        <span className={styles.learner}>{starMapStrings.learnerLabel(session.learner)}</span>
      </header>

      <h1 className={styles.heading}>{starMapStrings.heading}</h1>

      <StarMap storage={session.storage} learner={session.learner} targetSize={targetSize} />
    </main>
  );
}
