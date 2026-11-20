import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';
import { expectControlsAboveFold } from '../controls-fold';

/**
 * T216: A1 「굴렁쇠 물감 굴리기」(E13 roll-circle) 묶음을 아래쪽에 더했다.
 * T121 g6s2u5 「원의 둘레와 넓이」 A2 「원을 잘라 늘어놓기」 단원 E2E.
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
  await expect(page.getByRole('heading', { name: '원을 잘라 늘어놓기' })).toBeVisible();
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

test('A2 원을 잘라 늘어놓기 — 손 배열·자동 배열·가로·넓이 식·넓이', async ({ page }, testInfo) => {
  await openActivity(page);
  await screenshot(page, 'g6s2u5-a2.png');
  // T122로 판이 실행기 판 높이에 맞춰 줄어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('cut-canvas')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

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
  await submit(page);
  await expectFailedWithHint(page, '줄의 세로를 원 그림에서 찾아 길이를 견주어 보세요.', 2);
  await clearNumber(page, 'area');
  await typePart(page, 'area', 'decimal', '113.04');
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T4 f-dd·f-dr 오답도 각각 힌트 ①을 준다', async ({ page }) => {
  await openActivity(page);
  await solveT1(page);
  await solveT2(page);
  await solveT3(page);

  // T4 — 지름 × 지름 식(f-dd)은 ① '줄의 세로는 원의 어느 길이와 같았나요?'
  await autoArrange(page);
  await choose(page, 'f', '지름 × 지름 × 원주율');
  await submit(page);
  await expectFailedWithHint(page, '줄의 세로는 원의 어느 길이와 같았나요?', 1);

  // 같은 과제에서 f-dr(지름 × 반지름 × 원주율)을 고르면 두 번째 실패라 ②가 이어진다.
  await choose(page, 'f', '지름 × 지름 × 원주율');
  await choose(page, 'f', '지름 × 반지름 × 원주율');
  await submit(page);
  await expectFailedWithHint(page, '위쪽에 놓인 호들만 칠했어요. 원 둘레와 견주어 보세요.', 2);
});

test('A2.T4 f-dr 오답은 첫 실패에서 힌트 ①을 준다', async ({ page }) => {
  await openActivity(page);
  await solveT1(page);
  await solveT2(page);
  await solveT3(page);
  await autoArrange(page);
  await choose(page, 'f', '지름 × 반지름 × 원주율');
  await submit(page);
  await expectFailedWithHint(page, '줄의 가로는 원주의 얼마였나요?', 1);
});

// ══ T216: A1 굴렁쇠 물감 굴리기 (E13 length roll-circle) ═══════════════════════════

async function openA1(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto('/#/activity/g6s2u5.A1');
  await expect(page.getByRole('heading', { name: '굴렁쇠 물감 굴리기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

const ROLL_ID = 'roll-canvas';

function rollBoard(page: Page): Locator {
  return main(page).getByTestId(ROLL_ID);
}

function btn(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleRoll(page: Page): Promise<void> {
  await rollBoard(page).scrollIntoViewIfNeeded();
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await rollBoard(page).boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

async function rollAndLog(page: Page, diameter: string, rows: number): Promise<void> {
  await btn(page, `지름 ${diameter}cm`).click();
  await btn(page, '굴리기').click();
  await btn(page, '기록하기').click();
  await expect(rollBoard(page).locator('[data-part="cell"]')).toHaveCount(rows * 3);
}

async function logThree(page: Page): Promise<void> {
  await rollAndLog(page, '2', 1);
  await rollAndLog(page, '5', 2);
  await rollAndLog(page, '10', 3);
}

async function solveA1T1(page: Page): Promise<void> {
  await settleRoll(page);
  await logThree(page);
  await submit(page);
  await expectPassed(page);
}

async function stickFour(page: Page): Promise<void> {
  await btn(page, '굴리기').click();
  for (let count = 0; count < 4; count += 1) await btn(page, '지름 막대 잇기').click();
}

async function solveA1T2(page: Page): Promise<void> {
  await settleRoll(page);
  await stickFour(page);
  await choose(page, 'pick', '나 3번과 조금');
  await submit(page);
  await expectPassed(page);
}

async function solveA1T3(page: Page): Promise<void> {
  await settleRoll(page);
  await logThree(page);
  await choose(page, 'pick', '나 모두 약 3.14');
  await submit(page);
  await expectPassed(page);
}

test('A1 굴렁쇠 물감 굴리기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openA1(page);
  await settleRoll(page);
  await expectContentPanelsReachable(page);
  await expectFitCanvasVisible(page);

  // T1 — 기록 없이 확인해 일반 ①②를 본 뒤, 세 지름을 굴려 기록한다.
  await submit(page);
  await expectFailedWithHint(page, '고른 굴렁쇠를 굴린 뒤 [기록하기]를 눌러야 표에 남아요.', 1);
  await submit(page);
  await expectFailedWithHint(page, '지름 단추를 바꿔 가며 세 번 굴려 봐요.', 2);
  await logThree(page);
  await submit(page);
  await expectPassed(page);

  // T2 — 막대 4개를 이은 뒤 가(딱 3번)를 골라 MC-CIRCLE-PI-EXACT ①, ②는 say(오버레이 없음).
  await settleRoll(page);
  await stickFour(page);
  await choose(page, 'pick', '가 딱 3번');
  await submit(page);
  await expectFailedWithHint(page, '기록표 값이 모두 똑같이 3.14였을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '기록표 값을 0.001까지 자세히 나누면', 2);
  await expect(main(page).locator('[data-overlay="pi-precision"]')).toHaveCount(0);
  await choose(page, 'pick', '나 3번과 조금');
  await submit(page);
  await expectPassed(page);

  // T3 — 세 줄 기록 뒤 가(모두 정확히 3.14)로 ①, ② pi-precision 오버레이(1px 정렬).
  await settleRoll(page);
  await logThree(page);
  await choose(page, 'pick', '가 모두 정확히 3.14');
  await submit(page);
  await expectFailedWithHint(page, '기록표 값이 모두 똑같이 3.14였을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '기록표 값을 0.001까지 자세히 나누면', 2);
  await expectOverlayOverCanvas(main(page), 'pi-precision', ROLL_ID);
  await choose(page, 'pick', '나 모두 약 3.14');
  await submit(page);
  await expectPassed(page);

  // T4 — 엔진은 숨겨져 있다. 10.99는 MC-GEO-RADIUS-DIAMETER ①②, 바른 값으로 통과.
  await expect(main(page)).toHaveCount(0);
  await typePart(page, 'c', 'decimal', '10.99');
  await submit(page);
  await expectFailedWithHint(page, '원주율은 원주와 무엇의 관계였지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '반지름이 아니라 지름으로 나눈 값', 2);
  await clearNumber(page, 'c');
  await typePart(page, 'c', 'decimal', '21.98');
  await submit(page);
  await expectPassed(page);

  // T5 — 5는 MC-GEO-RADIUS-DIAMETER ①, 10으로 통과.
  await expect(main(page)).toHaveCount(0);
  await typeInteger(page, 'd', '5');
  await submit(page);
  await expectFailedWithHint(page, '원주율은 원주와 무엇의 관계였지?', 1);
  await clearNumber(page, 'd');
  await typeInteger(page, 'd', '10');
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T2 다(4번)는 일반 전용 ①, T4 153.86은 일반 전용 ①을 준다', async ({ page }) => {
  await openA1(page);
  await solveA1T1(page);

  await settleRoll(page);
  await stickFour(page);
  await choose(page, 'pick', '다 4번');
  await submit(page);
  await expectFailedWithHint(page, '네 번째 막대가 물감 자국을 넘었는지 보세요.', 1);
  await choose(page, 'pick', '나 3번과 조금');
  await submit(page);
  await expectPassed(page);

  await solveA1T3(page);

  await typePart(page, 'c', 'decimal', '153.86');
  await submit(page);
  await expectFailedWithHint(page, '둘레의 길이를 구하는 거예요.', 1);
});

test('A1.T2를 키보드만으로 푼다', async ({ page }) => {
  await openA1(page);
  await solveA1T1(page);
  await settleRoll(page);
  await btn(page, '굴리기').focus();
  await page.keyboard.press('Enter');
  await btn(page, '지름 막대 잇기').focus();
  for (let count = 0; count < 4; count += 1) await page.keyboard.press('Enter');
  await field(page, 'pick').getByRole('button', { name: '나 3번과 조금', exact: true }).focus();
  await page.keyboard.press('Enter');
  await btn(page, '확인하기').focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

/** 화면 글·aria·data- 속성값을 모은 글(root 안). */
async function exposedIn(root: Locator): Promise<string> {
  return root.evaluate((element) => {
    const parts: string[] = [element.textContent ?? ''];
    for (const node of [element, ...Array.from(element.querySelectorAll('*'))]) {
      for (const attribute of Array.from(node.attributes)) {
        if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
          parts.push(attribute.value);
        }
      }
    }
    return parts.join('\n');
  });
}

test('A1 시작 화면 DOM·aria·data-에 원주·비·답이 없고 학년 표시도 없다', async ({ page }) => {
  const secret = /6\.3|9\.4|15\.7|25\.1|31\.4|3\.14|3\.15|3\.13|21\.98/;
  await openA1(page);
  await settleRoll(page);
  // T1 — 시작 화면 전체.
  expect(await exposedIn(page.locator('body'))).not.toMatch(secret);
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);
  await solveA1T1(page);
  // T2 — 굴리기 전 시작 화면 전체.
  await settleRoll(page);
  expect(await exposedIn(page.locator('body'))).not.toMatch(secret);
  await solveA1T2(page);
  // T3 — 발문에 보기 글로 3.14가 있으므로 판 안만 본다.
  await settleRoll(page);
  expect(await exposedIn(main(page))).not.toMatch(secret);
  await solveA1T3(page);
  // T4 — 엔진이 숨겨졌고 응답 칸에도 답이 없다.
  await expect(main(page)).toHaveCount(0);
  expect(await slot(page, 'response').textContent()).not.toMatch(/21\.98/);
});

test('A1 단추·응답 칸이 48px 이상이다(6학년)', async ({ page }) => {
  await openA1(page);
  await settleRoll(page);
  for (const name of [
    '지름 2cm',
    '지름 10cm',
    '굴리기',
    '지름 막대 잇기',
    '기록하기',
    '처음으로',
  ]) {
    await btn(page, name).scrollIntoViewIfNeeded();
    const box = await btn(page, name).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box?.height ?? 0, `${name} 높이`).toBeGreaterThanOrEqual(47.5);
    expect(box?.width ?? 0, `${name} 너비`).toBeGreaterThanOrEqual(47.5);
  }
  await solveA1T1(page);
  await settleRoll(page);
  const option = field(page, 'pick').getByRole('button', { name: '가 딱 3번', exact: true });
  await option.scrollIntoViewIfNeeded();
  const optionBox = await option.boundingBox();
  expect(optionBox?.height ?? 0).toBeGreaterThanOrEqual(47.5);
});

test('A1 첫 화면 기준 이미지(T1·T2)와 엔진이 보이는 과제의 조작 칸 첫 줄', async ({ page }) => {
  await openA1(page);
  await settleRoll(page);
  await screenshot(page, 'g6s2u5-a1t1.png');
  await expectControlsAboveFold(page, 'g6s2u5.A1.T1');
  await solveA1T1(page);

  await settleRoll(page);
  await screenshot(page, 'g6s2u5-a1t2.png');
  await expectControlsAboveFold(page, 'g6s2u5.A1.T2');
  await solveA1T2(page);

  await settleRoll(page);
  await expectControlsAboveFold(page, 'g6s2u5.A1.T3');
  await solveA1T3(page);

  // T4·T5는 엔진을 숨겨 조작 칸이 없다. 응답 칸과 확인하기만 본다.
  await expect(main(page)).toHaveCount(0);
  await expect(slot(page, 'response')).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

test('오프라인에서도 g6s2u5.A2 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u5.A2`);
  await expect(page.getByRole('heading', { name: '원을 잘라 늘어놓기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '원을 잘라 늘어놓기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
