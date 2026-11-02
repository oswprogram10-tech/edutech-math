import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../core/storage';
import {
  APP_SETTING_KEYS,
  isLearnerNumber,
  isLowerGradeUnit,
  readCurrentLearner,
  readPreferences,
  saveCurrentLearner,
  saveLearnerInterests,
  savePreference,
} from './preferences';

describe('학습자 번호와 저학년 단원', () => {
  it('1~30만 학습자 번호로 받는다', () => {
    expect(isLearnerNumber('1')).toBe(true);
    expect(isLearnerNumber('30')).toBe(true);
    expect(isLearnerNumber('0')).toBe(false);
    expect(isLearnerNumber('31')).toBe(false);
    expect(isLearnerNumber('01')).toBe(false);
    expect(isLearnerNumber('가')).toBe(false);
  });

  it('g1·g2 단원만 저학년 기본값을 켠다', () => {
    expect(isLowerGradeUnit('g1s1u1')).toBe(true);
    expect(isLowerGradeUnit('g2s2u3')).toBe(true);
    expect(isLowerGradeUnit('g3s1u1')).toBe(false);
    expect(isLowerGradeUnit('demo')).toBe(false);
  });
});

describe('앱 설정', () => {
  it('현재 학습자를 저장하고 읽는다', async () => {
    const storage = new MemoryStorage();
    expect(await readCurrentLearner(storage)).toBeUndefined();

    await saveCurrentLearner(storage, '12');
    expect(await readCurrentLearner(storage)).toBe('12');
    expect(await storage.getSetting(APP_SETTING_KEYS.currentLearner)).toBe('12');
  });

  it('저장된 값이 1~30 밖이면 없는 것으로 본다', async () => {
    const storage = new MemoryStorage();
    await storage.setSetting(APP_SETTING_KEYS.currentLearner, '99');
    expect(await readCurrentLearner(storage)).toBeUndefined();
  });

  it('자동 읽기·큰 버튼 설정을 저장하고 읽는다', async () => {
    const storage = new MemoryStorage();
    expect(await readPreferences(storage)).toEqual({});

    await savePreference(storage, 'autoRead', false);
    await savePreference(storage, 'largeTarget', true);
    expect(await readPreferences(storage)).toEqual({ autoRead: false, largeTarget: true });
  });

  it('관심사를 학습자 기록에 저장한다', async () => {
    const storage = new MemoryStorage();
    await saveLearnerInterests(storage, '7', ['space', 'music']);

    const learner = await storage.getLearner('7');
    expect(learner?.number).toBe('7');
    expect(learner?.interests).toEqual(['space', 'music']);
    expect(learner?.updatedAt).toBeTypeOf('number');
  });
});
