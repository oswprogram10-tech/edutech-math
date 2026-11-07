import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T067 g4s1u1 「큰 수」 단원 E2E.
 * A1(4자리 컬러 슬라이서)·A2(스케일 줌 수직선)를 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝낸다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
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

async function toggleCut(page: Page, panel: Locator, position: number): Promise<void> {
  const gap = panel.locator(`[data-cut-position="${position}"]`);
  await gap.focus();
  await page.keyboard.press('Enter');
}

async function fillReverse(
  page: Page,
  panel: Locator,
  cells: Readonly<Record<number, string>>,
): Promise<void> {
  for (const [cell, digit] of Object.entries(cells)) {
    const node = panel.locator(`[data-reverse-cell="${cell}"]`);
    await node.focus();
    await page.keyboard.press(digit);
  }
}

/** 오버레이 svg 상자가 본 캔버스 상자와 1px 이내로 같은지. */
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
}

test('A1 4자리 컬러 슬라이서 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u1.A1', '4자리 컬러 슬라이서');
  await screenshot(page, 'g4s1u1-a1.png');

  // T1 — 3자리로 잘라 GROUP3 ①·②를 본 뒤 4자리로 고치고 바르게 읽는다.
  const first = slot(page, 'main');
  await field(page, 'read').getByRole('button', { name: '오천이백팔십사만', exact: true }).click();
  await toggleCut(page, first, 3);
  await submit(page);
  await expectFailedWithHint(page, '우리말로 읽을 때는 몇 자리마다 새 이름이 붙었지?');
  await submit(page);
  await expectFailedWithHint(page, '네 자리 덩어리와 세 자리 쉼표가 어긋난 곳을 보았어요.', 2);
  await expectOverlayAligned(first, 'four-digit-grid', 'base-ten-canvas');
  await toggleCut(page, first, 3);
  await toggleCut(page, first, 4);
  await submit(page);
  await expectPassed(page);

  // T2 — 잘못 만든 2300005로 ZERO-PLACE ①을 본 뒤 20300005로 고친다.
  const second = slot(page, 'main');
  await fillReverse(page, second, { 9: '2', 10: '3', 11: '0', 12: '0', 13: '0', 14: '0', 15: '5' });
  await submit(page);
  await expectFailedWithHint(page, '만 덩어리와 일 덩어리는 각각 몇 자리였지?');
  await fillReverse(page, second, {
    8: '2',
    9: '0',
    10: '3',
    11: '0',
    12: '0',
    13: '0',
    14: '0',
    15: '5',
  });
  await submit(page);
  await expectPassed(page);

  // T3 — 3528007140000에서 5가 나타내는 5000억을 고른다.
  await field(page, 'place').getByRole('button', { name: '5000억', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T4 — 억 10000개를 조 자리 1과 0으로 만든다.
  const fourth = slot(page, 'main');
  const zeros: Record<number, string> = { 3: '1' };
  for (let cell = 4; cell < 16; cell += 1) zeros[cell] = '0';
  await fillReverse(page, fourth, zeros);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 스케일 줌 수직선 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u1.A2', '스케일 줌 수직선');
  await screenshot(page, 'g4s1u1-a2.png');

  // T1 — 234만에서 10만씩 5번 뛰고 십만 자리를 고른다.
  const first = slot(page, 'main');
  for (let index = 0; index < 5; index += 1) {
    await first.getByRole('button', { name: '한 번 뛰기', exact: true }).click();
  }
  await field(page, 'place').getByRole('button', { name: '십만 자리', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T2 — 수직선을 넓게 보며 이정표 세 개를 작은 수부터 놓는다.
  const second = slot(page, 'main');
  for (let index = 0; index < 5; index += 1) {
    await second.getByRole('button', { name: '한 단계 넓게 보기', exact: true }).click();
  }
  const order = field(page, 'order');
  await order.getByRole('button', { name: /서울 인구 약 940만 위로/ }).click();
  await order.getByRole('button', { name: /지구에서 태양까지 약 1억 5000만 km 아래로/ }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 4억 2천만 < 42억. 크다를 골라 ①을 본 뒤 작다로 고친다.
  const compare = field(page, 'cmp');
  await compare.getByRole('button', { name: '크다', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '두 수는 각각 몇 자리 수야?');
  await compare.getByRole('button', { name: '작다', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T4 — 7억 3500만 < 7억 5300만. 크다를 골라 ①을 본 뒤 작다로 고친다.
  const lastCompare = field(page, 'cmp');
  await lastCompare.getByRole('button', { name: '크다', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '두 수 모두 억이 7개예요. 어느 자리부터 비교할까요?');
  await lastCompare.getByRole('button', { name: '작다', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g4s1u1.A1', title: '4자리 컬러 슬라이서' },
    { id: 'g4s1u1.A2', title: '스케일 줌 수직선' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
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
    console.log('g4s1u1 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
    if ((metrics?.pageHeight ?? 0) > (metrics?.viewportHeight ?? 0) + 1) {
      await expectContentPanelsReachable(page);
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({
      ratio: 1,
    });
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    if ((await responseSlot(page).count()) > 0) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g4s1u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s1u1.A1`);
  await expect(page.getByRole('heading', { name: '4자리 컬러 슬라이서' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '4자리 컬러 슬라이서' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
