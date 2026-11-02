// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { loadEngine } from '../../engine-sdk';
import type { EngineId, LoadedEngine } from '../../engine-sdk';
import { ActivityRunner } from '../ActivityRunner';
import { parseUnitContent } from '../content-schema';
import { decodeSharePayload } from '../share';
import { runnerStrings } from '../strings.ko';
import { engineIdsOfContent } from '../views';
import type { UnitContent } from '../types';

type JsonModule = { readonly default: unknown };

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
});
