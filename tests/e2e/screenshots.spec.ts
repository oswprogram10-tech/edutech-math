import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T006 화면 기준 이미지.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 S1·S3·교사 PIN 화면을 찍는다.
 * CI는 E2E를 돌리지 않으므로 기준 이미지는 로컬에서 만든다(카드 메모).
 */
async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function enterAsStudent(page: Page, number: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `${number}번`, exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
}

test('S1 시작 화면', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '몇 번이에요?' })).toBeVisible();
  await waitForFonts(page);
  await expect(page).toHaveScreenshot('s1-start.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('S3 활동 화면', async ({ page }) => {
  await enterAsStudent(page, '7');
  await page.goto('/#/activity/demo.A1');
  await expect(page.getByRole('heading', { name: '셈돌을 5개 놓아 보세요.' })).toBeVisible();
  await waitForFonts(page);
  await expect(page).toHaveScreenshot('s3-activity.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('교사 PIN 화면', async ({ page }) => {
  await page.goto('/#/teacher');
  await expect(page.getByRole('heading', { name: '선생님 PIN 만들기' })).toBeVisible();
  await waitForFonts(page);
  await expect(page).toHaveScreenshot('teacher-pin.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});
