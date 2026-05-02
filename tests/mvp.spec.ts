import { expect, test } from '@playwright/test';

test('dashboard is a flat 2D executive map with only high critical markers and hover popup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Atlas Insight')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Executive Overview' })).toBeVisible();
  await expect(page.locator('[data-map-mode="2d-flat"]')).toBeVisible();
  await expect(page.locator('.event-marker')).toHaveCount(2);
  await page.locator('.event-marker').first().hover();
  await expect(page.locator('.map-popup')).toBeVisible();
  await expect(page.locator('.map-popup')).toContainText(/High|Critical/);
  await page.mouse.move(5, 5);
  await expect(page.locator('.map-popup')).toHaveCount(0);
});

test('dashboard feed items click through to country or city intelligence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Avoid border-area travel/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Risk Map' })).toBeVisible();
  await expect(page.getByTestId('country-breakdown')).toBeVisible();
  await expect(page.getByText('Atlas Insight country guide')).toBeVisible();
});

test('risk map is 2D, risk-coloured, searchable and opens breakdown below map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Risk Map/ }).click();
  await expect(page.locator('[data-map-mode="2d-flat"]')).toBeVisible();
  await expect(page.locator('.country').first()).toBeVisible();
  await page.getByPlaceholder('Search countries').fill('Ke');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByRole('button', { name: 'Kenya' }).click();
  await expect(page.getByTestId('country-breakdown')).toBeVisible();
  await expect(page.getByText('Executive risk summary')).toBeVisible();
  await page.getByPlaceholder('Search cities globally').fill('Na');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByRole('button', { name: /Nairobi/ }).click();
  await expect(page.getByText('Nairobi, Kenya')).toBeVisible();
});

test('country search includes public baseline countries beyond demo examples', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Risk Map/ }).click();
  await page.getByPlaceholder('Search countries').fill('Arg');
  await expect(page.locator('.results')).toBeVisible();
});

test('guided itinerary flow still blocks free users then completes for clients', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Itineraries/ }).click();
  await expect(page.getByText('Guided client workflow')).toBeVisible();
  await expect(page.getByText('Destination')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByText('Paid client subscription required')).toBeVisible();
  await page.getByRole('button', { name: 'Sign up / log in as client' }).click();
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByText('Trip created. Continue to documents and assessment.')).toBeVisible();
  await page.getByRole('button', { name: /Passport/ }).click();
  await expect(page.getByText('passport.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Run Assessment and Generate Report' }).click();
  await expect(page.getByText('Atlas Insight - Nairobi executive visit Risk Report')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download report' })).toBeVisible();
});

test('settings exposes provider status panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Provider Status' })).toBeVisible();
  await expect(page.getByText(/Demo fallback active|Public data active|Live provider active/).first()).toBeVisible();
});
