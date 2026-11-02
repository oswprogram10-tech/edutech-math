/**
 * 힌트 규칙 고르기(순수 함수).
 *
 * 입력: 과제의 `hints`, 합친 Observation, 이번 제출에서 감지된 오개념 코드,
 * 실패 횟수로 정한 단계, 발문 변수. 출력: 그 단계에서 보여 줄 규칙 하나 또는
 * 단계별 일반 발문. 화면·기록은 실행기가 맡는다.
 */
import type { GoalSpec, HintRule, Observation } from '../engine-sdk';
import { evaluateGoal } from '../runner/goal';
import type { GoalEngine } from '../runner/goal';
import { feedbackStrings } from './strings.ko';

export type HintLevel = 1 | 2 | 3;

export interface HintRequest {
  readonly hints: readonly HintRule[];
  readonly observation: Observation;
  readonly misconceptions: readonly string[];
  readonly level: HintLevel;
  readonly engine?: GoalEngine;
  /** 과제의 `hintVars`. */
  readonly vars?: Readonly<Record<string, string>>;
  /** 첫 수 응답 필드의 `raw`. */
  readonly student?: string;
}

export interface RuleHint {
  readonly kind: 'rule';
  /** `hints` 배열에서의 위치(0부터). 기록의 `rule` 값이다. */
  readonly index: number;
  readonly level: HintLevel;
  readonly rule: HintRule;
  /** 변수를 채운 발문. 규칙에 `say`가 없으면 null. */
  readonly text: string | null;
}

export interface DefaultHint {
  readonly kind: 'default';
  readonly level: HintLevel;
  readonly text: string;
}

export type HintSelection = RuleHint | DefaultHint;

/** 실패 횟수 → 힌트 단계. 1회 ①, 2회 ②, 3회 이상 ③. */
export function hintLevelFor(failures: number): HintLevel {
  if (failures <= 1) return 1;
  if (failures === 2) return 2;
  return 3;
}

/**
 * `{a}`, `{b}`, `{student}` 같은 변수를 채운다.
 * 값이 없는 변수가 하나라도 있으면 null을 돌려준다(빈칸 문장 금지).
 * `{answer}`는 만들지 않는다. 콘텐츠에 있어도 채우지 않고 규칙을 건너뛴다.
 */
export function fillHintTemplate(
  template: string,
  vars: Readonly<Record<string, string>> | undefined,
  student: string | undefined,
): string | null {
  let missing = false;
  const filled = template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_match, name: string) => {
    if (name === 'answer' || name === 'solution') {
      missing = true;
      return '';
    }
    const value = name === 'student' ? student : vars?.[name];
    if (typeof value !== 'string' || value.trim().length === 0) {
      missing = true;
      return '';
    }
    return value;
  });
  return missing ? null : filled;
}

function matchesWhen(
  when: HintRule['when'],
  observation: Observation,
  misconceptions: readonly string[],
  engine: GoalEngine | undefined,
): boolean {
  if ('misconception' in when) return misconceptions.includes(when.misconception);
  return evaluateGoal(when as GoalSpec, observation, engine);
}

export function selectHint(request: HintRequest): HintSelection {
  for (const [index, rule] of request.hints.entries()) {
    if (rule.level !== request.level) continue;
    if (!matchesWhen(rule.when, request.observation, request.misconceptions, request.engine)) {
      continue;
    }

    if (rule.say === undefined) {
      return { kind: 'rule', index, level: request.level, rule, text: null };
    }
    const text = fillHintTemplate(rule.say, request.vars, request.student);
    if (text === null) continue;
    return { kind: 'rule', index, level: request.level, rule, text };
  }

  return {
    kind: 'default',
    level: request.level,
    text: feedbackStrings.defaultHints[request.level],
  };
}
