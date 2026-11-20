import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { expectControlsAboveFold } from './controls-fold';

/**
 * E17 분류기 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - venn: 키보드로 카드를 놓고 "맞는지 보기" 뒤에만 맞음 표시가 나온다.
 * - venn: 불가능한 칸 표시 두 칸.
 * - secret-rule(seed 1): 질문 1번, 카드 하나 지우기, 고정한 비밀 카드(q11) 맞히기.
 * - 역할 바꾸기: q12를 고르고 첫 질문에 틀린 답 → 근거 문장, 나머지는 맞게 → done.
 * - hierarchy: 토글 Space, 이름 카드 Enter + 빈칸 Enter.
 * - 힌트 ② `upright-card`가 본 캔버스와 2px 안에 겹친다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly placements?: Readonly<Record<string, string | null>>;
  readonly impossibleMarked?: string[];
  readonly questionCount?: number;
  readonly eliminated?: string[];
  readonly solved?: boolean;
  readonly swapPicked?: boolean;
  readonly swapErrors?: number;
  readonly swapAnswers?: number;
  readonly swapDone?: boolean;
  readonly toggles?: string[];
  readonly currentNode?: string;
  readonly blanks?: Readonly<Record<string, string | null>>;
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E17`);
  await expect(page.getByRole('heading', { name: '분류기' })).toBeVisible();
  const canvas = page.getByTestId('sorter-canvas');
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

async function setMode(
  page: Page,
  mode: 'venn' | 'secret-rule' | 'hierarchy' | 'sort' | 'predict',
): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  // 샌드박스의 predict는 secret-rule의 변형이라 관찰 결과의 mode는 secret-rule이다.
  const expected = mode === 'predict' ? 'secret-rule' : mode;
  await pollObservation(page, (observation) => observation.mode === expected);
}

/** 검수용 스크린샷. 뷰포트마다 다른 파일로 남긴다(test-results/는 git 제외). */
async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.page().keyboard.press(key);
}

test('키보드로 카드를 칸에 놓고 맞는지 보기 뒤에만 맞음 표시가 나온다', async ({ page }) => {
  const { canvas } = await openEngine(page);

  await press(page.locator('[data-card="t04"]'));
  await press(page.locator('[data-cell="acute|equilateral"]'));
  await pollObservation(
    page,
    (observation) => observation.placements?.['t04'] === 'acute|equilateral',
  );

  await expect(page.locator('[data-fit="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: '맞는지 보기' }).click();
  await expect(page.locator('[data-card="t04"][data-fit="true"]')).toHaveCount(1);

  // 기본 설정에서는 카드에 도형 이름을 쓰지 않는다.
  await expect(canvas).not.toContainText('정삼각형');
  await capture(page, 'T108-venn');
});

test('불가능한 칸 표시를 켜고 두 칸을 표시한다', async ({ page }) => {
  await openEngine(page);
  await page.getByRole('button', { name: '불가능한 칸 표시' }).click();
  await press(page.locator('[data-cell="right|equilateral"]'));
  await press(page.locator('[data-cell="obtuse|equilateral"]'));

  await pollObservation(page, (observation) => {
    const marked = observation.impossibleMarked ?? [];
    return (
      marked.length === 2 &&
      marked.includes('right|equilateral') &&
      marked.includes('obtuse|equilateral')
    );
  });
  await expect(page.locator('[data-cell="right|equilateral"][data-impossible="true"]')).toHaveCount(
    1,
  );
});

test('스무고개 seed 1: 질문 한 번, 카드 하나 지우기, 고정한 비밀 카드 맞히기', async ({ page }) => {
  await openEngine(page, { seed: 1 });
  await setMode(page, 'secret-rule');
  // 비밀 카드는 맞히기 전 DOM에 드러나지 않는다.
  await expect(page.locator('body')).not.toContainText('비밀 카드');

  await page.locator('button[data-question="parallel-pairs>=1"]').click();
  await pollObservation(page, (observation) => observation.questionCount === 1);

  await press(page.locator('[data-card="q04"]'));
  await pollObservation(page, (observation) => (observation.eliminated ?? []).includes('q04'));

  await page.getByRole('button', { name: '이 카드예요' }).click();
  await press(page.locator('[data-card="q11"]'));
  await pollObservation(page, (observation) => observation.solved === true);
  await expect(page.locator('body')).toContainText('비밀 카드');
  await capture(page, 'T108-secret');
});

test('역할 바꾸기: q12 첫 질문에 틀리면 근거 문장이 나오고, 나머지는 맞게 답한다', async ({
  page,
}) => {
  await openEngine(page, { seed: 1, roleSwap: true, startRole: 'answerer' });
  await setMode(page, 'secret-rule');
  await pollObservation(page, (observation) => observation.swapPicked === false);

  await press(page.locator('[data-card="q12"]'));
  await pollObservation(page, (observation) => observation.swapPicked === true);
  await expect(page.getByTestId('computer-question')).toHaveAttribute(
    'data-question',
    'parallel-pairs==2',
  );

  await page.getByRole('button', { name: '아니요', exact: true }).click();
  await pollObservation(page, (observation) => observation.swapErrors === 1);
  await expect(page.getByTestId('swap-evidence')).not.toBeEmpty();

  for (let step = 0; step < 8; step += 1) {
    const observation = await readObservation(page);
    if (observation.swapDone === true) break;
    const before = observation.swapAnswers ?? 0;
    await page.getByRole('button', { name: '예', exact: true }).click();
    await expect
      .poll(async () => {
        const next = await readObservation(page);
        return next.swapDone === true || (next.swapAnswers ?? 0) > before;
      })
      .toBe(true);
  }
  await pollObservation(page, (observation) => observation.swapDone === true);
  expect((await readObservation(page)).swapErrors).toBe(1);
});

test('hierarchy: 토글 Space와 이름 카드 Enter + 빈칸 Enter', async ({ page }) => {
  await openEngine(page);
  await setMode(page, 'hierarchy');

  await press(page.getByRole('switch', { name: '평행한 변 두 쌍' }), 'Space');
  await pollObservation(page, (observation) => {
    const toggles = observation.toggles ?? [];
    return toggles.length === 1 && toggles[0] === 'two-parallel-pairs';
  });
  expect((await readObservation(page)).currentNode).toBe('parallelogram');

  await press(page.getByRole('button', { name: '사다리꼴', exact: true }));
  await press(page.locator('[data-blank="trapezoid"]'));
  await pollObservation(page, (observation) => observation.blanks?.['trapezoid'] === 'trapezoid');
  await capture(page, 'T108-hierarchy');
});

test('힌트 겹쳐 보기의 upright-card가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await press(page.locator('[data-card="t04"]'));
  await press(page.locator('[data-cell="acute|equilateral"]'));
  await pollObservation(
    page,
    (observation) => observation.placements?.['t04'] === 'acute|equilateral',
  );

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="upright-card"] svg');
  await expect(overlay).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  const overlayBox = await overlay.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  if (!canvasBox || !overlayBox) return;
  expect(Math.abs(overlayBox.x - canvasBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.y - canvasBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.width - canvasBox.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.height - canvasBox.height)).toBeLessThanOrEqual(2);
});

// ───────────────────────────────────────────────────────────────
// T217 sort 모드와 secret-rule predict 변형
// ───────────────────────────────────────────────────────────────

const BUTTON_COLORS: Readonly<Record<string, 'bin1' | 'bin2' | 'bin3'>> = {
  b01: 'bin1',
  b02: 'bin1',
  b03: 'bin1',
  b04: 'bin1',
  b05: 'bin1',
  b06: 'bin2',
  b07: 'bin2',
  b08: 'bin2',
  b09: 'bin2',
  b10: 'bin3',
  b11: 'bin3',
  b12: 'bin3',
};

const BIN_KEY: Readonly<Record<string, string>> = { bin1: '1', bin2: '2', bin3: '3', bin4: '4' };

/** 샌드박스에서 sort·predict를 열고 판이 보일 때까지 기다린다. */
async function openSort(page: Page, config: unknown, mode: 'sort' | 'predict' = 'sort') {
  const opened = await openEngine(page, config);
  await setMode(page, mode);
  await opened.canvas.scrollIntoViewIfNeeded();
  return opened;
}

/** 카드를 마우스(포인터)로 끌어 상자 가운데에 놓는다. 좌표는 요소 상자에서만 읽는다. */
async function dragTo(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (!a || !b) return;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function keyPlace(page: Page, card: string, key: string): Promise<void> {
  await press(page.locator(`[data-card="${card}"]`), key);
}

async function placeByColor(page: Page, skip: readonly string[] = []): Promise<void> {
  for (const [card, bin] of Object.entries(BUTTON_COLORS)) {
    if (skip.includes(card)) continue;
    await keyPlace(page, card, BIN_KEY[bin] ?? '1');
  }
}

test('sort 단추: 색 기준을 고르고 끌어서 분류한 뒤 개수를 넣는다', async ({ page }) => {
  const { canvas } = await openSort(page, {
    criterionChoice: ['color', 'shape', 'holes', 'pretty'],
    countTable: 'student',
  });

  // 기준을 고르기 전에는 상자가 없고 카드를 넣을 수 없다.
  await expect(page.locator('[data-bin]')).toHaveCount(0);
  await keyPlace(page, 'b01', '1');
  await pollObservation(
    page,
    (o) => o['criterion'] === null && (o['tray'] as string[]).length === 12,
  );

  await page.locator('[data-criterion="color"]').click();
  await pollObservation(page, (o) => o['criterion'] === 'color');
  await expect(page.locator('[data-bin]')).toHaveCount(3);
  // 칸을 고른 뒤 다른 기준 단추는 눌리지 않는다.
  await expect(page.locator('[data-criterion="shape"]')).toBeDisabled();

  // 두 장은 끌어서(포인터), 나머지는 키보드로 넣는다.
  await dragTo(page, page.locator('[data-card="b01"]'), page.locator('[data-bin="bin1"]'));
  await pollObservation(
    page,
    (o) => (o['binOf'] as Record<string, string | null>)['b01'] === 'bin1',
  );
  await dragTo(page, page.locator('[data-card="b06"]'), page.locator('[data-bin="bin2"]'));
  await pollObservation(
    page,
    (o) => (o['binOf'] as Record<string, string | null>)['b06'] === 'bin2',
  );

  // 상자 밖에 놓으면 제자리(트레이)에 남는다.
  const b02 = await page.locator('[data-card="b02"]').boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(b02 && canvasBox).toBeTruthy();
  if (b02 && canvasBox) {
    await page.mouse.move(b02.x + b02.width / 2, b02.y + b02.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width - 4, canvasBox.y + canvasBox.height - 4, {
      steps: 6,
    });
    await page.mouse.up();
  }
  await pollObservation(page, (o) => (o['binOf'] as Record<string, string | null>)['b02'] === null);

  await placeByColor(page, ['b01', 'b06']);
  await pollObservation(page, (o) => o['allPlaced'] === true);
  const done = await readObservation(page);
  expect(done['pureBy']).toContain('color');
  expect(done['mismatched']).toEqual([]);

  // 개수표: 모든 카드를 넣은 뒤에 나타나고, 비어 있다.
  const red = page.getByRole('spinbutton', { name: '빨강 개수 쓰기' });
  await expect(red).toHaveValue('');
  expect(await page.getByTestId('sorter-controls').textContent()).not.toMatch(/\d+장/);
  await red.fill('5');
  await page.getByRole('spinbutton', { name: '파랑 개수 쓰기' }).fill('4');
  await pollObservation(page, (o) => o['countsCorrect'] === false);
  await page.getByRole('button', { name: '노랑 하나 늘리기' }).click();
  await page.getByRole('button', { name: '노랑 하나 늘리기' }).click();
  // 노랑 2장 — 실제와 1 차이라서 개수를 하나씩 세는 대응 오개념으로 기록된다.
  await pollObservation(page, (o) =>
    ((o['misconceptions'] ?? []) as string[]).includes('MC-COUNT-ONE-TO-ONE'),
  );
  await page.getByRole('button', { name: '노랑 하나 늘리기' }).click();
  await pollObservation(page, (o) => o['countsCorrect'] === true);

  // 기준 바꾸기: 카드가 모두 판으로 돌아가고 모양 기준으로 다시 고른다.
  await page.getByRole('button', { name: '기준 바꾸기' }).click();
  await pollObservation(
    page,
    (o) => o['criterion'] === null && (o['tray'] as string[]).length === 12,
  );
  await page.locator('[data-criterion="shape"]').click();
  await pollObservation(page, (o) => o['criterion'] === 'shape');
  expect(((await readObservation(page))['criterionHistory'] as string[]).join(',')).toBe(
    'color,shape',
  );
});

test('sort 컨베이어: 지금 카드를 넣어야 다음 카드가 온다(키보드)', async ({ page }) => {
  await openSort(page, { conveyor: true, cards: ['b03', 'b01', 'b02'], bins: 2 });
  await expect(page.locator('[data-card]')).toHaveCount(1);
  await expect(page.locator('[data-card="b03"]')).toBeVisible();

  await keyPlace(page, 'b03', '1');
  await expect(page.locator('[data-card="b01"]')).toBeVisible();
  await pollObservation(
    page,
    (o) => (o['binOf'] as Record<string, string | null>)['b03'] === 'bin1',
  );

  await keyPlace(page, 'b01', '2');
  await expect(page.locator('[data-card="b02"]')).toBeVisible();
  await keyPlace(page, 'b02', '2');
  await pollObservation(page, (o) => o['allPlaced'] === true);
});

test('sort 사물: 상자 이름 아이콘을 붙이고 labelsMatchBy가 참이 된다', async ({ page }) => {
  await openSort(page, {
    deck: 'classroom-objects-12',
    binLabels: 'student-choice-icon',
    bins: 3,
  });
  const family: Readonly<Record<string, string>> = {
    'o-eraser': '1',
    'o-milk': '1',
    'o-tissue': '1',
    'o-dice': '1',
    'o-glue': '2',
    'o-roll': '2',
    'o-can-up': '2',
    'o-can-side': '2',
    'o-ball': '3',
    'o-marble': '3',
    'o-orange': '3',
    'o-bead': '3',
  };
  for (const [card, key] of Object.entries(family)) await keyPlace(page, card, key);
  await pollObservation(page, (o) => o['allPlaced'] === true);

  const group = (index: number) => page.getByRole('group', { name: `상자 ${index} 이름 붙이기` });
  await group(1).getByRole('button', { name: '상자 모양' }).click();
  await group(2).getByRole('button', { name: '둥근기둥 모양' }).click();
  await pollObservation(page, (o) => (o['labelsMatchBy'] as string[]).length === 0);
  await group(3).getByRole('button', { name: '공 모양' }).click();
  await pollObservation(page, (o) => (o['labelsMatchBy'] as string[]).includes('shapeFamily'));
  await expect(page.locator('[data-bin="bin2"]')).toHaveAttribute('aria-label', '둥근기둥 모양');
  // 눕힌 캔이 같은 상자에 있으니 방향 오개념은 없다.
  expect((await readObservation(page))['misconceptions']).toEqual([]);
});

test('sort 사물: 캔 둘을 다른 상자에 넣으면 방향 오개념이 기록된다', async ({ page }) => {
  await openSort(page, { deck: 'classroom-objects-12', bins: 3 });
  await keyPlace(page, 'o-can-up', '1');
  await keyPlace(page, 'o-can-side', '2');
  await pollObservation(page, (o) =>
    ((o['misconceptions'] ?? []) as string[]).includes('MC-SHAPE-ORIENTATION'),
  );
  // 카드를 눌러 든 뒤(Enter) 상자에서 Enter로 놓는 경로, 0 키로 카드 칸에 되돌리는 경로.
  await press(page.locator('[data-card="o-can-side"]'));
  await press(page.locator('[data-bin="bin1"]'));
  await pollObservation(
    page,
    (o) => (o['binOf'] as Record<string, string | null>)['o-can-side'] === 'bin1',
  );
  await keyPlace(page, 'o-can-side', '0');
  await pollObservation(
    page,
    (o) => (o['binOf'] as Record<string, string | null>)['o-can-side'] === null,
  );
});

const PREDICT_CONFIG = {
  variant: 'predict',
  deck: 'buttons-12',
  rule: { attribute: 'color', value: 'yellow' },
  guessOptions: [
    { attribute: 'color', value: 'red' },
    { attribute: 'color', value: 'blue' },
    { attribute: 'color', value: 'yellow' },
    { attribute: 'holes', value: 4 },
  ],
  seed: 5,
};

/** 새 카드의 보이는 색 글자(aria)로 진짜 상자를 안다(테스트는 기준이 노랑임을 알고 있다). */
async function newCardIsYellow(page: Page): Promise<boolean> {
  const label = (await page.locator('[data-new-card]').getAttribute('aria-label')) ?? '';
  return label.includes('노랑');
}

test('predict: 비밀 기준은 맞히기 전에 DOM에 없고, 예측 3번 뒤 기준을 맞힌다', async ({ page }) => {
  const { canvas } = await openSort(page, PREDICT_CONFIG, 'predict');
  await expect(page.locator('[data-testid="guess-panel"]')).toHaveCount(0);

  // 기준 전용 표시가 DOM(속성 포함)에 없다.
  const attributes = await page.evaluate(() => {
    const parts: string[] = [];
    for (const element of document.querySelectorAll(
      '[data-testid="sorter-canvas"], [data-testid="sorter-controls"]',
    )) {
      for (const node of [element, ...element.querySelectorAll('*')]) {
        for (const name of node.getAttributeNames())
          parts.push(`${name}=${node.getAttribute(name)}`);
      }
    }
    return parts.join('\n');
  });
  expect(attributes).not.toMatch(/rule|secret/i);
  await expect(page.locator('body')).not.toContainText('노란색');
  await capture(page, 'T217-predict');

  // 첫 예측은 끌어서, 나머지는 단추로 한다.
  for (let step = 0; step < 3; step += 1) {
    const yellow = await newCardIsYellow(page);
    const before = ((await readObservation(page))['predictions'] as number) ?? 0;
    if (step === 0) {
      await dragTo(
        page,
        page.locator('[data-new-card]'),
        page.locator(`[data-bin="${yellow ? 'yes' : 'no'}"]`),
      );
    } else {
      await page.locator(`button[data-predict="${yellow ? 'yes' : 'no'}"]`).click();
    }
    await pollObservation(page, (o) => (o['predictions'] as number) === before + 1);
    await expect(page.getByTestId('sorter-status')).toContainText('맞았어요');
  }
  await pollObservation(page, (o) => o['unlocked'] === true && o['streak'] === 3);
  const panel = page.getByTestId('guess-panel');
  await expect(panel).toBeVisible();

  // 틀린 기준 → 다시 잠기고 연속이 0이다.
  await panel.getByRole('button', { name: '파란색' }).click();
  await pollObservation(
    page,
    (o) => o['guesses'] === 1 && o['unlocked'] === false && o['streak'] === 0,
  );
  await expect(page.locator('[data-testid="guess-panel"]')).toHaveCount(0);
  await expect(page.getByTestId('sorter-status')).toContainText('카드를 더 보고 다시 골라요');

  for (let step = 0; step < 3; step += 1) {
    const yellow = await newCardIsYellow(page);
    const before = ((await readObservation(page))['predictions'] as number) ?? 0;
    await page.locator(`button[data-predict="${yellow ? 'yes' : 'no'}"]`).click();
    await pollObservation(page, (o) => (o['predictions'] as number) === before + 1);
  }
  await page.getByTestId('guess-panel').getByRole('button', { name: '노란색' }).click();
  await pollObservation(page, (o) => o['guessedRight'] === true && o['guesses'] === 2);
  await expect(page.getByTestId('guess-result')).toContainText('노란색');
  // 맞힌 뒤에는 예측 단추가 없다.
  await expect(page.locator('button[data-predict]')).toHaveCount(0);
  expect(await canvas.isVisible()).toBe(true);
});

test('predict 키보드: 새 카드에서 1·2 키와 Enter(들기) + 상자 Enter로 예측한다', async ({
  page,
}) => {
  await openSort(page, PREDICT_CONFIG, 'predict');
  const first = await newCardIsYellow(page);
  await press(page.locator('[data-new-card]'), first ? '1' : '2');
  await pollObservation(page, (o) => o['predictions'] === 1 && o['streak'] === 1);

  const second = await newCardIsYellow(page);
  await press(page.locator('[data-new-card]'));
  await press(page.locator(`[data-bin="${second ? 'yes' : 'no'}"]`));
  await pollObservation(page, (o) => o['predictions'] === 2 && o['streak'] === 2);
});

type OverlayCase = {
  readonly name: string;
  readonly config: Record<string, unknown>;
  readonly place: readonly (readonly [string, string])[];
  readonly check: (page: Page) => Promise<void>;
};

const OVERLAY_CASES: readonly OverlayCase[] = [
  {
    name: 'bin-attributes',
    config: { bins: 3 },
    place: [
      ['b01', '1'],
      ['b07', '1'],
      ['b02', '2'],
      ['b03', '3'],
    ],
    check: async (page) => {
      await expect(
        page.locator('[data-overlay="bin-attributes"] [data-odd="true"]').first(),
      ).toBeVisible();
    },
  },
  {
    name: 'two-friends',
    config: {},
    place: [],
    check: async (page) => {
      await expect(page.locator('[data-overlay="two-friends"] [data-friend]')).toHaveCount(2);
    },
  },
  {
    name: 'touch-dots',
    config: { bins: 2 },
    place: [
      ['b01', '1'],
      ['b02', '1'],
      ['b06', '2'],
    ],
    check: async (page) => {
      await expect(page.locator('[data-overlay="touch-dots"] [data-dot]')).toHaveCount(3);
      // 번호 글자는 쓰지 않는다.
      await expect(page.locator('[data-overlay="touch-dots"] text')).toHaveCount(0);
    },
  },
  {
    name: 'gray-shapes',
    config: { deck: 'classroom-objects-12', bins: 2 },
    place: [
      ['o-eraser', '1'],
      ['o-glue', '1'],
    ],
    check: async (page) => {
      await expect(page.locator('[data-overlay="gray-shapes"] [data-gray]')).toHaveCount(2);
    },
  },
  {
    name: 'rotate-match',
    config: { deck: 'classroom-objects-12', bins: 2 },
    place: [
      ['o-can-up', '1'],
      ['o-can-side', '2'],
    ],
    check: async (page) => {
      await expect(page.locator('[data-overlay="rotate-match"] [data-rotate-match]')).toHaveCount(
        1,
      );
    },
  },
];

for (const overlayCase of OVERLAY_CASES) {
  test(`sort 힌트 겹쳐 보기 ${overlayCase.name}가 본 판과 1px 안에 겹친다`, async ({ page }) => {
    const query = new URLSearchParams({
      config: JSON.stringify(overlayCase.config),
      overlay: overlayCase.name,
    });
    await page.goto(`/?${query.toString()}#/sandbox/E17`);
    await expect(page.getByRole('heading', { name: '분류기' })).toBeVisible();
    await setMode(page, 'sort');
    const canvas = page.getByTestId('sorter-canvas');
    await canvas.scrollIntoViewIfNeeded();
    for (const [card, key] of overlayCase.place) await keyPlace(page, card, key);
    await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();

    const overlay = page.locator(`[data-overlay="${overlayCase.name}"] svg`);
    await expect(overlay).toBeVisible();
    await overlayCase.check(page);
    await expect
      .poll(async () => {
        const canvasBox = await canvas.boundingBox();
        const overlayBox = await overlay.boundingBox();
        if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(overlayBox.x - canvasBox.x),
          Math.abs(overlayBox.y - canvasBox.y),
          Math.abs(overlayBox.width - canvasBox.width),
          Math.abs(overlayBox.height - canvasBox.height),
        );
      })
      .toBeLessThanOrEqual(1);
    await capture(page, `T217-overlay-${overlayCase.name}`);
  });
}

test('rotate-match는 눕힌 캔이 판에 없으면 그리지 않고, 움직임 줄이기면 애니메이션이 없다', async ({
  page,
}) => {
  await page.goto(
    `/?${new URLSearchParams({
      config: JSON.stringify({
        deck: 'classroom-objects-12',
        bins: 2,
        cards: ['o-can-up', 'o-ball'],
      }),
      overlay: 'rotate-match',
    }).toString()}#/sandbox/E17`,
  );
  await setMode(page, 'sort');
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  // 눕힌 캔이 판에 없으면 오버레이는 아무것도 그리지 않는다(svg 자체가 없다).
  await expect(page.locator('[data-overlay="rotate-match"]')).toHaveCount(1);
  await expect(page.locator('[data-overlay="rotate-match"] svg')).toHaveCount(0);
  await expect(page.locator('[data-rotate-match]')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    `/?${new URLSearchParams({
      config: JSON.stringify({ deck: 'classroom-objects-12', bins: 2 }),
      overlay: 'rotate-match',
    }).toString()}#/sandbox/E17`,
  );
  await setMode(page, 'sort');
  await keyPlace(page, 'o-can-up', '1');
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const group = page.locator('[data-rotate-match]');
  await expect(group).toHaveCount(1);
  expect(await group.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});

test('조작 칸 첫 줄이 첫 화면에 보인다(sort 기준 고르기·이름 아이콘, predict)', async ({
  page,
}) => {
  await openSort(page, { criterionChoice: ['color', 'shape', 'holes', 'pretty'] });
  await expectControlsAboveFold(page, 'sort 기준 고르기', 0, 'sorter-controls', 'page');

  await openSort(page, { deck: 'classroom-objects-12', binLabels: 'student-choice-icon' });
  await expectControlsAboveFold(page, 'sort 사물 이름 아이콘', 0, 'sorter-controls', 'page');

  await openSort(page, PREDICT_CONFIG, 'predict');
  await expectControlsAboveFold(page, 'predict', 0, 'sorter-controls', 'page');
});

test('터치 타깃 64px 모드에서 단추가 64px 이상이고 카드가 판 안에 있다', async ({ page }) => {
  await openSort(page, {
    criterionChoice: ['color', 'shape', 'holes', 'pretty'],
    countTable: 'student',
    bins: 3,
  });
  await page.getByRole('button', { name: /터치 48px/ }).click();
  await page.locator('[data-criterion="color"]').click();
  await placeByColor(page);
  await pollObservation(page, (o) => o['allPlaced'] === true);

  const buttons = page.getByTestId('sorter-controls').getByRole('button');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(5);
  for (let index = 0; index < count; index += 1) {
    const box = await buttons.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  }
  await expectControlsAboveFold(page, 'sort 64px', 0, 'sorter-controls', 'page');

  // 카드(그림)가 판 상자 안에 있고, 상자 너비로만 배율을 구해 카드 크기가 손가락 크기 이상이다.
  const canvasBox = await page.getByTestId('sorter-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;
  const scale = canvasBox.width / 1000;
  const cards = page.locator('[data-card]');
  const total = await cards.count();
  for (let index = 0; index < total; index += 1) {
    const box = await cards.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
    expect(box.width).toBeGreaterThanOrEqual(30 * scale);
  }
});

/** 화면 기준 이미지: 판(SVG) 그림만. 크롬북·아이패드만 찍는다. */
async function expectBoardSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  // 키보드로 마지막에 초점이 간 카드의 초점 테두리가 기준 이미지에 남지 않게 한다.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | SVGElement | null)?.blur();
  });
  await page.waitForTimeout(500); // 벨트·점 애니메이션이 끝나도록
  await expect(page.getByTestId('sorter-canvas')).toHaveScreenshot(name, {
    animations: 'disabled',
  });
}

test('화면 기준 이미지: sort 단추', async ({ page }) => {
  await openSort(page, {
    criterionChoice: ['color', 'shape', 'holes', 'pretty'],
    countTable: 'auto',
  });
  await page.locator('[data-criterion="color"]').click();
  await placeByColor(page);
  await pollObservation(page, (o) => o['allPlaced'] === true);
  await expectBoardSnapshot(page, 'sorter-sort-buttons.png');
});

test('화면 기준 이미지: sort 사물', async ({ page }) => {
  await openSort(page, { deck: 'classroom-objects-12', bins: 3 });
  const family: Readonly<Record<string, string>> = {
    'o-eraser': '1',
    'o-milk': '1',
    'o-tissue': '1',
    'o-dice': '1',
    'o-glue': '2',
    'o-roll': '2',
    'o-can-up': '2',
    'o-can-side': '2',
  };
  for (const [card, key] of Object.entries(family)) await keyPlace(page, card, key);
  await pollObservation(page, (o) => (o['tray'] as string[]).length === 4);
  await expectBoardSnapshot(page, 'sorter-sort-objects.png');
});

test('화면 기준 이미지: predict', async ({ page }) => {
  await openSort(page, PREDICT_CONFIG, 'predict');
  await expectBoardSnapshot(page, 'sorter-predict.png');
});
