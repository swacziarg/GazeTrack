export {
  SyntheticTracker,
  calibrationTargets,
  countCalibrationEvents,
  generateMockStudyEvents,
  generateSyntheticStudyEvents,
} from './syntheticTracker'
export { WebGazerTracker, predictionToGazeEvent, type CalibrationSummary } from './webgazerTracker'
export {
  categorizeCalibrationQuality,
  deriveTrackingState,
  type BrowserGazeStatusSnapshot,
  type CalibrationQualityCategory,
  type CalibrationRecommendation,
} from './webgazerStatus'
export { createTrackerProvider, getTrackerOptions, isWebGazerFeatureEnabled, type TrackerOption } from './trackerFactory'
export type {
  NormalizedPoint,
  SyntheticAoiConfig,
  SyntheticStudyConfig,
  SyntheticTelemetryMode,
  TelemetryEvent,
  TelemetryEventPayload,
  TelemetryEventType,
  TrackerId,
  TrackerProvider,
  TrackerStatus,
} from './types'
