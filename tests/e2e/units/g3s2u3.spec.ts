import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T113 g3s2u3 「원」 A1 「말뚝과 밧줄」·A2 「가장 긴 선분 찾기와 컴퍼스 무늬」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 밧줄을 72칸 돌리는 과제라 기본 30초로는 모자란다.
test.describe.configure({ timeout: 180_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function canvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('geo-canvas');
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

async function focusCanvas(page: Page): Promise<void> {
  const board = canvas(page);
  await board.focus();
  await expect(board).toBeFocused();
}

async function chooseTool(page: Page, label: string): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: label, exact: true }).click();
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let index = 0; index < times; index += 1) await page.keyboard.press(key);
}

async function choose(page: Page, fieldId: string, label: string): Promise<void> {
  const field = slot(page, 'response').locator(`[data-response-field="${fieldId}"]`);
  await field.getByRole('button', { name: label, exact: true }).click();
}

/** 수 입력 칸을 눌러 자판 입력을 받은 뒤 숫자를 친다. */
async function typeNumber(page: Page, id: string, digits: string): Promise<void> {
  const box = slot(page, 'response').locator(`[data-response-field="${id}"]`);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const digit of digits) await page.keyboard.press(digit);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  const box = slot(page, 'response').locator(`[data-response-field="${id}"]`);
  await box.getByRole('button').first().click();
  await slot(page, 'response').getByRole('button', { name: '모두 지우기' }).click();
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
 * 힌트 ② 오버레이가 엔진의 본 캔버스 svg와 같은 자리·크기에 놓였는지 확인한다.
 */
async function expectOverlayOverCanvas(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<Locator> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const board = panel.getByTestId(canvasTestId);
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').boundingBox();
      const canvasBox = await board.boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  await expect(overlay.locator('svg')).toHaveCount(1);
  return overlay;
}

/** 밧줄을 한 바퀴 돌려 95% 이상 덮는다. 69칸이면 floor(69×100/72)=95. */
async function traceFullRope(page: Page): Promise<void> {
  await focusCanvas(page);
  await press(page, 'Enter');
  await press(page, 'ArrowRight', 68);
}

test('A1 말뚝과 밧줄 — 대표 오답 뒤 고쳐서 세 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u3.A1', '말뚝과 밧줄');
  await screenshot(page, 'g3s2u3-a1.png');

  // T1 — 30칸만 돌려 힌트 ①을 본 뒤, 지우고 69칸을 돌려 통과한다.
  await focusCanvas(page);
  await press(page, 'ArrowRight', 30);
  await submit(page);
  await expectFailedWithHint(page, '한 바퀴를 다 돌았나요? 점이 빠진 곳이 있나요?');
  await focusCanvas(page);
  await page.keyboard.press('Delete');
  await traceFullRope(page);
  await submit(page);
  await expectPassed(page);

  // T2 — 반지름 2개만 긋고 힌트 ①을 본 뒤, 하나 더 긋고 길이를 재서 통과한다.
  await expect(
    page.getByText('원 위의 점에서 말뚝까지 선분을 3개 긋고 길이를 재 보세요.', {
      exact: false,
    }),
  ).toBeVisible();
  await chooseTool(page, '반지름');
  await focusCanvas(page);
  await press(page, 'Enter');
  await press(page, 'm');
  await press(page, 'ArrowRight', 4);
  await press(page, 'Enter');
  await press(page, 'm');
  await submit(page);
  await expectFailedWithHint(page, '원 위의 다른 곳에서도 그어 보았나요? 길이를 모두 재 보았나요?');
  await focusCanvas(page);
  await press(page, 'ArrowRight', 4);
  await press(page, 'Enter');
  await press(page, 'm');
  await choose(page, 'same', '모두 같아요');
  await submit(page);
  await expectPassed(page);

  // T3 — 밧줄 4칸·6칸으로 각각 한 바퀴를 돌린 뒤, '원의 모양'을 골라
  // 힌트 ①을 보고 '원의 크기'로 고쳐 통과한다.
  await expect(page.getByText('이번에는 밧줄이 더 길어요.', { exact: false })).toBeVisible();
  await traceFullRope(page);
  await focusCanvas(page);
  await page.keyboard.press(']');
  await traceFullRope(page);
  await choose(page, 'change', '원의 모양');
  await submit(page);
  await expectFailedWithHint(page, '앞에서 그린 원과 견주어 보면 무엇이 달라졌나요?');
  await choose(page, 'change', '원의 크기');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 가장 긴 선분과 컴퍼스 무늬 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u3.A2', '가장 긴 선분 찾기와 컴퍼스 무늬');
  await screenshot(page, 'g3s2u3-a2.png');
  const panel = slot(page, 'main');

  // T1 — 중심을 지나지 않는 선분을 만들어 MC-GEO-DIAMETER-ANY-CHORD ①·②를
  // 본 뒤(chord-gap 정렬 확인), 선분을 반대 자리로 옮겨 통과한다.
  await chooseTool(page, '선분');
  await focusCanvas(page);
  await press(page, 'ArrowRight', 3);
  await submit(page);
  await expectFailedWithHint(page, '이 선분보다 더 길게 만들 수 있을까요?');
  await submit(page);
  await expectFailedWithHint(page, '원의 중심에서 선분까지 떨어진 거리를 표시했어요.', 2);
  const gap = await expectOverlayOverCanvas(panel, 'chord-gap', 'geo-canvas');
  await expect(gap.locator('line')).not.toHaveCount(0);
  await expect(gap).toContainText('중심에서 떨어져 있어요');
  await focusCanvas(page);
  await press(page, 'ArrowRight', 4);
  await submit(page);
  await expectPassed(page);

  // T2 — 반지름 3칸인 원의 지름에 3을 넣어 MC-GEO-RADIUS-DIAMETER ①을 본 뒤, 6으로 고친다.
  await expect(page.getByText('이 원의 지름은 몇 칸일까요?', { exact: false })).toBeVisible();
  await typeNumber(page, 'd', '3');
  await submit(page);
  await expectFailedWithHint(page, '지름은 반지름 몇 개를 이어 붙인 길이일까요?');
  await clearNumber(page, 'd');
  await typeNumber(page, 'd', '6');
  await submit(page);
  await expectPassed(page);

  // T3 — 지름 10cm인 원의 반지름에 20을 넣어 MC-GEO-RADIUS-DIAMETER ①을 본 뒤, 5로 고친다.
  await expect(page.getByText('이 원의 반지름은 몇 cm일까요?', { exact: false })).toBeVisible();
  await typeNumber(page, 'r', '20');
  await submit(page);
  await expectFailedWithHint(page, '지름은 반지름 몇 개를 이어 붙인 길이일까요?');
  await clearNumber(page, 'r');
  await typeNumber(page, 'r', '5');
  await submit(page);
  await expectPassed(page);

  // T4 — 컴퍼스 폭을 6으로 넓혀 MC-GEO-COMPASS-WIDTH ①을 본 뒤, 폭을 3으로 되돌리고
  // 무늬의 세 원을 차례로 그려 통과한다.
  await expect(page.getByText('제시된 무늬와 똑같이 컴퍼스로 원을 그려요.')).toBeVisible();
  await chooseTool(page, '컴퍼스');
  await focusCanvas(page);
  await page.keyboard.press('p');
  await press(page, 'ArrowRight', 5);
  await page.keyboard.press('Enter');
  await submit(page);
  await expectFailedWithHint(page, '컴퍼스 침에서 연필까지가 원의 어느 부분이 될까요?');

  await panel.getByRole('button', { name: '그린 원 1 지우기', exact: true }).click();
  await focusCanvas(page);
  await page.keyboard.press('p');
  await press(page, 'ArrowLeft', 3);
  await page.keyboard.press('n');
  await press(page, 'ArrowLeft', 3);
  await page.keyboard.press('Enter');
  await press(page, 'ArrowRight', 3);
  await page.keyboard.press('Enter');
  await press(page, 'ArrowRight', 3);
  await page.keyboard.press('Enter');
  await submit(page);
  await expectPassed(page, true);
});

test('첫 화면에 엔진·확인하기가 들어온다', async ({ page }) => {
  // E09 circle 판은 세로가 길어 앱 스크롤로 '확인하기'에 닿는지 본다.
  await openActivity(page, 'g3s2u3.A1', '말뚝과 밧줄');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();

  await openActivity(page, 'g3s2u3.A2', '가장 긴 선분 찾기와 컴퍼스 무늬');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

test('오프라인에서도 g3s2u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s2u3.A1`);
  await expect(page.getByRole('heading', { name: '말뚝과 밧줄' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '말뚝과 밧줄' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
