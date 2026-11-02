/**
 * 이벤트·기기 ID 생성.
 * HTTPS(또는 localhost)에서는 crypto.randomUUID()를 쓴다.
 * 아주 오래된 브라우저를 위해 getRandomValues 기반 UUID v4 대체를 둔다.
 */
export function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }
  throw new Error('보안 난수 생성기를 쓸 수 없습니다.');
}
