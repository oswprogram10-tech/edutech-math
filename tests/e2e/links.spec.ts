import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';

/**
 * T046 연결 E2E: E01 → E07(받아올림), E04 → E07(부분곱 색).
 * 데모 콘텐츠의 활동 하나만 골라 실행한다.
 */

async function openActivity(page: Page, activityId: string, prompt: RegExp) {
  // 학생 번호를 골라야 활동 화면이 열린다(저장소가 비어 있으면 홈으로 돌아간다).
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);

  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: prompt })).toBeVisible();
  const left = page.getByTestId('runner-slot-left');
  const right = page.getByTestId('runner-slot-right');
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  return { left, right };
}

async function visibleBox(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const box = await target.boundingBox();
  if (!viewport || !box) throw new Error('판의 크기를 알 수 없습니다.');
  const overflow = box.y + box.height - viewport.height;
  if (overflow > 0) {
    await page.evaluate((delta) => window.scrollBy(0, delta), overflow + 8);
  }
  const fitted = await target.boundingBox();
  if (!fitted) throw new Error('판의 크기를 알 수 없습니다.');
  return fitted;
}

test('E01에서 10개를 묶으면 E07 받아올림 칸에 1이 쓰인다', async ({ page }) => {
  const { left, right } = await openActivity(page, 'demo.A4', /38 \+ 25/);

  await left.getByRole('button', { name: '10개 묶기' }).click();
  const carry = right.locator('[data-row="carry"][data-column="1"]');
  await expect(carry).toHaveText('1');

  // 세로셈을 마저 채우면 과제가 통과한다.
  await right.getByRole('button', { name: '3 쓰기' }).click();
  await right.getByRole('button', { name: '6 쓰기' }).click();
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
});

test('E04 넓이 모델을 40과 6으로 나누면 E07 부분곱 줄에 같은 색이 칠해진다', async ({ page }) => {
  const { left, right } = await openActivity(page, 'demo.A5', /46 × 5/);

  await expect(right.locator('[data-row="partial"][data-row-color]')).toHaveCount(0);

  await left.getByRole('button', { name: '가로를 나누는 선 놓기' }).click();
  // 분할선은 세로선이라 <g>의 기하 경계 상자가 0폭이다. Playwright는 이를 hidden으로
  // 보므로 visible 대신 DOM에 붙었는지만 확인하고, 넓은 투명 선을 좌표로 끈다.
  const split = left.getByRole('button', { name: '가로 23 자리 분할선' });
  await expect(split).toHaveCount(1);

  // areaRect(46, 5): x=110, width=720, y=140, height=300.
  const canvas = left.getByTestId('array-canvas');
  const box = await visibleBox(page, canvas);
  const at = (x: number, y: number) => logicalToScreen(box, x, y);
  const from = at(110 + (720 * 23) / 46, 290);
  const to = at(110 + (720 * 40) / 46, 290);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();

  // 40×5=200과 6×5=30이 두 부분곱 줄에 서로 다른 색으로 붙는다.
  await expect(right.locator('[data-row="partial"][data-row-color="0"]').first()).toBeVisible();
  await expect(right.locator('[data-row="partial"][data-row-color="1"]').first()).toBeVisible();
});
