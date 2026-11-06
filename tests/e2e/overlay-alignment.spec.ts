import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * T081 힌트 ② 오버레이 정렬 E2E.
 * E01·E02 오버레이가 실행기 칸 전체가 아니라 엔진의 본 캔버스 svg와 같은 자리·크기에
 * 그려지는지, 힌트 두 줄이 떠도 캔버스가 충분히 큰지 확인한다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

test.describe.configure({ timeout: 120_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, title: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  await field(page, id).getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectHintLevel2(page: Page): Promise<void> {
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '2');
}

/** 오버레이 svg 상자가 본 캔버스 svg 상자와 1px 이내로 같고, 캔버스가 150px 이상인지. */
async function expectOverlayAligned(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
  const canvas = panel.getByTestId(canvasTestId);
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);

  // 오버레이는 힌트가 뜬 뒤 효과에서 본 svg를 재어 상자를 맞춘다. 잠깐 기다린다.
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
  expect(canvasBox.height).toBeGreaterThanOrEqual(150);

  // 오버레이 그림 하나가 실제로 본 캔버스 상자 안에 있는지도 본다.
  const shapeBox = await overlay.locator('rect, circle').first().boundingBox();
  if (!shapeBox) throw new Error(`${overlayName} 그림을 찾지 못했습니다.`);
  const centerX = shapeBox.x + shapeBox.width / 2;
  const centerY = shapeBox.y + shapeBox.height / 2;
  expect(centerX).toBeGreaterThanOrEqual(canvasBox.x - 1);
  expect(centerX).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
  expect(centerY).toBeGreaterThanOrEqual(canvasBox.y - 1);
  expect(centerY).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
}

test('g1s1u5.A1 ten-outline이 사탕 판 위에 겹친다', async ({ page }) => {
  await openActivity(page, 'g1s1u5.A1', '10개씩 올가미 묶기');
  await typeNumber(page, 'n', ['2', '0']);
  await submit(page);
  await submit(page);
  await expectHintLevel2(page);
  await expectOverlayAligned(slot(page, 'main'), 'ten-outline', 'base-ten-canvas');
});

test('g1s1u5.A2 bead-groups가 구슬셈판 위에 겹친다', async ({ page }) => {
  await openActivity(page, 'g1s1u5.A2', '구슬셈판 뛰어 세기');
  const panel = slot(page, 'main');
  for (const row of [1, 2, 3]) {
    await panel.getByRole('button', { name: `${row}번 줄 10개 밀기`, exact: true }).click();
  }
  await submit(page);
  await submit(page);
  await expectHintLevel2(page);
  await expectOverlayAligned(panel, 'bead-groups', 'counters-canvas');
});

test('g1s2u6.A1 frame-gaps가 텐프레임 빈칸 위에 겹친다', async ({ page }) => {
  await openActivity(page, 'g1s2u6.A1', '이중 텐프레임 10 채우기');
  await typeNumber(page, 'n', ['6']);
  await submit(page);
  await submit(page);
  await expectHintLevel2(page);
  await expectOverlayAligned(slot(page, 'main'), 'frame-gaps', 'counters-canvas');
});
