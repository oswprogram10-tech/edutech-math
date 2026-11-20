import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T110 g1s2u3 「모양과 시각」 A1 「그림자 퍼즐」, T202 A2 「톱니 연동 시계」 단원 E2E.
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

// ── A2 톱니 연동 시계 ─────────────────────────────────────

function clockCanvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('clock-canvas');
}

function clockSlider(page: Page): Locator {
  return clockCanvas(page).getByRole('slider');
}

const CLOCK_CENTER = { x: 275, y: 255 };

/** 시계 중심에서 deg(12시 방향 0°, 시계 방향)·반지름 r인 논리 좌표를 화면 좌표로. */
async function clockPoint(
  page: Page,
  deg: number,
  radius: number,
): Promise<{ x: number; y: number }> {
  const box = await clockCanvas(page).boundingBox();
  if (!box) throw new Error('시계 캔버스를 찾지 못했습니다.');
  const rad = (deg * Math.PI) / 180;
  return {
    x: box.x + ((CLOCK_CENTER.x + radius * Math.sin(rad)) / 1000) * box.width,
    y: box.y + ((CLOCK_CENTER.y - radius * Math.cos(rad)) / 600) * box.height,
  };
}

/** 원 둘레를 따라 fromDeg에서 toDeg까지 긴바늘을 끈다. */
async function dragLongHand(page: Page, fromDeg: number, toDeg: number): Promise<void> {
  const start = await clockPoint(page, fromDeg, 150);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const steps = Math.max(2, Math.ceil(Math.abs(toDeg - fromDeg) / 8));
  for (let i = 1; i <= steps; i += 1) {
    const p = await clockPoint(page, fromDeg + ((toDeg - fromDeg) * i) / steps, 150);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}

async function expectHands(page: Page, shortDeg: string, longDeg: string): Promise<void> {
  await expect(clockCanvas(page).locator('[data-part="short-hand"]')).toHaveAttribute(
    'data-angle',
    shortDeg,
  );
  await expect(clockCanvas(page).locator('[data-part="long-hand"]')).toHaveAttribute(
    'data-angle',
    longDeg,
  );
}

async function pressTimes(page: Page, key: string, times: number): Promise<void> {
  for (let count = 0; count < times; count += 1) await page.keyboard.press(key);
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('상자를 찾지 못했습니다.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function answerField(page: Page): Locator {
  return slot(page, 'response').locator('[data-response-field="h"]');
}

async function typeAnswer(page: Page, keys: readonly string[]): Promise<void> {
  await answerField(page).getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearAnswer(page: Page): Promise<void> {
  await answerField(page).getByRole('button').first().click();
  await slot(page, 'response').getByRole('button', { name: '모두 지우기' }).click();
}

async function pickChoice(page: Page, label: string): Promise<void> {
  await slot(page, 'response').getByRole('button', { name: label, exact: true }).click();
}

/** 읽기 과제 시작 화면: 시계 판·조작 칸 DOM과 쪽 전체 글에 읽을 시각·학년이 없다. */
async function expectNoTimeLeak(page: Page): Promise<void> {
  const html = await slot(page, 'main').innerHTML();
  expect(html).not.toMatch(/7시|4시|7:30|4:30|7:00/);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/7시|4시/);
  expect(text).not.toMatch(/\d\s*학년/);
}

test('A2 톱니 연동 시계 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u3.A2', '톱니 연동 시계');
  const main = slot(page, 'main');

  // T1 — 긴바늘을 3에 둔 오답(분 15)은 MC-CLOCK-HANDS ①·②, 그 뒤 12로 되돌려 정시 3시를 만든다.
  await expect(main.getByText('긴바늘이 한 바퀴 돌면 짧은바늘은 한 칸')).toBeVisible();
  await screenshot(page, 'g1s2u3-a2-t1.png');
  await dragLongHand(page, 0, 90);
  await expectHands(page, '7.50', '90.00');
  await submit(page);
  await expectFailedWithHint(page, '몇 시는 어느 바늘이 알려 줄까?');
  await submit(page);
  await expectFailedWithHint(page, '짧은바늘을 진하게 그렸어요.', 2);
  const hands = await expectOverlayOverCanvas(main, 'hour-hand-focus', 'clock-canvas');
  // 오버레이의 짧은바늘 윤곽이 본 짧은바늘과 같은 자리에 겹친다(1px 정렬).
  const mine = await centerOf(clockCanvas(page).locator('[data-part="short-hand"] polygon'));
  const focus = await centerOf(hands.locator('[data-part="short-focus"] polygon'));
  expect(Math.abs(mine.x - focus.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(mine.y - focus.y)).toBeLessThanOrEqual(1);
  await dragLongHand(page, 90, 0);
  await expectHands(page, '0.00', '0.00');
  await clockSlider(page).focus();
  await pressTimes(page, 'Shift+ArrowRight', 3);
  await expectHands(page, '90.00', '0.00');
  await submit(page);
  await expectPassed(page);

  // T2 — 짧은바늘이 7인 시계. 12라고 답하면 MC-CLOCK-HANDS ①·②, 그 뒤 7로 고친다.
  await expectHands(page, '210.00', '0.00');
  await expectNoTimeLeak(page);
  await typeAnswer(page, ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '몇 시는 어느 바늘이 알려 줄까?');
  await submit(page);
  await expectFailedWithHint(page, '짧은바늘을 진하게 그렸어요.', 2);
  await expectOverlayOverCanvas(main, 'hour-hand-focus', 'clock-canvas');
  await clearAnswer(page);
  await typeAnswer(page, ['7']);
  await submit(page);
  await expectPassed(page);

  // T3 — 키보드만으로. 9:30을 만들어 MC-CLOCK-HOUR-BETWEEN ①·②를 본 뒤 8:30으로 되돌린다.
  await clockSlider(page).focus();
  await pressTimes(page, 'Shift+ArrowRight', 9);
  await page.keyboard.press('ArrowRight');
  await expectHands(page, '285.00', '180.00');
  await submit(page);
  await expectFailedWithHint(page, '짧은바늘이 다음 수를 지났어?');
  await submit(page);
  await expectFailedWithHint(page, '긴바늘을 거꾸로 돌려 정시로 되감아 봤어요.', 2);
  const rewind = await expectOverlayOverCanvas(main, 'rewind-to-hour', 'clock-canvas');
  await expect(rewind.locator('[data-part="ghost-short"]')).toHaveAttribute('data-angle', '270.00');
  await clockSlider(page).focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expectHands(page, '255.00', '180.00');
  await submit(page);
  await expectPassed(page);

  // T4 — 짧은바늘만 남은 4:30. 5라고 답하면 MC-CLOCK-HOUR-BETWEEN ①·②, 그 뒤 4로 고친다.
  await expect(clockCanvas(page).locator('[data-part="long-hand"]')).toHaveCount(0);
  await expectNoTimeLeak(page);
  await screenshot(page, 'g1s2u3-a2-t4.png');
  await typeAnswer(page, ['5']);
  await submit(page);
  await expectFailedWithHint(page, '짧은바늘이 다음 수를 지났어?');
  await submit(page);
  await expectFailedWithHint(page, '긴바늘을 거꾸로 돌려 정시로 되감아 봤어요.', 2);
  const back = await expectOverlayOverCanvas(main, 'rewind-to-hour', 'clock-canvas');
  await expect(back.locator('[data-part="ghost-short"]')).toHaveAttribute('data-angle', '120.00');
  await clearAnswer(page);
  await typeAnswer(page, ['4']);
  await submit(page);
  await expectPassed(page);

  // T5 — 7:30과 같은 시각 고르기. 나(8:30)는 MC-CLOCK-HOUR-BETWEEN ①·② say(오버레이 없음).
  await expectNoTimeLeak(page);
  await pickChoice(page, '나');
  await submit(page);
  await expectFailedWithHint(page, '짧은바늘이 다음 수를 지났어?');
  await submit(page);
  await expectFailedWithHint(page, '짧은바늘이 두 수 사이에 있으면 앞의 수를 읽어요.', 2);
  await expect(main.locator('[data-overlay]')).toHaveCount(0);
  // 세 번째 실패는 ③ 역추적 부스터가 열리므로 여기서 멈추고 가로 고친다.
  await pickChoice(page, '가');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 시계 조작 단추와 확인하기는 64px 터치 타깃이다', async ({ page }) => {
  await openActivity(page, 'g1s2u3.A2', '톱니 연동 시계');
  await expectContentPanelsReachable(page);
  for (const name of ['◀ 거꾸로', '앞으로 ▶']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    if (!box) throw new Error(`${name} 단추를 찾지 못했습니다.`);
    expect(box.width).toBeGreaterThanOrEqual(63.5);
    expect(box.height).toBeGreaterThanOrEqual(63.5);
  }
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
