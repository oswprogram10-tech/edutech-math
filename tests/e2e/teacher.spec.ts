import { expect, test } from '@playwright/test';

/**
 * T006 교사 PIN E2E.
 * 처음에는 4자리 PIN을 두 번 만들어 저장하고, 다시 들어올 때 확인한다.
 * PIN 분실 복구는 1단계에서 제공하지 않는다.
 */
test('교사 PIN을 만들고 다시 들어올 때 확인한다', async ({ page }) => {
  await page.goto('/#/teacher');
  await expect(page.getByRole('heading', { name: '선생님 PIN 만들기' })).toBeVisible();

  await page.getByLabel('새 PIN', { exact: true }).fill('1234');
  await page.getByLabel('새 PIN 확인', { exact: true }).fill('1234');
  await page.getByRole('button', { name: '만들기' }).click();

  await expect(page.getByRole('heading', { name: '선생님 화면' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '엔진 샌드박스' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '기기 저장소' })).toBeVisible();

  // 다시 들어오면 PIN을 묻는다.
  await page.reload();
  await expect(page.getByRole('heading', { name: '선생님 PIN', exact: true })).toBeVisible();
  await page.getByLabel('PIN', { exact: true }).fill('9999');
  await page.getByRole('button', { name: '들어가기' }).click();
  await expect(page.getByRole('alert')).toHaveText('PIN이 맞지 않아요. 다시 입력해 주세요.');

  await page.getByLabel('PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: '들어가기' }).click();
  await expect(page.getByRole('heading', { name: '선생님 화면' })).toBeVisible();
});
