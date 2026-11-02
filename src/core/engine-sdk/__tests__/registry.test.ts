import { describe, expect, it } from 'vitest';
import type { EngineId } from '../types';
import { hasEngine, listEngineIds, loadEngine } from '../registry';

describe('engine registry', () => {
  it('엔진 폴더를 자동으로 찾는다', () => {
    const ids = listEngineIds();
    expect(ids).toContain('E00');
    expect(hasEngine('E00')).toBe(true);
    expect(hasEngine('E99')).toBe(false);
  });

  it('E00-demo를 지연 로딩한다', async () => {
    const definition = await loadEngine('E00');
    expect(definition.id).toBe('E00');
    expect(definition.modes).toEqual(['free']);
    expect(definition.events.length).toBeGreaterThan(0);
    expect(definition.overlays?.['lasso-guide']).toBeDefined();
    expect(definition.observe(definition.createInitialState({} as never), {} as never)).toEqual({
      count: 0,
      groups: [],
    });
  });

  it('없는 엔진은 오류다', async () => {
    await expect(loadEngine('E99' as EngineId)).rejects.toThrow('등록되지 않은 엔진');
  });
});
