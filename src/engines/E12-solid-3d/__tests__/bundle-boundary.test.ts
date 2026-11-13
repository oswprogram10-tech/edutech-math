/** E12 three·@react-three 번들 경계 검증: E12-solid-3d/three/ 밖에는 import 금지. */
import { describe, expect, it } from 'vitest';

const SOURCE_FILES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const THREE_IMPORT_RE =
  /(?:from\s+['"](?:three|@react-three\/)|import\s*\(\s*['"](?:three|@react-three\/)|import\s+['"](?:three|@react-three\/))/;

describe('E12 three/fiber 번들 경계', () => {
  it('src/engines/E12-solid-3d/three/ 밖의 어떤 소스도 three나 @react-three를 import하지 않는다', () => {
    const entries = Object.entries(SOURCE_FILES);
    expect(entries.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const [path, source] of entries) {
      if (path.startsWith('/src/engines/E12-solid-3d/three/')) continue;
      if (THREE_IMPORT_RE.test(source)) {
        violations.push(path);
      }
    }
    expect(violations).toEqual([]);
  });
});
