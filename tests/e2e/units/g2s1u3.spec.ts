import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T058 g2s1u3 「덧셈과 뺄셈」 단원 E2E.
 * A1만 만든다(A2 양팔저울은 W5). 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

test.describe.configure({ timeout: 120_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
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

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '1');
  await expect(page.getByTestId('hint-text')).toContainText(text);
}

async function expectHintLevel(page: Page, level: string): Promise<void> {
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', level);
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

function cell(panel: Locator, row: string, column: number): Locator {
  return panel.locator(`[data-row="${row}"][data-column="${column}"]`);
}

/** 결과 칸을 하나씩 골라 숫자를 쓴다. 열 번호는 일의 자리 0, 십의 자리 1이다. */
async function writeResult(
  panel: Locator,
  digits: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [column, digit] of Object.entries(digits)) {
    await cell(panel, 'result', Number(column)).click();
    await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

/** 고친 수 칸(빼기)을 골라 숫자를 쓴다. */
async function writeRegroup(panel: Locator, column: number, digit: string): Promise<void> {
  await cell(panel, 'regroup', column).click();
  await panel.getByRole('button', { name: `${digit} 쓰기` }).click();
}

/** E01에서 십 막대 하나를 키보드로 풀어 낸다. */
async function breakOneTen(page: Page, panel: Locator): Promise<void> {
  const ten = panel.locator('[data-block-value="10"]').first();
  await ten.focus();
  await page.keyboard.press('Enter');
}

interface KeypadVisibility {
  readonly panelBottom: number;
  readonly key6Top: number;
  readonly key6Bottom: number;
  readonly clearTop: number;
  readonly clearBottom: number;
  readonly row6Fits: boolean;
  readonly clearFits: boolean;
}

/** 64px에서 E07 키패드 둘째 줄(6~0)과 '지우기' 줄이 판 안쪽 스크롤 아래로 숨는지 잰다. */
async function measureKeypad(panel: Locator, project: string): Promise<KeypadVisibility> {
  const panelBox = await panel.boundingBox();
  const key6 = await panel.getByRole('button', { name: '6 쓰기' }).boundingBox();
  const clear = await panel.getByRole('button', { name: '이 칸 지우기' }).boundingBox();
  if (!panelBox || !key6 || !clear) throw new Error('E07 키패드 위치를 알 수 없습니다.');
  const panelBottom = panelBox.y + panelBox.height;
  const result: KeypadVisibility = {
    panelBottom,
    key6Top: key6.y,
    key6Bottom: key6.y + key6.height,
    clearTop: clear.y,
    clearBottom: clear.y + clear.height,
    row6Fits: key6.y + key6.height <= panelBottom + 1,
    clearFits: clear.y + clear.height <= panelBottom + 1,
  };
  console.log('E07 keypad at 64px', { project, ...result });
  return result;
}

/** 오버레이 svg 상자가 E01 본 캔버스 상자와 1px 이내로 같고 그림이 캔버스 안에 있는지. */
async function expectOverlayAligned(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
  const canvas = panel.getByTestId(canvasTestId);
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);

  await expect
    .poll(
      async () => {
        const canvasBox = await canvas.boundingBox();
        const overlayBox = await overlay.locator('svg').boundingBox();
        if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(overlayBox.x - canvasBox.x),
          Math.abs(overlayBox.y - canvasBox.y),
          Math.abs(overlayBox.width - canvasBox.width),
          Math.abs(overlayBox.height - canvasBox.height),
        );
      },
      { message: `${overlayName} 오버레이가 본 캔버스와 어긋납니다.` },
    )
    .toBeLessThanOrEqual(1);

  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error(`${canvasTestId} 크기를 알 수 없습니다.`);
  const overlayBox = await overlay.locator('svg').boundingBox();
  if (overlayBox) {
    console.log('overlay alignment', {
      overlayName,
      dx: overlayBox.x - canvasBox.x,
      dy: overlayBox.y - canvasBox.y,
      dw: overlayBox.width - canvasBox.width,
      dh: overlayBox.height - canvasBox.height,
    });
  }
  const shapeBox = await overlay.locator('rect').first().boundingBox();
  if (shapeBox) {
    const centerX = shapeBox.x + shapeBox.width / 2;
    const centerY = shapeBox.y + shapeBox.height / 2;
    expect(centerX).toBeGreaterThanOrEqual(canvasBox.x - 1);
    expect(centerX).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
    expect(centerY).toBeGreaterThanOrEqual(canvasBox.y - 1);
    expect(centerY).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
  }
}

test('A1 블록과 세로셈 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }, testInfo) => {
  await openActivity(page, 'g2s1u3.A1', '블록과 세로셈');
  await screenshot(page, 'g2s1u3-a1.png');
  const left = slot(page, 'left');
  const right = slot(page, 'right');

  // 2학년도 저학년 모드(64px)가 기본이다. 64px에서는 E07 키패드 둘째 줄(6~0)과
  // '지우기' 줄이 판 안쪽 스크롤 아래로 숨는다. 숨은 키도 스크롤해 누르면
  // 동작하는지 여기서 먼저 확인한다(판 높이는 core CSS가 정한다).
  await measureKeypad(right, testInfo.project.name);
  await cell(right, 'result', 0).click();
  const hiddenDigit = right.getByRole('button', { name: '6 쓰기' });
  await hiddenDigit.scrollIntoViewIfNeeded();
  await hiddenDigit.click();
  await expect(cell(right, 'result', 0)).toHaveText('6');
  // 숫자를 쓰면 다음 칸으로 선택이 옮겨 가므로, 지울 칸을 다시 고른 뒤 '지우기'를 누른다.
  await cell(right, 'result', 0).click();
  const hiddenClear = right.getByRole('button', { name: '이 칸 지우기' });
  await hiddenClear.scrollIntoViewIfNeeded();
  await hiddenClear.click();
  await expect(cell(right, 'result', 0)).toHaveText('');

  // T1 — 받아올림을 적지 않고 63만 써서 '기록 빠짐' 힌트를 만난 뒤,
  // 블록을 묶어 받아올림 칸을 채우고 통과한다.
  await writeResult(right, { 0: '3', 1: '6' });
  await submit(page);
  await expectFailedWithHint(page, '블록에서 한 일을 세로셈에도 적었나요?');
  await left.getByRole('button', { name: '10개 묶기' }).click();
  await expect(cell(right, 'carry', 1)).toHaveText('1');
  await writeResult(right, { 0: '3', 1: '6' });
  await submit(page);
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();

  // T1의 두 판 화면에서 결과 칸은 판 안에 보여야 한다. 키패드 둘째 줄·'지우기' 줄은
  // 판 높이가 고정이라 안쪽 스크롤로 숨는다(위에서 숨은 키를 눌러 통과를 확인했다).
  const panelBox = await right.boundingBox();
  if (!panelBox) throw new Error('E07 판 크기를 알 수 없습니다.');
  const resultBox = await cell(right, 'result', 0).boundingBox();
  expect(resultBox).not.toBeNull();
  if (resultBox) {
    console.log('E07 result cell fit', {
      project: testInfo.project.name,
      panelBottom: panelBox.y + panelBox.height,
      resultBottom: resultBox.y + resultBox.height,
    });
    expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
  }

  await expectPassed(page);

  // T2 — 십 막대를 풀지 않고 35라고 써서 MC-SUB-SMALLER-FROM-LARGER를 만난다.
  // 같은 오답을 한 번 더 내 ② 문구와 break-preview 오버레이 정렬을 확인한 뒤,
  // 막대를 풀어 고친 수 4와 결과 25를 쓴다.
  await writeResult(right, { 0: '5', 1: '3' });
  await submit(page);
  await expectFailedWithHint(page, '2개에서 7개를 뺄 수 있어?');
  await submit(page);
  await expectHintLevel(page, '2');
  await expect(page.getByTestId('hint-text')).toContainText('십 막대 하나를 풀면');
  await expectOverlayAligned(left, 'break-preview', 'base-ten-canvas');
  await breakOneTen(page, left);
  await expect(cell(right, 'regroup', 1)).toHaveText('4');
  await writeResult(right, { 0: '5', 1: '2' });
  await submit(page);
  await expectPassed(page);

  // T3 — 44라고 써서 MC-SUB-SMALLER-FROM-LARGER를 만난 뒤, 막대를 풀고
  // 고친 수 6을 직접 쓴 다음 결과 36으로 고친다.
  await writeResult(right, { 0: '4', 1: '4' });
  await submit(page);
  await expectFailedWithHint(page, '0개에서 4개를 뺄 수 있어?');
  await breakOneTen(page, left);
  await expect(cell(right, 'regroup', 1)).toHaveText('');
  await writeRegroup(right, 1, '6');
  await writeResult(right, { 0: '6', 1: '3' });
  await submit(page);
  await expectPassed(page);

  // T4 — 받아올림 없이 73이라고 써서 MC-PV-NO-CARRY를 만난다.
  // 한 번 더 내 ②의 column-sum 상자가 E07 판 안에 있는지 확인하고 83으로 고친다.
  const main = slot(page, 'main');
  await writeResult(main, { 0: '3', 1: '7' });
  await submit(page);
  await expectFailedWithHint(page, '낱개가 10개 넘었어');
  await submit(page);
  await expectHintLevel(page, '2');
  const columnSum = main.getByTestId('overlay-column-sum');
  await expect(columnSum).toBeVisible();
  const mainBox = await main.boundingBox();
  const columnSumBox = await columnSum.boundingBox();
  if (!mainBox || !columnSumBox) throw new Error('column-sum 위치를 알 수 없습니다.');
  expect(columnSumBox.x).toBeGreaterThanOrEqual(mainBox.x - 1);
  expect(columnSumBox.y).toBeGreaterThanOrEqual(mainBox.y - 1);
  expect(columnSumBox.x + columnSumBox.width).toBeLessThanOrEqual(mainBox.x + mainBox.width + 1);
  expect(columnSumBox.y + columnSumBox.height).toBeLessThanOrEqual(mainBox.y + mainBox.height + 1);
  await writeResult(main, { 0: '3', 1: '8' });
  await submit(page);
  await expectPassed(page);

  // T5 — 고친 수 7을 쓰고 35라고 써서 MC-PV-BORROW-NO-DECREMENT를 만난 뒤 25로 고친다.
  await writeRegroup(main, 1, '7');
  await writeResult(main, { 0: '5', 1: '3' });
  await submit(page);
  await expectFailedWithHint(page, '십의 자리에서 하나를 내려 주었지?');
  await writeResult(main, { 0: '5', 1: '2' });
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 두 판과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  await openActivity(page, 'g2s1u3.A1', '블록과 세로셈');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  await expect(slot(page, 'left')).toBeInViewport({ ratio: 1 });
  await expect(slot(page, 'right')).toBeInViewport({ ratio: 1 });
  // E07 키패드는 두 판이 나란히 놓이면 아래쪽 일부가 판 안에서 스크롤된다.
  // 첫 화면에서 조작할 수 있는지만 확인하고, 실제 보이는 비율은 로그로 남긴다.
  await measureKeypad(slot(page, 'right'), testInfo.project.name);
  const keypadButton = slot(page, 'right').getByRole('button', { name: '3 쓰기' });
  await expect(keypadButton).toBeVisible();
  const ratio = await keypadButton.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const visible =
      Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)) /
      Math.max(box.height, 1);
    return Math.round(visible * 100) / 100;
  });
  console.log('E07 keypad button visible ratio', ratio);
  expect(ratio).toBeGreaterThan(0.5);
});

test('오프라인에서도 g2s1u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s1u3.A1`);
  await expect(page.getByRole('heading', { name: '블록과 세로셈' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '블록과 세로셈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
