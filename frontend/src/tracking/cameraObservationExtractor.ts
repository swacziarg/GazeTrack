import type {
  FaceLandmarker,
  FaceLandmarkerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import type { CameraQualityObservation } from './cameraQuality'
import type { NormalizedPoint } from './types'
import type { BrowserGazeStatusSnapshot } from './webgazerStatus'

export type CameraObservationExtractor = {
  sample(video: HTMLVideoElement, previousObservation: CameraQualityObservation | null): CameraQualityObservation
  dispose(): void
}

type BrightnessContrast = {
  brightness: number | null
  contrast: number | null
}

const VIDEO_SAMPLE_SIZE = 24
const MIN_EYE_DISTANCE = 0.04
const MIN_LANDMARK_COUNT_FOR_FACE = 8
const PUBLIC_BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '')
const MEDIAPIPE_WASM_BASE_URL =
  import.meta.env.VITE_MEDIAPIPE_WASM_BASE_URL ||
  `${PUBLIC_BASE_URL}/mediapipe/tasks-vision/wasm`
const MEDIAPIPE_FACE_LANDMARKER_MODEL_URL =
  import.meta.env.VITE_MEDIAPIPE_FACE_LANDMARKER_MODEL_URL ||
  `${PUBLIC_BASE_URL}/mediapipe/models/face_landmarker/face_landmarker.task`

const LEFT_EYE_INDICES = [33, 133, 159, 145]
const RIGHT_EYE_INDICES = [362, 263, 386, 374]
const POSE_INDICES = {
  noseTip: 1,
  chin: 152,
  forehead: 10,
} as const

function nowIso() {
  return new Date().toISOString()
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function roundMetric(value: number) {
  return Number(value.toFixed(3))
}

function inBounds(value: number) {
  return value >= 0 && value <= 1
}

function validLandmark(landmark: NormalizedLandmark | undefined): landmark is NormalizedLandmark {
  return Boolean(landmark && finiteNumber(landmark.x) && finiteNumber(landmark.y) && inBounds(landmark.x) && inBounds(landmark.y))
}

function averagePoint(landmarks: NormalizedLandmark[], indices: number[]): NormalizedPoint | null {
  const points = indices.map((index) => landmarks[index]).filter(validLandmark)
  if (points.length !== indices.length) {
    return null
  }
  return {
    x: roundMetric(points.reduce((sum, point) => sum + point.x, 0) / points.length),
    y: roundMetric(points.reduce((sum, point) => sum + point.y, 0) / points.length),
  }
}

function pointDistance(first: NormalizedPoint, second: NormalizedPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

export function computeBrightnessContrast(video: HTMLVideoElement): BrightnessContrast {
  if (typeof HTMLMediaElement !== 'undefined' && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return { brightness: null, contrast: null }
  }

  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_SAMPLE_SIZE
  canvas.height = VIDEO_SAMPLE_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    return { brightness: null, contrast: null }
  }

  try {
    context.drawImage(video, 0, 0, VIDEO_SAMPLE_SIZE, VIDEO_SAMPLE_SIZE)
    const data = context.getImageData(0, 0, VIDEO_SAMPLE_SIZE, VIDEO_SAMPLE_SIZE).data
    const luminance: number[] = []
    for (let index = 0; index < data.length; index += 4) {
      luminance.push((0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255)
    }
    const brightness = luminance.reduce((sum, value) => sum + value, 0) / luminance.length
    const variance = luminance.reduce((sum, value) => sum + (value - brightness) ** 2, 0) / luminance.length
    return {
      brightness: roundMetric(brightness),
      contrast: roundMetric(Math.sqrt(variance)),
    }
  } catch {
    return { brightness: null, contrast: null }
  }
}

function selectPrimaryFace(result: FaceLandmarkerResult): NormalizedLandmark[] | null {
  const firstFace = result.faceLandmarks[0]
  if (!firstFace || firstFace.length < MIN_LANDMARK_COUNT_FOR_FACE) {
    return null
  }
  const validCount = firstFace.filter(validLandmark).length
  return validCount >= MIN_LANDMARK_COUNT_FOR_FACE ? firstFace : null
}

function faceBox(landmarks: NormalizedLandmark[]) {
  const valid = landmarks.filter(validLandmark)
  if (valid.length < MIN_LANDMARK_COUNT_FOR_FACE) {
    return null
  }
  const xs = valid.map((landmark) => landmark.x)
  const ys = valid.map((landmark) => landmark.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY
  if (width <= 0 || height <= 0) {
    return null
  }
  return {
    center: {
      x: roundMetric((minX + maxX) / 2),
      y: roundMetric((minY + maxY) / 2),
    },
    size: roundMetric(Math.max(width, height)),
  }
}

function eyesVisible(landmarks: NormalizedLandmark[]) {
  return Boolean(averagePoint(landmarks, LEFT_EYE_INDICES) && averagePoint(landmarks, RIGHT_EYE_INDICES))
}

function estimateHeadPose(landmarks: NormalizedLandmark[]) {
  const leftEye = averagePoint(landmarks, LEFT_EYE_INDICES)
  const rightEye = averagePoint(landmarks, RIGHT_EYE_INDICES)
  const nose = landmarks[POSE_INDICES.noseTip]
  const chin = landmarks[POSE_INDICES.chin]
  const forehead = landmarks[POSE_INDICES.forehead]
  if (!leftEye || !rightEye || !validLandmark(nose) || !validLandmark(chin) || !validLandmark(forehead)) {
    return null
  }

  const eyeDistance = pointDistance(leftEye, rightEye)
  const faceHeight = Math.abs(chin.y - forehead.y)
  if (eyeDistance < MIN_EYE_DISTANCE || faceHeight <= 0) {
    return null
  }

  const eyeMidpoint = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  }
  const rollRadians = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
  const yaw = ((nose.x - eyeMidpoint.x) / eyeDistance) * 35
  const pitch = ((nose.y - eyeMidpoint.y) / faceHeight - 0.35) * 60

  return {
    yaw: roundMetric(yaw),
    pitch: roundMetric(pitch),
    roll: roundMetric((rollRadians * 180) / Math.PI),
  }
}

function observedFpsFromTimestamp(previousObservation: CameraQualityObservation | null, capturedAt: string) {
  if (!previousObservation) {
    return null
  }
  const elapsedMs = Date.parse(capturedAt) - Date.parse(previousObservation.capturedAt)
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return null
  }
  return roundMetric(1000 / elapsedMs)
}

function movementFromFace(
  faceCenter: NormalizedPoint | null,
  faceSize: number | null,
  previousObservation: CameraQualityObservation | null,
) {
  if (!previousObservation || !faceCenter || !previousObservation.faceCenter) {
    return null
  }
  const centerMovement = pointDistance(faceCenter, previousObservation.faceCenter)
  const sizeMovement =
    typeof faceSize === 'number' && typeof previousObservation.faceSize === 'number'
      ? Math.abs(faceSize - previousObservation.faceSize)
      : 0
  return roundMetric(centerMovement + sizeMovement)
}

export function observationFromFaceLandmarkerResult(
  result: FaceLandmarkerResult,
  options: {
    capturedAt?: string
    brightnessContrast?: BrightnessContrast
    previousObservation?: CameraQualityObservation | null
  } = {},
): CameraQualityObservation {
  const capturedAt = options.capturedAt ?? nowIso()
  const brightnessContrast = options.brightnessContrast ?? { brightness: null, contrast: null }
  const landmarks = selectPrimaryFace(result)
  if (!landmarks) {
    return {
      capturedAt,
      faceDetected: false,
      eyesVisible: false,
      faceCenter: null,
      faceSize: null,
      headPose: null,
      brightness: brightnessContrast.brightness,
      contrast: brightnessContrast.contrast,
      observedFps: observedFpsFromTimestamp(options.previousObservation ?? null, capturedAt),
      movement: null,
    }
  }

  const box = faceBox(landmarks)
  const faceCenter = box?.center ?? null
  const faceSize = box?.size ?? null
  return {
    capturedAt,
    faceDetected: true,
    eyesVisible: eyesVisible(landmarks),
    faceCenter,
    faceSize,
    headPose: estimateHeadPose(landmarks),
    brightness: brightnessContrast.brightness,
    contrast: brightnessContrast.contrast,
    observedFps: observedFpsFromTimestamp(options.previousObservation ?? null, capturedAt),
    movement: movementFromFace(faceCenter, faceSize, options.previousObservation ?? null),
  }
}

export function fallbackObservationFromTrackingStatus(
  video: HTMLVideoElement | null,
  trackingStatus: BrowserGazeStatusSnapshot | null,
  _previousObservation: CameraQualityObservation | null,
): CameraQualityObservation {
  const capturedAt = nowIso()
  const validSampleRate =
    trackingStatus && trackingStatus.elapsedMs > 0
      ? trackingStatus.validSampleCount / (trackingStatus.elapsedMs / 1000)
      : null
  const { brightness, contrast } = video
    ? computeBrightnessContrast(video)
    : { brightness: null, contrast: null }

  return {
    capturedAt,
    faceDetected: Boolean(trackingStatus?.latestPoint || trackingStatus?.validSampleCount),
    eyesVisible: trackingStatus?.latestPoint ? true : null,
    faceCenter: null,
    faceSize: null,
    headPose: null,
    brightness,
    contrast,
    observedFps: validSampleRate === null ? null : roundMetric(validSampleRate),
    movement: null,
  }
}

export class MediaPipeCameraObservationExtractor implements CameraObservationExtractor {
  private constructor(private readonly faceLandmarker: FaceLandmarker) {}

  static async create() {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL)
    const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFacialTransformationMatrixes: false,
      outputFaceBlendshapes: false,
    })
    return new MediaPipeCameraObservationExtractor(faceLandmarker)
  }

  sample(video: HTMLVideoElement, previousObservation: CameraQualityObservation | null): CameraQualityObservation {
    const capturedAt = nowIso()
    const result = this.faceLandmarker.detectForVideo(video, performance.now())
    return observationFromFaceLandmarkerResult(result, {
      capturedAt,
      brightnessContrast: computeBrightnessContrast(video),
      previousObservation,
    })
  }

  dispose() {
    this.faceLandmarker.close()
  }
}
