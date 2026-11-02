import { describe, expect, it } from 'vitest';
import { appStrings } from './strings.ko';

describe('appStrings', () => {
  it('앱 이름이 MathExplorer이고 학년 표시가 없다', () => {
    expect(appStrings.title).toBe('MathExplorer');
    for (const s of Object.values(appStrings)) {
      expect(s).not.toMatch(/\d\s*학년/);
    }
  });
});
