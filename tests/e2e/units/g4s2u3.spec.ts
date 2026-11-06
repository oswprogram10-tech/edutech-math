import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';
import { logicalToScreen } from '../canvas-point';

/**
 * T023 g4s2u3 「소수의 덧셈과 뺄셈」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 고친 정답 순서로 끝까지 해 본다.
 * 명세 표의 오개념 다섯 코드가 이 단원 과제에서 실제로 감지되는지도 확인한다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 좌표·칸 번호는 화면 픽셀이 아니라 엔진의 논리 좌표와 1부터 세는 번호로 적는다.
 */

interface Canvas {
  readonly panel: Locator;
  /** 화면 픽셀 좌표. 버튼 클릭으로 스크롤이 바뀔 수 있어 누를 때마다 다시 잰다. */
  readonly at: (x: number, y: number) => Promise<{ x: number; y: number }>;
}

// 과제 하나에 오답·힌트·수정이 여러 번 이어져 기본 30초로는 모자라다.
test.describe.configure({ timeout: 180_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function responseSlot(page: Page): Locator {
  return slot(page, 'response');
}

function field(page: Page, id: string): Locator {
  return responseSlot(page).locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, title: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function canvasOf(page: Page, name: string, testId: string): Promise<Canvas> {
  const panel = slot(page, name);
  const canvas = panel.getByTestId(testId);
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`그림 상자를 찾을 수 없습니다: ${name}`);
  return {
    panel,
    at: async (x, y) => {
      // 캔버스가 화면보다 커서 스크롤 위치에 따라 위쪽이 잘린다.
      // 조작 전에 캔버스 위쪽을 화면 위에 맞춰 논리 좌표가 화면 안에 오게 한다.
      await canvas.evaluate((element) =>
        element.scrollIntoView({ block: 'start', inline: 'nearest' }),
      );
      const fresh = await canvas.boundingBox();
      if (!fresh) throw new Error(`그림 상자를 다시 찾을 수 없습니다: ${name}`);
      return logicalToScreen(fresh, x, y);
    },
  };
}

async function tapLine(page: Page, canvas: Canvas, x: number): Promise<void> {
  const point = await canvas.at(x, 300);
  await page.mouse.click(point.x, point.y);
}

async function removePoint(page: Page, canvas: Canvas, x: number): Promise<void> {
  // 같은 자리를 다시 눌러 점을 고른 뒤 지운다.
  await tapLine(page, canvas, x);
  await canvas.panel.getByRole('button', { name: '점 지우기' }).click();
  await expect(canvas.panel.locator('[data-point-id]')).toHaveCount(0);
}

async function shadeRows(panel: Locator, rows: readonly number[]): Promise<void> {
  for (const row of rows) {
    await panel.getByRole('button', { name: `${row}번째 줄 색칠`, exact: true }).click();
  }
}

/** 겹치지 않는 칸을 차례로 색칠한다. `indices`는 0부터 세는 전체 칸 번호다. */
async function shadeCells(panel: Locator, indices: readonly number[]): Promise<void> {
  for (const index of indices) {
    await panel.getByRole('button', { name: `${index + 1}번째 칸`, exact: true }).click();
  }
}

async function chooseCompare(
  page: Page,
  id: string,
  symbol: '작다' | '같다' | '크다',
): Promise<void> {
  await field(page, id).getByRole('button', { name: symbol }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function typeDecimal(page: Page, id: string, text: string): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of text) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '1');
  await expect(page.getByTestId('hint-text')).toContainText(text);
}

async function expectPassed(page: Page, last = false): Promise<void> {
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  if (last) {
    await expect(page.getByText('모든 과제를 마쳤어요.')).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: '다음 과제' }).click();
}

function topCell(panel: Locator, column: number): Locator {
  return panel.locator(`[data-testid="column-grid"] [data-row="top"][data-column="${column}"]`);
}

function resultCell(panel: Locator, column: number): Locator {
  return panel.locator(`[data-row="result"][data-column="${column}"]`);
}

async function placeCard(panel: Locator, card: 'a' | 'b', column: number): Promise<void> {
  await panel.getByTestId(`card-${card}`).click();
  await topCell(panel, column).click();
}

/** 결과 칸은 오른쪽(가장 낮은 자리)부터 채운다. 먼저 그 칸을 골라야 한다. */
async function typeResult(panel: Locator, digits: readonly string[]): Promise<void> {
  for (const digit of digits) {
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

async function rewriteResult(
  panel: Locator,
  startColumn: number,
  digits: readonly string[],
): Promise<void> {
  await resultCell(panel, startColumn).click();
  await typeResult(panel, digits);
}

async function screenshot(page: Page, name: string): Promise<void> {
  // 버튼 클릭으로 스크롤된 상태가 남지 않게 맨 위에서 찍는다.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

test('A1 모눈과 수직선 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s2u3.A1', '10×10 모눈 중첩 색칠기');
  await screenshot(page, 'g4s2u3-a1.png');

  // T1 — 0.47보다 한 칸 모자란 46칸으로 먼저 틀린다.
  const t1 = slot(page, 'main');
  await shadeRows(t1, [1, 2, 3, 4]);
  await shadeCells(t1, [40, 41, 42, 43, 44, 45]);
  await submit(page);
  await expectFailedWithHint(page, '한 줄을 다 칠하면');
  await shadeCells(t1, [46]);
  await submit(page);
  await expectPassed(page);

  // T2 — 0.3과 0.25를 각 층에 칠하고 자릿수가 많은 쪽을 크다고 골라 틀린다.
  const t2 = slot(page, 'main');
  await expect(t2.getByRole('button', { name: '0.25', exact: true })).toBeVisible();
  await shadeRows(t2, [1, 2, 3]);
  await t2.getByRole('button', { name: '0.25', exact: true }).click();
  await shadeRows(t2, [1, 2]);
  await shadeCells(t2, [120, 121, 122, 123, 124]);
  await chooseCompare(page, 'cmp', '작다');
  await submit(page);
  await expectFailedWithHint(page, '모눈에서 어느 쪽이 더 넓게');
  await chooseCompare(page, 'cmp', '크다');
  await submit(page);
  await expectPassed(page);

  // T3 — 0.3과 0.30을 같은 칸 수로 칠하고 끝자리 0이 값을 바꾼다고 골라 틀린다.
  const t3 = slot(page, 'main');
  await expect(t3.getByRole('button', { name: '0.30', exact: true })).toBeVisible();
  await shadeRows(t3, [1, 2, 3]);
  await t3.getByRole('button', { name: '0.30', exact: true }).click();
  await shadeRows(t3, [1, 2, 3]);
  await chooseCompare(page, 'cmp', '크다');
  await submit(page);
  await expectFailedWithHint(page, '0.30을 모눈에 칠하면');
  await chooseCompare(page, 'cmp', '같다');
  await submit(page);
  await expectPassed(page);

  // T4 — 0.01 눈금까지 확대하고 오른쪽으로 여섯 번 옮겨 0.6대 창을 연다.
  const t4 = await canvasOf(page, 'main', 'number-line-canvas');
  await t4.panel.getByRole('button', { name: '수직선 확대' }).click();
  await expect(t4.panel.locator('[data-tick-value="1/100"]')).not.toHaveCount(0);
  for (let step = 0; step < 6; step += 1) {
    await t4.panel.getByRole('button', { name: '수직선 오른쪽으로' }).click();
  }
  // 0.65 자리에 먼저 찍어 틀린 뒤 0.68로 고친다.
  await tapLine(page, t4, 500);
  await submit(page);
  await expectFailedWithHint(page, '0.6을 먼저 찾아보세요');
  await removePoint(page, t4, 500);
  await tapLine(page, t4, 740);
  await expect(t4.panel.locator('[data-value="17/25"]')).toHaveCount(1);
  await submit(page);
  await expectPassed(page);

  // T5 — 7의 자릿값을 0.07로 먼저 틀린 뒤 0.007로 고친다.
  await expect(responseSlot(page)).toBeVisible();
  await expect(field(page, 'ans')).toBeVisible();
  await typeDecimal(page, 'ans', '0.07');
  await submit(page);
  await expectFailedWithHint(page, '7은 소수점 아래 몇 번째');
  await clearNumber(page, 'ans');
  await typeDecimal(page, 'ans', '0.007');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 소수점 자석 세로셈 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s2u3.A2', '소수점 자석 정렬 세로셈');
  await screenshot(page, 'g4s2u3-a2.png');

  // T1 — 소수점 아래를 따로 더한 4.32로 먼저 틀린다(MC-DEC-POINT-SEPARATOR).
  const t1 = slot(page, 'main');
  await placeCard(t1, 'a', 0);
  await placeCard(t1, 'b', 0);
  await typeResult(t1, ['2', '3', '4']);
  await submit(page);
  await expectFailedWithHint(page, '0.5와 0.27을');
  await rewriteResult(t1, -2, ['7', '7', '4']);
  await submit(page);
  await expectPassed(page);

  // T2 — 받아내림 뒤 윗자리를 그대로 쓴 3.75로 틀린다(MC-PV-BORROW-NO-DECREMENT).
  const t2 = slot(page, 'main');
  await placeCard(t2, 'a', 0);
  await placeCard(t2, 'b', 0);
  await typeResult(t2, ['5', '7', '3']);
  await submit(page);
  await expectFailedWithHint(page, '0.1 하나를 낱칸으로 풀었을 때');
  await rewriteResult(t2, -2, ['5', '6', '3']);
  await submit(page);
  await expectPassed(page);

  // T3 — 자릿수가 다른 덧셈을 한 칸 틀린 12.99로 먼저 틀린다.
  const t3 = slot(page, 'main');
  await placeCard(t3, 'a', 0);
  await placeCard(t3, 'b', 0);
  await typeResult(t3, ['9', '9', '2', '1']);
  await submit(page);
  await expectFailedWithHint(page, '자릿수가 다른 두 수의 소수점');
  await rewriteResult(t3, -2, ['8', '9', '2', '1']);
  await submit(page);
  await expectPassed(page);

  // T4 — 자석 없이 5를 오른쪽 끝에 맞춰 놓아 틀린다(MC-DEC-ALIGN-RIGHT).
  const t4 = slot(page, 'main');
  await expect(t4.getByTestId('card-a')).toBeVisible();
  await placeCard(t4, 'a', -2);
  await placeCard(t4, 'b', 0);
  await typeResult(t4, ['0']);
  await submit(page);
  await expectFailedWithHint(page, '5는 어느 자리 숫자이고 6은');
  // 5의 소수점을 1.36과 같은 세로줄에 다시 놓는다.
  await placeCard(t4, 'a', 0);
  await typeResult(t4, ['4', '6', '3']);
  await submit(page);
  await expectPassed(page);

  // T5 — 어림을 '아니요'로 골라 틀린 뒤 '예'로 고친다.
  await expect(responseSlot(page)).toBeVisible();
  await expect(field(page, 'est')).toBeVisible();
  await toggleChoice(page, 'est', '아니요');
  await submit(page);
  await expectFailedWithHint(page, '7.9와 2.15를 각각 몇쯤');
  await toggleChoice(page, 'est', '예');
  await submit(page);
  await expectPassed(page, true);
});

test('세 뷰포트에서 세로셈 판의 결과 줄 칸이 화면 안에 보인다', async ({ page }) => {
  await openActivity(page, 'g4s2u3.A2', '소수점 자석 정렬 세로셈');
  await page.evaluate(() => window.scrollTo(0, 0));

  const panel = slot(page, 'main');
  const resultCells = panel.locator('[data-row="result"][data-column]');
  expect(await resultCells.count()).toBeGreaterThan(0);
  for (const cell of await resultCells.all()) {
    await expect(cell).toBeInViewport({ ratio: 1 });
  }

  // 판이 엔진 상자 안에서 따로 세로 스크롤되어 잘리지 않는다.
  const gridScroll = panel.getByTestId('column-grid').locator('..');
  const clipped = await gridScroll.evaluate(
    (element) => element.scrollHeight - element.clientHeight,
  );
  expect(clipped).toBeLessThanOrEqual(1);
});

test('크롬북·전자칠판 첫 화면에 엔진 입력과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g4s2u3.A1', title: '10×10 모눈 중첩 색칠기' },
    { id: 'g4s2u3.A2', title: '소수점 자석 정렬 세로셈' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    if (item.id === 'g4s2u3.A2') {
      // A2는 크롬북에서 첫 화면(672px)을 넘는다. 판 안 스크롤 없이 페이지 스크롤로 확인한다.
      await expectContentPanelsReachable(page);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g4s2u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s2u3.A1`);
  await expect(page.getByRole('heading', { name: '10×10 모눈 중첩 색칠기' })).toBeVisible();

  // 서비스 워커가 설치·활성화되어 이 페이지를 제어할 때까지 기다린다.
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
  await expect(page.getByRole('heading', { name: '10×10 모눈 중첩 색칠기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
