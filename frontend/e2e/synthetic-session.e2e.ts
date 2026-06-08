import { expect, test } from '@playwright/test'

test('runs the default synthetic session and renders a persisted backend report', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GazeTrack' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Setup 5 regions' })).toBeVisible()
  await expect(page.getByText('Demo Guide')).toBeVisible()
  await expect(page.getByText('Define the task and key regions')).toBeVisible()

  await page.getByRole('button', { name: 'Open run' }).click()

  await expect(page.getByRole('heading', { name: 'Demo session' })).toBeVisible()
  await expect(page.getByLabel('GazeTrack workflow').getByText('Synthetic demo')).toBeVisible()

  await page.getByRole('button', { name: 'Start demo session' }).click()
  await page.getByRole('button', { name: 'Run synthetic calibration' }).click()

  await expect(page.getByRole('button', { name: 'End demo' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'End demo' }).click()

  await expect(page.getByRole('heading', { name: 'What changed attention?' })).toBeVisible()
  await expect(page.getByText('Visual report overview')).toBeVisible()

  await page.getByRole('button', { name: /Local metrics and ingest/ }).click()
  await expect(page.getByRole('heading', { name: 'Ingest status' })).toBeVisible()
  await expect(page.locator('.ingest-status-panel')).toContainText('Accepted', { timeout: 10_000 })
  await expect(page.locator('.ingest-status-panel')).toContainText('58')
  await expect(page.locator('.ingest-status-panel')).toContainText('privacy-safe telemetry')

  await page.getByRole('button', { name: /Persisted telemetry report/ }).click()
  await expect(page.getByRole('heading', { name: 'Persisted telemetry report' })).toBeVisible()
  await expect(page.locator('.backend-report-panel')).toContainText('Generated', { timeout: 10_000 })
  await expect(page.locator('.backend-report-panel')).toContainText('fixation_demo_v1')
  await expect(page.locator('.backend-report-panel')).toContainText('Contains gaze events')
  await expect(page.locator('.backend-report-panel')).toContainText('Quality verdict')
})
