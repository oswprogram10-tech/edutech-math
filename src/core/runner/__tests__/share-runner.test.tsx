// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { loadEngine } from '../../engine-sdk';
import type { EngineId, LoadedEngine } from '../../engine-sdk';
import { DemoScreen } from '../../../app/DemoScreen';
import { demoStrings } from '../../../engines/E00-demo/strings.ko';
import { ActivityRunner } from '../ActivityRunner';
import { parseUnitContent } from '../content-schema';
import { decodeSharePayload } from '../share';
import { runnerStrings } from '../strings.ko';
import { engineIdsOfContent } from '../views';
import type { UnitContent } from '../types';

type JsonModule = { readonly default: unknown };

const FAKE_PROMPT = '셈돌 두 개를 놓고 5를 써 보세요.';

/** 엔진 칸(E00)과 응답 칸(수)이 함께 있는 가짜 과제. */
const FAKE_CONTENT: UnitContent = {
  unit: 'demo',
  title: '보여 주기 테스트',
  activities: [
    {
      id: 'fake.A1',
      title: '가짜 활동',
      tasks: [
        {
          id: 'fake.A1.T1',
          prompt: FAKE_PROMPT,
          engine: 'E00',
          mode: 'free',
          cpa: 'C',
          config: { gridSize: 100 },
          goal: { kind: 'equals', path: 'response.ans.value', value: '5' },
          hints: [],
          concepts: [],
          submit: 'button',
          response: { fields: [{ kind: 'number', id: 'ans', forms: ['fraction'] }] },
        },
      ],
    },
  ],
};

const demoModules = import.meta.glob<JsonModule>('../../../../data/content/demo.json', {
  eager: true,
});

let demo: UnitContent;
let definitions: ReadonlyMap<EngineId, LoadedEngine>;

beforeAll(async () => {
  const entry = Object.values(demoModules)[0];
  if (!entry) throw new Error('demo.json을 읽지 못했습니다.');
  demo = parseUnitContent(entry.default);
  const ids = engineIdsOfContent(demo);
  const loaded = await Promise.all(ids.map(async (id) => [id, await loadEngine(id)] as const));
  definitions = new Map(loaded);
});

afterEach(cleanup);

describe('S3 보여 주기', () => {
  it('공유 코드에 응답 슬롯·판정 결과·과제 ID를 넣지 않는다', async () => {
    render(<ActivityRunner content={demo} definitions={definitions} activityId="demo.A3" />);

    await screen.findByText('1/2 + 1/3을 한 번에 나타낸 수를 분수로 써 보세요.');
    fireEvent.click(screen.getByRole('button', { name: runnerStrings.show }));

    const input = (await screen.findByTestId('share-code')) as HTMLInputElement;
    const decoded = decodeSharePayload(input.value);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.payload.views.map((view) => view.slot)).toEqual(['main']);
    expect(decoded.payload.views.some((view) => view.slot === 'response')).toBe(false);
    expect(
      decoded.payload.actions.some((action) => 'slot' in action && action.slot === 'response'),
    ).toBe(false);

    const json = JSON.stringify(decoded.payload);
    expect(json).not.toContain('response');
    expect(json).not.toContain('goal');
    expect(json).not.toContain('judgment');
    expect(json).not.toContain('5/6');
    expect(json).not.toContain('demo.A3.T1');
    expect(json).not.toContain('learner');
  });

  it('응답 입력을 되돌린 기록은 공유 코드에서 빠져 시연 모드가 엔진 조작만 재생한다', async () => {
    const { unmount } = render(<ActivityRunner content={FAKE_CONTENT} definitions={definitions} />);
    await screen.findByText(FAKE_PROMPT);

    // 엔진 조작 2묶음: 셈돌 두 개 놓기.
    const enginePanel = screen.getByTestId('runner-slot-main');
    const addCounter = within(enginePanel).getByRole('button', { name: demoStrings.addCounter });
    fireEvent.click(addCounter);
    fireEvent.click(addCounter);

    // 응답 입력 1묶음: 5 한 글자.
    const responsePanel = screen.getByTestId('runner-slot-response');
    fireEvent.click(within(responsePanel).getByRole('button', { name: '5' }));

    // 마지막 묶음(응답 입력)을 되돌린다.
    fireEvent.click(screen.getByRole('button', { name: runnerStrings.undo }));
    fireEvent.click(screen.getByRole('button', { name: runnerStrings.show }));

    const input = (await screen.findByTestId('share-code')) as HTMLInputElement;
    const code = input.value;
    const decoded = decodeSharePayload(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    // 응답 Action도, 응답만 가리키는 되돌리기도 남지 않는다.
    expect(decoded.payload.views.map((view) => view.slot)).toEqual(['main']);
    expect(decoded.payload.actions).toHaveLength(2);
    expect(decoded.payload.actions.every((action) => 'slot' in action)).toBe(true);
    expect(decoded.payload.actions.some((action) => 'control' in action)).toBe(false);

    unmount();

    // 시연 모드를 공유 코드로 열면 셈돌 두 개가 그대로 보인다.
    render(<DemoScreen code={code} />);
    const pane = await screen.findByTestId('pane-left-slot-main', {}, { timeout: 5000 });
    expect(pane.querySelectorAll('[data-counter-id]')).toHaveLength(2);
  });
});
