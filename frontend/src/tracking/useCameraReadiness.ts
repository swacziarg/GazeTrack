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
const EXTRACTOR_RETRY_INTERVAL_MS = 2000

function findExistingCameraStream(previewVideo: HTMLVideoElement | null) {
  if (typeof document === 'undefined') {
    return null
  }
  const candidateVideos = [
    document.querySelector<HTMLVideoElement>('#webgazerVideoFeed'),
    ...Array.from(document.querySelectorAll<HTMLVideoElement>('video[id*="webgazer" i]')),
  ]

  for (const video of candidateVideos) {
    if (!video || video === previewVideo || !(video.srcObject instanceof MediaStream)) {
      continue
    }
    if (video.srcObject.getVideoTracks().some((track) => track.readyState === 'live')) {
      return video.srcObject
    }
  }

  return null
}

async function attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream) {
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
}

export function useCameraReadiness({
  enabled,
  trackingStatus,
}: UseCameraReadinessOptions): CameraReadinessHookState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const extractorRef = useRef<CameraObservationExtractor | null>(null)
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
      setError(null)
      const previewVideo = videoRef.current
      if (!previewVideo) {
        return
      }

      try {
        const existingStream = findExistingCameraStream(previewVideo)
        if (existingStream) {
          await attachStreamToVideo(previewVideo, existingStream)
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        await attachStreamToVideo(previewVideo, stream)
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
      return
    }

    let cancelled = false
    let retryId: number | null = null

    function scheduleRetry() {
      retryId = window.setTimeout(() => {
        void initializeExtractor()
      }, EXTRACTOR_RETRY_INTERVAL_MS)
    }

    async function initializeExtractor() {
      if (cancelled || extractorRef.current) {
        return
      }

      try {
        const extractor = await MediaPipeCameraObservationExtractor.create()
        if (cancelled) {
          extractor.dispose()
          return
        }
        extractorRef.current = extractor
        setWarning(null)
      } catch {
        if (cancelled) {
          return
        }
        setWarning('Direct camera setup checks are starting. Using lower-fidelity browser gaze setup signals for now.')
        scheduleRetry()
      }
    }

    setWarning(null)
    void initializeExtractor()

    return () => {
      cancelled = true
      if (retryId !== null) {
        window.clearTimeout(retryId)
      }
      extractorRef.current?.dispose()
      extractorRef.current = null
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
