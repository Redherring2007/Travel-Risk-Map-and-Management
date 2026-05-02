import { expect, test } from '@playwright/test';

test('dashboard loads and shows only executive markers', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Atlas Insight')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Executive Overview' })).toBeVisible();
  await expect(page.getByText('High and critical events only')).toBeVisible();
  await expect(page.locator('.event-marker')).toHaveCount(2);
});

test('risk map supports country and city exploration', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Risk Map/ }).click();
  await expect(page.getByRole('heading', { name: 'Risk Map' })).toBeVisible();
  await page.getByPlaceholder('Search countries').fill('Kenya');
  await page.getByRole('button', { name: 'Kenya' }).click();
  await expect(page.getByText('Full intelligence profile')).toBeVisible();
  await expect(page.getByText('Emergency capability')).toBeVisible();
  await page.getByPlaceholder('Search cities globally').fill('Nairobi');
  await page.getByRole('button', { name: /Nairobi/ }).click();
  await expect(page.getByText('Nairobi, Kenya')).toBeVisible();
});

test('free user is blocked then paid user completes trip, docs, and report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Itineraries/ }).click();
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByText('Paid client subscription required')).toBeVisible();
  await page.getByRole('button', { name: 'Sign up / log in as client' }).click();
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByText('Trip created and saved')).toBeVisible();
  await page.getByRole('button', { name: /Passport/ }).click();
  await expect(page.getByText('passport.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Run Assessment and Generate Report' }).click();
  await expect(page.getByText('Atlas Insight - Nairobi executive visit Risk Report')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download report' })).toBeVisible();
});

test('all sidebar destinations render working views', async ({ page }) => {
  await page.goto('/');
  for (const item of ['Countries', 'Cities', 'Alerts', 'Travel Feed', 'Support', 'Settings']) {
    await page.getByRole('button', { name: new RegExp(item) }).click();
    await expect(page.getByRole('heading', { name: item })).toBeVisible();
  }
});
