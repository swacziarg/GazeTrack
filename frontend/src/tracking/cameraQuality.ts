import type { NormalizedPoint } from './types'

export type CameraQualityLevel = 'high' | 'medium' | 'low'

export type CameraReadinessState =
  | 'ready'
  | 'no_face_detected'
  | 'move_closer'
  | 'move_farther_back'
  | 'center_face'
  | 'reduce_head_tilt_turn'
  | 'improve_lighting'
  | 'hold_still'
  | 'camera_frame_rate_too_low'

export type CameraQualityFlag =
  | 'face_lost'
  | 'eye_visibility_lost'
  | 'face_center_drift'
  | 'face_size_drift'
  | 'head_pose_drift'
  | 'low_light'
  | 'sample_rate_low'
  | 'unstable_position'

export type CameraQualityObservation = {
  capturedAt: string
  faceDetected: boolean
  eyesVisible?: boolean | null
  faceCenter?: NormalizedPoint | null
  faceSize?: number | null
  headPose?: {
    yaw?: number | null
    pitch?: number | null
    roll?: number | null
  } | null
  brightness?: number | null
  contrast?: number | null
  observedFps?: number | null
  movement?: number | null
}

export type CameraReadinessResult = {
  state: CameraReadinessState
  ready: boolean
  score: number
  quality: CameraQualityLevel
  flags: CameraQualityFlag[]
  prompt: string
}

export type CameraQualityBaseline = {
  captured_at: string
  face_center?: NormalizedPoint | null
  face_size?: number | null
  head_pose?: CameraQualityObservation['headPose']
  brightness?: number | null
  contrast?: number | null
  observed_fps?: number | null
  readiness_score: number
}

export type DriftMetrics = {
  face_center_drift?: number | null
  face_size_drift?: number | null
  head_pose_drift?: number | null
  eye_visibility_lost: boolean
  face_lost: boolean
  low_light: boolean
  sample_rate_low: boolean
  calibration_baseline_age_ms: number
  overall_tracking_quality: CameraQualityLevel
}

export type DriftResult = {
  trackingQuality: CameraQualityLevel
  qualityScore: number
  qualityFlags: CameraQualityFlag[]
  driftMetrics: DriftMetrics
}

export const cameraQualityThresholds = {
  minBrightness: 0.18,
  maxBrightness: 0.88,
  minContrast: 0.08,
  minObservedFps: 8,
  centeredMaxOffset: 0.22,
  minFaceSize: 0.16,
  maxFaceSize: 0.62,
  maxHeadPoseDegrees: 18,
  stableMovementMax: 0.035,
  stableWindowMs: 1500,
  driftCenterWarn: 0.18,
  driftFaceSizeWarn: 0.18,
  driftHeadPoseWarnDegrees: 14,
} as const

const readinessPrompts: Record<CameraReadinessState, string> = {
  ready: 'Ready for calibration',
  no_face_detected: 'Face the camera',
  move_closer: 'Move closer',
  move_farther_back: 'Move farther back',
  center_face: 'Center your face',
  reduce_head_tilt_turn: 'Face the camera directly',
  improve_lighting: 'Improve lighting',
  hold_still: 'Hold still',
  camera_frame_rate_too_low: 'Camera frame rate is low',
}

function roundMetric(value: number) {
  return Number(value.toFixed(3))
}

function distanceFromCenter(point: NormalizedPoint) {
  return Math.hypot(point.x - 0.5, point.y - 0.5)
}

function headPoseMagnitude(headPose: CameraQualityObservation['headPose']) {
  if (!headPose) {
    return null
  }
  const values = [headPose.yaw, headPose.pitch, headPose.roll].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (values.length === 0) {
    return null
  }
  return Math.max(...values.map((value) => Math.abs(value)))
}

function scoreFromFlags(flags: CameraQualityFlag[]) {
  const penalty = flags.reduce((total, flag) => {
    if (flag === 'face_lost' || flag === 'eye_visibility_lost') {
      return total + 45
    }
    if (flag === 'low_light' || flag === 'sample_rate_low') {
      return total + 25
    }
    return total + 18
  }, 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}

export function qualityLevelFromScore(score: number): CameraQualityLevel {
  if (score >= 80) {
    return 'high'
  }
  if (score >= 55) {
    return 'medium'
  }
  return 'low'
}

export function evaluateCameraReadiness(
  observation: CameraQualityObservation,
  stableForMs: number,
): CameraReadinessResult {
  const flags: CameraQualityFlag[] = []
  let state: CameraReadinessState = 'ready'

  if (!observation.faceDetected) {
    flags.push('face_lost')
    state = 'no_face_detected'
  } else if (observation.eyesVisible === false) {
    flags.push('eye_visibility_lost')
    state = 'no_face_detected'
  } else if (
    typeof observation.faceSize === 'number' &&
    observation.faceSize < cameraQualityThresholds.minFaceSize
  ) {
    flags.push('face_size_drift')
    state = 'move_closer'
  } else if (
    typeof observation.faceSize === 'number' &&
    observation.faceSize > cameraQualityThresholds.maxFaceSize
  ) {
    flags.push('face_size_drift')
    state = 'move_farther_back'
  } else if (
    observation.faceCenter &&
    distanceFromCenter(observation.faceCenter) > cameraQualityThresholds.centeredMaxOffset
  ) {
    flags.push('face_center_drift')
    state = 'center_face'
  } else if (
    (observation.brightness !== null &&
      observation.brightness !== undefined &&
      (observation.brightness < cameraQualityThresholds.minBrightness ||
        observation.brightness > cameraQualityThresholds.maxBrightness)) ||
    (observation.contrast !== null &&
      observation.contrast !== undefined &&
      observation.contrast < cameraQualityThresholds.minContrast)
  ) {
    flags.push('low_light')
    state = 'improve_lighting'
  } else if (
    typeof observation.observedFps === 'number' &&
    observation.observedFps < cameraQualityThresholds.minObservedFps
  ) {
    flags.push('sample_rate_low')
    state = 'camera_frame_rate_too_low'
  } else if (
    typeof observation.movement === 'number' &&
    observation.movement > cameraQualityThresholds.stableMovementMax
  ) {
    flags.push('unstable_position')
    state = 'hold_still'
  } else if (stableForMs < cameraQualityThresholds.stableWindowMs) {
    flags.push('unstable_position')
    state = 'hold_still'
  }

  const poseMagnitude = headPoseMagnitude(observation.headPose)
  if (
    state === 'ready' &&
    poseMagnitude !== null &&
    poseMagnitude > cameraQualityThresholds.maxHeadPoseDegrees
  ) {
    flags.push('head_pose_drift')
    state = 'reduce_head_tilt_turn'
  }

  const score = scoreFromFlags(flags)
  return {
    state,
    ready: state === 'ready',
    score,
    quality: qualityLevelFromScore(score),
    flags,
    prompt: readinessPrompts[state],
  }
}

export function createCameraQualityBaseline(
  observation: CameraQualityObservation,
  readinessScore: number,
): CameraQualityBaseline {
  return {
    captured_at: observation.capturedAt,
    face_center: observation.faceCenter ?? null,
    face_size: observation.faceSize ?? null,
    head_pose: observation.headPose ?? null,
    brightness: observation.brightness ?? null,
    contrast: observation.contrast ?? null,
    observed_fps: observation.observedFps ?? null,
    readiness_score: roundMetric(readinessScore),
  }
}

function centerDrift(current: NormalizedPoint | null | undefined, baseline: NormalizedPoint | null | undefined) {
  if (!current || !baseline) {
    return null
  }
  return roundMetric(Math.hypot(current.x - baseline.x, current.y - baseline.y))
}

function sizeDrift(current: number | null | undefined, baseline: number | null | undefined) {
  if (typeof current !== 'number' || typeof baseline !== 'number' || baseline <= 0) {
    return null
  }
  return roundMetric(Math.abs(current - baseline) / baseline)
}

function poseDrift(
  current: CameraQualityObservation['headPose'],
  baseline: CameraQualityObservation['headPose'],
) {
  if (!current || !baseline) {
    return null
  }
  const axes = ['yaw', 'pitch', 'roll'] as const
  const deltas = axes
    .map((axis) =>
      typeof current[axis] === 'number' && typeof baseline[axis] === 'number'
        ? Math.abs(current[axis] - baseline[axis])
        : null,
    )
    .filter((value): value is number => value !== null)
  return deltas.length ? roundMetric(Math.max(...deltas)) : null
}

export function classifyTrackingDrift(
  baseline: CameraQualityBaseline,
  observation: CameraQualityObservation,
  now = Date.parse(observation.capturedAt),
): DriftResult {
  const faceCenterDrift = centerDrift(observation.faceCenter, baseline.face_center)
  const faceSizeDrift = sizeDrift(observation.faceSize, baseline.face_size)
  const headPoseDrift = poseDrift(observation.headPose, baseline.head_pose)
  const qualityFlags: CameraQualityFlag[] = []

  if (!observation.faceDetected) {
    qualityFlags.push('face_lost')
  }
  if (observation.eyesVisible === false) {
    qualityFlags.push('eye_visibility_lost')
  }
  if (faceCenterDrift !== null && faceCenterDrift > cameraQualityThresholds.driftCenterWarn) {
    qualityFlags.push('face_center_drift')
  }
  if (faceSizeDrift !== null && faceSizeDrift > cameraQualityThresholds.driftFaceSizeWarn) {
    qualityFlags.push('face_size_drift')
  }
  if (headPoseDrift !== null && headPoseDrift > cameraQualityThresholds.driftHeadPoseWarnDegrees) {
    qualityFlags.push('head_pose_drift')
  }
  if (
    (observation.brightness !== null &&
      observation.brightness !== undefined &&
      observation.brightness < cameraQualityThresholds.minBrightness) ||
    (observation.contrast !== null &&
      observation.contrast !== undefined &&
      observation.contrast < cameraQualityThresholds.minContrast)
  ) {
    qualityFlags.push('low_light')
  }
  if (
    typeof observation.observedFps === 'number' &&
    observation.observedFps < cameraQualityThresholds.minObservedFps
  ) {
    qualityFlags.push('sample_rate_low')
  }

  const qualityScore = scoreFromFlags(qualityFlags)
  const trackingQuality = qualityLevelFromScore(qualityScore)
  return {
    trackingQuality,
    qualityScore,
    qualityFlags,
    driftMetrics: {
      face_center_drift: faceCenterDrift,
      face_size_drift: faceSizeDrift,
      head_pose_drift: headPoseDrift,
      eye_visibility_lost: observation.eyesVisible === false,
      face_lost: !observation.faceDetected,
      low_light: qualityFlags.includes('low_light'),
      sample_rate_low: qualityFlags.includes('sample_rate_low'),
      calibration_baseline_age_ms: Math.max(0, now - Date.parse(baseline.captured_at)),
      overall_tracking_quality: trackingQuality,
    },
  }
}
