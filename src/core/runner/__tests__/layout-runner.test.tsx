// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { loadEngine } from '../../engine-sdk';
import type { EngineId, LoadedEngine } from '../../engine-sdk';
import { ActivityRunner } from '../ActivityRunner';
import { parseUnitContent } from '../content-schema';
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

describe('판 크기 방식(data-layout)', () => {
  it('세로셈(E07)은 content, 블록(E01)은 fit으로 그린다', () => {
    render(<ActivityRunner content={demo} definitions={definitions} activityId="demo.A4" />);

    expect(screen.getByTestId('runner-slot-right').getAttribute('data-layout')).toBe('content');
    expect(screen.getByTestId('runner-slot-left').getAttribute('data-layout')).toBe('fit');
  });

  it('응답 칸은 content로 그린다', () => {
    render(<ActivityRunner content={demo} definitions={definitions} activityId="demo.A3" />);

    expect(screen.getByTestId('runner-slot-response').getAttribute('data-layout')).toBe('content');
  });
});
