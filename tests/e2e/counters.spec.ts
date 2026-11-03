import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';

/**
 * E02 셈돌 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 * 좌표는 화면 픽셀이 아니라 SVG 논리 좌표(1000×600)로 적는다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly total?: number;
  readonly frameFill?: number[];
  readonly plates?: number[];
  readonly recorded?: number[][];
  readonly distinctSplits?: number;
  readonly [key: string]: unknown;
}

async function openCounters(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E02`);
  await expect(page.getByRole('heading', { name: '셈돌' })).toBeVisible();
  const canvas = page.getByTestId('counters-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('셈돌 캔버스 크기를 알 수 없습니다.');
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

test('선반을 일곱 번 톡 누르면 셈돌 7개가 생기고 개수 숫자는 보이지 않는다', async ({ page }) => {
  const { at, observation } = await openCounters(page);
  const point = at(500, 450);
  for (let index = 0; index < 7; index += 1) {
    await page.mouse.click(point.x, point.y);
  }

  await pollObservation(page, (current) => current.total === 7);
  expect((await readObservation(page)).mode).toBe('summon');
  await expect(observation).toContainText('"total":7');

  // 기본 showNumeral='never'에서는 개수·정답 숫자를 화면에 쓰지 않는다.
  await expect(page.getByTestId('counter-total')).toHaveCount(0);
  await expect(page.getByTestId('counters-canvas')).not.toContainText('지금 7개');
});

test('이중 프레임 8+5에서 오른쪽을 왼쪽으로 밀면 빈칸 2개만큼 넘어간다', async ({ page }) => {
  const { at } = await openCounters(page, { frames: 2, left: 8, right: 5 });
  await page.getByLabel('모드').selectOption('ten-frame');
  await pollObservation(page, (current) => current.mode === 'ten-frame');
  await pollObservation(page, (current) => current.frameFill?.[0] === 8);

  // 오른쪽 프레임의 빈 둘째 줄에서 왼쪽으로 민다(놓인 셈돌을 건드리지 않는다).
  const from = at(690, 220);
  const to = at(300, 220);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();

  await pollObservation(
    page,
    (current) => current.frameFill?.[0] === 10 && current.frameFill?.[1] === 3,
  );
  const observation = await readObservation(page);
  expect(observation.frameFill).toEqual([10, 3]);
  expect(observation['bond']).toEqual([5, 2, 3]);
  expect(observation['moves']).toBe(1);
});

test('키보드만으로 6을 (2, 4)로 가르고 기록한다', async ({ page }) => {
  await openCounters(page, { groups: [6, 0], parts: 2 });
  // 저학년(1학년) 단원이므로 터치 64px에서도 같은 과제를 끝낼 수 있어야 한다.
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expect(page.getByRole('button', { name: '터치 64px' })).toBeVisible();
  await page.getByLabel('모드').selectOption('part-whole');
  await pollObservation(page, (current) => current.mode === 'part-whole');
  await pollObservation(page, (current) => current.plates?.[0] === 6);

  const minus = page.getByRole('button', {
    name: '1번 접시 칸막이 왼쪽으로 하나 옮기기',
  });
  await minus.focus();
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Enter');
  }
  await pollObservation(page, (current) => current.plates?.[0] === 2 && current.plates?.[1] === 4);

  const record = page.getByRole('button', { name: '가르기 기록하기' });
  await record.focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (current) => current.distinctSplits === 1);

  const observation = await readObservation(page);
  expect(observation.plates).toEqual([2, 4]);
  expect(observation.recorded).toEqual([[2, 4]]);
});
