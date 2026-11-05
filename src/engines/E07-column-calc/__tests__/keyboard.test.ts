/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { isForeignKeyTarget, isTextEntryTarget } from '../keyboard';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('E07 키보드 입력 범위(T079)', () => {
  it('초점 대상이 없거나 body·documentElement면 엔진 밖이 아니다', () => {
    expect(isForeignKeyTarget(null, document.body)).toBe(false);
    expect(isForeignKeyTarget(document.body, document.body)).toBe(false);
    expect(isForeignKeyTarget(document.documentElement, document.body)).toBe(false);
  });

  it('엔진 root 안의 버튼은 엔진 밖이 아니다', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    root.appendChild(button);
    document.body.appendChild(root);
    expect(isForeignKeyTarget(button, root)).toBe(false);
  });

  it('엔진 root 밖의 div[tabindex]는 엔진 밖이다', () => {
    const root = document.createElement('div');
    const outside = document.createElement('div');
    outside.tabIndex = 0;
    document.body.append(root, outside);
    expect(isForeignKeyTarget(outside, root)).toBe(true);
  });

  it('root가 null이면 엔진 밖으로 보지 않는다', () => {
    const outside = document.createElement('div');
    expect(isForeignKeyTarget(outside, null)).toBe(false);
  });

  it('입력 요소는 isTextEntryTarget이 참이고 나머지는 거짓이다', () => {
    expect(isTextEntryTarget(document.createElement('input'))).toBe(true);
    expect(isTextEntryTarget(document.createElement('textarea'))).toBe(true);
    expect(isTextEntryTarget(document.createElement('select'))).toBe(true);
    expect(isTextEntryTarget(document.createElement('button'))).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
