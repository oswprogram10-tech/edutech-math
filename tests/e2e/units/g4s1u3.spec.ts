import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T068 g4s1u3 「곱셈과 나눗셈」 단원 E2E.
 * A1(배수 높이 어림 바)·A2(세 자리 × 두 자리 칸 코칭)를 과제마다
 * 대표 오답 또는 불완전한 풀이 → 힌트 ① → 정답 순서로 끝낸다.
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

/** iPad WebKit에서 클릭 안정성 검사가 흔들릴 때를 위해 DOM 클릭으로 칸을 고른다. */
async function tap(locator: Locator): Promise<void> {
  await locator.evaluate((node) => (node as HTMLElement).click());
}

function divCell(panel: Locator, row: string, column: number, index?: number): Locator {
  const indexPart = index === undefined ? '' : `[data-index="${index}"]`;
  return panel.locator(`[data-row="${row}"]${indexPart}[data-column="${column}"]`);
}

function mulCell(panel: Locator, row: string, column: number, index?: number): Locator {
  const indexPart = index === undefined ? '' : `[data-index="${index}"]`;
  return panel.locator(`[data-row="${row}"]${indexPart}[data-column="${column}"]`);
}

async function writeDivCell(
  panel: Locator,
  row: string,
  column: number,
  digit: string,
  index?: number,
): Promise<void> {
  await tap(divCell(panel, row, column, index));
  await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
}

async function writeDivRow(
  panel: Locator,
  row: string,
  index: number | undefined,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await writeDivCell(panel, row, Number(column), digit, index);
  }
}

async function writeMulCell(
  panel: Locator,
  row: string,
  column: number,
  digit: string,
  index?: number,
): Promise<void> {
  await tap(mulCell(panel, row, column, index));
  await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
}

async function writeMulRow(
  panel: Locator,
  row: string,
  index: number | undefined,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await writeMulCell(panel, row, Number(column), digit, index);
  }
}

async function chooseLadder(panel: Locator, k: number, status?: string): Promise<void> {
  await panel.getByRole('button', { name: `${k}배`, exact: true }).click();
  if (status !== undefined) {
    await expect(panel.getByText(status)).toBeVisible();
  }
  await panel.getByRole('button', { name: `${k}을 몫으로 정하기`, exact: true }).click();
}

async function flagCell(
  panel: Locator,
  row: string,
  column: number,
  index?: number,
): Promise<void> {
  await tap(mulCell(panel, row, column, index));
  await panel.getByRole('button', { name: /틀린 칸을 골라/ }).click();
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

test('A1 배수 높이 어림 바 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u3.A1', '배수 높이 어림 바');
  await screenshot(page, 'g4s1u3-a1.png');

  // T1 — q3·69·26으로 REMAINDER-TOO-BIG ①·②를 본 뒤 4·92·3으로 고친다.
  const first = slot(page, 'main');
  await writeDivCell(first, 'quotient', 0, '3');
  await writeDivRow(first, 'div-product', 0, { 1: '6', 0: '9' });
  await writeDivRow(first, 'div-diff', 0, { 1: '2', 0: '6' });
  await submit(page);
  await expectFailedWithHint(page, '남은 수로 23을 한 번 더 나눌 수 있을까?');
  await submit(page);
  await expectFailedWithHint(page, '남은 수와 나누는 수를 나란히 보았어요.', 2);
  await expectOverlayInPanel(first, '[data-testid="overlay-remainder-vs-divisor"]');
  await writeDivCell(first, 'quotient', 0, '4');
  await writeDivRow(first, 'div-product', 0, { 1: '9', 0: '2' });
  await writeDivRow(first, 'div-diff', 0, { 1: '0', 0: '3' });
  await submit(page);
  await expectPassed(page);

  // T2 — 8로 어림해 ESTIMATE-OFF ①을 본 뒤, 8→7 사다리에서 '딱 맞아요'를 확인하고 푼다.
  const second = slot(page, 'main');
  await tap(divCell(second, 'quotient', 0));
  await chooseLadder(second, 8);
  await submit(page);
  await expectFailedWithHint(page, '몫 후보가 선을 넘었는지, 모자랐는지 살펴보세요.');
  await tap(divCell(second, 'quotient', 0));
  await chooseLadder(second, 7, '선에 딱 맞아요');
  await writeDivRow(second, 'div-product', 0, { 2: '1', 1: '6', 0: '8' });
  await writeDivRow(second, 'div-diff', 0, { 2: '0', 1: '0', 0: '0' });
  await submit(page);
  await expectPassed(page);

  // T3 — 빈 줄로 제출해 일반 ①을 본 뒤 두 단계를 채운다.
  const third = slot(page, 'main');
  await writeDivCell(third, 'quotient', 1, '2');
  await submit(page);
  await expectFailedWithHint(page, '몫을 어느 자리부터 쓸 수 있을까요? 5를 27로 나눌 수 있나요?');
  await writeDivRow(third, 'div-product', 1, { 2: '5', 1: '4' });
  await writeDivRow(third, 'div-diff', 1, { 2: '0', 1: '4', 0: '9' });
  await writeDivCell(third, 'quotient', 0, '1');
  await writeDivRow(third, 'div-product', 0, { 2: '0', 1: '2', 0: '7' });
  await writeDivRow(third, 'div-diff', 0, { 2: '0', 1: '2', 0: '2' });
  await submit(page);
  await expectPassed(page);

  // T4 — 몫의 일의 자리를 비워 QUOTIENT-ZERO ①·②를 본 뒤 0을 쓴다.
  const fourth = slot(page, 'main');
  await writeDivCell(fourth, 'quotient', 1, '2');
  await writeDivRow(fourth, 'div-product', 1, { 2: '8', 1: '0' });
  await writeDivRow(fourth, 'div-diff', 1, { 2: '0', 1: '1', 0: '5' });
  await submit(page);
  await expectFailedWithHint(page, '남은 수를 40으로 나눌 수 있었어? 그럼 몫의 그 자리에는?');
  await submit(page);
  await expectFailedWithHint(page, '몫의 빈 자리를 깜빡여 보았어요.', 2);
  await expectOverlayInPanel(fourth, '[data-testid="overlay-quotient-gap"]');
  await writeDivCell(fourth, 'quotient', 0, '0');
  await submit(page);
  await expectPassed(page);

  // T5 — A 단계. 몫의 일의 자리 0을 써서 마친다.
  const fifth = slot(page, 'main');
  await writeDivCell(fifth, 'quotient', 1, '2');
  await writeDivRow(fifth, 'div-product', 1, { 2: '7', 1: '2' });
  await writeDivRow(fifth, 'div-diff', 1, { 2: '0', 1: '1', 0: '9' });
  await submit(page);
  await expectFailedWithHint(page, '남은 수를 36으로 나눌 수 있었어? 그럼 몫의 그 자리에는?');
  await writeDivCell(fifth, 'quotient', 0, '0');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 세 자리 × 두 자리 칸 코칭 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u3.A2', '세 자리 × 두 자리 칸 코칭');
  await screenshot(page, 'g4s1u3-a2.png');

  // T1 — 받아올림을 빠뜨린 2042·6940·8982로 NO-CARRY ①·②를 본 뒤 고친다.
  const left = slot(page, 'left');
  const right = slot(page, 'right');
  await expect(left.getByTestId('array-canvas')).toBeVisible();
  await writeMulRow(right, 'partial', 0, { 3: '2', 2: '0', 1: '4', 0: '2' });
  await writeMulRow(right, 'partial', 1, { 3: '6', 2: '9', 1: '4' });
  await writeMulRow(right, 'result', undefined, { 3: '8', 2: '9', 1: '8', 0: '2' });
  await submit(page);
  await expectFailedWithHint(page, '이 자리에서 10이 넘은 수는 어디로 갔을까?');
  await submit(page);
  await expectFailedWithHint(page, '자리마다 숫자가 나타내는 수를 보여 줘요.', 2);
  await expectOverlayInPanel(right, '[data-testid="overlay-place-value"]');
  await writeMulCell(right, 'partial', 1, '8', 0);
  await writeMulRow(right, 'result', undefined, { 3: '9', 2: '0', 1: '2', 0: '2' });
  await submit(page);
  await expectPassed(page);

  // T2 — 둘째 줄을 밀지 않은 1524로 PARTIAL-SHIFT ①·②를 본 뒤 15240으로 고친다.
  const second = slot(page, 'main');
  await writeMulRow(second, 'partial', 0, { 3: '2', 2: '0', 1: '3', 0: '2' });
  await writeMulRow(second, 'partial', 1, { 3: '1', 2: '5', 1: '2', 0: '4' });
  await writeMulRow(second, 'result', undefined, { 3: '3', 2: '5', 1: '5', 0: '6' });
  await submit(page);
  await expectFailedWithHint(page, '34의 3은 얼마를 나타낼까요?');
  await submit(page);
  await expectFailedWithHint(page, '자리를 밀어야 하는 줄의 빈칸을 점선으로 보았어요.', 2);
  await expectOverlayInPanel(second, '[data-testid="overlay-partial-shift"]');
  await writeMulRow(second, 'partial', 1, { 4: '1', 3: '5', 2: '2', 1: '4', 0: '0' });
  await writeMulRow(second, 'result', undefined, { 4: '1', 3: '7', 2: '2', 1: '7', 0: '2' });
  await submit(page);
  await expectPassed(page);

  // T3 — 표시 없이 제출해 일반 ①을 본 뒤 틀린 칸 하나만 표시한다.
  const debug = slot(page, 'main');
  await submit(page);
  await expectFailedWithHint(page, '26의 2는 얼마를 나타낼까요?');
  await flagCell(debug, 'partial', 0, 1);
  await submit(page);
  await expectPassed(page);

  // T4 — 약 100000을 골라 ①을 본 뒤 약 10000으로 고친다.
  const approx = field(page, 'approx');
  await approx.getByRole('button', { name: '약 100000', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '498과 21은 각각 몇백, 몇십에 가까운가요?');
  await approx.getByRole('button', { name: '약 10000', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g4s1u3.A1', title: '배수 높이 어림 바' },
    { id: 'g4s1u3.A2', title: '세 자리 × 두 자리 칸 코칭' },
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
    console.log('g4s1u3 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
    if ((metrics?.pageHeight ?? 0) > (metrics?.viewportHeight ?? 0) + 1) {
      await expectContentPanelsReachable(page);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    if (item.id === 'g4s1u3.A1') {
      await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    } else {
      await expect(slot(page, 'left')).toBeInViewport({ ratio: 1 });
      await expect(slot(page, 'right')).toBeInViewport({ ratio: 1 });
    }
  }
});

test('배수 사다리 168÷24에서 8 다음 7을 고르면 estimateRevised가 켜진다', async ({ page }) => {
  const config = {
    mode: 'div',
    dividend: 168,
    divisor: 24,
    estimateBar: { show: 'C-P', maxMultiple: 9 },
  };
  const query = `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`${query}#/sandbox/E07`);
  await expect(page.getByRole('heading', { name: '세로셈 격자' })).toBeVisible();
  await page.getByLabel('모드').selectOption('div');
  await expect(page.getByTestId('column-grid')).toHaveAttribute('data-mode', 'div');

  await tap(page.locator('[data-row="quotient"][data-column="0"]'));
  await page.getByRole('button', { name: '8배', exact: true }).click();
  await expect(page.getByText('선을 넘었어요')).toBeVisible();
  await page.getByRole('button', { name: '7배', exact: true }).click();
  await expect(page.getByText('선에 딱 맞아요')).toBeVisible();
  await page.getByRole('button', { name: '7을 몫으로 정하기', exact: true }).click();

  await expect
    .poll(async () => {
      const text = await page.getByTestId('observation').textContent();
      const observation = JSON.parse(text ?? '{}') as Record<string, unknown>;
      return observation['estimateRevised'] === true && observation['quotient'] === '7';
    })
    .toBe(true);
});

test('오프라인에서도 g4s1u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s1u3.A1`);
  await expect(page.getByRole('heading', { name: '배수 높이 어림 바' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '배수 높이 어림 바' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
