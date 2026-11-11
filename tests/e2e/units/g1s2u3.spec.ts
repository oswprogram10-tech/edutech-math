import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T110 g1s2u3 「모양과 시각」 A1 「그림자 퍼즐」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 조각을 하나씩 옮기는 과제라 기본 30초로는 모자란다.
test.describe.configure({ timeout: 180_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function piece(panel: Locator, id: string): Locator {
  return panel.locator(`[data-piece="${id}"]`);
}

function trayPiece(panel: Locator, number: number): Locator {
  return panel.getByRole('button', { name: `쟁반 조각 ${number}`, exact: true });
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

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** 조각의 data-ax·data-ay가 목표가 될 때까지 키보드 방향키로 옮긴다. */
async function movePieceTo(
  page: Page,
  panel: Locator,
  id: string,
  ax: number,
  ay: number,
): Promise<void> {
  const target = piece(panel, id);
  await target.focus();
  await expect(target).toBeFocused();
  for (let count = 0; count < 160; count += 1) {
    const currentX = Number(await target.getAttribute('data-ax'));
    const currentY = Number(await target.getAttribute('data-ay'));
    const dx = ax - currentX;
    const dy = ay - currentY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    const key =
      Math.abs(dx) >= Math.abs(dy)
        ? dx > 0
          ? 'ArrowRight'
          : 'ArrowLeft'
        : dy > 0
          ? 'ArrowDown'
          : 'ArrowUp';
    await page.keyboard.press(key);
    await nextFrame(page);
  }
  throw new Error(`조각 ${id}를 (${ax}, ${ay})로 옮기지 못했습니다.`);
}

async function addTrayPiece(page: Page, panel: Locator, number: number): Promise<void> {
  const tray = trayPiece(panel, number);
  await tray.focus();
  await expect(tray).toBeFocused();
  await page.keyboard.press('Enter');
  await nextFrame(page);
}

async function turnPiece(page: Page, panel: Locator, id: string, times: number): Promise<void> {
  const target = piece(panel, id);
  await target.focus();
  await expect(target).toBeFocused();
  for (let count = 0; count < times; count += 1) {
    await page.keyboard.press('R');
    await nextFrame(page);
  }
}

async function selectPiece(page: Page, panel: Locator, id: string): Promise<void> {
  const target = piece(panel, id);
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(target).toHaveAttribute('data-selected', 'true');
}

/**
 * 힌트 ② 오버레이가 엔진의 본 캔버스 svg와 같은 자리·크기에 놓였는지 확인한다.
 * 실행기 칸 전체가 아니라 캔버스 상자와 1px 이내로 겹쳐야 한다.
 */
async function expectOverlayOverCanvas(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<Locator> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const canvas = panel.getByTestId(canvasTestId);
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').boundingBox();
      const canvasBox = await canvas.boundingBox();
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

test('A1 그림자 퍼즐 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u3.A1', '그림자 퍼즐');
  await screenshot(page, 'g1s2u3-a1.png');
  const panel = slot(page, 'main');

  // T1 — 아무것도 옮기지 않고 제출해 힌트 ①을 본 뒤, 두 조각을 붙여 네모를 만든다.
  await submit(page);
  await expectFailedWithHint(page, '만든 모양에서 뾰족하게 튀어나온 곳이 몇 개인가요?');
  // 조각 1을 180° 돌리면 제자리에서 돌아가고, 조각 2를 위로 올리면 자석처럼 붙는다.
  await turnPiece(page, panel, 'p1', 4);
  await expect(piece(panel, 'p1')).toHaveAttribute('data-ax', '25.000');
  await expect(piece(panel, 'p1')).toHaveAttribute('data-ay', '3.667');
  await movePieceTo(page, panel, 'p2', 23, 11 / 3);
  await submit(page);
  await expectPassed(page);

  // T2 — 아무 조각도 놓지 않고 제출해 힌트 ①을 본 뒤, 집 그림자를 채운다.
  await submit(page);
  await expectFailedWithHint(page, '그림자에 빈 곳이 남았나요?');
  await addTrayPiece(page, panel, 2);
  await movePieceTo(page, panel, 'p1', 2, 2);
  await addTrayPiece(page, panel, 2);
  await movePieceTo(page, panel, 'p2', 3, 2);
  await addTrayPiece(page, panel, 5);
  await movePieceTo(page, panel, 'p3', 2, 1);
  await expect(panel.getByTestId('cut-canvas')).toHaveAttribute('data-filled', 'true');
  await submit(page);
  await expectPassed(page);

  // T3 — 아무 조각도 놓지 않고 제출해 힌트 ①을 본 뒤, 배 그림자를 채운다.
  await submit(page);
  await expectFailedWithHint(page, '배 그림자에 빈 곳이 남았나요?');
  await addTrayPiece(page, panel, 5);
  await turnPiece(page, panel, 'p1', 2);
  await movePieceTo(page, panel, 'p1', 4, 4);
  await addTrayPiece(page, panel, 1);
  await movePieceTo(page, panel, 'p2', 2.5, 4 + Math.sqrt(3) / 2);
  await expect(panel.getByTestId('cut-canvas')).toHaveAttribute('data-filled', 'true');
  await submit(page);
  await expectPassed(page);

  // T4 — 돌아가지 않은 세모 하나만 골라 힌트 ①·②를 본 뒤, 세모 셋을 모두 고른다.
  await expect(piece(panel, 'p1')).toHaveAttribute('data-rot', '45');
  await expect(piece(panel, 'p3')).toHaveAttribute('data-rot', '135');
  await selectPiece(page, panel, 'p2');
  await submit(page);
  await expectFailedWithHint(page, '돌려 보면 어떻게 될까요?');
  // 같은 오답을 한 번 더 내면 ② 돌아간 조각의 기준 자세가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '돌아간 조각을 똑바로 돌린 모습을 보세요.', 2);
  const overlay = await expectOverlayOverCanvas(panel, 'upright-turn', 'cut-canvas');
  await expect(overlay.locator('[data-upright-piece]')).toHaveCount(2);
  await selectPiece(page, panel, 'p1');
  await selectPiece(page, panel, 'p3');
  await submit(page);
  await expectPassed(page, true);
});

test('아이패드·크롬북·전자칠판 첫 화면에 엔진·확인하기가 들어온다', async ({ page }, testInfo) => {
  await openActivity(page, 'g1s2u3.A1', '그림자 퍼즐');
  await page.evaluate(() => window.scrollTo(0, 0));
  // T122로 E11 판이 실행기 판 높이에 맞춰 줄어들어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);

  // 64px 타깃이 켜진 상태에서 판과 조작·확인하기가 모두 첫 화면에 보여야 한다.
  const panel = slot(page, 'main');
  await expect(panel).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  await expect(panel.getByRole('button', { name: '조각 1', exact: true })).toBeInViewport({
    ratio: 1,
  });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);
});

test('오프라인에서도 g1s2u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s2u3.A1`);
  await expect(page.getByRole('heading', { name: '그림자 퍼즐' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '그림자 퍼즐' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
