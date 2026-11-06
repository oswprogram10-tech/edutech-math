import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { logicalToScreen } from '../canvas-point';

/**
 * T060 g2s2u1 「네 자리 수」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

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

async function setSmallTarget(page: Page): Promise<void> {
  // 카드 공통 2: 2학년은 48px 기본. 앱은 g1·g2를 저학년으로 보아 64px을 켜므로
  // 이 단원 E2E에서는 '큰 버튼'을 끄고 카드 기준(48px)으로 확인한다.
  await page.getByRole('button', { name: '설정' }).click();
  const toggle = page.getByRole('menuitemcheckbox', { name: '큰 버튼' });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) === 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: '설정' }).click();
}

async function openActivity(page: Page, activityId: string, title: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await setSmallTarget(page);
}

async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
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

async function addBlocks(page: Page, name: string, count: number): Promise<void> {
  const button = slot(page, 'main').getByRole('button', { name: `${name} 블록 놓기` });
  for (let index = 0; index < count; index += 1) {
    // 블록이 상자 위를 덮어도 조작되도록 키보드로 놓는다(엔진이 Enter를 받는다).
    await button.focus();
    await page.keyboard.press('Enter');
  }
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
  const overlayBox = await overlay.locator('svg').boundingBox();
  if (canvasBox && overlayBox) {
    console.log('overlay alignment', {
      overlayName,
      dx: overlayBox.x - canvasBox.x,
      dy: overlayBox.y - canvasBox.y,
      dw: overlayBox.width - canvasBox.width,
      dh: overlayBox.height - canvasBox.height,
    });
  }
}

async function tapCanvas(page: Page, x: number, y = 380): Promise<void> {
  const box = await page.getByTestId('number-line-canvas').boundingBox();
  if (!box) throw new Error('수직선 캔버스 크기를 알 수 없습니다.');
  const point = logicalToScreen({ x: box.x, y: box.y, width: box.width, height: box.height }, x, y);
  await page.mouse.click(point.x, point.y);
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

test('A1 1000 큐브 적층 스튜디오 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s2u1.A1', '1000 큐브 적층 스튜디오');
  await screenshot(page, 'g2s2u1-a1.png');
  const main = slot(page, 'main');

  // T1 — 판을 10장 모으고 묶지 않은 채 100이라고 써서 일반 힌트 ①을 만난 뒤,
  // 10개를 묶어 1000으로 고친다.
  await addBlocks(page, '백', 3);
  await expect(main.locator('[data-block-value="100"]')).toHaveCount(10);
  await typeNumber(page, 'ans', ['1', '0', '0']);
  await submit(page);
  await expectFailedWithHint(page, '판이 몇 장 모이면');
  await main.getByRole('button', { name: '10개 묶기' }).click();
  await expect(main.locator('[data-block-value="1000"]')).toHaveCount(1);
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '0', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T2 — 천 1개, 백 10장, 십 3개, 낱개 6개를 그대로 두고 제출해
  // MC-PV-NONCANON ①을 만난다. 한 번 더 내 ②의 ten-outline 정렬을 확인한 뒤,
  // 판 10장을 묶어 2436을 만든다.
  await addBlocks(page, '천', 1);
  await addBlocks(page, '백', 10);
  await addBlocks(page, '십', 3);
  await addBlocks(page, '하나', 6);
  await submit(page);
  await expectFailedWithHint(page, '판 10장으로 무엇을 만들까?');
  await submit(page);
  await expectHintLevel(page, '2');
  await expect(page.getByTestId('hint-text')).toContainText('판 열 장 자리를');
  await expectOverlayAligned(main, 'ten-outline', 'base-ten-canvas');
  await main.getByRole('button', { name: '10개 묶기' }).click();
  await expect(main.locator('[data-block-value="100"]')).toHaveCount(0);
  await addBlocks(page, '백', 4);
  await submit(page);
  await expectPassed(page);

  // T3 — 처음부터 판 10장이 모두 보이는지 확인하고, 11035라고 써서
  // MC-PV-NONCANON ①을 만난 뒤 판을 묶고 2035로 고친다.
  await expect(main.locator('[data-block-value="100"]')).toHaveCount(10);
  const allPlatesVisible = await page.evaluate(() => {
    const plates = Array.from(
      document.querySelectorAll('[data-testid="runner-slot-main"] [data-block-value="100"]'),
    );
    return plates.map((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + 4);
      return hit !== null && (hit === element || element.contains(hit));
    });
  });
  expect(allPlatesVisible).toHaveLength(10);
  expect(allPlatesVisible.every(Boolean)).toBe(true);
  await screenshot(page, 'g2s2u1-a1-t3.png');
  await typeNumber(page, 'ans', ['1', '1', '0', '3', '5']);
  await submit(page);
  await expectFailedWithHint(page, '판 10장으로 무엇을 만들까?');
  await submit(page);
  await expectHintLevel(page, '2');
  await expectOverlayAligned(main, 'ten-outline', 'base-ten-canvas');
  await main.getByRole('button', { name: '10개 묶기' }).click();
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['2', '0', '3', '5']);
  await submit(page);
  await expectPassed(page);

  // T4 — 백의 자리 0을 빼고 358이라고 써서 MC-PV-ZERO ①을 만난 뒤 3058로 고친다.
  await typeNumber(page, 'ans', ['3', '5', '8']);
  await submit(page);
  await expectFailedWithHint(page, '판이 하나도 없으면');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['3', '0', '5', '8']);
  await submit(page);
  await expectPassed(page);

  // T5 — 큐브를 풀지 않고 제출해 일반 힌트 ①을 만난 뒤, 첫 큐브를 풀어 판 10장으로 바꾼다.
  await submit(page);
  await expectFailedWithHint(page, '큐브 하나를 풀면 판이 몇 장');
  const cube = main.locator('[data-block-value="1000"]').first();
  await cube.focus();
  await page.keyboard.press('Enter');
  await expect(main.locator('[data-block-value="1000"]')).toHaveCount(2);
  await expect(main.locator('[data-block-value="100"]')).toHaveCount(10);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 핀치 줌아웃 수직선 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s2u1.A2', '핀치 줌아웃 수직선');
  await screenshot(page, 'g2s2u1-a2.png');
  const main = slot(page, 'main');
  const canvas = page.getByTestId('number-line-canvas');

  // T1 — 단계 0에서 500 카드를 놓고 제출해 일반 힌트 ①을 만난 뒤,
  // 두 단계 넓게 보아 0~1000에서 500을 놓는다.
  await main.getByTestId('log-card-500').click();
  await tapCanvas(page, 200);
  await submit(page);
  await expectFailedWithHint(page, '500이 보이려면');
  const zoomOut = main.getByRole('button', { name: '한 단계 넓게 보기' });
  await zoomOut.click();
  await zoomOut.click();
  await expect(canvas).toHaveAttribute('data-log-level', '2');
  await main.getByTestId('log-card-500').click();
  await tapCanvas(page, 500);
  await expect(main.getByTestId('log-card-500')).toHaveAttribute('data-placed', '500');
  await submit(page);
  await expectPassed(page);

  // T2 — 시작 단계 0~1000에서 두 카드를 그냥 놓아 제출해 일반 힌트 ①을 만난 뒤,
  // 한 단계 넓게 보아 0~10000에서 1000과 2500을 놓는다.
  await main.getByTestId('log-card-1000').click();
  await tapCanvas(page, 200);
  await main.getByTestId('log-card-2500').click();
  await tapCanvas(page, 300);
  await submit(page);
  await expectFailedWithHint(page, '1000은 0과 10000 사이');
  await zoomOut.click();
  await expect(canvas).toHaveAttribute('data-log-level', '3');
  await main.getByTestId('log-card-1000').click();
  await tapCanvas(page, 180);
  await main.getByTestId('log-card-2500').click();
  await tapCanvas(page, 300);
  await expect(main.getByTestId('log-card-1000')).toHaveAttribute('data-placed', '1000');
  await expect(main.getByTestId('log-card-2500')).toHaveAttribute('data-placed', '2500');
  await submit(page);
  await expectPassed(page);

  // T3 — 3200에서 1000씩 세 번 뛰고 세 번째 수를 5200으로 잘못 써서
  // 일반 힌트 ①을 만난 뒤 6200으로 고친다.
  const hop = main.getByRole('button', { name: '한 번 뛰기' });
  await hop.click();
  await hop.click();
  await hop.click();
  await typeNumber(page, 'n1', ['4', '2', '0', '0']);
  await typeNumber(page, 'n2', ['5', '2', '0', '0']);
  await typeNumber(page, 'n3', ['5', '2', '0', '0']);
  await submit(page);
  await expectFailedWithHint(page, '1000씩 뛰면');
  await clearNumber(page, 'n3');
  await typeNumber(page, 'n3', ['6', '2', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T4 — 2987 > 3010이라고 골라 MC-COMPARE-DIGIT-COUNT ①을 만난 뒤,
  // 2987 < 3010으로 고치고 네 수를 작은 수부터 놓는다.
  await toggleChoice(page, 'cmp', '크다');
  await submit(page);
  await expectFailedWithHint(page, '천의 자리부터 비교해 볼까?');
  await toggleChoice(page, 'cmp', '작다');
  await field(page, 'ord').getByRole('button', { name: '2899 위로' }).click();
  await field(page, 'ord').getByRole('button', { name: '2899 위로' }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g2s2u1.A1', title: '1000 큐브 적층 스튜디오', response: true },
    { id: 'g2s2u1.A2', title: '핀치 줌아웃 수직선', response: false },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    if (item.response) await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g2s2u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s2u1.A1`);
  await expect(page.getByRole('heading', { name: '1000 큐브 적층 스튜디오' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '1000 큐브 적층 스튜디오' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
