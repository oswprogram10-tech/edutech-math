import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E12 `lathe` 모드 샌드박스 E2E(아이패드·크롬북·전자칠판).
 * 입체·단면 이름은 관찰(JSON)에만 있고 화면에는 없다.
 * 연출(한 바퀴 돌리기)은 움직임 줄이기를 켜면 바로 360°가 된다(스냅샷·측정은 그 상태에서).
 */

interface LatheObservation {
  readonly mode?: string;
  readonly profile?: string | null;
  readonly edge?: string | null;
  readonly angle?: number;
  readonly complete?: boolean;
  readonly solid?: string | null;
  readonly laser?: { plane: string; t: number } | null;
  readonly section?: string | null;
  readonly [key: string]: unknown;
}

const CUT = { crossSection: { planes: ['perpendicular', 'through-axis'] } };
const CONE_PRESET = { preset: { profile: 'right-triangle', edge: 'leg-vertical' } };

async function openLathe(
  page: Page,
  config?: Record<string, unknown>,
  options: { readonly stageFit?: boolean; readonly overlay?: string } = {},
) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const params = new URLSearchParams();
  if (options.stageFit) params.set('stage', 'fit');
  if (options.overlay) params.set('overlay', options.overlay);
  params.set('config', JSON.stringify({ mode: 'lathe', ...config }));
  await page.goto(`/?${params.toString()}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('lathe');
  await expect(page.getByTestId('lt-view')).toBeVisible();
}

async function readObservation(page: Page): Promise<LatheObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as LatheObservation;
}

async function pollObservation(
  page: Page,
  check: (obs: LatheObservation) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function build(page: Page, profile: string, edge: string) {
  await page.getByTestId(`lt-profile-${profile}`).click();
  await page.getByTestId(`lt-edge-${edge}`).click();
  await pollObservation(page, (o) => o.edge === edge && o.angle === 0);
  await page.getByTestId('lt-spin').click();
}

test('직사각형 세로 변 → 한 바퀴 → 관찰 solid cylinder, 이름은 화면에 없다', async ({ page }) => {
  await openLathe(page);
  await build(page, 'rectangle', 'long');
  await pollObservation(page, (o) => o.complete === true && o.solid === 'cylinder');
  const view = page.getByTestId('lt-view');
  await expect(view).not.toContainText(/원기둥|원뿔|팽이|마름모|이등변|직사각형|삼각형|반원/);
  await expect(page.getByTestId('lt-stage')).toHaveAttribute('data-complete', 'true');
  await expect(page.getByTestId('lt-solid')).toBeVisible();
  await expect(page.getByTestId('lt-dial')).toHaveAttribute('aria-valuenow', '360');
});

test('직각삼각형 빗변 → double-cone, 높이 변 → cone', async ({ page }) => {
  await openLathe(page);
  await build(page, 'right-triangle', 'hypotenuse');
  await pollObservation(page, (o) => o.solid === 'double-cone');
  await page.getByTestId('lt-edge-leg-vertical').click();
  await pollObservation(page, (o) => o.solid === null && o.angle === 0);
  await page.getByTestId('lt-spin').click();
  await pollObservation(page, (o) => o.solid === 'cone');
});

test('반원 지름 → sphere', async ({ page }) => {
  await openLathe(page);
  await build(page, 'semicircle', 'diameter');
  await pollObservation(page, (o) => o.solid === 'sphere');
});

test('preset 원뿔: 가로 레이저 t=5 → circle, 세로 레이저 → isosceles-triangle', async ({
  page,
}) => {
  await openLathe(page, { ...CONE_PRESET, ...CUT, rotateHandle: false });
  await expect(page.getByTestId('lt-dial')).toHaveCount(0);
  await pollObservation(page, (o) => o.complete === true && o.solid === 'cone');
  await page.getByTestId('lt-laser-h').click();
  await page.getByTestId('lt-laser-t').fill('5');
  await pollObservation(
    page,
    (o) => o.laser?.plane === 'perpendicular' && o.laser.t === 5 && o.section === 'circle',
  );
  await expect(page.getByTestId('lt-section')).toHaveAttribute('data-state', 'shown');
  await expect(page.getByTestId('lt-section')).not.toHaveAttribute('data-shape', /.*/);
  await page.getByTestId('lt-laser-t').fill('10');
  await pollObservation(page, (o) => o.section === 'point');
  await page.getByTestId('lt-laser-v').click();
  await pollObservation(
    page,
    (o) => o.laser?.plane === 'through-axis' && o.section === 'isosceles-triangle',
  );
  await expect(page.getByTestId('lt-laser-v-plane')).toBeVisible();
});

test('예측 과제: showSection false면 단면 칸에 ?만 있다', async ({ page }) => {
  await openLathe(page, {
    preset: { profile: 'rectangle', edge: 'long' },
    ...CUT,
    showSection: false,
  });
  await page.getByTestId('lt-laser-v').click();
  await pollObservation(page, (o) => o.section === 'rectangle');
  await expect(page.getByTestId('lt-section')).toHaveAttribute('data-state', 'hidden');
  await expect(page.getByTestId('lt-section-unknown')).toHaveText('?');
});

test('키보드만으로 원기둥을 만들고 레이저로 자른다', async ({ page }) => {
  await openLathe(page, CUT);
  await page.getByTestId('lt-profile-rectangle').focus();
  await page.keyboard.press('1');
  await pollObservation(page, (o) => o.profile === 'rectangle');
  await page.getByTestId('lt-edge-long').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.edge === 'long' && o.angle === 0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.angle === 60);
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o.angle === 30);
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.complete === true && o.solid === 'cylinder');
  await page.keyboard.press('h');
  await page.keyboard.press('ArrowUp');
  await pollObservation(page, (o) => o.laser?.plane === 'perpendicular' && o.laser.t === 6);
  await page.keyboard.press('v');
  await pollObservation(page, (o) => o.section === 'rectangle');
  await page.keyboard.press('e');
  await expect(page.getByTestId('lt-stage')).toBeVisible();
});

test('회전 손잡이를 끌면 놓을 때 30°에 맞는다', async ({ page }) => {
  await openLathe(page);
  await page.getByTestId('lt-profile-semicircle').click();
  await page.getByTestId('lt-edge-diameter').click();
  const box = await page.getByTestId('lt-dial').boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width / 2 - 14;
  await page.mouse.move(cx, cy - r);
  await page.mouse.down();
  await page.mouse.move(cx + r, cy, { steps: 6 });
  await page.mouse.move(cx + r * 0.7, cy + r * 0.8, { steps: 4 });
  await page.mouse.up();
  await pollObservation(page, (o) => typeof o.angle === 'number' && o.angle >= 120);
  const obs = await readObservation(page);
  expect((obs.angle ?? 1) % 30).toBe(0);
});

test('조작 단추는 모두 48px 이상이다', async ({ page }) => {
  await openLathe(page, { ...CONE_PRESET, ...CUT });
  await page.getByTestId('lt-profile-right-triangle').click();
  const ids = [
    'lt-profile-rectangle',
    'lt-profile-right-triangle',
    'lt-profile-semicircle',
    'lt-edge-leg-vertical',
    'lt-edge-leg-horizontal',
    'lt-edge-hypotenuse',
    'lt-dial',
    'lt-spin',
    'lt-reset',
    'lt-laser-h',
    'lt-laser-v',
    'lt-laser-off',
  ];
  for (const id of ids) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box) continue;
    expect(box.width, `${id} 너비`).toBeGreaterThanOrEqual(47.5);
    expect(box.height, `${id} 높이`).toBeGreaterThanOrEqual(47.5);
  }
});

test('힌트 ② axis-compare 오버레이가 무대 그림에 맞춰 그려진다', async ({ page }) => {
  await openLathe(page, undefined, { overlay: 'axis-compare' });
  await page.getByTestId('lt-profile-right-triangle').click();
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="axis-compare"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByTestId('axis-compare-hypotenuse')).toBeVisible();
  await expect(overlay.getByTestId('axis-compare-leg')).toBeVisible();
  await expect(overlay).not.toContainText(/원뿔|팽이|원기둥/);
  await expect
    .poll(async () => {
      const o = await overlay.locator('svg').boundingBox();
      const c = await page.getByTestId('lt-stage').boundingBox();
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

test('힌트 ② n-grow 오버레이: 각뿔 네 장과 원뿔 한 장', async ({ page }) => {
  await openLathe(page, undefined, { overlay: 'n-grow' });
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="n-grow"]');
  await expect(overlay).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    await expect(overlay.getByTestId(`n-grow-pyramid-${i}`)).toBeVisible();
  }
  await expect(overlay.getByTestId('n-grow-cone')).toBeVisible();
});

test('샌드박스 스냅샷(120° 잔상 화면, 원뿔 + 가로 레이저 + 단면 패널)', async ({ page }) => {
  await openLathe(page, CUT);
  await page.getByTestId('lt-profile-right-triangle').click();
  await page.getByTestId('lt-edge-leg-vertical').click();
  await page.getByTestId('lt-edge-leg-vertical').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.angle === 120);
  await expect(page.getByTestId('lt-stage')).toHaveAttribute('data-ghosts', '4');
  await settle(page);
  await expect(page.getByTestId('lt-view')).toHaveScreenshot('lt-ghosts-120.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openLathe(page, { ...CONE_PRESET, ...CUT });
  await page.getByTestId('lt-laser-h').click();
  await page.getByTestId('lt-laser-t').fill('5');
  await pollObservation(page, (o) => o.section === 'circle' && o.laser?.t === 5);
  await settle(page);
  await expect(page.getByTestId('lt-view')).toHaveScreenshot('lt-cone-laser.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('전체 기기 ?stage=fit: 무대·다이얼·레이저 단추·단면 패널이 판 안에 다 들어온다(ratio 1)', async ({
  page,
}) => {
  await openLathe(page, CUT, { stageFit: true });
  await page.getByTestId('lt-profile-right-triangle').click();
  await page.getByTestId('lt-edge-hypotenuse').click();
  await page.getByTestId('lt-spin').click();
  await pollObservation(page, (o) => o.complete === true);
  await page.getByTestId('lt-laser-h').click();
  await pollObservation(page, (o) => o.section === 'circle');
  const ids = [
    'lt-stage',
    'lt-profile-rectangle',
    'lt-profile-semicircle',
    'lt-edge-hypotenuse',
    'lt-dial',
    'lt-spin',
    'lt-reset',
    'lt-laser-h',
    'lt-laser-v',
    'lt-laser-off',
    'lt-laser-t',
    'lt-section',
  ];
  for (const id of ids) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
  const view = await page.getByTestId('lt-view').boundingBox();
  expect(view).not.toBeNull();
  for (const id of ['lt-stage', 'lt-dial', 'lt-laser-v', 'lt-section']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box || !view) continue;
    expect(box.x, id).toBeGreaterThanOrEqual(view.x - 0.5);
    expect(box.x + box.width, id).toBeLessThanOrEqual(view.x + view.width + 0.5);
  }
});
