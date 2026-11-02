/** settings 테이블에 저장하는 값과 그 타입 있는 접근자. */
import type { JsonValue, UnitId } from '../engine-sdk';
import { randomId } from './ids';
import { hashPin, verifyPin } from './pin';
import type { JsonObject, SettingsStore, TeacherPinRecord, UnitDisplayNames } from './types';
import { SETTINGS_KEYS } from './types';

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTeacherPinRecord(value: JsonValue | undefined): value is TeacherPinRecord {
  if (!isJsonObject(value)) return false;
  return (
    value['algorithm'] === 'SHA-256' &&
    typeof value['salt'] === 'string' &&
    typeof value['hash'] === 'string'
  );
}

function isStringRecord(value: JsonValue | undefined): value is UnitDisplayNames {
  if (!isJsonObject(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}

/** 처음 실행할 때 기기 UUID를 만들어 settings에 저장한다. */
export async function getOrCreateDeviceId(store: SettingsStore): Promise<string> {
  const existing = await store.getSetting<string>(SETTINGS_KEYS.deviceId);
  if (typeof existing === 'string' && existing.length > 0) return existing;

  const deviceId = randomId();
  await store.setSetting(SETTINGS_KEYS.deviceId, deviceId);
  return deviceId;
}

export async function getEnabledUnits(store: SettingsStore): Promise<UnitId[]> {
  const value = await store.getSetting<JsonValue>(SETTINGS_KEYS.enabledUnits);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export async function setEnabledUnits(
  store: SettingsStore,
  units: readonly UnitId[],
): Promise<void> {
  await store.setSetting(SETTINGS_KEYS.enabledUnits, [...new Set(units)]);
}

export async function getUnitDisplayNames(store: SettingsStore): Promise<UnitDisplayNames> {
  const value = await store.getSetting<JsonValue>(SETTINGS_KEYS.unitDisplayNames);
  return isStringRecord(value) ? { ...value } : {};
}

export async function setUnitDisplayNames(
  store: SettingsStore,
  names: UnitDisplayNames,
): Promise<void> {
  await store.setSetting(SETTINGS_KEYS.unitDisplayNames, { ...names });
}

/** PIN 원문 대신 salt + SHA-256 해시만 저장한다. */
export async function saveTeacherPin(store: SettingsStore, pin: string): Promise<TeacherPinRecord> {
  const record = await hashPin(pin);
  await store.setSetting(SETTINGS_KEYS.teacherPin, record as JsonValue);
  return record;
}

export async function verifyTeacherPin(store: SettingsStore, pin: string): Promise<boolean> {
  const stored = await store.getSetting<JsonValue>(SETTINGS_KEYS.teacherPin);
  if (!isTeacherPinRecord(stored)) return false;
  return verifyPin(pin, stored);
}
