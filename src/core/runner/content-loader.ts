/** `data/content/<unitId>.json`을 지연 로딩하고 스키마로 검사한다. */
import { parseUnitContent } from './content-schema';
import type { UnitContent } from './types';

const CONTENT_DIR = '../../../data/content/';

const contentModules = import.meta.glob<{ default: unknown }>('../../../data/content/*.json');

const UNIT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class ContentNotFoundError extends Error {
  readonly code = 'CONTENT_NOT_FOUND';

  constructor(readonly unitId: string) {
    super(`콘텐츠를 찾을 수 없습니다: ${unitId}`);
    this.name = 'ContentNotFoundError';
  }
}

export function contentUnitIds(): string[] {
  return Object.keys(contentModules)
    .map((path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, ''))
    .sort();
}

export async function loadUnitContent(unitId: string): Promise<UnitContent> {
  if (!UNIT_ID_PATTERN.test(unitId)) throw new ContentNotFoundError(unitId);
  const load = contentModules[`${CONTENT_DIR}${unitId}.json`];
  if (!load) throw new ContentNotFoundError(unitId);
  const module = await load();
  return parseUnitContent(module.default);
}
