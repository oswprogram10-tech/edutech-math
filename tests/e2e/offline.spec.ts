import { expect, test } from '@playwright/test';
import { PREVIEW_URL } from '../../playwright.config';

test('한 번 연 뒤에는 오프라인에서 새로고침해도 뜬다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await expect(page.getByRole('heading', { name: 'MathExplorer' })).toBeVisible();

  // 서비스 워커가 설치·활성화되어 이 페이지를 제어할 때까지 기다린다
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'MathExplorer' })).toBeVisible();
});
