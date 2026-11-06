import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T061 g2s2u2 「곱셈구구」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
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

/** 분할선을 놓는다. snapHints [5]라 기본 자리는 5다. */
async function addSplit(page: Page, orientation: '가로' | '세로'): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: `${orientation} 분할선 놓기` })
    .click();
}

async function recordSplit(page: Page): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: '분할 기록하기' }).click();
}

/** 놓인 분할선을 골라 지운다. 다른 방향의 분할을 새로 놓기 전에 쓴다. */
async function removeSplit(page: Page, label: string): Promise<void> {
  const line = slot(page, 'main').getByRole('button', { name: label });
  await line.focus();
  await page.keyboard.press('Delete');
  await expect(line).toHaveCount(0);
}

/** 곱셈표 칸에 값을 넣는다. 엔진 키패드는 두 자리까지만 받는다. */
async function fillCell(
  page: Page,
  r: number,
  c: number,
  digits: readonly string[],
): Promise<void> {
  const panel = slot(page, 'main');
  const cell = panel.locator(`[data-cell="${r},${c}"]`);
  // SVG <g> 칸은 클릭 안정성 검사가 느릴 수 있어 키보드로 연다(엔진이 Enter를 받는다).
  await cell.focus();
  await page.keyboard.press('Enter');
  const keypad = panel.getByRole('group', { name: '숫자 넣기' });
  await expect(keypad).toBeVisible();
  for (const digit of digits) {
    await keypad.getByRole('button', { name: digit, exact: true }).click();
  }
  await keypad.getByRole('button', { name: '확인', exact: true }).click();
  await expect(keypad).toHaveCount(0);
}

async function selectCell(page: Page, r: number, c: number): Promise<void> {
  const cell = slot(page, 'main').locator(`[data-cell="${r},${c}"]`);
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
}

async function deselectCell(page: Page, r: number, c: number): Promise<void> {
  const cell = slot(page, 'main').locator(`[data-cell="${r},${c}"]`);
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
}

async function setSelectMode(page: Page, on: boolean): Promise<void> {
  const button = slot(page, 'main').getByRole('button', { name: /^칸 고르기$|^칸 고르는 중$/ });
  const pressed = await button.getAttribute('aria-pressed');
  if ((pressed === 'true') !== on) await button.click();
  await expect(button).toHaveAttribute('aria-pressed', on ? 'true' : 'false');
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

test('A1 무연필 배열판 분할 전략가 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s2u2.A1', '무연필 배열판 분할 전략가');
  await screenshot(page, 'g2s2u2-a1.png');
  const panel = slot(page, 'main');

  // T1 — 6×7을 5와 2로 나눈 뒤 한 조각만 세어 30이라고 써서
  // MC-MUL-SPLIT-PARTIAL-DROP을 만든다. 두 조각을 합친 42로 고친다.
  await addSplit(page, '세로');
  await expect(panel.getByRole('button', { name: '세로 분할선 5번째 자리' })).toHaveCount(1);
  await expect(panel.getByText('30')).toBeVisible();
  await expect(panel.getByText('12')).toBeVisible();
  await typeNumber(page, 'ans', ['3', '0']);
  await submit(page);
  await expectFailedWithHint(page, '나눈 두 부분을 모두 세었어');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['4', '2']);
  await submit(page);
  await expectPassed(page);

  // T2 — 7×8을 아는 곱으로 나누어 기록한 뒤, 7+8=15라고 써서
  // MC-MUL-ADD-CONFUSE를 만든다. 56으로 고친다.
  await addSplit(page, '세로');
  await recordSplit(page);
  await expect(panel.getByTestId('recorded-splits-badge')).toHaveText('1가지 분할을 기록했어요.');
  await typeNumber(page, 'ans', ['1', '5']);
  await submit(page);
  await expectFailedWithHint(page, '7이 몇 줄 있고');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['5', '6']);
  await submit(page);
  await expectPassed(page);

  // T3 — 서로 다른 두 방법(세로·가로)을 기록한 뒤, 8×9를 이웃 곱 63으로 써서
  // MC-MUL-FACT-NEIGHBOR를 만든다. 72로 고친다.
  await addSplit(page, '세로');
  await recordSplit(page);
  await removeSplit(page, '세로 분할선 5번째 자리');
  await addSplit(page, '가로');
  await recordSplit(page);
  await expect(panel.getByTestId('recorded-splits-badge')).toHaveText('2가지 분할을 기록했어요.');
  await typeNumber(page, 'ans', ['6', '3']);
  await submit(page);
  await expectFailedWithHint(page, '8×9는 8×8에서');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['7', '2']);
  await submit(page);
  await expectPassed(page);

  // T4 — 10줄에서 한 줄을 빼 9×6을 만든 뒤, 8×6=48이라고 써서
  // MC-MUL-FACT-NEIGHBOR를 만든다. 54로 고친다.
  await panel.getByRole('button', { name: '한 줄 늘이기' }).click();
  await expect(panel.getByTestId('extended-count')).toHaveText('1');
  await typeNumber(page, 'ans', ['4', '8']);
  await submit(page);
  await expectFailedWithHint(page, '9×6은 9×5에서');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['5', '4']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 곱셈표 대칭 색칠 보드 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s2u2.A2', '곱셈표 대칭 색칠 보드');
  await screenshot(page, 'g2s2u2-a2.png');

  // T1 — 4단 줄을 4부터 32까지 채우고 마지막 칸을 비워 틀린 뒤 36을 채운다.
  const row = [
    { c: 1, digits: ['4'] },
    { c: 2, digits: ['8'] },
    { c: 3, digits: ['1', '2'] },
    { c: 4, digits: ['1', '6'] },
    { c: 5, digits: ['2', '0'] },
    { c: 6, digits: ['2', '4'] },
    { c: 7, digits: ['2', '8'] },
    { c: 8, digits: ['3', '2'] },
  ] as const;
  for (const cell of row) await fillCell(page, 4, cell.c, cell.digits);
  await submit(page);
  await expectFailedWithHint(page, '4단에서 한 칸 오른쪽으로 가면 곱이 얼마씩 커질까요?');
  // 힌트 ①이 과제 정답 값(4·8·12…)을 그대로 알려 주지 않는다.
  const firstHint = page.getByTestId('hint-text');
  await expect(firstHint).not.toContainText('4, 8, 12');
  await expect(firstHint).not.toContainText('12');
  await expect(firstHint).not.toContainText('8');
  await fillCell(page, 4, 9, ['3', '6']);
  await submit(page);
  await expectPassed(page);

  // T2 — 4×7과 곱이 같은 칸으로 7×3을 골라 틀린 뒤, 대각선 너머 7×4로 고친다.
  await setSelectMode(page, true);
  await selectCell(page, 7, 3);
  await submit(page);
  await expectFailedWithHint(page, '곱셈표를 대각선으로 접으면');
  await deselectCell(page, 7, 3);
  await selectCell(page, 7, 4);
  await submit(page);
  await expectPassed(page);

  // T3 — 대각선으로 접어도 겹치지 않는다고 골라 틀린 뒤 '예'로 고친다.
  await toggleChoice(page, 'fold', '아니요');
  await submit(page);
  await expectFailedWithHint(page, '4×7 칸과 7×4 칸을');
  await toggleChoice(page, 'fold', '예');
  await submit(page);
  await expectPassed(page);

  // T4 — 1×5=6, 0×5=5, 5×0=5로 써서 MC-MUL-ZERO-ONE을 만든 뒤 5, 0, 0으로 고친다.
  await typeNumber(page, 'f1', ['6']);
  await typeNumber(page, 'f2', ['5']);
  await typeNumber(page, 'f3', ['5']);
  await submit(page);
  await expectFailedWithHint(page, '접시가 0개면');
  await clearNumber(page, 'f1');
  await clearNumber(page, 'f2');
  await clearNumber(page, 'f3');
  await typeNumber(page, 'f1', ['5']);
  await typeNumber(page, 'f2', ['0']);
  await typeNumber(page, 'f3', ['0']);
  await submit(page);
  await expectPassed(page);

  // T5 — 곱이 24인 칸을 두 개만 골라 틀린 뒤 네 칸을 모두 고르고 개수를 4로 고친다.
  // T3의 선택 모드는 과제가 바뀌면 꺼지므로 다시 켠다.
  await setSelectMode(page, true);
  await selectCell(page, 3, 8);
  await selectCell(page, 4, 6);
  await typeNumber(page, 'count', ['2']);
  await submit(page);
  await expectFailedWithHint(page, '24가 나오는 곱을');
  await selectCell(page, 6, 4);
  await selectCell(page, 8, 3);
  await clearNumber(page, 'count');
  await typeNumber(page, 'count', ['4']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g2s2u2.A1', title: '무연필 배열판 분할 전략가', response: true },
    { id: 'g2s2u2.A2', title: '곱셈표 대칭 색칠 보드', response: false },
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

test('오프라인에서도 g2s2u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s2u2.A1`);
  await expect(page.getByRole('heading', { name: '무연필 배열판 분할 전략가' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '무연필 배열판 분할 전략가' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
