import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T064 g3s1u4 「곱셈」 단원 E2E.
 * A1(넓이 모델·부분곱·받아올림)·A2(곱 어림 신호등)를 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝낸다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

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

async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function retypeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  await clearNumber(page, id);
  await typeNumber(page, id, keys);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string, level = 1): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
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

async function screenshot(page: Page, name: string): Promise<void> {
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

function cell(panel: Locator, row: string, column: number, index?: number): Locator {
  const indexPart = index === undefined ? '' : `[data-index="${index}"]`;
  return panel.locator(`[data-row="${row}"]${indexPart}[data-column="${column}"]`);
}

async function writeResult(
  panel: Locator,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await cell(panel, 'result', Number(column)).click();
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

async function writePartial(
  panel: Locator,
  index: number,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await cell(panel, 'partial', Number(column), index).click();
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

/** E04 넓이 모델에 가로 분할선을 놓고 오른쪽으로 `steps`칸 옮긴다. */
async function splitAreaAt(page: Page, panel: Locator, base: number, steps: number): Promise<void> {
  await panel.getByRole('button', { name: '가로를 나누는 선 놓기', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: new RegExp(`^가로 ${base} 자리 분할선$`) }),
  ).toHaveCount(1);
  // 분할선은 자리가 바뀔 때마다 다시 그려져 초점이 풀린다. 한 칸씩 다시 초점을 준다.
  for (let index = 0; index < steps; index += 1) {
    const line = panel.getByRole('button', { name: /^가로 \d+ 자리 분할선$/ });
    await line.focus();
    await page.keyboard.press('ArrowRight');
  }
}

/** 교구(SVG)의 글자에 조각의 곱이 그대로 적혀 있지 않은지. `dims`는 가로×세로만 쓴다. */
async function expectNoPieceProducts(panel: Locator, products: readonly string[]): Promise<void> {
  const texts = (await panel.locator('svg text').allTextContents()).map((text) => text.trim());
  for (const product of products) {
    expect(texts, `교구에 조각의 곱 ${product}이(가) 보입니다.`).not.toContain(product);
  }
}

async function estimate(panel: Locator, digits: readonly string[]): Promise<void> {
  await panel.getByTestId('estimate-cell').click();
  for (const digit of digits) {
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
  await panel.getByTestId('estimate-lock').click();
}

test('A1 넓이 모델과 곱셈 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u4.A1', '넓이 모델과 곱셈');
  await screenshot(page, 'g3s1u4-a1.png');

  // T1 — 20|3으로 나누고 total만 20으로 써서 NO-PLACE-VALUE를 만난 뒤 92로 고친다.
  const area = slot(page, 'main');
  await splitAreaAt(page, area, 11, 9);
  // T1 — 나눈 뒤에도 조각의 곱(80·12)이 교구에 적히지 않는다.
  await expectNoPieceProducts(area, ['80', '12']);
  await typeNumber(page, 'p1', ['8', '0']);
  await typeNumber(page, 'p2', ['1', '2']);
  await typeNumber(page, 'total', ['2', '0']);
  await submit(page);
  await expectFailedWithHint(page, '2는 정말 2일까, 20일까?');
  await retypeNumber(page, 'total', ['9', '2']);
  await submit(page);
  await expectPassed(page);

  // T2 — 나누지 않고 102만 써서 일반 힌트를 만난 뒤, 선을 놓고 102로 통과한다.
  const free = slot(page, 'main');
  await typeNumber(page, 'total', ['1', '0', '2']);
  await submit(page);
  await expectFailedWithHint(page, '직사각형을 나누어 보았나요?');
  await free.getByRole('button', { name: '가로를 나누는 선 놓기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — E04를 40에서 나누고 부분곱 30·200, 결과 30으로 PARTIAL-MISSING을 만난 뒤 230으로 고친다.
  const left = slot(page, 'left');
  const right = slot(page, 'right');
  // T3 첫 화면 — 연결된 E04가 부분곱 답(30·200)을 미리 적지 않는다.
  await expectNoPieceProducts(left, ['30', '200']);
  await splitAreaAt(page, left, 23, 17);
  // T3 — 40에서 나눈 뒤에도 조각의 곱(30·200)이 교구에 적히지 않는다.
  await expectNoPieceProducts(left, ['30', '200']);
  const rowColor0 = await right
    .locator('[data-row="partial"][data-index="0"]')
    .first()
    .getAttribute('data-row-color');
  const rowColor1 = await right
    .locator('[data-row="partial"][data-index="1"]')
    .first()
    .getAttribute('data-row-color');
  expect(rowColor0).not.toBeNull();
  expect(rowColor1).not.toBeNull();
  expect(rowColor0).not.toBe(rowColor1);
  await writePartial(right, 0, { 0: '0', 1: '3' });
  await writePartial(right, 1, { 0: '0', 1: '0', 2: '2' });
  await writeResult(right, { 0: '0', 1: '3' });
  await submit(page);
  await expectFailedWithHint(page, '직사각형 조각 중 넓이를 아직 안 센 곳이 있을까?');
  await writeResult(right, { 2: '2' });
  await submit(page);
  await expectPassed(page);

  // T4 — 받아올림 1과 852. 먼저 882를 써서 CARRY-ADD-BEFORE를 본 뒤 고친다.
  const carryPanel = slot(page, 'main');
  await cell(carryPanel, 'carry', 1).click();
  await carryPanel.getByRole('button', { name: '1 쓰기' }).click();
  await writeResult(carryPanel, { 0: '2', 1: '8', 2: '8' });
  await submit(page);
  await expectFailedWithHint(page, '받아올린 1은');
  await writeResult(carryPanel, { 0: '2', 1: '5', 2: '8' });
  await submit(page);
  await expectPassed(page);
  await screenshot(page, 'g3s1u4-a1-t5.png');
  // T5 첫 화면 — 미리 놓인 백·십·일 조각이 곱(900·30·6)을 적지 않는다.
  await expectNoPieceProducts(slot(page, 'main'), ['900', '30', '6']);

  // T5 — 조각 넓이 900·30·6, total만 18로 써서 NO-PLACE-VALUE를 만난 뒤 936으로 고친다.
  await typeNumber(page, 'p1', ['9', '0', '0']);
  await typeNumber(page, 'p2', ['3', '0']);
  await typeNumber(page, 'p3', ['6']);
  await typeNumber(page, 'total', ['1', '8']);
  await submit(page);
  await expectFailedWithHint(page, '3은 정말 3일까, 300일까?');
  await retypeNumber(page, 'total', ['9', '3', '6']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 곱 어림 신호등 — 대표 오답 뒤 고쳐서 세 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u4.A2', '곱 어림 신호등');
  await screenshot(page, 'g3s1u4-a2.png');

  // T1 — 300으로 어림하고 248을 써서 NO-CARRY를 만난 뒤 288로 고친다.
  const first = slot(page, 'main');
  await estimate(first, ['3', '0', '0']);
  await writeResult(first, { 0: '8', 1: '4', 2: '2' });
  await submit(page);
  await expectFailedWithHint(page, '8 × 6은 48이지');
  await writeResult(first, { 0: '8', 1: '8', 2: '2' });
  await submit(page);
  await expectPassed(page);

  // T2 — 280으로 어림하고 계산 268로 통과한다.
  const second = slot(page, 'main');
  await estimate(second, ['2', '8', '0']);
  await writeResult(second, { 0: '8', 1: '6', 2: '2' });
  await submit(page);
  await expectPassed(page);

  // T3 — 300으로 어림하고 다시 확인 없이 제출해 일반 힌트를 본 뒤 다시 확인한다.
  const third = slot(page, 'main');
  await estimate(third, ['3', '0', '0']);
  await submit(page);
  await expectFailedWithHint(page, '48 × 6은 대략 얼마쯤일까요?');
  await third.getByTestId('estimate-recheck').click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s1u4.A1', title: '넓이 모델과 곱셈' },
    { id: 'g3s1u4.A2', title: '곱 어림 신호등' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    const metrics = await page.evaluate(() => {
      const scroller = document.querySelector('main');
      const button = Array.from(document.querySelectorAll('button')).find(
        (element) => element.textContent === '확인하기',
      );
      if (!(scroller instanceof HTMLElement) || !(button instanceof HTMLElement)) return null;
      const host = scroller.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return {
        pageHeight: scroller.scrollHeight,
        viewportHeight: scroller.clientHeight,
        submitTop: Math.round(box.top - host.top + scroller.scrollTop),
        submitBottom: Math.round(box.bottom - host.top + scroller.scrollTop),
      };
    });
    console.log('g3s1u4 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
    if ((metrics?.pageHeight ?? 0) > (metrics?.viewportHeight ?? 0) + 1) {
      await expectContentPanelsReachable(page);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({
      ratio: 1,
    });
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    if ((await responseSlot(page).count()) > 0) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g3s1u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s1u4.A1`);
  await expect(page.getByRole('heading', { name: '넓이 모델과 곱셈' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '넓이 모델과 곱셈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
