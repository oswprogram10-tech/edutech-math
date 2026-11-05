import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T071 g5s2u4 「소수의 곱셈」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
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

/** 수 필드를 고른 뒤 키보드로 입력한다. 소수는 `.`도 그대로 친다. */
async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  for (const key of keys) await page.keyboard.press(key);
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

/** E04 넓이판의 한 변을 0.1씩 늘린다. 시작값은 슬라이더 Home 키로 0에 맞춘다. */
async function setFactor(page: Page, side: '가로' | '세로', tenths: number): Promise<void> {
  const slider = slot(page, 'main').getByRole('slider', { name: side });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < tenths; step += 1) await page.keyboard.press('ArrowRight');
}

async function expectFactor(page: Page, side: 'a' | 'b', value: string): Promise<void> {
  await expect(slot(page, 'main').getByTestId(`factor-${side}`)).toHaveText(value);
}

function grid(page: Page): Locator {
  return slot(page, 'main').getByTestId('column-grid');
}

function gridCell(page: Page, row: string, column: number): Locator {
  return grid(page).locator(`[data-row="${row}"][data-column="${column}"]`);
}

/** 결과 칸을 하나씩 골라 숫자를 쓴다(자동 진행에 기대지 않는다). */
async function writeResult(
  page: Page,
  entries: ReadonlyArray<readonly [number, string]>,
): Promise<void> {
  for (const [column, digit] of entries) {
    await gridCell(page, 'result', column).click();
    await page.keyboard.press(digit);
  }
}

async function placePoint(page: Page, column: number): Promise<void> {
  await gridCell(page, 'point', column).click();
}

async function addShift(page: Page, op: string): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: `${op} 만큼 옮기기` })
    .click();
}

test('A1 1×1 정사각형 안의 소수 곱셈 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g5s2u4.A1', '1×1 정사각형 안의 소수 곱셈');
  await screenshot(page, 'g5s2u4-a1.png');

  // T1 — 가로 4, 세로 0.3을 맞추고 1.2를 12.0으로 써서 소수점 위치 오류를 만든다.
  await setFactor(page, '가로', 40);
  await expectFactor(page, 'a', '4');
  await setFactor(page, '세로', 3);
  await expectFactor(page, 'b', '0.3');
  await typeNumber(page, 'ans', ['1', '2', '.', '0']);
  await submit(page);
  await expectFailedWithHint(page, '가로 4와 세로 0.3을 곱한 넓이가 1보다 클까요');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '.', '2']);
  await submit(page);
  await expectPassed(page);

  // T2 — 0.6 × 0.3이 0.6보다 크다고 골라 MC-MULT-ALWAYS-BIGGER를 만든 뒤 '작다'로 고친다.
  await setFactor(page, '가로', 6);
  await expectFactor(page, 'a', '0.6');
  await setFactor(page, '세로', 3);
  await expectFactor(page, 'b', '0.3');
  await typeNumber(page, 'ans', ['0', '.', '1', '8']);
  await choose(page, 'cmp', '크다');
  await submit(page);
  await expectFailedWithHint(page, '0.6의 0.3만큼이면 0.6 전체보다 클까요, 작을까요?');
  await choose(page, 'cmp', '작다');
  await submit(page);
  await expectPassed(page);

  // T3 — 그림만 보고 0.48을 4.8로 써서 소수점 위치 오류를 만든 뒤 고친다.
  await typeNumber(page, 'ans', ['4', '.', '8']);
  await submit(page);
  await expectFailedWithHint(page, '1.2의 0.4만큼이면 1.2보다 클까요, 작을까요?');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['0', '.', '4', '8']);
  await submit(page);
  await expectPassed(page);

  // T4 — 0.5 × 0.5가 0.5보다 크다고 고른 뒤 '절반' 까닭으로 고친다.
  await choose(page, 'cmp', '크다');
  await choose(page, 'why', '곱하면 수가 커지니까');
  await submit(page);
  await expectFailedWithHint(page, '0.5의 0.5만큼이면 0.5보다 클까요, 작을까요?');
  await choose(page, 'cmp', '작다');
  await choose(page, 'why', '0.5의 절반만큼을 구하는 셈이라서');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 소수점 기둥 시프트와 어림 검증 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g5s2u4.A2', '소수점 기둥 시프트와 어림 검증');
  await screenshot(page, 'g5s2u4-a2.png');
  const main = slot(page, 'main');

  // T1 — ×10을 '0 붙이기'로 처리해 3.75라고 써서 시프트 오개념을 만든 뒤 고친다.
  await typeNumber(page, 'x10', ['3', '.', '7', '5']);
  await submit(page);
  await expectFailedWithHint(page, '×10이면 크기가 10배가 되었을까요?');
  await clearNumber(page, 'x10');
  await typeNumber(page, 'x10', ['3', '7', '.', '5']);
  await typeNumber(page, 'x01', ['0', '.', '3', '7', '5']);
  await addShift(page, '×10');
  await addShift(page, '×0.1');
  await submit(page);
  await expectPassed(page);

  // T2 — 어림 3을 정하고 312를 쓴 뒤 점을 한 칸 왼쪽에 놓아 오개념을 만든다.
  await main.getByRole('button', { name: '3 어림값으로 쓰기' }).click();
  await main.getByTestId('decimal-estimate-lock').click();
  await grid(page).focus();
  for (const key of '2700420213') {
    await page.keyboard.press(key);
  }
  await placePoint(page, 1);
  await submit(page);
  await expectFailedWithHint(page, '2와 1쯤의 곱이니까 결과는 대략 얼마쯤이어야 할까요?');
  await placePoint(page, 2);
  await submit(page);
  await expectPassed(page);

  // T3 — b 카드를 소수점끼리 맞춰 놓아 ALIGN-POINT를 만든 뒤 오른쪽 끝으로 고친다.
  await page.getByTestId('card-b').click();
  await gridCell(page, 'top', 2).click();
  await submit(page);
  await expectFailedWithHint(page, '곱셈에서는 자연수처럼 계산한 다음 무엇으로 소수점을 정했지?');
  await page.getByTestId('card-b').click();
  await gridCell(page, 'top', 1).click();
  await writeResult(page, [
    [0, '0'],
    [1, '0'],
    [2, '1'],
    [3, '0'],
  ]);
  await placePoint(page, 3);
  await submit(page);
  await expectPassed(page);

  // T4 — 31.2를 골라 소수점 위치 오류를 만든 뒤 3.12로 고친다.
  await choose(page, 'pick', '31.2');
  await submit(page);
  await expectFailedWithHint(page, '2와 1쯤의 곱이니까 결과는 대략 얼마쯤이어야 할까요?');
  await choose(page, 'pick', '3.12');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g5s2u4.A1', title: '1×1 정사각형 안의 소수 곱셈' },
    { id: 'g5s2u4.A2', title: '소수점 기둥 시프트와 어림 검증' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g5s2u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s2u4.A1`);
  await expect(page.getByRole('heading', { name: '1×1 정사각형 안의 소수 곱셈' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '1×1 정사각형 안의 소수 곱셈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
