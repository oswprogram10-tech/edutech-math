import { expect, test } from '@playwright/test';

test('첫 화면이 뜬다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MathExplorer' })).toBeVisible();
  // 가로 스크롤이 생기지 않는다
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
