import { expect, test } from '@playwright/test';

test('dashboard is a flat 2D executive map with only high critical markers and hover popup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Atlas Insight')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Executive Overview' })).toBeVisible();
  await expect(page.locator('[data-map-mode="2d-flat"]')).toBeVisible();
  await expect(page.locator('.event-marker')).toHaveCount(2);
  await page.locator('.event-marker').first().hover();
  await expect(page.getByTestId('map-hover-popup')).toBeVisible();
  await expect(page.getByTestId('map-hover-popup')).toContainText(/High|Critical/);
  await page.mouse.move(5, 5);
  await expect(page.getByTestId('map-hover-popup')).toHaveCount(0);
});

test('risk map hover is temporary and click opens the full brief below', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Risk Map/ }).click();
  await expect(page.locator('[data-map-mode="2d-flat"]')).toBeVisible();
  await page.locator('.country').first().hover();
  await expect(page.getByTestId('map-hover-popup')).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(page.getByTestId('map-hover-popup')).toHaveCount(0);
  await page.getByPlaceholder('Search countries').fill('Ke');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByRole('button', { name: 'Kenya' }).click();
  await expect(page.getByTestId('country-breakdown')).toBeVisible();
  await expect(page.getByText('Current advisory')).toBeVisible();
  await expect(page.getByText('Operational support recommendation')).toBeVisible();
});

test('country and city search include all available profiles and open details', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Risk Map/ }).click();
  await page.getByPlaceholder('Search countries').fill('Arg');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByPlaceholder('Search cities globally').fill('Na');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByRole('button', { name: /Nairobi/ }).click();
  await expect(page.getByText('Nairobi, Kenya')).toBeVisible();
});

test('countries page uses cards, search, monitoring and summary popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Countries/ }).click();
  await expect(page.locator('.country-card').first()).toBeVisible();
  await page.getByPlaceholder('Search countries').fill('Ke');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByRole('button', { name: 'Kenya' }).click();
  await expect(page.getByText('Open full Risk Map brief')).toBeVisible();
  await page.getByRole('button', { name: 'Open full Risk Map brief' }).click();
  await expect(page.getByRole('heading', { name: 'Risk Map' })).toBeVisible();
});

test('cities page uses safest highest-risk columns and summary popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Cities/ }).click();
  await expect(page.getByText('Top 5 Safest Cities')).toBeVisible();
  await expect(page.getByText('Top 5 Highest Risk Cities')).toBeVisible();
  await page.getByPlaceholder('Search cities').fill('Na');
  await expect(page.locator('.results')).toBeVisible();
  await page.getByRole('button', { name: /Nairobi/ }).click();
  await expect(page.getByText('Open full Risk Map brief')).toBeVisible();
});

test('guided itinerary flow blocks free users then completes for clients with document AI fallback and report download', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Itineraries/ }).click();
  await expect(page.getByText('Guided client workflow')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByText('Paid client subscription required')).toBeVisible();
  await page.getByRole('button', { name: 'Sign up / log in as client' }).click();
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByText('Trip created. Continue to documents and assessment.')).toBeVisible();
  await expect(page.getByText(/AI extraction unavailable|AI provider configured/)).toBeVisible();
  await page.getByRole('button', { name: /passport metadata/ }).click();
  await expect(page.getByText('passport-metadata.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Missing fields')).toBeVisible();
  await page.getByRole('button', { name: 'Run Assessment and Generate Report' }).click();
  await expect(page.getByText('Atlas Insight - Nairobi executive visit Risk Report')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download report' })).toBeVisible();
});

test('travel feed no-trip state and support request are operational', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Travel Feed/ }).click();
  await expect(page.getByText('No trips planned')).toBeVisible();
  await page.getByRole('button', { name: /Support/ }).click();
  await expect(page.getByText('Emergency Contact Guidance')).toBeVisible();
  await page.getByRole('button', { name: 'Request Operational Support' }).click();
  await expect(page.getByText('General operational support enquiry prepared.')).toBeVisible();
});

test('settings exposes provider status panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Provider Status' })).toBeVisible();
  await expect(page.getByText(/Demo fallback active|Public data active|Live provider active/).first()).toBeVisible();
});
