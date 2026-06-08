import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  cameraQualityThresholds,
  createCameraQualityBaseline,
  evaluateCameraReadiness,
  type CameraQualityBaseline,
  type CameraQualityObservation,
  type CameraReadinessResult,
} from './cameraQuality'
import {
  fallbackObservationFromTrackingStatus,
  MediaPipeCameraObservationExtractor,
  type CameraObservationExtractor,
} from './cameraObservationExtractor'
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
  warning: string | null
  captureBaseline: () => CameraQualityBaseline | null
}

const SAMPLE_INTERVAL_MS = 250

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

export function useCameraReadiness({
  enabled,
  trackingStatus,
}: UseCameraReadinessOptions): CameraReadinessHookState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const extractorRef = useRef<CameraObservationExtractor | null>(null)
  const extractorFailedRef = useRef(false)
  const stableSinceRef = useRef<number | null>(null)
  const [observation, setObservation] = useState<CameraQualityObservation | null>(null)
  const observationRef = useRef<CameraQualityObservation | null>(null)
  const [readiness, setReadiness] = useState<CameraReadinessResult | null>(null)
  const readinessRef = useRef<CameraReadinessResult | null>(null)
  const [baseline, setBaseline] = useState<CameraQualityBaseline | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

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
      extractorRef.current?.dispose()
      extractorRef.current = null
      extractorFailedRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || extractorRef.current || extractorFailedRef.current) {
      return
    }

    let cancelled = false
    void MediaPipeCameraObservationExtractor.create()
      .then((extractor) => {
        if (cancelled) {
          extractor.dispose()
          return
        }
        extractorRef.current = extractor
        setWarning(null)
      })
      .catch(() => {
        extractorFailedRef.current = true
        setWarning('Direct camera setup checks are unavailable. Using lower-fidelity browser gaze setup signals.')
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      stableSinceRef.current = null
      return
    }

    const intervalId = window.setInterval(() => {
      const nextObservation =
        extractorRef.current && videoRef.current
          ? extractorRef.current.sample(videoRef.current, observationRef.current)
          : fallbackObservationFromTrackingStatus(videoRef.current, trackingStatus, observationRef.current)
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
    warning,
    captureBaseline,
  }
}
