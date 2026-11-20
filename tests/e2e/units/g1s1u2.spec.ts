import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectControlsAboveFold } from '../controls-fold';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T151 g1s1u2 「여러 가지 모양」 A2 「굴리고 쌓아 보기」 4과제 단원 E2E.
 * (A1 「모양 상자에 넣기」는 T218에서 아래쪽에 묶음으로 더했다.)
 * - 과제 4개 정답 통과, 상태 규칙·MC-SHAPE-ORIENTATION ①②, 일반 ① 대표 오답
 * - `turn-same` 오버레이가 그려지고 장면에 정렬 1px
 * - 첫 화면(크롬북 두 칸 배치 장면 높이), 64px 타깃, 키보드, 오프라인, 스냅샷
 * - 학생 화면에는 결론 글과 정답 모양 이름이 보이지 않고 "학년" 표시도 없다.
 * 움직임 줄이기를 켜서 연출이 바로 끝 위치로 가게 한다.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly prompt: string;
  readonly config: Record<string, unknown>;
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g1s1u2.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1·A2, 과제 4개씩)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g1s1u2.A1', 'g1s1u2.A2']);
  const tasks = content.activities[1]?.tasks ?? [];
  expect(tasks.map((t) => t.id)).toEqual([
    'g1s1u2.A2.T1',
    'g1s1u2.A2.T2',
    'g1s1u2.A2.T3',
    'g1s1u2.A2.T4',
  ]);
  expect(tasks[1]?.config['scene']).toBe('tower');
  expect(tasks[1]?.config['towerMax']).toBe(4);
  expect(tasks[3]?.config['mystery']).toEqual({ kind: 'cylinder', shadow: 'side' });
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
const FIRST_SCREEN: Record<string, Record<string, 'fit' | 'reachable'>> = {
  'A2.T1': { ipad: 'reachable' },
  'A2.T2': {},
  'A2.T3': { ipad: 'reachable' },
  'A2.T4': { ipad: 'reachable' },
};

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto('/#/activity/g1s1u2.A2');
  await expect(page.getByRole('heading', { name: '굴리고 쌓아 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await expect(main(page).getByTestId('ss-view')).toBeVisible();
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
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
  await expect(overlay.getByTestId('turn-same-standing')).toBeVisible();
  await expect(overlay.getByTestId('turn-same-lying')).toBeVisible();
}

async function expectFirstScreen(
  page: Page,
  mode: 'fit' | 'reachable',
  locators: readonly Locator[] = [],
): Promise<void> {
  await expectNoPanelInnerScroll(page);
  if (mode === 'fit') {
    for (const loc of locators) {
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

/** 학생 화면에 결론 글·학년 표시가 없는지 확인한다. */
async function expectNoConclusionText(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/굴러가요|멈춰 있어요|쌓여요|떨어져요|쌓였|[1-6]학년/);
}

// ---------------------------------------------------------------- 도우미

async function selectShelf(page: Page, id: string): Promise<void> {
  const shelf = main(page).getByTestId(`ss-shelf-${id}`);
  if ((await shelf.getAttribute('aria-pressed')) !== 'true') await shelf.click();
  await expect(shelf).toHaveAttribute('aria-pressed', 'true');
}

/** 물건을 골라 경사로에 올리고 ▶를 누른다. */
async function roll(page: Page, id: string, pose?: 'standing' | 'lying'): Promise<void> {
  await selectShelf(page, id);
  if (pose) await main(page).getByTestId(`ss-pose-${pose}`).click();
  await main(page).getByTestId('ss-ramp-place').click();
  await main(page).getByTestId('ss-play').click();
}

async function stack(page: Page, id: string, pose?: 'standing' | 'lying'): Promise<void> {
  await selectShelf(page, id);
  if (pose) await main(page).getByTestId(`ss-pose-${pose}`).click();
  await main(page).getByTestId('ss-tower-stack').click();
}

async function passT1(page: Page): Promise<void> {
  await roll(page, 'sphere');
  await choose(page, 'shape', '공 모양');
  await submit(page);
  await expectPassed(page);
}

async function passT2(page: Page): Promise<void> {
  await stack(page, 'b1');
  await stack(page, 'b2');
  await stack(page, 'b3');
  await submit(page);
  await expectPassed(page);
}

async function passT3(page: Page): Promise<void> {
  await roll(page, 'cylinder', 'standing');
  await roll(page, 'cylinder', 'lying');
  await choose(page, 'shape', '둥근기둥 모양');
  await choose(page, 'same', '같은 물건이에요');
  await submit(page);
  await expectPassed(page);
}

async function touch(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await main(page).getByTestId('ss-touch').click();
  }
}

// ---------------------------------------------------------------- 활동 흐름

test('g1s1u2.A2 — 굴리고 쌓아 보기 4과제 흐름·상태 규칙·MC-SHAPE-ORIENTATION·turn-same 정렬', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page);
  const vp = testInfo.project.name;
  const m = main(page);

  // T1 첫 화면 + 스냅샷 + 장면 높이 측정
  await expect(m.getByTestId('ss-ramp')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    m.getByTestId('ss-ramp'),
    m.getByTestId('ss-shelf-box'),
    m.getByTestId('ss-shelf-cylinder'),
    m.getByTestId('ss-shelf-sphere'),
    m.getByTestId('ss-ramp-place'),
    m.getByTestId('ss-play'),
    field(page, 'shape'),
  ]);
  const sceneBox = await m.getByTestId('ss-ramp').boundingBox();
  const mainBox = await m.boundingBox();
  const respBox = await slot(page, 'response').boundingBox();
  console.log(
    `[T151 ${vp}] T1 장면 ${Math.round(sceneBox?.width ?? 0)}x${Math.round(sceneBox?.height ?? 0)}, 교구 판 ${Math.round(mainBox?.width ?? 0)}x${Math.round(mainBox?.height ?? 0)}, 응답 판 ${Math.round(respBox?.width ?? 0)}x${Math.round(respBox?.height ?? 0)}`,
  );
  expect(sceneBox?.height ?? 0).toBeGreaterThanOrEqual(170);
  await expectNoConclusionText(page);
  await screenshot(page, 'g1s1u2-a2.png');

  // T1: 둥근기둥 → 상태 ① → 다시 → 상태 ② → 공을 굴려 보고 공 → 통과
  await choose(page, 'shape', '둥근기둥 모양');
  await submit(page);
  await expectFailedWithHint(page, '둥근기둥 모양을 세워서도 굴려 볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '세우기 단추를 누르고 ▶를 눌러 봐요.', 2);
  await roll(page, 'sphere');
  await choose(page, 'shape', '공 모양');
  await submit(page);
  await expectPassed(page);

  // T2: 장면 높이 측정 → 상자 2개 + 누운 둥근기둥 → 상태 1 ① → 다시 → ② + turn-same(정렬) → 상자 3개 통과
  await expect(m.getByTestId('ss-tower')).toBeVisible();
  const towerBox = await m.getByTestId('ss-tower').boundingBox();
  console.log(
    `[T151 ${vp}] T2 장면 ${Math.round(towerBox?.width ?? 0)}x${Math.round(towerBox?.height ?? 0)}`,
  );
  expect(towerBox?.height ?? 0).toBeGreaterThanOrEqual(170);
  await expectFirstScreen(page, FIRST_SCREEN['A2.T2']?.[vp] ?? 'fit', [
    m.getByTestId('ss-tower'),
    m.getByTestId('ss-shelf-b1'),
    m.getByTestId('ss-shelf-b3'),
    m.getByTestId('ss-tower-stack'),
  ]);
  await stack(page, 'b1');
  await stack(page, 'b2');
  await stack(page, 'c1', 'lying');
  await expect(m.getByTestId('ss-tower-slot-2')).toHaveAttribute('data-filled', 'true');
  await submit(page);
  await expectFailedWithHint(page, '누운 둥근기둥 위에 더 쌓을 수 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '둥근기둥을 세워서 다시 쌓아 봐요.', 2);
  await expectOverlayAligned(m, 'turn-same', 'ss-tower');
  await m.getByTestId('ss-tower-unstack').click();
  await stack(page, 'b3');
  await submit(page);
  await expectPassed(page);

  // T3: 둥근기둥·다른 물건 → MC ① → 다시 → MC ② + turn-same(정렬) → 두 방향 굴리고 같은 물건 통과
  await expect(m.getByTestId('ss-ramp')).toBeVisible();
  const ramp3 = await m.getByTestId('ss-ramp').boundingBox();
  expect(ramp3?.height ?? 0).toBeGreaterThanOrEqual(170);
  await expectFirstScreen(page, FIRST_SCREEN['A2.T3']?.[vp] ?? 'fit', [
    m.getByTestId('ss-ramp'),
    m.getByTestId('ss-shelf-cylinder'),
    m.getByTestId('ss-play'),
    field(page, 'same'),
  ]);
  await choose(page, 'shape', '둥근기둥 모양');
  await choose(page, 'same', '다른 물건이에요');
  await submit(page);
  await expectFailedWithHint(page, '둥근기둥을 돌려 놓으면 다른 물건이 될까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '같은 둥근기둥을 세웠다가 눕혀 봐요.', 2);
  await expectOverlayAligned(m, 'turn-same', 'ss-ramp');
  await roll(page, 'cylinder', 'standing');
  await roll(page, 'cylinder', 'lying');
  await choose(page, 'same', '같은 물건이에요');
  await submit(page);
  await expectPassed(page);

  // T4: 단서 2개 + 상자 → 상태 ① → 둥근기둥 → 통과
  await expect(m.getByTestId('ss-mystery')).toBeVisible();
  const mys = await m.getByTestId('ss-mystery').boundingBox();
  console.log(
    `[T151 ${vp}] T4 장면 ${Math.round(mys?.width ?? 0)}x${Math.round(mys?.height ?? 0)}`,
  );
  expect(mys?.height ?? 0).toBeGreaterThanOrEqual(170);
  await touch(page, 2);
  await expect(m.getByTestId('ss-clue-1')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A2.T4']?.[vp] ?? 'fit', [
    m.getByTestId('ss-mystery'),
    m.getByTestId('ss-touch'),
    field(page, 'shape'),
  ]);
  await choose(page, 'shape', '상자 모양');
  await submit(page);
  await expectFailedWithHint(page, '뾰족한 곳이 있었나요?', 1);
  await choose(page, 'shape', '둥근기둥 모양');
  await submit(page);
  await expectPassed(page, true);
});

test('g1s1u2.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page);
  const m = main(page);

  // T1: 굴려 보지 않고 공 → 일반 ①
  await choose(page, 'shape', '공 모양');
  await submit(page);
  await expectFailedWithHint(page, '모양마다 경사로에 올려 굴려 볼까요?', 1);
  await roll(page, 'sphere');
  await submit(page);
  await expectPassed(page);

  // T2: 상자 2개만 → 일반 ①
  await stack(page, 'b1');
  await stack(page, 'b2');
  await submit(page);
  await expectFailedWithHint(page, '모양을 하나씩 탑에 올려 볼까요?', 1);
  await stack(page, 'b3');
  await submit(page);
  await expectPassed(page);

  // T3: 세워서만 굴리고 둥근기둥·같은 물건 → 일반 ①
  await roll(page, 'cylinder', 'standing');
  await choose(page, 'shape', '둥근기둥 모양');
  await choose(page, 'same', '같은 물건이에요');
  await submit(page);
  await expectFailedWithHint(page, '둥근기둥 모양을 세워서 한 번, 눕혀서 한 번 굴려 볼까요?', 1);
  await roll(page, 'cylinder', 'lying');
  await submit(page);
  await expectPassed(page);

  // T4: 단서 1개에서 둥근기둥 → 일반 ①
  await touch(page, 1);
  await choose(page, 'shape', '둥근기둥 모양');
  await submit(page);
  await expectFailedWithHint(page, '만져 보기를 눌러 무엇이 느껴지는지 볼까요?', 1);
  await touch(page, 1);
  await submit(page);
  await expectPassed(page, true);
  // 정답 모양 이름이 장면 글에 없다
  await expect(m.getByTestId('ss-view')).not.toContainText(/상자|둥근기둥|원기둥|공/);
});

test('g1s1u2.A2.T2 — 공을 올리면 떨어짐(상태 2), 세운 둥근기둥은 허용한다', async ({ page }) => {
  test.slow();
  await openActivity(page);
  const m = main(page);
  await passT1(page);

  // 상자 위에 공 → 떨어짐 → 상태 2 ① → 다시 → ②
  await stack(page, 'b1');
  await stack(page, 's1');
  await expect(m.getByTestId('ss-tower-fallen-0')).toBeVisible();
  await submit(page);
  await expectFailedWithHint(page, '떨어진 모양은 어떤 모양이었나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '평평한 곳이 위아래에 있는 모양을 골라 봐요.', 2);

  // 모두 내리고 상자 2개 + 세운 둥근기둥 → 통과
  await m.getByTestId('ss-tower-clear').click();
  await stack(page, 'b1');
  await stack(page, 'b2');
  await stack(page, 'c1', 'standing');
  await submit(page);
  await expectPassed(page);
});

test('g1s1u2.A2 — 키보드만으로 A2.T2를 푼다(선반 방향키 + T)', async ({ page }) => {
  test.slow();
  await openActivity(page);
  const m = main(page);
  await passT1(page);

  await m.getByTestId('ss-shelf-b1').focus();
  await page.keyboard.press('ArrowRight');
  await expect(m.getByTestId('ss-shelf-b1')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(m.getByTestId('ss-shelf-b2')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('t');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
  await expect(m.getByTestId('ss-shelf-b3')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('t');
  await expect(m.getByTestId('ss-tower-slot-2')).toHaveAttribute('data-filled', 'true');
  await expect(m.getByTestId('ss-tower-slot-3')).toHaveAttribute('data-filled', 'false');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

test('g1s1u2.A2 — 조작 단추는 64px 이상이다(저학년 모드)', async ({ page }) => {
  await openActivity(page);
  const m = main(page);
  await m.getByTestId('ss-shelf-cylinder').click();
  const ids = [
    'ss-shelf-box',
    'ss-shelf-cylinder',
    'ss-shelf-sphere',
    'ss-pose-standing',
    'ss-pose-lying',
    'ss-ramp-place',
    'ss-play',
  ];
  for (const id of ids) {
    const box = await m.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box) continue;
    expect(box.width, `${id} 너비`).toBeGreaterThanOrEqual(63.5);
    expect(box.height, `${id} 높이`).toBeGreaterThanOrEqual(63.5);
  }
  for (const label of ['상자 모양', '둥근기둥 모양', '공 모양']) {
    const box = await field(page, 'shape').getByRole('button', { name: label }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  }
});

test('g1s1u2.A2.T4 — 단서와 그림자만 보이고 정답 모양 이름은 판에 없다', async ({ page }) => {
  test.slow();
  await openActivity(page);
  const m = main(page);
  await passT1(page);
  await passT2(page);
  await passT3(page);
  await expect(m.getByTestId('ss-mystery')).toBeVisible();
  await expect(m.getByTestId('ss-shadow')).toBeVisible();
  await touch(page, 2);
  await expect(m.getByTestId('ss-touch')).toBeDisabled();
  await expect(m).not.toContainText(/상자|둥근기둥|원기둥|공/);
  await expectNoConclusionText(page);
  await screenshot(page, 'g1s1u2-a2-t4.png');
  await choose(page, 'shape', '둥근기둥 모양');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- A1 모양 상자에 넣기 (T218)

const FAMILY_BINS_T1: Readonly<Record<string, string>> = {
  'o-eraser': '1',
  'o-milk': '1',
  'o-glue': '2',
  'o-roll': '2',
  'o-ball': '3',
  'o-bead': '3',
};
const FAMILY_BINS_T2: Readonly<Record<string, string>> = {
  'o-tissue': '1',
  'o-dice': '1',
  'o-eraser': '1',
  'o-glue': '2',
  'o-can-up': '2',
  'o-roll': '2',
  'o-ball': '3',
  'o-marble': '3',
  'o-orange': '3',
};
const FAMILY_BINS_T3: Readonly<Record<string, string>> = {
  'o-milk': '1',
  'o-dice': '1',
  'o-can-up': '2',
  'o-can-side': '2',
  'o-glue': '2',
  'o-ball': '3',
  'o-marble': '3',
};
/** 크기로 묶은 대표 오답(T1: 작은 것·중간 것·큰 것). 색은 모두 빨강이다. */
const SIZE_BINS_T1: Readonly<Record<string, string>> = {
  'o-eraser': '1',
  'o-glue': '1',
  'o-bead': '1',
  'o-milk': '2',
  'o-roll': '2',
  'o-ball': '3',
};

async function openA1(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto('/#/activity/g1s1u2.A1');
  await expect(page.getByRole('heading', { name: '모양 상자에 넣기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await expect(main(page).getByTestId('sorter-canvas')).toBeVisible();
}

async function keyPlace(page: Page, card: string, key: string): Promise<void> {
  const target = main(page).locator(`[data-card="${card}"]`);
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press(key);
}

async function placeCards(page: Page, bins: Readonly<Record<string, string>>): Promise<void> {
  for (const [card, key] of Object.entries(bins)) await keyPlace(page, card, key);
}

async function nameBins(page: Page): Promise<void> {
  const group = (index: number) =>
    main(page).getByRole('group', { name: `상자 ${index} 이름 붙이기` });
  await group(1).getByRole('button', { name: '상자 모양', exact: true }).click();
  await group(2).getByRole('button', { name: '둥근기둥 모양', exact: true }).click();
  await group(3).getByRole('button', { name: '공 모양', exact: true }).click();
}

async function settleSortCanvas(page: Page): Promise<void> {
  const canvas = main(page).getByTestId('sorter-canvas');
  await canvas.scrollIntoViewIfNeeded();
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await canvas.boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

async function sortScreenshot(page: Page, name: string): Promise<void> {
  await settleSortCanvas(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | SVGElement | null)?.blur();
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

async function expectSortOverlayAligned(page: Page, overlayName: string): Promise<Locator> {
  const overlay = main(page).locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
      const canvasBox = await main(page).getByTestId('sorter-canvas').boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return overlay;
}

test('g1s1u2.A1 — 모양 상자 4과제 흐름·MC-SHAPE-BY-COLOR-SIZE·MC-SHAPE-ORIENTATION·오버레이 정렬', async ({
  page,
}) => {
  test.slow();
  await openA1(page);

  // T1: 첫 화면·스냅샷, 크기로 묶기 → MC-SHAPE-BY-COLOR-SIZE ①② + gray-shapes(1px)
  await settleSortCanvas(page);
  await expectControlsAboveFold(page, 'g1s1u2.A1.T1', 0, 'sorter-controls');
  await sortScreenshot(page, 'g1s1u2-a1t1.png');
  await expectNoConclusionText(page);
  await placeCards(page, SIZE_BINS_T1);
  await submit(page);
  await expectFailedWithHint(page, '평평한 곳이 있어?', 1);
  await submit(page);
  await expectFailedWithHint(page, '회색으로 바꿔', 2);
  const gray = await expectSortOverlayAligned(page, 'gray-shapes');
  await expect(gray.locator('[data-gray]').first()).toBeVisible();
  await placeCards(page, FAMILY_BINS_T1);
  await nameBins(page);
  await submit(page);
  await expectPassed(page);

  // T2: 이름 그림을 붙이지 않으면 일반 ①, 붙이면 통과
  await settleSortCanvas(page);
  await expectControlsAboveFold(page, 'g1s1u2.A1.T2', 0, 'sorter-controls');
  await placeCards(page, FAMILY_BINS_T2);
  await submit(page);
  await expectFailedWithHint(page, '평평한 곳이 있나요, 둥근 곳이 있나요?', 1);
  await nameBins(page);
  await submit(page);
  await expectPassed(page);

  // T3: 캔을 다른 상자에 → MC-SHAPE-ORIENTATION ①② + rotate-match(1px) → 같은 상자로 통과
  await settleSortCanvas(page);
  await expectControlsAboveFold(page, 'g1s1u2.A1.T3', 0, 'sorter-controls');
  await keyPlace(page, 'o-can-up', '2');
  await keyPlace(page, 'o-can-side', '1');
  await submit(page);
  await expectFailedWithHint(page, '돌려 보면 어떻게 될까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '돌려 세운 캔 위에 겹쳐', 2);
  const rotate = await expectSortOverlayAligned(page, 'rotate-match');
  await expect(rotate.locator('[data-rotate-match]')).toHaveCount(1);
  await placeCards(page, FAMILY_BINS_T3);
  await submit(page);
  await expectPassed(page);

  // T4: 회색 모형 상자. 첫 화면·스냅샷, 엉뚱한 것을 꺼내면 일반 ①②(gray-shapes), 우유갑을 꺼내면 통과
  await settleSortCanvas(page);
  await expect(main(page).getByTestId('sorter-controls')).toHaveCount(0);
  await sortScreenshot(page, 'g1s1u2-a1t4.png');
  await keyPlace(page, 'o-glue', '0');
  await submit(page);
  await expectFailedWithHint(page, '굴러가는 것과 안 굴러가는 것은?', 1);
  await submit(page);
  await expectFailedWithHint(page, '회색 그림으로 겹쳐', 2);
  await expectSortOverlayAligned(page, 'gray-shapes');
  await keyPlace(page, 'o-glue', '1');
  await keyPlace(page, 'o-milk', '0');
  await submit(page);
  await expectPassed(page, true);
});

test('g1s1u2.A1 — 이름 아이콘 단추는 64px 이상이고 카드가 판 안에 있다', async ({ page }) => {
  await openA1(page);
  const buttons = main(page).getByTestId('sorter-controls').getByRole('button');
  const total = await buttons.count();
  expect(total).toBeGreaterThanOrEqual(9);
  for (let index = 0; index < total; index += 1) {
    const box = await buttons.nth(index).boundingBox();
    expect(box?.width ?? 0, `단추 ${index} 너비`).toBeGreaterThanOrEqual(63.5);
    expect(box?.height ?? 0, `단추 ${index} 높이`).toBeGreaterThanOrEqual(63.5);
  }
  // 카드가 판 상자 안에 있다.
  const canvasBox = await main(page).getByTestId('sorter-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;
  const cards = main(page).locator('[data-card]');
  const count = await cards.count();
  expect(count).toBe(6);
  for (let index = 0; index < count; index += 1) {
    const box = await cards.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
  }
  await expectNoConclusionText(page);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g1s1u2.A2 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s1u2.A2`);
  await expect(page.getByRole('heading', { name: '굴리고 쌓아 보기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '굴리고 쌓아 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
