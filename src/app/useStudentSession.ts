/** 앱 화면이 공통으로 쓰는 현재 학습자·저장소 상태. */
import { useEffect, useState } from 'react';
import type { LearnerId, Storage, StorageStatus } from '../core/storage';
import { getStorage } from '../core/storage';
import { readCurrentLearner } from './preferences';

export type StudentSession =
  | { readonly phase: 'loading' }
  | { readonly phase: 'missing' }
  | { readonly phase: 'error' }
  | {
      readonly phase: 'ready';
      readonly storage: Storage;
      readonly status: StorageStatus;
      readonly learner: LearnerId;
    };

export function useStudentSession(): StudentSession {
  const [session, setSession] = useState<StudentSession>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const storage = await getStorage();
        const [status, learner] = await Promise.all([
          storage.status(),
          readCurrentLearner(storage),
        ]);
        if (cancelled) return;
        setSession(learner ? { phase: 'ready', storage, status, learner } : { phase: 'missing' });
      } catch (reason) {
        console.warn('[app] 학습자 정보를 불러오지 못했습니다.', reason);
        if (!cancelled) setSession({ phase: 'error' });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
