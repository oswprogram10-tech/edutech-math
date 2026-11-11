import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T121 g6s2u5 「원의 둘레와 넓이」 A2 「원 등분 극한 직사각형」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * T5는 오개념 코드가 둘이라 활동을 새로 열어 실패 횟수를 되돌리고 R-D ①을 따로 본다.
 */

test.describe.configure({ timeout: 300_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

async function openActivity(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto('/#/activity/g6s2u5.A2');
  await expect(page.getByRole('heading', { name: '원 등분 극한 직사각형' })).toBeVisible();
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

/** 힌트 ② 오버레이가 엔진의 본 캔버스 svg와 같은 자리·크기에 놓였는지 확인한다. */
async function expectOverlayOverCanvas(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
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
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function typeDigits(page: Page, value: string): Promise<void> {
  for (const key of value) await page.keyboard.press(key);
}

/** 수 칸의 틀을 골라 그 자리에 바로 입력한다(정수·소수 틀). */
async function typePart(page: Page, id: string, part: string, value: string): Promise<void> {
  const box = field(page, id);
  await box.locator(`[data-part="${part}"]`).click();
  await typeDigits(page, value);
}

/** 자연수 틀로 바꿔 입력한다. 분수 틀이 기본인 칸에 쓴다. */
async function typeInteger(page: Page, id: string, value: string): Promise<void> {
  const box = field(page, id);
  const integerButton = box.getByRole('button', { name: '자연수', exact: true });
  if ((await integerButton.count()) > 0) await integerButton.click();
  await box.locator('[data-part="whole"]').click();
  await typeDigits(page, value);
}

/** 분수 틀: 분수 단추가 있으면 누르고 분자·분모를 차례로 넣는다. */
async function typeFraction(
  page: Page,
  id: string,
  numerator: string,
  denominator: string,
): Promise<void> {
  const box = field(page, id);
  const fractionButton = box.getByRole('button', { name: '분수', exact: true });
  if ((await fractionButton.count()) > 0) await fractionButton.click();
  await box.locator('[data-part="numerator"]').click();
  await typeDigits(page, numerator);
  await box.locator('[data-part="denominator"]').click();
  await typeDigits(page, denominator);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  const box = field(page, id);
  await box.focus();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Backspace');
}

function canvas(page: Page): Locator {
  return main(page).getByTestId('cut-canvas');
}

/** 부채꼴 조각 하나(원 자리·줄 자리 모두 `data-sector`로 찾는다). */
function sector(page: Page, index: number): Locator {
  return canvas(page).locator(`path[data-sector="${index}"]`);
}

/**
 * 조각을 골라(Enter) 줄의 slot 칸으로 옮기고(←/→) 필요하면 방향을 뒤집어(R)
 * 놓는다(Enter). 손 단계에서만 쓸 수 있다.
 */
async function placeSector(
  page: Page,
  index: number,
  target: number,
  flipped: boolean,
): Promise<void> {
  await sector(page, index).focus();
  await page.keyboard.press('Enter');
  for (let step = 0; step < target; step += 1) await page.keyboard.press('ArrowRight');
  if (flipped) await page.keyboard.press('r');
  await page.keyboard.press('Enter');
}

async function removeSector(page: Page, index: number): Promise<void> {
  await sector(page, index).focus();
  await page.keyboard.press('Delete');
}

async function autoArrange(page: Page): Promise<void> {
  await page.getByRole('button', { name: '자동으로 붙이기' }).click();
}

async function finer(page: Page, times: number): Promise<void> {
  for (let count = 0; count < times; count += 1) {
    await page.getByRole('button', { name: '더 잘게 나누기' }).click();
  }
}

/** 손 단계 8조각을 엇갈려 놓아 T1을 통과한다. */
async function solveT1(page: Page): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await placeSector(page, index, index, index % 2 === 1);
  }
  await expect(canvas(page)).toHaveAttribute('data-arranged', 'true');
  await submit(page);
  await expectPassed(page);
}

/** T2: 64등분까지 늘려 자동 배열하고 직사각형을 고른다. */
async function solveT2(page: Page): Promise<void> {
  await finer(page, 2);
  await expect(canvas(page)).toHaveAttribute('data-divisions', '64');
  await autoArrange(page);
  await choose(page, 'shape', '직사각형');
  await submit(page);
  await expectPassed(page);
}

/** T3: 16등분을 자동 배열하고 1/2을 쓴다. */
async function solveT3(page: Page): Promise<void> {
  await autoArrange(page);
  await typeFraction(page, 'w', '1', '2');
  await submit(page);
  await expectPassed(page);
}

/** T4: 16등분을 자동 배열하고 넓이 식을 고른다. */
async function solveT4(page: Page): Promise<void> {
  await autoArrange(page);
  await choose(page, 'f', '반지름 × 반지름 × 원주율');
  await submit(page);
  await expectPassed(page);
}

test('A2 원 등분 극한 직사각형 — 손 배열·자동 배열·가로·넓이 식·넓이', async ({ page }) => {
  await openActivity(page);
  await screenshot(page, 'g6s2u5-a2.png');
  // E11 판(960×640)이 크롬북 첫 화면 높이를 넘어 판 안쪽 스크롤이 생긴다.
  await expectContentPanelsReachable(page);

  // T1 — 8조각을 모두 같은 방향으로 놓아 일반 ①, 테두리 ② 뒤 홀수 칸만 뒤집어 통과.
  for (let index = 0; index < 8; index += 1) await placeSector(page, index, index, false);
  await expect(canvas(page)).toHaveAttribute('data-arranged', 'false');
  await submit(page);
  await expectFailedWithHint(page, '이웃한 두 조각의 둥근 쪽이 서로 반대로 놓였나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '놓은 조각들의 테두리를 보세요.', 2);
  await expectOverlayOverCanvas(main(page), 'work-outline', 'cut-canvas');

  for (const index of [1, 3, 5, 7]) {
    await removeSector(page, index);
    await placeSector(page, index, index, true);
  }
  await expect(canvas(page)).toHaveAttribute('data-arranged', 'true');
  await submit(page);
  await expectPassed(page);

  // T2 — 16등분을 자동 배열한 뒤 원을 골라 ①, 테두리 ②, 64등분으로 늘려 직사각형으로 통과.
  await expect(canvas(page)).toHaveAttribute('data-divisions', '16');
  await autoArrange(page);
  await expect(canvas(page)).toHaveAttribute('data-arranged', 'true');
  await choose(page, 'shape', '원');
  await submit(page);
  await expectFailedWithHint(page, '조각 수를 늘릴수록 위아래 테두리는 어떻게 바뀌나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '늘어놓은 조각들의 테두리 모양을 살펴보세요.', 2);
  await expectOverlayOverCanvas(main(page), 'work-outline', 'cut-canvas');

  await finer(page, 2);
  await expect(canvas(page)).toHaveAttribute('data-divisions', '64');
  await autoArrange(page);
  await choose(page, 'shape', '직사각형');
  await submit(page);
  await expectPassed(page);

  // T3 — 16등분을 자동 배열하고 가로를 1로 써 RECT-WIDTH ①, 위쪽 호 ②(정렬 검사), 1/2로 통과.
  await autoArrange(page);
  await typeInteger(page, 'w', '1');
  await submit(page);
  await expectFailedWithHint(page, '위쪽 줄에 놓인 호들은 원 둘레의 어느 부분일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '위쪽에 놓인 호들만 칠했어요.', 2);
  await expectOverlayOverCanvas(main(page), 'top-arcs', 'cut-canvas');

  await typeFraction(page, 'w', '1', '2');
  await submit(page);
  await expectPassed(page);

  // T4 — 16등분을 자동 배열하고 원주 식을 골라 ①, 둘레·넓이 ②, 바른 식으로 통과.
  await autoArrange(page);
  await choose(page, 'f', '반지름 × 2 × 원주율');
  await submit(page);
  await expectFailedWithHint(page, '이 식은 둘레의 길이인가요, 안쪽을 덮는 양인가요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '원 둘레와 원 안을 덮는 칸을 나란히 보았어요.', 2);
  await expectOverlayOverCanvas(main(page), 'rim-vs-cover', 'cut-canvas');

  await choose(page, 'f', '반지름 × 반지름 × 원주율');
  await submit(page);
  await expectPassed(page);

  // T5 — 원주 값 37.68을 내 AS-CIRC ①·②를 본 뒤, 활동을 새로 열어 R-D ①을 따로 본다.
  await typePart(page, 'area', 'decimal', '37.68');
  await submit(page);
  await expectFailedWithHint(page, '구한 값은 둘레의 길이인가요, 안쪽을 덮는 넓이인가요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '원을 잘라 늘어놓은 줄의 가로와 세로를 떠올려 보세요.', 2);

  await openActivity(page);
  await solveT1(page);
  await solveT2(page);
  await solveT3(page);
  await solveT4(page);
  await typePart(page, 'area', 'decimal', '452.16');
  await submit(page);
  await expectFailedWithHint(page, '늘어놓은 줄의 세로는 원의 어느 길이와 같았나요?', 1);
  await clearNumber(page, 'area');
  await typePart(page, 'area', 'decimal', '113.04');
  await submit(page);
  await expectPassed(page, true);
});

test('오프라인에서도 g6s2u5.A2 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u5.A2`);
  await expect(page.getByRole('heading', { name: '원 등분 극한 직사각형' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '원 등분 극한 직사각형' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
