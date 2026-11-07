import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T063 g3s1u3 「나눗셈」 단원 E2E.
 * A1(share·measure-out·분류)·A2(dot-array)를 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
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

async function pickSortCard(panel: Locator, label: string): Promise<void> {
  await panel.getByRole('button', { name: `${label} 옮길 카드로 고르기` }).click();
}

async function placeSortCard(panel: Locator, bin: string): Promise<void> {
  await panel.getByRole('button', { name: `${bin} 여기에 놓기` }).click();
}

const SHARE_BIN = '나누어 주기';
const MEASURE_BIN = '덜어 내기';
const C1 = '사탕 12개를 3명에게 똑같이 나누어 주면 한 명에게 몇 개일까요?';
const C2 = '사탕 12개를 4개씩 봉지에 담으면 몇 봉지일까요?';
const C3 = '연필 15자루를 5명이 똑같이 나누어 가지면 한 명이 몇 자루일까요?';
const C4 = '쿠키 20개를 한 접시에 5개씩 담으면 몇 접시일까요?';

test('A1 나누어 주기와 덜어 내기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u3.A1', '나누어 주기와 덜어 내기');
  await screenshot(page, 'g3s1u3-a1.png');

  // T1 — 5·4·3으로 나눠 UNEQUAL-SHARE를 만나고, 한 번 더 틀려 ② 막대를 본 뒤 고친다.
  const share = slot(page, 'main');
  const plate = (name: string) => share.getByRole('button', { name, exact: true });
  for (let index = 0; index < 5; index += 1) await plate('1번 접시').click();
  for (let index = 0; index < 4; index += 1) await plate('2번 접시').click();
  for (let index = 0; index < 3; index += 1) await plate('3번 접시').click();
  await submit(page);
  await expectFailedWithHint(page, '접시마다 사탕 수가 모두 같아?');
  await submit(page);
  await expectFailedWithHint(page, '접시마다 사탕 수를 막대로 세워 보았어요.', 2);
  await expectOverlayAligned(share, 'plate-bars', 'counters-canvas');
  // 되돌리기 버튼으로 5·4·3을 4·4·3으로 만들고, 모자란 접시를 채운다.
  await share.getByRole('button', { name: '1번 접시에서 하나 되돌리기' }).click();
  await share.getByRole('button', { name: '2번 접시에서 하나 되돌리기' }).click();
  await share.getByRole('button', { name: '3번 접시에서 하나 되돌리기' }).click();
  await plate('2번 접시').click();
  await plate('3번 접시').click();
  await plate('3번 접시').click();
  await submit(page);
  await expectPassed(page);

  // T2 — 두 봉지만 담고 2라고 써서 일반 힌트를 만난 뒤, 한 봉지 더 담고 3으로 고친다.
  const measure = slot(page, 'main');
  await measure.getByRole('button', { name: '4개 덜어 내기', exact: true }).click();
  await measure.getByRole('button', { name: '4개 덜어 내기', exact: true }).click();
  await typeNumber(page, 'bags', ['2']);
  await submit(page);
  await expectFailedWithHint(page, '남은 사탕이 있나요?');
  await measure.getByRole('button', { name: '4개 덜어 내기', exact: true }).click();
  await retypeNumber(page, 'bags', ['3']);
  await submit(page);
  await expectPassed(page);

  // T3 — c2를 나누어 주기에 잘못 놓아 일반 힌트를 만난 뒤, 빼서 제자리에 다시 놓는다.
  const sortPanel = responseSlot(page);
  await pickSortCard(sortPanel, C2);
  await placeSortCard(sortPanel, SHARE_BIN);
  await submit(page);
  await expectFailedWithHint(page, "이 이야기에서 알고 있는 건 '몇 묶음'이야");
  await sortPanel.getByRole('button', { name: `${C2} 빼기` }).click();
  await pickSortCard(sortPanel, C2);
  await placeSortCard(sortPanel, MEASURE_BIN);
  await pickSortCard(sortPanel, C1);
  await placeSortCard(sortPanel, SHARE_BIN);
  await pickSortCard(sortPanel, C3);
  await placeSortCard(sortPanel, SHARE_BIN);
  await pickSortCard(sortPanel, C4);
  await placeSortCard(sortPanel, MEASURE_BIN);
  await submit(page);
  await expectPassed(page);

  // T4 — 5·15·3으로 순서를 바꿔 ORDER-SWAP을 만난 뒤 15·5·3으로 고친다.
  const dots = slot(page, 'main');
  for (let index = 0; index < 3; index += 1) {
    await dots.getByRole('button', { name: '5개 덜어 내기', exact: true }).click();
  }
  await typeNumber(page, 'a', ['5']);
  await typeNumber(page, 'b', ['1', '5']);
  await typeNumber(page, 'q', ['3']);
  await submit(page);
  await expectFailedWithHint(page, '전체가 몇 개였지?');
  await retypeNumber(page, 'a', ['1', '5']);
  await retypeNumber(page, 'b', ['5']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 곱셈과 나눗셈 가족 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u3.A2', '곱셈과 나눗셈 가족');
  await screenshot(page, 'g3s1u3-a2.png');

  // T1 — 곱셈식 두 개만 골라 일반 힌트를 만난 뒤 나눗셈식도 고른다.
  const facts = responseSlot(page);
  await facts.getByRole('button', { name: '3 × 5 = 15', exact: true }).click();
  await facts.getByRole('button', { name: '5 × 3 = 15', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '한 줄에 몇 개, 몇 줄인가요?');
  await facts.getByRole('button', { name: '15 ÷ 3 = 5', exact: true }).click();
  await facts.getByRole('button', { name: '15 ÷ 5 = 3', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T2 — 5줄×4칸으로 만들어 일반 힌트를 만난 뒤 한 줄 늘려 6×4로 고친다.
  const array = slot(page, 'main');
  for (let index = 0; index < 5; index += 1) {
    await array.getByRole('button', { name: '줄 하나 늘리기', exact: true }).click();
  }
  for (let index = 0; index < 4; index += 1) {
    await array.getByRole('button', { name: '칸 하나 늘리기', exact: true }).click();
  }
  await typeNumber(page, 'q', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '점이 모두 24개인가요?');
  await array.getByRole('button', { name: '줄 하나 늘리기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 7×6을 골라 일반 힌트를 만난 뒤 7×8로 고친다.
  const fact = responseSlot(page);
  await fact.getByRole('button', { name: '7 × 6 = 42', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '7단에서 56이 나오는 곳을 찾아볼까요?');
  await fact.getByRole('button', { name: '7 × 8 = 56', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T4 — 5로 틀려 일반 힌트를 본 뒤 4로 고친다.
  await typeNumber(page, 'q', ['5']);
  await submit(page);
  await expectFailedWithHint(page, '9단 곱셈구구에서 36이 나오는 곳을 찾아볼까요?');
  await retypeNumber(page, 'q', ['4']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면 검사', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s1u3.A1', title: '나누어 주기와 덜어 내기' },
    { id: 'g3s1u3.A2', title: '곱셈과 나눗셈 가족' },
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
    console.log('g3s1u3 first screen', { project: testInfo.project.name, id: item.id, ...metrics });
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

test('오프라인에서도 g3s1u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s1u3.A1`);
  await expect(page.getByRole('heading', { name: '나누어 주기와 덜어 내기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '나누어 주기와 덜어 내기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
