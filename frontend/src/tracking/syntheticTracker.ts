import type {
  NormalizedPoint,
  SyntheticTelemetryMode,
  TelemetryEvent,
  TelemetryEventPayload,
  TelemetryEventType,
  TrackerCalibrationOptions,
  TrackerProvider,
  TrackerSessionOptions,
} from './types'

export type {
  NormalizedPoint,
  SyntheticTelemetryMode,
  TelemetryEvent as MockStudyEvent,
  TelemetryEventPayload as MockEventPayload,
  TelemetryEventType as MockEventType,
}

export const calibrationTargets: NormalizedPoint[] = [
  { x: 0.5, y: 0.5 },
  { x: 0.15, y: 0.15 },
  { x: 0.85, y: 0.15 },
  { x: 0.15, y: 0.85 },
  { x: 0.85, y: 0.85 },
]

const DEMO_SESSION_START_MS = Date.UTC(2026, 0, 15, 17, 30, 0)
const VIEWPORT_WIDTH = 1
const VIEWPORT_HEIGHT = 1

const clusterOffsets: NormalizedPoint[] = [
  { x: -0.012, y: -0.008 },
  { x: -0.006, y: 0.004 },
  { x: 0.004, y: -0.003 },
  { x: 0.01, y: 0.006 },
  { x: 0.002, y: 0.009 },
  { x: -0.009, y: 0.002 },
  { x: 0.008, y: -0.007 },
  { x: -0.003, y: -0.01 },
  { x: 0.011, y: 0.001 },
  { x: -0.001, y: 0.007 },
]

function createTimestamp(offsetMs: number) {
  return new Date(DEMO_SESSION_START_MS + offsetMs).toISOString()
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(4))
}

function clampNormalized(value: number) {
  return Math.max(0, Math.min(1, value))
}

function modeConfidence(mode: SyntheticTelemetryMode, index: number) {
  if (mode === 'low_confidence') {
    return 0.34 + (index % 3) * 0.03
  }

  return 0.82 + (index % 5) * 0.025
}

function calibrationErrorPx(mode: SyntheticTelemetryMode, index: number) {
  if (mode === 'bad_calibration') {
    return 118 + index * 8
  }

  if (mode === 'low_confidence') {
    return 44 + index * 3
  }

  return 18 + index * 4
}

function createEvent(
  eventIndex: number,
  event_type: TelemetryEventType,
  offsetMs: number,
  payload: TelemetryEventPayload,
): TelemetryEvent {
  return {
    id: `demo-event-${String(eventIndex).padStart(3, '0')}`,
    event_type,
    timestamp: createTimestamp(offsetMs),
    payload,
  }
}

function createCalibrationEvents(mode: SyntheticTelemetryMode, startingIndex: number) {
  let eventIndex = startingIndex
  const events: TelemetryEvent[] = []
  const errors = calibrationTargets.map((_, index) => calibrationErrorPx(mode, index))

  calibrationTargets.forEach((target, index) => {
    const errorPx = errors[index]
    const normalizedError = Number((errorPx / 900).toFixed(3))
    const offset = normalizedError / 2
    const observed = {
      x: roundCoordinate(clampNormalized(target.x + (index % 2 === 0 ? offset : -offset))),
      y: roundCoordinate(clampNormalized(target.y + (index % 2 === 0 ? -offset : offset))),
    }

    events.push(
      createEvent(eventIndex, 'calibration_point_recorded', 500 + index * 400, {
        label: `Synthetic calibration target ${index + 1}`,
        source: 'synthetic',
        synthetic: true,
        mode,
        target_point: target,
        observed_point: observed,
        error_px: errorPx,
        error_normalized: normalizedError,
        confidence: mode === 'low_confidence' ? 0.58 : 0.9,
        calibration_step: index + 1,
        calibration_point_count: calibrationTargets.length,
      }),
    )
    eventIndex += 1
  })

  const averageErrorPx = Math.round(errors.reduce((total, error) => total + error, 0) / errors.length)
  events.push(
    createEvent(eventIndex, 'calibration_completed', 2600, {
      label: 'Synthetic demo calibration completed',
      source: 'synthetic',
      synthetic: true,
      mode,
      calibration_error_px: averageErrorPx,
      calibration_error_normalized: Number((averageErrorPx / 900).toFixed(3)),
      confidence: mode === 'low_confidence' ? 0.6 : 0.9,
      calibration_points_completed: calibrationTargets.length,
      calibration_point_count: calibrationTargets.length,
    }),
  )

  return { events, nextEventIndex: eventIndex + 1 }
}

function createGazeCluster(
  startingIndex: number,
  startingOffsetMs: number,
  center: NormalizedPoint,
  sampleCount: number,
  aoi: string,
  mode: SyntheticTelemetryMode,
) {
  let eventIndex = startingIndex
  const events: TelemetryEvent[] = []

  for (let index = 0; index < sampleCount; index += 1) {
    const offset = clusterOffsets[index % clusterOffsets.length]
    const x = roundCoordinate(clampNormalized(center.x + offset.x))
    const y = roundCoordinate(clampNormalized(center.y + offset.y))
    events.push(
      createEvent(eventIndex, 'gaze_sample_recorded', startingOffsetMs + index * 80, {
        label: `Synthetic gaze sample on ${aoi}`,
        source: 'synthetic',
        synthetic: true,
        mode,
        aoi,
        x,
        y,
        viewport_width: VIEWPORT_WIDTH,
        viewport_height: VIEWPORT_HEIGHT,
        confidence: Number(modeConfidence(mode, eventIndex).toFixed(3)),
        dwell_ms: 80,
      }),
    )
    eventIndex += 1
  }

  return { events, nextEventIndex: eventIndex }
}

function appendCluster(
  events: TelemetryEvent[],
  eventIndex: number,
  startingOffsetMs: number,
  center: NormalizedPoint,
  sampleCount: number,
  aoi: string,
  mode: SyntheticTelemetryMode,
) {
  const cluster = createGazeCluster(eventIndex, startingOffsetMs, center, sampleCount, aoi, mode)
  events.push(...cluster.events)
  return cluster.nextEventIndex
}

export function generateMockStudyEvents(mode: SyntheticTelemetryMode = 'healthy'): TelemetryEvent[] {
  let eventIndex = 1
  const events: TelemetryEvent[] = [
    createEvent(eventIndex, 'task_started', 0, {
      label: 'Synthetic demo task started',
      source: 'synthetic',
      synthetic: true,
      mode,
      target: 'Find the team plan and start checkout',
    }),
  ]
  eventIndex += 1

  const calibration = createCalibrationEvents(mode, eventIndex)
  events.push(...calibration.events)
  eventIndex = calibration.nextEventIndex

  if (mode !== 'no_gaze') {
    eventIndex = appendCluster(events, eventIndex, 3400, { x: 0.5, y: 0.1 }, 10, 'Navigation', mode)
    eventIndex = appendCluster(events, eventIndex, 4500, { x: 0.36, y: 0.25 }, 10, 'Hero headline', mode)

    events.push(
      createEvent(eventIndex, 'scroll_recorded', 5600, {
        label: 'Synthetic demo scroll toward pricing preview',
        source: 'synthetic',
        synthetic: true,
        mode,
        scroll_depth_percent: 48,
        confidence: mode === 'low_confidence' ? 0.42 : 0.86,
      }),
    )
    eventIndex += 1

    eventIndex = appendCluster(events, eventIndex, 6200, { x: 0.53, y: 0.72 }, 10, 'Pricing preview', mode)
    eventIndex = appendCluster(events, eventIndex, 7600, { x: 0.62, y: 0.44 }, 10, 'Primary CTA', mode)

    events.push(
      createEvent(eventIndex, 'click_recorded', 8800, {
        label: 'Synthetic demo click on primary CTA',
        source: 'synthetic',
        synthetic: true,
        mode,
        aoi: 'Primary CTA',
        x: 0.62,
        y: 0.44,
        viewport_width: VIEWPORT_WIDTH,
        viewport_height: VIEWPORT_HEIGHT,
        confidence: mode === 'low_confidence' ? 0.42 : 0.88,
      }),
    )
    eventIndex += 1

    eventIndex = appendCluster(events, eventIndex, 9300, { x: 0.54, y: 0.72 }, 8, 'Pricing preview', mode)
  } else {
    events.push(
      createEvent(eventIndex, 'scroll_recorded', 5600, {
        label: 'Synthetic demo scroll without usable gaze',
        source: 'synthetic',
        synthetic: true,
        mode,
        scroll_depth_percent: 42,
      }),
    )
    eventIndex += 1
  }

  events.push(
    createEvent(eventIndex, 'task_completed', 11000, {
      label: 'Synthetic demo task completed',
      source: 'synthetic',
      synthetic: true,
      mode,
      completed: true,
    }),
  )

  return events
}

export function countCalibrationEvents(events: TelemetryEvent[]) {
  return events.filter(
    (event) => event.event_type === 'calibration_point_recorded' || event.event_type === 'calibration_completed',
  ).length
}

export class SyntheticTracker implements TrackerProvider {
  readonly id = 'synthetic'
  readonly label = 'Synthetic demo'
  private mode: SyntheticTelemetryMode
  private events: TelemetryEvent[]

  constructor(options: { mode?: SyntheticTelemetryMode } = {}) {
    this.mode = options.mode ?? 'healthy'
    this.events = generateMockStudyEvents(this.mode)
  }

  isAvailable() {
    return true
  }

  async initialize() {
    this.events = generateMockStudyEvents(this.mode)
  }

  async runCalibration(_options?: TrackerCalibrationOptions) {
    return this.events.filter(
      (event) => event.event_type === 'calibration_point_recorded' || event.event_type === 'calibration_completed',
    )
  }

  async startSession(options?: TrackerSessionOptions) {
    this.mode = options?.mode ?? this.mode
    this.events = generateMockStudyEvents(this.mode)
  }

  async stopSession() {
    return this.getEvents()
  }

  getEvents() {
    return [...this.events]
  }

  dispose() {
    this.events = []
  }
}
