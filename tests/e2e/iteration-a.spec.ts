import { expect, test } from '@playwright/test';

test('a basic check-in is short, deliberate, and persists', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'A quick note while it’s fresh.' })).toBeVisible();
  await page.getByRole('button', { name: 'New check-in' }).click();

  const saveBeforeLocation = page.getByRole('button', { name: 'Select a location to continue' });
  await expect(saveBeforeLocation).toBeDisabled();
  await page.getByRole('button', { name: 'Left lower back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose an intensity to continue' })).toBeDisabled();

  await page.getByRole('slider', { name: 'Pain intensity' }).fill('6');
  await page.getByRole('button', { name: 'Save check-in' }).click();

  await expect(page.getByText('Check-in saved privately on this device.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repeat last' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Your most recent check-in')).toBeVisible();
  await expect(page.getByText('6/10')).toBeVisible();
});

test('Repeat last copies pain settings but not one-off context', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.getByRole('button', { name: 'Left buttock', exact: true }).click();
  await page.getByRole('slider', { name: 'Pain intensity' }).fill('7');
  await page.getByText('Add context').click();
  await page.getByRole('button', { name: 'Aching' }).click();
  await page.getByRole('button', { name: 'Long sitting' }).click();
  await page.getByRole('textbox', { name: 'Anything else?' }).fill('Long drive before this episode.');
  await expect(page.getByRole('button', { name: 'Save now' })).toBeVisible();
  await page.getByRole('button', { name: 'Save now' }).click();

  await page.getByRole('button', { name: 'Repeat last' }).click();
  await expect(page.getByText('Repeating last', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save check-in' })).toBeEnabled();
  await page.getByText('Add context').click();
  await expect(page.getByRole('button', { name: 'Aching' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Long sitting' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('textbox', { name: 'Anything else?' })).toHaveValue('');
});

test('the four primary tasks remain reachable on a phone viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New check-in' }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: 'More' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Privacy and support' })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Your check-ins' })).toBeVisible();
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'What your records show' })).toBeVisible();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy and support' })).toBeVisible();
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page.getByRole('button', { name: 'New check-in' })).toBeVisible();
});
