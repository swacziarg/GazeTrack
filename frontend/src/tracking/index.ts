export { SyntheticTracker, calibrationTargets, countCalibrationEvents, generateMockStudyEvents } from './syntheticTracker'
export { WebGazerTracker, predictionToGazeEvent } from './webgazerTracker'
export { createTrackerProvider, getTrackerOptions, isWebGazerFeatureEnabled, type TrackerOption } from './trackerFactory'
export type {
  NormalizedPoint,
  SyntheticTelemetryMode,
  TelemetryEvent,
  TelemetryEventPayload,
  TelemetryEventType,
  TrackerId,
  TrackerProvider,
  TrackerStatus,
} from './types'
