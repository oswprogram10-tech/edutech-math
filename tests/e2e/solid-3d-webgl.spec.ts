import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E12 3D WebGL 무대 E2E (크롬북 뷰포트).
 * Headless Chromium에서 WebGL을 만들 수 없을 때는 자동 폴백 여부를 확인한 뒤 건너뛴다.
 */

interface ObservationRecord {
  readonly count?: number;
  readonly heights?: readonly (readonly number[])[];
  readonly [key: string]: unknown;
}

async function readObservation(page: Page): Promise<ObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as ObservationRecord;
}

async function open3dStage(page: Page, config: Record<string, unknown> = {}) {
  const merged = { stage: '3d', ...config };
  const query = `?config=${encodeURIComponent(JSON.stringify(merged))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  const stage = page.getByTestId('cubes-stage');
  await expect(stage).toBeVisible();
  await expect.poll(async () => stage.getAttribute('data-renderer')).not.toBe('probe');
  return stage;
}

async function skipIfNoWebGL(stage: Locator): Promise<boolean> {
  const renderer = await stage.getAttribute('data-renderer');
  if (renderer !== '3d') {
    test.skip(true, `Headless 환경에서 WebGL 사용 불가(폴백 렌더러: ${String(renderer)})`);
    return true;
  }
  await expect(stage.getByTestId('cubes-3d-canvas')).toBeVisible();
  await expect(stage.locator('canvas')).toBeVisible();
  return false;
}

test('크롬북 auto 모드에서 성능 측정 후 렌더러와 fps를 결정한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 3D 프로브 테스트');
  await page.goto('/#/sandbox/E12');
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  const stage = page.getByTestId('cubes-stage');
  await expect(stage).toBeVisible();
  await expect
    .poll(async () => stage.getAttribute('data-renderer'), { timeout: 10_000 })
    .toMatch(/^(?:3d|isometric)$/);

  const renderer = await stage.getAttribute('data-renderer');
  const fps = await stage.getAttribute('data-probe-fps');
  console.log(`[E12 auto probe] renderer=${renderer}, probeFps=${fps}`);
  testInfo.annotations.push({
    type: 'probe',
    description: `renderer=${renderer}, probeFps=${fps}`,
  });
  expect(renderer === '3d' || renderer === 'isometric').toBe(true);
});

test('크롬북 3D 무대에서 클릭·키보드·시점 전환·평면 보기 전환·힌트 도움 그림이 동작한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 3D WebGL 테스트');
  const stage = await open3dStage(page, {
    grid: [5, 5],
    maxHeight: 5,
  });
  if (await skipIfNoWebGL(stage)) return;

  // 1) 정중앙 클릭 2회 → (2, 2) 높이 2
  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  const cx = (stageBox?.x ?? 0) + (stageBox?.width ?? 0) / 2;
  const cy = (stageBox?.y ?? 0) + (stageBox?.height ?? 0) / 2;
  await page.mouse.click(cx, cy);
  await expect.poll(async () => (await readObservation(page)).heights?.[2]?.[2]).toBe(1);
  await page.mouse.click(cx, cy);
  await expect.poll(async () => (await readObservation(page)).heights?.[2]?.[2]).toBe(2);

  // 2) 시점 프리셋("위에서") 클릭 시 Observation은 그대로이고 화면 그림이 바뀐다
  const beforeObs = await readObservation(page);
  const beforeShot = await stage.screenshot();
  await page.getByRole('button', { name: '위에서' }).click();
  await expect
    .poll(async () => !(await stage.screenshot()).equals(beforeShot), { timeout: 5_000 })
    .toBe(true);
  expect(await readObservation(page)).toEqual(beforeObs);

  // 3D 무대 안에는 높이·개수 숫자 글자가 없다
  expect(/\d/.test((await stage.textContent()) ?? '')).toBe(false);

  // 3) 학생 전환 버튼("평면 그림으로 보기" ↔ "입체로 보기")
  await page.getByRole('button', { name: '평면 그림으로 보기' }).click();
  await expect(stage).toHaveAttribute('data-renderer', 'isometric');
  await expect(stage.getByTestId('cubes-canvas')).toBeVisible();
  await page.getByRole('button', { name: '입체로 보기' }).click();
  await expect(stage).toHaveAttribute('data-renderer', '3d');
  await expect(stage.getByTestId('cubes-3d-canvas')).toBeVisible();
});

test('크롬북 3D 무대에서 키보드만으로 L자 4개를 쌓으면 count가 4다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 3D 키보드 테스트');
  const stage = await open3dStage(page, { grid: [5, 5], maxHeight: 5 });
  if (await skipIfNoWebGL(stage)) return;

  await stage.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readObservation(page)).count).toBe(4);
});

test('크롬북 3D 무대에서 힌트 겹쳐 보기 도움 그림 상자와 투명 캔버스가 2px 안으로 맞는다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 3D 오버레이 테스트');
  const stage = await open3dStage(page, {
    grid: [2, 2],
    maxHeight: 2,
    initial: [
      { at: [0, 0, 0] },
      { at: [0, 0, 1] },
      { at: [1, 0, 0] },
      { at: [1, 0, 1] },
      { at: [0, 1, 0] },
      { at: [0, 1, 1] },
      { at: [1, 1, 0] },
      { at: [1, 1, 1] },
    ],
  });
  if (await skipIfNoWebGL(stage)) return;

  const mirrorSvg = stage.getByTestId('cubes-3d-canvas');
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="hidden-reveal"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByTestId('cubes-helper-diagram')).toBeVisible();

  await expect
    .poll(async () => {
      const a = await mirrorSvg.boundingBox();
      const b = await overlay.locator('svg').boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y),
        Math.abs(b.width - a.width),
        Math.abs(b.height - a.height),
      );
    })
    .toBeLessThanOrEqual(2);
});
