import { calibrationTargets } from './syntheticTracker'
import type {
  NormalizedPoint,
  TelemetryEvent,
  TelemetryEventPayload,
  TrackerCalibrationOptions,
  TrackerProvider,
  TrackerSessionOptions,
  TrackerStatus,
} from './types'
import {
  categorizeCalibrationQuality,
  deriveTrackingState,
  type BrowserGazeStatusSnapshot,
  type CalibrationQualityCategory,
  type CalibrationRecommendation,
} from './webgazerStatus'

export type WebGazerPrediction = {
  x: number
  y: number
  confidence?: number
}

type WebGazerApi = {
  setGazeListener(listener: (prediction: WebGazerPrediction | null, elapsedTime?: number) => void): WebGazerApi
  clearGazeListener?: () => WebGazerApi
  begin: () => Promise<void> | WebGazerApi
  pause?: () => WebGazerApi
  end?: () => WebGazerApi
  showVideoPreview?: (enabled: boolean) => WebGazerApi
  showPredictionPoints?: (enabled: boolean) => WebGazerApi
  recordScreenPosition?: (x: number, y: number, eventType?: string) => WebGazerApi
}

type WindowWithWebGazer = Window & {
  webgazer?: WebGazerApi
}

type CalibrationMeasurement = {
  target: NormalizedPoint
  prediction: WebGazerPrediction | null
  viewportWidth: number
  viewportHeight: number
}

export type CalibrationSummary = {
  completedPoints: number
  averageErrorPx: number | null
  averageErrorNormalized: number | null
  averageConfidence: number | null
  quality: CalibrationQualityCategory
  recommendation: CalibrationRecommendation
  warning: string | null
}

const DEFAULT_VIEWPORT_WIDTH = 1
const DEFAULT_VIEWPORT_HEIGHT = 1
const DEFAULT_SAMPLE_INTERVAL_MS = 150
const TRACKER_SOURCE = 'webgazer_experimental'
const DEFAULT_WEBGAZER_SCRIPT_URL = 'https://webgazer.cs.brown.edu/webgazer.js'

let webGazerScriptPromise: Promise<void> | null = null

function getBrowserWindow(): WindowWithWebGazer | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window as WindowWithWebGazer
}

function getWebGazerScriptUrl() {
  return import.meta.env.VITE_WEBGAZER_SCRIPT_URL || DEFAULT_WEBGAZER_SCRIPT_URL
}

function createTimestamp() {
  return new Date().toISOString()
}

function clampNormalized(value: number) {
  return Math.max(0, Math.min(1, value))
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(4))
}

function roundMetric(value: number) {
  return Number(value.toFixed(3))
}

function isFinitePrediction(prediction: WebGazerPrediction | null): prediction is WebGazerPrediction {
  return Boolean(
    prediction &&
      Number.isFinite(prediction.x) &&
      Number.isFinite(prediction.y),
  )
}

function normalizePrediction(
  prediction: WebGazerPrediction,
  viewportWidth: number,
  viewportHeight: number,
): NormalizedPoint {
  return {
    x: roundCoordinate(clampNormalized(prediction.x / viewportWidth)),
    y: roundCoordinate(clampNormalized(prediction.y / viewportHeight)),
  }
}

function safeConfidence(prediction: WebGazerPrediction | null) {
  return prediction && typeof prediction.confidence === 'number' && Number.isFinite(prediction.confidence)
    ? roundMetric(prediction.confidence)
    : null
}

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function isLocalDevelopmentHost(hostname: string | undefined) {
  return !hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}

function classifyWebGazerError(error: unknown) {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'NotAllowedError') {
    return {
      status: 'permission_needed' as const,
      message: 'Camera permission was denied. Allow camera access or use the synthetic demo.',
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/permission|notallowed|denied/i.test(message)) {
    return {
      status: 'permission_needed' as const,
      message: 'Camera permission was denied or unavailable. Allow camera access or use the synthetic demo.',
    }
  }

  return {
    status: 'error' as const,
    message: message || 'WebGazer failed to initialize.',
  }
}

function assertBrowserSupport(browserWindow: WindowWithWebGazer) {
  if (browserWindow.isSecureContext === false && !isLocalDevelopmentHost(browserWindow.location?.hostname)) {
    throw new Error('Browser gaze requires HTTPS or localhost so camera permission can be requested.')
  }

  if (browserWindow.navigator && 'mediaDevices' in browserWindow.navigator) {
    const mediaDevices = browserWindow.navigator.mediaDevices
    if (!mediaDevices?.getUserMedia) {
      throw new Error('This browser does not expose camera capture APIs required by WebGazer.')
    }
  }
}

function distance(first: NormalizedPoint, second: NormalizedPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

export function summarizeCalibration(measurements: CalibrationMeasurement[]): CalibrationSummary {
  const errorsPx: number[] = []
  const errorsNormalized: number[] = []
  const confidences: number[] = []

  for (const measurement of measurements) {
    if (!isFinitePrediction(measurement.prediction)) {
      continue
    }

    const targetPx = {
      x: measurement.target.x * measurement.viewportWidth,
      y: measurement.target.y * measurement.viewportHeight,
    }
    errorsPx.push(Math.hypot(measurement.prediction.x - targetPx.x, measurement.prediction.y - targetPx.y))
    errorsNormalized.push(distance(normalizePrediction(measurement.prediction, measurement.viewportWidth, measurement.viewportHeight), measurement.target))
    const confidence = safeConfidence(measurement.prediction)
    if (confidence !== null) {
      confidences.push(confidence)
    }
  }

  const averageErrorPx = average(errorsPx)
  const averageErrorNormalized = average(errorsNormalized)
  const averageConfidence = average(confidences)
  const feedback = categorizeCalibrationQuality({
    completedPoints: measurements.length,
    expectedPoints: measurements.length,
    averageErrorPx,
    averageErrorNormalized,
    averageConfidence,
  })
  return {
    completedPoints: measurements.length,
    averageErrorPx,
    averageErrorNormalized,
    averageConfidence,
    ...feedback,
  }
}

export function predictionToGazeEvent(
  prediction: WebGazerPrediction,
  options: { eventIndex: number; viewportWidth: number; viewportHeight: number },
): TelemetryEvent {
  const point = normalizePrediction(prediction, options.viewportWidth, options.viewportHeight)
  const payload: TelemetryEventPayload = {
    label: 'Browser gaze sample',
    source: TRACKER_SOURCE,
    tracker_type: TRACKER_SOURCE,
    x: point.x,
    y: point.y,
    viewport_width: options.viewportWidth,
    viewport_height: options.viewportHeight,
    confidence: safeConfidence(prediction),
  }

  return {
    id: `webgazer-event-${String(options.eventIndex).padStart(3, '0')}`,
    event_type: 'gaze_sample_recorded',
    timestamp: createTimestamp(),
    payload,
  }
}

function calibrationMeasurementToEvent(
  measurement: CalibrationMeasurement,
  options: { eventIndex: number; step: number; pointCount: number },
): TelemetryEvent {
  const observedPoint = isFinitePrediction(measurement.prediction)
    ? normalizePrediction(measurement.prediction, measurement.viewportWidth, measurement.viewportHeight)
    : undefined
  const targetPx = {
    x: measurement.target.x * measurement.viewportWidth,
    y: measurement.target.y * measurement.viewportHeight,
  }
  const errorPx = isFinitePrediction(measurement.prediction)
    ? roundMetric(Math.hypot(measurement.prediction.x - targetPx.x, measurement.prediction.y - targetPx.y))
    : undefined
  const errorNormalized = observedPoint ? roundMetric(distance(observedPoint, measurement.target)) : undefined

  return {
    id: `webgazer-event-${String(options.eventIndex).padStart(3, '0')}`,
    event_type: 'calibration_point_recorded',
    timestamp: createTimestamp(),
    payload: {
      label: `Browser calibration target ${options.step}`,
      source: TRACKER_SOURCE,
      tracker_type: TRACKER_SOURCE,
      target_point: measurement.target,
      observed_point: observedPoint,
      error_px: errorPx,
      error_normalized: errorNormalized,
      confidence: safeConfidence(measurement.prediction),
      calibration_step: options.step,
      calibration_point_count: options.pointCount,
    },
  }
}

function calibrationCompletedEvent(eventIndex: number, pointCount: number, summary: CalibrationSummary): TelemetryEvent {
  return {
    id: `webgazer-event-${String(eventIndex).padStart(3, '0')}`,
    event_type: 'calibration_completed',
    timestamp: createTimestamp(),
    payload: {
      label: 'Browser calibration completed',
      source: TRACKER_SOURCE,
      tracker_type: TRACKER_SOURCE,
      confidence: summary.averageConfidence,
      calibration_points_completed: pointCount,
      calibration_point_count: pointCount,
      calibration_error_px: summary.averageErrorPx ?? undefined,
      calibration_error_normalized: summary.averageErrorNormalized ?? undefined,
      calibration_quality: summary.quality,
      calibration_recommendation: summary.recommendation,
      quality_warning: summary.warning ?? undefined,
    },
  }
}

function loadWebGazerScript(): Promise<void> {
  const browserWindow = getBrowserWindow()
  if (!browserWindow) {
    return Promise.reject(new Error('WebGazer requires a browser window.'))
  }

  if (browserWindow.webgazer) {
    return Promise.resolve()
  }

  if (typeof document === 'undefined') {
    return Promise.reject(new Error('WebGazer script loading requires a browser document.'))
  }

  if (!webGazerScriptPromise) {
    webGazerScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = getWebGazerScriptUrl()
      script.async = true
      script.dataset.gazetrackWebgazer = 'true'
      script.onload = () => resolve()
      script.onerror = () => {
        webGazerScriptPromise = null
        reject(new Error(`Could not load WebGazer from ${script.src}`))
      }
      document.head.appendChild(script)
    })
  }

  return webGazerScriptPromise
}

function removeOverlay(overlay: HTMLElement) {
  overlay.parentElement?.removeChild(overlay)
}

function collectCalibrationMeasurements(
  targets: NormalizedPoint[],
  getLatestPrediction: () => WebGazerPrediction | null,
  recordTarget: (x: number, y: number) => void,
): Promise<CalibrationMeasurement[]> {
  const browserWindow = getBrowserWindow()
  if (!browserWindow || typeof document === 'undefined') {
    return Promise.resolve(
      targets.map((target) => ({
        target,
        prediction: getLatestPrediction(),
        viewportWidth: DEFAULT_VIEWPORT_WIDTH,
        viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
      })),
    )
  }

  const calibrationWindow = browserWindow

  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'webgazer-calibration-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-label', 'Browser gaze calibration')

    const copy = document.createElement('div')
    copy.className = 'webgazer-calibration-copy'
    const title = document.createElement('strong')
    title.textContent = 'Browser gaze calibration'
    const instructions = document.createElement('span')
    instructions.textContent = 'Look at each target, then click it. This estimates rough browser-dependent quality only.'
    copy.append(title, instructions)
    overlay.appendChild(copy)

    let index = 0
    const measurements: CalibrationMeasurement[] = []

    function renderTarget() {
      overlay.querySelector('.webgazer-calibration-target')?.remove()

      const target = targets[index]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'webgazer-calibration-target'
      button.textContent = String(index + 1)
      button.style.left = `${target.x * 100}%`
      button.style.top = `${target.y * 100}%`
      button.setAttribute('aria-label', `Calibration target ${index + 1} of ${targets.length}`)
      button.addEventListener('click', () => {
        const viewportWidth = calibrationWindow.innerWidth || DEFAULT_VIEWPORT_WIDTH
        const viewportHeight = calibrationWindow.innerHeight || DEFAULT_VIEWPORT_HEIGHT
        recordTarget(target.x * viewportWidth, target.y * viewportHeight)
        measurements.push({
          target,
          prediction: getLatestPrediction(),
          viewportWidth,
          viewportHeight,
        })
        index += 1
        if (index >= targets.length) {
          removeOverlay(overlay)
          resolve(measurements)
          return
        }
        renderTarget()
      })
      overlay.appendChild(button)
      button.focus()
    }

    document.body.appendChild(overlay)
    renderTarget()
  })
}

export class WebGazerTracker implements TrackerProvider {
  readonly id = 'webgazer'
  readonly label = 'Browser gaze experiment'
  status: TrackerStatus = 'idle'
  private events: TelemetryEvent[] = []
  private eventIndex = 1
  private webgazer: WebGazerApi | null = null
  private viewportWidth = DEFAULT_VIEWPORT_WIDTH
  private viewportHeight = DEFAULT_VIEWPORT_HEIGHT
  private latestPrediction: WebGazerPrediction | null = null
  private lastSampledAt = 0
  private sampleIntervalMs: number
  private calibrationSummary: CalibrationSummary | null = null
  private trackingStartedAt: number | null = null
  private lastValidPredictionAt: number | null = null
  private sampleCount = 0
  private validSampleCount = 0
  private missingPredictionCount = 0
  private lowConfidenceCount = 0
  private lastErrorMessage: string | null = null

  constructor(options: { sampleIntervalMs?: number } = {}) {
    this.sampleIntervalMs = options.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS
  }

  async isAvailable() {
    return Boolean(getBrowserWindow()?.webgazer)
  }

  async initialize() {
    this.status = 'loading'
    this.lastErrorMessage = null
    try {
      const browserWindow = getBrowserWindow()
      if (!browserWindow) {
        throw new Error('WebGazer requires a browser window.')
      }
      assertBrowserSupport(browserWindow)
      await loadWebGazerScript()
      const webgazer = browserWindow.webgazer

      if (!webgazer) {
        throw new Error('WebGazer is not available after loading the experimental browser tracker script.')
      }

      this.webgazer = webgazer
      webgazer.showVideoPreview?.(false)
      webgazer.showPredictionPoints?.(false)
      webgazer.setGazeListener((prediction) => {
        const now = Date.now()
        this.sampleCount += 1

        if (!isFinitePrediction(prediction)) {
          this.missingPredictionCount += 1
          return
        }

        this.latestPrediction = prediction
        this.validSampleCount += 1
        this.lastValidPredictionAt = now
        if (safeConfidence(prediction) !== null && (safeConfidence(prediction) ?? 1) < 0.5) {
          this.lowConfidenceCount += 1
        }

        if (this.status !== 'active' && this.status !== 'weak_signal') {
          return
        }

        if (now - this.lastSampledAt < this.sampleIntervalMs) {
          return
        }
        this.lastSampledAt = now

        this.events.push(
          predictionToGazeEvent(prediction, {
            eventIndex: this.eventIndex,
            viewportWidth: this.viewportWidth,
            viewportHeight: this.viewportHeight,
          }),
        )
        this.eventIndex += 1
      })
      await Promise.resolve(webgazer.begin())
      this.status = 'ready'
    } catch (error) {
      const classified = classifyWebGazerError(error)
      this.status = classified.status
      this.lastErrorMessage = classified.message
      throw new Error(classified.message)
    }
  }

  async runCalibration(options?: TrackerCalibrationOptions) {
    const targets = options?.targets ?? calibrationTargets
    this.status = 'calibrating'
    const measurements = await collectCalibrationMeasurements(
      targets,
      () => this.latestPrediction,
      (x, y) => this.webgazer?.recordScreenPosition?.(x, y, 'click'),
    )
    const summary = summarizeCalibration(measurements)
    this.calibrationSummary = summary
    const calibrationEvents = measurements.map((measurement, index) =>
      calibrationMeasurementToEvent(measurement, {
        eventIndex: this.eventIndex + index,
        step: index + 1,
        pointCount: targets.length,
      }),
    )

    this.eventIndex += calibrationEvents.length
    const completedEvent = calibrationCompletedEvent(this.eventIndex, targets.length, summary)
    this.eventIndex += 1
    this.events.push(...calibrationEvents, completedEvent)
    this.status = 'active'
    return [...calibrationEvents, completedEvent]
  }

  async startSession(options?: TrackerSessionOptions) {
    if (!this.webgazer) {
      this.status = 'error'
      this.lastErrorMessage = 'WebGazer is not initialized. Consent and initialize before starting browser gaze.'
      throw new Error(this.lastErrorMessage)
    }

    const browserWindow = getBrowserWindow()
    this.viewportWidth = options?.viewportWidth ?? browserWindow?.innerWidth ?? DEFAULT_VIEWPORT_WIDTH
    this.viewportHeight = options?.viewportHeight ?? browserWindow?.innerHeight ?? DEFAULT_VIEWPORT_HEIGHT
    this.lastSampledAt = 0
    this.trackingStartedAt = Date.now()
    this.lastValidPredictionAt = null
    this.sampleCount = 0
    this.validSampleCount = 0
    this.missingPredictionCount = 0
    this.lowConfidenceCount = 0
    this.events = [
      {
        id: `webgazer-event-${String(this.eventIndex).padStart(3, '0')}`,
        event_type: 'task_started',
        timestamp: createTimestamp(),
        payload: {
          label: 'Browser gaze experiment task started',
          source: TRACKER_SOURCE,
          tracker_type: TRACKER_SOURCE,
          target: options?.taskPrompt ?? 'Find the team plan and start checkout',
        },
      },
    ]
    this.eventIndex += 1
    this.status = 'ready'
  }

  async stopSession() {
    if (this.status === 'active' || this.status === 'weak_signal') {
      this.events.push({
        id: `webgazer-event-${String(this.eventIndex).padStart(3, '0')}`,
        event_type: 'task_completed',
        timestamp: createTimestamp(),
        payload: {
          label: 'Browser gaze experiment task completed',
          source: TRACKER_SOURCE,
          tracker_type: TRACKER_SOURCE,
          completed: true,
        },
      })
      this.eventIndex += 1
    }
    this.webgazer?.pause?.()
    this.status = 'stopped'
    return this.getEvents()
  }

  getCalibrationSummary() {
    return this.calibrationSummary
  }

  getEvents() {
    return [...this.events]
  }

  getTrackingStatus(now = Date.now()): BrowserGazeStatusSnapshot {
    const elapsedMs = this.trackingStartedAt ? Math.max(0, now - this.trackingStartedAt) : 0
    const state = deriveTrackingState({
      baseState: this.status,
      sampleCount: this.sampleCount,
      validSampleCount: this.validSampleCount,
      missingPredictionCount: this.missingPredictionCount,
      lowConfidenceCount: this.lowConfidenceCount,
      elapsedMs,
      msSinceLastValidPrediction: this.lastValidPredictionAt ? Math.max(0, now - this.lastValidPredictionAt) : null,
      lastErrorMessage: this.lastErrorMessage,
    })

    return {
      trackerState: state.trackerState,
      sampleCount: this.sampleCount,
      validSampleCount: this.validSampleCount,
      missingPredictionCount: this.missingPredictionCount,
      lowConfidenceCount: this.lowConfidenceCount,
      elapsedMs,
      latestPoint: this.latestPrediction
        ? normalizePrediction(this.latestPrediction, this.viewportWidth, this.viewportHeight)
        : null,
      message: state.message,
    }
  }

  dispose() {
    this.webgazer?.clearGazeListener?.()
    this.webgazer?.pause?.()
    this.events = []
    this.webgazer = null
    this.latestPrediction = null
    this.trackingStartedAt = null
    this.lastValidPredictionAt = null
    this.sampleCount = 0
    this.validSampleCount = 0
    this.missingPredictionCount = 0
    this.lowConfidenceCount = 0
    this.lastErrorMessage = null
    this.status = 'idle'
  }
}
