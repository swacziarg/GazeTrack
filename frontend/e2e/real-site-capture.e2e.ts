import { expect, test } from '@playwright/test'

const apiBaseUrl = 'http://127.0.0.1:8000'

declare global {
  interface Window {
    __GazeTrackCaptureLoaded?: boolean
    __GazeTrackCaptureError?: string
    GazeTrackConfig?: unknown
    __GazeTrackWebGazerCalls?: unknown[][]
    __GazeTrackWebGazerTrackStopped?: boolean
    webgazer?: {
      emitPrediction?: (x: number, y: number, confidence: number) => void
      params?: { faceMeshSolutionPath?: string }
    }
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

  await expect(page.getByText('Task running')).toBeVisible()
  await page.getByRole('button', { name: 'Start team checkout' }).click()
  const completeResponsePromise = page.waitForResponse((response) => response.url().includes(`/sessions/${session.session_id}/complete`))
  await page.getByRole('button', { name: 'Finish task' }).click()
  await completeResponsePromise
  await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute(
    'href',
    `${apiBaseUrl}/api/v1/sessions/${session.session_id}/report-view`,
  )

  const reportResponse = await request.get(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report`)
  const report = await reportResponse.json()

  expect(reportResponse.ok()).toBeTruthy()
  expect(report.tracker_type).toBe('real_site_capture')
  expect(report.aoi_count).toBe(5)
  expect(report.event_type_counts.click).toBeGreaterThanOrEqual(1)
  expect(report.page_layouts.length).toBeGreaterThanOrEqual(1)
  expect(report.page_layouts[0].snapshot_type).toBe('safe_dom_layout_v1')
  expect(JSON.stringify(report.page_layouts)).toContain('Find the plan that keeps your launch moving')
  expect(report.aoi_metrics.some((metric: { coordinate_space: string }) => metric.coordinate_space === 'document_normalized')).toBe(
    true,
  )
  const reportViewResponse = await request.get(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report-view`)
  expect(reportViewResponse.ok()).toBeTruthy()
  expect(await reportViewResponse.text()).toContain('Find the plan that keeps your launch moving')
})

test('continues real-site capture across SPA navigation and scroll depth', async ({ page, request }) => {
  const createResponse = await request.post(`${apiBaseUrl}/api/v1/studies/configurations`, {
    data: {
      name: 'Fixture multi-page real-site study',
      objective: 'Verify route changes keep capture active across pages.',
      target_url: 'http://127.0.0.1:5173/fixture-real-site.html',
      tasks: [{ prompt: 'Open how it works, scroll, and find checkout.' }],
      aois: [
        { label: 'Hero headline', semantic_type: 'hero', role_key: 'hero_headline', selector: '[data-gazetrack-aoi="hero_headline"]', x: 0, y: 0.1, width: 1, height: 0.2 },
        { label: 'Primary CTA', semantic_type: 'CTA', role_key: 'primary_cta', selector: '[data-gazetrack-aoi="primary_cta"]', x: 0, y: 0.25, width: 1, height: 0.1 },
        { label: 'Pricing preview', semantic_type: 'pricing', role_key: 'pricing_preview', selector: '[data-gazetrack-aoi="pricing_preview"]', x: 0, y: 0.5, width: 1, height: 0.2 },
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
    )}&captureToken=${encodeURIComponent(captureConfig.capture_token)}`,
  )

  const sessionResponsePromise = page.waitForResponse((response) => response.url().includes('/capture-sessions'))
  await page.getByRole('button', { name: 'Start task' }).click()
  const session = await (await sessionResponsePromise).json()
  await expect(page.getByText('Task running')).toBeVisible()

  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(page).toHaveURL(/\/fixture-real-site\.html\/how-it-works/)
  await expect(page.getByText('How Northstar keeps launch decisions clear')).toBeVisible()
  await page.waitForTimeout(500)
  await page.evaluate(() => window.scrollTo(0, 700))
  await page.waitForTimeout(550)
  await page.getByRole('button', { name: 'Start team checkout' }).click()
  const completeResponsePromise = page.waitForResponse((response) => response.url().includes(`/sessions/${session.session_id}/complete`))
  await page.getByRole('button', { name: 'Finish task' }).click()
  await completeResponsePromise

  const reportResponse = await request.get(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report`)
  const report = await reportResponse.json()
  expect(reportResponse.ok()).toBeTruthy()
  expect(report.event_type_counts.page_view).toBeGreaterThanOrEqual(2)
  expect(report.event_type_counts.scroll).toBeGreaterThanOrEqual(1)
  expect(report.aoi_count).toBeGreaterThanOrEqual(6)
  const metricPageUrls = new Set(report.aoi_metrics.map((metric: { page_url: string | null }) => metric.page_url))
  expect([...metricPageUrls].some((url) => String(url).includes('/fixture-real-site.html?'))).toBe(true)
  expect([...metricPageUrls].some((url) => String(url).includes('/fixture-real-site.html/how-it-works?'))).toBe(true)
  expect(report.replay_events.some((event: { page_url?: string }) => event.page_url?.includes('/how-it-works'))).toBe(true)
  expect(report.page_layouts.some((layout: { page_url?: string }) => layout.page_url?.includes('/how-it-works'))).toBe(true)

  await page.goto(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report-view`)
  await page.locator('#replay-range').evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = input.max
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect.poll(() => page.locator('#replay-stage').evaluate((element) => element.dataset.activePageUrl || '')).toContain('/how-it-works')
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
  await expect(page.getByText('Keep your head still. Look directly at the teal target, then click it.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Calibration target' })).toHaveCount(0)
  const webGazerRuntime = await page.evaluate(() => ({
    calls: window.__GazeTrackWebGazerCalls,
    faceMeshSolutionPath: window.webgazer?.params?.faceMeshSolutionPath,
  }))
  expect(webGazerRuntime.calls).toEqual(
    expect.arrayContaining([
      ['saveDataAcrossSessions', false],
      ['showVideoPreview', false],
      ['showPredictionPoints', false],
      ['setGazeListener'],
      ['begin'],
    ]),
  )
  expect(webGazerRuntime.faceMeshSolutionPath).toBe(`${apiBaseUrl}/webgazer-mediapipe/face_mesh`)
  await page.getByRole('button', { name: 'Start calibration' }).click()
  await expect(page.getByText('Calibration', { exact: true })).toBeVisible()

  for (let index = 0; index < 9; index += 1) {
    await page.getByRole('button', { name: 'Calibration target' }).click()
  }

  await expect(page.getByText('Task running')).toBeVisible()
  await page.evaluate(() => window.webgazer?.emitPrediction?.(240, 220, 0.84))
  await expect(page.locator('#gazetrack-gaze-dot')).toHaveCSS('opacity', '1')
  await page.waitForTimeout(300)
  await page.evaluate(() => window.scrollTo(0, 500))
  await page.waitForTimeout(550)
  await page.getByRole('button', { name: 'Start team checkout' }).click()
  const completeResponsePromise = page.waitForResponse((response) => response.url().includes(`/sessions/${session.session_id}/complete`))
  await page.getByRole('button', { name: 'Finish task' }).click()
  await completeResponsePromise
  await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute(
    'href',
    `${apiBaseUrl}/api/v1/sessions/${session.session_id}/report-view`,
  )
  await expect(page.locator('#gazetrack-gaze-dot')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Boolean(window.__GazeTrackWebGazerTrackStopped))).toBe(true)

  const submittedEvents = submittedBatches.flatMap((batch) => batch.events)
  const submittedTypes = new Set(submittedEvents.map((event) => event.event_type))
  expect([...submittedTypes]).toEqual(
    expect.arrayContaining(['page_view', 'quality', 'calibration', 'task_start', 'gaze', 'scroll', 'click', 'task_complete']),
  )
  expect(submittedEvents.some((event) => event.payload.label === 'calibration_point')).toBe(true)
  expect(submittedEvents.some((event) => event.payload.label === 'calibration_complete')).toBe(true)
  expect(JSON.stringify(submittedEvents)).not.toMatch(/webcam_frame|screenshot_blob|image_blob|base64|face_embedding|face_landmark/i)

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

  await page.goto(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report-view`)
  await page.getByRole('button', { name: 'Play replay' }).click()
  await expect.poll(() => page.locator('#replay-stage').evaluate((element) => Number(element.dataset.scrollY || 0))).toBeGreaterThan(0)
  await expect.poll(() => page.locator('#replay-stage .page-canvas').first().evaluate((element) => getComputedStyle(element).transform)).not.toBe('none')

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

test('turns off WebGazer/camera during the task and continues interaction-only telemetry', async ({ page, request }) => {
  const createResponse = await request.post(`${apiBaseUrl}/api/v1/studies/configurations`, {
    data: {
      name: 'Fixture WebGazer stop study',
      objective: 'Verify participant can stop browser gaze capture early.',
      target_url: 'http://127.0.0.1:5173/fixture-real-site.html',
      tasks: [{ prompt: 'Try the browser gaze stop control.' }],
      aois: [
        { label: 'Primary CTA', semantic_type: 'CTA', role_key: 'primary_cta', x: 0, y: 0.25, width: 1, height: 0.1 },
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

  const sessionResponsePromise = page.waitForResponse((response) => response.url().includes('/capture-sessions'))
  await page.getByRole('button', { name: 'Start setup' }).click()
  const session = await (await sessionResponsePromise).json()
  await expect(page.getByText('Keep your head still. Look directly at the teal target, then click it.')).toBeVisible()
  await page.getByRole('button', { name: 'Start calibration' }).click()
  for (let index = 0; index < 9; index += 1) {
    await page.getByRole('button', { name: 'Calibration target' }).click()
  }
  await expect(page.getByText('Task running')).toBeVisible()
  await page.evaluate(() => window.webgazer?.emitPrediction?.(320, 260, 0.8))
  await expect(page.locator('#gazetrack-gaze-dot')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Turn off eye tracking/camera' }).click()
  await expect(page.getByText('Interaction-only task telemetry is still running.')).toBeVisible()
  await expect(page.locator('#gazetrack-gaze-dot')).toHaveCount(0)
  const calls = await page.evaluate(() => window.__GazeTrackWebGazerCalls)
  expect(calls).toEqual(expect.arrayContaining([['clearGazeListener'], ['pause'], ['end']]))
  await page.evaluate(() => window.webgazer?.emitPrediction?.(360, 300, 0.9))
  await page.getByRole('button', { name: 'Start team checkout' }).click()
  const completeResponsePromise = page.waitForResponse((response) => response.url().includes(`/sessions/${session.session_id}/complete`))
  await page.getByRole('button', { name: 'Finish task' }).click()
  await completeResponsePromise

  await expect(page.getByText('GazeTrack task complete')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute(
    'href',
    `${apiBaseUrl}/api/v1/sessions/${session.session_id}/report-view`,
  )

  const reportResponse = await request.get(`${apiBaseUrl}/api/v1/sessions/${session.session_id}/report`)
  const report = await reportResponse.json()
  expect(reportResponse.ok()).toBeTruthy()
  expect(report.completed).toBe(true)
  expect(report.event_type_counts.task_complete).toBe(1)
  expect(report.event_type_counts.quality).toBeGreaterThanOrEqual(1)
  expect(report.event_type_counts.click).toBeGreaterThanOrEqual(1)
  expect(report.event_type_counts.gaze).toBeGreaterThanOrEqual(1)
  expect(report.privacy_summary.raw_media_stored).toBe(false)
})
