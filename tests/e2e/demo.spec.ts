import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E00-demo 샌드박스 조작 E2E.
 * 아이패드(WebKit)·크롬북(Chromium)·전자칠판 뷰포트에서 모두 돈다.
 * 좌표는 화면 픽셀이 아니라 SVG의 논리 좌표(1000×600)로 적는다.
 */
async function openDemo(page: Page) {
  await page.goto('/#/sandbox/E00');
  await expect(page.getByRole('heading', { name: '셈돌 데모' })).toBeVisible();
  const canvas = page.getByTestId('demo-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('데모 캔버스 크기를 알 수 없습니다.');
  return {
    canvas,
    observation: page.getByTestId('observation'),
    at: (x: number, y: number) => ({
      x: box.x + (x / 1000) * box.width,
      y: box.y + (y / 600) * box.height,
    }),
  };
}

test('셈돌을 놓고 옮기고 올가미로 묶고 풀 수 있다', async ({ page }) => {
  const { observation, at } = await openDemo(page);

  for (const [x, y] of [
    [200, 200],
    [300, 200],
    [700, 400],
  ] as const) {
    const point = at(x, y);
    await page.mouse.click(point.x, point.y);
  }
  await expect(observation).toHaveText('{"count":3,"groups":[]}');

  // 첫 번째 셈돌을 (200,200) → (200,400)으로 끈다.
  const from = at(200, 200);
  const to = at(200, 400);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-counter-id="c1"]')).toHaveAttribute('data-y', '400');

  // 첫 번째와 두 번째만 감싸는 올가미.
  const lasso = [at(120, 120), at(420, 120), at(420, 500), at(120, 500), at(120, 120)];
  const [start, ...rest] = lasso;
  if (!start) throw new Error('올가미 시작점이 없습니다.');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const point of rest) await page.mouse.move(point.x, point.y, { steps: 6 });
  await page.mouse.up();
  await expect(observation).toHaveText('{"count":3,"groups":[2]}');

  // 묶음 풀기 → 되돌리기 → 다시하기
  await page.getByRole('button', { name: '묶음 풀기' }).first().click();
  await expect(observation).toHaveText('{"count":3,"groups":[]}');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(observation).toHaveText('{"count":3,"groups":[2]}');
  await page.getByRole('button', { name: '다시하기' }).click();
  await expect(observation).toHaveText('{"count":3,"groups":[]}');
});

test('키보드만으로 셈돌을 놓고 선택하고 옮긴다', async ({ page }) => {
  await openDemo(page);

  const add = page.getByRole('button', { name: '셈돌 놓기' });
  await add.focus();
  await page.keyboard.press('Enter');

  const counter = page.getByRole('button', { name: '셈돌 1' });
  await expect(counter).toBeVisible();

  // 추가 버튼 다음 Tab 순서가 셈돌이다.
  await page.keyboard.press('Tab');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
    .toBe('셈돌 1');

  await page.keyboard.press('Space');
  await expect(counter).toHaveAttribute('aria-pressed', 'true');

  const before = await counter.getAttribute('data-x');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => counter.getAttribute('data-x')).not.toBe(before);
  await expect(counter).toHaveAttribute('data-x', String(Number(before) + 100));

  // Shift+방향키는 다섯 칸. 논리 범위 끝(1000)에서 자른다.
  const shifted = await counter.getAttribute('data-x');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(counter).toHaveAttribute('data-x', String(Math.min(1000, Number(shifted) + 500)));

  await expect(page.getByTestId('observation')).toHaveText('{"count":1,"groups":[]}');
});

test('선택한 셈돌은 aria-pressed와 체크 표시로 보인다', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '셈돌 놓기' }).click();

  const counter = page.getByRole('button', { name: '셈돌 1' });
  await expect(counter).toHaveAttribute('aria-pressed', 'false');
  await expect(counter.locator('[data-selected-check]')).toHaveCount(0);

  await counter.click();
  await expect(counter).toHaveAttribute('aria-pressed', 'true');
  await expect(counter.locator('[data-selected-check="c1"]')).toBeVisible();

  // 같은 셈돌을 다시 누르면 선택이 풀리고 체크도 사라진다.
  await counter.click();
  await expect(counter).toHaveAttribute('aria-pressed', 'false');
  await expect(counter.locator('[data-selected-check]')).toHaveCount(0);
});

test.describe('좁은 화면', () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test('폭 400px에서도 셈돌 지름이 48px 이상이다', async ({ page }) => {
    await openDemo(page);
    await page.getByRole('button', { name: '셈돌 놓기' }).click();

    const body = page.locator('[data-counter-id="c1"] [data-part="body"]');
    await expect(body).toBeVisible();

    // ResizeObserver로 실제 SVG 크기를 잰 뒤 반지름이 커지므로 잠깐 기다린다.
    await expect
      .poll(async () => (await body.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(48);

    const box = await body.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  });
});
