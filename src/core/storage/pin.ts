/**
 * 교사 PIN.
 *
 * 이 PIN은 보안 장치가 아니라 학생이 실수로 교사 화면에 들어가는 것을 막는 문이다.
 * 그래도 원문은 저장하지 않고 salt를 붙인 SHA-256 해시만 저장한다.
 * 서버가 없으므로 PBKDF2 같은 느린 해시는 쓰지 않는다(오프라인 기기 잠금 용도).
 */
import type { TeacherPinRecord } from './types';

const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export class PinFormatError extends Error {
  constructor(pin: string) {
    super(`PIN은 숫자 4~6자리여야 합니다: ${pin.length}자`);
    this.name = 'PinFormatError';
  }
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('보안 난수 생성기를 쓸 수 없습니다.');
  }
  return toHex(cryptoApi.getRandomValues(new Uint8Array(16)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return diff === 0;
}

/** salt를 생략하면 새 난수를 만든다. 테스트에서는 고정 salt를 넘긴다. */
export async function hashPin(pin: string, salt = randomSalt()): Promise<TeacherPinRecord> {
  if (!isValidPin(pin)) throw new PinFormatError(pin);
  if (salt.length === 0) throw new Error('salt가 비어 있습니다.');

  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return {
    algorithm: 'SHA-256',
    salt,
    hash: toHex(new Uint8Array(digest)),
  };
}

export async function verifyPin(pin: string, record: TeacherPinRecord): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const candidate = await hashPin(pin, record.salt);
  return constantTimeEqual(candidate.hash, record.hash);
}
