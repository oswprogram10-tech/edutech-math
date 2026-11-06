import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T075 g6s2u2 「소수의 나눗셈」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 240_000 });

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

function engine(page: Page): Locator {
  return slot(page, 'main');
}

/** 수 필드의 틀을 눌러 입력 대상으로 만든다(수 필드가 둘일 때 키패드 하나를 나눠 쓴다). */
async function activateNumber(page: Page, id: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
}

/**
 * 수 필드의 숫자판 버튼을 차례로 누른다.
 *
 * 키보드로 치면 E07 세로셈 격자의 window 키 처리기가 같은 숫자를 받아
 * 몫 칸에까지 써 넣는다. 그래서 응답은 화면 숫자판으로만 입력한다.
 */
async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  await activateNumber(page, id);
  const keypad = responseSlot(page).locator(`[data-keypad-for="${id}"]`);
  for (const key of keys) {
    await keypad.getByRole('button', { name: key, exact: true }).click();
  }
}

async function clearNumber(page: Page, id: string): Promise<void> {
  await activateNumber(page, id);
  await responseSlot(page)
    .locator(`[data-keypad-for="${id}"]`)
    .getByRole('button', { name: '모두 지우기' })
    .click();
}

async function choose(page: Page, id: string, label: string): Promise<void> {
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

function grid(page: Page): Locator {
  return engine(page).getByTestId('column-grid');
}

function gridCell(page: Page, row: string, column: number): Locator {
  return grid(page).locator(`[data-row="${row}"][data-column="${column}"]`);
}

/** 격자에 초점을 두고 숫자를 차례로 친다(엔진이 다음 칸으로 넘겨 준다). */
async function typeGrid(page: Page, keys: string): Promise<void> {
  await grid(page).focus();
  for (const key of keys) await page.keyboard.press(key);
}

async function placePoint(page: Page, column: number): Promise<void> {
  await gridCell(page, 'point', column).click();
}

/** 격자에 초점을 두고 0을 하나 붙인다. */
async function appendZero(page: Page): Promise<void> {
  await grid(page).focus();
  await page.keyboard.press('+');
}

/** 확대경 버튼으로 두 수를 함께 키운다. */
async function magnifyBoth(page: Page, factor: 10 | 100): Promise<void> {
  await engine(page).getByTestId('magnifier').locator(`[data-factor="${factor}"]`).click();
}

/** 격자 위 화살표로 두 수의 소수점을 같은 만큼 옮긴다. */
async function shiftBoth(page: Page, times: number): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await engine(page).getByTestId('scale-dividend-right').click();
    await engine(page).getByTestId('scale-divisor-right').click();
  }
}

/** E03 수직선에서 한 번 뛴다. 7.4m를 넘는 뛰기는 엔진이 막는다. */
async function hop(page: Page): Promise<void> {
  await engine(page).getByRole('button', { name: '한 번 뛰기', exact: true }).click();
}

test('A1 동시 10배 확대경 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s2u2.A1', '동시 10배 확대경');
  await screenshot(page, 'g6s2u2-a1.png');

  // T1 — 나누는 수만 화살표로 두 번 옮겨 1.68 ÷ 24로 몫을 한 자리 쓴 뒤 SCALE-ONE-SIDE 힌트 ①을 본다.
  await engine(page).getByTestId('scale-divisor-right').click();
  await engine(page).getByTestId('scale-divisor-right').click();
  await typeGrid(page, '7');
  await submit(page);
  await expectFailedWithHint(page, '막대 하나만 늘리면 몇 번 들어가는지가 그대로일까?');
  // 두 수를 함께 ×100 해 168 ÷ 24로 고친다.
  await magnifyBoth(page, 100);
  await typeGrid(page, '7861000');
  await submit(page);
  await expectPassed(page);

  // T2 — 한쪽만 ×10 하고 '처음과 같아요'를 골라 반례 힌트 ①을 본 뒤, '달라져요'로 고친다.
  await engine(page).getByTestId('magnifier').locator('[data-one-side="divisor"]').click();
  await choose(page, 'same', '처음과 같아요');
  await submit(page);
  await expectFailedWithHint(page, '막대 하나만 늘리면 몇 번 들어가는지가 그대로일까?');
  await choose(page, 'same', '처음과 달라져요');
  await submit(page);
  await expectPassed(page);

  // T3 — 4.5 ÷ 0.15를 소수점 두 칸씩 옮겨 450 ÷ 15로 만들고, 몫의 0을 빠뜨려 QUOTIENT-ZERO를 본다.
  await shiftBoth(page, 2);
  await typeGrid(page, '354000');
  await placePoint(page, 0);
  await submit(page);
  await expectFailedWithHint(page, '그 자리에서 몫이 몇이 되는지 생각해 볼까?');
  await typeGrid(page, '0');
  await submit(page);
  await expectPassed(page);

  // T4 — 2.73 ÷ 1.3을 27.3 ÷ 13으로 만들고, 점을 놓지 않아 POINT-PLACEMENT를 본다.
  await shiftBoth(page, 1);
  await typeGrid(page, '26210133100');
  await submit(page);
  await expectFailedWithHint(page, '2.7쯤을 1.3쯤으로 나누면 대략 얼마?');
  await placePoint(page, 0);
  await submit(page);
  await expectPassed(page);

  // T5 — 5 ÷ 0.4가 5보다 작다고 골라 ALWAYS-SMALLER를 본 뒤, 크다고 고치고 끝까지 나눈다.
  await choose(page, 'cmp', '작다');
  await submit(page);
  await expectFailedWithHint(page, '0.4가 5 안에 몇 번 들어갈까?');
  await choose(page, 'cmp', '크다');
  await shiftBoth(page, 1);
  await typeGrid(page, '14102802');
  await appendZero(page);
  await gridCell(page, 'quotient', -1).click();
  await typeGrid(page, '500200');
  await placePoint(page, 0);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 리본 자르기와 나머지 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s2u2.A2', '리본 자르기와 나머지');
  await screenshot(page, 'g6s2u2-a2.png');

  // T1 — 1.5m씩 네 번 뛰고, 남은 길이를 확대된 14로 써서 REMAINDER-SCALED를 본 뒤 1.4로 고친다.
  for (let index = 0; index < 4; index += 1) await hop(page);
  await typeNumber(page, 'pieces', ['4']);
  await typeNumber(page, 'left', ['1', '4', '.', '0']);
  await submit(page);
  await expectFailedWithHint(page, '리본이 14m나 남았을까?');
  await clearNumber(page, 'left');
  await typeNumber(page, 'left', ['1', '.', '4']);
  await submit(page);
  await expectPassed(page);

  // T2 — 74 ÷ 15의 나머지 칸 14를 그대로 써서 REMAINDER-SCALED를 본 뒤 1.4로 고친다.
  await shiftBoth(page, 1);
  await typeGrid(page, '40641');
  await typeNumber(page, 'left', ['1', '4', '.', '0']);
  await submit(page);
  await expectFailedWithHint(page, '리본이 14m나 남았을까?');
  await clearNumber(page, 'left');
  await typeNumber(page, 'left', ['1', '.', '4']);
  await submit(page);
  await expectPassed(page);

  // T3 — 검산식의 둘째 □에 14를 써서 REMAINDER-SCALED를 본 뒤 1.4로 고친다.
  await typeNumber(page, 'q', ['4']);
  await typeNumber(page, 'r', ['1', '4', '.', '0']);
  await submit(page);
  await expectFailedWithHint(page, '리본이 14m나 남았을까?');
  await clearNumber(page, 'r');
  await typeNumber(page, 'r', ['1', '.', '4']);
  await submit(page);
  await expectPassed(page);

  // T4 — 10 ÷ 3을 소수 둘째 자리까지 구하고, 반올림을 3.4로 잘못 써서 힌트 ①을 본 뒤 3.3으로 고친다.
  await typeGrid(page, '3901');
  await appendZero(page);
  await gridCell(page, 'quotient', -1).click();
  await typeGrid(page, '30901');
  await appendZero(page);
  await gridCell(page, 'quotient', -2).click();
  await typeGrid(page, '30901');
  await placePoint(page, 0);
  await typeNumber(page, 'round', ['3', '.', '4']);
  await submit(page);
  await expectFailedWithHint(page, '소수 둘째 자리 숫자를 보고 올릴지 버릴지 정해 볼까?');
  await clearNumber(page, 'round');
  await typeNumber(page, 'round', ['3', '.', '3']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판에서 판 안 스크롤 없이 응답 칸과 확인하기에 닿는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g6s2u2.A1', title: '동시 10배 확대경', hasResponse: false },
    { id: 'g6s2u2.A2', title: '리본 자르기와 나머지', hasResponse: true },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    // E07·응답 칸은 내용 높이를 쓰므로 판 안 스크롤 대신 페이지 스크롤로 확인한다.
    await expectContentPanelsReachable(page);
    if (item.hasResponse) await expect(responseSlot(page)).toBeVisible();
  }
});

test('오프라인에서도 g6s2u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u2.A1`);
  await expect(page.getByRole('heading', { name: '동시 10배 확대경' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '동시 10배 확대경' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
