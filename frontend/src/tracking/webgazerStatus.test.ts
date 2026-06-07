import { describe, expect, it } from 'vitest'
import { categorizeCalibrationQuality, deriveTrackingState } from './webgazerStatus'

describe('webgazerStatus helpers', () => {
  it('categorizes good, usable, and weak calibration quality', () => {
    expect(
      categorizeCalibrationQuality({
        completedPoints: 5,
        expectedPoints: 5,
        averageErrorPx: 42,
        averageErrorNormalized: 0.05,
        averageConfidence: 0.82,
      }),
    ).toEqual(expect.objectContaining({ quality: 'good', recommendation: 'continue' }))

    expect(
      categorizeCalibrationQuality({
        completedPoints: 5,
        expectedPoints: 5,
        averageErrorPx: 120,
        averageErrorNormalized: 0.16,
        averageConfidence: 0.54,
      }),
    ).toEqual(expect.objectContaining({ quality: 'usable', recommendation: 'continue' }))

    expect(
      categorizeCalibrationQuality({
        completedPoints: 5,
        expectedPoints: 5,
        averageErrorPx: 240,
        averageErrorNormalized: 0.32,
        averageConfidence: 0.31,
      }),
    ).toEqual(expect.objectContaining({ quality: 'weak', recommendation: 'retry_calibration' }))
  })

  it('marks active tracking as weak signal when predictions are missing or stale', () => {
    expect(
      deriveTrackingState({
        baseState: 'active',
        sampleCount: 0,
        validSampleCount: 0,
        missingPredictionCount: 0,
        lowConfidenceCount: 0,
        elapsedMs: 3200,
        msSinceLastValidPrediction: null,
      }),
    ).toEqual(expect.objectContaining({ trackerState: 'weak_signal' }))

    expect(
      deriveTrackingState({
        baseState: 'active',
        sampleCount: 8,
        validSampleCount: 8,
        missingPredictionCount: 0,
        lowConfidenceCount: 0,
        elapsedMs: 6000,
        msSinceLastValidPrediction: 5000,
      }),
    ).toEqual(expect.objectContaining({ trackerState: 'weak_signal' }))
  })

  it('keeps healthy active tracking active', () => {
    expect(
      deriveTrackingState({
        baseState: 'active',
        sampleCount: 10,
        validSampleCount: 10,
        missingPredictionCount: 0,
        lowConfidenceCount: 1,
        elapsedMs: 1500,
        msSinceLastValidPrediction: 100,
      }),
    ).toEqual({ trackerState: 'active', message: null })
  })
})
