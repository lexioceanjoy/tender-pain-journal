import { expect, test, type Page } from '@playwright/test';

// docs/plans/check-in-gaps.md, "Proving the basic check-in stays under 30
// seconds". A regression guard, not a claim about real people: each action
// gets a generous 4-second "person deciding" pause.
const DECIDE_MS = 4_000;
const NEW_FIELDS = ['interference', 'interferenceAreas', 'activityEffects', 'areaPatterns', 'painWokeMe'];

async function storedEntries(page: Page) {
  return page.evaluate(() => new Promise<Array<Record<string, unknown> & { occurredAt: string; createdAt: string }>>((resolve, reject) => {
    const open = indexedDB.open('tender-journal');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction('painEntries').objectStore('painEntries').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  }));
}

async function newestEntry(page: Page) {
  const entries = await storedEntries(page);
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

test('the basic check-in is four paced actions and finishes under 30 seconds', async ({ page }) => {
  test.setTimeout(60_000);
  const started = Date.now();
  await page.goto('/');

  await page.waitForTimeout(DECIDE_MS);
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.waitForTimeout(DECIDE_MS);
  await page.getByRole('button', { name: 'Left lower back', exact: true }).click();
  await page.waitForTimeout(DECIDE_MS);
  await page.getByRole('slider', { name: 'Pain intensity' }).fill('6');

  const save = page.getByRole('button', { name: 'Save check-in' });
  await expect(save).toBeEnabled();
  for (const hidden of ['Did pain get in the way', 'Made worse', 'Steady', 'Pain woke me']) {
    await expect(page.getByText(hidden).first()).toBeHidden();
  }
  await expect(page.locator('details.context-panel').first()).not.toHaveAttribute('open', '');

  await page.waitForTimeout(DECIDE_MS);
  await save.click();
  await expect(page.getByText('Check-in saved privately on this device.')).toBeVisible();
  expect(Date.now() - started).toBeLessThan(30_000);
});

test('a basic check-in stores none of the new fields, even with an earlier pattern to pre-fill', async ({ page }) => {
  await page.goto('/');
  // An earlier check-in that records a pattern for the same region.
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.getByRole('button', { name: 'Left lower back', exact: true }).click();
  await page.getByRole('slider', { name: 'Pain intensity' }).fill('4');
  await page.getByText('Add context').click();
  await page.getByRole('button', { name: 'Left lower back: Steady' }).click();
  await page.getByRole('button', { name: 'Save now' }).click();
  expect((await newestEntry(page)).areaPatterns).toEqual([{ regionId: expect.any(String), pattern: 'steady' }]);

  // The basic path: Add context never opened, so the pre-fill is not saved.
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.getByRole('button', { name: 'Left lower back', exact: true }).click();
  await page.getByRole('slider', { name: 'Pain intensity' }).fill('6');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Check-in saved privately on this device.')).toBeVisible();
  const saved = JSON.stringify(await newestEntry(page));
  for (const field of NEW_FIELDS) expect(saved).not.toContain(field);
});

test('Repeat last stays about 10 seconds', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.getByRole('button', { name: 'Left lower back', exact: true }).click();
  await page.getByRole('slider', { name: 'Pain intensity' }).fill('6');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByRole('button', { name: 'Repeat last' })).toBeVisible();

  const started = Date.now();
  await page.waitForTimeout(DECIDE_MS);
  await page.getByRole('button', { name: 'Repeat last' }).click();
  await page.waitForTimeout(DECIDE_MS);
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Check-in saved privately on this device.')).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
});

test('the new optional context saves and shows in Insights', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.getByRole('button', { name: 'Left lower back', exact: true }).click();
  await page.getByRole('slider', { name: 'Pain intensity' }).fill('7');
  await page.getByText('Add context').click();
  await expect(page.getByText('Did pain get in the way today?')).toBeVisible();
  await page.getByRole('button', { name: 'Long sitting', exact: true }).click();
  await page.getByRole('button', { name: 'Long sitting: Made worse' }).click();
  await expect(page.getByRole('button', { name: 'Poor sleep: Made worse' })).toHaveCount(0);
  await page.getByRole('button', { name: 'A lot', exact: true }).click();
  await page.getByRole('button', { name: 'Work', exact: true }).click();
  await page.getByRole('button', { name: 'A little', exact: true }).click();
  await expect(page.getByText('What did it get in the way of?')).toBeHidden();
  await page.getByRole('button', { name: 'Couldn’t do usual things' }).click();
  await page.getByRole('button', { name: 'Social', exact: true }).click();
  await page.getByRole('button', { name: 'Pain woke me' }).click();
  await page.getByRole('button', { name: 'Left lower back: Comes and goes' }).click();
  await page.getByRole('button', { name: 'Save now' }).click();

  const entry = await newestEntry(page) as { context: Record<string, unknown>; areaPatterns: unknown };
  expect(entry.context).toMatchObject({
    activities: ['Long sitting'], activityEffects: { 'Long sitting': 'worse' },
    interference: 'unable', interferenceAreas: ['social'], painWokeMe: true
  });
  expect(entry.areaPatterns).toEqual([{ regionId: expect.any(String), pattern: 'comes-and-goes' }]);

  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Days pain got in the way' })).toBeVisible();
  await expect(page.getByText(/Pain woke you on \d+ nights?/)).toBeVisible();
  await expect(page.getByText(/marked as making it worse/).first()).toBeVisible();
});
