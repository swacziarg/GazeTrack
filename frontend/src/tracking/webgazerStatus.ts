import type { NormalizedPoint, TrackerStatus } from './types'

export type CalibrationQualityCategory = 'good' | 'usable' | 'weak'
export type CalibrationRecommendation = 'continue' | 'retry_calibration' | 'use_synthetic_demo'

export type BrowserGazeStatusSnapshot = {
  trackerState: TrackerStatus
  sampleCount: number
  validSampleCount: number
  missingPredictionCount: number
  lowConfidenceCount: number
  elapsedMs: number
  latestPoint: NormalizedPoint | null
  message: string | null
}

export type CalibrationQualityInput = {
  completedPoints: number
  expectedPoints: number
  averageErrorPx: number | null
  averageErrorNormalized: number | null
  averageConfidence: number | null
}

export type CalibrationQualityFeedback = {
  quality: CalibrationQualityCategory
  recommendation: CalibrationRecommendation
  warning: string | null
}

export type TrackingSignalInput = {
  baseState: TrackerStatus
  sampleCount: number
  validSampleCount: number
  missingPredictionCount: number
  lowConfidenceCount: number
  elapsedMs: number
  msSinceLastValidPrediction: number | null
  lastErrorMessage?: string | null
}

const LOW_CONFIDENCE_RATE_WARNING = 0.45
const MISSING_PREDICTION_RATE_WARNING = 0.5
const NO_PREDICTION_TIMEOUT_MS = 3000
const STALE_PREDICTION_TIMEOUT_MS = 4500

export function categorizeCalibrationQuality(input: CalibrationQualityInput): CalibrationQualityFeedback {
  if (input.completedPoints === 0 || input.averageErrorPx === null || input.averageErrorNormalized === null) {
    return {
      quality: 'weak',
      recommendation: 'use_synthetic_demo',
      warning: 'Calibration completed, but browser gaze predictions were not available yet.',
    }
  }

  const completedEnoughTargets = input.completedPoints >= Math.min(5, input.expectedPoints)
  const confidence = input.averageConfidence

  if (
    completedEnoughTargets &&
    input.averageErrorPx <= 80 &&
    input.averageErrorNormalized <= 0.12 &&
    (confidence === null || confidence >= 0.6)
  ) {
    return {
      quality: 'good',
      recommendation: 'continue',
      warning: null,
    }
  }

  if (
    input.averageErrorPx <= 160 &&
    input.averageErrorNormalized <= 0.24 &&
    (confidence === null || confidence >= 0.45)
  ) {
    return {
      quality: 'usable',
      recommendation: 'continue',
      warning: 'Calibration is usable but approximate. Treat report metrics as experimental browser-gaze telemetry.',
    }
  }

  return {
    quality: 'weak',
    recommendation: 'retry_calibration',
    warning: 'Calibration quality is weak. Retry calibration or use the synthetic demo.',
  }
}

export function deriveTrackingState(input: TrackingSignalInput): Pick<BrowserGazeStatusSnapshot, 'trackerState' | 'message'> {
  if (input.baseState === 'error') {
    return {
      trackerState: 'error',
      message: input.lastErrorMessage ?? 'Browser gaze tracking hit an error. Use the synthetic demo if this continues.',
    }
  }

  if (input.baseState !== 'active' && input.baseState !== 'weak_signal') {
    return {
      trackerState: input.baseState,
      message:
        input.baseState === 'permission_needed' ? input.lastErrorMessage ?? null : null,
    }
  }

  if (input.validSampleCount === 0 && input.elapsedMs >= NO_PREDICTION_TIMEOUT_MS) {
    return {
      trackerState: 'weak_signal',
      message: 'No browser gaze predictions received yet. Check camera permission, lighting, and tab focus.',
    }
  }

  if (
    input.msSinceLastValidPrediction !== null &&
    input.validSampleCount > 0 &&
    input.msSinceLastValidPrediction >= STALE_PREDICTION_TIMEOUT_MS
  ) {
    return {
      trackerState: 'weak_signal',
      message: 'Browser gaze predictions stopped updating. The capture may have stalled or lost face tracking.',
    }
  }

  if (input.sampleCount >= 5) {
    const lowConfidenceRate = input.lowConfidenceCount / input.sampleCount
    const missingPredictionRate = input.missingPredictionCount / input.sampleCount
    if (lowConfidenceRate >= LOW_CONFIDENCE_RATE_WARNING || missingPredictionRate >= MISSING_PREDICTION_RATE_WARNING) {
      return {
        trackerState: 'weak_signal',
        message: 'Browser gaze signal is weak. Improve lighting, face the camera, or retry calibration.',
      }
    }
  }

  return {
    trackerState: 'active',
    message: null,
  }
}
