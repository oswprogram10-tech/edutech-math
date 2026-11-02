/**
 * 상태 공유 코드.
 *
 * 엔진 상태 JSON을 lz-string으로 압축해 URL 해시(`#s=<code>`)에 담는다.
 * 서버 없이 교사 화면·다른 기기로 상태를 옮길 때 쓴다.
 * 코드가 4,000자를 넘으면 던지지 않고 TOO_LONG을 돌려준다(호출한 쪽이 파일 내보내기를 안내).
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { assertSerializable } from '../engine-sdk';
import type { JsonValue } from '../engine-sdk';
import { storageStrings } from './strings.ko';

export const SHARE_CODE_MAX_LENGTH = 4000;
export const SHARE_HASH_PREFIX = '#s=';

export type ShareCodeError = 'TOO_LONG' | 'INVALID';

export type ShareCodeResult =
  | { readonly ok: true; readonly code: string; readonly length: number }
  | {
      readonly ok: false;
      readonly error: ShareCodeError;
      readonly length: number;
      readonly message: string;
    };

export type DecodeShareCodeResult =
  | { readonly ok: true; readonly state: JsonValue }
  | { readonly ok: false; readonly error: 'INVALID'; readonly message: string };

export function encodeShareCode(state: JsonValue): ShareCodeResult {
  let json: string;
  try {
    assertSerializable(state);
    const text = JSON.stringify(state);
    if (typeof text !== 'string') {
      return {
        ok: false,
        error: 'INVALID',
        length: 0,
        message: storageStrings.invalidShareCode,
      };
    }
    json = text;
  } catch {
    return {
      ok: false,
      error: 'INVALID',
      length: 0,
      message: storageStrings.invalidShareCode,
    };
  }

  const code = compressToEncodedURIComponent(json);
  if (code.length > SHARE_CODE_MAX_LENGTH) {
    return {
      ok: false,
      error: 'TOO_LONG',
      length: code.length,
      message: storageStrings.shareCodeTooLong,
    };
  }
  return { ok: true, code, length: code.length };
}

export function decodeShareCode(code: string): DecodeShareCodeResult {
  if (code.length === 0 || code.length > SHARE_CODE_MAX_LENGTH) {
    return { ok: false, error: 'INVALID', message: storageStrings.invalidShareCode };
  }

  const json = decompressFromEncodedURIComponent(code);
  if (typeof json !== 'string' || json.length === 0) {
    return { ok: false, error: 'INVALID', message: storageStrings.invalidShareCode };
  }

  let state: unknown;
  try {
    state = JSON.parse(json);
    assertSerializable(state);
  } catch {
    return { ok: false, error: 'INVALID', message: storageStrings.invalidShareCode };
  }
  return { ok: true, state: state as JsonValue };
}

export function shareHash(code: string): string {
  return `${SHARE_HASH_PREFIX}${code}`;
}

/**
 * URL 해시에서 코드를 꺼낸다. `+`와 `$`가 lz-string 코드에 들어가므로
 * URLSearchParams(decodeURIComponent)를 쓰지 않고 원문 그대로 읽는다.
 */
export function readShareCodeFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.startsWith('s=')) return null;
  const code = raw.slice(2);
  return code.length > 0 ? code : null;
}
