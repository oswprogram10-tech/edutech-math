import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E12 3D 입체 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 돈다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly cubes?: readonly (readonly [number, number, number])[];
  readonly count?: number;
  readonly heights?: readonly (readonly number[])[];
  readonly top?: readonly (readonly number[])[];
  readonly front?: readonly (readonly number[])[];
  readonly side?: readonly (readonly number[])[];
  readonly viewTurn?: number;
  readonly translucent?: boolean;
  readonly focus?: { readonly view: string; readonly row: number; readonly col: number } | null;
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: Record<string, unknown>) {
  const merged = { stage: 'isometric', ...config };
  const query = `?config=${encodeURIComponent(JSON.stringify(merged))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  const canvas = page.getByTestId('cubes-canvas');
  await expect(canvas).toBeVisible();
  return { canvas, observation: page.getByTestId('observation') };
}

async function readObservation(page: Page): Promise<ObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as ObservationRecord;
}

async function pollObservation(
  page: Page,
  check: (observation: ObservationRecord) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

test('키보드만으로 L자 4개를 쌓고 빼기·돌리기·반투명·투영 칸 강조까지 조작한다', async ({
  page,
}) => {
  const { canvas } = await openEngine(page);
  await focusCanvas(canvas);

  // (0,0) → (1,0) → (2,0) → (2,1) L자 4개 쌓기
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');

  await pollObservation(page, (obs) => obs.count === 4);
  const obs4 = await readObservation(page);
  expect(obs4.top).toEqual([
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 0, 0],
  ]);

  // Backspace로 하나 빼기 → 3개
  await page.keyboard.press('Backspace');
  await pollObservation(page, (obs) => obs.count === 3);

  // E 키로 돌리기, T 키로 반투명 토글
  await page.keyboard.press('e');
  await pollObservation(page, (obs) => obs.viewTurn === 1);
  await page.keyboard.press('t');
  await pollObservation(page, (obs) => obs.translucent === true);

  // 투영 뷰에 키보드 포커스 후 방향키·Enter로 칸 강조
  const frontGrid = page.getByTestId('cubes-view-front');
  await frontGrid.focus();
  await expect(frontGrid).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.focus?.view === 'front' && obs.focus.row === 4);
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.focus === null);
});

test('포인터: 크롬북에서 [data-col="0,0"] 클릭 2번 후 빼기 도구로 1개 남긴다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 포인터 테스트');
  await openEngine(page);

  const col00 = page.locator('[data-col="0,0"]');
  await col00.click();
  await col00.click();
  await pollObservation(page, (obs) => obs.count === 2);
  const obs2 = await readObservation(page);
  const lastRow = obs2.heights?.[obs2.heights.length - 1];
  expect(lastRow?.[0]).toBe(2);

  await page.getByRole('button', { name: '빼기', exact: true }).click();
  await col00.click();
  await pollObservation(page, (obs) => obs.count === 1);
});

test('회전: 오른쪽으로 돌리기 4번 뒤 cubes가 처음과 같고 viewTurn이 0이다', async ({ page }) => {
  await openEngine(page, {
    initial: [{ at: [0, 0, 0] }, { at: [1, 0, 0] }, { at: [0, 1, 0] }],
  });
  const before = await readObservation(page);
  const turnRight = page.getByRole('button', { name: '오른쪽으로 돌리기', exact: true });

  for (let i = 0; i < 4; i += 1) {
    await turnRight.click();
  }
  await pollObservation(page, (obs) => obs.viewTurn === 0);
  const after = await readObservation(page);
  expect(after.cubes).toEqual(before.cubes);
});

test('투영 동기화: 쌓을 때마다 cubes-view-front의 채운 칸 수가 front 행렬의 1 개수와 같다', async ({
  page,
}) => {
  const { canvas } = await openEngine(page);
  await focusCanvas(canvas);
  const frontView = page.getByTestId('cubes-view-front');

  const countOnes = (matrix: readonly (readonly number[])[] | undefined) =>
    (matrix ?? []).flat().filter((cell) => cell === 1).length;

  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.count === 1);
  let obs = await readObservation(page);
  await expect(frontView.locator('[data-filled="true"]')).toHaveCount(countOnes(obs.front));

  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.count === 2);
  obs = await readObservation(page);
  await expect(frontView.locator('[data-filled="true"]')).toHaveCount(countOnes(obs.front));

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.count === 3);
  obs = await readObservation(page);
  await expect(frontView.locator('[data-filled="true"]')).toHaveCount(countOnes(obs.front));
});

test('views: [] 및 rotationLocked: true 설정에서는 투영 뷰와 회전 단추가 없다', async ({
  page,
}) => {
  await openEngine(page, { views: [], rotationLocked: true });
  await expect(page.locator('[data-testid^="cubes-view-"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '왼쪽으로 돌리기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '오른쪽으로 돌리기' })).toHaveCount(0);
});

test('크롬북 기본 설정에서 [data-col="0,0"] 바닥 마름모의 화면 가로가 48px 이상이다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 터치 타깃 크기 테스트');
  await page.goto(
    `/?stage=fit&config=${encodeURIComponent(JSON.stringify({ stage: 'isometric' }))}#/sandbox/E12`,
  );
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  const floor00 = page.locator('[data-floor="0,0"]');
  const box = await floor00.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
});

test('크롬북에서 힌트 겹쳐 보기 hidden-reveal svg와 cubes-canvas 상자가 2px 안이다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 오버레이 정렬 테스트');
  const { canvas } = await openEngine(page, {
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

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="hidden-reveal"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect(overlay.locator('[data-hidden-cube]')).toHaveCount(1);

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
      { message: 'hidden-reveal 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
});

async function assertInsideBox(inner: Locator, outer: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const a = await inner.boundingBox();
      const b = await outer.boundingBox();
      if (!a || !b) return false;
      return (
        a.x >= b.x - 1 &&
        a.y >= b.y - 1 &&
        a.x + a.width <= b.x + b.width + 1 &&
        a.y + a.height <= b.y + b.height + 1
      );
    })
    .toBe(true);
}

test('샌드박스 T3 보기 전용 설정에서 그림자 그림이 70px 이상·첫 화면 안이고 편집 단추·상태 줄이 없다', async ({
  page,
}, testInfo) => {
  const t3Config = {
    mode: 'cubes',
    grid: [5, 2],
    maxHeight: 2,
    maxCubes: 8,
    views: [],
    editable: false,
    stage: 'isometric',
    referenceViews: {
      top: [
        [1, 0],
        [1, 1],
      ],
    },
    initial: [
      { at: [0, 0, 0], color: 'blue', locked: true },
      { at: [1, 0, 0], color: 'blue', locked: true },
      { at: [0, 0, 1], color: 'blue', locked: true },
      { at: [0, 1, 0], color: 'blue', locked: true },
      { at: [3, 0, 0], color: 'yellow', locked: true },
      { at: [4, 0, 0], color: 'yellow', locked: true },
      { at: [3, 0, 1], color: 'yellow', locked: true },
      { at: [4, 1, 0], color: 'yellow', locked: true },
    ],
  };

  await page.goto(
    `/?stage=fit&config=${encodeURIComponent(JSON.stringify(t3Config))}#/sandbox/E12`,
  );
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();

  const refTop = page.getByTestId('cubes-reference-top');
  await expect(refTop).toBeVisible();
  await expect(refTop).toBeInViewport({ ratio: 1 });
  const refBox = await refTop.boundingBox();
  expect(refBox).not.toBeNull();
  expect(refBox?.width ?? 0).toBeGreaterThanOrEqual(70);
  expect(refBox?.height ?? 0).toBeGreaterThanOrEqual(70);

  await expect(page.getByRole('button', { name: '쌓기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '빼기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 빼기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '왼쪽으로 돌리기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '오른쪽으로 돌리기', exact: true })).toBeVisible();
  await expect(page.getByTestId('cubes-status')).toHaveText('');

  const frontMarkerTextBox = await page
    .locator('[data-testid="cubes-front-marker"] text')
    .boundingBox();
  console.log(
    `[E12 T3 iso front text] ${testInfo.project.name}=${Math.round(frontMarkerTextBox?.height ?? 0)}px`,
  );

  const stage = page.getByTestId('cubes-stage');
  await stage.focus();
  await expect(stage).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await readObservation(page)).count).toBe(8);

  await page.keyboard.press('q');
  await pollObservation(page, (obs) => obs.viewTurn === 3);
});

test('과제 보기 블록이 도구 막대보다 DOM 앞에 놓인다', async ({ page }) => {
  await openEngine(page, {
    reference: {
      cubes: [
        [0, 0, 0],
        [1, 0, 0],
      ],
    },
    referenceViews: {
      top: [
        [1, 0],
        [1, 1],
      ],
    },
  });

  const isBeforeToolbar = await page.evaluate(() => {
    const refTop = document.querySelector('[data-testid="cubes-reference-top"]');
    const toolbar = document.querySelector('[role="toolbar"][aria-label="3D 입체"]');
    if (!refTop || !toolbar) return false;
    return Boolean(refTop.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(isBeforeToolbar).toBe(true);
});

test('3D 무대에서 앞 이름표가 18px 이상이고 시점 전환 뒤에도 무대 상자 안에 있다', async ({
  page,
}, testInfo) => {
  await page.goto(`/?config=${encodeURIComponent(JSON.stringify({ stage: '3d' }))}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();

  const stage = page.getByTestId('cubes-stage');
  await expect(stage).toBeVisible();
  await expect.poll(async () => stage.getAttribute('data-renderer')).not.toBe('probe');
  const renderer = await stage.getAttribute('data-renderer');
  if (renderer !== '3d') {
    testInfo.annotations.push({
      type: 'skip-reason',
      description: `Headless 환경에서 WebGL 사용 불가(폴백 렌더러: ${String(renderer)})`,
    });
    test.skip(true, `WebGL 사용 불가로 3D 이름표 테스트 건너뜀(폴백: ${String(renderer)})`);
    return;
  }

  const label = stage.getByTestId('cubes-front-label');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('앞');
  const fontSize = await label.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(18);
  await assertInsideBox(label, stage);

  await page.getByRole('button', { name: '위에서', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(label).toBeVisible();
  await assertInsideBox(label, stage);

  await page.getByRole('button', { name: '비스듬히', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(label).toBeVisible();
  await assertInsideBox(label, stage);
});

test('rotationLocked: true 안내에 돌리기·손가락 두 개가 없다(등각·3D)', async ({
  page,
}, testInfo) => {
  await openEngine(page, { rotationLocked: true });
  const frontText5x5 = await page.locator('[data-testid="cubes-front-marker"] text').boundingBox();
  const canvasBox5x5 = await page.getByTestId('cubes-canvas').boundingBox();
  console.log(
    `[E12 5x5 iso front text] ${testInfo.project.name}: textH=${(frontText5x5?.height ?? 0).toFixed(1)}px, canvasH=${Math.round(canvasBox5x5?.height ?? 0)}px`,
  );

  const engineWrapText = (await page.locator('div[data-cpa]').textContent()) ?? '';
  expect(engineWrapText).not.toContain('돌리기');
  expect(engineWrapText).not.toContain('손가락 두 개');
  await expect(
    page.getByText('방향키: 칸 옮기기 · Enter: 쌓기 · Backspace: 빼기 · T: 반투명'),
  ).toBeVisible();

  await page.goto(
    `/?config=${encodeURIComponent(JSON.stringify({ stage: '3d', rotationLocked: true }))}#/sandbox/E12`,
  );
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  const stage = page.getByTestId('cubes-stage');
  await expect.poll(async () => stage.getAttribute('data-renderer')).not.toBe('probe');
  if ((await stage.getAttribute('data-renderer')) !== '3d') {
    test.skip(true, 'WebGL 사용 불가로 3D 회전 잠금 안내 테스트 건너뜀');
    return;
  }
  const engineWrapText3d = (await page.locator('div[data-cpa]').textContent()) ?? '';
  expect(engineWrapText3d).not.toContain('돌리기');
  expect(engineWrapText3d).not.toContain('손가락 두 개');
  await expect(
    page.getByText('방향키: 칸 옮기기 · Enter: 쌓기 · Backspace: 빼기 · T: 반투명'),
  ).toBeVisible();
});
