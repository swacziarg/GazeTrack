(function () {
  const SOURCE = 'real_site_capture'
  const DEFAULT_WEBGAZER_SCRIPT_URL = 'https://webgazer.cs.brown.edu/webgazer.js'
  const MIN_AOI_SIZE = 0.0001
  const GAZE_SAMPLE_INTERVAL_MS = 250
  const MAX_SESSION_GAZE_EVENTS = 240
  const config = window.GazeTrackConfig || {}
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/$/, '')
  const studyId = String(config.studyId || '')
  const captureToken = String(config.captureToken || '')
  const enableWebGazer = config.enableWebGazer === true
  const webgazerScriptUrl = String(config.webgazerScriptUrl || DEFAULT_WEBGAZER_SCRIPT_URL)
  const webgazerFaceMeshSolutionPath = String(config.webgazerFaceMeshSolutionPath || `${apiBaseUrl}/webgazer-mediapipe/face_mesh`)
  const calibrationPasses = Math.max(1, Math.min(5, Number(config.calibrationPasses || 1) || 1))
  const requireCameraReadiness = config.requireCameraReadiness !== false
  const reportViewMode = (() => {
    try {
      return window.self !== window.top && new URLSearchParams(window.location.search).get('gazetrack_report_view') === '1'
    } catch (error) {
      return false
    }
  })()

  if (reportViewMode) {
    function reportScrollTo(scrollX, scrollY) {
      const nextX = Math.max(0, Number(scrollX || 0))
      const nextY = Math.max(0, Number(scrollY || 0))
      window.scrollTo(nextX, nextY)
      window.setTimeout(() => window.scrollTo(nextX, nextY), 50)
      window.setTimeout(() => window.scrollTo(nextX, nextY), 150)
      try {
        window.parent.postMessage(
          {
            source: 'gazetrack_report_frame',
            type: 'scroll_applied',
            page_url: window.location.href,
            scroll_x: Math.round(window.scrollX),
            scroll_y: Math.round(window.scrollY),
            requested_scroll_x: Math.round(nextX),
            requested_scroll_y: Math.round(nextY),
          },
          '*',
        )
      } catch (error) {}
    }

    window.addEventListener('message', (event) => {
      const data = event.data || {}
      if (!data || data.source !== 'gazetrack_report' || data.type !== 'scroll_to') {
        return
      }
      reportScrollTo(data.scroll_x, data.scroll_y)
    })
    window.__GazeTrackReportViewMode = true
    try {
      window.parent.postMessage(
        {
          source: 'gazetrack_report_frame',
          type: 'ready',
          page_url: window.location.href,
          scroll_x: Math.round(window.scrollX),
          scroll_y: Math.round(window.scrollY),
        },
        '*',
      )
    } catch (error) {}
    return
  }

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
  let gazeDot = null
  let eyeTrackingDisabled = false
  let routeListenersInstalled = false
  let originalPushState = null
  let originalReplaceState = null
  let originalGetUserMedia = null
  let mediaTrackerInstalled = false
  const capturedMediaStreams = new Set()
  let lastCapturedUrl = window.location.href
  let routeSnapshotTimer = null

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

  function rectToDocumentBox(rect, size) {
    const x = roundRectStart((rect.left + window.scrollX) / size.width)
    const y = roundRectStart((rect.top + window.scrollY) / size.height)
    return {
      x,
      y,
      width: roundRectSize(x, rect.width / size.width),
      height: roundRectSize(y, rect.height / size.height),
    }
  }

  function visibleElementBox(element, size) {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return null
    }
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }
    return rectToDocumentBox(rect, size)
  }

  function safeElementText(element) {
    const tag = element.tagName.toLowerCase()
    const aria = element.getAttribute('aria-label')
    if (aria && aria.trim()) return aria.trim().slice(0, 140)
    if (tag === 'input' || tag === 'textarea') {
      return (element.getAttribute('placeholder') || element.getAttribute('value') || tag).trim().slice(0, 140)
    }
    const textTags = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'label', 'li', 'summary', 'figcaption'])
    const text = String(element.textContent || '').replace(/\s+/g, ' ').trim()
    if (textTags.has(tag) && text) return text.slice(0, 140)
    return tag
  }

  function elementVisualStyle(element) {
    const style = window.getComputedStyle(element)
    return {
      background_color: style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : '',
      text_color: style.color || '',
      border_color: style.borderTopColor || '',
      font_size: style.fontSize || '',
      font_weight: style.fontWeight || '',
    }
  }

  function semanticLandmarks(size) {
    const selectors = [
      'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
      'h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'label', 'li',
      'input', 'textarea', 'select', '[role="banner"]', '[role="navigation"]',
      '[role="main"]', '[role="contentinfo"]', '[role="button"]', '[data-gazetrack-aoi]',
    ]
    const seen = new Set()
    return selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)).slice(0, 32))
      .filter((element) => {
        if (element.closest && element.closest('#gazetrack-capture-overlay')) return false
        if (seen.has(element)) return false
        seen.add(element)
        return true
      })
      .map((element, index) => {
        const box = visibleElementBox(element, size)
        if (!box) return null
        const role = element.getAttribute('role')
        const tag = element.tagName.toLowerCase()
        const semanticType = role || element.getAttribute('data-gazetrack-aoi') || tag
        return {
          id: `landmark-${index + 1}`,
          label: safeElementText(element),
          semantic_type: semanticType,
          tag,
          text: safeElementText(element),
          ...elementVisualStyle(element),
          ...box,
        }
      })
      .filter(Boolean)
      .slice(0, 72)
  }

  function layoutSnapshot() {
    const size = documentSize()
    const aoiLandmarks = captureConfig
      ? captureConfig.aois
          .map(resolveAoi)
          .filter((aoi) => aoi.detected)
          .map((aoi) => ({
            id: String(aoi.source_aoi_id || aoi.role_key || aoi.label),
            label: aoi.label,
            semantic_type: aoi.semantic_type || aoi.role_key || 'aoi',
            x: aoi.x,
            y: aoi.y,
            width: aoi.width,
            height: aoi.height,
            is_aoi: true,
            tag: 'aoi',
            text: aoi.label,
            background_color: '',
            text_color: '',
            border_color: '',
            font_size: '',
            font_weight: '',
          }))
      : []
    return {
      snapshot_type: 'safe_dom_layout_v1',
      page_url: window.location.href,
      page_path: window.location.pathname,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      document_width: size.width,
      document_height: size.height,
      scroll_x: window.scrollX,
      scroll_y: window.scrollY,
      coordinate_space: 'document_normalized',
      landmarks: [...aoiLandmarks, ...semanticLandmarks(size)].slice(0, 96),
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
    const params = new URLSearchParams({
      study_id: studyId,
      capture_token: captureToken,
    })
    const response = await fetch(`${apiBaseUrl}/api/v1/capture/config?${params.toString()}`, {
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

  function stopButtonHtml() {
    return `<button type="button" data-gazetrack-stop style="border:1px solid #b91c1c;background:#fff;color:#991b1b;border-radius:6px;padding:8px 10px;cursor:pointer;font-weight:600">Turn off eye tracking/camera</button>`
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

  function bindStopButton(host) {
    const button = host.querySelector('[data-gazetrack-stop]')
    if (button) {
      button.addEventListener('click', () => {
        disableEyeTracking(host).catch(function (error) {
          console.warn('[GazeTrack] Eye tracking shutdown warning:', error)
        })
      })
    }
  }

  function createGazeDotIfNeeded() {
    if (gazeDot || !enableWebGazer) {
      return
    }
    gazeDot = document.createElement('div')
    gazeDot.id = 'gazetrack-gaze-dot'
    gazeDot.setAttribute('aria-hidden', 'true')
    gazeDot.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:14px',
      'height:14px',
      'margin:-7px 0 0 -7px',
      'border-radius:999px',
      'background:#ef4444',
      'border:2px solid #fff',
      'box-shadow:0 0 0 8px rgba(239,68,68,.20),0 0 22px rgba(239,68,68,.75)',
      'pointer-events:none',
      'z-index:2147483646',
      'opacity:0',
      'transform:translate3d(-100px,-100px,0)',
      'transition:opacity .12s ease',
    ].join(';')
    document.body.appendChild(gazeDot)
  }

  function updateGazeDot(prediction) {
    if (eyeTrackingDisabled || !prediction || !Number.isFinite(prediction.x) || !Number.isFinite(prediction.y) || completed) {
      return
    }
    createGazeDotIfNeeded()
    if (!gazeDot) {
      return
    }
    const x = Math.max(0, Math.min(window.innerWidth, prediction.x))
    const y = Math.max(0, Math.min(window.innerHeight, prediction.y))
    gazeDot.style.opacity = '1'
    gazeDot.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
  }

  function removeGazeDot() {
    if (gazeDot) {
      gazeDot.remove()
      gazeDot = null
    }
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
    const session = await postJson('/api/v1/capture/sessions', {
      study_id: studyId,
      capture_token: captureToken,
      page_url: window.location.href,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      document_width: size.width,
      document_height: size.height,
    })
    sessionId = session.session_id

    await postAoiSnapshots()
  }

  async function postAoiSnapshots() {
    if (!sessionId || !captureConfig) {
      return
    }
    const snapshots = captureConfig.aois.map(resolveAoi)
    await postJson(`/api/v1/capture/sessions/${encodeURIComponent(sessionId)}/aoi-snapshots`, {
      capture_token: captureToken,
      snapshots,
    })
  }

  function scheduleRouteSnapshot() {
    if (routeSnapshotTimer) {
      clearTimeout(routeSnapshotTimer)
    }
    routeSnapshotTimer = window.setTimeout(() => {
      routeSnapshotTimer = null
      Promise.all([postAoiSnapshots(), flushEvents()]).catch(function (error) {
        enqueue('quality', {
          ...basePayload('Route AOI snapshot failed'),
          setup_phase: 'route_snapshot_error',
          quality_warning: error && error.message ? error.message : String(error),
        })
      })
    }, 350)
  }

  function handleRouteChange() {
    if (!started || completed || !captureConfig) {
      lastCapturedUrl = window.location.href
      return
    }
    const previousUrl = lastCapturedUrl
    const nextUrl = window.location.href
    if (previousUrl === nextUrl) {
      return
    }
    const previousPath = (() => {
      try {
        return new URL(previousUrl).pathname
      } catch (error) {
        return ''
      }
    })()
    lastCapturedUrl = nextUrl
    lastScrollEventAt = 0
    enqueue('page_view', {
      ...basePayload('Real-site route viewed'),
      route_change: true,
      previous_page_url: previousUrl,
      previous_page_path: previousPath,
      layout_snapshot: layoutSnapshot(),
    })
    scheduleRouteSnapshot()
  }

  function installRouteListeners() {
    if (routeListenersInstalled) {
      return
    }
    routeListenersInstalled = true
    originalPushState = history.pushState
    originalReplaceState = history.replaceState
    history.pushState = function () {
      const result = originalPushState.apply(this, arguments)
      window.setTimeout(handleRouteChange, 0)
      return result
    }
    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments)
      window.setTimeout(handleRouteChange, 0)
      return result
    }
    window.addEventListener('popstate', handleRouteChange)
  }

  function removeRouteListeners() {
    if (!routeListenersInstalled) {
      return
    }
    if (originalPushState) history.pushState = originalPushState
    if (originalReplaceState) history.replaceState = originalReplaceState
    window.removeEventListener('popstate', handleRouteChange)
    routeListenersInstalled = false
    originalPushState = null
    originalReplaceState = null
    if (routeSnapshotTimer) {
      clearTimeout(routeSnapshotTimer)
      routeSnapshotTimer = null
    }
  }

  async function startCapture(host) {
    if (started || !captureConfig) {
      return
    }
    started = true
    await createCaptureSessionIfNeeded()
    lastCapturedUrl = window.location.href

    enqueue('page_view', {
      ...basePayload('Real-site page viewed'),
      layout_snapshot: layoutSnapshot(),
    })
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
      installMediaCaptureTracker()
      await createCaptureSessionIfNeeded()
      enqueue('page_view', {
        ...basePayload('Real-site page viewed'),
        layout_snapshot: layoutSnapshot(),
      })
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
    installMediaCaptureTracker()
    await loadWebGazerScript()
    const webgazer = window.webgazer
    if (!webgazer) {
      throw new Error('WebGazer was not available after loading the setup script.')
    }
    if (webgazer.params) {
      webgazer.params.faceMeshSolutionPath = webgazerFaceMeshSolutionPath
    }
    if (typeof webgazer.saveDataAcrossSessions === 'function') webgazer.saveDataAcrossSessions(false)
    if (typeof webgazer.showVideoPreview === 'function') webgazer.showVideoPreview(false)
    if (typeof webgazer.showPredictionPoints === 'function') webgazer.showPredictionPoints(false)
    if (typeof webgazer.setGazeListener === 'function') {
      webgazer.setGazeListener((prediction) => {
        latestPrediction = prediction || null
        updateGazeDot(prediction)
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
      '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">',
      stopButtonHtml(),
      '</div>',
      '<strong style="display:block;margin-bottom:8px;font-size:18px">Camera setup</strong>',
      '<p style="margin:0 0 12px;color:#374151">Move your face into the center of the guide. This preview is local-only.</p>',
      '<div style="position:relative;overflow:hidden;background:#111827;border-radius:8px;aspect-ratio:4/3;margin-bottom:12px">',
      '<video data-gazetrack-preview autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>',
      '<div style="position:absolute;left:50%;top:50%;width:34%;height:68%;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.85);border-radius:50% / 46%;box-shadow:0 0 0 999px rgba(17,24,39,.18)"></div>',
      '</div>',
      `<p data-gazetrack-readiness-status style="margin:0 0 12px;color:#4b5563;font-size:13px">${escapeHtml(status || 'Requesting camera access and checking local readiness...')}</p>`,
      '<div style="display:flex;justify-content:flex-end">',
      `<button type="button" data-gazetrack-readiness-continue disabled style="${buttonStyle(true)};opacity:.5;cursor:not-allowed">Continue to calibration</button>`,
      '</div>',
    ].join(''), '520px')
    bindStopButton(host)
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') {
      return
    }
    stream.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch (error) {}
    })
  }

  function installMediaCaptureTracker() {
    if (mediaTrackerInstalled || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return
    }
    mediaTrackerInstalled = true
    originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = function () {
      return originalGetUserMedia.apply(navigator.mediaDevices, arguments).then((stream) => {
        capturedMediaStreams.add(stream)
        return stream
      })
    }
  }

  function restoreMediaCaptureTracker() {
    if (!mediaTrackerInstalled || !originalGetUserMedia || !navigator.mediaDevices) {
      return
    }
    navigator.mediaDevices.getUserMedia = originalGetUserMedia
    originalGetUserMedia = null
    mediaTrackerInstalled = false
  }

  function stopPreviewStream() {
    stopMediaStream(previewStream)
    previewStream = null
  }

  function stopPageVideoStreams() {
    const videos = Array.from(document.querySelectorAll('video'))
    const webgazer = window.webgazer
    const candidateVideos = new Set(videos.filter((video) => {
      const idClass = `${video.id || ''} ${video.className || ''}`.toLowerCase()
      return (
        video.hasAttribute('data-gazetrack-preview') ||
        idClass.includes('webgazer') ||
        idClass.includes('gazetrack') ||
        (video.srcObject && typeof video.srcObject.getTracks === 'function')
      )
    }))
    try {
      if (webgazer && typeof webgazer.getVideoElement === 'function') {
        const video = webgazer.getVideoElement()
        if (video) candidateVideos.add(video)
      }
    } catch (error) {}
    for (const video of candidateVideos) {
      stopMediaStream(video.srcObject)
      try {
        video.pause()
        video.srcObject = null
      } catch (error) {}
    }
  }

  async function stopWebGazerRuntime() {
    const webgazer = window.webgazer
    if (!webgazer) {
      return
    }
    try {
      if (typeof webgazer.clearGazeListener === 'function') webgazer.clearGazeListener()
      if (typeof webgazer.pause === 'function') await Promise.resolve(webgazer.pause())
      if (typeof webgazer.end === 'function') await Promise.resolve(webgazer.end())
      if (typeof webgazer.showVideoPreview === 'function') webgazer.showVideoPreview(false)
      if (typeof webgazer.showPredictionPoints === 'function') webgazer.showPredictionPoints(false)
    } catch (error) {
      enqueue('quality', {
        ...basePayload('Browser gaze shutdown warning'),
        setup_phase: 'shutdown_warning',
        quality_warning: error && error.message ? error.message : String(error),
      })
    }
  }

  async function stopCaptureDevices() {
    if (readinessTimer) {
      clearInterval(readinessTimer)
      readinessTimer = null
    }
    stopPreviewStream()
    capturedMediaStreams.forEach(stopMediaStream)
    capturedMediaStreams.clear()
    await stopWebGazerRuntime()
    stopPageVideoStreams()
    restoreMediaCaptureTracker()
    removeGazeDot()
  }

  async function disableEyeTracking(host) {
    if (eyeTrackingDisabled) {
      return
    }
    eyeTrackingDisabled = true
    await stopCaptureDevices()
    latestPrediction = null
    enqueue('quality', {
      ...basePayload('Eye tracking stopped by participant'),
      setup_phase: started ? 'participant_disabled_eye_tracking' : 'participant_stopped_setup',
      tracking_quality: 'low',
      quality_warning: started
        ? 'Participant turned off eye tracking/camera. Task telemetry continued with interaction-only events.'
        : 'Participant turned off eye tracking/camera during setup.',
    })
    if (started && !completed) {
      renderActiveTask(host)
      return
    }
    renderSetupError(host, new Error('Eye tracking was turned off.'))
  }

  async function startCameraReadiness(host) {
    if (!requireCameraReadiness) {
      enqueue('quality', {
        ...basePayload('Camera readiness skipped'),
        setup_phase: 'camera_readiness',
        readiness_method: 'disabled_by_config',
        quality_warning: 'Camera readiness gate was disabled by configuration; WebGazer setup continued without local readiness hold.',
      })
      renderCalibrationTutorial(host)
      return
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      enqueue('quality', {
        ...basePayload('Camera readiness fallback unavailable'),
        setup_phase: 'camera_readiness',
        readiness_method: 'stream_dimensions_fallback',
        quality_warning: 'Browser camera APIs were unavailable; calibration continued without local preview readiness.',
      })
      renderCalibrationTutorial(host)
      return
    }

    const preview = host.querySelector('[data-gazetrack-preview]')
    const status = host.querySelector('[data-gazetrack-readiness-status]')
    const continueButton = host.querySelector('[data-gazetrack-readiness-continue]')
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
      renderCalibrationTutorial(host)
      return
    }

    enqueue('quality', {
      ...basePayload('Camera readiness fallback active'),
      setup_phase: 'camera_readiness',
      readiness_method: 'stream_dimensions_fallback',
      quality_warning: 'Real-site embed uses lightweight local readiness: active camera stream, visible dimensions, and stable hold timer. It does not inspect or transmit detailed face geometry.',
    })

    readinessStartedAt = 0
    let readyForUser = false
    continueButton.addEventListener('click', () => {
      if (!readyForUser) {
        return
      }
      const heldMs = readinessStartedAt ? Date.now() - readinessStartedAt : 0
      if (readinessTimer) {
        clearInterval(readinessTimer)
        readinessTimer = null
      }
      enqueue('quality', {
        ...basePayload('Camera readiness confirmed'),
        setup_phase: 'camera_readiness_complete',
        readiness_method: 'user_confirmed_stream_preview',
        readiness_hold_ms: heldMs,
        camera_readiness_score: 70,
        quality_warning: 'Readiness is user-confirmed from a local preview; the standalone embed does not transmit or score face geometry.',
      })
      stopPreviewStream()
      renderCalibrationTutorial(host)
    })
    readinessTimer = window.setInterval(() => {
      const streamActive = previewStream && previewStream.getTracks().some((track) => track.readyState === 'live')
      const dimensionsReady = preview.videoWidth > 0 && preview.videoHeight > 0
      if (streamActive && dimensionsReady) {
        if (!readinessStartedAt) readinessStartedAt = Date.now()
        readyForUser = true
        if (status) status.textContent = 'Camera preview is active. Center your face in the guide, then continue when you are ready.'
        if (continueButton) {
          continueButton.disabled = false
          continueButton.style.opacity = '1'
          continueButton.style.cursor = 'pointer'
        }
      } else {
        readinessStartedAt = 0
        readyForUser = false
        if (status) status.textContent = 'Waiting for an active local camera preview.'
        if (continueButton) {
          continueButton.disabled = true
          continueButton.style.opacity = '.5'
          continueButton.style.cursor = 'not-allowed'
        }
      }
    }, 150)
  }

  function renderCalibrationTutorial(host) {
    const total = calibrationTargets.length * calibrationPasses
    host.style.cssText = overlayShell('auto', false)
    host.innerHTML = [
      '<div style="position:fixed;inset:0;background:rgba(255,255,255,.96);z-index:2147483647">',
      '<div style="position:absolute;right:20px;top:16px">',
      stopButtonHtml(),
      '</div>',
      '<div style="position:absolute;left:50%;top:80px;transform:translateX(-50%);width:min(460px,calc(100vw - 40px));background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:18px 20px;box-shadow:0 16px 48px rgba(17,24,39,.16);color:#111827">',
      '<strong style="display:block;margin-bottom:6px">Calibrate browser gaze</strong>',
      '<p style="margin:0 0 8px;color:#374151">Keep your head still. Look directly at the teal target, then click it. Repeat until all targets are complete.</p>',
      `<p style="margin:0 0 14px;color:#6b7280;font-size:12px">You will click ${total} calibration target${total === 1 ? '' : 's'}. This improves approximate page attention metrics. Webcam processing stays local and no raw video is sent.</p>`,
      '<div style="display:flex;justify-content:flex-end">',
      `<button type="button" data-gazetrack-start-calibration style="${buttonStyle(true)}">Start calibration</button>`,
      '</div>',
      '</div>',
      '</div>',
    ].join('')
    host.querySelector('[data-gazetrack-start-calibration]').addEventListener('click', () => renderCalibrationTargets(host))
    bindStopButton(host)
  }

  function renderCalibrationTargets(host) {
    calibrationStartedAt = Date.now()
    const total = calibrationTargets.length * calibrationPasses
    host.style.cssText = overlayShell('auto', false)
    host.innerHTML = [
      '<div style="position:fixed;inset:0;background:rgba(255,255,255,.96);z-index:2147483647">',
      '<div style="position:absolute;left:20px;top:16px;right:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#111827">',
      '<strong>Calibration</strong>',
      `<span data-gazetrack-calibration-progress style="color:#4b5563;font-size:13px">Point 1 of ${total}</span>`,
      stopButtonHtml(),
      '</div>',
      '<button type="button" data-gazetrack-calibration-target aria-label="Calibration target" style="position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:999px;border:3px solid #111827;background:#14b8a6;box-shadow:0 0 0 8px rgba(20,184,166,.18);cursor:pointer"></button>',
      '</div>',
    ].join('')
    const targetButton = host.querySelector('[data-gazetrack-calibration-target]')
    const progress = host.querySelector('[data-gazetrack-calibration-progress]')
    bindStopButton(host)
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
    lastCapturedUrl = window.location.href
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
    if (!enableWebGazer || eyeTrackingDisabled) {
      host.innerHTML = [
        '<strong style="display:block;margin-bottom:6px">Task running</strong>',
        `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
        eyeTrackingDisabled ? '<p style="margin:0 0 12px;color:#4b5563;font-size:12px">Eye tracking and camera are off. Interaction-only task telemetry is still running.</p>' : '',
        '<button type="button" data-gazetrack-finish style="width:100%;border:0;background:#111827;color:#fff;border-radius:6px;padding:9px 10px">Finish task</button>',
      ].join('')
      host.querySelector('[data-gazetrack-finish]').addEventListener('click', () => finishCapture(host))
      return
    }
    host.innerHTML = [
      '<strong style="display:block;margin-bottom:6px">Task running</strong>',
      `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
      '<p style="margin:0 0 12px;color:#4b5563;font-size:12px">Approximate gaze telemetry is active. No raw media is sent.</p>',
      `<button type="button" data-gazetrack-stop style="width:100%;margin-bottom:8px;border:1px solid #b91c1c;background:#fff;color:#991b1b;border-radius:6px;padding:9px 10px;cursor:pointer;font-weight:600">Turn off eye tracking/camera</button>`,
      `<button type="button" data-gazetrack-finish style="width:100%;${buttonStyle(true)}">Finish task</button>`,
    ].join('')
    bindStopButton(host)
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
    installRouteListeners()
  }

  function removeListeners() {
    document.removeEventListener('click', handleClick, true)
    window.removeEventListener('scroll', handleScroll)
    removeRouteListeners()
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
      viewport_x: roundCoordinate(event.clientX / Math.max(window.innerWidth, 1)),
      viewport_y: roundCoordinate(event.clientY / Math.max(window.innerHeight, 1)),
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
    if (eyeTrackingDisabled || !started || completed || !prediction || Date.now() - lastGazeEventAt < GAZE_SAMPLE_INTERVAL_MS || gazeSampleCount >= MAX_SESSION_GAZE_EVENTS) {
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
      viewport_x: point.viewport_x,
      viewport_y: point.viewport_y,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      document_width: point.document_width,
      document_height: point.document_height,
      confidence: Number.isFinite(prediction.confidence) ? roundMetric(prediction.confidence) : null,
      quality_warning: requireCameraReadiness ? null : 'Camera readiness was not required by configuration.',
    })
  }

  function startOptionalWebGazerSampling() {
    if (eyeTrackingDisabled) {
      return
    }
    installMediaCaptureTracker()
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
      if (webgazer.params) {
        webgazer.params.faceMeshSolutionPath = webgazerFaceMeshSolutionPath
      }
      webgazer.setGazeListener((prediction) => {
        latestPrediction = prediction || null
        updateGazeDot(prediction)
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
    await stopCaptureDevices()
    enqueue('task_complete', {
      ...basePayload('Real-site task completed'),
      completed: true,
      stopped_early: false,
      eye_tracking_disabled: eyeTrackingDisabled,
      confidence: latestPrediction && Number.isFinite(latestPrediction.confidence) ? latestPrediction.confidence : null,
    })
    await flushEvents()
    await postJson(`/api/v1/capture/sessions/${encodeURIComponent(sessionId)}/complete`, {
      capture_token: captureToken,
    })
    const reportUrl = `${apiBaseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/report-view`
    host.innerHTML = [
      '<strong style="display:block">GazeTrack task complete</strong>',
      '<p style="margin:6px 0 12px;color:#374151">Telemetry was submitted without raw media.</p>',
      `<a href="${escapeHtml(reportUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;width:100%;align-items:center;justify-content:center;text-decoration:none;${buttonStyle(true)}">View report</a>`,
    ].join('')
  }

  async function flushEvents() {
    if (!sessionId || eventQueue.length === 0) {
      return
    }
    await postJson(`/api/v1/capture/sessions/${encodeURIComponent(sessionId)}/events`, {
      capture_token: captureToken,
      events: eventQueue,
    })
    eventQueue = []
  }

  fetchConfig()
    .then(renderOverlay)
    .catch(function (error) {
      window.__GazeTrackCaptureError = error && error.message ? error.message : String(error)
      console.warn('[GazeTrack] Capture unavailable:', error)
    })
})()
