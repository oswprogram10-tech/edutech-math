/** 앱 셸이 기기 settings에 저장하는 값. core/storage는 쓰기만 한다. */
import type { Interest, LearnerId, Storage } from '../core/storage';
import { taskProgressId } from '../core/storage';

export const APP_SETTING_KEYS = {
  currentLearner: 'currentLearner',
  autoRead: 'autoRead',
  largeTarget: 'largeTarget',
} as const;

export interface AppPreferences {
  readonly autoRead?: boolean;
  readonly largeTarget?: boolean;
}

const LEARNER_NUMBER_PATTERN = /^(?:[1-9]|[12]\d|30)$/;

export function isLearnerNumber(value: string): boolean {
  return LEARNER_NUMBER_PATTERN.test(value);
}

/** `g1`, `g2`로 시작하는 단원은 저학년 모드를 기본으로 켠다. */
export function isLowerGradeUnit(unitId: string): boolean {
  return /^g[12](?:\D|$)/.test(unitId);
}

export async function readCurrentLearner(storage: Storage): Promise<LearnerId | undefined> {
  const value = await storage.getSetting<string>(APP_SETTING_KEYS.currentLearner);
  return typeof value === 'string' && isLearnerNumber(value) ? value : undefined;
}

export async function saveCurrentLearner(storage: Storage, learner: LearnerId): Promise<void> {
  await storage.setSetting(APP_SETTING_KEYS.currentLearner, learner);
}

export async function readPreferences(storage: Storage): Promise<AppPreferences> {
  const [autoRead, largeTarget] = await Promise.all([
    storage.getSetting<boolean>(APP_SETTING_KEYS.autoRead),
    storage.getSetting<boolean>(APP_SETTING_KEYS.largeTarget),
  ]);
  return {
    ...(typeof autoRead === 'boolean' ? { autoRead } : {}),
    ...(typeof largeTarget === 'boolean' ? { largeTarget } : {}),
  };
}

export async function savePreference(
  storage: Storage,
  key: 'autoRead' | 'largeTarget',
  value: boolean,
): Promise<void> {
  await storage.setSetting(APP_SETTING_KEYS[key], value);
}

export async function saveLearnerInterests(
  storage: Storage,
  learner: LearnerId,
  interests: readonly Interest[],
): Promise<void> {
  await storage.putLearner({ number: learner, interests: [...interests], updatedAt: Date.now() });
}

/** T004 과제 진행 ID 규칙을 앱에서도 그대로 쓴다. */
export function progressIdOf(learner: LearnerId, taskId: string): string {
  return taskProgressId(learner, taskId);
}
