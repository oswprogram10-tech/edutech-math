/**
 * 시연 모드 공유 코드(새 형식, T007).
 *
 * `{ v: 1, views, links, actions }`만 담는다. 학생 번호·과제 ID·시각은
 * 절대 넣지 않는다. 응답 슬롯은 엔진 상태가 아니므로 호출한 쪽에서 뺀다.
 *
 * 만들기·읽기는 `src/core/storage`의 `encodeShareCode`/`decodeShareCode`를
 * 그대로 쓴다. 이 파일은 좁히기(수동 검증)와 Action 재생만 맡는다.
 * zod는 쓰지 않는다(실행 중 번들에 넣지 않기 위해).
 */
import { isSerializable } from '../engine-sdk';
import type { CPA, EngineId, JsonValue } from '../engine-sdk';
import {
  decodeShareCode,
  encodeShareCode,
  SHARE_CODE_MAX_LENGTH,
  type ShareCodeResult,
} from '../storage';
import { applyControl, applyRecordedActions, createSlotHistories, statesOf } from './links';
import type { SlotStates, SlotView } from './links';
import type { SlotAction, SlotControl } from './types';
import { toJsonValue } from './json';
import { runnerStrings } from './strings.ko';

/** 공유 코드에 담는 엔진 화면 하나. TaskViewSpec과 같은 모양이다. */
export interface ShareView {
  readonly slot: string;
  readonly engine: EngineId;
  readonly mode: string;
  readonly cpa: CPA;
  readonly config: JsonValue;
}

export interface ShareLink {
  readonly from: string;
  readonly event: string;
  readonly to: string;
}

/** 실행기 기록과 같은 모양. group이 같은 Action들은 되돌리기 한 단위다. */
export type ShareAction =
  | {
      readonly slot: string;
      readonly action: JsonValue;
      readonly group?: string;
    }
  | { readonly control: SlotControl };

export interface SharePayload {
  readonly v: 1;
  readonly views: readonly ShareView[];
  readonly links: readonly ShareLink[];
  readonly actions: readonly ShareAction[];
}

export type SharePayloadResult =
  | { readonly ok: true; readonly payload: SharePayload }
  | { readonly ok: false; readonly error: 'INVALID'; readonly message: string };

const ENGINE_ID_PATTERN = /^E\d{2}$/;
const PAYLOAD_KEYS = ['v', 'views', 'links', 'actions'] as const;
const VIEW_KEYS = ['slot', 'engine', 'mode', 'cpa', 'config'] as const;
const LINK_KEYS = ['from', 'event', 'to'] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isShareView(value: unknown): value is ShareView {
  return (
    isRecord(value) &&
    onlyKeys(value, VIEW_KEYS) &&
    nonEmptyString(value['slot']) &&
    typeof value['engine'] === 'string' &&
    ENGINE_ID_PATTERN.test(value['engine']) &&
    nonEmptyString(value['mode']) &&
    (value['cpa'] === 'C' || value['cpa'] === 'P' || value['cpa'] === 'A') &&
    Object.prototype.hasOwnProperty.call(value, 'config') &&
    isSerializable(value['config'])
  );
}

function isShareLink(value: unknown): value is ShareLink {
  return (
    isRecord(value) &&
    onlyKeys(value, LINK_KEYS) &&
    nonEmptyString(value['from']) &&
    nonEmptyString(value['event']) &&
    nonEmptyString(value['to'])
  );
}

function isShareAction(value: unknown): value is ShareAction {
  if (!isRecord(value)) return false;

  if (Object.prototype.hasOwnProperty.call(value, 'control')) {
    return (
      onlyKeys(value, ['control']) && (value['control'] === 'undo' || value['control'] === 'redo')
    );
  }

  return (
    onlyKeys(value, ['slot', 'action', 'group']) &&
    nonEmptyString(value['slot']) &&
    Object.prototype.hasOwnProperty.call(value, 'action') &&
    isSerializable(value['action']) &&
    (value['group'] === undefined || nonEmptyString(value['group']))
  );
}

function invalid(message: string = runnerStrings.shareInvalid): SharePayloadResult {
  return { ok: false, error: 'INVALID', message };
}

/**
 * 알 수 없는 값을 공유 페이로드로 좁힌다.
 * 모르는 키가 하나라도 있으면 거부한다(학생 번호·과제 ID가 섞이는 것을 막는다).
 */
export function parseSharePayload(value: unknown): SharePayloadResult {
  if (!isRecord(value)) return invalid();
  if (!onlyKeys(value, PAYLOAD_KEYS)) return invalid();
  if (value['v'] !== 1) return invalid();

  const views = value['views'];
  if (!Array.isArray(views) || views.length === 0 || !views.every(isShareView)) {
    return invalid();
  }

  const slots = new Set<string>();
  for (const view of views) {
    if (slots.has(view.slot)) return invalid();
    slots.add(view.slot);
  }

  const links = value['links'];
  if (!Array.isArray(links) || !links.every(isShareLink)) return invalid();
  for (const link of links) {
    if (!slots.has(link.from) || !slots.has(link.to)) return invalid();
  }

  const actions = value['actions'];
  if (!Array.isArray(actions) || !actions.every(isShareAction)) return invalid();
  for (const action of actions) {
    if ('slot' in action && !slots.has(action.slot)) return invalid();
  }

  return {
    ok: true,
    payload: {
      v: 1,
      views: views as ShareView[],
      links: links as ShareLink[],
      actions: actions as ShareAction[],
    },
  };
}

export function createSharePayload(
  views: readonly ShareView[],
  links: readonly ShareLink[],
  actions: readonly ShareAction[],
): SharePayload {
  return { v: 1, views, links, actions };
}

/** 공유 코드 문자열로 만든다. 4,000자를 넘으면 storage가 TOO_LONG을 돌려준다. */
export function encodeSharePayload(payload: SharePayload): ShareCodeResult {
  return encodeShareCode(toJsonValue(payload));
}

export function decodeSharePayload(code: string): SharePayloadResult {
  const decoded = decodeShareCode(code);
  if (!decoded.ok) return invalid(decoded.message);
  return parseSharePayload(decoded.state);
}

export function sharePayloadLength(code: string): number {
  return code.length;
}

export { SHARE_CODE_MAX_LENGTH };

function toRecorded(entry: ShareAction): SlotAction | null {
  if ('control' in entry) return null;
  return { slot: entry.slot, action: entry.action };
}

/**
 * 앞에서부터 `count`개 Action을 재생한 상태를 만든다.
 *
 * 실행기 기록과 같이 `group`이 같은 Action들은 History 한 칸으로 묶는다.
 * 그래야 중간에 있는 `{ control: 'undo' }`가 사용자 Action 하나를 되돌린다.
 * 연결(links)은 기록할 때 이미 각 슬롯 Action으로 남았으므로 다시 발동하지 않는다.
 */
export function replayShare(
  views: readonly SlotView[],
  actions: readonly ShareAction[],
  count = actions.length,
): SlotStates {
  const limit = Math.max(0, Math.min(count, actions.length));
  let histories = createSlotHistories(views);

  let pending: SlotAction[] = [];
  let pendingGroup: string | null = null;

  const flush = () => {
    if (pending.length === 0) return;
    histories = applyRecordedActions(views, histories, pending);
    pending = [];
    pendingGroup = null;
  };

  for (let index = 0; index < limit; index += 1) {
    const entry = actions[index];
    if (!entry) continue;

    if ('control' in entry) {
      flush();
      histories = applyControl(histories, entry.control);
      continue;
    }

    const key = entry.group ?? `__single-${index}`;
    if (pending.length > 0 && pendingGroup !== key) flush();
    pendingGroup = key;
    const recorded = toRecorded(entry);
    if (recorded) pending.push(recorded);
  }
  flush();

  return statesOf(histories);
}

/**
 * 되감은 지점 뒤의 기록을 버리고 새 Action 하나를 붙인다.
 * 되감은 상태에서 조작하면 그 뒤 기록을 버리는 규칙(결정 5)을 순수 함수로 둔다.
 */
export function appendShareAction(
  actions: readonly ShareAction[],
  cursor: number,
  entry: ShareAction,
): readonly ShareAction[] {
  const at = Math.max(0, Math.min(cursor, actions.length));
  return [...actions.slice(0, at), entry];
}

/**
 * 공유 코드에 엔진 슬롯 Action만 남긴다.
 *
 * 실행기의 되돌리기는 슬롯을 가리지 않고 '사용자 조작 한 묶음'을 하나씩 되돌린다.
 * 그래서 응답 슬롯 Action을 빼기만 하면, 응답 입력을 되돌린 control이 남아
 * 교사 화면에서 엔진 조작 하나를 되돌리는 것으로 재생된다.
 *
 * 여기서는 전체 기록을 실행기와 같은 규칙(묶음 = History 한 칸, undo/redo =
 * 마지막 칸 이동)으로 따라가며, 엔진 Action이 하나라도 든 묶음을 가리키는
 * control만 남긴다. 응답만 든 묶음을 가리키는 control은 함께 버린다.
 */
export function filterShareActions(
  actions: readonly ShareAction[],
  engineSlots: ReadonlySet<string>,
): readonly ShareAction[] {
  const kept: ShareAction[] = [];
  // past/future에는 묶음마다 '공유 코드에 남는 묶음인가'만 쌓는다.
  const past: boolean[] = [];
  const future: boolean[] = [];

  let index = 0;
  while (index < actions.length) {
    const entry = actions[index];
    if (!entry) {
      index += 1;
      continue;
    }

    if ('control' in entry) {
      if (entry.control === 'undo') {
        const target = past.pop();
        if (target === undefined) {
          index += 1;
          continue;
        }
        future.push(target);
        if (target) kept.push(entry);
      } else {
        const target = future.pop();
        if (target === undefined) {
          index += 1;
          continue;
        }
        past.push(target);
        if (target) kept.push(entry);
      }
      index += 1;
      continue;
    }

    // 같은 group이 이어지는 구간이 되돌리기 한 단위다(재생과 같은 규칙).
    const groupKey = entry.group ?? `__single-${index}`;
    const engineActions: ShareAction[] = [];
    let cursor = index;
    while (cursor < actions.length) {
      const item = actions[cursor];
      if (!item || 'control' in item) break;
      if ((item.group ?? `__single-${cursor}`) !== groupKey) break;
      if (engineSlots.has(item.slot)) engineActions.push(item);
      cursor += 1;
    }

    const groupKept = engineActions.length > 0;
    past.push(groupKept);
    // 새 조작은 다시하기 기록을 버린다(실행기의 History와 같다).
    future.length = 0;
    if (groupKept) kept.push(...engineActions);
    index = cursor;
  }

  return kept;
}
