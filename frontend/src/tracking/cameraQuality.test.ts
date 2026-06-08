import { describe, expect, it } from 'vitest'
import {
  cameraQualityThresholds,
  classifyTrackingDrift,
  createCameraQualityBaseline,
  evaluateCameraReadiness,
  type CameraQualityObservation,
} from './cameraQuality'

function observation(overrides: Partial<CameraQualityObservation> = {}): CameraQualityObservation {
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    faceDetected: true,
    eyesVisible: true,
    faceCenter: { x: 0.5, y: 0.5 },
    faceSize: 0.3,
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    brightness: 0.45,
    contrast: 0.18,
    observedFps: 18,
    movement: 0.005,
    ...overrides,
  }
}

describe('cameraQuality readiness scoring', () => {
  it('passes when face, lighting, stability, and sample rate are acceptable', () => {
    const result = evaluateCameraReadiness(observation(), cameraQualityThresholds.stableWindowMs)

    expect(result.ready).toBe(true)
    expect(result.state).toBe('ready')
    expect(result.score).toBe(100)
  })

  it('detects no face and unavailable eye visibility', () => {
    const result = evaluateCameraReadiness(
      observation({ faceDetected: false, eyesVisible: false, faceCenter: null }),
      cameraQualityThresholds.stableWindowMs,
    )

    expect(result.ready).toBe(false)
    expect(result.state).toBe('no_face_detected')
    expect(result.flags).toContain('face_lost')
  })

  it('detects face too small or too large', () => {
    expect(
      evaluateCameraReadiness(observation({ faceSize: 0.08 }), cameraQualityThresholds.stableWindowMs).state,
    ).toBe('move_closer')
    expect(
      evaluateCameraReadiness(observation({ faceSize: 0.8 }), cameraQualityThresholds.stableWindowMs).state,
    ).toBe('move_farther_back')
  })

  it('detects off-center face position', () => {
    const result = evaluateCameraReadiness(
      observation({ faceCenter: { x: 0.86, y: 0.5 } }),
      cameraQualityThresholds.stableWindowMs,
    )

    expect(result.state).toBe('center_face')
    expect(result.flags).toContain('face_center_drift')
  })

  it('detects unstable movement and low brightness', () => {
    expect(
      evaluateCameraReadiness(observation({ movement: 0.08 }), cameraQualityThresholds.stableWindowMs).state,
    ).toBe('hold_still')
    expect(
      evaluateCameraReadiness(observation({ brightness: 0.08 }), cameraQualityThresholds.stableWindowMs).state,
    ).toBe('improve_lighting')
  })

  it('detects low camera sample rate', () => {
    const result = evaluateCameraReadiness(
      observation({ observedFps: 4 }),
      cameraQualityThresholds.stableWindowMs,
    )

    expect(result.state).toBe('camera_frame_rate_too_low')
    expect(result.flags).toContain('sample_rate_low')
  })
})

describe('cameraQuality drift classification', () => {
  it('classifies baseline drift and low-quality flags', () => {
    const baseline = createCameraQualityBaseline(observation(), 96)
    const result = classifyTrackingDrift(
      baseline,
      observation({
        capturedAt: '2026-01-01T00:00:03.000Z',
        faceCenter: { x: 0.78, y: 0.5 },
        brightness: 0.09,
        observedFps: 4,
      }),
    )

    expect(result.qualityFlags).toEqual(
      expect.arrayContaining(['face_center_drift', 'low_light', 'sample_rate_low']),
    )
    expect(result.driftMetrics.face_center_drift).toBeGreaterThan(0.18)
    expect(result.driftMetrics.calibration_baseline_age_ms).toBe(3000)
    expect(result.trackingQuality).toBe('low')
  })
})
