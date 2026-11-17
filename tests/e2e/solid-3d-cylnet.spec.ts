import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E12 `net-fold` `target:'cylinder'`(원기둥 전개도) 샌드박스 E2E(아이패드·크롬북·전자칠판).
 * 샌드박스 모드 선택은 `net-fold`이고 설정 `target:'cylinder'`로 원기둥 전개도가 열린다.
 * 원주·자국 길이 수와 틈·겹침·맞음 글은 화면에 없고, 그림(띠·이음선)으로만 보인다.
 * 굴리기 연출은 움직임 줄이기를 켜면 바로 끝 위치로 간다(스냅샷·측정은 그 상태에서).
 */

interface CylObservation {
  readonly mode?: string;
  readonly step?: string | null;
  readonly rollEighths?: number;
  readonly rolledFull?: boolean;
  readonly net?: { readonly width: string; readonly radius: string; readonly height: string };
  readonly valid?: boolean;
  readonly folded?: boolean;
  readonly seam?: string;
  readonly [key: string]: unknown;
}

async function openCylinder(
  page: Page,
  config: Record<string, unknown> = {},
  options: { readonly stageFit?: boolean; readonly overlay?: string } = {},
) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const params = new URLSearchParams();
  if (options.stageFit) params.set('stage', 'fit');
  if (options.overlay) params.set('overlay', options.overlay);
  params.set('config', JSON.stringify({ mode: 'net-fold', target: 'cylinder', ...config }));
  await page.goto(`/?${params.toString()}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('net-fold');
  await expect(page.getByTestId('cn-view')).toBeVisible();
}

async function readObservation(page: Page): Promise<CylObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as CylObservation;
}

async function pollObservation(page: Page, check: (obs: CylObservation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function press(page: Page, key: string, times = 1) {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

/** 맞추기 단계로 가서 판에 초점을 둔다. */
async function toAssemble(page: Page) {
  await page.getByTestId('cn-step-assemble').click();
  await pollObservation(page, (o) => o.step === 'assemble');
  await page.getByTestId('cn-board').focus();
}

async function maxDiff(page: Page, overlayRoot: string, anchorId: string): Promise<number> {
  const o = await page.locator(overlayRoot).locator('svg').first().boundingBox();
  const c = await page.getByTestId(anchorId).boundingBox();
  if (!o || !c) return Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(o.x - c.x),
    Math.abs(o.y - c.y),
    Math.abs(o.width - c.width),
    Math.abs(o.height - c.height),
  );
}

test('굴리기: 키보드로 8번 굴리면 한 바퀴 강조가 보이고, 되돌리면 사라진다', async ({ page }) => {
  await openCylinder(page);
  await page.getByTestId('cn-roll-stage').focus();
  await expect(page.getByTestId('cn-roll-match')).toHaveCount(0);
  await press(page, 'ArrowRight', 7);
  await pollObservation(page, (o) => o.rollEighths === 7 && o.rolledFull === false);
  await expect(page.getByTestId('cn-roll-match')).toHaveCount(0);
  await press(page, 'ArrowRight');
  await pollObservation(page, (o) => o.rollEighths === 8 && o.rolledFull === true);
  await expect(page.getByTestId('cn-roll-match')).toBeVisible();
  await expect(page.getByTestId('cn-track-end')).toBeVisible();
  const view = page.getByTestId('cn-view');
  await expect(view).not.toContainText(/12\.56|4π|2π|원주|틈|겹침|같아요/);
  await press(page, 'ArrowLeft');
  await pollObservation(page, (o) => o.rollEighths === 7);
  await expect(page.getByTestId('cn-roll-match')).toHaveCount(0);
});

test('굴리기: 단추와 Space로 한 바퀴를 굴리고 처음으로 돌린다', async ({ page }) => {
  await openCylinder(page);
  await page.getByTestId('cn-roll-step').click();
  await pollObservation(page, (o) => o.rollEighths === 1);
  await page.getByTestId('cn-roll-full').click();
  await pollObservation(page, (o) => o.rolledFull === true);
  await page.getByTestId('cn-roll-reset').click();
  await pollObservation(page, (o) => o.rollEighths === 0);
  await page.getByTestId('cn-roll-stage').focus();
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.rolledFull === true);
});

test('맞추기: 반지름 2, 세로 5, 가로 12.6으로 맞추고 접으면 닫힌 이음선이 된다', async ({
  page,
}) => {
  await openCylinder(page);
  await toAssemble(page);
  await press(page, 'Shift+D', 6);
  await press(page, 'd', 6);
  await press(page, 'r', 2);
  await press(page, 'w', 4);
  await pollObservation(
    page,
    (o) =>
      o.net?.width === '12.6' &&
      o.net.radius === '2' &&
      o.net.height === '5' &&
      o.valid === true &&
      o.folded === false,
  );
  await press(page, 'Enter');
  await pollObservation(page, (o) => o.folded === true && o.valid === true && o.seam === 'closed');
  await expect(page.getByTestId('cn-seam-closed')).toBeVisible();
  await expect(page.getByTestId('cn-board')).toHaveAttribute('aria-label', '접은 모습');
  await expect(page.getByTestId('cn-view')).not.toContainText(/12\.56|4π|원주|틈|겹침|맞음|맞아/);
  await press(page, 'Enter');
  await pollObservation(page, (o) => o.folded === false);
});

test('맞추기: 가로 4로 접으면 틈 띠(빗금)가 보인다', async ({ page }) => {
  await openCylinder(page);
  await toAssemble(page);
  await press(page, 'r', 2);
  await press(page, 'Shift+A', 2);
  await press(page, 'Enter');
  await pollObservation(page, (o) => o.net?.width === '4' && o.folded === true && o.seam === 'gap');
  await expect(page.getByTestId('cn-seam-gap')).toBeVisible();
  await expect(page.getByTestId('cn-seam-overlap')).toHaveCount(0);
  await expect(page.getByTestId('cn-seam-closed')).toHaveCount(0);
  const band = await page.getByTestId('cn-seam-gap').boundingBox();
  expect(band?.width ?? 0).toBeGreaterThanOrEqual(4);
});

test('맞추기: 가로 20으로 접으면 겹침 띠(진한 띠)가 보인다', async ({ page }) => {
  await openCylinder(page);
  await toAssemble(page);
  await press(page, 'r', 2);
  await press(page, 'Shift+D', 14);
  await press(page, 'Enter');
  await pollObservation(
    page,
    (o) => o.net?.width === '20' && o.folded === true && o.seam === 'overlap',
  );
  await expect(page.getByTestId('cn-seam-overlap')).toBeVisible();
  await expect(page.getByTestId('cn-seam-gap')).toHaveCount(0);
});

test('조작 단추는 모두 48px 이상이다', async ({ page }) => {
  await openCylinder(page);
  const rollIds = [
    'cn-step-roll',
    'cn-step-assemble',
    'cn-roll-step',
    'cn-roll-back',
    'cn-roll-full',
    'cn-roll-reset',
  ];
  const assembleIds = [
    'cn-width-m1',
    'cn-width-m01',
    'cn-width-p01',
    'cn-width-p1',
    'cn-height-m',
    'cn-height-p',
    'cn-radius-m',
    'cn-radius-p',
    'cn-fold',
  ];
  const check = async (ids: readonly string[]) => {
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      if (!box) continue;
      expect(box.width, `${id} 너비`).toBeGreaterThanOrEqual(47.5);
      expect(box.height, `${id} 높이`).toBeGreaterThanOrEqual(47.5);
    }
  };
  await check(rollIds);
  await page.getByTestId('cn-step-assemble').click();
  await check(assembleIds);
});

test('힌트 ② roll-match: 굴리기 단계에서 무대 svg에 1px 안으로 맞고 단추와 겹치지 않는다', async ({
  page,
}) => {
  await openCylinder(page, undefined, { overlay: 'roll-match' });
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="roll-match"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByTestId('roll-match-round')).toBeVisible();
  await expect(overlay.getByTestId('roll-match-diameter')).toBeVisible();
  await expect(overlay).not.toContainText(/\d/);
  await expect
    .poll(() => maxDiff(page, '[data-overlay="roll-match"]', 'cn-roll-stage'))
    .toBeLessThanOrEqual(1);
  const svg = await overlay.locator('svg').first().boundingBox();
  for (const id of ['cn-roll-step', 'cn-roll-back', 'cn-roll-full', 'cn-roll-reset']) {
    const b = await page.getByTestId(id).boundingBox();
    expect(b, id).not.toBeNull();
    if (!b || !svg) continue;
    const overlapW = Math.min(b.x + b.width, svg.x + svg.width) - Math.max(b.x, svg.x);
    const overlapH = Math.min(b.y + b.height, svg.y + svg.height) - Math.max(b.y, svg.y);
    expect(overlapW > 1 && overlapH > 1, `${id} 겹침`).toBe(false);
  }
  const round = await overlay.getByTestId('roll-match-round').boundingBox();
  const diameter = await overlay.getByTestId('roll-match-diameter').boundingBox();
  expect(round && diameter && round.width > diameter.width * 2).toBe(true);
});

test('힌트 ② roll-match: 맞추기 단계에서 전개도 판 svg에 1px 안으로 맞는다', async ({ page }) => {
  await openCylinder(page, undefined, { overlay: 'roll-match' });
  await toAssemble(page);
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="roll-match"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByTestId('roll-match-round')).toBeVisible();
  await expect
    .poll(() => maxDiff(page, '[data-overlay="roll-match"]', 'cn-board'))
    .toBeLessThanOrEqual(1);
  // 막대는 판 아래 칸에 있어 옆면 직사각형 조각과 겹치지 않는다.
  const bars = await overlay.getByTestId('roll-match-bars').boundingBox();
  const side = await page.getByTestId('cn-piece-side').boundingBox();
  const bottom = await page.getByTestId('cn-piece-bottom').boundingBox();
  expect(bars && side && bars.y >= side.y + side.height - 0.5).toBe(true);
  expect(bars && bottom && bars.y >= bottom.y + bottom.height - 0.5).toBe(true);
  const fold = await page.getByTestId('cn-fold').boundingBox();
  const svg = await overlay.locator('svg').first().boundingBox();
  if (fold && svg) {
    const w = Math.min(fold.x + fold.width, svg.x + svg.width) - Math.max(fold.x, svg.x);
    const h = Math.min(fold.y + fold.height, svg.y + svg.height) - Math.max(fold.y, svg.y);
    expect(w > 1 && h > 1).toBe(false);
  }
});

test('샌드박스 스냅샷(cn-roll-half: 4/8 굴린 화면, cn-folded-gap: 가로 4로 접은 화면)', async ({
  page,
}) => {
  await openCylinder(page);
  await page.getByTestId('cn-roll-stage').focus();
  await press(page, 'ArrowRight', 4);
  await pollObservation(page, (o) => o.rollEighths === 4);
  await settle(page);
  await expect(page.getByTestId('cn-view')).toHaveScreenshot('cn-roll-half.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openCylinder(page);
  await toAssemble(page);
  await press(page, 'r', 2);
  await press(page, 'Shift+A', 2);
  await press(page, 'Enter');
  await pollObservation(page, (o) => o.seam === 'gap' && o.folded === true);
  await settle(page);
  await expect(page.getByTestId('cn-view')).toHaveScreenshot('cn-folded-gap.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('전체 기기 ?stage=fit: 굴리기 무대·단추가 판 안에 다 들어온다(ratio 1)', async ({ page }) => {
  await openCylinder(page, undefined, { stageFit: true });
  await page.getByTestId('cn-roll-full').click();
  await pollObservation(page, (o) => o.rolledFull === true);
  for (const id of [
    'cn-roll-stage',
    'cn-step-roll',
    'cn-step-assemble',
    'cn-roll-step',
    'cn-roll-back',
    'cn-roll-full',
    'cn-roll-reset',
  ]) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
});

test('전체 기기 ?stage=fit: 전개도 판·조절 단추가 판 안에 다 들어온다(ratio 1, 반지름 2·높이 5)', async ({
  page,
}) => {
  await openCylinder(page, undefined, { stageFit: true });
  await toAssemble(page);
  for (const id of [
    'cn-board',
    'cn-width-m1',
    'cn-width-m01',
    'cn-width-p01',
    'cn-width-p1',
    'cn-height-m',
    'cn-height-p',
    'cn-radius-m',
    'cn-radius-p',
    'cn-fold',
  ]) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
  await page.getByTestId('cn-fold').click();
  await expect(page.getByTestId('cn-folded')).toBeVisible();
  await expect(page.getByTestId('cn-board')).toBeInViewport({ ratio: 1 });
});

test('전체 기기 ?stage=fit: 반지름 5·높이 10도 넘치지 않는다(ratio 1)', async ({ page }) => {
  await openCylinder(
    page,
    { radius: 5, height: 10, start: { width: '31.4', radius: '5', height: '10' } },
    { stageFit: true },
  );
  await page.getByTestId('cn-roll-full').click();
  await pollObservation(page, (o) => o.rolledFull === true);
  for (const id of ['cn-roll-stage', 'cn-roll-step', 'cn-roll-reset']) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
  await toAssemble(page);
  await pollObservation(page, (o) => o.valid === true);
  for (const id of ['cn-board', 'cn-width-p1', 'cn-radius-p', 'cn-fold']) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  }
  await page.getByTestId('cn-fold').click();
  await expect(page.getByTestId('cn-seam-closed')).toBeVisible();
  await expect(page.getByTestId('cn-board')).toBeInViewport({ ratio: 1 });
});
