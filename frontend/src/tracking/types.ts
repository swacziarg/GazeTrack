export type TrackerId = 'synthetic' | 'webgazer'
export type TrackerEventSource = TrackerId | 'webgazer_experimental'

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

export type SyntheticAoiConfig = {
  label: string
  semanticType?: string
  roleKey?: string
  selector?: string
  required?: boolean
  x: number
  y: number
  width: number
  height: number
}

export type SyntheticStudyConfig = {
  name: string
  objective?: string
  targetUrl?: string
  taskPrompt: string
  aois: SyntheticAoiConfig[]
}

export type TelemetryEventPayload = {
  label: string
  source?: TrackerEventSource
  tracker_type?: TrackerEventSource
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
  calibration_quality?: 'good' | 'usable' | 'weak'
  calibration_recommendation?: 'continue' | 'retry_calibration' | 'use_synthetic_demo'
  quality_warning?: string
  quality_score?: number
  quality_flags?: string[]
  camera_readiness_score?: number
  tracking_quality?: 'high' | 'medium' | 'low'
  camera_readiness_baseline?: Record<string, unknown>
  drift_metrics?: Record<string, unknown>
  dwell_ms?: number
  scroll_depth_percent?: number
  target?: string
  task_prompt?: string
  study_name?: string
  target_url?: string
  completed?: boolean
}

export type TelemetryEvent = {
  id: string
  event_type: TelemetryEventType
  timestamp: string
  payload: TelemetryEventPayload
}

export type TrackerStatus =
  | 'idle'
  | 'permission_needed'
  | 'loading'
  | 'ready'
  | 'calibrating'
  | 'active'
  | 'weak_signal'
  | 'stopped'
  | 'error'

export type TrackerCalibrationOptions = {
  calibrationPasses?: number
  samplesPerTarget?: number
  surfaceElement?: HTMLElement | null
  targets?: NormalizedPoint[]
}

export type TrackerSessionOptions = {
  mode?: SyntheticTelemetryMode
  taskPrompt?: string
  studyConfig?: SyntheticStudyConfig
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
