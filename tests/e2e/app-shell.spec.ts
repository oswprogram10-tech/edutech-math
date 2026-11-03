import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T006 앱 셸 E2E.
 * 번호 고르기 → 관심사 건너뛰기 → 활동 → 새로고침/학생 전환까지 확인한다.
 */

interface BrowserEvent {
  learner: string;
  task: string;
  verb: string;
}

interface BrowserStorage {
  listEvents(): Promise<BrowserEvent[]>;
  close(): Promise<void>;
}

interface StorageModule {
  openStorage(options?: { requestPersist?: boolean }): Promise<BrowserStorage>;
}

async function readEventLearners(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const modulePath = '/src/core/storage/index.ts';
    const storageModule = (await import(/* @vite-ignore */ modulePath)) as StorageModule;
    const storage = await storageModule.openStorage({ requestPersist: false });
    const events = await storage.listEvents();
    await storage.close();
    return events.map((event) => event.learner);
  });
}

test('번호를 고르고 활동을 한 뒤 새로고침해도 같은 학생이며, 다른 학생으로 바꿀 수 있다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MathExplorer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '몇 번이에요?' })).toBeVisible();

  // 1~30 타일 중 내 번호를 고른다.
  await expect(page.getByRole('button', { name: '1번', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '30번', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '7번', exact: true }).click();

  // 관심사는 건너뛴다.
  await expect(page.getByRole('heading', { name: '관심사를 골라 보세요.' })).toBeVisible();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByRole('heading', { name: '나의 수학 별자리' })).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toBeVisible();

  // 앱 셸 흐름은 데모 활동으로 이어진다(별 → 활동 목록은 star-map.spec에서 확인한다).
  await page.goto('/#/activity/demo.A1');
  await expect(page.getByRole('heading', { name: '셈돌 놓기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '셈돌을 5개 놓아 보세요.' })).toBeVisible();

  // 교구 영역이 화면 높이의 75% 이상이다. 도움 버튼은 T012 전까지 숨긴다.
  const toolBox = await page.getByTestId('activity-tool').boundingBox();
  const viewport = page.viewportSize();
  if (!toolBox || !viewport) throw new Error('교구 영역 크기를 알 수 없습니다.');
  expect(toolBox.height).toBeGreaterThanOrEqual(viewport.height * 0.75);
  await expect(page.getByRole('button', { name: '도움' })).toHaveCount(0);

  // 첫 과제를 푼다.
  const add = page.getByRole('button', { name: '셈돌 놓기' });
  for (let index = 0; index < 5; index += 1) await add.click();
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();

  // 기록의 learner는 고른 번호(7)여야 한다. 예약 ID "0"이 아니다.
  await expect.poll(async () => readEventLearners(page), { timeout: 8000 }).toContain('7');
  const learners = await readEventLearners(page);
  expect(learners).not.toContain('0');

  // 학생 화면에는 학년·점수 표시가 없다.
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\d\s*학년/);
  expect(body).not.toContain('점수');

  // 새로고침해도 같은 학생이 선택되어 있다.
  await page.goto('/#/');
  await expect(page.getByText('지금 7번 친구예요')).toBeVisible();
  await page.reload();
  await expect(page.getByText('지금 7번 친구예요')).toBeVisible();
  await expect(page.getByRole('button', { name: '7번', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // 다른 친구로 바꾼다.
  await page.getByRole('button', { name: '9번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByText('9번', { exact: true })).toBeVisible();
});

test('저학년 단원은 큰 버튼이 기본이고, ⋯ 메뉴에서 바꿀 수 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '몇 번이에요?' })).toBeVisible();
  await page.getByRole('button', { name: '3번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();

  // 건너뛰기의 저장이 끝나고 지도로 이동하기 전에 다음 주소로 넘어가면
  // 늦게 도착한 #/map 이동이 #/activity를 덮어써 간헐적으로 실패한다.
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByRole('heading', { name: '나의 수학 별자리' })).toBeVisible();

  // g1 단원 콘텐츠가 아직 없으므로 단원 판별 단위 테스트로 확인하고,
  // 화면에서는 설정 메뉴의 "큰 버튼" 항목이 동작하는지만 본다.
  await page.goto('/#/activity/demo.A1');
  await expect(page.getByRole('heading', { name: '셈돌을 5개 놓아 보세요.' })).toBeVisible();
  await page.getByRole('button', { name: '설정' }).click();
  const largeTarget = page.getByRole('menuitemcheckbox', { name: '큰 버튼' });
  await expect(largeTarget).toHaveAttribute('aria-checked', 'false');
  await largeTarget.click();
  await expect(largeTarget).toHaveAttribute('aria-checked', 'true');
});
