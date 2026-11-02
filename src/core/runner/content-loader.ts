/**
 * `data/content/<unitId>.json`을 지연 로딩한다.
 *
 * 전체 스키마 검사는 `check:specs`의 content-files 테스트(zod)가 맡는다.
 * 실행 중에는 zod를 번들에 넣지 않기 위해 화면이 바로 쓸 수 있을 정도만 확인한다.
 */
import type { UnitContent } from './types';

const CONTENT_DIR = '../../../data/content/';

const contentModules = import.meta.glob<{ default: unknown }>('../../../data/content/*.json');

const UNIT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const GOAL_KINDS = new Set(['equals', 'equivalent-expr', 'predicate', 'all', 'any']);

export class ContentNotFoundError extends Error {
  readonly code = 'CONTENT_NOT_FOUND';

  constructor(readonly unitId: string) {
    super(`콘텐츠를 찾을 수 없습니다: ${unitId}`);
    this.name = 'ContentNotFoundError';
  }
}

export class ContentFormatError extends Error {
  readonly code = 'CONTENT_FORMAT';

  constructor(message: string) {
    super(`콘텐츠 형식이 올바르지 않습니다: ${message}`);
    this.name = 'ContentFormatError';
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function fail(message: string): never {
  throw new ContentFormatError(message);
}

function checkTask(task: unknown, path: string): void {
  if (!isRecord(task)) fail(`${path}: 과제가 객체가 아닙니다.`);
  for (const key of ['id', 'prompt', 'engine', 'mode'] as const) {
    if (!isNonEmptyString(task[key])) fail(`${path}.${key}: 문자열이 아닙니다.`);
  }
  if (task['cpa'] !== 'C' && task['cpa'] !== 'P' && task['cpa'] !== 'A') {
    fail(`${path}.cpa: C/P/A가 아닙니다.`);
  }
  if (task['submit'] !== 'auto' && task['submit'] !== 'button') {
    fail(`${path}.submit: auto/button이 아닙니다.`);
  }
  if (!Object.prototype.hasOwnProperty.call(task, 'config')) fail(`${path}.config: 없습니다.`);
  if (!Array.isArray(task['hints'])) fail(`${path}.hints: 배열이 아닙니다.`);
  if (!Array.isArray(task['concepts'])) fail(`${path}.concepts: 배열이 아닙니다.`);
  const goal = task['goal'];
  if (!isRecord(goal) || typeof goal['kind'] !== 'string' || !GOAL_KINDS.has(goal['kind'])) {
    fail(`${path}.goal: 알 수 없는 목표입니다.`);
  }
  if (task['showEngine'] !== undefined && typeof task['showEngine'] !== 'boolean') {
    fail(`${path}.showEngine: 참·거짓이 아닙니다.`);
  }
  if (task['hintVars'] !== undefined) {
    const vars = task['hintVars'];
    if (!isRecord(vars)) fail(`${path}.hintVars: 객체가 아닙니다.`);
    for (const [key, value] of Object.entries(vars)) {
      if (!isNonEmptyString(value)) fail(`${path}.hintVars.${key}: 문자열이 아닙니다.`);
    }
  }
  if (task['diagnose'] !== undefined) {
    const diagnose = task['diagnose'];
    if (!Array.isArray(diagnose) || diagnose.length === 0) {
      fail(`${path}.diagnose: 비어 있거나 배열이 아닙니다.`);
    }
    diagnose.forEach((spec, index) => {
      const specPath = `${path}.diagnose.${index}`;
      if (!isRecord(spec)) fail(`${specPath}: 객체가 아닙니다.`);
      if (!isNonEmptyString(spec['code'])) fail(`${specPath}.code: 문자열이 아닙니다.`);
      if (spec['path'] !== undefined && !isNonEmptyString(spec['path'])) {
        fail(`${specPath}.path: 문자열이 아닙니다.`);
      }
    });
  }
  if (task['response'] !== undefined) checkResponse(task['response'], task['submit'], path);
  if (task['views'] !== undefined && !Array.isArray(task['views'])) {
    fail(`${path}.views: 배열이 아닙니다.`);
  }
  if (Array.isArray(task['views'])) {
    task['views'].forEach((view, index) => {
      if (isRecord(view) && view['slot'] === 'response') {
        fail(`${path}.views.${index}.slot: response는 예약 슬롯입니다.`);
      }
    });
  }
  if (task['links'] !== undefined && !Array.isArray(task['links'])) {
    fail(`${path}.links: 배열이 아닙니다.`);
  }
}

const RESPONSE_KINDS = new Set(['number', 'choice', 'order', 'compare', 'sort']);

function checkResponse(response: unknown, submit: unknown, path: string): void {
  if (!isRecord(response)) fail(`${path}.response: 객체가 아닙니다.`);
  if (submit !== 'button') fail(`${path}.submit: response가 있으면 button이어야 합니다.`);
  const fields = response['fields'];
  if (!Array.isArray(fields) || fields.length === 0) {
    fail(`${path}.response.fields: 비어 있거나 배열이 아닙니다.`);
  }
  const ids = new Set<string>();
  fields.forEach((field, index) => {
    const fieldPath = `${path}.response.fields.${index}`;
    if (!isRecord(field)) fail(`${fieldPath}: 객체가 아닙니다.`);
    if (!isNonEmptyString(field['id'])) fail(`${fieldPath}.id: 문자열이 아닙니다.`);
    if (ids.has(field['id'])) fail(`${fieldPath}.id: 응답 필드 id가 중복됩니다.`);
    ids.add(field['id']);
    if (typeof field['kind'] !== 'string' || !RESPONSE_KINDS.has(field['kind'])) {
      fail(`${fieldPath}.kind: 알 수 없는 응답 종류입니다.`);
    }
  });
}

/**
 * 실행에 필요한 최소 모양만 확인한다.
 * 스키마 전체 검사는 content-schema.ts(zod)가 CI에서 한다.
 */
export function validateLoadedContent(input: unknown, unitId: string): UnitContent {
  if (!isRecord(input)) fail('최상위가 객체가 아닙니다.');
  if (input['unit'] !== unitId) fail(`unit이 ${unitId}가 아닙니다.`);
  if (!isNonEmptyString(input['title'])) fail('title: 문자열이 아닙니다.');

  const activities = input['activities'];
  if (!Array.isArray(activities) || activities.length === 0) {
    fail('activities: 비어 있거나 배열이 아닙니다.');
  }
  for (const [activityIndex, activity] of activities.entries()) {
    const activityPath = `activities.${activityIndex}`;
    if (!isRecord(activity)) fail(`${activityPath}: 객체가 아닙니다.`);
    if (!isNonEmptyString(activity['id'])) fail(`${activityPath}.id: 문자열이 아닙니다.`);
    if (!isNonEmptyString(activity['title'])) fail(`${activityPath}.title: 문자열이 아닙니다.`);
    const tasks = activity['tasks'];
    if (!Array.isArray(tasks) || tasks.length === 0) {
      fail(`${activityPath}.tasks: 비어 있거나 배열이 아닙니다.`);
    }
    for (const [taskIndex, task] of tasks.entries()) {
      checkTask(task, `${activityPath}.tasks.${taskIndex}`);
    }
  }

  return input as unknown as UnitContent;
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
  return validateLoadedContent(module.default, unitId);
}
