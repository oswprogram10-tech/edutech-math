import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectNoPanelInnerScroll } from '../panel-layout';
import { logicalToScreen } from '../canvas-point';

/**
 * T050 g1s1u1 「9까지의 수」 단원 E2E.
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

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function undo(page: Page, times = 1): Promise<void> {
  const button = page.getByRole('button', { name: '되돌리기' });
  for (let index = 0; index < times; index += 1) await button.click();
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

/** 소환 선반의 숫자 버튼(1~9)을 눌러 셈돌을 놓는다. */
async function summon(panel: Locator, count: number): Promise<void> {
  await panel.getByRole('button', { name: String(count), exact: true }).click();
}

/** 소환 선반의 셈돌을 첫 번째부터 지운다(키보드 Delete). */
async function removeCounters(page: Page, panel: Locator, times: number): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await panel
      .getByRole('button', { name: /번째 셈돌$/ })
      .first()
      .focus();
    await page.keyboard.press('Delete');
  }
}

/** 플래시 과제에서 '보기'를 누르고 셈돌이 가려질 때까지 기다린다. */
async function flash(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '보기', exact: true }).click();
  await expect(panel).toContainText('사라졌어요', { timeout: 5_000 });
}

/** 텐프레임 상자의 셈돌을 키보드 Enter로 빈칸에 놓는다. */
async function fillFrame(page: Page, panel: Locator, times: number): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await panel
      .getByRole('button', { name: /^상자 \d+번 셈돌$/ })
      .first()
      .focus();
    await page.keyboard.press('Enter');
  }
}

/** 수직선의 눈금 하나를 논리 좌표로 눌러 점을 찍거나 카드를 놓는다. */
async function tapTick(page: Page, value: string): Promise<void> {
  const canvas = page.getByTestId('number-line-canvas');
  const tick = canvas.locator(`[data-tick-value="${value}"]`).first();
  const x = Number(await tick.getAttribute('data-tick-x'));
  const box = await canvas.boundingBox();
  if (!box) throw new Error('수직선 캔버스 크기를 알 수 없습니다.');
  const point = logicalToScreen(box, x, 300);
  await page.mouse.click(point.x, point.y);
}

async function placeCard(page: Page, panel: Locator, card: string, value: string): Promise<void> {
  await panel.getByRole('button', { name: `카드 ${card}`, exact: true }).click();
  await tapTick(page, value);
}

test('A1 손가락 수 소환 선반 — 대표 오답 뒤 고쳐서 여섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u1.A1', '손가락 수 소환 선반');
  await screenshot(page, 'g1s1u1-a1.png');
  const panel = slot(page, 'main');

  // T1 — 5개를 놓아 틀린 뒤, 되돌려 4개로 고친다.
  await summon(panel, 5);
  await submit(page);
  await expectFailedWithHint(page, '하나씩 손으로 짚어 볼까?');
  await undo(page);
  await summon(panel, 4);
  await submit(page);
  await expectPassed(page);

  // T2 — 3개를 놓고 4라고 답해 MC-COUNT-ONE-TO-ONE을 만든 뒤, 3으로 고친다.
  await summon(panel, 3);
  await typeNumber(page, 'n', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '하나씩 손으로 짚어 볼까?');
  // 같은 오답을 한 번 더 내면 ② 번호 붙인 셈돌과 안내가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '번호가 붙은 셈돌을 다시 세어 볼까?', 2);
  await expect(panel.locator('svg')).toHaveCount(2);
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3']);
  await submit(page);
  await expectPassed(page);

  // T3 — 8개를 놓아 틀린 뒤, 되돌려 7개로 고친다.
  await summon(panel, 8);
  await submit(page);
  await expectFailedWithHint(page, '하나씩 손으로 짚어 볼까?');
  await undo(page);
  await summon(panel, 7);
  await submit(page);
  await expectPassed(page);

  // T4 — 5개를 놓아 틀린 뒤, 되돌려 6개로 고친다.
  await summon(panel, 5);
  await submit(page);
  await expectFailedWithHint(page, '물고기를 하나씩 짚으면서 셈돌을 놓아 볼까?');
  await undo(page);
  await summon(panel, 6);
  await submit(page);
  await expectPassed(page);

  // T5 — 사과 3개에서 시작해 그대로 제출해 틀린 뒤, 모두 없앤다.
  await submit(page);
  await expectFailedWithHint(page, '휴지통에 사과를 넣어 볼까?');
  await removeCounters(page, panel, 3);
  await submit(page);
  await expectPassed(page);

  // T6 — 엔진 없이 수 카드에서 4를 골라 틀린 뒤, 5로 고친다.
  const pick = responseSlot(page);
  await pick.getByRole('button', { name: '4', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '하나씩 손으로 짚어 볼까?');
  await pick.getByRole('button', { name: '5', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('A2 번쩍! 한눈에 세기 — 대표 오답 뒤 고쳐서 여섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u1.A2', '번쩍! 한눈에 세기');
  await screenshot(page, 'g1s1u1-a2.png');
  const panel = slot(page, 'main');

  // T1 — 주사위 눈 3개를 보고 4라고 답해 틀린 뒤, 3으로 고친다.
  await flash(panel);
  await typeNumber(page, 'n', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '몇 개씩 묶여 보였나요?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3']);
  await submit(page);
  await expectPassed(page);

  // T2 — 주사위 눈 5개를 보고 6이라고 답해 틀린 뒤, 5로 고친다.
  await flash(panel);
  await typeNumber(page, 'n', ['6']);
  await submit(page);
  await expectFailedWithHint(page, '몇 개씩 묶여 보였나요?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5']);
  await submit(page);
  await expectPassed(page);

  // T3 — 텐프레임 7개를 보고 8이라고 답해 틀린 뒤, 7로 고친다.
  await flash(panel);
  await typeNumber(page, 'n', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '몇 개씩 묶여 보였나요?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['7']);
  await submit(page);
  await expectPassed(page);

  // T4 — 텐프레임 9개를 보고 8이라고 답해 틀린 뒤, 9로 고친다.
  await flash(panel);
  await typeNumber(page, 'n', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '몇 개씩 묶여 보였나요?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['9']);
  await submit(page);
  await expectPassed(page);

  // T5 — 흩어진 점 4개를 보고 5라고 답해 틀린 뒤, 4로 고친다.
  await flash(panel);
  await typeNumber(page, 'n', ['5']);
  await submit(page);
  await expectFailedWithHint(page, '몇 개씩 묶여 보였나요?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['4']);
  await submit(page);
  await expectPassed(page);

  // T6 — 텐프레임에 5개만 놓아 틀린 뒤, 6개로 채운다.
  await fillFrame(page, panel, 5);
  await submit(page);
  await expectFailedWithHint(page, '위 줄을 다 채우면 몇 개일까?');
  await fillFrame(page, panel, 1);
  await submit(page);
  await expectPassed(page, true);
});

test('A3 수 징검다리 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u1.A3', '수 징검다리');
  await screenshot(page, 'g1s1u1-a3.png');
  const panel = slot(page, 'main');

  // T1 — 카드 3을 4 자리에 놓아 틀린 뒤, 3·6·8을 제자리에 놓는다.
  await placeCard(page, panel, '3', '4');
  await submit(page);
  await expectFailedWithHint(page, '0부터 하나씩 세면서 눈금을 짚어 볼까?');
  await placeCard(page, panel, '3', '3');
  await placeCard(page, panel, '6', '6');
  await placeCard(page, panel, '8', '8');
  await submit(page);
  await expectPassed(page);

  // T2 — 5에 점을 찍어 틀린 뒤, 두 번째 실패에서 거리 막대를 보고 6으로 고친다.
  await tapTick(page, '5');
  await submit(page);
  await expectFailedWithHint(page, '5에서 오른쪽으로 한 칸 가면 어디일까?');
  await submit(page);
  await expectFailedWithHint(page, '0에서 점까지 얼마나 떨어져 있는지 보세요.', 2);
  await expect(page.getByTestId('overlay-distance-from-zero')).toBeVisible();
  await undo(page);
  await tapTick(page, '6');
  await submit(page);
  await expectPassed(page);

  // T3 — 8에 점을 찍어 틀린 뒤, 되돌려 6으로 고친다.
  await tapTick(page, '8');
  await submit(page);
  await expectFailedWithHint(page, '7에서 왼쪽으로 한 칸 가면 어디일까?');
  await undo(page);
  await tapTick(page, '6');
  await submit(page);
  await expectPassed(page);

  // T4 — 1에 점을 찍어 두 번 틀린 뒤, ②를 보고 되돌려 0으로 고친다.
  await tapTick(page, '1');
  await submit(page);
  await expectFailedWithHint(page, '사과가 하나도 없으면 몇 개라고 하지?');
  await submit(page);
  await expectFailedWithHint(
    page,
    '사과가 하나씩 줄어들어 모두 없어지면 몇이 될까? 수직선에서 찾아볼까?',
    2,
  );
  await undo(page);
  await tapTick(page, '0');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g1s1u1.A1', title: '손가락 수 소환 선반', response: false },
    { id: 'g1s1u1.A2', title: '번쩍! 한눈에 세기', response: true },
    { id: 'g1s1u1.A3', title: '수 징검다리', response: false },
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

test('오프라인에서도 g1s1u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s1u1.A1`);
  await expect(page.getByRole('heading', { name: '손가락 수 소환 선반' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '손가락 수 소환 선반' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
