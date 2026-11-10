import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E09 classify·drag-test 모드 E2E(T101).
 *
 * - classify: 키보드만으로 직각삼각형을 닫으면 성질 목록과 Observation이 맞는다.
 * - drag-test: 컴퍼스 두 원과 교점으로 만든 삼각형이 흔들어도 같은 길이 변을 유지한다.
 * - from-diagonals: 조건 두 개를 켜고 흔들어도 마름모다.
 * - property-checklist 오버레이가 본 캔버스와 2px 안에 겹친다(크롬북).
 */

interface ShapeRecord {
  readonly closed?: boolean;
  readonly simple?: boolean;
  readonly vertices?: number;
  readonly rightAngles?: number;
  readonly equalSides?: number;
  readonly names?: string[];
  readonly [key: string]: unknown;
}

interface ClassifyObservation {
  readonly mode?: string;
  readonly shapes?: ShapeRecord[];
  readonly [key: string]: unknown;
}

interface DragFigure {
  readonly kind?: string;
  readonly labels?: string;
  readonly names?: string[];
  readonly props?: string[];
}

interface ShakeRecord {
  readonly before?: string[];
  readonly after?: string[];
  readonly kept?: string[];
  readonly lost?: string[];
  readonly gained?: string[];
}

interface DragObservation {
  readonly mode?: string;
  readonly figure?: DragFigure | null;
  readonly toggles?: string[];
  readonly shakeCount?: number;
  readonly lastShakeMoved?: boolean;
  readonly lastShake?: ShakeRecord | null;
  readonly points?: { readonly label?: string; readonly rank?: number }[];
  readonly toolsUsed?: string[];
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra ?? {});
  if (config !== undefined) params.set('config', JSON.stringify(config));
  const query = params.toString();
  await page.goto(`/${query ? `?${query}` : ''}#/sandbox/E09`);
  await expect(page.getByRole('heading', { name: '기하판' })).toBeVisible();
  const canvas = page.getByTestId('geo-canvas');
  await expect(canvas).toBeVisible();
  return { canvas, observation: page.getByTestId('observation') };
}

async function readObservation<T>(page: Page): Promise<T> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as T;
}

async function pollObservation<T>(page: Page, check: (observation: T) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation<T>(page))).toBe(true);
}

async function chooseMode(page: Page, mode: string): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation<{ readonly mode?: string }>(page, (current) => current.mode === mode);
}

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

/** 검수용 스크린샷. 뷰포트마다 다른 파일로 남긴다(test-results/는 git 제외). */
/** 캔버스에 포커스가 있을 때 (0,0) → (2,0) → (2,2) → (0,0)으로 직각삼각형을 닫는다. */
async function buildRightTriangle(page: Page): Promise<void> {
  for (const key of [
    'Enter',
    'ArrowRight',
    'ArrowRight',
    'Enter',
    'ArrowDown',
    'ArrowDown',
    'Enter',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowUp',
    'ArrowUp',
    'Enter',
  ]) {
    await page.keyboard.press(key);
  }
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/T101-${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

test('classify에서 키보드로 직각삼각형을 닫으면 성질이 보인다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    mode: 'classify',
    showProperties: ['rightAngles', 'equalSides'],
  });
  await chooseMode(page, 'classify');
  await focusCanvas(canvas);

  // (2,0)이 직각인 삼각형을 닫는다.
  await buildRightTriangle(page);

  await pollObservation<ClassifyObservation>(
    page,
    (current) => current.shapes?.[0]?.closed === true && current.shapes[0]?.vertices === 3,
  );
  const shape = (await readObservation<ClassifyObservation>(page)).shapes?.[0];
  // shapeHas {vertices:3, rightAngles:1, equalSides:2}에 해당한다.
  expect(shape?.simple).toBe(true);
  expect(shape?.vertices).toBe(3);
  expect(shape?.rightAngles).toBe(1);
  expect(shape?.equalSides).toBe(2);
  expect(shape?.names).toContain('right-triangle');
  expect(shape?.names).toContain('isosceles');

  const panel = page.getByTestId('classify-properties');
  await expect(panel).toContainText('직각 1개');
  await expect(panel).toContainText('같은 길이 변 2개');
  // 도형 이름은 학생 화면에 쓰지 않는다.
  await expect(canvas).not.toContainText('삼각형');
  await capture(page, 'classify');
});

test('drag-test에서 컴퍼스 교점 삼각형이 흔들어도 같은 길이 변을 유지한다', async ({ page }) => {
  const { canvas } = await openEngine(page, { mode: 'drag-test', shakeButton: true });
  await chooseMode(page, 'drag-test');

  // 자유점 ㄱ(0,0), ㄴ(4,0).
  await page.getByRole('button', { name: '점 도구', exact: true }).click();
  await focusCanvas(canvas);
  await page.keyboard.press('Enter');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  // 선분 ㄱㄴ.
  await page.getByRole('button', { name: '선분 도구', exact: true }).click();
  await focusCanvas(canvas);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');

  // 컴퍼스: 폭 ㄱㄴ으로 중심 ㄱ, 중심 ㄴ인 원 두 개.
  await page.getByRole('button', { name: '컴퍼스 도구', exact: true }).click();
  await focusCanvas(canvas);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // 교점 ㄷ.
  await page.getByRole('button', { name: '교점 도구', exact: true }).click();
  await page.getByRole('button', { name: '교점 후보 1', exact: true }).click();
  await pollObservation<DragObservation>(page, (current) => current.points?.length === 3);

  // 선분 ㄱㄷ, ㄴㄷ.
  await page.getByRole('button', { name: '선분 도구', exact: true }).click();
  await focusCanvas(canvas);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');

  await pollObservation<DragObservation>(page, (current) => current.figure?.labels === 'ㄱㄴㄷ');
  await page.getByRole('button', { name: '흔들기', exact: true }).click();
  await pollObservation<DragObservation>(
    page,
    (current) => current.lastShake?.kept?.includes('equal-sides-2') === true,
  );
  const observation = await readObservation<DragObservation>(page);
  expect(observation.toolsUsed).toEqual(expect.arrayContaining(['circle', 'intersection']));
  expect(observation.shakeCount).toBe(1);
  await capture(page, 'drag-test');
});

test('from-diagonals에서 이등분·수직을 켜고 흔들면 마름모다', async ({ page }) => {
  await openEngine(page, {
    mode: 'drag-test',
    construction: 'from-diagonals',
    diagonalToggles: ['bisect-each-other', 'equal-length', 'perpendicular'],
    shakeButton: true,
  });
  await chooseMode(page, 'drag-test');

  await page.getByRole('button', { name: '서로 이등분', exact: true }).click();
  await page.getByRole('button', { name: '서로 수직', exact: true }).click();
  await pollObservation<DragObservation>(
    page,
    (current) =>
      current.toggles?.includes('bisect-each-other') === true &&
      current.toggles?.includes('perpendicular') === true,
  );

  await page.getByRole('button', { name: '흔들기', exact: true }).click();
  await pollObservation<DragObservation>(
    page,
    (current) => current.figure?.names?.includes('rhombus') === true && current.lastShake !== null,
  );
  const observation = await readObservation<DragObservation>(page);
  expect(observation.toggles).toEqual(
    expect.arrayContaining(['bisect-each-other', 'perpendicular']),
  );
  expect(observation.toggles).not.toContain('equal-length');
  await capture(page, 'drag-rhombus');
});

test('property-checklist 오버레이가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 확인한다.');

  const { canvas } = await openEngine(
    page,
    { mode: 'classify', showProperties: ['rightAngles'] },
    {
      overlay: 'property-checklist',
      overlayArgs: JSON.stringify({ definition: 'rectangle' }),
    },
  );
  await chooseMode(page, 'classify');
  await focusCanvas(canvas);
  await buildRightTriangle(page);
  await pollObservation<ClassifyObservation>(
    page,
    (current) => current.shapes?.[0]?.closed === true,
  );
  await page.getByRole('button', { name: '힌트 겹쳐 보기', exact: true }).click();

  const overlay = page.locator('[data-overlay="property-checklist"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect(overlay.locator('text').first()).toBeVisible();

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
      { message: 'property-checklist 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
  await capture(page, 'overlay');
});
