import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T073 g6s1u3 「소수의 나눗셈」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
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

/**
 * 수 필드의 숫자판 버튼을 차례로 누른다.
 *
 * 키보드로 치면 E07 세로셈 격자의 window 키 처리기가 같은 숫자를 받아
 * 몫 칸에까지 써 넣는다. 그래서 응답은 화면 숫자판으로만 입력한다.
 */
async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  const keypad = responseSlot(page).locator(`[data-keypad-for="${id}"]`);
  for (const key of keys) {
    await keypad.getByRole('button', { name: key, exact: true }).click();
  }
}

async function clearNumber(page: Page, id: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
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

function engine(page: Page): Locator {
  return slot(page, 'main');
}

/** E01 나눗셈: 블록 이름 한 바퀴를 접시마다 똑같이 나눈다. */
async function dealRound(page: Page, name: '1' | '0.1' | '0.01'): Promise<void> {
  await engine(page)
    .getByRole('button', { name: `${name} 한 바퀴`, exact: true })
    .click();
}

/** 무더기에 남은 블록을 키보드로 풀어 한 단계 작은 블록으로 만든다. */
async function breakPileBlocks(page: Page, value: 100 | 10, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const block = page.locator(`[data-block-plate="pile"][data-block-value="${value}"]`).first();
    await block.focus();
    await page.keyboard.press('Enter');
  }
}

function grid(page: Page): Locator {
  return engine(page).getByTestId('column-grid');
}

function gridCell(page: Page, row: string, column: number, index?: number): Locator {
  const base = `[data-row="${row}"][data-column="${column}"]`;
  const selector = index === undefined ? base : `${base}[data-index="${index}"]`;
  return grid(page).locator(selector);
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

test('A1 십진 모형 세분화 — 대표 오답 뒤 고쳐서 세 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s1u3.A1', '십진 모형 세분화');
  await screenshot(page, 'g6s1u3-a1.png');

  // T1 — 한 바퀴만 나눈 채 확인해 힌트 ①을 본 뒤, 남은 판·막대를 풀어 끝까지 나눈다.
  await submit(page);
  await expectFailedWithHint(page, '막대 2개를 3접시에 나누면 한 접시에 막대가 몇 개씩 가지?');
  await dealRound(page, '1');
  await dealRound(page, '1');
  await breakPileBlocks(page, 10, 2);
  for (let index = 0; index < 8; index += 1) await dealRound(page, '0.01');
  await submit(page);
  await expectPassed(page);

  // T2 — 4.2를 5접시에 나누기 전에 확인해 힌트 ①을 보고, 판·막대·낱개를 차례로 푼다.
  await submit(page);
  await expectFailedWithHint(page, '판 4개를 5접시에 똑같이 놓을 수 있을까?');
  await breakPileBlocks(page, 100, 4);
  for (let index = 0; index < 8; index += 1) await dealRound(page, '0.1');
  await breakPileBlocks(page, 10, 2);
  for (let index = 0; index < 4; index += 1) await dealRound(page, '0.01');
  await submit(page);
  await expectPassed(page);

  // T3 — 3을 4접시에 나누며 판·막대·낱개를 모두 풀어 본다.
  await submit(page);
  await expectFailedWithHint(page, '남은 것을 더 작은 단위로 풀어서 나눌 수 있을까?');
  await breakPileBlocks(page, 100, 3);
  for (let index = 0; index < 7; index += 1) await dealRound(page, '0.1');
  await breakPileBlocks(page, 10, 2);
  for (let index = 0; index < 5; index += 1) await dealRound(page, '0.01');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 몫의 0을 찾는 소크라테스 코치 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g6s1u3.A2', '몫의 0을 찾는 소크라테스 코치');
  await screenshot(page, 'g6s1u3-a2.png');

  // T1 — 몫 열 -1을 비워 둔 2.4로 확인해 QUOTIENT-ZERO 힌트 ①을 본 뒤 0을 채워 2.04로 고친다.
  await typeGrid(page, '280');
  await gridCell(page, 'quotient', -2).click();
  await typeGrid(page, '4');
  await typeGrid(page, '16');
  await gridCell(page, 'div-product', -2, -2).click();
  await typeGrid(page, '6100');
  await submit(page);
  await expectFailedWithHint(page, '그 자리에서는 한 접시에 몇 개씩 갈까요?');
  await gridCell(page, 'quotient', -1).click();
  await typeGrid(page, '0');
  await placePoint(page, 0);
  await submit(page);
  await expectPassed(page);

  // T2 — 1.5에서 멈추고 0을 붙이지 않아 NO-EXTEND-ZERO를 만든 뒤 끝까지 나눈다.
  await typeGrid(page, '163530330');
  await placePoint(page, 0);
  await submit(page);
  await expectFailedWithHint(page, '남은 수를 더 작은 단위로 풀어서 나눌 수 있을까?');
  await appendZero(page);
  await gridCell(page, 'quotient', -2).click();
  await typeGrid(page, '500300');
  await submit(page);
  await expectPassed(page);

  // T3 — 소수점을 놓지 않아 POINT-PLACEMENT를 만든 뒤 일의 자리에 점을 놓는다.
  await typeGrid(page, '0095400');
  await submit(page);
  await expectFailedWithHint(page, '0.4쯤을 5로 나누면 대략 얼마?');
  await placePoint(page, 0);
  await submit(page);
  await expectPassed(page);

  // T4 — 친구의 2.8에서 빈 몫 칸을 표시하고, 2.8을 그대로 써서 QUOTIENT-ZERO를 만든 뒤 고친다.
  await gridCell(page, 'quotient', -1).click();
  await page.keyboard.press('f');
  await expect(gridCell(page, 'quotient', -1)).toHaveAttribute('data-flagged', 'true');
  await typeNumber(page, 'ans', ['2', '.', '8']);
  await submit(page);
  await expectFailedWithHint(page, '그 자리에서는 한 접시에 몇 개씩 갈까요?');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['2', '.', '0', '8']);
  await submit(page);
  await expectPassed(page);

  // T5 — 30쯤으로 어림해 힌트 ①을 본 뒤, 3쯤으로 고르고 3.25까지 나눈다.
  await choose(page, 'est', '30쯤');
  await submit(page);
  await expectFailedWithHint(page, '18쯤을 6으로 나누면 대략 얼마?');
  await choose(page, 'est', '3쯤');
  await typeGrid(page, '38110252130');
  await appendZero(page);
  await gridCell(page, 'quotient', -2).click();
  await typeGrid(page, '500300');
  await placePoint(page, 0);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판에서 판 안 스크롤 없이 확인하기에 닿는다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  // 두 활동 모두 첫 과제에는 응답 칸이 없다(엔진 조작만 하고 확인하기로 끝낸다).
  const cases = [
    { id: 'g6s1u3.A1', title: '십진 모형 세분화' },
    { id: 'g6s1u3.A2', title: '몫의 0을 찾는 소크라테스 코치' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    // E07 세로셈 판은 내용 높이를 쓰므로 판 안 스크롤 대신 페이지 스크롤로 확인한다.
    await expectContentPanelsReachable(page);
  }
});

test('오프라인에서도 g6s1u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s1u3.A1`);
  await expect(page.getByRole('heading', { name: '십진 모형 세분화' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '십진 모형 세분화' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
