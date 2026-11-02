import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T004 저장소 E2E.
 * 앱 화면이 아직 없으므로 dev 서버의 저장소 모듈을 직접 불러
 * 저장 → 새로고침 → 유지되는지 확인한다. iPad(WebKit)·Chromebook·전자칠판에서 모두 돈다.
 *
 * src 모듈을 타입으로 import하면 tsconfig.node(jsx 없음)가 앱 코드를 검사하므로
 * 브라우저에서 쓰는 최소 모양만 여기에 적는다.
 */
interface BrowserLearner {
  number: string;
  interests: string[];
  updatedAt: number;
}

interface BrowserEvent {
  id: string;
  t: number;
  learner: string;
  unit: string;
  task: string;
  engine: string;
  verb: string;
  data?: unknown;
}

interface BrowserStorage {
  putLearner(learner: BrowserLearner): Promise<void>;
  listLearners(): Promise<BrowserLearner[]>;
  listEvents(): Promise<BrowserEvent[]>;
  setSetting(key: string, value: unknown): Promise<void>;
  getSetting(key: string): Promise<unknown>;
  getDeviceId(): Promise<string>;
  status(): Promise<{ backend: string; persisted: boolean }>;
  close(): Promise<void>;
}

interface StorageModule {
  openStorage(options?: { requestPersist?: boolean }): Promise<BrowserStorage>;
  logEvent(
    storage: BrowserStorage,
    draft: {
      learner: string;
      unit: string;
      task: string;
      engine: string;
      verb: string;
      data?: unknown;
    },
    options?: { id?: string; now?: number },
  ): Promise<BrowserEvent>;
}

async function canOpenStorage(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const modulePath = '/src/core/storage/index.ts';
    const storageModule = await import(/* @vite-ignore */ modulePath);
    return typeof storageModule.openStorage === 'function';
  });
}

test.describe('기기 저장소', () => {
  test('저장한 기록이 새로고침 뒤에도 유지된다', async ({ page }) => {
    await page.goto('/');
    expect(await canOpenStorage(page)).toBe(true);

    const before = await page.evaluate(async () => {
      const modulePath = '/src/core/storage/index.ts';
      const storageModule = (await import(/* @vite-ignore */ modulePath)) as StorageModule;

      const storage = await storageModule.openStorage({ requestPersist: false });
      await storage.putLearner({ number: '12', interests: ['space', 'game'], updatedAt: 111 });
      await storageModule.logEvent(
        storage,
        {
          learner: '12',
          unit: 'g5s1u4',
          task: 'g5s1u4.A1',
          engine: 'E05',
          verb: 'acted',
          // E00 Action과 같은 논리 좌표. 화면 좌표가 아니라 저장해도 된다.
          data: { type: 'move', id: 'c1', x: 100, y: 200 },
        },
        { id: 'e2e-storage-1', now: 222 },
      );
      await storage.setSetting('e2e-marker', { ok: true });
      const status = await storage.status();
      const deviceId = await storage.getDeviceId();
      await storage.close();
      return { status, deviceId };
    });

    expect(before.status.backend).toBe('indexeddb');
    expect(before.deviceId).toMatch(/^[0-9a-f-]{36}$/);

    await page.reload();
    expect(await canOpenStorage(page)).toBe(true);

    const after = await page.evaluate(async () => {
      const modulePath = '/src/core/storage/index.ts';
      const storageModule = (await import(/* @vite-ignore */ modulePath)) as StorageModule;

      const storage = await storageModule.openStorage({ requestPersist: false });
      const result = {
        learners: await storage.listLearners(),
        events: await storage.listEvents(),
        marker: await storage.getSetting('e2e-marker'),
        deviceId: await storage.getDeviceId(),
        status: await storage.status(),
      };
      await storage.close();
      return result;
    });

    expect(after.status.backend).toBe('indexeddb');
    expect(after.learners).toEqual([
      { number: '12', interests: ['space', 'game'], updatedAt: 111 },
    ]);
    expect(after.events).toHaveLength(1);
    expect(after.events[0]).toMatchObject({
      id: 'e2e-storage-1',
      t: 222,
      learner: '12',
      unit: 'g5s1u4',
      task: 'g5s1u4.A1',
      engine: 'E05',
      verb: 'acted',
      data: { type: 'move', id: 'c1', x: 100, y: 200 },
    });
    expect(after.marker).toEqual({ ok: true });
    expect(after.deviceId).toBe(before.deviceId);
  });
});
