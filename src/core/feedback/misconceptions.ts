/**
 * W1·W2 오개념 레지스트리.
 *
 * `docs/05-learning-engine.md` §5 표에서 W1 여섯 단원(g3s1u6, g3s2u4, g4s2u1,
 * g4s2u3, g5s1u4, g5s1u5)과 W2 26개 단원 중 하나라도 쓰는 코드를 모두 옮겼다.
 * `backtrack`은 단원 명세 오개념 표의 ③ 열에 있는 개념·단원 ID다.
 * 기본 발문은 넣지 않는다. 발문은 과제 콘텐츠의 HintRule이 맡는다.
 *
 * `detect: 'observation'` 코드는 힌트의 `when: {misconception}`로는 걸리지
 * 않는다. 콘텐츠는 엔진 predicate `hasMisconception`이나 GoalSpec을 쓴다.
 */
import type { Observation } from '../engine-sdk';
import { diagnoseDetectors } from '../math/diagnose';
import type { DiagnoseDetector } from '../math/diagnose';
import { resolveObservationPath } from '../runner/goal';
import type { ContentTask } from '../runner/types';
import { W2_MISCONCEPTIONS } from './misconceptions-w2';

export type MisconceptionDetect = 'diagnose' | 'observation';

export interface Misconception {
  readonly code: string;
  /** 학생에게 보여 줄 뜻(교사용 화면·기록). */
  readonly label: string;
  /** docs/05 §5의 단원 열. */
  readonly units: readonly string[];
  /** ③ 역추적에서 이동할 개념 ID 또는 단원 ID. */
  readonly backtrack?: string;
  /** `diagnose`면 응답 값으로 감지하고, `observation`이면 엔진 Observation 조건으로 감지한다. */
  readonly detect: MisconceptionDetect;
}

const W1_MISCONCEPTIONS: readonly Misconception[] = [
  {
    code: 'MC-COMMON-DENOM-ONLY-PRODUCT',
    label: '공통분모는 두 분모의 곱이어야만 한다',
    units: ['g5s1u4'],
    backtrack: 'g5s1u2.common-multiple-lcm',
    detect: 'diagnose',
  },
  {
    code: 'MC-DEC-ALIGN-RIGHT',
    label: '소수점 대신 오른쪽 끝을 맞춤',
    units: ['g4s2u3'],
    backtrack: 'g4s2u3.hundredths-thousandths',
    detect: 'diagnose',
  },
  {
    code: 'MC-DEC-LONGER-BIGGER',
    label: '자릿수가 많으면 큰 소수라고 생각',
    units: ['g4s2u3'],
    backtrack: 'g4s2u3.compare-decimals',
    detect: 'diagnose',
  },
  {
    code: 'MC-DEC-POINT-SEPARATOR',
    label: '소수점 뒤 숫자를 별개의 자연수로 봄',
    units: ['g3s1u6', 'g4s2u3'],
    backtrack: 'g3s1u6.tenths-decimal',
    detect: 'diagnose',
  },
  {
    code: 'MC-DEC-TRAILING-ZERO',
    label: '끝자리 0이 값을 바꾼다고 생각',
    units: ['g4s2u3'],
    backtrack: 'g4s2u3.compare-decimals',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-ADD-DENOM',
    label: '분모끼리도 더함',
    units: ['g4s2u1', 'g5s1u5', 'g5s2u2'],
    backtrack: 'g4s2u1.unit-fraction-count',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-ADD-DENOM-HALF',
    label: '분수 덧셈 결과의 분모를 2배로 함',
    units: ['g4s2u1'],
    backtrack: 'g4s2u1.unit-fraction-count',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-ADD-NO-CONVERT-NUM',
    label: '통분할 때 분모만 바꾸고 분자는 그대로',
    units: ['g5s1u5'],
    backtrack: 'g5s1u4.multiply-same',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-BIGGER-DENOM',
    label: '분모가 크면 큰 분수라고 생각',
    units: ['g3s1u6', 'g3s2u4', 'g5s1u4'],
    backtrack: 'g3s1u6.unit-fraction',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-BORROW-AS-TEN',
    label: '받아내림한 1을 10/분모로 바꿈',
    units: ['g4s2u1', 'g5s1u5'],
    backtrack: 'g3s2u4.improper-mixed',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-DEC-LINK',
    label: '10분의 몇과 소수를 연결하지 못함',
    units: ['g3s1u6'],
    backtrack: 'g3s1u6.tenths-decimal',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-DISCRETE-COUNT',
    label: '이산량 분수에서 분모를 개수로 봄',
    units: ['g3s2u4'],
    backtrack: 'g3s2u4.fraction-of-set',
    detect: 'observation',
  },
  {
    code: 'MC-FRAC-EQUIV-ADD-SAME',
    label: '분모·분자에 같은 수를 더해도 크기가 같다',
    units: ['g5s1u4'],
    backtrack: 'g5s1u4.equivalent-fraction',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-GROUP-AS-UNIT',
    label: '묶음 수가 아니라 낱개 수로 분수를 씀',
    units: ['g3s2u4'],
    backtrack: 'g3s2u4.fraction-of-set',
    detect: 'observation',
  },
  {
    code: 'MC-FRAC-IMPROPER-INVALID',
    label: '분자가 분모보다 크면 분수가 아니라고 생각',
    units: ['g3s2u4'],
    backtrack: 'g3s1u6.unit-fraction',
    detect: 'observation',
  },
  {
    code: 'MC-FRAC-MIXED-CONVERT',
    label: '가분수↔대분수 변환 오류',
    units: ['g3s2u4', 'g4s2u1'],
    backtrack: 'g3s2u4.improper-mixed',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-NO-SIMPLIFY',
    label: '계산 결과를 약분하지 않음',
    units: ['g5s1u5'],
    backtrack: 'g5s1u4.simplify',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-NUM-ONLY',
    label: '분수를 두 개의 자연수로 봄',
    units: ['g3s1u6'],
    backtrack: 'g3s1u6.part-of-whole',
    detect: 'observation',
  },
  {
    code: 'MC-FRAC-PART-PART',
    label: '부분 대 부분으로 분수를 씀',
    units: ['g3s1u6'],
    backtrack: 'g3s1u6.equal-parts',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-SEPARATE-PARTS',
    label: '분수 부분 합이 1을 넘어도 정리하지 않음',
    units: ['g4s2u1'],
    backtrack: 'g4s2u1.mixed-add-sub',
    detect: 'diagnose',
  },
  {
    code: 'MC-FRAC-UNEQUAL-PARTS',
    label: '크기가 다른 조각으로 등분했다고 생각',
    units: ['g3s1u6', 'g5s1u4'],
    backtrack: 'g3s1u3.partitive-division',
    detect: 'observation',
  },
  {
    code: 'MC-FRAC-WHOLE-COMPARE-ONLY',
    label: '대분수 비교에서 자연수나 분수 부분만 봄',
    units: ['g3s2u4'],
    backtrack: 'g3s2u4.compare-beyond-one',
    detect: 'observation',
  },
  {
    code: 'MC-FRAC-WHOLE-MINUS',
    label: '자연수에서 분수를 뺄 때 자연수를 분수로 못 바꿈',
    units: ['g4s2u1'],
    backtrack: 'g4s2u1.sub-same-denom',
    detect: 'diagnose',
  },
  {
    code: 'MC-PV-BORROW-NO-DECREMENT',
    label: '받아내림 뒤 윗자리를 그대로 둠',
    units: ['g2s1u3', 'g3s1u1', 'g4s2u3'],
    backtrack: 'g3s1u1.sub-regroup-3digit',
    detect: 'observation',
  },
  {
    code: 'MC-SIMPLIFY-PARTIAL',
    label: '약분을 끝까지 하지 않음',
    units: ['g5s1u4'],
    backtrack: 'g5s1u2.common-factor-gcd',
    detect: 'diagnose',
  },
  {
    code: 'MC-SUB-SMALLER-FROM-LARGER',
    label: '작은 수에서 큰 수를 거꾸로 뺌',
    units: ['g1s2u2', 'g2s1u3', 'g3s1u1', 'g4s2u1', 'g5s1u5'],
    backtrack: 'g4s2u1.mixed-borrow',
    detect: 'observation',
  },
];

/** W1·W2 코드 전체. 코드가 겹치지 않아 순서대로 합치기만 한다. */
export const MISCONCEPTIONS: readonly Misconception[] = [
  ...W1_MISCONCEPTIONS,
  ...W2_MISCONCEPTIONS,
];

const byCode = new Map(MISCONCEPTIONS.map((item) => [item.code, item]));

export function misconceptionOf(code: string): Misconception | undefined {
  return byCode.get(code);
}

export function diagnoseDetectorOf(code: string): DiagnoseDetector | undefined {
  return diagnoseDetectors[code];
}

/** 응답의 첫 수 필드 id. `diagnose.path` 기본값을 만든다. */
function defaultNumberFieldId(task: ContentTask): string | undefined {
  return task.response?.fields.find((field) => field.kind === 'number')?.id;
}

/**
 * 콘텐츠 과제의 `diagnose` 목록을 실행해 감지된 오개념 코드를 돌려준다.
 * 힌트는 제출이 틀렸을 때만 부르므로 정답 제출에서는 부르지 않는다.
 */
export function diagnoseObservation(
  task: ContentTask,
  observation: Observation,
): readonly string[] {
  const specs = task.diagnose ?? [];
  if (specs.length === 0) return [];

  const defaultId = defaultNumberFieldId(task);
  const codes: string[] = [];
  for (const spec of specs) {
    const detector = diagnoseDetectors[spec.code];
    if (!detector) continue;
    const path = spec.path ?? (defaultId === undefined ? undefined : `response.${defaultId}.value`);
    if (path === undefined) continue;

    const found = resolveObservationPath(observation, path);
    if (!found.found || typeof found.value !== 'string') continue;
    const value = found.value;

    let raw: string | null = null;
    if (path.endsWith('.value')) {
      const rawPath = `${path.slice(0, path.length - '.value'.length)}.raw`;
      const rawFound = resolveObservationPath(observation, rawPath);
      if (rawFound.found && typeof rawFound.value === 'string') raw = rawFound.value;
    }

    if (detector({ value, raw, args: spec.args })) {
      if (!codes.includes(spec.code)) codes.push(spec.code);
    }
  }
  return codes;
}

/** ③ 역추적 대상: 규칙의 backtrack → 감지된 오개념의 registry backtrack. */
export function backtrackTarget(
  ruleTarget: string | undefined,
  misconceptions: readonly string[],
): string | undefined {
  if (ruleTarget) return ruleTarget;
  for (const code of misconceptions) {
    const target = byCode.get(code)?.backtrack;
    if (target) return target;
  }
  return undefined;
}
