import { expect, test } from '@playwright/test'

const apiBaseUrl = 'http://127.0.0.1:8000'

declare global {
  interface Window {
    __GazeTrackCaptureLoaded?: boolean
    __GazeTrackCaptureError?: string
    GazeTrackConfig?: unknown
    webgazer?: { emitPrediction?: (x: number, y: number, confidence: number) => void }
  }
}

test('runs a real-site fixed AOI capture against a local fixture page', async ({ page, request }) => {
  const consoleMessages: string[] = []
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`))
  const createResponse = await request.post(`${apiBaseUrl}/api/v1/studies/configurations`, {
    data: {
      name: 'Fixture real-site study',
      objective: 'Measure CTA discovery on a controlled page.',
      target_url: 'http://127.0.0.1:5173/fixture-real-site.html',
      tasks: [{ prompt: 'Find the team checkout button.' }],
      aois: [
        { label: 'Navigation', semantic_type: 'nav', role_key: 'navigation', x: 0, y: 0, width: 1, height: 0.1 },
        { label: 'Hero headline', semantic_type: 'hero', role_key: 'hero_headline', x: 0, y: 0.1, width: 1, height: 0.2 },
        { label: 'Primary CTA', semantic_type: 'CTA', role_key: 'primary_cta', x: 0, y: 0.25, width: 1, height: 0.1 },
        { label: 'Pricing preview', semantic_type: 'pricing', role_key: 'pricing_preview', x: 0, y: 0.5, width: 1, height: 0.2 },
        { label: 'Footer', semantic_type: 'footer', role_key: 'footer', x: 0, y: 0.9, width: 1, height: 0.1 },
      ],
    },
  })
  expect(createResponse.ok()).toBeTruthy()
  const study = (await createResponse.json()).study
  const configResponse = await request.get(`${apiBaseUrl}/api/v1/studies/${study.study_id}/capture-snippet-config`)
  expect(configResponse.ok()).toBeTruthy()
  const captureConfig = await configResponse.json()

  await page.goto(
    `/fixture-real-site.html?apiBaseUrl=${encodeURIComponent(apiBaseUrl)}&studyId=${encodeURIComponent(
      study.study_id,
    )}&captureToken=${encodeURIComponent(captureConfig.capture_token)}`,
  )

  try {
    await expect(page.getByText('GazeTrack study')).toBeVisible()
  } catch (error) {
    const captureState = await page.evaluate(() => ({
      loaded: Boolean(window.__GazeTrackCaptureLoaded),
      error: window.__GazeTrackCaptureError ?? null,
      config: window.GazeTrackConfig ?? null,
    }))
    throw new Error(`Capture overlay did not load: ${JSON.stringify(captureState)}; console=${consoleMessages.join(' | ')}`)
  }
  const sessionResponsePromise = page.waitForResponse((response) => response.url().includes('/capture-sessions'))
  await page.getByRole('button', { name: 'Start task' }).click()
  const sessionResponse = await sessionResponsePromise
  const session = await sessionResponse.json()

  await page.getByRole('button', { name: 'Start team checkout' }).click()
  const completeResponsePromise = page.waitForResponse((response) => response.url().includes(`/sessions/${session.session_id}/complete`))
  await page.getByRole('button', { name: 'Finish task' }).click()
  await completeResponsePromise

  const reportResponse = await request.get(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report`)
  const report = await reportResponse.json()

  expect(reportResponse.ok()).toBeTruthy()
  expect(report.tracker_type).toBe('real_site_capture')
  expect(report.aoi_count).toBe(5)
  expect(report.event_type_counts.click).toBeGreaterThanOrEqual(1)
  expect(report.aoi_metrics.some((metric: { coordinate_space: string }) => metric.coordinate_space === 'document_normalized')).toBe(
    true,
  )
})

test('runs WebGazer-enabled real-site setup with calibration and task telemetry', async ({ page, request }) => {
  const submittedBatches: Array<{ events: Array<{ event_type: string; payload: Record<string, unknown> }> }> = []
  page.on('request', (apiRequest) => {
    if (apiRequest.method() === 'POST' && /\/api\/v1\/sessions\/.+\/events$/.test(apiRequest.url())) {
      const body = apiRequest.postDataJSON()
      submittedBatches.push(body)
    }
  })

  const createResponse = await request.post(`${apiBaseUrl}/api/v1/studies/configurations`, {
    data: {
      name: 'Fixture WebGazer real-site study',
      objective: 'Measure CTA discovery on a controlled page with approximate gaze telemetry.',
      target_url: 'http://127.0.0.1:5173/fixture-real-site.html',
      tasks: [{ prompt: 'Find the team checkout button after calibration.' }],
      aois: [
        { label: 'Navigation', semantic_type: 'nav', role_key: 'navigation', x: 0, y: 0, width: 1, height: 0.1 },
        { label: 'Hero headline', semantic_type: 'hero', role_key: 'hero_headline', x: 0, y: 0.1, width: 1, height: 0.2 },
        { label: 'Primary CTA', semantic_type: 'CTA', role_key: 'primary_cta', x: 0, y: 0.25, width: 1, height: 0.1 },
        { label: 'Pricing preview', semantic_type: 'pricing', role_key: 'pricing_preview', x: 0, y: 0.5, width: 1, height: 0.2 },
        { label: 'Footer', semantic_type: 'footer', role_key: 'footer', x: 0, y: 0.9, width: 1, height: 0.1 },
      ],
    },
  })
  expect(createResponse.ok()).toBeTruthy()
  const study = (await createResponse.json()).study
  const configResponse = await request.get(`${apiBaseUrl}/api/v1/studies/${study.study_id}/capture-snippet-config`)
  const captureConfig = await configResponse.json()

  await page.goto(
    `/fixture-real-site.html?apiBaseUrl=${encodeURIComponent(apiBaseUrl)}&studyId=${encodeURIComponent(
      study.study_id,
    )}&captureToken=${encodeURIComponent(
      captureConfig.capture_token,
    )}&enableWebGazer=true&stubWebGazer=true&requireCameraReadiness=false&calibrationPasses=1`,
  )

  await expect(page.getByText('GazeTrack setup')).toBeVisible()
  const sessionResponsePromise = page.waitForResponse((response) => response.url().includes('/capture-sessions'))
  await page.getByRole('button', { name: 'Start setup' }).click()
  const session = await (await sessionResponsePromise).json()
  await expect(page.getByText('Calibration', { exact: true })).toBeVisible()

  for (let index = 0; index < 9; index += 1) {
    await page.getByRole('button', { name: 'Calibration target' }).click()
  }

  await expect(page.getByText('Task running')).toBeVisible()
  await page.evaluate(() => window.webgazer?.emitPrediction?.(240, 220, 0.84))
  await page.waitForTimeout(300)
  await page.evaluate(() => window.scrollTo(0, 500))
  await page.waitForTimeout(550)
  await page.getByRole('button', { name: 'Start team checkout' }).click()
  const completeResponsePromise = page.waitForResponse((response) => response.url().includes(`/sessions/${session.session_id}/complete`))
  await page.getByRole('button', { name: 'Finish task' }).click()
  await completeResponsePromise

  const submittedEvents = submittedBatches.flatMap((batch) => batch.events)
  const submittedTypes = new Set(submittedEvents.map((event) => event.event_type))
  expect([...submittedTypes]).toEqual(
    expect.arrayContaining(['page_view', 'quality', 'calibration', 'task_start', 'gaze', 'scroll', 'click', 'task_complete']),
  )
  expect(submittedEvents.some((event) => event.payload.label === 'calibration_point')).toBe(true)
  expect(submittedEvents.some((event) => event.payload.label === 'calibration_complete')).toBe(true)
  expect(JSON.stringify(submittedEvents)).not.toMatch(/webcam_frame|screenshot_blob|image_blob|base64|face_embedding|landmarks/i)

  const aoiSnapshotResponse = await request.get(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report`)
  const report = await aoiSnapshotResponse.json()
  expect(aoiSnapshotResponse.ok()).toBeTruthy()
  expect(report.tracker_type).toBe('real_site_capture')
  expect(report.aoi_count).toBe(5)
  expect(report.event_type_counts.calibration).toBeGreaterThanOrEqual(10)
  expect(report.event_type_counts.gaze).toBeGreaterThanOrEqual(1)
  expect(report.event_type_counts.click).toBeGreaterThanOrEqual(1)
  expect(report.event_type_counts.scroll).toBeGreaterThanOrEqual(1)
  expect(report.event_type_counts.task_start).toBe(1)
  expect(report.privacy_summary.raw_media_stored).toBe(false)

  const mediaResponse = await request.post(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/events`, {
    data: {
      capture_token: captureConfig.capture_token,
      event_type: 'gaze',
      timestamp: new Date().toISOString(),
      payload: {
        source: 'real_site_capture',
        tracker_type: 'real_site_capture',
        x: 0.4,
        y: 0.4,
        screenshot_blob: 'not allowed',
      },
    },
  })
  const mediaResult = await mediaResponse.json()
  expect(mediaResponse.ok()).toBeTruthy()
  expect(mediaResult.accepted_count).toBe(0)
  expect(mediaResult.rejected_count).toBe(1)
})
