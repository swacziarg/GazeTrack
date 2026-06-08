(function () {
  const SOURCE = 'real_site_capture'
  const DEFAULT_WEBGAZER_SCRIPT_URL = 'https://webgazer.cs.brown.edu/webgazer.js'
  const MIN_AOI_SIZE = 0.0001
  const GAZE_SAMPLE_INTERVAL_MS = 250
  const MAX_SESSION_GAZE_EVENTS = 240
  const READINESS_HOLD_MS = 1200
  const config = window.GazeTrackConfig || {}
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/$/, '')
  const studyId = String(config.studyId || '')
  const captureToken = String(config.captureToken || '')
  const enableWebGazer = config.enableWebGazer === true
  const webgazerScriptUrl = String(config.webgazerScriptUrl || DEFAULT_WEBGAZER_SCRIPT_URL)
  const calibrationPasses = Math.max(1, Math.min(5, Number(config.calibrationPasses || 1) || 1))
  const requireCameraReadiness = config.requireCameraReadiness !== false

  if (!apiBaseUrl || !studyId || !captureToken || window.__GazeTrackCaptureLoaded) {
    return
  }
  window.__GazeTrackCaptureLoaded = true

  const calibrationTargets = [
    { x: 0.12, y: 0.12 },
    { x: 0.5, y: 0.12 },
    { x: 0.88, y: 0.12 },
    { x: 0.12, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.88, y: 0.5 },
    { x: 0.12, y: 0.88 },
    { x: 0.5, y: 0.88 },
    { x: 0.88, y: 0.88 },
  ]

  let captureConfig = null
  let sessionId = null
  let started = false
  let setupStarted = false
  let completed = false
  let eventQueue = []
  let latestPrediction = null
  let gazeSampleCount = 0
  let lastScrollEventAt = 0
  let lastGazeEventAt = 0
  let previewStream = null
  let readinessTimer = null
  let readinessStartedAt = 0
  let calibrationStartedAt = 0

  function nowIso() {
    return new Date().toISOString()
  }

  function clamp(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  }

  function roundCoordinate(value) {
    return Number(clamp(value).toFixed(4))
  }

  function roundMetric(value) {
    return Number(value.toFixed(3))
  }

  function roundRectStart(value) {
    return Number(Math.max(0, Math.min(1 - MIN_AOI_SIZE, roundCoordinate(value))).toFixed(4))
  }

  function roundRectSize(start, value) {
    const roundedSize = Math.max(MIN_AOI_SIZE, roundCoordinate(value))
    return Number(Math.min(1 - start, roundedSize).toFixed(4))
  }

  function documentSize() {
    const doc = document.documentElement
    const body = document.body
    return {
      width: Math.max(doc.scrollWidth, doc.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0, 1),
      height: Math.max(doc.scrollHeight, doc.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0, 1),
    }
  }

  function normalizePoint(clientX, clientY) {
    const size = documentSize()
    return {
      x: roundCoordinate((clientX + window.scrollX) / size.width),
      y: roundCoordinate((clientY + window.scrollY) / size.height),
      document_width: size.width,
      document_height: size.height,
    }
  }

  function normalizeViewportPoint(clientX, clientY) {
    const size = documentSize()
    return {
      x: roundCoordinate((clientX + window.scrollX) / size.width),
      y: roundCoordinate((clientY + window.scrollY) / size.height),
      document_width: size.width,
      document_height: size.height,
      viewport_x: roundCoordinate(clientX / Math.max(window.innerWidth, 1)),
      viewport_y: roundCoordinate(clientY / Math.max(window.innerHeight, 1)),
    }
  }

  function basePayload(label) {
    const size = documentSize()
    return {
      label,
      source: SOURCE,
      tracker_type: SOURCE,
      page_url: window.location.href,
      page_path: window.location.pathname,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      document_width: size.width,
      document_height: size.height,
      scroll_x: window.scrollX,
      scroll_y: window.scrollY,
      coordinate_space: 'document_normalized',
    }
  }

  function enqueue(event_type, payload) {
    eventQueue.push({
      event_type,
      timestamp: nowIso(),
      payload,
    })
  }

  function selectorForAoi(aoi) {
    return (aoi.selector && aoi.selector.trim()) || `[data-gazetrack-aoi="${aoi.role_key}"]`
  }

  function querySelectorSafely(selector) {
    try {
      return document.querySelector(selector)
    } catch (error) {
      return null
    }
  }

  function resolveAoi(aoi) {
    const selector = selectorForAoi(aoi)
    const element = querySelectorSafely(selector)
    const size = documentSize()
    if (!element) {
      return {
        source_aoi_id: aoi.aoi_id,
        label: aoi.label,
        semantic_type: aoi.semantic_type || null,
        role_key: aoi.role_key,
        selector,
        page_url: window.location.href,
        x: 0,
        y: 0,
        width: 0.01,
        height: 0.01,
        coordinate_space: 'document_normalized',
        detected: false,
      }
    }
    const rect = element.getBoundingClientRect()
    const x = roundRectStart((rect.left + window.scrollX) / size.width)
    const y = roundRectStart((rect.top + window.scrollY) / size.height)
    return {
      source_aoi_id: aoi.aoi_id,
      label: aoi.label,
      semantic_type: aoi.semantic_type || null,
      role_key: aoi.role_key,
      selector,
      page_url: window.location.href,
      x,
      y,
      width: roundRectSize(x, rect.width / size.width),
      height: roundRectSize(y, rect.height / size.height),
      coordinate_space: 'document_normalized',
      detected: rect.width > 0 && rect.height > 0,
    }
  }

  async function postJson(path, body) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`GazeTrack API responded with HTTP ${response.status}`)
    }
    return response.json()
  }

  async function fetchConfig() {
    const response = await fetch(`${apiBaseUrl}/api/v1/studies/${encodeURIComponent(studyId)}/capture-config`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`GazeTrack capture config failed with HTTP ${response.status}`)
    }
    captureConfig = await response.json()
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function buttonStyle(primary) {
    return primary
      ? 'border:0;background:#111827;color:#fff;border-radius:6px;padding:9px 12px;cursor:pointer'
      : 'border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:6px;padding:9px 12px;cursor:pointer'
  }

  function overlayShell(width, anchored) {
    return [
      'position:fixed',
      anchored ? 'right:16px' : 'inset:0',
      anchored ? 'bottom:16px' : '',
      'z-index:2147483647',
      anchored ? `width:${width}` : 'width:auto',
      'font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#111827',
      anchored ? 'background:#ffffff' : 'background:rgba(17,24,39,.72)',
      anchored ? 'border:1px solid #d1d5db' : '',
      anchored ? 'box-shadow:0 18px 50px rgba(17,24,39,.18)' : '',
      anchored ? 'border-radius:8px' : '',
      anchored ? 'padding:16px' : '',
      anchored ? '' : 'display:grid;place-items:center',
    ].filter(Boolean).join(';')
  }

  function panelHtml(inner, maxWidth) {
    return `<div style="width:min(${maxWidth || '520px'},calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:1px solid #d1d5db;box-shadow:0 22px 70px rgba(17,24,39,.28);border-radius:8px;padding:20px">${inner}</div>`
  }

  function renderOverlay() {
    if (enableWebGazer) {
      renderConsentOverlay()
      return
    }
    renderInteractionOverlay()
  }

  function renderInteractionOverlay() {
    const host = document.createElement('div')
    host.id = 'gazetrack-capture-overlay'
    host.style.cssText = overlayShell('min(360px,calc(100vw - 32px))', true)
    host.innerHTML = [
      '<strong style="display:block;margin-bottom:6px">GazeTrack study</strong>',
      `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
      '<p style="margin:0 0 12px;color:#4b5563;font-size:12px">This page records task events, clicks, scrolls, approximate gaze points when available, and quality metadata. No webcam video, screenshots, frames, or images are sent.</p>',
      '<div style="display:flex;gap:8px;justify-content:flex-end">',
      '<button type="button" data-gazetrack-decline style="border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:8px 10px">Decline</button>',
      '<button type="button" data-gazetrack-start style="border:0;background:#111827;color:#fff;border-radius:6px;padding:8px 10px">Start task</button>',
      '</div>',
    ].join('')
    host.querySelector('[data-gazetrack-decline]').addEventListener('click', () => host.remove())
    host.querySelector('[data-gazetrack-start]').addEventListener('click', () => startCapture(host))
    document.body.appendChild(host)
  }

  function renderConsentOverlay() {
    const host = document.createElement('div')
    host.id = 'gazetrack-capture-overlay'
    host.style.cssText = overlayShell('auto', false)
    host.innerHTML = panelHtml([
      '<strong style="display:block;margin-bottom:8px;font-size:18px">GazeTrack setup</strong>',
      `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
      '<p style="margin:0 0 12px;color:#4b5563">This study uses browser-based gaze estimation. It is approximate, browser-dependent, and not medical-grade eye tracking.</p>',
      '<p style="margin:0 0 16px;color:#4b5563;font-size:12px">Camera processing stays local in this browser. GazeTrack submits telemetry such as normalized gaze points, clicks, scrolls, calibration summaries, and quality metadata. It does not send webcam video, frames, screenshots, image blobs, face embeddings, or landmarks.</p>',
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">',
      `<button type="button" data-gazetrack-decline style="${buttonStyle(false)}">Decline</button>`,
      `<button type="button" data-gazetrack-start-setup style="${buttonStyle(true)}">Start setup</button>`,
      '</div>',
    ].join(''))
    host.querySelector('[data-gazetrack-decline]').addEventListener('click', () => host.remove())
    host.querySelector('[data-gazetrack-start-setup]').addEventListener('click', () => startWebGazerSetup(host))
    document.body.appendChild(host)
  }

  async function createCaptureSessionIfNeeded() {
    if (sessionId) {
      return
    }
    const size = documentSize()
    const session = await postJson(`/api/v1/studies/${encodeURIComponent(studyId)}/capture-sessions`, {
      capture_token: captureToken,
      page_url: window.location.href,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      document_width: size.width,
      document_height: size.height,
    })
    sessionId = session.session_id

    const snapshots = captureConfig.aois.map(resolveAoi)
    await postJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/aoi-snapshots`, {
      capture_token: captureToken,
      snapshots,
    })
  }

  async function startCapture(host) {
    if (started || !captureConfig) {
      return
    }
    started = true
    await createCaptureSessionIfNeeded()

    enqueue('page_view', basePayload('Real-site page viewed'))
    enqueue('task_start', {
      ...basePayload('Real-site task started'),
      target: captureConfig.task_prompt,
      task_prompt: captureConfig.task_prompt,
      study_name: captureConfig.name,
      target_url: captureConfig.target_url,
    })
    startOptionalWebGazerSampling()
    installListeners()
    renderActiveTask(host)
  }

  async function startWebGazerSetup(host) {
    if (setupStarted || !captureConfig) {
      return
    }
    setupStarted = true
    try {
      await createCaptureSessionIfNeeded()
      enqueue('page_view', basePayload('Real-site page viewed'))
      enqueue('quality', {
        ...basePayload('Real-site browser gaze setup started'),
        setup_phase: 'consent_complete',
        setup_method: 'webgazer_enabled_real_site_capture',
        calibration_passes: calibrationPasses,
        sample_interval_ms: GAZE_SAMPLE_INTERVAL_MS,
        gaze_sample_cap: MAX_SESSION_GAZE_EVENTS,
      })
      renderReadiness(host)
      await loadAndConfigureWebGazer()
      await startCameraReadiness(host)
    } catch (error) {
      enqueue('quality', {
        ...basePayload('Browser gaze setup unavailable'),
        setup_phase: 'setup_error',
        quality_warning: error && error.message ? error.message : String(error),
      })
      renderSetupError(host, error)
    }
  }

  function loadWebGazerScript() {
    if (window.webgazer) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = webgazerScriptUrl
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('WebGazer script could not be loaded.'))
      document.head.appendChild(script)
    })
  }

  async function loadAndConfigureWebGazer() {
    await loadWebGazerScript()
    const webgazer = window.webgazer
    if (!webgazer) {
      throw new Error('WebGazer was not available after loading the setup script.')
    }
    if (typeof webgazer.saveDataAcrossSessions === 'function') webgazer.saveDataAcrossSessions(false)
    if (typeof webgazer.showVideoPreview === 'function') webgazer.showVideoPreview(false)
    if (typeof webgazer.showPredictionPoints === 'function') webgazer.showPredictionPoints(false)
    if (typeof webgazer.setGazeListener === 'function') {
      webgazer.setGazeListener((prediction) => {
        latestPrediction = prediction || null
        maybeRecordGazeSample(prediction)
      })
    }
    if (typeof webgazer.begin === 'function') {
      await Promise.resolve(webgazer.begin())
    }
  }

  function renderReadiness(host, status) {
    host.style.cssText = overlayShell('auto', false)
    host.innerHTML = panelHtml([
      '<strong style="display:block;margin-bottom:8px;font-size:18px">Camera setup</strong>',
      '<p style="margin:0 0 12px;color:#374151">Keep your face centered in the guide until setup is ready. This preview is local-only.</p>',
      '<div style="position:relative;overflow:hidden;background:#111827;border-radius:8px;aspect-ratio:4/3;margin-bottom:12px">',
      '<video data-gazetrack-preview autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>',
      '<div style="position:absolute;inset:14%;border:2px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 0 999px rgba(17,24,39,.18)"></div>',
      '</div>',
      `<p data-gazetrack-readiness-status style="margin:0;color:#4b5563;font-size:13px">${escapeHtml(status || 'Requesting camera access and checking local readiness...')}</p>`,
    ].join(''), '520px')
  }

  async function startCameraReadiness(host) {
    if (!requireCameraReadiness) {
      enqueue('quality', {
        ...basePayload('Camera readiness skipped'),
        setup_phase: 'camera_readiness',
        readiness_method: 'disabled_by_config',
        quality_warning: 'Camera readiness gate was disabled by configuration; WebGazer setup continued without local readiness hold.',
      })
      renderCalibration(host)
      return
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      enqueue('quality', {
        ...basePayload('Camera readiness fallback unavailable'),
        setup_phase: 'camera_readiness',
        readiness_method: 'stream_dimensions_fallback',
        quality_warning: 'Browser camera APIs were unavailable; calibration continued without local preview readiness.',
      })
      renderCalibration(host)
      return
    }

    const preview = host.querySelector('[data-gazetrack-preview]')
    const status = host.querySelector('[data-gazetrack-readiness-status]')
    try {
      previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      preview.srcObject = previewStream
      await preview.play()
    } catch (error) {
      enqueue('quality', {
        ...basePayload('Camera readiness permission issue'),
        setup_phase: 'camera_readiness',
        readiness_method: 'stream_dimensions_fallback',
        quality_warning: 'Camera preview could not start; calibration continued with WebGazer only.',
      })
      renderCalibration(host)
      return
    }

    enqueue('quality', {
      ...basePayload('Camera readiness fallback active'),
      setup_phase: 'camera_readiness',
      readiness_method: 'stream_dimensions_fallback',
      quality_warning: 'Real-site embed uses lightweight local readiness: active camera stream, visible dimensions, and stable hold timer. It does not inspect or transmit detailed face geometry.',
    })

    readinessStartedAt = 0
    readinessTimer = window.setInterval(() => {
      const streamActive = previewStream && previewStream.getTracks().some((track) => track.readyState === 'live')
      const dimensionsReady = preview.videoWidth > 0 && preview.videoHeight > 0
      if (streamActive && dimensionsReady) {
        if (!readinessStartedAt) readinessStartedAt = Date.now()
        const heldMs = Date.now() - readinessStartedAt
        if (status) status.textContent = `Camera ready. Hold steady ${Math.ceil(Math.max(0, READINESS_HOLD_MS - heldMs) / 1000)}s.`
        if (heldMs >= READINESS_HOLD_MS) {
          clearInterval(readinessTimer)
          readinessTimer = null
          enqueue('quality', {
            ...basePayload('Camera readiness complete'),
            setup_phase: 'camera_readiness_complete',
            readiness_method: 'stream_dimensions_fallback',
            readiness_hold_ms: heldMs,
            camera_readiness_score: 70,
            quality_warning: 'Readiness score is limited because the standalone embed does not use MediaPipe face analysis.',
          })
          renderCalibration(host)
        }
      } else {
        readinessStartedAt = 0
        if (status) status.textContent = 'Waiting for an active local camera preview.'
      }
    }, 150)
  }

  function renderCalibration(host) {
    calibrationStartedAt = Date.now()
    const total = calibrationTargets.length * calibrationPasses
    host.style.cssText = overlayShell('auto', false)
    host.innerHTML = [
      '<div style="position:fixed;inset:0;background:rgba(255,255,255,.96);z-index:2147483647">',
      '<div style="position:absolute;left:20px;top:16px;right:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#111827">',
      '<strong>Calibration</strong>',
      `<span data-gazetrack-calibration-progress style="color:#4b5563;font-size:13px">Point 1 of ${total}</span>`,
      '</div>',
      '<p style="position:absolute;left:20px;bottom:16px;margin:0;color:#4b5563;font-size:13px">Look at each target, then click it.</p>',
      '<button type="button" data-gazetrack-calibration-target aria-label="Calibration target" style="position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:999px;border:3px solid #111827;background:#14b8a6;box-shadow:0 0 0 8px rgba(20,184,166,.18);cursor:pointer"></button>',
      '</div>',
    ].join('')
    const targetButton = host.querySelector('[data-gazetrack-calibration-target]')
    const progress = host.querySelector('[data-gazetrack-calibration-progress]')
    let index = 0
    function placeTarget() {
      const target = calibrationTargets[index % calibrationTargets.length]
      targetButton.style.left = `${Math.round(target.x * window.innerWidth)}px`
      targetButton.style.top = `${Math.round(target.y * window.innerHeight)}px`
      progress.textContent = `Point ${index + 1} of ${total}`
    }
    targetButton.addEventListener('click', () => {
      const target = calibrationTargets[index % calibrationTargets.length]
      const x = Math.round(target.x * window.innerWidth)
      const y = Math.round(target.y * window.innerHeight)
      if (window.webgazer && typeof window.webgazer.recordScreenPosition === 'function') {
        window.webgazer.recordScreenPosition(x, y, 'click')
      }
      const observed = latestPrediction && Number.isFinite(latestPrediction.x) && Number.isFinite(latestPrediction.y)
        ? { x: roundCoordinate(latestPrediction.x / Math.max(window.innerWidth, 1)), y: roundCoordinate(latestPrediction.y / Math.max(window.innerHeight, 1)) }
        : null
      const errorNormalized = observed ? Math.hypot(observed.x - target.x, observed.y - target.y) : null
      enqueue('calibration', {
        ...basePayload('calibration_point'),
        mode: 'calibration_point',
        target_point: { x: target.x, y: target.y },
        observed_point: observed,
        calibration_step: index + 1,
        calibration_point_count: total,
        calibration_passes: calibrationPasses,
        error_normalized: errorNormalized === null ? null : roundMetric(errorNormalized),
        error_px: errorNormalized === null ? null : roundMetric(errorNormalized * Math.max(window.innerWidth, window.innerHeight)),
      })
      index += 1
      if (index >= total) {
        enqueue('calibration', {
          ...basePayload('calibration_complete'),
          mode: 'calibration_complete',
          calibration_points_completed: total,
          calibration_point_count: total,
          calibration_passes: calibrationPasses,
          calibration_duration_ms: Date.now() - calibrationStartedAt,
          calibration_quality: 'usable',
          calibration_recommendation: 'Proceed with approximate gaze analytics and review quality metadata in the report.',
        })
        startActiveTask(host)
        return
      }
      placeTarget()
    })
    placeTarget()
  }

  function startActiveTask(host) {
    if (started) {
      return
    }
    started = true
    enqueue('task_start', {
      ...basePayload('Real-site task started'),
      target: captureConfig.task_prompt,
      task_prompt: captureConfig.task_prompt,
      study_name: captureConfig.name,
      target_url: captureConfig.target_url,
      setup_method: 'webgazer_enabled_real_site_capture',
    })
    installListeners()
    renderActiveTask(host)
  }

  function renderActiveTask(host) {
    host.style.cssText = overlayShell('min(360px,calc(100vw - 32px))', true)
    if (!enableWebGazer) {
      host.innerHTML = [
        '<strong style="display:block;margin-bottom:6px">Task running</strong>',
        `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
        '<button type="button" data-gazetrack-finish style="width:100%;border:0;background:#111827;color:#fff;border-radius:6px;padding:9px 10px">Finish task</button>',
      ].join('')
      host.querySelector('[data-gazetrack-finish]').addEventListener('click', () => finishCapture(host))
      return
    }
    host.innerHTML = [
      '<strong style="display:block;margin-bottom:6px">Task running</strong>',
      `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
      '<p style="margin:0 0 12px;color:#4b5563;font-size:12px">Approximate gaze telemetry is active. No raw media is sent.</p>',
      `<button type="button" data-gazetrack-finish style="width:100%;${buttonStyle(true)}">Finish task</button>`,
    ].join('')
    host.querySelector('[data-gazetrack-finish]').addEventListener('click', () => finishCapture(host))
  }

  function renderSetupError(host, error) {
    host.style.cssText = overlayShell('auto', false)
    host.innerHTML = panelHtml([
      '<strong style="display:block;margin-bottom:8px;font-size:18px">Setup unavailable</strong>',
      `<p style="margin:0 0 12px;color:#374151">${escapeHtml(error && error.message ? error.message : String(error))}</p>`,
      '<p style="margin:0 0 16px;color:#4b5563;font-size:12px">You can continue with interaction-only task telemetry.</p>',
      '<div style="display:flex;justify-content:flex-end">',
      `<button type="button" data-gazetrack-start style="${buttonStyle(true)}">Start task</button>`,
      '</div>',
    ].join(''))
    host.querySelector('[data-gazetrack-start]').addEventListener('click', () => startCapture(host))
  }

  function installListeners() {
    document.addEventListener('click', handleClick, true)
    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  function removeListeners() {
    document.removeEventListener('click', handleClick, true)
    window.removeEventListener('scroll', handleScroll)
  }

  function handleClick(event) {
    if (!started || completed) {
      return
    }
    if (event.target && event.target.closest && event.target.closest('#gazetrack-capture-overlay')) {
      return
    }
    const point = normalizePoint(event.clientX, event.clientY)
    enqueue('click', {
      ...basePayload('Real-site click'),
      x: point.x,
      y: point.y,
    })
  }

  function handleScroll() {
    if (!started || completed || Date.now() - lastScrollEventAt < 500) {
      return
    }
    lastScrollEventAt = Date.now()
    const size = documentSize()
    const maxScroll = Math.max(size.height - window.innerHeight, 1)
    enqueue('scroll', {
      ...basePayload('Real-site scroll'),
      scroll_depth_percent: Math.round(Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100))),
    })
  }

  function maybeRecordGazeSample(prediction) {
    if (!started || completed || !prediction || Date.now() - lastGazeEventAt < GAZE_SAMPLE_INTERVAL_MS || gazeSampleCount >= MAX_SESSION_GAZE_EVENTS) {
      return
    }
    if (!Number.isFinite(prediction.x) || !Number.isFinite(prediction.y)) {
      return
    }
    lastGazeEventAt = Date.now()
    gazeSampleCount += 1
    const point = normalizeViewportPoint(prediction.x, prediction.y)
    enqueue('gaze', {
      ...basePayload('Real-site browser gaze sample'),
      tracker_type: SOURCE,
      x: point.x,
      y: point.y,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      document_width: point.document_width,
      document_height: point.document_height,
      confidence: Number.isFinite(prediction.confidence) ? roundMetric(prediction.confidence) : null,
      quality_warning: requireCameraReadiness ? null : 'Camera readiness was not required by configuration.',
    })
  }

  function startOptionalWebGazerSampling() {
    const webgazer = window.webgazer
    if (!webgazer || typeof webgazer.setGazeListener !== 'function') {
      enqueue('quality', {
        ...basePayload('Browser gaze unavailable'),
        quality_warning: 'WebGazer was not present on the page; capture used interaction telemetry only.',
      })
      return
    }
    try {
      if (typeof webgazer.showVideoPreview === 'function') webgazer.showVideoPreview(false)
      if (typeof webgazer.showPredictionPoints === 'function') webgazer.showPredictionPoints(false)
      if (typeof webgazer.saveDataAcrossSessions === 'function') webgazer.saveDataAcrossSessions(false)
      webgazer.setGazeListener((prediction) => {
        latestPrediction = prediction || null
        maybeRecordGazeSample(prediction)
      })
      if (typeof webgazer.begin === 'function') Promise.resolve(webgazer.begin()).catch(function () {})
    } catch (error) {
      enqueue('quality', {
        ...basePayload('Browser gaze unavailable'),
        quality_warning: 'WebGazer could not start; capture used interaction telemetry only.',
      })
    }
  }

  async function finishCapture(host) {
    if (completed || !sessionId) {
      return
    }
    completed = true
    removeListeners()
    if (readinessTimer) {
      clearInterval(readinessTimer)
      readinessTimer = null
    }
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop())
      previewStream = null
    }
    enqueue('task_complete', {
      ...basePayload('Real-site task completed'),
      completed: true,
      confidence: latestPrediction && Number.isFinite(latestPrediction.confidence) ? latestPrediction.confidence : null,
    })
    await postJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
      capture_token: captureToken,
      events: eventQueue,
    })
    await postJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/complete`, {})
    host.innerHTML = '<strong style="display:block">GazeTrack task complete</strong><p style="margin:6px 0 0;color:#374151">Telemetry was submitted without raw media.</p>'
  }

  fetchConfig()
    .then(renderOverlay)
    .catch(function (error) {
      window.__GazeTrackCaptureError = error && error.message ? error.message : String(error)
      console.warn('[GazeTrack] Capture unavailable:', error)
    })
})()
