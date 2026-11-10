import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T114 g4s1u2 「각도」 A1 「각도기 레이저 반사 퍼즐」·A2 「꼭짓점 잘라 모으기」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 오개념 ②는 오버레이가 그려지는 상태에서 한 번만 따로 확인한다(zero-gap 정렬 검사).
 */

test.describe.configure({ timeout: 180_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function mainCanvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('geo-canvas');
}

function cutCanvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('cut-canvas');
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

async function focusCanvas(page: Page, canvas = mainCanvas(page)): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let index = 0; index < times; index += 1) await page.keyboard.press(key);
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
 * 카드 공통 8: 단원마다 하나(zero-gap)만 1px 이내로 본다.
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

/** 각 n 단추. 정렬 카드 "각 n"과 이름이 겹치므로 엔진 판 안에서만 찾는다. */
async function chooseAngle(page: Page, number: number): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: `각 ${number}`, exact: true })
    .click();
}

/**
 * E09 스테퍼 값을 목표로 맞춘다. 처음 값은 "?"(0에서 시작)다.
 * 단추 이름은 "잰 각 10 늘리기"처럼 라벨+수량이다(NumberStepper).
 */
async function setStepper(
  page: Page,
  testId: string,
  label: string,
  target: number,
): Promise<void> {
  const stepper = slot(page, 'main').getByTestId(testId);
  const output = stepper.locator('output');
  let current = Number((await output.textContent())?.trim() ?? '');
  if (!Number.isFinite(current)) current = 0;
  let remaining = target - current;
  while (remaining !== 0) {
    const amount = Math.abs(remaining) >= 10 ? 10 : 1;
    const direction = remaining > 0 ? '늘리기' : '줄이기';
    await stepper.getByRole('button', { name: `${label} ${amount} ${direction}` }).click();
    remaining += remaining > 0 ? -amount : amount;
  }
  await expect(output).toHaveText(String(target));
}

/** 각도기를 지금 각에 올리거나 내린다. Enter는 올리기/내리기를 번갈아 한다. */
async function placeProtractor(page: Page): Promise<void> {
  await focusCanvas(page);
  await page.keyboard.press('Enter');
}

/** 각도기를 내리고 각 n으로 옮겨 다시 올린다. 회전은 그대로 남는다. */
async function switchAngle(page: Page, number: number): Promise<void> {
  await focusCanvas(page);
  await page.keyboard.press('Enter');
  await chooseAngle(page, number);
  await focusCanvas(page);
  await page.keyboard.press('Enter');
}

/** 회전을 0°로 되돌린다(1°씩). 4° 스냅을 피하려고 방향키만 쓴다. */
async function resetRotation(page: Page, current: number): Promise<void> {
  await focusCanvas(page);
  let remaining = current;
  while (remaining >= 15) {
    await page.keyboard.press('Shift+ArrowLeft');
    remaining -= 15;
  }
  await press(page, 'ArrowLeft', remaining);
}

/** 응답 수 칸에 숫자를 친다. */
async function typeNumber(page: Page, id: string, digits: string): Promise<void> {
  const box = slot(page, 'response').locator(`[data-response-field="${id}"]`);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const digit of digits) await page.keyboard.press(digit);
}

async function choose(page: Page, fieldId: string, label: string): Promise<void> {
  const field = slot(page, 'response').locator(`[data-response-field="${fieldId}"]`);
  await field.getByRole('button', { name: label, exact: true }).click();
}

/** E11 각 조각을 차례로 잘라 모은다. Enter는 모으기/빼기를 번갈아 한다. */
async function gatherAllCorners(page: Page, count: number): Promise<void> {
  const panel = slot(page, 'main');
  await panel.getByRole('button', { name: '꼭짓점 자르기', exact: true }).click();
  for (let index = 1; index <= count; index += 1) {
    const corner = panel.getByRole('button', { name: `${index}번 각 조각`, exact: true });
    await corner.focus();
    await expect(corner).toBeFocused();
    await page.keyboard.press('Enter');
  }
}

/** 새 시도로 모양 단계에 돌아가 3번 꼭짓점을 오른쪽으로 옮긴다. */
async function newTrialAndMoveApex(page: Page, steps: number): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: '모양 바꿔 다시 하기', exact: true })
    .click();
  const apex = slot(page, 'main').getByRole('button', { name: '3번 꼭짓점', exact: true });
  await apex.focus();
  await press(page, 'ArrowRight', steps);
}

test('A1 각도기 — 대표 오답 뒤 고쳐서 여섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u2.A1', '각도기 레이저 반사 퍼즐');
  await screenshot(page, 'g4s1u2-a1.png');

  // T1 — a1에 각도기를 올리고 돌리지 않은 채 60°를 읽어 ZERO-LINE ①을 본 뒤,
  // 세 각을 차례로 맞춰 읽어 통과한다.
  await placeProtractor(page);
  await setStepper(page, 'reading-stepper', '잰 각', 60);
  await submit(page);
  await expectFailedWithHint(page, '각도기의 0° 선이 각의 변과 겹쳐 있어?');
  await focusCanvas(page);
  await press(page, 'Shift+ArrowRight');
  await press(page, 'ArrowRight', 5);
  await setStepper(page, 'reading-stepper', '잰 각', 40);
  await switchAngle(page, 2);
  await resetRotation(page, 20);
  await setStepper(page, 'reading-stepper', '잰 각', 115);
  await switchAngle(page, 3);
  await setStepper(page, 'reading-stepper', '잰 각', 70);
  await submit(page);
  await expectPassed(page);

  // T2 — 어림을 먼저 적고 재어서 통과한다.
  await expect(
    page.getByText('각도기를 올리기 전에 크기를 어림해 보세요.', { exact: false }),
  ).toBeVisible();
  await placeProtractor(page);
  await setStepper(page, 'estimate-stepper', '어림한 각', 30);
  await setStepper(page, 'reading-stepper', '잰 각', 25);
  await switchAngle(page, 2);
  await setStepper(page, 'estimate-stepper', '어림한 각', 140);
  await setStepper(page, 'reading-stepper', '잰 각', 150);
  await submit(page);
  await expectPassed(page);

  // T3 — 여섯 각을 예각·직각·둔각으로 나눈다.
  await expect(page.getByText('여섯 각을 보고', { exact: false })).toBeVisible();
  const response = slot(page, 'response');
  const sortCards: readonly [string, string][] = [
    ['각 1', '예각'],
    ['각 2', '직각'],
    ['각 3', '둔각'],
    ['각 4', '예각'],
    ['각 5', '둔각'],
    ['각 6', '직각'],
  ];
  for (const [card, bin] of sortCards) {
    await response.getByRole('button', { name: `${card} 옮길 카드로 고르기`, exact: true }).click();
    await response.getByRole('button', { name: `${bin} 여기에 놓기`, exact: true }).click();
  }
  await submit(page);
  await expectPassed(page);

  // T4 — 어림한 뒤 45°로 쏘아 WRONG-SCALE ①을 보고, 135°로 고쳐 별에 맞힌다.
  await expect(
    page.getByText('별에 닿도록 발사 각을 정해 쏘아 보세요.', { exact: false }),
  ).toBeVisible();
  await placeProtractor(page);
  await setStepper(page, 'launch-estimate-stepper', '어림한 발사 각', 130);
  await setStepper(page, 'launch-stepper', '발사 각', 45);
  await page.getByRole('button', { name: '쏘기', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '한 변이 0°에 맞은 눈금은 안쪽이야, 바깥쪽이야?');
  await setStepper(page, 'launch-stepper', '발사 각', 135);
  await page.getByRole('button', { name: '쏘기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T5 — 각도의 합과 차를 계산한다. 수 필드가 둘이라 키패드 하나를 함께 쓴다.
  await expect(page.getByText('두 각도의 합과 차를 계산해 보세요.')).toBeVisible();
  await typeNumber(page, 'sum', '105');
  await typeNumber(page, 'diff', '65');
  await submit(page);
  await expectPassed(page);

  // T6 — 변이 긴 각 1을 골라 SIDE-LENGTH ①을 본 뒤, 각 2로 고쳐 통과한다.
  await expect(page.getByText('두 각 중 어느 각이 더 클까요?', { exact: false })).toBeVisible();
  await choose(page, 'cmp', '각 1이 더 커요');
  await submit(page);
  await expectFailedWithHint(page, '각의 크기는 변의 길이일까, 벌어진 정도일까?');
  await choose(page, 'cmp', '각 2가 더 커요');
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T1 ZERO-LINE ② zero-gap이 판과 1px 이내로 겹친다', async ({ page }) => {
  await openActivity(page, 'g4s1u2.A1', '각도기 레이저 반사 퍼즐');
  await placeProtractor(page);
  await setStepper(page, 'reading-stepper', '잰 각', 60);
  await submit(page);
  await expectFailedWithHint(page, '각도기의 0° 선이 각의 변과 겹쳐 있어?');
  await submit(page);
  await expectFailedWithHint(page, '각도기의 0° 선과 각의 변 사이의 틈을 빨갛게 표시했어요.', 2);
  const gap = await expectOverlayOverCanvas(slot(page, 'main'), 'zero-gap', 'geo-canvas');
  await expect(gap.locator('path')).not.toHaveCount(0);
});

test('A1.T1 WRONG-SCALE ①은 바깥쪽 눈금을 읽은 오답에서 나온다', async ({ page }) => {
  await openActivity(page, 'g4s1u2.A1', '각도기 레이저 반사 퍼즐');
  await chooseAngle(page, 3);
  await placeProtractor(page);
  await setStepper(page, 'reading-stepper', '잰 각', 110);
  await submit(page);
  await expectFailedWithHint(page, '한 변이 0°에 맞은 눈금은 안쪽이야, 바깥쪽이야?');
});

test('A2 꼭짓점 잘라 모으기 — 예측 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u2.A2', '꼭짓점 잘라 모으기');
  await screenshot(page, 'g4s1u2-a2.png');

  // T1 — 기본 삼각형의 세 각을 모아 통과한다.
  await gatherAllCorners(page, 3);
  await expect(cutCanvas(page)).toHaveAttribute('data-fan', 'straight');
  await expect(page.getByTestId('angle-sum')).toContainText('180°');
  await submit(page);
  await expectPassed(page);

  // T2 — 서로 다른 삼각형 세 개를 모은 뒤, '더 커져요'를 골라 SUM-SHAPE ①을 보고
  // '똑같아요'로 고쳐 통과한다.
  await expect(page.getByText('삼각형을 크게 바꾼 뒤', { exact: false })).toBeVisible();
  await gatherAllCorners(page, 3);
  await newTrialAndMoveApex(page, 2);
  await gatherAllCorners(page, 3);
  await newTrialAndMoveApex(page, 2);
  await gatherAllCorners(page, 3);
  await choose(page, 'p', '더 커져요');
  await submit(page);
  await expectFailedWithHint(page, '아까 작은 삼각형에선 몇 °였지? 큰 삼각형에서도 모아 볼까?');
  await choose(page, 'p', '똑같아요');
  await submit(page);
  await expectPassed(page);

  // T3 — 사각형 네 각을 모아 한 바퀴가 되는지 확인한다.
  await expect(page.getByText('사각형의 네 꼭짓점을 잘라', { exact: false })).toBeVisible();
  await gatherAllCorners(page, 4);
  await expect(cutCanvas(page)).toHaveAttribute('data-fan', 'full');
  await expect(page.getByTestId('angle-sum')).toContainText('360°');
  await submit(page);
  await expectPassed(page);

  // T4 — 삼각형의 나머지 한 각을 계산한다.
  await expect(page.getByText('두 각이 50°, 75°인 삼각형', { exact: false })).toBeVisible();
  await typeNumber(page, 'rest', '55');
  await submit(page);
  await expectPassed(page);

  // T5 — 사각형의 나머지 한 각을 계산한다.
  await expect(page.getByText('세 각이 80°, 95°, 70°인 사각형', { exact: false })).toBeVisible();
  await typeNumber(page, 'rest', '115');
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T2 SUM-SHAPE ② trial-compare가 기록한 시도를 보여 준다', async ({ page }) => {
  await openActivity(page, 'g4s1u2.A2', '꼭짓점 잘라 모으기');
  // T1에는 응답 칸이 없으므로 먼저 모아서 통과한 뒤 T2로 넘어간다.
  await gatherAllCorners(page, 3);
  await submit(page);
  await expectPassed(page);
  await expect(page.getByText('삼각형을 크게 바꾼 뒤', { exact: false })).toBeVisible();
  await gatherAllCorners(page, 3);
  await choose(page, 'p', '더 커져요');
  await submit(page);
  await expectFailedWithHint(page, '아까 작은 삼각형에선 몇 °였지? 큰 삼각형에서도 모아 볼까?');
  await submit(page);
  await expectFailedWithHint(page, '모양이 다른 삼각형을 나란히 그려 보았어요.', 2);
  await expect(slot(page, 'main').locator('[data-overlay="trial-compare"]')).toBeVisible();
});

test('첫 화면에 엔진·확인하기가 들어온다', async ({ page }) => {
  await openActivity(page, 'g4s1u2.A1', '각도기 레이저 반사 퍼즐');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  await expect(mainCanvas(page)).toBeVisible();
  await expect(page.getByTestId('reading-stepper')).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();

  await openActivity(page, 'g4s1u2.A2', '꼭짓점 잘라 모으기');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  await expect(cutCanvas(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

test('오프라인에서도 g4s1u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s1u2.A1`);
  await expect(page.getByRole('heading', { name: '각도기 레이저 반사 퍼즐' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '각도기 레이저 반사 퍼즐' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
