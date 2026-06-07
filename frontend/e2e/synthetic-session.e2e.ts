import { expect, test } from '@playwright/test'

test('runs the default synthetic session and renders a persisted backend report', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GazeTrack' })).toBeVisible()

  await page.getByRole('button', { name: 'Open demo study' }).first().click()

  await expect(page.getByRole('heading', { name: 'Demo session' })).toBeVisible()
  await expect(page.getByText('Synthetic tracker available')).toBeVisible()
  await expect(page.getByLabel('Telemetry source')).toHaveValue('synthetic')

  await page.getByRole('button', { name: 'Start demo session' }).click()
  await page.getByRole('button', { name: 'Run synthetic calibration' }).click()

  await expect(page.getByText('58 / 58')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Complete demo session' }).click()

  await expect(page.getByRole('heading', { name: 'Ingest status' })).toBeVisible()
  await expect(page.locator('.ingest-status-panel')).toContainText('Accepted', { timeout: 10_000 })
  await expect(page.locator('.ingest-status-panel')).toContainText('58')
  await expect(page.locator('.ingest-status-panel')).toContainText('Accepted privacy-safe telemetry')

  await expect(page.getByRole('heading', { name: 'Persisted telemetry report' })).toBeVisible()
  await expect(page.locator('.backend-report-panel')).toContainText('Generated', { timeout: 10_000 })
  await expect(page.locator('.backend-report-panel')).toContainText('fixation_demo_v1')
  await expect(page.locator('.backend-report-panel')).toContainText('Contains gaze events')
  await expect(page.locator('.backend-report-panel')).toContainText('Quality verdict')
})
