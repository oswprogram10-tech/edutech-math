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

/**
 * `crypto.subtle`을 쓸 수 없는 환경(HTTPS가 아닌 http로 접속한 같은 와이파이 기기 등)에서
 * PIN 해시를 시도하면 던진다. 화면 안내는 T006에서 붙인다.
 */
export class PinUnavailableError extends Error {
  readonly code = 'PIN_UNAVAILABLE';

  constructor() {
    super('이 환경에서는 PIN을 안전하게 해시할 수 없습니다. HTTPS로 접속해 주세요.');
    this.name = 'PinUnavailableError';
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

/**
 * salt를 생략하면 새 난수를 만든다. 테스트에서는 고정 salt를 넘긴다.
 *
 * `crypto.subtle`은 보안 컨텍스트(HTTPS·localhost)에서만 제공된다.
 * http로 접속한 같은 와이파이 기기에서는 `PinUnavailableError`(code: `PIN_UNAVAILABLE`)를 던진다.
 */
export async function hashPin(pin: string, salt?: string): Promise<TeacherPinRecord> {
  if (!isValidPin(pin)) throw new PinFormatError(pin);

  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') throw new PinUnavailableError();

  const actualSalt = salt ?? randomSalt();
  if (actualSalt.length === 0) throw new Error('salt가 비어 있습니다.');

  const data = new TextEncoder().encode(`${actualSalt}:${pin}`);
  const digest = await subtle.digest('SHA-256', data);
  return {
    algorithm: 'SHA-256',
    salt: actualSalt,
    hash: toHex(new Uint8Array(digest)),
  };
}

/**
 * PIN이 맞는지 확인한다.
 * `crypto.subtle`이 없으면 hashPin과 같이 `PinUnavailableError`를 던진다.
 */
export async function verifyPin(pin: string, record: TeacherPinRecord): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const candidate = await hashPin(pin, record.salt);
  return constantTimeEqual(candidate.hash, record.hash);
}
