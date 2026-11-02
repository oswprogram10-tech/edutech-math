import { describe, expect, it } from 'vitest';
import { ContentSchemaError, parseUnitContent } from '../content-schema';

function task(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo.A3.T1',
    prompt: '1/2 + 1/3을 분수로 써 보세요.',
    engine: 'E00',
    mode: 'free',
    cpa: 'A',
    config: {},
    goal: { kind: 'equals', path: 'response.ans.value', value: '5/6' },
    hints: [],
    concepts: [],
    submit: 'button',
    response: { fields: [{ kind: 'number', id: 'ans', forms: ['fraction'] }] },
    ...overrides,
  };
}

function contentOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    unit: 'demo',
    title: '답을 직접 써 보기',
    activities: [{ id: 'demo.A3', title: '답', tasks: [task(overrides)] }],
  };
}

describe('응답 슬롯 콘텐츠 스키마', () => {
  it('응답 필드가 있는 button 과제를 읽는다', () => {
    const parsed = parseUnitContent(contentOf());
    expect(parsed.activities[0]?.tasks[0]?.response?.fields[0]).toMatchObject({
      kind: 'number',
      id: 'ans',
    });
  });

  it('submit이 auto면 응답 과제를 거부한다', () => {
    expect(() => parseUnitContent(contentOf({ submit: 'auto' }))).toThrow(ContentSchemaError);
  });

  it('views에 예약 슬롯 response를 쓰면 거부한다', () => {
    const withResponseSlot = contentOf({
      views: [
        {
          slot: 'response',
          engine: 'E00',
          mode: 'free',
          cpa: 'A',
          config: {},
        },
      ],
    });
    expect(() => parseUnitContent(withResponseSlot)).toThrow(ContentSchemaError);
  });

  it('응답 필드 id가 중복되면 거부한다', () => {
    const duplicate = contentOf({
      response: {
        fields: [
          { kind: 'number', id: 'ans', forms: ['integer'] },
          { kind: 'compare', id: 'ans', left: '1/2', right: '1/3' },
        ],
      },
    });
    expect(() => parseUnitContent(duplicate)).toThrow(ContentSchemaError);
  });

  it('빈 fields와 모르는 필드 키를 거부한다', () => {
    expect(() => parseUnitContent(contentOf({ response: { fields: [] } }))).toThrow(
      ContentSchemaError,
    );
    expect(() =>
      parseUnitContent(
        contentOf({
          response: { fields: [{ kind: 'number', id: 'ans', forms: ['fraction'], answer: '5/6' }] },
        }),
      ),
    ).toThrow(ContentSchemaError);
  });

  it('showEngine은 참·거짓만 받는다', () => {
    expect(() => parseUnitContent(contentOf({ showEngine: 'no' }))).toThrow(ContentSchemaError);
    const parsed = parseUnitContent(contentOf({ showEngine: false }));
    expect(parsed.activities[0]?.tasks[0]?.showEngine).toBe(false);
  });

  it('그림 선택지의 엔진 ID 형식을 검사한다', () => {
    expect(() =>
      parseUnitContent(
        contentOf({
          response: {
            fields: [
              {
                kind: 'choice',
                id: 'pick',
                multiple: false,
                options: [
                  {
                    id: 'a',
                    label: '가',
                    figure: { engine: 'E5', mode: 'shade', cpa: 'P', config: {} },
                  },
                ],
              },
            ],
          },
        }),
      ),
    ).toThrow(ContentSchemaError);
  });
});
