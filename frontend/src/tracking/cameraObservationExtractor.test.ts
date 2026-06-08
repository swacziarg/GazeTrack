import { describe, expect, it } from 'vitest'
import {
  fallbackObservationFromTrackingStatus,
  observationFromFaceLandmarkerResult,
} from './cameraObservationExtractor'
import type { CameraQualityObservation } from './cameraQuality'

type TestLandmark = {
  x: number
  y: number
  z?: number
  visibility?: number
}

const LEFT_EYE = [33, 133, 159, 145]
const RIGHT_EYE = [362, 263, 386, 374]

function landmark(point: TestLandmark) {
  return {
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
    visibility: point.visibility ?? 1,
  }
}

function faceLandmarks(overrides: Record<number, TestLandmark> = {}) {
  const landmarks = Array.from({ length: 478 }, () => landmark({ x: Number.NaN, y: Number.NaN }))
  const base: Record<number, TestLandmark> = {
    10: { x: 0.5, y: 0.2 },
    152: { x: 0.5, y: 0.72 },
    234: { x: 0.32, y: 0.48 },
    454: { x: 0.68, y: 0.48 },
    1: { x: 0.5, y: 0.37 },
    33: { x: 0.42, y: 0.34 },
    133: { x: 0.48, y: 0.34 },
    159: { x: 0.45, y: 0.32 },
    145: { x: 0.45, y: 0.36 },
    362: { x: 0.52, y: 0.34 },
    263: { x: 0.58, y: 0.34 },
    386: { x: 0.55, y: 0.32 },
    374: { x: 0.55, y: 0.36 },
    101: { x: 0.44, y: 0.44 },
    102: { x: 0.56, y: 0.44 },
    103: { x: 0.46, y: 0.6 },
    104: { x: 0.54, y: 0.6 },
  }
  for (const [index, point] of Object.entries({ ...base, ...overrides })) {
    landmarks[Number(index)] = landmark(point)
  }
  return landmarks
}

function result(landmarks = faceLandmarks()) {
  return {
    faceLandmarks: [landmarks],
    faceBlendshapes: [],
    facialTransformationMatrixes: [],
  }
}

describe('camera observation extraction from MediaPipe landmarks', () => {
  it('maps face bounds into center and size without exposing raw landmarks', () => {
    const observation = observationFromFaceLandmarkerResult(result(), {
      capturedAt: '2026-01-01T00:00:00.000Z',
      brightnessContrast: { brightness: 0.44, contrast: 0.16 },
    })

    expect(observation).toEqual(
      expect.objectContaining({
        faceDetected: true,
        eyesVisible: true,
        faceCenter: { x: 0.5, y: 0.46 },
        faceSize: 0.52,
        brightness: 0.44,
        contrast: 0.16,
      }),
    )
    expect(JSON.stringify(observation)).not.toContain('faceLandmarks')
  })

  it('marks eyes as missing when required eye landmarks are unavailable', () => {
    const missingEyes = faceLandmarks(
      Object.fromEntries([...LEFT_EYE, ...RIGHT_EYE].map((index) => [index, { x: Number.NaN, y: Number.NaN }])),
    )

    const observation = observationFromFaceLandmarkerResult(result(missingEyes))

    expect(observation.faceDetected).toBe(true)
    expect(observation.eyesVisible).toBe(false)
  })

  it('returns no-face observation when the model result has no usable face', () => {
    const observation = observationFromFaceLandmarkerResult({
      faceLandmarks: [],
      faceBlendshapes: [],
      facialTransformationMatrixes: [],
    })

    expect(observation).toEqual(
      expect.objectContaining({
        faceDetected: false,
        eyesVisible: false,
        faceCenter: null,
        faceSize: null,
        headPose: null,
      }),
    )
  })

  it('derives off-center and too-close/too-far signals from direct face geometry', () => {
    const shiftedFace: Record<number, TestLandmark> = {}
    faceLandmarks().forEach((point, index) => {
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
        shiftedFace[index] = { x: Math.min(point.x + 0.25, 0.98), y: point.y }
      }
    })
    const offCenter = observationFromFaceLandmarkerResult(
      result(faceLandmarks(shiftedFace)),
    )
    const farAway = observationFromFaceLandmarkerResult(
      result(
        faceLandmarks({
          10: { x: 0.5, y: 0.42 },
          152: { x: 0.5, y: 0.52 },
          234: { x: 0.46, y: 0.48 },
          454: { x: 0.54, y: 0.48 },
          33: { x: 0.48, y: 0.45 },
          133: { x: 0.49, y: 0.45 },
          159: { x: 0.485, y: 0.44 },
          145: { x: 0.485, y: 0.46 },
          362: { x: 0.51, y: 0.45 },
          263: { x: 0.52, y: 0.45 },
          386: { x: 0.515, y: 0.44 },
          374: { x: 0.515, y: 0.46 },
          101: { x: 0.49, y: 0.47 },
          102: { x: 0.51, y: 0.47 },
          103: { x: 0.49, y: 0.5 },
          104: { x: 0.51, y: 0.5 },
        }),
      ),
    )

    expect(offCenter.faceCenter?.x).toBeGreaterThan(0.7)
    expect(farAway.faceSize).toBeLessThan(0.16)
  })

  it('estimates roll and yaw when stable pose landmarks are available', () => {
    const rolled = observationFromFaceLandmarkerResult(
      result(faceLandmarks({ 33: { x: 0.42, y: 0.31 }, 133: { x: 0.48, y: 0.33 }, 362: { x: 0.52, y: 0.35 }, 263: { x: 0.58, y: 0.37 } })),
    )
    const turned = observationFromFaceLandmarkerResult(result(faceLandmarks({ 1: { x: 0.56, y: 0.37 } })))

    expect(Math.abs(rolled.headPose?.roll ?? 0)).toBeGreaterThan(10)
    expect(turned.headPose?.yaw).toBeGreaterThan(10)
  })

  it('tracks movement from face center and size changes', () => {
    const previous: CameraQualityObservation = {
      capturedAt: '2026-01-01T00:00:00.000Z',
      faceDetected: true,
      eyesVisible: true,
      faceCenter: { x: 0.5, y: 0.46 },
      faceSize: 0.52,
    }
    const observation = observationFromFaceLandmarkerResult(result(faceLandmarks({ 454: { x: 0.78, y: 0.48 } })), {
      capturedAt: '2026-01-01T00:00:00.250Z',
      previousObservation: previous,
    })

    expect(observation.observedFps).toBe(4)
    expect(observation.movement).toBeGreaterThanOrEqual(0.05)
  })
})

describe('fallback camera observation', () => {
  it('uses browser gaze status only when direct extractor is unavailable', () => {
    const observation = fallbackObservationFromTrackingStatus(null, {
      trackerState: 'active',
      sampleCount: 8,
      validSampleCount: 4,
      missingPredictionCount: 0,
      lowConfidenceCount: 0,
      elapsedMs: 1000,
      latestPoint: { x: 0.62, y: 0.4 },
      message: null,
    }, null)

    expect(observation).toEqual(
      expect.objectContaining({
        faceDetected: true,
        eyesVisible: true,
        faceCenter: { x: 0.62, y: 0.4 },
        faceSize: null,
        observedFps: 4,
      }),
    )
  })
})
