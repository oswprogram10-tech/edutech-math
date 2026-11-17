import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T147 g6s1u6 「직육면체의 겉넓이와 부피」 8과제 단원 E2E.
 * - A1(E12 `surface-volume` steps 5과제)·A2(E12 `surface-volume` `fixed-volume` 3과제) 흐름과 오개념 4코드 감지(3뷰포트)
 * - `unpainted-blink`(A1.T1, 정렬 1px)·`wrap-vs-fill`(A1.T3)·`unit-zoom`(A1.T5)·`wraps-compare`(A2.T3) 오버레이
 * - 첫 화면 검사 + 활동별 스냅샷 + 오프라인
 * - 학생 화면에는 넓이·부피 결과(52·24·150·125·1000000)가 보이지 않는다.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly config: Record<string, unknown>;
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g6s1u6.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세의 상자·부피를 따른다', () => {
  const cfg = (id: string): Record<string, unknown> => {
    for (const activity of content.activities) {
      const found = activity.tasks.find((t) => t.id === id);
      if (found) return found.config;
    }
    throw new Error(`과제 ${id}를 찾지 못했다.`);
  };
  expect(cfg('g6s1u6.A1.T1')['solid']).toEqual({ w: 4, d: 3, h: 2 });
  expect(cfg('g6s1u6.A1.T4')['solid']).toEqual({ w: 5, d: 5, h: 5 });
  expect(cfg('g6s1u6.A2.T1')['volume']).toBe(24);
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
// 과제마다 따로 적는다(없으면 'fit').
const FIRST_SCREEN: Record<string, Record<string, 'fit' | 'reachable'>> = {
  'A1.T1': { ipad: 'reachable' },
  'A2.T1': {},
  'A2.T2': { ipad: 'reachable' },
  'A2.T3': { ipad: 'reachable' },
};

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, heading: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** 수 칸을 비우고 숫자를 넣는다(칸은 최대 9자리). */
async function typeNumberField(
  page: Page,
  id: string,
  digits: string,
  viaFocus = false,
): Promise<void> {
  const button = field(page, id)
    .getByRole('button', { name: /^자연수 부분:/ })
    .first();
  if (viaFocus) await button.focus();
  else await button.click();
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.press('Backspace');
  }
  for (const key of digits) {
    await page.keyboard.press(key);
  }
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string | null,
  level: 1 | 2 | 3 = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  if (text !== null) {
    await expect(page.getByTestId('hint-text')).toContainText(text);
  }
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
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

async function expectOverlayAligned(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
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
}

async function expectFirstScreen(
  page: Page,
  mode: 'fit' | 'reachable',
  locators: readonly Locator[] = [],
): Promise<void> {
  await expectNoPanelInnerScroll(page);
  if (mode === 'fit') {
    for (const loc of locators) {
      // 0.1px 안팎의 서브픽셀 오차(IntersectionObserver)를 허용한다. 잘림은 0.99 미만으로 드러난다.
      await expect(loc).toBeInViewport({ ratio: 0.99 });
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    return;
  }
  await expectContentPanelsReachable(page);
  for (const loc of locators) {
    await loc.scrollIntoViewIfNeeded();
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
}

/** 학생 화면(판 전체)에 결과 값이 보이지 않는지 확인한다. */
async function expectNoResultValues(page: Page, values: readonly string[]): Promise<void> {
  const text = (await slot(page, 'main').textContent()) ?? '';
  for (const v of values) {
    expect(text, `판 글자에 ${v}가 없어야 한다`).not.toMatch(new RegExp(`(^|\\D)${v}(\\D|$)`));
  }
}

// ---------------------------------------------------------------- 도우미

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const;

/** 전개도 단계로 가서 펼치고, 칠하기 단계에서 주어진 면을 칠한다(펼치기는 이미 했으면 건너뜀). */
async function unfoldAndPaint(page: Page, faces: readonly (typeof FACES)[number][]): Promise<void> {
  const main = slot(page, 'main');
  if ((await main.getByTestId('sv-net-stage').count()) === 0) {
    await main.getByTestId('sv-step-unfold').click();
    await main.getByTestId('sv-unfold').click();
    await expect(main.getByTestId('sv-net-stage')).toBeVisible();
  }
  await main.getByTestId('sv-step-paint').click();
  for (const face of faces) {
    if ((await main.getByTestId(`sv-face-${face}`).getAttribute('data-painted')) !== 'true') {
      await main.getByTestId(`sv-face-${face}`).click();
    }
  }
}

async function fillLayer(page: Page): Promise<void> {
  await slot(page, 'main').getByTestId('sv-fill-layer').click();
}

/** fixed-volume: 상자를 고르고 기록한다. */
async function recordBox(page: Page, w: number, d: number): Promise<void> {
  const main = slot(page, 'main');
  await main.getByTestId(`sv-w-${w}`).click();
  await main.getByTestId(`sv-d-${d}`).click();
  await main.getByTestId('sv-log-add').click();
}

async function passA1T1(page: Page): Promise<void> {
  await unfoldAndPaint(page, FACES);
  await typeNumberField(page, 'area', '52');
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await typeNumberField(page, 'top', '12');
  await typeNumberField(page, 'front', '8');
  await typeNumberField(page, 'side', '6');
  await typeNumberField(page, 'times', '2');
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await fillLayer(page);
  await fillLayer(page);
  await typeNumberField(page, 'vol', '24');
  await submit(page);
  await expectPassed(page);
}

async function passA1T4(page: Page): Promise<void> {
  await typeNumberField(page, 'area', '150');
  await typeNumberField(page, 'vol', '125');
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g6s1u6.A1 — 펼쳐 칠하고 채워 보기 5과제 흐름·오개념·unpainted-blink 정렬', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'g6s1u6.A1', '펼쳐 칠하고 채워 보기');
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expect(main.getByTestId('sv-box-stage')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit', [
    main.getByTestId('sv-box-stage'),
    main.getByTestId('sv-step-rotate'),
    main.getByTestId('sv-step-paint'),
    main.getByTestId('sv-turn-left'),
    main.getByTestId('sv-turn-right'),
  ]);
  await expectNoResultValues(page, ['52', '26', '24']);
  await screenshot(page, 'g6s1u6-a1.png');

  // T1: 3면만 칠하고 26 → MC-SURFACE-3-FACES ① → 다시 → ② + unpainted-blink(그려짐·정렬) → 6면 칠하고 52 통과
  await unfoldAndPaint(page, ['front', 'top', 'left']);
  await typeNumberField(page, 'area', '26');
  await submit(page);
  await expectFailedWithHint(page, '전개도에 면이 몇 개였을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '전개도의 면을 하나씩 짚으며 모두 셌는지 확인해 봐요.', 2);
  await expectOverlayAligned(main, 'unpainted-blink', 'sv-net-stage');
  // 칠하지 않은 면 3개가 주황 테두리로 그려진다(칠한 면은 그리지 않음)
  await expect(
    main.locator('[data-overlay="unpainted-blink"] [data-testid^="unpainted-blink-face-"]'),
  ).not.toHaveCount(0);
  await unfoldAndPaint(page, FACES);
  await typeNumberField(page, 'area', '52');
  await submit(page);
  await expectPassed(page);

  // T2: 12·8·6·1 → MC-SURFACE-3-FACES ① → 12·8·6·2 통과
  await expectNoResultValues(page, ['12', '8', '6', '52']);
  await typeNumberField(page, 'top', '12');
  await typeNumberField(page, 'front', '8');
  await typeNumberField(page, 'side', '6');
  await typeNumberField(page, 'times', '1');
  await submit(page);
  await expectFailedWithHint(page, '보이지 않는 쪽에도 같은 면이 있을까요?', 1);
  await typeNumberField(page, 'times', '2');
  await submit(page);
  await expectPassed(page);

  // T3: 다 채우고 52 → MC-VOLUME-SURFACE-CONFUSION ① → 다시 → ② wrap-vs-fill → 24 통과
  await expect(main.getByTestId('sv-fill-stage')).toBeVisible();
  await fillLayer(page);
  await fillLayer(page);
  await typeNumberField(page, 'vol', '52');
  await submit(page);
  await expectFailedWithHint(page, '상자를 감싸는 양을 구했나요, 채우는 양을 구했나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '겉을 감싸는 것과 속을 채우는 것을 나란히 놓고 비교해 봐요.', 2);
  await expectOverlayAligned(main, 'wrap-vs-fill', 'sv-fill-stage');
  await typeNumberField(page, 'vol', '24');
  await submit(page);
  await expectPassed(page);

  // T4: 125·150 → MC-VOLUME-SURFACE-CONFUSION ① → 75·125 → MC-SURFACE-3-FACES(실패 두 번째라 ②) → 150·125 통과
  // (정육면체 ① 문구는 아래 '대표 오답' 테스트 뒤의 따로 있는 테스트에서 첫 실패로 본다)
  await typeNumberField(page, 'area', '125');
  await typeNumberField(page, 'vol', '150');
  await submit(page);
  await expectFailedWithHint(page, '어느 쪽이 감싸는 양이고 어느 쪽이 채우는 양일까요?', 1);
  await typeNumberField(page, 'area', '75');
  await typeNumberField(page, 'vol', '125');
  await submit(page);
  await expectFailedWithHint(page, '보이지 않는 쪽 면도 세었는지 상자를 돌려 확인해 봐요.', 2);
  await typeNumberField(page, 'area', '150');
  await submit(page);
  await expectPassed(page);

  // T5: 100 → MC-VOLUME-UNIT-CONVERT-100 ① → 10000 두 번 → ② unit-zoom(그려짐·정렬) → 1000000 통과
  await typeNumberField(page, 'cm3', '100');
  await submit(page);
  await expectFailedWithHint(page, '1m 한 줄에 1cm³ 쌓기나무가 몇 개 들어갈까요? 한 층에는요?', 1);
  await typeNumberField(page, 'cm3', '10000');
  await submit(page);
  await expectFailedWithHint(page, '한 줄, 한 층, 전체로 차례로 늘려 생각해 봐요.', 2);
  await expectOverlayAligned(main, 'unit-zoom', 'sv-box-stage');
  await expect(main.getByTestId('unit-zoom-row')).toBeVisible();
  await expect(main.getByTestId('unit-zoom-layer')).toBeVisible();
  await expect(main.getByTestId('unit-zoom-cube')).toBeVisible();
  await typeNumberField(page, 'cm3', '1000000');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u6.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u6.A1', '펼쳐 칠하고 채워 보기');
  const main = slot(page, 'main');

  // T1: 한 면만 칠하고 40 → 일반 ①
  await unfoldAndPaint(page, ['front']);
  await typeNumberField(page, 'area', '40');
  await submit(page);
  await expectFailedWithHint(page, '칠한 면마다 칸이 몇 개인지 세어 더해 볼까요?', 1);
  await unfoldAndPaint(page, FACES);
  await typeNumberField(page, 'area', '52');
  await submit(page);
  await expectPassed(page);

  // T2: 옆면 넓이가 틀림
  await typeNumberField(page, 'top', '12');
  await typeNumberField(page, 'front', '8');
  await typeNumberField(page, 'side', '5');
  await typeNumberField(page, 'times', '2');
  await submit(page);
  await expectFailedWithHint(page, '윗면은 가로와 세로가 각각 몇 cm인가요?', 1);
  await typeNumberField(page, 'side', '6');
  await submit(page);
  await expectPassed(page);

  // T3: 한 층만 채우고 24 → 일반 ①
  await fillLayer(page);
  await typeNumberField(page, 'vol', '24');
  await submit(page);
  await expectFailedWithHint(page, '한 층에 쌓기나무가 몇 개 들어가나요?', 1);
  await fillLayer(page);
  await submit(page);
  await expectPassed(page);

  // T4: 150·100 → 일반 ①
  await typeNumberField(page, 'area', '150');
  await typeNumberField(page, 'vol', '100');
  await submit(page);
  await expectFailedWithHint(page, '한 면의 넓이는 얼마이고, 쌓기나무는 한 층에 몇 개일까요?', 1);
  await typeNumberField(page, 'vol', '125');
  await submit(page);
  await expectPassed(page);

  // T5: 1000 → 일반 ①
  await typeNumberField(page, 'cm3', '1000');
  await submit(page);
  await expectFailedWithHint(page, '1m는 몇 cm인지 떠올려 볼까요?', 1);
  await typeNumberField(page, 'cm3', '1000000');
  await submit(page);
  await expectPassed(page, true);
  await expect(main.getByTestId('sv-box-stage')).toBeVisible();
});

test('g6s1u6.A1 — 키보드만으로 쌓기나무 한 층 채우기(L)와 답 입력을 한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u6.A1', '펼쳐 칠하고 채워 보기');
  await passA1T1(page);
  await passA1T2(page);
  const main = slot(page, 'main');
  await expect(main.getByTestId('sv-fill-stage')).toBeVisible();
  // 바닥 칸에서 Enter로 한 칸, L로 한 층
  await main.getByTestId('sv-cell-0-0').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('l');
  await page.keyboard.press('l');
  await typeNumberField(page, 'vol', '24', true);
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

test('g6s1u6.A1 — 칠하지 않고 확인하면 상태 ①, 정육면체 면 수 오답은 MC ①이 뜬다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'g6s1u6.A1', '펼쳐 칠하고 채워 보기');
  await typeNumberField(page, 'area', '52');
  await submit(page);
  await expectFailedWithHint(page, '펼친 전개도의 면을 눌러 칠해 볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, "'펼치기' 단계로 가서 면을 하나씩 눌러 봐요.", 2);
  await passA1T1(page);
  await passA1T2(page);
  await passA1T3(page);
  await typeNumberField(page, 'area', '75');
  await typeNumberField(page, 'vol', '125');
  await submit(page);
  await expectFailedWithHint(page, '정육면체에는 면이 몇 개 있을까요?', 1);
  await passA1T4(page);
});

// ---------------------------------------------------------------- A2

test('g6s1u6.A2 — 포장지를 아끼는 상자 3과제 흐름·오개념·wraps-compare 정렬', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'g6s1u6.A2', '포장지를 아끼는 상자');
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷(응답 칸 없음)
  await expect(main.getByTestId('sv-box-stage')).toBeVisible();
  await expect(slot(page, 'response')).toHaveCount(0);
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    main.getByTestId('sv-box-stage'),
    main.getByTestId('sv-w-1'),
    main.getByTestId('sv-w-24'),
    main.getByTestId('sv-d-1'),
    main.getByTestId('sv-log-add'),
  ]);
  await screenshot(page, 'g6s1u6-a2.png');

  // T1: 3가지 기록 → 일반 ① → 4가지 통과
  await recordBox(page, 1, 1);
  await recordBox(page, 1, 2);
  await recordBox(page, 2, 3);
  await submit(page);
  await expectFailedWithHint(page, '가로나 세로를 바꾸면 높이는 어떻게 달라지나요?', 1);
  await recordBox(page, 2, 2);
  await submit(page);
  await expectPassed(page);

  // T2: 2×3×4에 26 → MC-SURFACE-3-FACES ① → 1×1×24(98)·1×2×12(76)만 기록하고 76 → 일반(실패 두 번째라 ②) → 2×3×4(52)를 더해 52 통과
  await expect(main.getByTestId('sv-log')).toBeVisible();
  await recordBox(page, 2, 3);
  await expectFirstScreen(page, FIRST_SCREEN['A2.T2']?.[vp] ?? 'fit', [
    main.getByTestId('sv-box-stage'),
    main.getByTestId('sv-w-1'),
    main.getByTestId('sv-w-24'),
    main.getByTestId('sv-d-1'),
    main.getByTestId('sv-log-add'),
    main.getByTestId('sv-log-cell-0'),
    main.getByTestId('sv-log-remove-0'),
    field(page, 'least'),
  ]);
  await main.getByTestId('sv-log-cell-0').fill('26');
  await typeNumberField(page, 'least', '26');
  await submit(page);
  await expectFailedWithHint(page, '상자의 면은 모두 몇 개였을까요?', 1);
  await main.getByTestId('sv-log-remove-0').click();
  await recordBox(page, 1, 1);
  await recordBox(page, 1, 2);
  await main.getByTestId('sv-log-cell-0').fill('98');
  await main.getByTestId('sv-log-cell-1').fill('76');
  await typeNumberField(page, 'least', '76');
  await submit(page);
  await expectFailedWithHint(page, '가로, 세로, 높이가 서로 비슷한 상자도 기록해 봐요.', 2);
  await recordBox(page, 2, 3);
  await main.getByTestId('sv-log-cell-2').fill('52');
  await typeNumberField(page, 'least', '52');
  await submit(page);
  await expectPassed(page);

  // T3: 1×1×24(98)·2×3×4(52) 기록 → 맞아요 → MC-PERIMETER-AREA-SAME ① → 다시 → ② wraps-compare(그려짐·정렬) → 맞지 않아요 통과
  await recordBox(page, 1, 1);
  await recordBox(page, 2, 3);
  await main.getByTestId('sv-log-cell-0').fill('98');
  await main.getByTestId('sv-log-cell-1').fill('52');
  await expectFirstScreen(page, FIRST_SCREEN['A2.T3']?.[vp] ?? 'fit', [
    main.getByTestId('sv-box-stage'),
    main.getByTestId('sv-w-24'),
    main.getByTestId('sv-log-cell-1'),
    main.getByTestId('sv-log-remove-1'),
    field(page, 'claim').getByRole('button', { name: '맞아요', exact: true }),
    field(page, 'claim').getByRole('button', { name: '맞지 않아요', exact: true }),
  ]);
  await choose(page, 'claim', '맞아요');
  await submit(page);
  await expectFailedWithHint(page, '기록표에서 겉넓이가 모두 같았나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '두 상자의 포장지를 칸으로 비교해 봐요.', 2);
  // fixed-volume은 본 그림이 div(`sv-board`)라 오버레이가 판 전체 칸에 펼쳐진다. 정렬 1px 대신
  // 오버레이 svg가 판 칸 안에 있고 두 상자 전개도가 모두 그려지는지 본다(메모 '엔진 수정 요청').
  const wc = main.locator('[data-overlay="wraps-compare"]');
  await expect(wc).toBeVisible();
  await expect(wc.getByTestId('wraps-compare-long')).toBeVisible();
  await expect(wc.getByTestId('wraps-compare-best')).toBeVisible();
  const wcBox = await wc.locator('svg').boundingBox();
  const panelBox = await main.boundingBox();
  expect(wcBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  if (wcBox && panelBox) {
    expect(wcBox.x).toBeGreaterThanOrEqual(panelBox.x - 1);
    expect(wcBox.y).toBeGreaterThanOrEqual(panelBox.y - 1);
    expect(wcBox.x + wcBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
    expect(wcBox.y + wcBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
  }
  await choose(page, 'claim', '맞지 않아요');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u6.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u6.A2', '포장지를 아끼는 상자');
  const main = slot(page, 'main');

  // T1: 같은 상자를 다시 기록할 수 없다(두 가지만) → 일반 ① → 4가지
  await recordBox(page, 1, 1);
  await expect(main.getByTestId('sv-log-add')).toBeDisabled();
  await recordBox(page, 2, 3);
  await submit(page);
  await expectFailedWithHint(page, '가로나 세로를 바꾸면 높이는 어떻게 달라지나요?', 1);
  await recordBox(page, 1, 2);
  await recordBox(page, 2, 2);
  await submit(page);
  await expectPassed(page);

  // T2: 겉넓이를 적지 않은 채 52 → 일반 ①
  await recordBox(page, 2, 3);
  await typeNumberField(page, 'least', '52');
  await submit(page);
  await expectFailedWithHint(
    page,
    '기록한 상자들 가운데 겉넓이가 가장 작은 것은 어떤 모양인가요?',
    1,
  );
  await main.getByTestId('sv-log-cell-0').fill('52');
  await submit(page);
  await expectPassed(page);

  // T3: 상자 하나만 기록하고 맞지 않아요 → 일반 ①
  await recordBox(page, 2, 3);
  await main.getByTestId('sv-log-cell-0').fill('52');
  await choose(page, 'claim', '맞지 않아요');
  await submit(page);
  await expectFailedWithHint(page, '기록한 상자들의 겉넓이를 다시 계산해 볼까요?', 1);
  await recordBox(page, 1, 1);
  await main.getByTestId('sv-log-cell-1').fill('98');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 샌드박스(관찰 확인)

interface SvObservation {
  readonly dims?: readonly number[];
  readonly logRows?: readonly { w: number; d: number; h: number; surface: number | null }[];
  readonly minSurfaceLogged?: boolean;
  readonly logDistinct?: number;
  readonly [key: string]: unknown;
}

async function readObservation(page: Page): Promise<SvObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as SvObservation;
}

test('g6s1u6.A2.T2 설정에서 겉넓이가 가장 작은 상자는 2×3×4(minSurfaceBox)다', async ({ page }) => {
  const config = content.activities[1]?.tasks[1]?.config ?? {};
  await page.goto(`/?config=${encodeURIComponent(JSON.stringify(config))}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('surface-volume');
  await expect(page.getByTestId('sv-view')).toBeVisible();
  await page.getByTestId('sv-w-2').click();
  await page.getByTestId('sv-d-3').click();
  await page.getByTestId('sv-log-add').click();
  await page.getByTestId('sv-log-cell-0').fill('52');
  await expect.poll(async () => (await readObservation(page)).minSurfaceLogged).toBe(true);
  const obs = await readObservation(page);
  expect(obs.logRows?.map((r) => [r.w, r.d, r.h])).toEqual([[2, 3, 4]]);
  // 1×1×24와 1×2×12만 기록하면 가장 작은 상자는 기록되지 않은 것이다
  await page.getByTestId('sv-log-remove-0').click();
  await page.getByTestId('sv-w-1').click();
  await page.getByTestId('sv-d-1').click();
  await page.getByTestId('sv-log-add').click();
  await page.getByTestId('sv-log-cell-0').fill('98');
  await expect.poll(async () => (await readObservation(page)).logDistinct).toBe(1);
  expect((await readObservation(page)).minSurfaceLogged).toBe(false);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g6s1u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s1u6.A1`);
  await expect(page.getByRole('heading', { name: '펼쳐 칠하고 채워 보기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '펼쳐 칠하고 채워 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
