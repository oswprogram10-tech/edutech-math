import { describe, expect, it } from 'vitest';
import type { LoadedEngine } from '../../engine-sdk';
import demoDefinition from '../../../engines/E00-demo';
import { createSlotHistories } from '../links';
import type { SlotView } from '../links';
import {
  appendShareAction,
  createSharePayload,
  decodeSharePayload,
  encodeSharePayload,
  parseSharePayload,
  replayShare,
} from '../share';
import type { ShareAction, SharePayload, ShareView } from '../share';

const config = { gridSize: 100 } as const;
const demoLoaded = demoDefinition as unknown as LoadedEngine;
const views: ShareView[] = [{ slot: 'main', engine: 'E00', mode: 'free', cpa: 'C', config }];
const slotViews: SlotView[] = [{ slot: 'main', definition: demoLoaded, config }];

function addAction(x: number, group: string): ShareAction {
  return { slot: 'main', action: { type: 'add', x, y: 200 }, group };
}

function counterCount(states: Readonly<Record<string, unknown>>): number {
  const main = states['main'] as { counters: readonly unknown[] } | undefined;
  return main?.counters.length ?? 0;
}

function payloadWith(actions: readonly ShareAction[]): SharePayload {
  return createSharePayload(views, [], actions);
}

describe('공유 페이로드 검증', () => {
  it('만들기→읽기 왕복에서 같은 내용이 나온다', () => {
    const payload = payloadWith([addAction(100, 'g1'), { control: 'undo' }]);
    const encoded = encodeSharePayload(payload);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeSharePayload(encoded.code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload).toEqual(payload);
  });

  it('학생 번호·과제 ID·시각 키를 넣지 않는다', () => {
    const payload = payloadWith([addAction(100, 'g1')]);
    expect(Object.keys(payload).sort()).toEqual(['actions', 'links', 'v', 'views']);
    const json = JSON.stringify(payload);
    expect(json).not.toContain('learner');
    expect(json).not.toContain('student');
    expect(json).not.toContain('task');
    expect(json).not.toContain('time');
    expect(json).not.toContain('demo.A1');
  });

  it('모르는 키·잘못된 모양은 거부한다', () => {
    const good = payloadWith([addAction(100, 'g1')]);
    const withLearner = { ...good, learner: '3' };
    expect(parseSharePayload(withLearner).ok).toBe(false);

    expect(parseSharePayload({ ...good, v: 2 }).ok).toBe(false);
    expect(parseSharePayload({ ...good, views: [] }).ok).toBe(false);
    expect(
      parseSharePayload({
        ...good,
        views: [{ slot: 'main', engine: 'E00', mode: 'free', cpa: 'X', config: {} }],
      }).ok,
    ).toBe(false);
    expect(
      parseSharePayload({
        ...good,
        actions: [{ slot: 'ghost', action: { type: 'add' } }],
      }).ok,
    ).toBe(false);
    expect(parseSharePayload({ ...good, actions: [{ action: { type: 'add' } }] }).ok).toBe(false);
    expect(parseSharePayload(null).ok).toBe(false);
  });

  it('4,000자를 넘는 코드는 TOO_LONG을 돌려준다', () => {
    // 무작위에 가까운 문자열은 압축이 잘 되지 않아 짧은 코드로 담을 수 없다.
    let seed = 123456789;
    const blob = Array.from({ length: 8000 }, () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return String.fromCharCode(33 + (seed % 90));
    }).join('');

    const payload = createSharePayload(
      [{ slot: 'main', engine: 'E00', mode: 'free', cpa: 'C', config: { blob } }],
      [],
      [],
    );
    const encoded = encodeSharePayload(payload);
    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.error).toBe('TOO_LONG');
    expect(encoded.length).toBeGreaterThan(4000);
  });
});

describe('시연 되감기 재생', () => {
  const actions: ShareAction[] = [addAction(100, 'g1'), addAction(200, 'g2'), addAction(300, 'g3')];

  it('k=0, 중간, 끝에서 Action 수만큼 상태가 나온다', () => {
    expect(counterCount(replayShare(slotViews, actions, 0))).toBe(0);
    expect(counterCount(replayShare(slotViews, actions, 1))).toBe(1);
    expect(counterCount(replayShare(slotViews, actions, 2))).toBe(2);
    expect(counterCount(replayShare(slotViews, actions, 3))).toBe(3);
    expect(counterCount(replayShare(slotViews, actions))).toBe(3);
    expect(replayShare(slotViews, actions, 0)).toEqual(createSlotHistories(slotViews).present);
  });

  it('되돌리기 기록도 재생한다', () => {
    const undid: ShareAction[] = [...actions, { control: 'undo' }];
    expect(counterCount(replayShare(slotViews, undid))).toBe(2);
    const redid: ShareAction[] = [...undid, { control: 'redo' }];
    expect(counterCount(replayShare(slotViews, redid))).toBe(3);
  });

  it('같은 group의 Action은 되돌리기 한 단위로 묶인다', () => {
    const grouped: ShareAction[] = [
      addAction(100, 'g1'),
      addAction(200, 'g1'),
      { control: 'undo' },
    ];
    expect(counterCount(replayShare(slotViews, grouped))).toBe(0);
  });

  it('되감은 뒤 조작하면 뒤 기록을 버리고 이어 간다', () => {
    const next = appendShareAction(actions, 1, addAction(900, 'g9'));
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(actions[0]);
    expect(next[1]).toEqual(addAction(900, 'g9'));
    expect(counterCount(replayShare(slotViews, next))).toBe(2);
  });
});
