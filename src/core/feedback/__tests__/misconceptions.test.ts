import { describe, expect, it } from 'vitest';
import type { Observation } from '../../engine-sdk';
import {
  MISCONCEPTIONS,
  backtrackTarget,
  diagnoseDetectorOf,
  diagnoseObservation,
  misconceptionOf,
} from '../misconceptions';
import type { ContentTask } from '../../runner/types';

interface UnitsFile {
  readonly units: readonly { readonly id: string }[];
}

interface ConceptsFile {
  readonly concepts: readonly { readonly id: string }[];
}

type JsonModule = { readonly default: unknown };

const dataModules = import.meta.glob<JsonModule>('../../../../data/*.json', { eager: true });
const docModules = import.meta.glob<string>('../../../../docs/05-learning-engine.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function dataAt<T>(suffix: string): T {
  const entry = Object.entries(dataModules).find(([path]) => path.endsWith(suffix));
  if (!entry) throw new Error(`데이터 파일을 찾을 수 없습니다: ${suffix}`);
  return entry[1].default as T;
}

const W1_UNITS = new Set(['g3s1u6', 'g3s2u4', 'g4s2u1', 'g4s2u3', 'g5s1u4', 'g5s1u5']);

/** docs/05 §5 표에서 W1 단원을 하나라도 쓰는 코드를 읽는다. */
function documentedW1Codes(): Set<string> {
  const text = Object.values(docModules)[0] ?? '';
  if (text.length === 0) throw new Error('docs/05-learning-engine.md를 읽지 못했습니다.');
  const codes = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\| `([A-Z0-9-]+)` \| [^|]* \| ([^|]*) \|/.exec(line);
    if (!match) continue;
    const units = (match[2] as string)
      .split(',')
      .map((unit) => unit.trim())
      .filter((unit) => unit.length > 0);
    if (units.some((unit) => W1_UNITS.has(unit))) codes.add(match[1] as string);
  }
  return codes;
}

describe('W1 오개념 레지스트리', () => {
  const units = new Set(dataAt<UnitsFile>('/units.json').units.map((unit) => unit.id));
  const concepts = new Set(
    dataAt<ConceptsFile>('/concepts.json').concepts.map((concept) => concept.id),
  );

  it('docs/05 §5의 W1 코드를 모두 담는다', () => {
    const documented = documentedW1Codes();
    expect(documented.size).toBeGreaterThan(20);
    expect([...MISCONCEPTIONS.map((item) => item.code)].sort()).toEqual([...documented].sort());
  });

  it('코드·뜻·단원이 비어 있지 않고 단원 ID가 실제로 있다', () => {
    for (const item of MISCONCEPTIONS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.units.length).toBeGreaterThan(0);
      for (const unit of item.units) {
        expect(units.has(unit), `${item.code}: 없는 단원 ${unit}`).toBe(true);
      }
    }
  });

  it('역추적 대상이 concepts.json 또는 units.json에 있다', () => {
    for (const item of MISCONCEPTIONS) {
      if (!item.backtrack) continue;
      expect(
        concepts.has(item.backtrack) || units.has(item.backtrack),
        `${item.code}: 없는 역추적 대상 ${item.backtrack}`,
      ).toBe(true);
    }
  });

  it('감지 방식에 맞는 감지 함수가 있다', () => {
    // E08 대분수 뺄셈처럼 엔진 Observation과 응답 값 양쪽에서 잡는 코드가 있다.
    const dualDetect = new Set(['MC-SUB-SMALLER-FROM-LARGER']);
    for (const item of MISCONCEPTIONS) {
      if (item.detect === 'diagnose' || dualDetect.has(item.code)) {
        expect(diagnoseDetectorOf(item.code), item.code).toBeTypeOf('function');
      } else {
        expect(diagnoseDetectorOf(item.code), item.code).toBeUndefined();
      }
    }
  });

  it('코드로 레지스트리를 찾는다', () => {
    expect(misconceptionOf('MC-FRAC-ADD-DENOM')?.backtrack).toBe('g4s2u1.unit-fraction-count');
    expect(misconceptionOf('MC-NOT-A-CODE')).toBeUndefined();
  });
});

function taskWithDiagnose(): ContentTask {
  return {
    id: 't1',
    prompt: '1/2 + 1/3',
    engine: 'E00',
    mode: 'free',
    cpa: 'A',
    config: {},
    goal: { kind: 'equals', path: 'response.ans.value', value: '5/6' },
    hints: [],
    concepts: [],
    submit: 'button',
    response: {
      fields: [
        { kind: 'number', id: 'ans', forms: ['fraction'] },
        { kind: 'number', id: 'pick', forms: ['fraction'] },
      ],
    },
    diagnose: [
      { code: 'MC-FRAC-ADD-DENOM', args: { a: '1/2', b: '1/3' } },
      {
        code: 'MC-FRAC-PART-PART',
        args: { part: '3', whole: '8' },
        path: 'response.pick.value',
      },
    ],
  };
}

describe('응답 관찰에서 오개념 진단', () => {
  it('첫 수 필드의 value·raw로 기본 경로를 읽는다', () => {
    const observation: Observation = {
      response: { ans: { raw: '2/5', value: '2/5' }, pick: { raw: '', value: null } },
    };
    expect(diagnoseObservation(taskWithDiagnose(), observation)).toEqual(['MC-FRAC-ADD-DENOM']);
  });

  it('path를 준 규칙은 그 경로를 읽는다', () => {
    const observation: Observation = {
      response: { ans: { raw: '', value: null }, pick: { raw: '3/5', value: '3/5' } },
    };
    expect(diagnoseObservation(taskWithDiagnose(), observation)).toEqual(['MC-FRAC-PART-PART']);
  });

  it('정답이면 감지하지 않고, 없는 코드는 건너뛴다', () => {
    const observation: Observation = {
      response: { ans: { raw: '5/6', value: '5/6' }, pick: { raw: '', value: null } },
    };
    expect(diagnoseObservation(taskWithDiagnose(), observation)).toEqual([]);

    const task: ContentTask = {
      ...taskWithDiagnose(),
      diagnose: [{ code: 'MC-NOT-A-CODE' }],
    };
    expect(diagnoseObservation(task, observation)).toEqual([]);
  });

  it('규칙의 역추적 대상이 레지스트리보다 먼저다', () => {
    expect(backtrackTarget('g5s1u2.common-factor-gcd', ['MC-FRAC-ADD-DENOM'])).toBe(
      'g5s1u2.common-factor-gcd',
    );
    expect(backtrackTarget(undefined, ['MC-FRAC-ADD-DENOM'])).toBe('g4s2u1.unit-fraction-count');
    expect(backtrackTarget(undefined, [])).toBeUndefined();
  });
});
