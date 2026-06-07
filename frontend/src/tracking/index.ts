export {
  SyntheticTracker,
  calibrationTargets,
  countCalibrationEvents,
  generateMockStudyEvents,
  generateSyntheticStudyEvents,
} from './syntheticTracker'
export { WebGazerTracker, predictionToGazeEvent } from './webgazerTracker'
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
