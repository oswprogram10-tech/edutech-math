import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T062 g3s1u1 「덧셈과 뺄셈」 단원 E2E.
 * A1(블록+세로셈)·A2(어림 신호등)를 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
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

function cell(panel: Locator, row: string, column: number): Locator {
  return panel.locator(`[data-row="${row}"][data-column="${column}"]`);
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

async function writeRegroup(panel: Locator, column: number, digit: string): Promise<void> {
  await cell(panel, 'regroup', column).click();
  await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
}

async function breakBlock(page: Page, panel: Locator, value: number): Promise<void> {
  const block = panel.locator(`[data-block-value="${value}"]`).first();
  await block.focus();
  await page.keyboard.press('Enter');
}

/** 오버레이 svg 상자가 본 캔버스 상자와 1px 이내로 같은지. */
async function expectOverlayAligned(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
  const canvas = panel.getByTestId(canvasTestId);
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect
    .poll(
      async () => {
        const canvasBox = await canvas.boundingBox();
        const overlayBox = await overlay.locator('svg').boundingBox();
        if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(overlayBox.x - canvasBox.x),
          Math.abs(overlayBox.y - canvasBox.y),
          Math.abs(overlayBox.width - canvasBox.width),
          Math.abs(overlayBox.height - canvasBox.height),
        );
      },
      { message: `${overlayName} 오버레이가 본 캔버스와 어긋납니다.` },
    )
    .toBeLessThanOrEqual(1);
}

test('A1 백·십·일 블록과 세로셈 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u1.A1', '백·십·일 블록과 세로셈');
  await screenshot(page, 'g3s1u1-a1.png');
  const left = slot(page, 'left');
  const right = slot(page, 'right');

  // T1 — 풀지 않고 235를 써서 SMALLER-FROM-LARGER를 만난 뒤, 십을 풀고 225로 고친다.
  await writeResult(right, { 0: '5', 1: '3', 2: '2' });
  await submit(page);
  await expectFailedWithHint(page, '2개에서 7개를 덜어 낼 수 있을까?');
  await breakBlock(page, left, 10);
  await expect(cell(right, 'regroup', 1)).toHaveText('4');
  await writeResult(right, { 0: '5', 1: '2', 2: '2' });
  await submit(page);
  await expectPassed(page);

  // T2 — 백·십을 풀고도 결과를 266으로 써서 NO-DECREMENT를 만난 뒤 256으로 고친다.
  await breakBlock(page, left, 100);
  await breakBlock(page, left, 10);
  await writeResult(right, { 0: '6', 1: '6', 2: '2' });
  await submit(page);
  await expectFailedWithHint(page, '십 블록을 풀어 주었지?');
  await writeResult(right, { 0: '6', 1: '5', 2: '2' });
  await submit(page);
  await expectPassed(page);

  // T3 — 255를 써서 ACROSS-ZERO를 만나고, 한 번 더 틀려 ② 오버레이 정렬을 본 뒤
  // 백 → 십 순서로 풀고 245로 고친다.
  await writeResult(right, { 0: '5', 1: '5', 2: '2' });
  await submit(page);
  await expectFailedWithHint(page, '십의 자리에 풀 수 있는 블록이 있어?');
  await submit(page);
  await expectFailedWithHint(page, '백 블록 하나를 풀면 이렇게 돼요.', 2);
  await expectOverlayAligned(left, 'break-preview', 'base-ten-canvas');
  await breakBlock(page, left, 100);
  await breakBlock(page, left, 10);
  await expect(cell(right, 'regroup', 2)).toHaveText('3');
  await expect(cell(right, 'regroup', 1)).toHaveText('9');
  await writeResult(right, { 0: '5', 1: '4', 2: '2' });
  await submit(page);
  await expectPassed(page);

  // T4 — 733을 써서 NO-CARRY를 만난 뒤, 일→십·십→백으로 두 번 묶고 843을 쓴다.
  await writeResult(right, { 0: '3', 1: '3', 2: '7' });
  await submit(page);
  await expectFailedWithHint(page, '일의 자리 8과 5를 더하면 몇 개야?');
  await left.getByRole('button', { name: '10개 묶기' }).click();
  await left.getByRole('button', { name: '10개 묶기' }).click();
  // P 단계는 링크가 강조만 하므로 작은 칸은 학생이 직접 쓴다.
  await cell(right, 'carry', 1).click();
  await right.getByRole('button', { name: '1 쓰기' }).click();
  await cell(right, 'carry', 2).click();
  await right.getByRole('button', { name: '1 쓰기' }).click();
  await expect(cell(right, 'carry', 1)).toHaveText('1');
  await expect(cell(right, 'carry', 2)).toHaveText('1');
  await writeResult(right, { 0: '3', 1: '4', 2: '8' });
  await submit(page);
  await expectPassed(page);

  // T5 — 고친 수 5·9를 쓰고 345로 틀려 NO-DECREMENT를 만난 뒤 245로 고친다.
  const main = slot(page, 'main');
  await writeRegroup(main, 2, '5');
  await writeRegroup(main, 1, '9');
  await writeResult(main, { 0: '5', 1: '4', 2: '3' });
  await submit(page);
  await expectFailedWithHint(page, '백 블록을 풀었지?');
  await writeResult(main, { 0: '5', 1: '4', 2: '2' });
  await submit(page);
  await expectPassed(page, true);
});

test('A2 어림 신호등 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u1.A2', '어림 신호등');
  await screenshot(page, 'g3s1u1-a2.png');

  // T1 — 389를 300에 두고 700을 써서 일반 힌트를 만난 뒤, 400·400과 800으로 고친다.
  const main = slot(page, 'main');
  const canvas = main.getByTestId('number-line-canvas');
  await canvas.focus();
  await page.keyboard.press('1');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('2');
  await page.keyboard.press('ArrowLeft');
  await typeNumber(page, 'sum', ['7', '0', '0']);
  await submit(page);
  await expectFailedWithHint(page, '389는 300과 400 중 어디에 더 가까울까요?');
  await canvas.focus();
  await page.keyboard.press('1');
  await page.keyboard.press('ArrowRight');
  await retypeNumber(page, 'sum', ['8', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T2 — 어림 800을 정하고 791을 써서 NO-CARRY를 만난 뒤 801로 고친다.
  const estimate = slot(page, 'main');
  await estimate.getByTestId('estimate-cell').click();
  for (const digit of ['8', '0', '0']) {
    await estimate.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
  await estimate.getByTestId('estimate-lock').click();
  await writeResult(estimate, { 0: '1', 1: '9', 2: '7' });
  await submit(page);
  await expectFailedWithHint(page, '일의 자리 9와 2를 더하면 몇이에요?');
  await writeResult(estimate, { 0: '1', 1: '0', 2: '8' });
  await submit(page);
  await expectPassed(page);

  // T3 — 어림 200으로 정하고, 다시 확인 없이 제출해 일반 힌트를 본 뒤 다시 확인한다.
  const sample = slot(page, 'main');
  await sample.getByTestId('estimate-cell').click();
  for (const digit of ['2', '0', '0']) {
    await sample.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
  await sample.getByTestId('estimate-lock').click();
  await submit(page);
  await expectFailedWithHint(page, '512와 287은 각각 몇백에 가까운가요?');
  await sample.getByTestId('estimate-recheck').click();
  await submit(page);
  await expectPassed(page);

  // T4 — 엔진 없이 800과 '네'를 골라 일반 힌트를 만난 뒤 '아니요'로 고친다.
  await typeNumber(page, 'est', ['8', '0', '0']);
  await responseSlot(page).getByRole('button', { name: '네, 커요', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '428과 397은 각각 몇백에 가까운가요?');
  await responseSlot(page)
    .getByRole('button', { name: '아니요, 크지 않아요', exact: true })
    .click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s1u1.A1', title: '백·십·일 블록과 세로셈' },
    { id: 'g3s1u1.A2', title: '어림 신호등' },
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
    console.log('g3s1u1 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
    if (item.id === 'g3s1u1.A1') {
      // 세로셈 content 판이 크롬북 첫 화면(672px)을 넘는다.
      await expectContentPanelsReachable(page);
      await expect(responseSlot(page)).toHaveCount(0);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({
      ratio: 1,
    });
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    await expect(slot(page, 'main').getByTestId('number-line-canvas')).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g3s1u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s1u1.A1`);
  await expect(page.getByRole('heading', { name: '백·십·일 블록과 세로셈' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '백·십·일 블록과 세로셈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
