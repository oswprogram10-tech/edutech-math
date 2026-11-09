import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E07 세로셈 격자 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북(Chromium)·전자칠판 뷰포트에서 모두 돈다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly aligned?: boolean;
  readonly alignment?: string | null;
  readonly complete?: boolean;
  readonly result?: string | null;
  readonly resultRaw?: string | null;
  readonly wrongColumns?: readonly number[];
  readonly misconceptions?: readonly string[];
  readonly [key: string]: unknown;
}

async function openColumnCalc(page: Page, config: Record<string, unknown>) {
  const query = `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`${query}#/sandbox/E07`);
  await expect(page.getByRole('heading', { name: '세로셈 격자' })).toBeVisible();
  await expect(page.getByTestId('column-grid')).toBeVisible();
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

async function selectMode(page: Page, mode: string): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

function topCell(page: Page, column: number) {
  return page.locator(`[data-testid="column-grid"] [data-row="top"][data-column="${column}"]`);
}

async function placeCard(page: Page, card: 'a' | 'b', column: number): Promise<void> {
  await page.getByTestId(`card-${card}`).click();
  await topCell(page, column).click();
}

async function typeResult(page: Page, digits: readonly string[]): Promise<void> {
  for (const digit of digits) {
    await page.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
}

test('소수점 자석을 켜고 3.5 + 1.27 = 4.77을 쓴다', async ({ page }) => {
  await openColumnCalc(page, { a: '3.5', b: '1.27', magnetAlign: 'C-P' });
  await selectMode(page, 'decimal');

  // 카드를 소수점 자리에 놓으면 자석이 두 소수점을 맞춘다.
  await placeCard(page, 'a', 0);
  await placeCard(page, 'b', 0);
  await pollObservation(page, (observation) => observation.alignment === 'point');

  const placed = await readObservation(page);
  expect(placed.aligned).toBe(true);

  // 결과는 오른쪽(소수 둘째)부터 왼쪽으로 채운다.
  await typeResult(page, ['7', '7', '4']);
  await pollObservation(page, (observation) => observation.complete === true);

  const observation = await readObservation(page);
  expect(observation.resultRaw).toBe('4.77');
  expect(observation.result).toBe('4.77');
  expect(observation.wrongColumns).toEqual([]);
  expect(observation.misconceptions).toEqual([]);
});

test('자석을 끄고 오른쪽 끝을 맞추면 MC-DEC-ALIGN-RIGHT가 나온다', async ({ page }) => {
  await openColumnCalc(page, { a: '3.5', b: '1.27', magnetAlign: false });
  await selectMode(page, 'decimal');

  // 3.5 카드를 한 칸 오른쪽에 놓아 두 소수점을 어긋나게 한다.
  await placeCard(page, 'a', -1);
  await placeCard(page, 'b', 0);
  await pollObservation(page, (observation) => observation.alignment === 'right-edge');

  const placed = await readObservation(page);
  expect(placed.aligned).toBe(false);

  await typeResult(page, ['7', '7', '4']);
  await pollObservation(page, (observation) =>
    (observation.misconceptions ?? []).includes('MC-DEC-ALIGN-RIGHT'),
  );

  const observation = await readObservation(page);
  expect(observation.aligned).toBe(false);
  expect(observation.wrongColumns?.length).toBeGreaterThan(0);
  expect(observation.misconceptions).toContain('MC-DEC-ALIGN-RIGHT');
});

test('키보드만으로 52 − 17 = 35를 쓴다', async ({ page }) => {
  await openColumnCalc(page, { a: '52', b: '17', op: 'sub' });
  await selectMode(page, 'sub');

  // 격자에 초점을 주고 오른쪽 칸부터 숫자를 친다.
  await page.getByTestId('column-grid').focus();
  await page.keyboard.press('5');
  await pollObservation(page, (observation) => observation.mode === 'sub');
  await page.keyboard.press('3');
  await pollObservation(page, (observation) => observation.complete === true);

  const observation = await readObservation(page);
  expect(observation.result).toBe('35');
  expect(observation.resultRaw).toBe('35');
  expect(observation.wrongColumns).toEqual([]);
  expect(observation.misconceptions).toEqual([]);
});

test('키보드로 46×27의 부분곱 322·920과 합 1242를 쓴다', async ({ page }) => {
  await openColumnCalc(page, { a: 46, b: 27 });
  await selectMode(page, 'mul');
  await pollObservation(page, (observation) => observation.mode === 'mul');

  // 일의 자리부터: 첫째 줄 223, 둘째 줄 29. 커서는 여분 앞자리 칸까지 가므로
  // 아래 줄로 내려가 일의 자리로 옮긴 뒤 합 2421을 쓴다.
  await page.getByTestId('column-grid').focus();
  for (const key of '22329') {
    await page.keyboard.press(key);
  }
  await page.keyboard.press('ArrowDown');
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('ArrowRight');
  }
  for (const key of '2421') {
    await page.keyboard.press(key);
  }
  await pollObservation(page, (observation) => observation.complete === true);

  const observation = await readObservation(page);
  expect(observation.partials).toEqual(['322', '920']);
  expect(observation.rowsComplete).toBe(true);
  expect(observation.result).toBe('1242');
  expect(observation.resultRaw).toBe('1242');
  expect(observation.wrongColumns).toEqual([]);
  expect(observation.misconceptions).toEqual([]);
});

test('소수 곱셈 2.4 × 1.3: 어림 3을 정하고 점을 놓아 78/25를 만든다', async ({ page }) => {
  await openColumnCalc(page, {
    mode: 'decimal',
    op: 'mul',
    a: '2.4',
    b: '1.3',
    requireEstimate: true,
  });
  await selectMode(page, 'decimal');
  await expect(page.getByTestId('decimal-estimate')).toBeVisible();

  await page.getByRole('button', { name: '3 어림값으로 쓰기' }).click();
  await page.getByTestId('decimal-estimate-lock').click();
  await pollObservation(page, (observation) => observation.phase === 'calc');

  // 일의 자리부터 부분곱 두 줄(여분 앞자리 0 포함)을 쓰고, 결과 312를 쓴 뒤
  // 여분 앞자리에서 한 칸 오른쪽으로 와 점을 놓는다.
  await page.getByTestId('column-grid').focus();
  for (const key of '2700420213') {
    await page.keyboard.press(key);
  }
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('.');
  await pollObservation(page, (observation) => observation.complete === true);

  const observation = await readObservation(page);
  expect(observation.result).toBe('78/25');
  expect(observation.resultRaw).toBe('3.12');
  expect(observation.signal).toBe('green');
  expect(observation.pointPlaced).toBe(true);
  expect(observation.misconceptions).toEqual([]);
});

test('시프트 데모 3.75에서 ×10을 누르면 75/2가 된다', async ({ page }) => {
  await openColumnCalc(page, {
    op: 'mul',
    a: '3.75',
    b: '10',
    shiftDemo: { value: '3.75', ops: ['×10', '×0.1'] },
  });
  await selectMode(page, 'decimal');
  await expect(page.getByTestId('shift-demo')).toBeVisible();

  await page.getByRole('button', { name: '×10 만큼 옮기기' }).click();
  await pollObservation(page, (observation) => observation.shiftValue === '75/2');

  const observation = await readObservation(page);
  expect(observation.shiftValue).toBe('75/2');
  expect(observation.shiftHistory).toEqual(['×10']);
});

test('어림값 800을 정한 뒤 389 + 412 = 801을 쓰면 초록 신호가 나온다', async ({ page }) => {
  await openColumnCalc(page, { a: 389, b: 412 });
  await selectMode(page, 'estimate');
  await expect(page.getByTestId('estimate-cell')).toBeVisible();
  await expect(page.getByTestId('column-grid')).toHaveCount(0);

  for (const digit of '800') {
    await page.getByRole('button', { name: `${digit} 쓰기` }).click();
  }
  await page.getByRole('button', { name: '어림값 정하기' }).click();
  await expect(page.getByTestId('column-grid')).toBeVisible();

  await typeResult(page, ['1', '0', '8']);
  await pollObservation(page, (observation) => observation.signal === 'green');

  const observation = await readObservation(page);
  expect(observation.phase).toBe('calc');
  expect(observation.estimate).toBe('800');
  expect(observation.result).toBe('801');
  await expect(page.getByTestId('estimate-signal')).toHaveAttribute('data-signal', 'green');
  await expect(page.getByTestId('estimate-signal')).toContainText('가까워요');
});

test('키보드로 52÷4의 몫 13과 나머지 0을 쓴다', async ({ page }) => {
  await openColumnCalc(page, { mode: 'div', dividend: 52, divisor: 4 });
  await selectMode(page, 'div');
  await expect(page.getByTestId('column-grid')).toHaveAttribute('data-mode', 'div');

  // 몫 → 곱 → 뺄셈 → 내림 → 다음 몫 순서다.
  await page.getByTestId('column-grid').focus();
  for (const key of '14123210') {
    await page.keyboard.press(key);
  }
  await pollObservation(page, (observation) => observation.divComplete === true);

  const observation = await readObservation(page);
  expect(observation.quotient).toBe('13');
  expect(observation.remainder).toBe('0');
  expect(observation.result).toBe('13');
  expect(observation.complete).toBe(true);
  expect(observation.misconceptions).toEqual([]);
});

test('408÷4에서 십의 자리를 비우면 skippedZero가 켜진다', async ({ page }) => {
  await openColumnCalc(page, {
    mode: 'div',
    dividend: 408,
    divisor: 4,
    flagSkippedZero: true,
  });
  await selectMode(page, 'div');

  await page.getByTestId('column-grid').focus();
  await page.keyboard.press('1');
  // 십의 자리를 지나 일의 자리 몫 칸에 직접 2를 쓴다.
  await page.locator('[data-row="quotient"][data-column="0"]').click();
  await page.keyboard.press('2');
  await pollObservation(page, (observation) => observation.skippedZero === true);

  const observation = await readObservation(page);
  expect(observation.skippedZero).toBe(true);
  expect(observation.quotient).toBe('12');
  expect(observation.misconceptions).toContain('MC-DIV-QUOTIENT-ZERO');
  await expect(page.locator('[data-row="quotient"][data-column="1"][data-gap]')).toHaveCount(1);
});

test('95÷23 배수 사다리에서 5 다음 4를 고르면 estimateRevised가 켜진다', async ({ page }) => {
  await openColumnCalc(page, {
    mode: 'div',
    dividend: 95,
    divisor: 23,
    estimateBar: { show: 'C-P', maxMultiple: 9 },
    remainderAlarm: true,
  });
  await selectMode(page, 'div');
  await expect(page.getByLabel('배수 사다리')).toBeVisible();

  // 사다리는 몫 칸에 커서가 있을 때만 보인다. 일의 자리 몫 칸을 고른다.
  await page.locator('[data-row="quotient"][data-column="0"]').click();
  await page.getByRole('button', { name: /^5배/ }).click();
  await page.getByRole('button', { name: /^4배/ }).click();
  await page.getByRole('button', { name: '4을 몫으로 정하기' }).click();
  await pollObservation(page, (observation) => observation.estimateRevised === true);

  const observation = await readObservation(page);
  expect(observation.estimateRevised).toBe(true);
  expect(observation.quotient).toBe('4');
  expect(observation.estimateTries).toEqual({ '0': [5, 4] });
});

test('소수 나눗셈 6.24÷3: 키보드로 2.08을 쓰고 점을 놓아 52/25를 만든다', async ({ page }) => {
  await openColumnCalc(page, {
    mode: 'div',
    decimal: true,
    dividend: '6.24',
    divisor: 3,
    flagSkippedZero: true,
  });
  await selectMode(page, 'div');
  await expect(page.getByTestId('column-grid')).toHaveAttribute('data-decimal', 'true');

  // 몫 → 곱 → 뺄셈 → (0 몫) → 내림 → 다음 몫 순서다.
  await page.getByTestId('column-grid').focus();
  for (const key of '26002484200') {
    await page.keyboard.press(key);
  }

  // 몫 소수점은 몫 칸을 고르고 `.`로 놓는다.
  await page.locator('[data-row="quotient"][data-column="0"]').click();
  await page.keyboard.press('.');
  await pollObservation(page, (observation) => observation.divComplete === true);

  const observation = await readObservation(page);
  expect(observation.quotient).toBe('52/25');
  expect(observation.quotientRaw).toBe('2.08');
  expect(observation.quotientPoint).toBe(0);
  expect(observation.result).toBe('52/25');
  expect(observation.remainder).toBe('0');
  expect(observation.misconceptions).toEqual([]);
});

test('소수 나눗셈 9.3÷6: 격자에 초점을 두고 +로 0을 붙여 31/20을 만든다', async ({ page }) => {
  await openColumnCalc(page, {
    mode: 'div',
    decimal: true,
    dividend: '9.3',
    divisor: 6,
    extendZeros: 2,
  });
  await selectMode(page, 'div');

  await page.getByTestId('column-grid').focus();
  for (const key of '163530330') {
    await page.keyboard.press(key);
  }
  // 격자에 초점이 있을 때 +는 실행기 확대가 아니라 0 붙이기다.
  await page.keyboard.press('+');
  await pollObservation(page, (observation) => observation.extendedZeros === 1);

  await page.locator('[data-row="quotient"][data-column="-2"]').click();
  for (const key of '500300') {
    await page.keyboard.press(key);
  }
  await page.locator('[data-row="quotient"][data-column="0"]').click();
  await page.keyboard.press('.');
  await pollObservation(page, (observation) => observation.divComplete === true);

  const observation = await readObservation(page);
  expect(observation.quotient).toBe('31/20');
  expect(observation.quotientRaw).toBe('1.55');
  expect(observation.remainder).toBe('0');
  expect(observation.extendedZeros).toBe(1);
  expect(observation.misconceptions).toEqual([]);
});

test('소수÷소수 1.68÷0.24: 확대경 ×100 뒤 168÷24로 7을 만든다', async ({ page }) => {
  await openColumnCalc(page, {
    mode: 'div',
    decimal: true,
    dividend: '1.68',
    divisor: '0.24',
    magnifier: [10, 100],
    allowOneSideScale: true,
  });
  await selectMode(page, 'div');
  await expect(page.getByTestId('grid-closed')).toBeVisible();

  await page.getByRole('button', { name: '×100' }).click();
  await pollObservation(
    page,
    (observation) => observation.scaleA === 2 && observation.scaleB === 2,
  );
  await expect(page.getByTestId('magnifier-numbers')).toContainText('168');
  await expect(page.getByTestId('magnifier-numbers')).toContainText('24');

  await page.getByTestId('column-grid').focus();
  for (const key of '7861000') {
    await page.keyboard.press(key);
  }
  await pollObservation(page, (observation) => observation.divComplete === true);

  const observation = await readObservation(page);
  expect(observation.scaleA).toBe(2);
  expect(observation.scaleB).toBe(2);
  expect(observation.scaledDividend).toBe('168');
  expect(observation.scaledDivisor).toBe('24');
  expect(observation.quotient).toBe('7');
  expect(observation.remainder).toBe('0');
  expect(observation.misconceptions).toEqual([]);
});

test('소수 나눗셈 8.16÷4: 나누어지는 수 소수점이 보이고 엔진 밖 키는 격자에 들어가지 않는다', async ({
  page,
}) => {
  await openColumnCalc(page, {
    mode: 'div',
    decimal: true,
    dividend: '8.16',
    divisor: 4,
  });
  await selectMode(page, 'div');

  // 나누어지는 수 일의 자리 오른쪽에 소수점이 보인다(8.16).
  await expect(
    page.locator(
      '[data-testid="column-grid"] [data-row="dividend"][data-column="0"] [data-point-mark="true"]',
    ),
  ).toBeVisible();

  // 응답 칸 대신 엔진 밖 요소에 초점을 두고 친 숫자는 격자에 들어가지 않는다.
  await page.evaluate(() => {
    const outside = document.createElement('div');
    outside.tabIndex = 0;
    outside.id = 'outside-keyboard';
    document.body.appendChild(outside);
    outside.focus();
  });
  await page.keyboard.press('3');
  await expect(
    page.locator('[data-testid="column-grid"] [data-row="quotient"][data-filled="true"]'),
  ).toHaveCount(0);

  // 격자 칸에 초점을 두면 같은 키가 그 칸에 들어간다.
  await page.locator('[data-testid="column-grid"] [data-row="quotient"][data-column="0"]').click();
  await page.keyboard.press('3');
  await expect(
    page.locator('[data-testid="column-grid"] [data-row="quotient"][data-column="0"]'),
  ).toHaveText('3');
});

test('debugSample이 없는 나눗셈·곱셈에는 틀린 칸 표시 버튼이 없고 F 키도 무시한다', async ({
  page,
}) => {
  await openColumnCalc(page, { mode: 'div', dividend: 95, divisor: 23 });
  await selectMode(page, 'div');
  await expect(page.getByRole('button', { name: /틀린 칸을 골라/ })).toHaveCount(0);
  await page.locator('[data-row="quotient"][data-column="0"]').click();
  await page.keyboard.press('f');
  await expect(page.locator('[data-flagged="true"]')).toHaveCount(0);

  await openColumnCalc(page, { mode: 'mul', a: 347, b: 26 });
  await selectMode(page, 'mul');
  await expect(page.getByRole('button', { name: /틀린 칸을 골라/ })).toHaveCount(0);
  await page.locator('[data-row="partial"][data-index="0"][data-column="0"]').click();
  await page.keyboard.press('F');
  await expect(page.locator('[data-flagged="true"]')).toHaveCount(0);
});

test('debugSample이 있는 곱셈에는 틀린 칸 표시 버튼이 있고 F 키로 칸을 표시한다', async ({
  page,
}) => {
  await openColumnCalc(page, {
    mode: 'mul',
    a: 347,
    b: 26,
    debugSample: { rows: ['2082', '694'], sum: '2776' },
  });
  await selectMode(page, 'mul');
  await expect(page.getByRole('button', { name: /틀린 칸을 골라/ })).toBeVisible();
  await page.locator('[data-row="partial"][data-index="1"][data-column="0"]').click();
  await page.keyboard.press('f');
  await expect(page.locator('[data-flagged="true"]')).toHaveCount(1);
});
