import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T066 g3s2u2 「나눗셈」 단원 E2E.
 * A1(십모형 해체 분배)·A2(나머지 경고등과 되감기 검산)를 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝낸다.
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

function divCell(panel: Locator, row: string, column: number, index?: number): Locator {
  const indexPart = index === undefined ? '' : `[data-index="${index}"]`;
  return panel.locator(`[data-row="${row}"]${indexPart}[data-column="${column}"]`);
}

/** iPad WebKit에서 클릭 안정성 검사가 흔들릴 때를 위해 DOM 클릭으로 칸을 고른다. */
async function tap(locator: Locator): Promise<void> {
  await locator.evaluate((node) => (node as HTMLElement).click());
}

async function writeDiv(
  panel: Locator,
  row: string,
  column: number,
  digit: string,
  index?: number,
): Promise<void> {
  await tap(divCell(panel, row, column, index));
  await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
}

async function writeQuotient(
  panel: Locator,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await writeDiv(panel, 'quotient', Number(column), digit);
  }
}

async function writeProduct(
  panel: Locator,
  index: number,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await writeDiv(panel, 'div-product', Number(column), digit, index);
  }
}

async function writeDiff(
  panel: Locator,
  index: number,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await writeDiv(panel, 'div-diff', Number(column), digit, index);
  }
}

async function dealRound(panel: Locator, name: string): Promise<void> {
  await panel.getByRole('button', { name: `${name} 한 바퀴`, exact: true }).click();
}

async function breakPileBlocks(
  page: Page,
  panel: Locator,
  value: number,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const block = panel.locator(`[data-block-plate="pile"][data-block-value="${value}"]`).first();
    await block.focus();
    await page.keyboard.press('Enter');
  }
}

/** E01 divide에서 52÷4를 접시 4개에 13씩 나눈다. */
async function distribute52(page: Page, panel: Locator): Promise<void> {
  await dealRound(panel, '십');
  await breakPileBlocks(page, panel, 10, 1);
  for (let index = 0; index < 3; index += 1) await dealRound(panel, '하나');
}

/** E01 divide에서 75÷3을 접시 3개에 25씩 나눈다. */
async function distribute75(page: Page, panel: Locator): Promise<void> {
  await dealRound(panel, '십');
  await dealRound(panel, '십');
  await breakPileBlocks(page, panel, 10, 1);
  for (let index = 0; index < 5; index += 1) await dealRound(panel, '하나');
}

/** E01 divide에서 312÷6을 접시 6개에 52씩 나눈다(백 3개를 모두 푼다). */
async function distribute312(page: Page, panel: Locator): Promise<void> {
  await breakPileBlocks(page, panel, 100, 3);
  for (let index = 0; index < 5; index += 1) await dealRound(panel, '십');
  await breakPileBlocks(page, panel, 10, 1);
  for (let index = 0; index < 2; index += 1) await dealRound(panel, '하나');
}

/** E01 divide에서 83÷6을 접시 6개에 13씩, 무더기에 5를 남긴다. */
async function distribute83(page: Page, panel: Locator): Promise<void> {
  await dealRound(panel, '십');
  await breakPileBlocks(page, panel, 10, 2);
  for (let index = 0; index < 3; index += 1) await dealRound(panel, '하나');
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

test('A1 십모형 해체 분배 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u2.A1', '십모형 해체 분배');
  await screenshot(page, 'g3s2u2-a1.png');

  // T1 — 52÷4를 블록으로 나누면 E07 몫 13이 자동으로 채워진다.
  const firstLeft = slot(page, 'left');
  const firstRight = slot(page, 'right');
  await distribute52(page, firstLeft);
  await expect(divCell(firstRight, 'quotient', 1)).toHaveText('1');
  await expect(divCell(firstRight, 'quotient', 0)).toHaveText('3');
  await submit(page);
  await expectPassed(page);

  // T2 — 75÷3. E01을 먼저 나눠 몫 강조를 본 뒤 E07에 25를 쓴다.
  const secondLeft = slot(page, 'left');
  const secondRight = slot(page, 'right');
  await distribute75(page, secondLeft);
  await writeQuotient(secondRight, { 1: '2', 0: '5' });
  await writeProduct(secondRight, 1, { 1: '6' });
  await writeDiff(secondRight, 1, { 1: '1', 0: '5' });
  await writeProduct(secondRight, 0, { 1: '1', 0: '5' });
  await writeDiff(secondRight, 0, { 1: '0', 0: '0' });
  await submit(page);
  await expectPassed(page);

  // T3 — 47÷3. 몫 14로 나머지가 3보다 큰 REMAINDER-TOO-BIG ①을 본 뒤 15…2로 고친다.
  const third = slot(page, 'main');
  await writeQuotient(third, { 1: '1', 0: '4' });
  await writeProduct(third, 1, { 1: '3' });
  await writeDiff(third, 1, { 1: '1', 0: '7' });
  await writeProduct(third, 0, { 1: '1', 0: '2' });
  await writeDiff(third, 0, { 0: '5' });
  await submit(page);
  await expectFailedWithHint(page, '남은 수로 3을 한 번 더 나눌 수 있을까?');
  await writeQuotient(third, { 0: '5' });
  await writeProduct(third, 0, { 0: '5' });
  await writeDiff(third, 0, { 0: '2' });
  await submit(page);
  await expectPassed(page);

  // T4 — 312÷6. 백 3개를 풀어 십 5바퀴, 남은 십을 풀어 일 3바퀴로 나눈다.
  const fourth = slot(page, 'left');
  await distribute312(page, fourth);
  await submit(page);
  await expectPassed(page);

  // T5 — 408÷4. 몫 12로 QUOTIENT-ZERO ①·②를 본 뒤 102로 고친다.
  const fifth = slot(page, 'main');
  await writeQuotient(fifth, { 2: '1', 0: '2' });
  await submit(page);
  await expectFailedWithHint(
    page,
    '십의 자리에서 4로 나눌 수 있는 수가 없으면 몫의 그 자리에는 무엇을 쓸까요?',
  );
  await submit(page);
  await expectFailedWithHint(page, '몫의 빈 자리를 깜빡여 보았어요.', 2);
  await expectOverlayInPanel(fifth, '[data-overlay="quotient-gap"]');
  await writeQuotient(fifth, { 1: '0' });
  await writeProduct(fifth, 2, { 2: '4' });
  await writeDiff(fifth, 2, { 1: '0', 0: '8' });
  await writeProduct(fifth, 0, { 0: '8' });
  await writeDiff(fifth, 0, { 0: '0' });
  await submit(page);
  await expectPassed(page, true);
});

test('A2 나머지 경고등과 되감기 검산 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g3s2u2.A2', '나머지 경고등과 되감기 검산');
  await screenshot(page, 'g3s2u2-a2.png');

  // T1 — 83÷6. 내림을 빠뜨려 BRING-DOWN ①을 본 뒤 몫 13, 나머지 5로 고친다.
  const first = slot(page, 'main');
  await writeQuotient(first, { 1: '1', 0: '3' });
  await writeProduct(first, 1, { 1: '6' });
  await writeDiff(first, 1, { 1: '2' });
  await submit(page);
  await expectFailedWithHint(page, '남은 수는 다음 자리로 내려 썼나요?');
  await writeDiff(first, 1, { 1: '2', 0: '3' });
  await writeProduct(first, 0, { 1: '1', 0: '8' });
  await writeDiff(first, 0, { 1: '0', 0: '5' });
  await submit(page);
  await expectPassed(page);

  // T2 — 미리 채운 12 … 11에서 이유를 잘못 골라 ①·②를 본 뒤 맞는 이유를 고른다.
  const why = field(page, 'why');
  await why.getByRole('button', { name: '나누는 수가 너무 커요', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '남은 11로 6접시에 하나씩 더 줄 수 있을까?');
  await submit(page);
  await expectFailedWithHint(page, '남은 수로 6을 한 번 더 나눌 수 있는지 보세요.', 2);
  await why.getByRole('button', { name: '나누는 수가 너무 커요', exact: true }).click();
  await why.getByRole('button', { name: '나머지가 6보다 커요', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 83÷6을 블록으로 나누고, 되감기 전에 제출해 ①·②를 본 뒤 되감고 83을 쓴다.
  const rewind = slot(page, 'main');
  await distribute83(page, rewind);
  await typeNumber(page, 'result', ['8', '3']);
  await submit(page);
  await expectFailedWithHint(page, '접시에 나눈 블록을 모두 무더기로 모아 보세요.');
  await submit(page);
  await expectFailedWithHint(page, '접시마다 블록 수를 막대로 보았어요.', 2);
  await expectOverlayInPanel(rewind, '[data-overlay="plate-levels"]');
  await rewind.getByRole('button', { name: '되감기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T4 — ÷7의 나머지 후보에서 7을 골라 ①을 본 뒤 1~6으로 고친다.
  const remainders = field(page, 'remainders');
  await remainders.getByRole('button', { name: '7', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '나머지가 7이면 7로 한 번 더 나눌 수 있을까?');
  await remainders.getByRole('button', { name: '7', exact: true }).click();
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await remainders.getByRole('button', { name: digit, exact: true }).click();
  }
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s2u2.A1', title: '십모형 해체 분배' },
    { id: 'g3s2u2.A2', title: '나머지 경고등과 되감기 검산' },
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
    console.log('g3s2u2 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
    if ((metrics?.pageHeight ?? 0) > (metrics?.viewportHeight ?? 0) + 1) {
      await expectContentPanelsReachable(page);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({
      ratio: 1,
    });
    if (item.id === 'g3s2u2.A1') {
      await expect(slot(page, 'left')).toBeInViewport({ ratio: 1 });
      await expect(slot(page, 'right')).toBeInViewport({ ratio: 1 });
    } else {
      await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g3s2u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s2u2.A1`);
  await expect(page.getByRole('heading', { name: '십모형 해체 분배' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '십모형 해체 분배' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
