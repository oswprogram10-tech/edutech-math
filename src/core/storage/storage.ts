/**
 * 저장소 열기.
 *
 * IndexedDB를 쓸 수 없으면(사생활 보호 모드, 저장 공간 차단 등) 같은 API의
 * 메모리 저장소로 바꾼다. 호출한 쪽은 `backend`와 `fallbackReason`으로 알 수 있다.
 */
import { DexieStorage, MemoryStorage } from './backend';
import type { DexieOptions } from './backend';
import type { Storage, StorageStatus } from './types';

export interface OpenStorageOptions extends DexieOptions {
  /** 테스트에서 DB 이름을 격리할 때 쓴다. */
  readonly name?: string;
  /** 테스트에서 IndexedDB를 건너뛸 때 쓴다. */
  readonly forceMemory?: boolean;
  /** 기본 true. 테스트에서 브라우저 권한 요청을 피하려면 false. */
  readonly requestPersist?: boolean;
  readonly onFallback?: (reason: string) => void;
}

function hasIndexedDB(options: OpenStorageOptions): boolean {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  return typeof factory?.open === 'function';
}

async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage) return false;
  try {
    if (typeof navigator.storage.persisted === 'function') {
      if (await navigator.storage.persisted()) return true;
    }
    if (typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
    return false;
  } catch {
    // 권한이 없거나 API가 막힌 경우. 저장은 계속 가능하지만 영구 보관은 보장되지 않는다.
    return false;
  }
}

export async function openStorage(options: OpenStorageOptions = {}): Promise<Storage> {
  if (options.forceMemory) {
    // fallbackReason은 화면 문구가 아니라 진단용 코드다.
    return new MemoryStorage('forced-memory');
  }

  if (!hasIndexedDB(options)) {
    return new MemoryStorage('indexeddb-unavailable');
  }

  try {
    // Dexie는 options에 indexedDB가 있으면 그대로 쓰므로 undefined를 넘기면 안 된다.
    const storage = new DexieStorage(options.name, {
      ...(options.indexedDB ? { indexedDB: options.indexedDB } : {}),
      ...(options.IDBKeyRange ? { IDBKeyRange: options.IDBKeyRange } : {}),
    });
    await storage.open();
    const persisted = options.requestPersist === false ? false : await requestPersistentStorage();
    storage.setPersisted(persisted);
    return storage;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    options.onFallback?.(reason);
    return new MemoryStorage(reason);
  }
}

let defaultStorage: Promise<Storage> | undefined;

/** 앱 전체가 공유하는 기본 저장소. 처음 호출할 때 연다. */
export function getStorage(): Promise<Storage> {
  defaultStorage ??= openStorage();
  return defaultStorage;
}

/** `{ backend: 'indexeddb'|'memory', persisted }`. 화면 안내는 T006에서 붙인다. */
export async function getStorageStatus(): Promise<StorageStatus> {
  return (await getStorage()).status();
}
