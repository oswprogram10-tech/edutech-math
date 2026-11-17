import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E12 `shapes-sort` 모드 샌드박스 E2E(아이패드·크롬북·전자칠판).
 * 굴러가는지·쌓이는지·가린 모양은 관찰(JSON)에만 있고 화면에는 결과 글이 없다.
 * 연출은 정해진 규칙이라 움직임 줄이기를 켜면 바로 끝 위치로 간다(스냅샷·측정은 그 상태에서).
 */

interface ShapesObservation {
  readonly mode?: string;
  readonly scene?: string;
  readonly selected?: string | null;
  readonly selectedKind?: string | null;
  readonly trials?: readonly { kind: string; pose: string; result: string }[];
  readonly rampPlayed?: boolean;
  readonly rampResult?: string | null;
  readonly towerHeight?: number;
  readonly fallenCount?: number;
  readonly cluesShown?: number;
  readonly mysteryKind?: string | null;
  readonly [key: string]: unknown;
}

async function openShapes(
  page: Page,
  config?: Record<string, unknown>,
  options: { readonly stageFit?: boolean; readonly overlay?: string } = {},
) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const params = new URLSearchParams();
  if (options.stageFit) params.set('stage', 'fit');
  if (options.overlay) params.set('overlay', options.overlay);
  params.set('config', JSON.stringify({ mode: 'shapes-sort', ...config }));
  await page.goto(`/?${params.toString()}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('shapes-sort');
  await expect(page.getByTestId('ss-view')).toBeVisible();
}

async function useLargeTargets(page: Page) {
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expect(page.getByRole('button', { name: '터치 64px' })).toBeVisible();
}

async function readObservation(page: Page): Promise<ShapesObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as ShapesObservation;
}

async function pollObservation(
  page: Page,
  check: (obs: ShapesObservation) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function playOnRamp(page: Page, shelfId: string) {
  await page.getByTestId(`ss-shelf-${shelfId}`).click();
  await page.getByTestId('ss-ramp-place').click();
  await page.getByTestId('ss-play').click();
}

test('공을 경사로에서 ▶ → 구른다(roll), 결과 글은 화면에 없다', async ({ page }) => {
  await openShapes(page);
  await useLargeTargets(page);
  await playOnRamp(page, 'sphere');
  await pollObservation(page, (o) => o.rampPlayed === true && o.rampResult === 'roll');
  const view = page.getByTestId('ss-view');
  await expect(view).not.toContainText(/굴러|멈춰|맞|틀|정답/);
  // 결과 속성은 경사로 물건에 달지 않는다
  await expect(page.getByTestId('ss-ramp-item')).not.toHaveAttribute('data-result', /.*/);
  // 움직임 줄이기: 바로 바닥 끝에 가 있다
  await expect(page.getByTestId('ss-ramp-item')).toHaveAttribute(
    'transform',
    /translate\(372 224\)/,
  );
  // 지난 시도가 그림 줄에 남는다
  await expect(page.getByTestId('ss-trial-0')).toBeVisible();
});

test('둥근기둥: 세우면 머물고(stay) 눕히면 구른다(roll)', async ({ page }) => {
  await openShapes(page);
  await useLargeTargets(page);
  await playOnRamp(page, 'cylinder');
  await pollObservation(page, (o) => o.rampResult === 'stay');
  await page.getByTestId('ss-pose-lying').click();
  await pollObservation(page, (o) => o.rampResult === null && o.rampPlayed === false);
  await page.getByTestId('ss-play').click();
  await pollObservation(page, (o) => o.rampResult === 'roll');
  const obs = await readObservation(page);
  expect(obs.trials?.map((t) => `${t.pose}:${t.result}`)).toEqual(['standing:stay', 'lying:roll']);
  await page.getByTestId('ss-pose-standing').click();
  await page.getByTestId('ss-play').click();
  await pollObservation(page, (o) => o.rampResult === 'stay');
});

test('연출이 끝나면 끝 위치에 서고 관찰은 연출과 상관없이 바로 정해진다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '연출 시간 측정은 크롬북 한 곳에서');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(
    `/?config=${encodeURIComponent(JSON.stringify({ mode: 'shapes-sort', scene: 'ramp' }))}#/sandbox/E12`,
  );
  await page.getByLabel('모드').selectOption('shapes-sort');
  await expect(page.getByTestId('ss-view')).toBeVisible();
  await playOnRamp(page, 'sphere');
  await expect(page.getByTestId('ss-ramp')).toHaveAttribute('data-running', 'true');
  await pollObservation(page, (o) => o.rampResult === 'roll');
  await expect(page.getByTestId('ss-ramp')).toHaveAttribute('data-running', 'false', {
    timeout: 5000,
  });
  await expect(page.getByTestId('ss-ramp-item')).toHaveAttribute(
    'transform',
    /translate\(372 224\)/,
  );
});

test('상자 3개를 탑에 쌓으면 towerHeight 3, 공을 올리면 떨어져 fallenCount 1', async ({ page }) => {
  await openShapes(page, { objects: ['box', 'box', 'box', 'sphere'], towerMax: 4 });
  await useLargeTargets(page);
  for (const id of ['box', 'box-2', 'box-3']) {
    await page.getByTestId(`ss-shelf-${id}`).click();
    await page.getByTestId('ss-tower-stack').click();
    await page.getByTestId(`ss-shelf-${id}`).click();
  }
  await pollObservation(page, (o) => o.towerHeight === 3 && o.fallenCount === 0);
  await expect(page.getByTestId('ss-tower-slot-2')).toHaveAttribute('data-filled', 'true');
  await expect(page.getByTestId('ss-tower-slot-3')).toHaveAttribute('data-filled', 'false');
  await page.getByTestId('ss-shelf-sphere').click();
  await page.getByTestId('ss-tower-stack').click();
  await pollObservation(page, (o) => o.towerHeight === 3 && o.fallenCount === 1);
  await expect(page.getByTestId('ss-tower-fallen-0')).toBeVisible();
  // 탑 높이를 숫자나 글로 쓰지 않는다
  await expect(page.getByTestId('ss-view')).not.toContainText(/\d|떨어|쌓였/);
  await page.getByTestId('ss-tower-unstack').click();
  await pollObservation(page, (o) => o.towerHeight === 2);
  await page.getByTestId('ss-tower-clear').click();
  await pollObservation(page, (o) => o.towerHeight === 0 && o.fallenCount === 0);
});

test('가린 상자: 만져 보기 두 번 → 단서 카드 2장, 모양 이름은 화면에 없다', async ({ page }) => {
  await openShapes(page, { scene: 'mystery', mystery: { kind: 'box', shadow: 'top' } });
  await useLargeTargets(page);
  await expect(page.getByTestId('ss-shadow')).toBeVisible();
  await page.getByTestId('ss-touch').click();
  await pollObservation(page, (o) => o.cluesShown === 1);
  await expect(page.getByTestId('ss-clue-0')).toContainText('평평한 곳이 있어요');
  await page.getByTestId('ss-touch').click();
  await pollObservation(page, (o) => o.cluesShown === 2);
  await expect(page.getByTestId('ss-clue-1')).toContainText('뾰족한 곳이 있어요');
  await expect(page.getByTestId('ss-touch')).toBeDisabled();
  await expect(page.getByTestId('ss-view')).not.toContainText(/상자|둥근기둥|원기둥|공/);
  // 학생은 선반에서 모양을 골라 답한다
  await page.getByTestId('ss-shelf-box').click();
  await pollObservation(page, (o) => o.selectedKind === 'box' && o.mysteryKind === 'box');
});

test('키보드만으로 경사로 ▶와 탑 쌓기를 한다', async ({ page }) => {
  await openShapes(page);
  await page.getByTestId('ss-shelf-box').focus();
  await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.selectedKind === 'box');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.selectedKind === 'sphere');
  await expect(page.getByTestId('ss-shelf-sphere')).toBeFocused();
  await page.keyboard.press('r');
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.rampResult === 'roll' && o.trials?.length === 1);
  await page.keyboard.press('t');
  await pollObservation(page, (o) => o.towerHeight === 1);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('l');
  await page.keyboard.press('t');
  await pollObservation(page, (o) => o.towerHeight === 1 && o.fallenCount === 1);
  await page.keyboard.press('u');
  await pollObservation(page, (o) => o.towerHeight === 0);
  // 둥근기둥을 세우고(S) 눕혀(L) 경사로에 올려 굴린다
  await page.keyboard.press('r');
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.rampResult === 'roll');
  await page.keyboard.press('s');
  await page.keyboard.press('r');
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.rampResult === 'stay' && o.trials?.length === 3);
  // 만지기는 가린 상자가 있을 때만
  await page.keyboard.press('m');
  await expect.poll(async () => (await readObservation(page)).cluesShown).toBe(0);
});

test('조작 단추는 모두 64px 이상이다(저학년 기준)', async ({ page }) => {
  await openShapes(page, { towerMax: 3 });
  await useLargeTargets(page);
  await page.getByTestId('ss-shelf-cylinder').click();
  const ids = [
    'ss-shelf-box',
    'ss-shelf-cylinder',
    'ss-shelf-sphere',
    'ss-pose-standing',
    'ss-pose-lying',
    'ss-ramp-place',
    'ss-play',
    'ss-ramp-reset',
    'ss-tower-stack',
    'ss-tower-unstack',
    'ss-tower-clear',
  ];
  for (const id of ids) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box) continue;
    expect(box.width, `${id} 너비`).toBeGreaterThanOrEqual(63.5);
    expect(box.height, `${id} 높이`).toBeGreaterThanOrEqual(63.5);
  }
  await openShapes(page, { scene: 'mystery', mystery: { kind: 'sphere' } });
  await useLargeTargets(page);
  const touch = await page.getByTestId('ss-touch').boundingBox();
  expect(touch?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  expect(touch?.width ?? 0).toBeGreaterThanOrEqual(63.5);
});

test('힌트 ② turn-same 오버레이가 경사로 그림에 맞춰 그려진다', async ({ page }) => {
  await openShapes(page, undefined, { overlay: 'turn-same' });
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="turn-same"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByTestId('turn-same-standing')).toBeVisible();
  await expect(overlay.getByTestId('turn-same-lying')).toBeVisible();
  await expect(overlay).not.toContainText(/상자|둥근기둥|원기둥|공/);
  await expect
    .poll(async () => {
      const o = await overlay.locator('svg').boundingBox();
      const c = await page.getByTestId('ss-ramp').boundingBox();
      if (!o || !c) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(o.x - c.x),
        Math.abs(o.y - c.y),
        Math.abs(o.width - c.width),
        Math.abs(o.height - c.height),
      );
    })
    .toBeLessThanOrEqual(1);
});

test('샌드박스 스냅샷(ramp-and-tower 시작 화면, 단서 2개 화면)', async ({ page }) => {
  await openShapes(page);
  await useLargeTargets(page);
  await settle(page);
  await expect(page.getByTestId('ss-view')).toHaveScreenshot('ss-ramp-and-tower-start.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openShapes(page, { scene: 'mystery', mystery: { kind: 'box', shadow: 'top' } });
  await useLargeTargets(page);
  await page.getByTestId('ss-touch').click();
  await page.getByTestId('ss-touch').click();
  await pollObservation(page, (o) => o.cluesShown === 2);
  await settle(page);
  await expect(page.getByTestId('ss-view')).toHaveScreenshot('ss-mystery-two-clues.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('전체 기기 ?stage=fit: 장면·선반·주요 단추가 판 안에 다 들어온다(ratio 1)', async ({
  page,
}) => {
  await openShapes(page, undefined, { stageFit: true });
  await useLargeTargets(page);
  // 가장 높은 상태: 둥근기둥을 골라 세우기·눕히기 단추가 나오고, 지난 시도 줄도 있다
  await page.getByTestId('ss-shelf-cylinder').click();
  await page.getByTestId('ss-pose-lying').click();
  await page.getByTestId('ss-ramp-place').click();
  await page.getByTestId('ss-play').click();
  await pollObservation(page, (o) => o.rampResult === 'roll');
  await expect(page.getByTestId('ss-trial-0')).toBeVisible();
  const ids = [
    'ss-ramp',
    'ss-tower',
    'ss-shelf',
    'ss-shelf-box',
    'ss-shelf-sphere',
    'ss-pose-standing',
    'ss-pose-lying',
    'ss-ramp-place',
    'ss-play',
    'ss-ramp-reset',
    'ss-tower-stack',
    'ss-tower-unstack',
    'ss-tower-clear',
  ];
  for (const id of ids) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
  const view = await page.getByTestId('ss-view').boundingBox();
  expect(view).not.toBeNull();
  for (const id of ['ss-ramp', 'ss-tower', 'ss-shelf', 'ss-play', 'ss-tower-clear']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box || !view) continue;
    expect(box.x, id).toBeGreaterThanOrEqual(view.x - 0.5);
    expect(box.x + box.width, id).toBeLessThanOrEqual(view.x + view.width + 0.5);
  }
  // 가린 상자 장면도 같은 조건
  await openShapes(
    page,
    { scene: 'mystery', mystery: { kind: 'box', shadow: 'side' } },
    { stageFit: true },
  );
  await useLargeTargets(page);
  await page.getByTestId('ss-touch').click();
  await page.getByTestId('ss-touch').click();
  for (const id of [
    'ss-mystery',
    'ss-shadow',
    'ss-touch',
    'ss-clue-1',
    'ss-shelf',
    'ss-shelf-sphere',
  ]) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
});
