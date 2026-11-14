import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T136 g6s2u3 「공간과 입체」 15과제 단원 E2E.
 * - 세 활동(A1·A2·A3) 전체 흐름·오답·힌트·오개념 5코드 감지(3뷰포트)
 * - `hidden-reveal` 1px 정렬, `row-lineup`·`side-eye`·`views-twins` 표시
 * - 과제별 첫 화면 검사 + 대표 스냅샷(A1.T1, A2.T3, A3.T2) + 3D 열기 + 오프라인
 */

test.describe.configure({ timeout: 300_000 });

const GRID_ROWS = 3;
const GRID_COLS = 3;

const A1_T4_FLAT = [
  [1, 1, 0],
  [0, 1, 0],
  [1, 1, 1],
] as const;

const A1_T4_ANSWER = [
  [1, 3, 0],
  [0, 1, 0],
  [1, 1, 2],
] as const;

const A2_T1_NUMBERS = [
  [3, 2, 1],
  [2, 1, 0],
  [1, 0, 0],
] as const;

const A2_T4_L1 = [
  [1, 1, 0],
  [1, 1, 1],
  [1, 0, 0],
] as const;

const A2_T4_ANSWER = [
  [3, 2, 0],
  [2, 1, 1],
  [1, 0, 0],
] as const;

const A3_FLAT = [
  [1, 1, 1],
  [1, 1, 0],
  [1, 0, 0],
] as const;

const A3_MAX = [
  [2, 1, 3],
  [2, 1, 0],
  [1, 0, 0],
] as const;

const A3_MIN = [
  [1, 1, 3],
  [2, 1, 0],
  [1, 0, 0],
] as const;

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function setE12Renderer(page: Page, renderer: 'isometric' | '3d'): Promise<void> {
  await page.addInitScript((value: string) => {
    window.localStorage.setItem('mathexplorer.e12.renderer.v1', value);
  }, renderer);
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

async function typeNumberField(page: Page, id: string, digits: readonly string[]): Promise<void> {
  const target = field(page, id);
  const clearBtn = target.getByRole('button', { name: '모두 지우기', exact: true });
  if ((await clearBtn.count()) > 0 && (await clearBtn.isEnabled())) {
    await clearBtn.click();
  }
  await target
    .getByRole('button', { name: /^자연수 부분:/ })
    .first()
    .click();
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

/**
 * 무대 커서를 `[0, 0]`에서 목표 `(tx, ty)`로 이동하면서 키보드로 높이 행렬 차이만큼 쌓거나 뺀다.
 * matrix[r][c]는 r=0이 뒷줄(y=rows-1), r=rows-1이 앞줄(y=0).
 */
async function buildHeightsFrom(
  page: Page,
  current: readonly (readonly number[])[],
  target: readonly (readonly number[])[],
  rows = GRID_ROWS,
  cols = GRID_COLS,
): Promise<void> {
  const stage = slot(page, 'main').getByTestId('cubes-stage');
  await expect(stage).not.toHaveAttribute('data-renderer', 'probe');
  await stage.focus();

  // 이전 입력으로 커서가 어디에 있든 왼쪽 맨 앞 (0, 0)으로 되돌린다.
  for (let i = 0; i < cols; i += 1) {
    await page.keyboard.press('ArrowLeft');
  }
  for (let i = 0; i < rows; i += 1) {
    await page.keyboard.press('ArrowDown');
  }

  let curX = 0;
  let curY = 0;
  const moveTo = async (tx: number, ty: number) => {
    while (curX < tx) {
      await page.keyboard.press('ArrowRight');
      curX += 1;
    }
    while (curX > tx) {
      await page.keyboard.press('ArrowLeft');
      curX -= 1;
    }
    while (curY < ty) {
      await page.keyboard.press('ArrowUp');
      curY += 1;
    }
    while (curY > ty) {
      await page.keyboard.press('ArrowDown');
      curY -= 1;
    }
  };

  for (let r = rows - 1; r >= 0; r -= 1) {
    const y = rows - 1 - r;
    for (let x = 0; x < cols; x += 1) {
      const delta = (target[r]?.[x] ?? 0) - (current[r]?.[x] ?? 0);
      if (delta === 0) continue;
      await moveTo(x, y);
      const key = delta > 0 ? 'Enter' : 'Backspace';
      for (let i = 0; i < Math.abs(delta); i += 1) {
        await page.keyboard.press(key);
      }
    }
  }
}

const ZERO_GRID = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
] as const;

async function fillNumberGridByKeyboard(
  page: Page,
  matrix: readonly (readonly number[])[],
): Promise<void> {
  const grid = slot(page, 'main').getByTestId('cubes-numbers');
  await grid.locator('[data-num-cell="0,0"]').click();
  await grid.focus();

  let curR = 0;
  let curC = 0;
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
      const val = matrix[r]?.[c] ?? 0;
      if (val === 0) continue;
      while (curR < r) {
        await page.keyboard.press('ArrowDown');
        curR += 1;
      }
      while (curR > r) {
        await page.keyboard.press('ArrowUp');
        curR -= 1;
      }
      while (curC < c) {
        await page.keyboard.press('ArrowRight');
        curC += 1;
      }
      while (curC > c) {
        await page.keyboard.press('ArrowLeft');
        curC -= 1;
      }
      await page.keyboard.press(String(val));
    }
  }
}

async function paintCells(
  panel: Locator,
  view: 'top' | 'front' | 'side',
  coords: readonly (readonly [number, number])[],
): Promise<void> {
  for (const [r, c] of coords) {
    await panel.locator(`[data-paint-cell="${view},${r},${c}"]`).click();
  }
}

async function expectFirstScreen(
  page: Page,
  mode: 'fit' | 'reachable',
  locators: readonly Locator[] = [],
): Promise<void> {
  await expectNoPanelInnerScroll(page);
  if (mode === 'fit') {
    for (const loc of locators) {
      await expect(loc).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    return;
  }
  await expectContentPanelsReachable(page);
  // T137: 넘긴 요소가 (판 안 스크롤이나 페이지 스크롤로) 잘림 없이 닿는지 본다.
  for (const loc of locators) {
    await loc.scrollIntoViewIfNeeded();
    // 스크롤 뒤 소수점 픽셀 반올림(0.999)을 허용한다.
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
}

test('g6s2u3.A1 — 위·앞·옆에서 본 모양 5과제 흐름과 오개념·오버레이', async ({
  page,
}, testInfo) => {
  await setE12Renderer(page, 'isometric');
  await openActivity(page, 'g6s2u3.A1', '위·앞·옆에서 본 모양');

  const mainPanel = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 대표 스크린샷
  await expectFirstScreen(page, vp === 'ipad' ? 'reachable' : 'fit', [
    mainPanel.getByTestId('cubes-stage'),
    mainPanel.getByTestId('cubes-cards'),
    field(page, 'card'),
  ]);
  await screenshot(page, 'g6s2u3-a1.png');

  // T1: 나(MC-VIEW-DEPTH-IGNORED) ① → ②(row-lineup) → 가 통과
  await choose(page, 'card', '나');
  await submit(page);
  await expectFailedWithHint(page, '같은 줄에 앞뒤로 선 기둥 중 앞에서 보면 무엇이 보일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '왼쪽 줄 기둥들을 앞에서부터 나란히 세워 보았어요.', 2);
  await expect(mainPanel.locator('[data-overlay="row-lineup"]')).toBeVisible();
  await choose(page, 'card', '가');
  await submit(page);
  await expectPassed(page);

  // T2: 9 → MC ①, 다시 9 → MC ② + hidden-reveal 1px 정렬, 10 → 통과
  await typeNumberField(page, 'count', ['9']);
  await submit(page);
  await expectFailedWithHint(page, '아래층에서 받쳐 주는 쌓기나무가 있어야 하지 않을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '보이지 않는 쌓기나무를 점선으로 그렸어요.', 2);
  await expectOverlayAligned(mainPanel, 'hidden-reveal', 'cubes-canvas');
  await expect(mainPanel.locator('[data-overlay="hidden-reveal"] [data-hidden-cube]')).toHaveCount(
    1,
  );
  await typeNumberField(page, 'count', ['1', '0']);
  await submit(page);
  await expectPassed(page);

  // T3: 앞줄 1층 3개 → 일반 ① → 앞줄 x0=1, x1=2, x2=3 → 통과
  await buildHeightsFrom(page, ZERO_GRID, [
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 1],
  ]);
  await submit(page);
  await expectFailedWithHint(
    page,
    "'앞' 쪽에서 보면 왼쪽 줄부터 몇 층, 몇 층, 몇 층으로 보일까요?",
    1,
  );
  await buildHeightsFrom(
    page,
    [
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [1, 2, 3],
    ],
  );
  await submit(page);
  await expectPassed(page);

  // T4: 위 모양대로 1층만 → 일반 ① → 정답 높이 [[1,3,0],[0,1,0],[1,1,2]] → 통과
  await buildHeightsFrom(page, ZERO_GRID, A1_T4_FLAT);
  await submit(page);
  await expectFailedWithHint(
    page,
    '위에서 본 모양으로 놓을 자리를 먼저 정하고, 앞에서 본 모양으로 높이를 정해 볼까요?',
    1,
  );
  await buildHeightsFrom(page, A1_T4_FLAT, A1_T4_ANSWER);
  await submit(page);
  await expectPassed(page);

  // T5: 거울 오답 [[1,1,0],[1,1,1]] → MC 거울 ① → 다시 → ② side-eye → 지우기 → 정답 [[0,1,1],[1,1,1]]
  await paintCells(mainPanel, 'side', [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
  ]);
  await submit(page);
  await expectFailedWithHint(page, "오른쪽에서 볼 때 '앞'은 내 왼쪽일까요, 오른쪽일까요?", 1);
  await submit(page);
  await expectFailedWithHint(page, '오른쪽에서 보는 눈과 그 눈에서 본', 2);
  await expect(mainPanel.locator('[data-overlay="side-eye"]')).toBeVisible();
  await mainPanel.getByRole('button', { name: '지우기', exact: true }).click();
  await paintCells(mainPanel, 'side', [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ]);
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u3.A1 — T1 다, T2 일반 ①, T5 깊이 오답 ① 확인', async ({ page }) => {
  await setE12Renderer(page, 'isometric');
  await openActivity(page, 'g6s2u3.A1', '위·앞·옆에서 본 모양');
  const mainPanel = slot(page, 'main');

  // T1: 다 → 일반 ①, 가 → 통과
  await choose(page, 'card', '다');
  await submit(page);
  await expectFailedWithHint(
    page,
    "'앞' 표시 쪽에 서서 왼쪽 줄부터 몇 층으로 보이는지 세어 볼까요?",
    1,
  );
  await choose(page, 'card', '가');
  await submit(page);
  await expectPassed(page);

  // T2: 8 → 일반 ①, 10 → 통과
  await typeNumberField(page, 'count', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '1층, 2층, 3층으로 나누어 세어 볼까요?', 1);
  await typeNumberField(page, 'count', ['1', '0']);
  await submit(page);
  await expectPassed(page);

  // T3 통과
  await buildHeightsFrom(page, ZERO_GRID, [
    [0, 0, 0],
    [0, 0, 0],
    [1, 2, 3],
  ]);
  await submit(page);
  await expectPassed(page);

  // T4 통과
  await buildHeightsFrom(page, ZERO_GRID, A1_T4_ANSWER);
  await submit(page);
  await expectPassed(page);

  // T5: 가운데 줄 낮게 [[0,0,1],[1,1,1]] → MC 깊이 ① → 지우기 → 정답
  await paintCells(mainPanel, 'side', [
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ]);
  await submit(page);
  await expectFailedWithHint(
    page,
    '같은 줄에 앞뒤로 선 기둥 중 오른쪽에서 보면 무엇이 보일까요?',
    1,
  );
  await mainPanel.getByRole('button', { name: '지우기', exact: true }).click();
  await paintCells(mainPanel, 'side', [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ]);
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u3.A2 — 수 쓰기와 층별 그림 5과제 흐름과 오개념', async ({ page }, testInfo) => {
  await setE12Renderer(page, 'isometric');
  await openActivity(page, 'g6s2u3.A2', '위에서 본 모양에 수 쓰기와 층별 그림');

  const mainPanel = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1: 뒤 왼쪽 1 → 일반 ① → 다시 → ② hidden-reveal 그려짐 → 정답 [[3,2,1],[2,1,0],[1,0,0]]
  await mainPanel.getByTestId('cubes-numbers').locator('[data-num-cell="0,0"]').click();
  await page.keyboard.press('1');
  await submit(page);
  await expectFailedWithHint(page, '칸마다 몇 층까지 쌓였는지 무대를 돌려 확인해 볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '가려진 쌓기나무가 있는지 살펴보아요.', 2);
  await expect(mainPanel.locator('[data-overlay="hidden-reveal"]')).toBeVisible();
  expect(
    await mainPanel.locator('[data-overlay="hidden-reveal"] [data-hidden-cube]').count(),
  ).toBeGreaterThanOrEqual(1);
  await fillNumberGridByKeyboard(page, A2_T1_NUMBERS);
  await submit(page);
  await expectPassed(page);

  // T2: 무대 없음 확인, 6 → 일반 ①, 10 → 통과
  await expect(mainPanel.getByTestId('cubes-stage')).toHaveCount(0);
  await typeNumberField(page, 'count', ['6']);
  await submit(page);
  await expectFailedWithHint(page, '칸에 쓴 수는 무엇을 뜻할까요?', 1);
  await typeNumberField(page, 'count', ['1', '0']);
  await submit(page);
  await expectPassed(page);

  // T3 첫 화면 + 대표 스크린샷
  await expectFirstScreen(page, vp === 'ipad' ? 'reachable' : 'fit', [
    mainPanel.getByTestId('cubes-stage'),
    mainPanel.getByTestId('cubes-layer-2'),
  ]);
  await screenshot(page, 'g6s2u3-a2.png');

  // T3: 뜬 칸 r0,c2 칠하기 → MC-LAYER-FLOATING ① → 지우기 → 정답 칠하기
  await mainPanel.locator('[data-layer-cell="2,0,2"]').click();
  await submit(page);
  await expectFailedWithHint(page, '이 쌓기나무는 무엇 위에 올라가 있나요?', 1);
  await mainPanel.getByRole('button', { name: '지우기', exact: true }).click();
  await mainPanel.locator('[data-layer-cell="2,0,0"]').click();
  await mainPanel.locator('[data-layer-cell="2,1,1"]').click();
  await mainPanel.locator('[data-layer-cell="2,2,2"]').click();
  await submit(page);
  await expectPassed(page);

  // T4 첫 화면 검사 + 1층만 → 일반 ① → 정답 [[3,2,0],[2,1,1],[1,0,0]]
  await expectFirstScreen(page, vp === 'ipad' ? 'reachable' : 'fit', [
    mainPanel.getByTestId('cubes-stage'),
    mainPanel.getByTestId('cubes-layer-3'),
  ]);
  await buildHeightsFrom(page, ZERO_GRID, A2_T4_L1);
  await submit(page);
  await expectFailedWithHint(page, '1층 그림부터 차례로 놓아 볼까요?', 1);
  await buildHeightsFrom(page, A2_T4_L1, A2_T4_ANSWER);
  await submit(page);
  await expectPassed(page);

  // T5 첫 화면 검사(stageHidden + 층 카드 3장 + 응답 두 칸)
  await expect(mainPanel.getByTestId('cubes-stage')).toHaveCount(0);
  await expectFirstScreen(page, vp === 'ipad' ? 'reachable' : 'fit', [
    mainPanel.getByTestId('cubes-cards'),
    field(page, 'pick'),
    field(page, 'why'),
  ]);
  await choose(page, 'pick', '가');
  await choose(page, 'why', '2층 쌓기나무 아래가 비어 있어요');
  await submit(page);
  await expectFailedWithHint(page, '2층 그림의 칸마다 그 아래 1층 칸을 짚어 볼까요?', 1);
  await choose(page, 'pick', '나');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u3.A3 — 투영 탐정 5과제 흐름과 오개념·views-twins', async ({ page }, testInfo) => {
  await setE12Renderer(page, 'isometric');
  await openActivity(page, 'g6s2u3.A3', '투영 탐정');

  const mainPanel = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1: 위 모양대로 1층만 → 일반 ① → 최대 해 10개 → 통과
  await buildHeightsFrom(page, ZERO_GRID, A3_FLAT);
  await submit(page);
  await expectFailedWithHint(
    page,
    '위에서 본 모양으로 자리를 정하고, 앞과 옆에서 본 모양으로 높이를 정해 볼까요?',
    1,
  );
  await buildHeightsFrom(page, A3_FLAT, A3_MAX);
  await expect(mainPanel.getByTestId('cubes-stage')).toHaveAttribute('data-views-match', 'true');
  await submit(page);
  await expectPassed(page);

  // T2 첫 화면 + 대표 스크린샷
  await expectFirstScreen(page, vp === 'ipad' ? 'reachable' : 'fit', [
    mainPanel.getByTestId('cubes-stage'),
    mainPanel.getByTestId('cubes-attempts'),
  ]);
  await screenshot(page, 'g6s2u3-a3.png');

  // T2: 최대 해 10개 → 상태 ① → (x0, y2) = r0,c0 하나 빼서 9개("9개 ★ 가장 적어요") → 통과
  await buildHeightsFrom(page, ZERO_GRID, A3_MAX);
  await submit(page);
  await expectFailedWithHint(page, '세 모양은 같아요. 하나라도 더 뺄 수 있을까요?', 1);
  await buildHeightsFrom(page, A3_MAX, A3_MIN);
  await expect(mainPanel.getByTestId('cubes-attempts')).toContainText('9개');
  await expect(mainPanel.getByTestId('cubes-attempts')).toContainText('★ 가장 적어요');
  await submit(page);
  await expectPassed(page);

  // T3: 최소 해 9개 → 상태 ① → (x0, y2) 하나 더 놓아 10개 → 통과
  await buildHeightsFrom(page, ZERO_GRID, A3_MIN);
  await submit(page);
  await expectFailedWithHint(page, '세 모양을 그대로 두고 더 놓을 수 있는 자리가 있을까요?', 1);
  await buildHeightsFrom(page, A3_MIN, A3_MAX);
  await submit(page);
  await expectPassed(page);

  // T4 첫 화면 검사 + 하나뿐·하나뿐 → MC ① → 다시 → ② views-twins → 여러 가지·하나뿐 → 통과
  await expectFirstScreen(page, vp === 'ipad' ? 'reachable' : 'fit', [
    mainPanel.getByTestId('cubes-stage'),
    mainPanel.getByTestId('cubes-numbers'),
    field(page, 'views'),
    field(page, 'nums'),
  ]);
  await choose(page, 'views', '하나뿐이에요');
  await choose(page, 'nums', '하나뿐이에요');
  await submit(page);
  await expectFailedWithHint(page, '다른 친구가 쌓은 모양도 같은 세 모양이 될 수 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '같은 세 모양을 만드는 두 쌓기를 나란히 그렸어요.', 2);
  await expect(mainPanel.locator('[data-overlay="views-twins"]')).toBeVisible();
  await choose(page, 'views', '여러 가지일 수 있어요');
  await submit(page);
  await expectPassed(page);

  // T5: stageHidden, 최대 해 수 → 상태 ① → 최소 해 수 → 통과
  await expect(mainPanel.getByTestId('cubes-stage')).toHaveCount(0);
  await fillNumberGridByKeyboard(page, A3_MAX);
  await submit(page);
  await expectFailedWithHint(page, '세 모양은 그대로인데 줄일 수 있는 칸이 있을까요?', 1);
  await mainPanel.getByTestId('cubes-numbers').locator('[data-num-cell="0,0"]').click();
  await page.keyboard.press('1');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u3.A3 — 3D 무대 열기와 키보드 쌓기', async ({ page }) => {
  await setE12Renderer(page, '3d');
  await openActivity(page, 'g6s2u3.A3', '투영 탐정');

  const stage = slot(page, 'main').getByTestId('cubes-stage');
  await expect(stage).toBeVisible();
  await expect.poll(async () => stage.getAttribute('data-renderer')).not.toBe('probe');

  const renderer = await stage.getAttribute('data-renderer');
  if (renderer !== '3d') {
    test.skip(true, `Headless 환경에서 WebGL 사용 불가(폴백: ${String(renderer)})`);
    return;
  }

  await expect(stage.getByTestId('cubes-3d-canvas')).toBeVisible();
  await buildHeightsFrom(page, ZERO_GRID, A3_MAX);
  await expect(stage).toHaveAttribute('data-views-match', 'true');
  await submit(page);
  await expectPassed(page);
});

test('오프라인에서도 g6s2u3.A1 활동이 열린다', async ({ page, context }) => {
  await setE12Renderer(page, 'isometric');
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u3.A1`);
  await expect(page.getByRole('heading', { name: '위·앞·옆에서 본 모양' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '위·앞·옆에서 본 모양' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
