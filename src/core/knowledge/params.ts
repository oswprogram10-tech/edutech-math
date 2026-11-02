/**
 * 학습 엔진 상수(docs/05-learning-engine.md §2·§3).
 *
 * `p`는 0~1 숙달 확률이라 수학 값이 아니다. 그래서 여기서만 number를 쓴다.
 * 수업 파일럿 뒤 이 파일의 값만 조정한다.
 */
export const masteryParams = {
  /** 선수 개념이 숙달되지 않았을 때의 초깃값. */
  initialP: 0.3,
  /** 선수 개념이 모두 숙달됐을 때의 초깃값. */
  initialPWithPrerequisites: 0.5,
  /** 정답(힌트 없음)일 때 더하는 비율. p ← p + (1 − p) × 값 */
  passGainNoHint: 0.35,
  /** 정답(힌트 ① 사용)일 때. */
  passGainHint1: 0.2,
  /** 정답(힌트 ② 이상)일 때. */
  passGainHint2Plus: 0.05,
  /** 오답일 때 곱하는 값. p ← p × 값 */
  failFactor: 0.75,
  /** 숙달 판정 확률 문턱. */
  masteredP: 0.8,
  /** 숙달 판정에 필요한 서로 다른 정답 과제 수. */
  masteredTaskCount: 2,
  /** 역추적 후보가 되는 확률 상한. */
  backtrackP: 0.6,
  /** 역추적 BFS 최대 깊이. */
  maxBacktrackDepth: 3,
  /** 부스터로 묶는 과제 수(같은 활동에서 최대). */
  boosterTaskCount: 3,
} as const;
