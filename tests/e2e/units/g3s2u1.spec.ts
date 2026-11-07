import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T065 g3s2u1 「곱셈」 단원 E2E.
 * A1(넓이 퍼즐)·A2(자릿값 누락 교정기)를 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝낸다.
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
  const next = page.getByRole('button', { name: '다음 과제' });
  await next.focus();
  await page.keyboard.press('Enter');
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

/** iPad WebKit에서 클릭 안정성 검사가 흔들릴 때를 위해 DOM 클릭으로 칸을 고른다. */
async function tap(locator: Locator): Promise<void> {
  await locator.evaluate((node) => (node as HTMLElement).click());
}

async function writeResult(
  panel: Locator,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await tap(cell(panel, 'result', Number(column)));
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

async function writePartial(
  panel: Locator,
  index: number,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await tap(cell(panel, 'partial', Number(column), index));
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

/** E04 넓이 모델에 가로/세로 분할선을 놓고 `target` 자리로 옮긴다. */
async function addAreaSplit(
  page: Page,
  panel: Locator,
  side: 'a' | 'b',
  count: number,
  target: number,
  initial = Math.floor(count / 2),
): Promise<void> {
  const buttonName = side === 'a' ? '가로를 나누는 선 놓기' : '세로를 나누는 선 놓기';
  await panel.getByRole('button', { name: buttonName, exact: true }).click();
  const delta = target - initial;
  const key =
    side === 'a' ? (delta > 0 ? 'ArrowRight' : 'ArrowLeft') : delta > 0 ? 'ArrowDown' : 'ArrowUp';
  let current = initial;
  for (let index = 0; index < Math.abs(delta); index += 1) {
    const lineName =
      side === 'a'
        ? new RegExp(`^가로 ${current} 자리 분할선$`)
        : new RegExp(`^세로 ${current} 자리 분할선$`);
    const line = panel.getByRole('button', { name: lineName });
    await line.focus();
    await page.keyboard.press(key);
    current += delta > 0 ? 1 : -1;
  }
  const targetName =
    side === 'a'
      ? new RegExp(`^가로 ${target} 자리 분할선$`)
      : new RegExp(`^세로 ${target} 자리 분할선$`);
  await expect(panel.getByRole('button', { name: targetName })).toHaveCount(1);
}

/** E04 퍼즐 조각을 골라 조립판 슬롯에 놓는다. */
async function placePuzzlePiece(
  panel: Locator,
  dims: string,
  col: number,
  row: number,
): Promise<void> {
  await panel.getByRole('button', { name: new RegExp(`조각 ${dims}$`) }).click();
  await panel.getByRole('button', { name: `${col + 1}열 ${row + 1}행 자리`, exact: true }).click();
}

/** 교구(SVG)의 글자에 조각의 곱이 그대로 적혀 있지 않은지. `dims`는 가로×세로만 쓴다. */
async function expectNoPieceProducts(panel: Locator, products: readonly string[]): Promise<void> {
  const texts = (await panel.locator('svg text').allTextContents()).map((text) => text.trim());
  for (const product of products) {
    expect(texts, `교구에 조각의 곱 ${product}이(가) 보입니다.`).not.toContain(product);
  }
}

/** 오버레이가 판 안에 들어오는지(내부 스크롤 없이). */
async function expectOverlayInPanel(panel: Locator, selector: string): Promise<void> {
  await expect(panel.locator(selector)).toBeVisible();
  await expect
    .poll(
      async () => {
        const panelBox = await panel.boundingBox();
        const overlayBox = await panel.locator(selector).boundingBox();
        if (!panelBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.max(0, panelBox.x - overlayBox.x),
          Math.max(0, panelBox.y - overlayBox.y),
          Math.max(0, overlayBox.x + overlayBox.width - (panelBox.x + panelBox.width)),
          Math.max(0, overlayBox.y + overlayBox.height - (panelBox.y + panelBox.height)),
        );
      },
      { message: `${selector} 오버레이가 판 밖으로 나갑니다.` },
    )
    .toBeLessThanOrEqual(1);
}

test('A1 넓이 퍼즐 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u1.A1', '넓이 퍼즐');
  await screenshot(page, 'g3s2u1-a1.png');

  // T1 — 30×20을 10×10 조각 6개로 나눈다.
  const first = slot(page, 'main');
  await addAreaSplit(page, first, 'a', 30, 10);
  await addAreaSplit(page, first, 'a', 30, 20, 15);
  await addAreaSplit(page, first, 'b', 20, 10);
  await expectNoPieceProducts(first, ['100']);
  await typeNumber(page, 'count', ['6']);
  await typeNumber(page, 'total', ['6', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T2 — 23×14 네 조각. total 212로 PARTIAL-MISSING ①·②를 본 뒤 322로 고친다.
  const second = slot(page, 'main');
  await addAreaSplit(page, second, 'a', 23, 20);
  await addAreaSplit(page, second, 'b', 14, 10);
  await expectNoPieceProducts(second, ['200', '30', '80', '12']);
  await typeNumber(page, 'p1', ['2', '0', '0']);
  await typeNumber(page, 'p2', ['3', '0']);
  await typeNumber(page, 'p3', ['8', '0']);
  await typeNumber(page, 'p4', ['1', '2']);
  await typeNumber(page, 'total', ['2', '1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '직사각형 조각 중 아직 넓이를 안 센 조각이 있을까?');
  await submit(page);
  await expectFailedWithHint(page, '넓이를 더하지 않은 조각이 있는지 다시 살펴보세요.', 2);
  await retypeNumber(page, 'total', ['3', '2', '2']);
  await submit(page);
  await expectPassed(page);

  // T3 — 퍼즐 조각 30×20·2×20·30×3·2×3을 조립하고 32·23·736을 쓴다.
  const third = slot(page, 'main');
  await expectNoPieceProducts(third, ['600', '40', '90', '6']);
  await placePuzzlePiece(third, '30×20', 0, 0);
  await placePuzzlePiece(third, '2×20', 1, 0);
  await placePuzzlePiece(third, '30×3', 0, 1);
  await placePuzzlePiece(third, '2×3', 1, 1);
  await typeNumber(page, 'fa', ['3', '2']);
  await typeNumber(page, 'fb', ['2', '3']);
  await typeNumber(page, 'val', ['7', '3', '6']);
  await submit(page);
  await expectPassed(page);

  // T4 — 37×26 place-value 분할. 642로 PARTIAL-MISSING ①을 본 뒤 962로 고친다.
  const fourth = slot(page, 'main');
  await expectNoPieceProducts(fourth, ['600', '180', '140', '42']);
  await typeNumber(page, 'total', ['6', '4', '2']);
  await submit(page);
  await expectFailedWithHint(page, '직사각형 조각 중 아직 넓이를 안 센 조각이 있을까?');
  await retypeNumber(page, 'total', ['9', '6', '2']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 자릿값 누락 교정기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u1.A2', '자릿값 누락 교정기');
  await screenshot(page, 'g3s2u1-a2.png');

  // T1 — E04 세로를 20|7로 나누고, NO-CARRY ① 뒤 바른 부분곱으로 고친다.
  const left = slot(page, 'left');
  const right = slot(page, 'right');
  await addAreaSplit(page, left, 'b', 27, 20);
  await expectNoPieceProducts(left, ['920', '322']);
  const color0 = await right
    .locator('[data-row="partial"][data-index="0"]')
    .first()
    .getAttribute('data-row-color');
  const color1 = await right
    .locator('[data-row="partial"][data-index="1"]')
    .first()
    .getAttribute('data-row-color');
  expect(color0).not.toBeNull();
  expect(color1).not.toBeNull();
  expect(color0).not.toBe(color1);
  await writePartial(right, 0, { 0: '2', 1: '2', 2: '3' });
  await writePartial(right, 1, { 1: '1', 2: '9' });
  await writeResult(right, { 0: '4', 1: '1', 2: '4' });
  await submit(page);
  await expectFailedWithHint(page, '이 칸에서 10이 넘었는데 어디로 갔을까?');
  await writePartial(right, 1, { 1: '2', 2: '9' });
  await writeResult(right, { 0: '2', 1: '4', 2: '2', 3: '1' });
  await submit(page);
  await expectPassed(page);

  // T2 — 미리 채운 322·92·414에서 이유 힌트 ①·②를 본 뒤 틀린 칸을 표시한다.
  const debug = slot(page, 'main');
  await submit(page);
  await expectFailedWithHint(page, '27의 2는 얼마를 나타낼까요?');
  await submit(page);
  await expectFailedWithHint(page, '46 × 20은 얼마일까요? 표시된 줄들과 견주어 보세요.', 2);
  await tap(cell(debug, 'partial', 0, 1));
  await debug.getByRole('button', { name: /틀린 칸을 골라/ }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 58×34. 둘째 줄을 밀지 않은 174로 PARTIAL-SHIFT ①·②를 본 뒤 바로잡는다.
  const third = slot(page, 'main');
  await writePartial(third, 0, { 0: '2', 1: '3', 2: '2' });
  await writePartial(third, 1, { 0: '4', 1: '7', 2: '1' });
  await writeResult(third, { 0: '6', 1: '0', 2: '4' });
  await submit(page);
  await expectFailedWithHint(page, '둘째 줄은 58 × 3을 한 걸까, 58 × 30을 한 걸까?');
  await submit(page);
  await expectFailedWithHint(page, '둘째 줄의 빈 일의 자리를 점선으로 보았어요.', 2);
  await expectOverlayInPanel(third, '[data-testid="overlay-partial-shift"]');
  await writePartial(third, 1, { 0: '0', 1: '4', 2: '7', 3: '1' });
  await writeResult(third, { 0: '2', 1: '7', 2: '9', 3: '1' });
  await submit(page);
  await expectPassed(page);

  // T4 — 46×27을 1500으로 어림하고 1242를 계산해 초록 신호를 본다.
  const estimate = slot(page, 'main');
  await estimate.getByTestId('estimate-cell').click();
  for (const digit of ['1', '5', '0', '0']) {
    await estimate.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
  await estimate.getByTestId('estimate-lock').click();
  await writePartial(estimate, 0, { 0: '2', 1: '2', 2: '3' });
  await writePartial(estimate, 1, { 1: '2', 2: '9' });
  await writeResult(estimate, { 0: '2', 1: '4', 2: '2', 3: '1' });
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s2u1.A1', title: '넓이 퍼즐' },
    { id: 'g3s2u1.A2', title: '자릿값 누락 교정기' },
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
    console.log('g3s2u1 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
    if ((metrics?.pageHeight ?? 0) > (metrics?.viewportHeight ?? 0) + 1) {
      await expectContentPanelsReachable(page);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({
      ratio: 1,
    });
    if (item.id === 'g3s2u1.A2') {
      await expect(slot(page, 'left')).toBeInViewport({ ratio: 1 });
      await expect(slot(page, 'right')).toBeInViewport({ ratio: 1 });
    } else {
      await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    }
    if ((await responseSlot(page).count()) > 0) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g3s2u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s2u1.A1`);
  await expect(page.getByRole('heading', { name: '넓이 퍼즐' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '넓이 퍼즐' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
