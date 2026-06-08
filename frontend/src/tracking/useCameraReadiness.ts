import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  cameraQualityThresholds,
  createCameraQualityBaseline,
  evaluateCameraReadiness,
  type CameraQualityBaseline,
  type CameraQualityObservation,
  type CameraReadinessResult,
} from './cameraQuality'
import type { BrowserGazeStatusSnapshot } from './webgazerStatus'

type UseCameraReadinessOptions = {
  enabled: boolean
  trackingStatus: BrowserGazeStatusSnapshot | null
}

type CameraReadinessHookState = {
  videoRef: RefObject<HTMLVideoElement | null>
  observation: CameraQualityObservation | null
  readiness: CameraReadinessResult | null
  baseline: CameraQualityBaseline | null
  error: string | null
  captureBaseline: () => CameraQualityBaseline | null
}

const SAMPLE_INTERVAL_MS = 250
const VIDEO_SAMPLE_SIZE = 24

function nowIso() {
  return new Date().toISOString()
}

function findExistingCameraVideo() {
  if (typeof document === 'undefined') {
    return null
  }
  return (
    document.querySelector<HTMLVideoElement>('#webgazerVideoFeed') ??
    document.querySelector<HTMLVideoElement>('video[id*="webgazer" i]') ??
    document.querySelector<HTMLVideoElement>('video')
  )
}

function computeBrightnessContrast(video: HTMLVideoElement) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
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
      brightness: Number(brightness.toFixed(3)),
      contrast: Number(Math.sqrt(variance).toFixed(3)),
    }
  } catch {
    return { brightness: null, contrast: null }
  }
}

function createObservation(
  video: HTMLVideoElement | null,
  trackingStatus: BrowserGazeStatusSnapshot | null,
  previousObservation: CameraQualityObservation | null,
): CameraQualityObservation {
  const faceCenter = trackingStatus?.latestPoint ?? null
  const movement =
    faceCenter && previousObservation?.faceCenter
      ? Math.hypot(faceCenter.x - previousObservation.faceCenter.x, faceCenter.y - previousObservation.faceCenter.y)
      : null
  const validSampleRate =
    trackingStatus && trackingStatus.elapsedMs > 0
      ? trackingStatus.validSampleCount / (trackingStatus.elapsedMs / 1000)
      : null
  const { brightness, contrast } = video
    ? computeBrightnessContrast(video)
    : { brightness: null, contrast: null }

  return {
    capturedAt: nowIso(),
    faceDetected: Boolean(trackingStatus?.latestPoint || trackingStatus?.validSampleCount),
    eyesVisible: trackingStatus?.latestPoint ? true : null,
    faceCenter,
    faceSize: null,
    headPose: null,
    brightness,
    contrast,
    observedFps: validSampleRate === null ? null : Number(validSampleRate.toFixed(3)),
    movement: movement === null ? null : Number(movement.toFixed(3)),
  }
}

export function useCameraReadiness({
  enabled,
  trackingStatus,
}: UseCameraReadinessOptions): CameraReadinessHookState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stableSinceRef = useRef<number | null>(null)
  const [observation, setObservation] = useState<CameraQualityObservation | null>(null)
  const observationRef = useRef<CameraQualityObservation | null>(null)
  const [readiness, setReadiness] = useState<CameraReadinessResult | null>(null)
  const readinessRef = useRef<CameraReadinessResult | null>(null)
  const [baseline, setBaseline] = useState<CameraQualityBaseline | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    async function attachCamera() {
      const existingVideo = findExistingCameraVideo()
      if (existingVideo) {
        videoRef.current = existingVideo
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.muted = true
          videoRef.current.playsInline = true
          await videoRef.current.play()
        }
      } catch (cameraError) {
        const message = cameraError instanceof Error ? cameraError.message : 'Camera preview is unavailable.'
        setError(message)
      }
    }

    void attachCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      stableSinceRef.current = null
      return
    }

    const intervalId = window.setInterval(() => {
      const nextObservation = createObservation(videoRef.current, trackingStatus, observationRef.current)
      const prelim = evaluateCameraReadiness(nextObservation, cameraQualityThresholds.stableWindowMs)
      const now = Date.now()
      if (prelim.flags.includes('unstable_position')) {
        stableSinceRef.current = null
      } else if (stableSinceRef.current === null) {
        stableSinceRef.current = now
      }
      const stableForMs = stableSinceRef.current === null ? 0 : now - stableSinceRef.current
      const nextReadiness = evaluateCameraReadiness(nextObservation, stableForMs)

      observationRef.current = nextObservation
      readinessRef.current = nextReadiness
      setObservation(nextObservation)
      setReadiness(nextReadiness)
    }, SAMPLE_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [enabled, trackingStatus])

  function captureBaseline() {
    if (!observationRef.current || !readinessRef.current) {
      return null
    }
    const nextBaseline = createCameraQualityBaseline(observationRef.current, readinessRef.current.score)
    setBaseline(nextBaseline)
    return nextBaseline
  }

  return {
    videoRef,
    observation,
    readiness,
    baseline,
    error,
    captureBaseline,
  }
}
