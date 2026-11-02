/**
 * 엔진 상태가 JSON으로 안전하게 오가는지 검사한다.
 * 되감기·미러링·저장은 모두 `JSON.stringify(state)`가 가능하다는 전제 위에 있다.
 */

export class SerializationError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(path ? `${message} (${path})` : message);
    this.name = 'SerializationError';
  }
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'function';
  if (typeof value === 'bigint') return 'BigInt';
  if (typeof value === 'symbol') return 'Symbol';
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return Object.prototype.toString.call(value);
}

/** JSON으로 바꿨다가 되돌렸을 때 값이 달라지는 첫 지점을 찾는다. */
function diff(a: unknown, b: unknown, path: string): SerializationError | null {
  if (Object.is(a, b)) return null;

  if (typeof a === 'number' && typeof b === 'number') {
    return new SerializationError('JSON으로 바꾸면 수가 달라집니다.', path);
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return new SerializationError('JSON으로 바꾸면 값이 달라집니다.', path);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return new SerializationError('배열이 아닌 값이 섞였습니다.', path);
    }
    if (a.length !== b.length) {
      return new SerializationError('배열 길이가 달라집니다.', path);
    }
    for (let i = 0; i < a.length; i += 1) {
      const found = diff(a[i], b[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }

  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.prototype && proto !== null) {
    return new SerializationError(
      `${describe(a)}는 JSON 객체가 아닙니다. Map·Set·Date·클래스 인스턴스는 쓸 수 없습니다.`,
      path,
    );
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) {
    return new SerializationError(
      'JSON으로 바꾸면 사라지는 속성이 있습니다(undefined·함수·Symbol 등).',
      path,
    );
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bRecord, key)) {
      return new SerializationError(
        'JSON으로 바꾸면 사라지는 속성이 있습니다(undefined·함수·Symbol 등).',
        joinPath(path, key),
      );
    }
    const found = diff(aRecord[key], bRecord[key], joinPath(path, key));
    if (found) return found;
  }
  return null;
}

/**
 * `JSON.parse(JSON.stringify(value))`와 깊은 비교해 다르면 `SerializationError`를 던진다.
 * 함수·BigInt·undefined·Map·Set·Date·순환 참조·NaN/Infinity를 잡는다.
 */
export function assertSerializable(value: unknown): void {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SerializationError(`JSON으로 바꿀 수 없습니다: ${reason}`, '');
  }
  if (text === undefined) {
    throw new SerializationError(`${describe(value)}는 JSON 값이 아닙니다.`, '');
  }

  const roundTrip: unknown = JSON.parse(text);
  const found = diff(value, roundTrip, '');
  if (found) throw found;
}

/** 예외 없이 검사만 하고 싶을 때. */
export function isSerializable(value: unknown): boolean {
  try {
    assertSerializable(value);
    return true;
  } catch {
    return false;
  }
}
