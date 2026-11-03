import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../core/engine-sdk';
import { constellationUnitIds, resolveEnabledUnitIds } from './content-units';

describe('resolveEnabledUnitIds', () => {
  it('설정이 없으면 콘텐츠가 있는 단원을 모두 켠다', () => {
    expect([...resolveEnabledUnitIds(undefined, ['a', 'b'])]).toEqual(['a', 'b']);
  });

  it('빈 배열은 모두 끈 상태다', () => {
    expect([...resolveEnabledUnitIds([], ['a', 'b'])]).toEqual([]);
  });

  it('저장된 단원만 켠다', () => {
    expect([...resolveEnabledUnitIds(['b'], ['a', 'b'])]).toEqual(['b']);
  });

  it('문자열이 아닌 값은 버리고, 목록에 없는 단원 ID는 남긴다', () => {
    const raw: JsonValue = ['a', 3, null, 'z'];
    expect([...resolveEnabledUnitIds(raw, ['a', 'b'])]).toEqual(['a', 'z']);
  });

  it('배열이 아닌 설정은 기본값으로 본다', () => {
    expect([...resolveEnabledUnitIds('a', ['a', 'b'])]).toEqual(['a', 'b']);
    expect([...resolveEnabledUnitIds({ a: true }, ['a'])]).toEqual(['a']);
  });
});

describe('constellationUnitIds', () => {
  it('개념이 없는 demo는 빼고 실제 콘텐츠 단원만 돌려준다', () => {
    const ids = constellationUnitIds();
    expect(ids).not.toContain('demo');
    expect(ids).toContain('g3s1u6');
  });
});
