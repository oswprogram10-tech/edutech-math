import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectContentPanelsReachable,
  expectInsideScroller,
  expectNoPanelInnerScroll,
} from '../panel-layout';

/**
 * T069 g5s1u2 「약수와 배수」 A1 E2E.
 * 점 배열로 약수 찾기(T1·T2), 타일로 공약수 찾기(T3·T4),
 * A 단계 약수 고르기(T5)·최대공약수(T6)를 대표 오답 → 힌트 ① → 정답으로 끝낸다.
 * A2(맞물려 도는 톱니바퀴, T182)는 파일 끝 묶음에서 다룬다.
 */

test.describe.configure({ timeout: 180_000 });

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
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function retypeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  await clearNumber(page, id);
  await typeNumber(page, id, keys);
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
  const next = page.getByRole('button', { name: '다음 과제' });
  await next.focus();
  await page.keyboard.press('Enter');
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

async function addRows(panel: Locator, count: number): Promise<void> {
  const button = panel.getByRole('button', { name: '줄 하나 늘리기' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function addCols(panel: Locator, count: number): Promise<void> {
  const button = panel.getByRole('button', { name: '칸 하나 늘리기' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function removeCols(panel: Locator, count: number): Promise<void> {
  const button = panel.getByRole('button', { name: '칸 하나 줄이기' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function recordArray(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '배열 기록하기' }).click();
}

async function growTile(panel: Locator, count: number): Promise<void> {
  const button = panel.getByRole('button', { name: '타일 크게' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function shrinkTile(panel: Locator, count: number): Promise<void> {
  const button = panel.getByRole('button', { name: '타일 작게' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function recordTile(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '기록하기', exact: true }).click();
}

/** 오버레이가 판 안에 들어오는지(내부 스크롤 없이). */
async function expectOverlayInPanel(panel: Locator, selector: string): Promise<void> {
  await expect(panel.locator(selector)).toBeVisible();
  await expect
    .poll(
      async () => {
        const panelBox = await panel.boundingBox();
        const overlayBox = await panel.locator(selector).boundingBox();
        if (!panelBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.max(0, panelBox.x - overlayBox.x),
          Math.max(0, panelBox.y - overlayBox.y),
          Math.max(0, overlayBox.x + overlayBox.width - (panelBox.x + panelBox.width)),
          Math.max(0, overlayBox.y + overlayBox.height - (panelBox.y + panelBox.height)),
        );
      },
      { message: `${selector} 오버레이가 판 밖으로 나갑니다.` },
    )
    .toBeLessThanOrEqual(1);
}

/** 오버레이 svg 상자가 본 캔버스 svg 상자와 2px 안에서 같은지. */
async function expectOverlayAligned(panel: Locator): Promise<void> {
  const canvas = panel.locator('svg[data-testid="array-canvas"]');
  const overlay = panel.locator('[data-overlay="leftover-strip"] svg');
  await expect(overlay).toBeVisible();
  await expect
    .poll(
      async () => {
        const canvasBox = await canvas.boundingBox();
        const overlayBox = await overlay.boundingBox();
        if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(overlayBox.x - canvasBox.x),
          Math.abs(overlayBox.y - canvasBox.y),
          Math.abs(overlayBox.width - canvasBox.width),
          Math.abs(overlayBox.height - canvasBox.height),
        );
      },
      { message: 'leftover-strip 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
}

test('A1 방바닥 타일 깔기 — 대표 오답 뒤 고쳐서 여섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u2.A1', '방바닥 타일 깔기');
  await screenshot(page, 'g5s1u2-a1.png');

  // T1 — 1×12만 기록해 ①을 본 뒤 2×6, 3×4를 더 기록한다.
  const first = slot(page, 'main');
  await addCols(first, 11);
  await recordArray(first);
  await expect(first.getByTestId('recorded-badge')).toContainText('1가지 배열');
  const shelf = first.getByTestId('factor-shelf');
  await expect(shelf).toBeVisible();
  const shelfFont = await shelf
    .locator('li')
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(shelfFont).toBeGreaterThanOrEqual(16);
  expect(
    await shelf.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    }),
  ).toBe(true);
  await screenshot(page, 'g5s1u2-a1-shelf.png');
  await submit(page);
  await expectFailedWithHint(page, '12개를 직사각형으로 늘어놓는 방법을 모두 찾았나요?');
  await addRows(first, 1);
  await removeCols(first, 6);
  await recordArray(first);
  await addRows(first, 1);
  await removeCols(first, 2);
  await recordArray(first);
  await expect(first.getByTestId('recorded-badge')).toContainText('3가지 배열');
  await submit(page);
  await expectPassed(page);

  // T2 — 1×18만 기록해 ①을 본 뒤 2×9, 3×6을 더 기록한다.
  const second = slot(page, 'main');
  await addCols(second, 17);
  await recordArray(second);
  await submit(page);
  await expectFailedWithHint(page, '3이 18의 약수라면 3과 짝이 되는 수는?');
  await addRows(second, 1);
  await removeCols(second, 9);
  await recordArray(second);
  await addRows(second, 1);
  await removeCols(second, 3);
  await recordArray(second);
  await submit(page);
  await expectPassed(page);

  // T3 — 타일 5로 남는 칸을 본 뒤 1·2·3·6을 기록한다.
  const third = slot(page, 'main');
  await growTile(third, 5);
  await expect(third.getByTestId('tile-size')).toHaveText('5');
  await submit(page);
  await expectFailedWithHint(page, '타일을 깔았을 때 남는 칸이 없는 크기를 모두 찾았나요?');
  await submit(page);
  await expectFailedWithHint(
    page,
    '남는 칸을 빗금으로 보았어요. 잘못 기록한 크기는 되돌리기로 지워요.',
    2,
  );
  await expectOverlayInPanel(third, '[data-overlay="leftover-strip"]');
  await expectOverlayAligned(third);
  await shrinkTile(third, 4);
  await expect(third.getByTestId('tile-size')).toHaveText('1');
  await recordTile(third);
  await growTile(third, 1);
  await recordTile(third);
  await growTile(third, 1);
  await recordTile(third);
  await growTile(third, 3);
  await expect(third.getByTestId('tile-size')).toHaveText('6');
  await recordTile(third);
  await expect(third.getByTestId('recorded-sizes-badge')).toContainText('4가지 타일 크기');
  await submit(page);
  await expectPassed(page);

  // T4 — 36을 써서 GCD/LCM SWAP ①을 본 뒤 6으로 고친다.
  const fourth = slot(page, 'main');
  await growTile(fourth, 6);
  await expect(fourth.getByTestId('tile-size')).toHaveText('6');
  await typeNumber(page, 'largest', ['3', '6']);
  await submit(page);
  await expectFailedWithHint(page, '타일이 방보다 클 수 있을까?');
  await retypeNumber(page, 'largest', ['6']);
  await submit(page);
  await expectPassed(page);

  // T5 — 36을 골라 약수/배수 SWAP ①을 본 뒤 24의 약수만 고른다.
  const rem = field(page, 'rem');
  await rem.getByRole('button', { name: '36', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '24를 똑같이 나눌 수 있는 수야, 24씩 뛰어 센 수야?');
  await rem.getByRole('button', { name: '36', exact: true }).click();
  for (const label of ['1', '2', '3', '4', '6', '8', '12', '24']) {
    await rem.getByRole('button', { name: label, exact: true }).click();
  }
  await submit(page);
  await expectPassed(page);

  // T6 — 48을 써서 GCD/LCM SWAP ①을 본 뒤 8로 고친다.
  await typeNumber(page, 'gcd', ['4', '8']);
  await submit(page);
  await expectFailedWithHint(
    page,
    '구하는 것이 두 수의 공약수 중 가장 큰 수인지, 공배수 중 가장 작은 수인지 살펴보세요.',
  );
  await retypeNumber(page, 'gcd', ['8']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  await openActivity(page, 'g5s1u2.A1', '방바닥 타일 깔기');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoPanelInnerScroll(page);
  const metrics = await page.evaluate(() => {
    const scroller = document.querySelector('main');
    const button = Array.from(document.querySelectorAll('button')).find(
      (element) => element.textContent === '확인하기',
    );
    if (!(scroller instanceof HTMLElement) || !(button instanceof HTMLElement)) return null;
    const host = scroller.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    return {
      pageHeight: scroller.scrollHeight,
      viewportHeight: scroller.clientHeight,
      submitTop: Math.round(box.top - host.top + scroller.scrollTop),
      submitBottom: Math.round(box.bottom - host.top + scroller.scrollTop),
    };
  });
  console.log('g5s1u2 first screen', { project: testInfo.project.name, ...metrics });
  if ((metrics?.pageHeight ?? 0) > (metrics?.viewportHeight ?? 0) + 1) {
    await expectContentPanelsReachable(page);
    return;
  }
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
});

test('오프라인에서도 g5s1u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s1u2.A1`);
  await expect(page.getByRole('heading', { name: '방바닥 타일 깔기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '방바닥 타일 깔기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

// ───────── A2 맞물려 도는 톱니바퀴 (T182) ─────────

const A2_TITLE = '맞물려 도는 톱니바퀴';

async function openA2(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openActivity(page, 'g5s1u2.A2', A2_TITLE);
}

function gearsButton(page: Page, name: string): Locator {
  return slot(page, 'gears').getByRole('button', { name, exact: true });
}

async function turnGears(page: Page, times: number): Promise<void> {
  const forward = gearsButton(page, '한 칸 돌리기');
  for (let index = 0; index < times; index += 1) await forward.click();
}

async function predictGears(page: Page, digits: readonly string[]): Promise<void> {
  const pad = slot(page, 'gears').getByTestId('gears-pad');
  for (const digit of digits) await pad.getByRole('button', { name: digit, exact: true }).click();
  await pad.getByRole('button', { name: '예측 정하기', exact: true }).click();
}

async function expectTrailAligned(panel: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const canvas = await panel.getByTestId('gears-canvas').boundingBox();
      const overlay = await panel.locator('[data-overlay="meet-trail"] svg').first().boundingBox();
      if (!canvas || !overlay) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(canvas.x - overlay.x),
        Math.abs(canvas.y - overlay.y),
        Math.abs(canvas.width - overlay.width),
        Math.abs(canvas.height - overlay.height),
      );
    })
    .toBeLessThanOrEqual(1);
}

test('A2 맞물려 도는 톱니바퀴 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openA2(page);
  await screenshot(page, 'g5s1u2-a2.png');

  // T1 — 12칸을 돌려 맞닿음을 본다. 24를 써서 LCM-AS-PRODUCT ①②를 본 뒤 12로 고친다.
  await turnGears(page, 12);
  await expect(slot(page, 'gears').getByTestId('gears-meet-star')).toBeVisible();
  await expect(slot(page, 'gears').getByTestId('gears-steps')).toHaveText('돌린 칸: 12');
  await expect(page.locator('[data-testid="linked-marker"][data-value="12"]')).toBeVisible();
  await typeNumber(page, 'p', ['2', '4']);
  await submit(page);
  await expectFailedWithHint(page, '24보다 먼저 두 톱니가 만나는 곳은 없을까?');
  await submit(page);
  await expectFailedWithHint(page, '빨간 표시 톱니가 맞닿는 곳을', 2);
  await expect(slot(page, 'gears').locator('[data-overlay="meet-trail"]')).toBeVisible();
  await retypeNumber(page, 'p', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T2 — 공배수가 아닌 16을 함께 골라 틀린 뒤 12·24·36·48만 남긴다(고른 순서는 상관없다).
  const cm = field(page, 'cm');
  for (const label of ['48', '16', '36', '24', '12']) {
    await cm.getByRole('button', { name: label, exact: true }).click();
  }
  await submit(page);
  await expectFailedWithHint(page, '4씩 뛴 줄과 6씩 뛴 줄에 모두 표시된 수');
  await cm.getByRole('button', { name: '16', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 예측 54를 정하고 18칸을 돌린 뒤 54를 써서 ①②를 본다. 18로 고친다.
  await expect(gearsButton(page, '한 칸 돌리기')).toBeDisabled();
  await predictGears(page, ['5', '4']);
  await expect(gearsButton(page, '한 칸 돌리기')).toBeEnabled();
  await turnGears(page, 18);
  await expect(slot(page, 'gears').getByTestId('gears-steps')).toHaveText('돌린 칸: 18');
  await typeNumber(page, 'p', ['5', '4']);
  await submit(page);
  await expectFailedWithHint(page, '54보다 먼저 두 톱니가 만나는 곳은 없을까?');
  await submit(page);
  await expectFailedWithHint(page, '더 앞에 있는지', 2);
  await expectOverlayInPanel(slot(page, 'gears'), '[data-overlay="meet-trail"]');
  await expectTrailAligned(slot(page, 'gears'));
  await retypeNumber(page, 'p', ['1', '8']);
  await submit(page);
  await expectPassed(page);

  // T4 — "곱한 수"를 골라 틀린 뒤 알맞은 설명으로 바꾼다.
  const rel = field(page, 'rel');
  await rel.getByRole('button', { name: /두 수를 곱한 수/ }).click();
  await submit(page);
  await expectFailedWithHint(page, '처음 맞닿은 칸 수와 그다음에 맞닿은 칸 수를 견주어 봐요.');
  await rel.getByRole('button', { name: /최소공배수의 배수/ }).click();
  await submit(page);
  await expectPassed(page);

  // T5 — 96을 써서 LCM-AS-PRODUCT ①을 본 뒤 24로 고친다.
  await typeNumber(page, 'p', ['9', '6']);
  await submit(page);
  await expectFailedWithHint(page, '96보다 먼저 두 수의 배수가 만나는 곳은 없을까?');
  await retypeNumber(page, 'p', ['2', '4']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 T1 시작 화면과 일반 힌트에 정답(12·18·24)이 없다', async ({ page }) => {
  await openA2(page);
  const prompt = (await page.getByRole('heading', { level: 2 }).first().textContent()) ?? '';
  expect(prompt).toContain('빨간 톱니가 처음 다시 맞닿을 때까지');
  expect(prompt).not.toMatch(/12|18|24/);
  await expect(slot(page, 'gears').getByTestId('gears-canvas')).toBeVisible();
  await expect(slot(page, 'gears')).not.toContainText(/12|18|24/);
  await expect(slot(page, 'line').getByTestId('number-line-canvas')).toBeVisible();

  // 아무것도 쓰지 않고 제출해 일반 힌트 ①·②를 본다.
  for (const level of [1, 2] as const) {
    await submit(page);
    await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
    const hint = (await page.getByTestId('hint-text').textContent()) ?? '';
    expect(hint).not.toMatch(/12|18|24|36|48/);
  }
});

test('A2 두 화면 판과 응답 판이 겹치지 않고 모두 닿는다', async ({ page }, testInfo) => {
  await openA2(page);
  const names = ['gears', 'line', 'response'] as const;
  const boxes: { name: string; x: number; y: number; width: number; height: number }[] = [];
  for (const name of names) {
    const box = await slot(page, name).boundingBox();
    if (!box) throw new Error(`${name} 판을 찾지 못했습니다.`);
    boxes.push({ name, ...box });
  }
  const viewportWidth = page.viewportSize()?.width ?? 0;
  for (const box of boxes) {
    expect(box.x, `${box.name} 왼쪽`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${box.name} 오른쪽`).toBeLessThanOrEqual(viewportWidth + 1);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(overlapX > 1 && overlapY > 1, `${a.name}와 ${b.name} 판이 겹칩니다.`).toBe(false);
    }
  }
  console.log('g5s1u2.A2 panels', testInfo.project.name, JSON.stringify(boxes));
  await expectContentPanelsReachable(page);
  await expectInsideScroller(slot(page, 'response'));
});

test('A2 T1 수직선은 좁은 판에서도 0.7배 이상으로 읽히고 옆으로 밀어 끝 눈금(48)을 본다', async ({
  page,
}) => {
  await openA2(page);
  const canvas = slot(page, 'line').getByTestId('number-line-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('수직선을 찾지 못했습니다.');
  expect(box.width).toBeGreaterThanOrEqual(1000 * 0.7 - 1);

  // 눈금 글자 하나의 화면 높이.
  const label = canvas.locator('[data-row="0"] [data-tick-value="0"] text');
  const labelBox = await label.boundingBox();
  if (!labelBox) throw new Error('눈금 글자를 찾지 못했습니다.');
  expect(labelBox.height).toBeGreaterThanOrEqual(12);

  // 스크롤 상자 안에서 끝 눈금(48)까지 밀어 본다.
  const scroller = slot(page, 'line').getByTestId('skip-scroll');
  await expect(scroller).toHaveAttribute('aria-label', '수직선, 옆으로 밀어 볼 수 있어요');
  await scroller.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  const end = canvas.locator('[data-row="0"] [data-tick-value="48"] line');
  await expect(end).toHaveCount(1);
  await expect(end).toBeInViewport();
});
