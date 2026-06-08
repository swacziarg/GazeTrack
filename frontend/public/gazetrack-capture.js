(function () {
  const SOURCE = 'real_site_capture'
  const MIN_AOI_SIZE = 0.0001
  const config = window.GazeTrackConfig || {}
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/$/, '')
  const studyId = String(config.studyId || '')
  const captureToken = String(config.captureToken || '')

  if (!apiBaseUrl || !studyId || !captureToken || window.__GazeTrackCaptureLoaded) {
    return
  }
  window.__GazeTrackCaptureLoaded = true

  let captureConfig = null
  let sessionId = null
  let started = false
  let completed = false
  let eventQueue = []
  let latestPrediction = null
  let gazeSampleCount = 0
  let lastScrollEventAt = 0
  let lastGazeEventAt = 0

  function nowIso() {
    return new Date().toISOString()
  }

  function clamp(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  }

  function roundCoordinate(value) {
    return Number(clamp(value).toFixed(4))
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

  function renderOverlay() {
    const host = document.createElement('div')
    host.id = 'gazetrack-capture-overlay'
    host.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:min(360px,calc(100vw - 32px))',
      'font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#111827',
      'background:#ffffff',
      'border:1px solid #d1d5db',
      'box-shadow:0 18px 50px rgba(17,24,39,.18)',
      'border-radius:8px',
      'padding:16px',
    ].join(';')
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  async function startCapture(host) {
    if (started || !captureConfig) {
      return
    }
    started = true
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
    host.innerHTML = [
      '<strong style="display:block;margin-bottom:6px">Task running</strong>',
      `<p style="margin:0 0 12px;color:#374151">${escapeHtml(captureConfig.task_prompt)}</p>`,
      '<button type="button" data-gazetrack-finish style="width:100%;border:0;background:#111827;color:#fff;border-radius:6px;padding:9px 10px">Finish task</button>',
    ].join('')
    host.querySelector('[data-gazetrack-finish]').addEventListener('click', () => finishCapture(host))
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
        if (!started || completed || !prediction || Date.now() - lastGazeEventAt < 250 || gazeSampleCount >= 240) {
          return
        }
        if (!Number.isFinite(prediction.x) || !Number.isFinite(prediction.y)) {
          return
        }
        lastGazeEventAt = Date.now()
        gazeSampleCount += 1
        const point = normalizePoint(prediction.x, prediction.y)
        enqueue('gaze', {
          ...basePayload('Real-site browser gaze sample'),
          tracker_type: SOURCE,
          x: point.x,
          y: point.y,
          confidence: Number.isFinite(prediction.confidence) ? Number(prediction.confidence.toFixed(3)) : null,
        })
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
