import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';

/**
 * E05 분수 모델 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북(Chromium)·전자칠판 뷰포트에서 모두 돈다.
 * 좌표는 화면 픽셀이 아니라 SVG의 논리 좌표(1000×600)로 적는다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly equal?: boolean;
  readonly commonGrid?: number | null;
  readonly wholes?: ReadonlyArray<{ readonly parts?: number; readonly equal?: boolean }>;
  readonly [key: string]: unknown;
}

async function openFractions(page: Page) {
  await page.goto('/#/sandbox/E05');
  await expect(page.getByRole('heading', { name: '분수 모델' })).toBeVisible();
  const canvas = page.getByTestId('fraction-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('분수 모델 캔버스 크기를 알 수 없습니다.');
  return {
    canvas,
    observation: page.getByTestId('observation'),
    at: (x: number, y: number) => logicalToScreen(box, x, y),
  };
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

/** 위쪽 변에서 아래쪽 변으로 세로 칼선을 긋는다. */
async function verticalCut(
  page: Page,
  at: (x: number, y: number) => { x: number; y: number },
  x: number,
): Promise<void> {
  const from = at(x, 150);
  const to = at(x, 450);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test('직사각형을 4등분하면 넓이가 같은 4조각으로 판정한다', async ({ page }) => {
  const { at } = await openFractions(page);

  for (const x of [325, 500, 675]) await verticalCut(page, at, x);

  await pollObservation(page, (observation) => observation.wholes?.[0]?.parts === 4);
  const observation = await readObservation(page);
  expect(observation.equal).toBe(true);
  expect(observation.wholes?.[0]).toMatchObject({ parts: 4, equal: true });
  await expect(page.getByText('똑같이 나눴어요')).toBeVisible();
});

test('조각 수가 4여도 넓이가 다르면 4등분이 아니라고 판정한다', async ({ page }) => {
  const { at } = await openFractions(page);

  // 325·500·675가 아닌 위치라 자석 스냅 뒤에도 폭이 서로 다르다.
  for (const x of [300, 520, 700]) await verticalCut(page, at, x);

  await pollObservation(page, (observation) => observation.wholes?.[0]?.parts === 4);
  const observation = await readObservation(page);
  expect(observation.equal).toBe(false);
  expect(observation.wholes?.[0]).toMatchObject({ parts: 4, equal: false });
  await expect(page.getByText('조각 크기가 달라요')).toBeVisible();

  // 칼선을 지우면 다시 한 조각으로 돌아간다.
  await page.getByRole('button', { name: '칼선 지우기' }).click();
  await pollObservation(page, (observation) => observation.wholes?.[0]?.parts === 1);
});

test('1/2과 1/3 타일을 겹치면 6칸 공통 격자가 생긴다', async ({ page }) => {
  const { observation } = await openFractions(page);

  await page.getByLabel('모드').selectOption('overlay-slicer');
  await pollObservation(page, (current) => current.mode === 'overlay-slicer');

  await page.getByRole('button', { name: '겹치기' }).click();
  await pollObservation(page, (current) => current.commonGrid === 6);

  const current = await readObservation(page);
  expect(current.commonGrid).toBe(6);
  expect(current['aCells']).toBe(3);
  expect(current['bCells']).toBe(2);
  await expect(observation).toContainText('"commonGrid":6');
  // 기본 showValue='none'에서는 수치 문구를 화면에 내지 않는다(정답 노출 금지).
  await expect(page.getByTestId('fraction-canvas')).not.toContainText('공통 격자 6칸');
});

test('사탕 아이콘 위를 탭해도 그 묶음이 선택된다', async ({ page }) => {
  const { observation } = await openFractions(page);
  await page.getByLabel('모드').selectOption('discrete');
  await pollObservation(page, (current) => current.mode === 'discrete');

  // 기본은 12개를 2개씩 묶는다. 첫 묶음의 왼쪽 사탕 위(묶음 사각형 안)를 탭한다.
  const group = page.getByRole('button', { name: '1번째 묶음, 2개' });
  const box = await group.boundingBox();
  if (!box) throw new Error('묶음 위치를 알 수 없습니다.');
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await pollObservation(
    page,
    (current) => Array.isArray(current['selectedGroups']) && current['selectedGroups'].length === 1,
  );
  expect(await readObservation(page)).toMatchObject({ selectedGroups: [0], selectedCount: 2 });
  await expect(observation).toContainText('"selectedGroups":[0]');

  // 같은 사탕을 다시 탭하면 선택이 풀린다.
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await pollObservation(
    page,
    (current) => Array.isArray(current['selectedGroups']) && current['selectedGroups'].length === 0,
  );
});

test('키보드로 조각을 색칠하고 되돌릴 수 있다', async ({ page }) => {
  const { observation } = await openFractions(page);
  await page.getByLabel('모드').selectOption('shade');
  await pollObservation(page, (current) => current.mode === 'shade');

  // 첫 번째 칸이 Tab 순서에 들어온다.
  await page.getByRole('button', { name: '1번째 칸' }).first().focus();
  await page.keyboard.press('Space');
  await pollObservation(
    page,
    (current) =>
      Array.isArray(current.wholes) &&
      (current.wholes[0] as { raw?: string } | undefined)?.raw === '1/4',
  );

  await page.getByRole('button', { name: '되돌리기' }).click();
  await pollObservation(
    page,
    (current) =>
      Array.isArray(current.wholes) &&
      (current.wholes[0] as { raw?: string } | undefined)?.raw === '0/4',
  );
  await expect(observation).toContainText('"mode":"shade"');
});
