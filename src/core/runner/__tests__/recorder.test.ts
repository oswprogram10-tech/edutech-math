import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../storage';
import { TaskRecorder } from '../recorder';

const base = {
  learner: '0',
  unit: 'demo',
  task: 'demo.A1.T1',
  engine: 'E00',
} as const;

describe('TaskRecorder', () => {
  it('시작·조작·제출·통과·실패를 LearningEvent로 남긴다', async () => {
    const storage = new MemoryStorage();
    const recorder = new TaskRecorder({ ...base, sink: storage });

    await recorder.started();
    await recorder.acted('left', { type: 'add', x: 200, y: 300 });
    await recorder.control('left', 'undo');
    await recorder.submitted();
    await recorder.failed();
    await recorder.passed();

    const events = await storage.listEvents();
    expect(events.map((event) => event.verb)).toEqual([
      'started',
      'acted',
      'acted',
      'submitted',
      'failed',
      'passed',
    ]);
    expect(events[1]?.data).toEqual({ slot: 'left', action: { type: 'add', x: 200, y: 300 } });
    expect(events[2]?.data).toEqual({ slot: 'left', control: 'undo' });
    expect(events[0]).toMatchObject({
      learner: '0',
      unit: 'demo',
      task: 'demo.A1.T1',
      engine: 'E00',
    });
  });

  it('저장 실패는 던지지 않고 onError·경고로만 알린다', async () => {
    const onError = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const recorder = new TaskRecorder({
      ...base,
      sink: { putEvent: () => Promise.reject(new Error('저장 공간 없음')) },
      onError,
    });

    await expect(recorder.started()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('저장소가 없으면 조용히 건너뛴다', async () => {
    const recorder = new TaskRecorder(base);
    await expect(recorder.started()).resolves.toBeUndefined();
  });
});
