import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T007 교사 시연 모드 E2E.
 * `#/demo`에서 교구 열기 → 셈돌 → 펜·지우개 → 2배 확대 → 되감기 → 코드 만들기
 * → 2분할로 서로 다른 두 상태를 나란히 읽기 전용으로 보는 흐름과,
 * 활동 화면의 '보여 주기' 링크가 같은 상태를 여는지 확인한다.
 */

async function openEngine(page: Page) {
  await page.goto('/#/demo');
  await expect(page.getByRole('heading', { name: '시연 모드' })).toBeVisible();
  await page.getByTestId('engine-card-E00').click();
  await page.getByTestId('mode-free').click();
  await expect(page.getByTestId('demo-stage')).toBeVisible();
}

function counters(page: Page, scope = 'demo-stage') {
  return page.locator(`[data-testid="${scope}"] [data-counter-id]`);
}

async function readShareCode(page: Page): Promise<string> {
  await page.getByRole('button', { name: '코드 만들기' }).click();
  const input = page.getByTestId('share-code');
  await expect(input).toBeVisible();
  const code = await input.inputValue();
  await page.getByRole('button', { name: '닫기' }).click();
  return code;
}

test('교구를 열어 펜·확대·되감기를 쓰고 두 상태를 나란히 비교한다', async ({ page }, testInfo) => {
  await openEngine(page);

  const add = page.getByRole('button', { name: '셈돌 놓기' });
  await add.click();
  await add.click();
  await add.click();
  await expect(counters(page)).toHaveCount(3);

  // 펜(검정)로 무대 위를 긋고, 지우개로 지운다.
  await page.getByRole('button', { name: '검정' }).click();
  const pen = page.getByTestId('demo-pen-layer');
  const penBox = await pen.boundingBox();
  if (!penBox) throw new Error('펜 레이어 크기를 알 수 없습니다.');
  const start = { x: penBox.x + penBox.width * 0.2, y: penBox.y + penBox.height * 0.2 };
  const end = { x: penBox.x + penBox.width * 0.6, y: penBox.y + penBox.height * 0.6 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);

  await page.getByTestId('pen-eraser').click();
  await page.mouse.click((start.x + end.x) / 2, (start.y + end.y) / 2);
  await expect(page.locator('[data-stroke-id]')).toHaveCount(0);

  // 2배 확대
  await page.getByTestId('zoom-2').click();
  await expect(page.getByTestId('demo-stage-zoom')).toHaveAttribute('data-zoom', '2');

  // 되감기: 처음(0) → 한 Action → 끝(3)
  const rewind = page.getByTestId('demo-rewind');
  await rewind.focus();
  await page.keyboard.press('Home');
  await expect(counters(page)).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(counters(page)).toHaveCount(1);
  await page.keyboard.press('End');
  await expect(counters(page)).toHaveCount(3);

  // 코드 A: 셈돌 3개
  const codeA = await readShareCode(page);

  // 초기화 뒤 셈돌 1개로 코드 B를 만든다(서로 다른 상태).
  await page.getByRole('button', { name: '초기화' }).click();
  await expect(counters(page)).toHaveCount(0);
  await add.click();
  await expect(counters(page)).toHaveCount(1);
  const codeB = await readShareCode(page);

  // 2분할: 왼쪽 ㄱ, 오른쪽 ㄴ. 학생 번호는 표시하지 않는다.
  await page.getByRole('button', { name: '2분할' }).click();
  await expect(page.getByTestId('demo-split')).toBeVisible();
  await page.getByTestId('pane-input-left').fill(codeA);
  await page.getByTestId('pane-open-left').click();
  await page.getByTestId('pane-input-right').fill(codeB);
  await page.getByTestId('pane-open-right').click();

  await expect(counters(page, 'demo-pane-left')).toHaveCount(3);
  await expect(counters(page, 'demo-pane-right')).toHaveCount(1);
  await expect(
    page.locator('[data-testid="demo-pane-left"]').getByRole('button', { name: '셈돌 놓기' }),
  ).toBeDisabled();

  const titles = await page.locator('[data-testid^="demo-pane-"] h2').allTextContents();
  expect(titles).toEqual(['ㄱ', 'ㄴ']);
  await expect(page.locator('body')).not.toContainText('번 친구');
  await expect(page.locator('body')).not.toContainText('학년');

  // 되감기 슬라이더는 칸마다 따로 움직인다.
  const paneRewind = page.getByTestId('pane-rewind-left');
  await paneRewind.focus();
  await page.keyboard.press('Home');
  await expect(counters(page, 'demo-pane-left')).toHaveCount(0);
  await expect(counters(page, 'demo-pane-right')).toHaveCount(1);
  await page.keyboard.press('End');

  if (testInfo.project.name === 'board') {
    const metrics = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      inner: window.innerHeight,
    }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.inner + 1);
    await expect(page.getByTestId('demo-split')).toBeInViewport();
  }
});

test('활동의 보여 주기 링크로 같은 상태가 시연 모드 왼쪽 칸에 열린다', async ({ page }) => {
  // 활동 화면은 학생 번호가 있어야 열린다. 시작 화면에서 3번을 고른다.
  await page.goto('/');
  await page.getByRole('button', { name: '3번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto('/#/activity/demo.A1');
  await expect(page.getByTestId('demo-canvas')).toBeVisible();

  const add = page.getByRole('button', { name: '셈돌 놓기' });
  await add.click();
  await add.click();
  await expect(page.locator('[data-testid="runner-slot-main"] [data-counter-id]')).toHaveCount(2);

  await page.getByRole('button', { name: '보여 주기' }).click();
  const link = await page.getByTestId('share-link').inputValue();
  expect(link).toContain('#s=');

  await page.goto(link);
  await expect(page.getByTestId('demo-pane-left')).toBeVisible();
  await expect(counters(page, 'demo-pane-left')).toHaveCount(2);

  // 학생 번호·과제 ID는 어디에도 보이지 않는다.
  await expect(page.getByTestId('demo-pane-left')).not.toContainText('demo.A1');
  await expect(page.getByTestId('demo-pane-left')).not.toContainText('번 친구');
});
