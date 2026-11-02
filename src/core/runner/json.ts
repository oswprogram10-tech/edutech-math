/** 기록에 넣을 수 있는 JSON 값인지 확인하고 좁힌다. */
import { assertSerializable } from '../engine-sdk';
import type { JsonValue } from '../engine-sdk';

export function toJsonValue(value: unknown): JsonValue {
  assertSerializable(value);
  return value as JsonValue;
}
