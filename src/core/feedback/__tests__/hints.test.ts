import { describe, expect, it } from 'vitest';
import type { HintRule, Observation } from '../../engine-sdk';
import { feedbackStrings } from '../strings.ko';
import { fillHintTemplate, hintLevelFor, selectHint, type HintRequest } from '../hints';

const WRONG: Observation = {
  response: { ans: { raw: '2/5', value: '2/5' } },
};

const HINTS: readonly HintRule[] = [
  {
    when: { misconception: 'MC-FRAC-ADD-DENOM' },
    level: 1,
    say: '쓴 답 {student}를 다시 볼까요? {a}와 {b}를 더해요.',
  },
  {
    when: { misconception: 'MC-FRAC-ADD-DENOM' },
    level: 2,
    show: { engine: 'E00', overlay: 'lasso-guide' },
  },
  {
    when: { misconception: 'MC-FRAC-ADD-DENOM' },
    level: 3,
    backtrack: 'g4s2u1.unit-fraction-count',
  },
];

function request(overrides: Partial<HintRequest> = {}): HintRequest {
  return {
    hints: HINTS,
    observation: WRONG,
    misconceptions: ['MC-FRAC-ADD-DENOM'],
    level: 1,
    vars: { a: '1/2', b: '1/3' },
    student: '2/5',
    ...overrides,
  };
}

describe('힌트 단계', () => {
  it('실패 1회 ①, 2회 ②, 3회 이상 ③', () => {
    expect(hintLevelFor(1)).toBe(1);
    expect(hintLevelFor(2)).toBe(2);
    expect(hintLevelFor(3)).toBe(3);
    expect(hintLevelFor(9)).toBe(3);
  });
});

describe('발문 템플릿', () => {
  it('{a}, {b}, {student}를 채운다', () => {
    expect(fillHintTemplate('{a} + {b} = {student}', { a: '1/2', b: '1/3' }, '2/5')).toBe(
      '1/2 + 1/3 = 2/5',
    );
  });

  it('없는 변수나 정답 변수는 채우지 않고 null이다', () => {
    expect(fillHintTemplate('{a} + {missing}', { a: '1/2' }, undefined)).toBeNull();
    expect(fillHintTemplate('{a} + {answer}', { a: '1/2' }, undefined)).toBeNull();
    expect(fillHintTemplate('{a} + {solution}', { a: '1/2' }, undefined)).toBeNull();
    expect(fillHintTemplate('{student}', undefined, '   ')).toBeNull();
  });
});

describe('힌트 규칙 고르기', () => {
  it('오개념 규칙의 단계와 발문을 고른다', () => {
    const selection = selectHint(request());
    expect(selection.kind).toBe('rule');
    if (selection.kind !== 'rule') throw new Error('규칙이어야 합니다.');
    expect(selection.index).toBe(0);
    expect(selection.level).toBe(1);
    expect(selection.text).toBe('쓴 답 2/5를 다시 볼까요? 1/2와 1/3를 더해요.');
  });

  it('단계에 맞는 규칙이 없으면 단계별 기본 발문을 쓴다', () => {
    const selection = selectHint(request({ level: 3, hints: HINTS.slice(0, 2) }));
    expect(selection).toEqual({
      kind: 'default',
      level: 3,
      text: feedbackStrings.defaultHints[3],
    });
  });

  it('오개념이 다르면 규칙을 고르지 않는다', () => {
    const selection = selectHint(request({ misconceptions: [] }));
    expect(selection.kind).toBe('default');
  });

  it('GoalSpec 규칙도 Observation으로 맞춘다', () => {
    const hints: readonly HintRule[] = [
      {
        when: { kind: 'equals', path: 'response.ans.value', value: '2/5' },
        level: 1,
        say: '분모를 다시 살펴볼까요?',
      },
    ];
    const selection = selectHint(request({ hints, misconceptions: [] }));
    expect(selection.kind).toBe('rule');
    expect(selection.kind === 'rule' ? selection.text : null).toBe('분모를 다시 살펴볼까요?');

    const right: Observation = {
      response: { ans: { raw: '5/6', value: '5/6' } },
    };
    expect(selectHint(request({ hints, misconceptions: [], observation: right })).kind).toBe(
      'default',
    );
  });

  it('변수가 빠진 규칙은 건너뛰고 다음 규칙이나 기본 발문을 쓴다', () => {
    const hints: readonly HintRule[] = [
      { when: { misconception: 'MC-FRAC-ADD-DENOM' }, level: 1, say: '{missing}' },
      { when: { misconception: 'MC-FRAC-ADD-DENOM' }, level: 1, say: '다시 볼까요?' },
    ];
    const selection = selectHint(request({ hints }));
    expect(selection.kind).toBe('rule');
    expect(selection.kind === 'rule' ? selection.index : -1).toBe(1);

    const onlyMissing = selectHint(request({ hints: hints.slice(0, 1) }));
    expect(onlyMissing.kind).toBe('default');
  });

  it('학생 표기가 없으면 {student} 규칙을 건너뛴다', () => {
    const selection = selectHint(request({ student: undefined }));
    expect(selection.kind).toBe('default');
  });

  it('기본 발문에는 정답을 알려 주는 말이 없다', () => {
    const text = Object.values(feedbackStrings.defaultHints).join(' ');
    expect(text).not.toContain('정답');
    expect(feedbackStrings.helpTitle).not.toContain('정답');
    expect(feedbackStrings.helpBody).not.toContain('정답');
  });
});
