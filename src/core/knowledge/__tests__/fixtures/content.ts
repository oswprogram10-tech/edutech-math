/**
 * T013 역추적 시나리오용 가짜 콘텐츠.
 *
 * 실제 `data/content/`에는 아직 W1 단원 콘텐츠가 없으므로 테스트에서만 쓴다.
 * `g5s1u4`에서 3번 틀리면 오개념 역추적 대상(g4s2u1.unit-fraction-count)을 거쳐
 * `g3s1u6.unit-fraction` 부스터가 열리도록 개념 ID를 맞춰 두었다.
 */
import type { UnitContent } from '../../../runner/types';

export const g5s1u4Content: UnitContent = {
  unit: 'g5s1u4',
  title: '약분과 통분',
  activities: [
    {
      id: 'g5s1u4.A1',
      title: '통분해서 더하기',
      tasks: [
        {
          id: 'g5s1u4.A1.T1',
          prompt: '1/2 + 1/3을 분수로 써 보세요.',
          engine: 'E00',
          mode: 'free',
          cpa: 'A',
          config: { gridSize: 100 },
          goal: { kind: 'equals', path: 'response.ans.value', value: '5/6' },
          hints: [],
          concepts: ['g5s1u4.common-denominator'],
          submit: 'button',
          response: { fields: [{ kind: 'number', id: 'ans', forms: ['fraction'] }] },
          diagnose: [{ code: 'MC-FRAC-ADD-DENOM', args: { a: '1/2', b: '1/3' } }],
          showEngine: false,
        },
      ],
    },
  ],
};

function boosterTask(
  id: string,
  answer: string,
): UnitContent['activities'][number]['tasks'][number] {
  return {
    id,
    prompt: '단위분수만큼 색칠한 수를 써 보세요.',
    engine: 'E00',
    mode: 'free',
    cpa: 'A',
    config: { gridSize: 100 },
    goal: { kind: 'equals', path: 'response.ans.value', value: answer },
    hints: [],
    concepts: ['g3s1u6.unit-fraction'],
    submit: 'button',
    response: { fields: [{ kind: 'number', id: 'ans', forms: ['integer'] }] },
    showEngine: false,
  };
}

export const g3s1u6Content: UnitContent = {
  unit: 'g3s1u6',
  title: '분수와 소수',
  activities: [
    {
      id: 'g3s1u6.A1',
      title: '단위분수 알아보기',
      tasks: [
        boosterTask('g3s1u6.A1.T1', '1'),
        boosterTask('g3s1u6.A1.T2', '2'),
        boosterTask('g3s1u6.A1.T3', '3'),
      ],
    },
  ],
};
