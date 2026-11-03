/**
 * 앱 화면이 함께 쓰는 단원 메타데이터와 '켠 단원' 해석.
 *
 * `data/units.json`은 별자리 배치(학년·학기·순서·영역)에만 쓰고,
 * 학생 화면에는 학년·학기를 표시하지 않는다.
 * `src/core/`는 읽기만 하고, 설정 저장은 storage API를 그대로 쓴다.
 */
import type { JsonValue } from '../core/engine-sdk';
import { contentUnitIds } from '../core/runner';
import type { Storage } from '../core/storage';
import { SETTINGS_KEYS } from '../core/storage';

export type UnitDomain = 'number' | 'change' | 'geometry' | 'data';

export interface UnitSummary {
  readonly id: string;
  readonly grade: number;
  readonly semester: number;
  readonly order: number;
  readonly title: string;
  readonly domain: UnitDomain;
}

interface JsonModule {
  readonly default: unknown;
}

const unitModules = import.meta.glob<JsonModule>('../../data/units.json', { eager: true });

const DOMAINS: readonly UnitDomain[] = ['number', 'change', 'geometry', 'data'];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asDomain(value: unknown): UnitDomain {
  return DOMAINS.includes(value as UnitDomain) ? (value as UnitDomain) : 'number';
}

function asUnitSummaries(value: unknown): UnitSummary[] {
  if (!isRecord(value) || !Array.isArray(value['units'])) {
    throw new Error('units.json에 units 배열이 없습니다.');
  }

  const summaries: UnitSummary[] = [];
  for (const raw of value['units']) {
    if (!isRecord(raw)) continue;
    const id = raw['id'];
    const title = raw['title'];
    if (typeof id !== 'string' || id.length === 0) continue;
    if (typeof title !== 'string' || title.length === 0) continue;
    summaries.push({
      id,
      grade: asFiniteNumber(raw['grade'], 1),
      semester: asFiniteNumber(raw['semester'], 1),
      order: asFiniteNumber(raw['order'], 0),
      title,
      domain: asDomain(raw['domain']),
    });
  }
  return summaries;
}

let unitsPromise: Promise<readonly UnitSummary[]> | undefined;

/** 단원 메타데이터를 한 번만 읽는다. 실패하면 다음 호출에서 다시 시도한다. */
export function loadUnitSummaries(): Promise<readonly UnitSummary[]> {
  unitsPromise ??= (async () => {
    const module = Object.values(unitModules)[0];
    if (!module) throw new Error('units.json을 찾을 수 없습니다.');
    return asUnitSummaries(module.default);
  })().catch((error: unknown) => {
    unitsPromise = undefined;
    throw error;
  });
  return unitsPromise;
}

/**
 * 별자리에 켤 수 있는 단원. `demo`는 개념이 없는 예제라 뺀다.
 * (교사 화면의 단원 목록과 '처음 켜짐' 기본값이 같은 목록을 쓴다.)
 */
export function constellationUnitIds(): string[] {
  return contentUnitIds().filter((id) => id !== 'demo');
}

/**
 * 저장된 `enabledUnits`를 해석한다.
 *
 * - 설정이 없으면(`undefined`) 콘텐츠가 있는 단원을 모두 켠 것으로 본다.
 * - 빈 배열(`[]`)은 교사가 '모두 끄기'를 누른 상태이므로 아무 단원도 켜지 않는다.
 *   `getEnabledUnits`는 둘을 모두 `[]`로 돌려주므로 원시 설정 값을 직접 읽는다.
 */
export function resolveEnabledUnitIds(
  raw: JsonValue | undefined,
  defaultUnitIds: readonly string[],
): Set<string> {
  if (raw === undefined || raw === null) return new Set(defaultUnitIds);
  if (!Array.isArray(raw)) return new Set(defaultUnitIds);
  return new Set(raw.filter((item): item is string => typeof item === 'string'));
}

/** 원시 `enabledUnits` 설정. 없음과 빈 배열을 구분하려고 storage를 직접 읽는다. */
export function readEnabledUnitSetting(storage: Storage): Promise<JsonValue | undefined> {
  return storage.getSetting<JsonValue>(SETTINGS_KEYS.enabledUnits);
}
