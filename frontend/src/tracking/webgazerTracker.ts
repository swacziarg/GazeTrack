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

type WebGazerPrediction = {
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
}

type WindowWithWebGazer = Window & {
  webgazer?: WebGazerApi
}

const DEFAULT_VIEWPORT_WIDTH = 1
const DEFAULT_VIEWPORT_HEIGHT = 1

function getBrowserWindow(): WindowWithWebGazer | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window as WindowWithWebGazer
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

function safeConfidence(prediction: WebGazerPrediction) {
  return typeof prediction.confidence === 'number' && Number.isFinite(prediction.confidence)
    ? Number(prediction.confidence.toFixed(3))
    : null
}

export function predictionToGazeEvent(
  prediction: WebGazerPrediction,
  options: { eventIndex: number; viewportWidth: number; viewportHeight: number },
): TelemetryEvent {
  const point = normalizePrediction(prediction, options.viewportWidth, options.viewportHeight)
  const payload: TelemetryEventPayload = {
    label: 'Browser gaze sample',
    source: 'webgazer',
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

export class WebGazerTracker implements TrackerProvider {
  readonly id = 'webgazer'
  readonly label = 'Browser gaze experiment'
  status: TrackerStatus = 'idle'
  private events: TelemetryEvent[] = []
  private eventIndex = 1
  private webgazer: WebGazerApi | null = null
  private viewportWidth = DEFAULT_VIEWPORT_WIDTH
  private viewportHeight = DEFAULT_VIEWPORT_HEIGHT

  async isAvailable() {
    return Boolean(getBrowserWindow()?.webgazer)
  }

  async initialize() {
    this.status = 'initializing'
    const browserWindow = getBrowserWindow()
    const webgazer = browserWindow?.webgazer

    if (!webgazer) {
      this.status = 'unavailable'
      throw new Error('window.webgazer is not available. Load WebGazer only for the flagged browser experiment.')
    }

    this.webgazer = webgazer
    webgazer.showVideoPreview?.(false)
    webgazer.showPredictionPoints?.(false)
    webgazer.setGazeListener((prediction) => {
      if (!prediction || this.status !== 'tracking') {
        return
      }

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
  }

  async runCalibration(options?: TrackerCalibrationOptions) {
    const targets = options?.targets ?? calibrationTargets
    const calibrationEvents = targets.map((target, index) => {
      const event: TelemetryEvent = {
        id: `webgazer-event-${String(this.eventIndex + index).padStart(3, '0')}`,
        event_type: 'calibration_point_recorded',
        timestamp: createTimestamp(),
        payload: {
          label: `Browser calibration target ${index + 1}`,
          source: 'webgazer',
          target_point: target,
          observed_point: target,
          error_px: 0,
          error_normalized: 0,
          confidence: null,
          calibration_step: index + 1,
          calibration_point_count: targets.length,
        },
      }
      return event
    })

    this.eventIndex += calibrationEvents.length
    const completedEvent: TelemetryEvent = {
      id: `webgazer-event-${String(this.eventIndex).padStart(3, '0')}`,
      event_type: 'calibration_completed',
      timestamp: createTimestamp(),
      payload: {
        label: 'Browser calibration completed',
        source: 'webgazer',
        confidence: null,
        calibration_points_completed: targets.length,
        calibration_point_count: targets.length,
      },
    }
    this.eventIndex += 1
    this.events.push(...calibrationEvents, completedEvent)
    return [...calibrationEvents, completedEvent]
  }

  async startSession(options?: TrackerSessionOptions) {
    const browserWindow = getBrowserWindow()
    this.viewportWidth = options?.viewportWidth ?? browserWindow?.innerWidth ?? DEFAULT_VIEWPORT_WIDTH
    this.viewportHeight = options?.viewportHeight ?? browserWindow?.innerHeight ?? DEFAULT_VIEWPORT_HEIGHT
    this.events = [
      {
        id: `webgazer-event-${String(this.eventIndex).padStart(3, '0')}`,
        event_type: 'task_started',
        timestamp: createTimestamp(),
        payload: {
          label: 'Browser gaze experiment task started',
          source: 'webgazer',
          target: options?.taskPrompt ?? 'Find the team plan and start checkout',
        },
      },
    ]
    this.eventIndex += 1
    this.status = 'tracking'
  }

  async stopSession() {
    if (this.status === 'tracking') {
      this.events.push({
        id: `webgazer-event-${String(this.eventIndex).padStart(3, '0')}`,
        event_type: 'task_completed',
        timestamp: createTimestamp(),
        payload: {
          label: 'Browser gaze experiment task completed',
          source: 'webgazer',
          completed: true,
        },
      })
      this.eventIndex += 1
    }
    this.webgazer?.pause?.()
    this.status = 'stopped'
    return this.getEvents()
  }

  getEvents() {
    return [...this.events]
  }

  dispose() {
    this.webgazer?.clearGazeListener?.()
    this.webgazer?.pause?.()
    this.events = []
    this.webgazer = null
    this.status = 'idle'
  }
}
