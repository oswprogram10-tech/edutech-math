import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T055 g1s2u4 「덧셈과 뺄셈(2)」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 150_000 });

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

async function fillNumbers(page: Page, values: Readonly<Record<string, string>>): Promise<void> {
  for (const [id, value] of Object.entries(values)) {
    await typeNumber(page, id, [...value]);
  }
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

/**
 * 셈돌 상자의 n번째 셈돌을 텐프레임 첫 빈칸에 놓는다.
 * 셈돌 그림은 pointer-events가 꺼져 있어 가운데 클릭이 배경에 닿으므로 키보드로 조작한다.
 */
async function placeFromTray(panel: Locator, index: number): Promise<void> {
  await panel.getByRole('button', { name: `상자 ${index}번 셈돌` }).press('Enter');
}

/** 프레임의 n번째 칸에 있는 셈돌을 집어 낸다. */
async function takeOut(panel: Locator, frame: number, cell: number): Promise<void> {
  await panel.getByRole('button', { name: `${frame}번 프레임 ${cell}번 칸` }).press('Enter');
}

/** 지금 접시의 가르기를 기록한다. */
async function recordSplit(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '가르기 기록하기' }).click();
}

/** 첫 번째 접시에서 한 개를 두 번째 접시로 옮긴다. */
async function moveOne(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '1번 접시 칸막이 왼쪽으로 하나 옮기기' }).click();
}

/**
 * 합이 10이 되는 방울 두 개를 차례로 눌러 터뜨린다.
 * 방울은 떠다니는 애니메이션이 있어 클릭이 안정될 때까지 기다릴 수 없으므로 키보드로 고른다.
 */
async function popPair(panel: Locator, first: number, second: number): Promise<void> {
  await panel.getByRole('button', { name: `방울 ${first}`, exact: true }).press('Enter');
  await panel.getByRole('button', { name: `방울 ${second}`, exact: true }).press('Enter');
}

test('A1 스마트 텐프레임 10 채우기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g1s2u4.A1', '스마트 텐프레임 10 채우기');
  await screenshot(page, 'g1s2u4-a1.png');
  const panel = slot(page, 'main');

  // T1 — 4라고 답해 MC-MAKE10-PAIR를 만든 뒤, 3개를 넣어 10을 채우고 3으로 고친다.
  await typeNumber(page, 'n', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '빈칸이 몇 개 보여?');
  // 같은 오답을 한 번 더 내면 ② 빈칸 점선과 안내가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '빈칸에 점선 동그라미를 그렸어요. 몇 개인가요?', 2);
  await expect(panel.locator('svg')).toHaveCount(2);
  for (const index of [1, 2, 3]) await placeFromTray(panel, index);
  await expect(panel.getByRole('button', { name: '1번 프레임 10번 칸' })).toBeVisible();
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3']);
  await submit(page);
  await expectPassed(page);

  // T2 — 14라고 답해 MC-SUB-DIRECTION을 만든 뒤, 4개를 빼고 6으로 고친다.
  await typeNumber(page, 'n', ['1', '4']);
  await submit(page);
  await expectFailedWithHint(page, '뺀 뒤 남은 셈돌만 세어 볼까?');
  for (const cell of [1, 2, 3, 4]) await takeOut(panel, 1, cell);
  await expect(panel.getByRole('button', { name: '1번 프레임 4번 칸' })).toHaveCount(0);
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['6']);
  await submit(page);
  await expectPassed(page);

  // T3 — 기록 없이 제출해 틀린 뒤, 다섯 가지 가르기를 기록한다.
  await submit(page);
  await expectFailedWithHint(page, '한 접시에서 하나씩 옮기면 다른 방법이 생길까?');
  await recordSplit(panel);
  for (let index = 0; index < 4; index += 1) {
    await moveOne(panel);
    await recordSplit(panel);
  }
  await submit(page);
  await expectPassed(page);

  // T4 — 10이라고 답해 MC-THREE-ADDEND-SKIP을 만든 뒤, 10을 만들고 13으로 고친다.
  await typeNumber(page, 'n', ['1', '0']);
  await submit(page);
  await expectFailedWithHint(page, '수가 몇 개였지?');
  for (const index of [1, 2, 3, 4, 5, 6]) await placeFromTray(panel, index);
  await expect(panel.getByRole('button', { name: '1번 프레임 10번 칸' })).toBeVisible();
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['1', '3']);
  await submit(page);
  await expectPassed(page);

  // T5 — 엔진 없이 12라고 답해 틀린 뒤, 8로 고친다.
  await typeNumber(page, 'n', ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '10에서 몇을 빼면 2가 남을까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['8']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 10 짝꿍 방울 터뜨리기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u4.A2', '10 짝꿍 방울 터뜨리기');
  await screenshot(page, 'g1s2u4-a2.png');
  const panel = slot(page, 'main');

  // T1 — 아무것도 터뜨리지 않고 제출해 틀린 뒤, 네 쌍을 터뜨린다.
  await submit(page);
  await expectFailedWithHint(page, '10이 되는 두 수를 먼저 찾아볼까?');
  await popPair(panel, 1, 9);
  await popPair(panel, 2, 8);
  await popPair(panel, 3, 7);
  await popPair(panel, 4, 6);
  await expect(panel.getByRole('button', { name: '방울 4', exact: true })).toHaveCount(0);
  await submit(page);
  await expectPassed(page);

  // T2 — 엔진 없이 6이라고 답해 MC-MAKE10-PAIR를 만든 뒤, 5로 고친다.
  await fillNumbers(page, { n: '6' });
  await submit(page);
  await expectFailedWithHint(page, '5에 몇을 더하면 10이 될까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5']);
  await submit(page);
  await expectPassed(page);

  // T3 — 세 방울을 고르지 않고 제출해 틀린 뒤, 2·3·5를 모두 골라 터뜨린다.
  await submit(page);
  await expectFailedWithHint(
    page,
    '두 방울을 먼저 더하면 얼마일까? 10이 되려면 몇이 더 있어야 할까?',
  );
  for (const value of [2, 3, 5]) {
    await panel.getByRole('button', { name: `방울 ${value}`, exact: true }).press('Enter');
  }
  await expect(panel.getByRole('button', { name: '방울 5', exact: true })).toHaveCount(0);
  await submit(page);
  await expectPassed(page);

  // T4 — 연달아 터뜨리지 않고 제출해 틀린 뒤, 다섯 쌍을 연달아 터뜨린다.
  await submit(page);
  await expectFailedWithHint(page, '합이 10이 되는 방울을 먼저 찾아볼까?');
  await popPair(panel, 1, 9);
  await popPair(panel, 2, 8);
  await popPair(panel, 3, 7);
  // 4와 6은 방울이 둘씩 있어 각각 첫 번째를 고른다.
  await panel.getByRole('button', { name: '방울 4', exact: true }).first().press('Enter');
  await panel.getByRole('button', { name: '방울 6', exact: true }).first().press('Enter');
  // 마지막은 5와 5. 하나를 고른 뒤 남은 하나를 고른다.
  const fives = panel.getByRole('button', { name: '방울 5', exact: true });
  await fives.nth(0).press('Enter');
  await fives.nth(1).press('Enter');
  await expect(panel.getByRole('button', { name: '방울 5', exact: true })).toHaveCount(0);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    {
      id: 'g1s2u4.A1',
      title: '스마트 텐프레임 10 채우기',
      // 첫 과제에 수 응답 칸이 있어 키패드까지 첫 화면에 들어와야 한다.
      hasResponse: true,
      engine: (panel: Locator) => panel.getByRole('button', { name: '상자 1번 셈돌' }),
    },
    {
      id: 'g1s2u4.A2',
      title: '10 짝꿍 방울 터뜨리기',
      // 첫 과제는 방울만 터뜨리는 과제라 응답 칸이 없다(둘째 과제부터 수 응답).
      hasResponse: false,
      engine: (panel: Locator) => panel.getByRole('button', { name: /^방울/ }).first(),
    },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);

    // 64px 타깃이 켜진 상태에서 엔진 조작·확인하기가 모두 보여야 한다.
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(item.engine(slot(page, 'main'))).toBeInViewport({ ratio: 1 });
    if (item.hasResponse) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
      await expect(
        responseSlot(page).getByRole('button', { name: '1', exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g1s2u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s2u4.A1`);
  await expect(page.getByRole('heading', { name: '스마트 텐프레임 10 채우기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '스마트 텐프레임 10 채우기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
