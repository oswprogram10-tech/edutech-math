import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../backend';
import { hashPin, isValidPin, PinFormatError, verifyPin } from '../pin';
import { saveTeacherPin, verifyTeacherPin } from '../settings';
import type { JsonObject } from '../types';

describe('PIN 형식', () => {
  it('숫자 4~6자리만 받는다', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('형식이 틀리면 PinFormatError', async () => {
    await expect(hashPin('12')).rejects.toBeInstanceOf(PinFormatError);
    await expect(hashPin('abcd')).rejects.toBeInstanceOf(PinFormatError);
  });
});

describe('PIN 해시', () => {
  it('salt를 붙인 SHA-256 해시만 만든다', async () => {
    const record = await hashPin('1234', 'fixed-salt');

    expect(record.algorithm).toBe('SHA-256');
    expect(record.salt).toBe('fixed-salt');
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.values(record)).not.toContain('1234');
  });

  it('같은 PIN도 salt가 다르면 다른 해시가 된다', async () => {
    const first = await hashPin('1234', 'salt-a');
    const second = await hashPin('1234', 'salt-b');

    expect(first.hash).not.toBe(second.hash);
  });

  it('맞는 PIN만 통과시킨다', async () => {
    const record = await hashPin('4821', 'salt');

    expect(await verifyPin('4821', record)).toBe(true);
    expect(await verifyPin('4822', record)).toBe(false);
    expect(await verifyPin('12', record)).toBe(false);
  });
});

describe('교사 PIN 저장', () => {
  it('원문 대신 해시를 settings에 둔다', async () => {
    const storage = new MemoryStorage();
    await saveTeacherPin(storage, '2468');

    const stored = storage.snapshotSettings() as JsonObject;
    expect(stored['teacherPin']).toMatchObject({ algorithm: 'SHA-256' });
    expect(Object.values(stored['teacherPin'] as JsonObject)).not.toContain('2468');
    expect(await verifyTeacherPin(storage, '2468')).toBe(true);
    expect(await verifyTeacherPin(storage, '0000')).toBe(false);
  });

  it('PIN을 저장하지 않았으면 항상 실패한다', async () => {
    const storage = new MemoryStorage();
    expect(await verifyTeacherPin(storage, '1234')).toBe(false);
  });
});
