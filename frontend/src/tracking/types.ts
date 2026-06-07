export type TrackerId = 'synthetic' | 'webgazer'

export type SyntheticTelemetryMode = 'healthy' | 'low_confidence' | 'bad_calibration' | 'no_gaze'

export type TelemetryEventType =
  | 'task_started'
  | 'calibration_point_recorded'
  | 'calibration_completed'
  | 'gaze_sample_recorded'
  | 'click_recorded'
  | 'scroll_recorded'
  | 'task_completed'

export type NormalizedPoint = {
  x: number
  y: number
}

export type TelemetryEventPayload = {
  label: string
  source?: TrackerId
  synthetic?: true
  mode?: SyntheticTelemetryMode
  aoi?: string
  x?: number
  y?: number
  point?: NormalizedPoint
  viewport_width?: number
  viewport_height?: number
  confidence?: number | null
  calibration_error_px?: number
  calibration_error_normalized?: number
  error_px?: number
  error_normalized?: number
  target_point?: NormalizedPoint
  observed_point?: NormalizedPoint
  calibration_step?: number
  calibration_point_count?: number
  calibration_points_completed?: number
  dwell_ms?: number
  scroll_depth_percent?: number
  target?: string
  completed?: boolean
}

export type TelemetryEvent = {
  id: string
  event_type: TelemetryEventType
  timestamp: string
  payload: TelemetryEventPayload
}

export type TrackerStatus = 'idle' | 'consent_required' | 'initializing' | 'ready' | 'tracking' | 'stopped' | 'unavailable'

export type TrackerCalibrationOptions = {
  targets?: NormalizedPoint[]
}

export type TrackerSessionOptions = {
  mode?: SyntheticTelemetryMode
  taskPrompt?: string
  viewportWidth?: number
  viewportHeight?: number
}

export type TrackerProvider = {
  id: TrackerId
  label: string
  isAvailable(): boolean | Promise<boolean>
  initialize(): Promise<void>
  runCalibration(options?: TrackerCalibrationOptions): Promise<TelemetryEvent[]>
  startSession(options?: TrackerSessionOptions): Promise<void>
  stopSession(): Promise<TelemetryEvent[]>
  getEvents(): TelemetryEvent[]
  dispose(): void
}
