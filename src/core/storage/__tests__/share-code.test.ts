import { describe, expect, it } from 'vitest';
import {
  decodeShareCode,
  encodeShareCode,
  readShareCodeFromHash,
  SHARE_CODE_MAX_LENGTH,
  SHARE_HASH_PREFIX,
  shareHash,
} from '../share-code';

describe('encodeShareCode / decodeShareCode', () => {
  it('엔진 상태 JSON을 왕복한다', () => {
    const state = {
      counters: [
        { id: 'c1', x: 100, y: 200 },
        { id: 'c2', x: 300, y: 400 },
      ],
      groups: [{ id: 'g1', counterIds: ['c1'] }],
      note: '한글도 그대로',
      none: null,
    };

    const encoded = encodeShareCode(state);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeShareCode(encoded.code);
    expect(decoded).toEqual({ ok: true, state });
  });

  it('URL 해시에 넣을 수 있는 문자만 쓴다', () => {
    const encoded = encodeShareCode({ text: '가나다라마바사'.repeat(20) });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    // lz-string의 URI-safe 알파벳. URL 해시에 그대로 넣을 수 있다.
    expect(encoded.code).toMatch(/^[A-Za-z0-9+\-$]*$/);
    expect(encoded.code).not.toMatch(/[#%&?/ ]/);
  });

  it('4,000자를 넘으면 TOO_LONG을 돌려준다(던지지 않음)', () => {
    const big = Array.from({ length: 600 }, () => crypto.randomUUID()).join('');
    const encoded = encodeShareCode({ big });

    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.error).toBe('TOO_LONG');
    expect(encoded.length).toBeGreaterThan(SHARE_CODE_MAX_LENGTH);
    expect(encoded.message).toContain('파일로 내보내기');
  });

  it('깨진 코드는 INVALID', () => {
    expect(decodeShareCode('')).toMatchObject({ ok: false, error: 'INVALID' });
    expect(decodeShareCode('!!!!')).toMatchObject({ ok: false, error: 'INVALID' });
    expect(decodeShareCode('x'.repeat(SHARE_CODE_MAX_LENGTH + 1))).toMatchObject({
      ok: false,
      error: 'INVALID',
    });
  });
});

describe('URL 해시', () => {
  it('#s=<코드> 형식으로 읽고 쓴다', () => {
    const code = 'ABC+123$';
    expect(shareHash(code)).toBe(`${SHARE_HASH_PREFIX}${code}`);
    expect(readShareCodeFromHash(`#s=${code}`)).toBe(code);
    expect(readShareCodeFromHash(`s=${code}`)).toBe(code);
  });

  it('다른 해시는 무시한다', () => {
    expect(readShareCodeFromHash('')).toBeNull();
    expect(readShareCodeFromHash('#/sandbox/E00')).toBeNull();
    expect(readShareCodeFromHash('#s=')).toBeNull();
  });

  it('+와 $를 URL 디코딩하지 않는다', () => {
    expect(readShareCodeFromHash('#s=a+b$c')).toBe('a+b$c');
  });
});
