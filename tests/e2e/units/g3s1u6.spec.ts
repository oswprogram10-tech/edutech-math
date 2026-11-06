import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectNoPanelInnerScroll } from '../panel-layout';
import { logicalToScreen } from '../canvas-point';

/**
 * T020 g3s1u6 「분수와 소수」 단원 E2E.
 * 활동마다 과제 5개를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 좌표는 화면 픽셀이 아니라 엔진의 논리 좌표(1000×600)로 적는다.
 */

interface Canvas {
  readonly panel: Locator;
  /** 화면 픽셀 좌표. 버튼 클릭으로 스크롤이 바뀔 수 있어 누를 때마다 다시 잰다. */
  readonly at: (x: number, y: number) => Promise<{ x: number; y: number }>;
}

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자라다.
test.describe.configure({ timeout: 120_000 });

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

async function drag(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function verticalCut(page: Page, canvas: Canvas, x: number): Promise<void> {
  await drag(page, await canvas.at(x, 150), await canvas.at(x, 450));
}

async function horizontalCut(page: Page, canvas: Canvas, y: number): Promise<void> {
  await drag(page, await canvas.at(150, y), await canvas.at(850, y));
}

/** 중심에서 원 둘레로 방사형 칼선을 긋는다. */
async function radialCut(page: Page, canvas: Canvas, x: number, y: number): Promise<void> {
  await drag(page, await canvas.at(500, 300), await canvas.at(x, y));
}

async function tapLine(page: Page, canvas: Canvas, x: number): Promise<void> {
  const point = await canvas.at(x, 300);
  await page.mouse.click(point.x, point.y);
}

async function shadePiece(panel: Locator, number: number): Promise<void> {
  // 조각은 키보드로도 색칠할 수 있다(터치 대체 조작).
  await panel.getByRole('button', { name: `조각 ${number}`, exact: true }).press('Space');
}

async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
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

async function removePoint(page: Page, canvas: Canvas, x: number): Promise<void> {
  // 같은 자리를 다시 눌러 점을 고른 뒤 지운다.
  await tapLine(page, canvas, x);
  await canvas.panel.getByRole('button', { name: '점 지우기' }).click();
  await expect(canvas.panel.locator('[data-point-id]')).toHaveCount(0);
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

test('A1 등분 레이저 커터 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u6.A1', '등분 레이저 커터');
  await screenshot(page, 'g3s1u6-a1.png');

  // T1 — 넓이가 다른 4조각으로 먼저 틀린다.
  const t1 = await canvasOf(page, 'main', 'fraction-canvas');
  for (const x of [300, 520, 700]) await verticalCut(page, t1, x);
  await submit(page);
  await expectFailedWithHint(page, '넓이가 모두 같지는 않아요');
  await t1.panel.getByRole('button', { name: '칼선 지우기' }).click();
  for (const x of [325, 500, 675]) await verticalCut(page, t1, x);
  await submit(page);
  await expectPassed(page);

  // T2 — 같은 방향 칼선만으로 4등분해 방향 조건에서 틀린다.
  const t2 = await canvasOf(page, 'main', 'fraction-canvas');
  for (const x of [325, 500, 675]) await verticalCut(page, t2, x);
  await submit(page);
  await expectFailedWithHint(page, '칼선은 어느 방향인가요');
  await t2.panel.getByRole('button', { name: '칼선 지우기' }).click();
  await verticalCut(page, t2, 500);
  await horizontalCut(page, t2, 300);
  await submit(page);
  await expectPassed(page);

  // T3 — 4등분인 그림을 골라 틀린 뒤 4등분이 아닌 그림을 고른다.
  await toggleChoice(page, 'pick', '가');
  await submit(page);
  await expectFailedWithHint(page, '조각 수와 조각 크기');
  await toggleChoice(page, 'pick', '가');
  for (const label of ['나', '라', '바']) await toggleChoice(page, 'pick', label);
  await submit(page);
  await expectPassed(page);

  // T4 — 크기가 다른 세 조각으로 틀린 뒤 같은 각도로 자르고 2/3을 쓴다.
  const t4 = await canvasOf(page, 'left', 'fraction-canvas');
  for (const [x, y] of [
    [710, 300],
    [500, 90],
    [290, 300],
  ] as const) {
    await radialCut(page, t4, x, y);
  }
  await shadePiece(t4.panel, 1);
  await shadePiece(t4.panel, 2);
  await submit(page);
  await expectFailedWithHint(page, '세 조각의 넓이가 모두 같은지');
  await t4.panel.getByRole('button', { name: '칼선 지우기' }).click();
  for (const [x, y] of [
    [710, 300],
    [395, 482],
    [395, 118],
  ] as const) {
    await radialCut(page, t4, x, y);
  }
  await shadePiece(t4.panel, 1);
  await shadePiece(t4.panel, 2);
  await typeNumber(page, 'frac', ['2', '/', '3']);
  await submit(page);
  await expectPassed(page);

  // T5 — 부분/부분(5/3)으로 틀린 뒤 5/8로 고친다.
  await typeNumber(page, 'ans', ['5', '/', '3']);
  await submit(page);
  await expectFailedWithHint(page, '분모는 전체가 몇 조각인지');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['5', '/', '8']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 단위분수 크기 비교 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u6.A2', '단위분수 크기 비교');
  await screenshot(page, 'g3s1u6-a2.png');

  // T1 — 분모가 크면 크다고 생각해 작다(<)를 골라 틀린다.
  await chooseCompare(page, 'cmp', '작다');
  await submit(page);
  await expectFailedWithHint(page, '5명이 나눌 때와 3명이 나눌 때');
  await chooseCompare(page, 'cmp', '크다');
  await submit(page);
  await expectPassed(page);

  // T2 — 콘텐츠에 적힌 순서 그대로 내어 틀린 뒤 큰 수부터 놓는다.
  await submit(page);
  await expectFailedWithHint(page, '겹쳐 보세요');
  await field(page, 'seq').getByRole('button', { name: '1/2 위로' }).click();
  await field(page, 'seq').getByRole('button', { name: '1/2 위로' }).click();
  await field(page, 'seq').getByRole('button', { name: '1/4 위로' }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 점을 하나만 찍어야 하는데 1/2에 찍어 틀린 뒤 1/4로 고친다.
  const t3 = await canvasOf(page, 'main', 'number-line-canvas');
  // 눈금 이름표가 정답인 1/4을 미리 알려 주지 않는다(정수 눈금만 이름표).
  await expect(t3.panel.getByTestId('number-line-canvas')).not.toContainText('1/4');
  await tapLine(page, t3, 500);
  await expect(t3.panel.locator('[data-point-id]')).toHaveCount(1);
  await submit(page);
  await expectFailedWithHint(page, '점을 하나만 찍어야 해요');
  await removePoint(page, t3, 500);
  await tapLine(page, t3, 300);
  await expect(t3.panel.locator('[data-value="1/4"]')).toHaveCount(1);
  await submit(page);
  await expectPassed(page);

  // T4 — 두 비교를 모두 크다로 골라 틀린 뒤 작다로 고친다.
  await chooseCompare(page, 'c1', '크다');
  await chooseCompare(page, 'c2', '크다');
  await submit(page);
  await expectFailedWithHint(page, '분모가 같으면 한 칸의 크기가 같아요');
  await chooseCompare(page, 'c1', '작다');
  await chooseCompare(page, 'c2', '작다');
  await submit(page);
  await expectPassed(page);

  // T5 — 경계에 있는 1/6을 골라 틀린 뒤 사이에 있는 분수만 고른다.
  await toggleChoice(page, 'pick', '1/6');
  await submit(page);
  await expectFailedWithHint(page, '1/6과 5/6 사이');
  await toggleChoice(page, 'pick', '1/6');
  for (const label of ['2/6', '3/6', '4/6']) await toggleChoice(page, 'pick', label);
  await submit(page);
  await expectPassed(page, true);
});

test('A3 1/10 확대경 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u6.A3', '1/10 확대경');
  await screenshot(page, 'g3s1u6-a3.png');

  // T1 — 10칸 중 4칸을 색칠하고 소수를 0.04로 잘못 쓴다.
  const t1 = await canvasOf(page, 'left', 'fraction-canvas');
  for (let number = 1; number <= 4; number += 1) await shadePiece(t1.panel, number);
  await typeNumber(page, 'frac', ['4', '/', '1', '0']);
  await typeNumber(page, 'dec', ['0', '.', '0', '4']);
  await submit(page);
  await expectFailedWithHint(page, '0.1이 몇 개');
  await clearNumber(page, 'dec');
  await typeNumber(page, 'dec', ['0', '.', '4']);
  await submit(page);
  await expectPassed(page);

  // T2 — 확대한 수직선에서 0.5에 찍어 틀린 뒤 0.7로 고친다.
  const t2 = await canvasOf(page, 'main', 'number-line-canvas');
  await t2.panel.getByRole('button', { name: '수직선 확대' }).click();
  await expect(t2.panel.locator('[data-tick-value="1/10"]')).toHaveCount(1);
  // 0.1 단계로 확대해도 눈금 이름표에 정답 0.7이 없다(정수 눈금만 이름표).
  await expect(t2.panel.getByTestId('number-line-canvas')).not.toContainText('0.7');
  await tapLine(page, t2, 500);
  await submit(page);
  await expectFailedWithHint(page, '10칸으로 나눈 눈금');
  await removePoint(page, t2, 500);
  await tapLine(page, t2, 660);
  await expect(t2.panel.locator('[data-value="7/10"]')).toHaveCount(1);
  await submit(page);
  await expectPassed(page);

  // T3 — 1~2 구간으로 옮긴 뒤 1.7에 찍어 틀린다.
  const t3 = await canvasOf(page, 'main', 'number-line-canvas');
  await t3.panel.getByRole('button', { name: '수직선 확대' }).click();
  await expect(t3.panel.locator('[data-tick-value="1/10"]')).toHaveCount(1);
  await t3.panel.getByRole('button', { name: '수직선 오른쪽으로' }).click();
  await expect(t3.panel.locator('[data-tick-value="2"]')).toHaveCount(1);
  // 확대·이동한 뒤에도 이름표에 정답 1.3이 없다.
  await expect(t3.panel.getByTestId('number-line-canvas')).not.toContainText('1.3');
  await tapLine(page, t3, 660);
  await submit(page);
  await expectFailedWithHint(page, '1과 2 사이를 10칸');
  await removePoint(page, t3, 660);
  await tapLine(page, t3, 340);
  await expect(t3.panel.locator('[data-value="13/10"]')).toHaveCount(1);
  await submit(page);
  await expectPassed(page);

  // T4 — 첫째 비교를 크다로 잘못 고른 뒤 작다로 고친다.
  await chooseCompare(page, 'c1', '크다');
  await chooseCompare(page, 'c2', '크다');
  await submit(page);
  await expectFailedWithHint(page, '0.1이 각각 몇 개');
  await chooseCompare(page, 'c1', '작다');
  await chooseCompare(page, 'c2', '크다');
  await submit(page);
  await expectPassed(page);

  // T5 — 0.1이 23개인 수를 2.03으로 잘못 쓴 뒤 2.3으로 고친다.
  await typeNumber(page, 'ans', ['2', '.', '0', '3']);
  await submit(page);
  await expectFailedWithHint(page, '0.1이 10개면 1이에요');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['2', '.', '3']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s1u6.A1', title: '등분 레이저 커터', response: false },
    { id: 'g3s1u6.A2', title: '단위분수 크기 비교', response: true },
    { id: 'g3s1u6.A3', title: '1/10 확대경', response: true },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    if (item.response) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    } else {
      await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g3s1u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s1u6.A1`);
  await expect(page.getByRole('heading', { name: '등분 레이저 커터' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '등분 레이저 커터' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
