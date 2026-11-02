import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, pushHistory, redoHistory, undoHistory } from '../history';

describe('history', () => {
  it('상태를 쌓고 되돌리고 다시 한다', () => {
    const start = createHistory({ n: 0 });
    const one = pushHistory(start, { n: 1 });
    const two = pushHistory(one, { n: 2 });

    expect(two.present.n).toBe(2);
    expect(canUndo(two)).toBe(true);
    expect(canRedo(two)).toBe(false);

    const undone = undoHistory(two);
    expect(undone.present.n).toBe(1);
    expect(canRedo(undone)).toBe(true);

    const redone = redoHistory(undone);
    expect(redone.present.n).toBe(2);
  });

  it('새 상태를 쌓으면 다시하기 기록을 버린다', () => {
    const history = pushHistory(pushHistory(createHistory(0), 1), 2);
    const undone = undoHistory(history);
    const branched = pushHistory(undone, 3);
    expect(branched.present).toBe(3);
    expect(canRedo(branched)).toBe(false);
  });

  it('같은 상태는 쌓지 않고, 한도까지만 보관한다', () => {
    const state = { n: 0 };
    const same = pushHistory(createHistory(state), state);
    expect(same.past).toHaveLength(0);

    let history = createHistory(0, 2);
    history = pushHistory(history, 1);
    history = pushHistory(history, 2);
    history = pushHistory(history, 3);
    expect(history.past).toEqual([1, 2]);
  });

  it('되돌릴 것이 없으면 그대로 둔다', () => {
    const history = createHistory(0);
    expect(undoHistory(history)).toBe(history);
    expect(redoHistory(history)).toBe(history);
  });
});
