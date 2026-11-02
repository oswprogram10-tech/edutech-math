/**
 * 별 밝기와 부스터 반짝임 판정.
 *
 * `src/core/knowledge`의 `isMastered`를 읽기만 한다.
 * 숙달 확률 숫자는 학생 화면에 보여 주지 않는다.
 */
import { isMastered } from '../../core/knowledge';
import type { MasteryLike } from '../../core/knowledge';
import type { LearningEvent, LearnerId, MasteryRecord } from '../../core/storage';

export type Brightness = 'missing' | 'practicing' | 'mastered';

/** 기록이 없으면 '아직', 숙달이 아니면 '연습 중', 숙달이면 '빛남'. */
export function brightnessOf(record: MasteryLike | undefined): Brightness {
  if (record === undefined) return 'missing';
  return isMastered(record) ? 'mastered' : 'practicing';
}

/** 한 학습자의 숙달 기록만 골라 개념 ID → 밝기로 바꾼다. */
export function brightnessByConcept(
  records: readonly MasteryRecord[],
  learner: LearnerId,
): Map<string, Brightness> {
  const map = new Map<string, Brightness>();
  for (const record of records) {
    if (record.learner !== learner) continue;
    map.set(record.conceptId, brightnessOf(record));
  }
  return map;
}

/**
 * 부스터로 다시 해 낸 개념. `backtracked` 이벤트 중 `outcome:"passed"`의 `to`다.
 * '빛나는 극복 노트'는 이 카드 범위 밖이라 표시에만 쓴다.
 */
export function sparkleConcepts(events: readonly LearningEvent[], learner: LearnerId): Set<string> {
  const sparkles = new Set<string>();
  for (const event of events) {
    if (event.learner !== learner) continue;
    if (event.verb !== 'backtracked') continue;
    const data = event.data;
    if (!data) continue;
    if (data['outcome'] !== 'passed') continue;
    const target = data['to'];
    if (typeof target === 'string' && target.length > 0) sparkles.add(target);
  }
  return sparkles;
}
