import { useEffect, useMemo, useRef, useState } from 'react'
import { ingestSessionEvents, type EventIngestResult } from './api/events'
import { fetchBackendHealth, type BackendHealth } from './api/health'
import { fetchSessionReport, type BackendReportResult } from './api/reports'
import {
  createStudySession,
  fetchCaptureConfig,
  fetchStudySetup,
  saveStudyConfiguration,
  type CaptureConfigResult,
  type StudySetupResult,
} from './api/studies'
import { AoiBreakdown } from './components/AoiBreakdown'
import { BackendReport } from './components/BackendReport'
import { BrowserGazeStatusPanel } from './components/BrowserGazeStatusPanel'
import { CameraReadinessGate } from './components/CameraReadinessGate'
import { DemoTaskSurface } from './components/DemoTaskSurface'
import { DemoReport } from './components/DemoReport'
import { DisclosureCard } from './components/DisclosureCard'
import { EventLog } from './components/EventLog'
import { GazeDebugOverlay } from './components/GazeDebugOverlay'
import { GazePathPreview } from './components/GazePathPreview'
import { SessionControls, type SessionPhase } from './components/SessionControls'
import { StudySetupWizard } from './components/StudySetupWizard'
import { SyntheticHeatmapPreview } from './components/SyntheticHeatmapPreview'
import { TrackerModePanel } from './components/TrackerModePanel'
import { defaultStudyBuilderConfig, type StudyBuilderAoi, type StudyBuilderConfig } from './data/demoStudy'
import { countCalibrationEvents, type MockStudyEvent, type SyntheticTelemetryMode } from './lib/mockEvents'
import { generateDemoReport } from './lib/mockReport'
import {
  backendSetupToBuilderConfig,
  toDemoStudy,
  toStudyConfigurationPayload,
  toSyntheticStudyConfig,
} from './lib/studyConfig'
import {
  WebGazerTracker,
  browserCalibrationTargets,
  createTrackerProvider,
  getTrackerOptions,
  type BrowserGazeStatusSnapshot,
  type CalibrationSummary,
  type TrackerId,
  type TrackerStatus,
} from './tracking'
import { useCameraReadiness } from './tracking/useCameraReadiness'

type ActiveSection = 'setup' | 'run' | 'report'

const initialHealth: BackendHealth = {
  ok: false,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  message: 'Backend health check has not run yet.',
}

const DEMO_SESSION_ID = '11111111-1111-4111-8111-111111111111'
const WEBGAZER_CALIBRATION_PASSES = 5

function createBrowserGazeStatusSnapshot(
  trackerState: TrackerStatus,
  message: string | null = null,
): BrowserGazeStatusSnapshot {
  return {
    trackerState,
    sampleCount: 0,
    validSampleCount: 0,
    missingPredictionCount: 0,
    lowConfidenceCount: 0,
    elapsedMs: 0,
    latestPoint: null,
    message,
  }
}

function createDemoSessionId() {
  return window.crypto?.randomUUID?.() ?? DEMO_SESSION_ID
}

function backendStatusClass(isLoading: boolean, health: BackendHealth) {
  if (isLoading) {
    return 'pending'
  }

  return health.ok ? 'ok' : 'error'
}

function backendStatusLabel(isLoading: boolean, health: BackendHealth) {
  if (isLoading) {
    return 'Checking'
  }

  return health.ok ? 'Online' : 'Offline'
}

function getRunStatusLabel(phase: SessionPhase) {
  const labels: Record<SessionPhase, string> = {
    preview: 'Not started',
    detail: 'Ready',
    camera_readiness: 'Camera setup',
    calibration: 'Calibration',
    active: 'Running',
    completed: 'Complete',
  }

  return labels[phase]
}

function WebGazerCalibrationScreen({
  eventCount,
  onRunCalibration,
}: {
  eventCount: number
  onRunCalibration: () => void
}) {
  return (
    <section className="webgazer-fullscreen-calibration" aria-label="Full-screen browser gaze calibration">
      <div className="fullscreen-calibration-copy">
        <p className="eyebrow">Browser gaze setup</p>
        <h2>Calibrate across the full viewport</h2>
        <p>
          Keep your head still, look directly at each target, then click it. The sequence runs{' '}
          {WEBGAZER_CALIBRATION_PASSES} passes over {browserCalibrationTargets.length} points before returning to the demo.
        </p>
        <dl className="session-stats compact-stats">
          <div>
            <dt>Targets</dt>
            <dd>{browserCalibrationTargets.length}</dd>
          </div>
          <div>
            <dt>Passes</dt>
            <dd>{WEBGAZER_CALIBRATION_PASSES}</dd>
          </div>
          <div>
            <dt>Clicks</dt>
            <dd>{browserCalibrationTargets.length * WEBGAZER_CALIBRATION_PASSES}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{eventCount}</dd>
          </div>
        </dl>
        <button type="button" className="primary-button" onClick={onRunCalibration}>
          Start full-screen calibration
        </button>
      </div>
      <div className="fullscreen-calibration-map" aria-hidden="true">
        {browserCalibrationTargets.map((target, index) => (
          <span
            className="fullscreen-calibration-target"
            key={`${target.x}-${target.y}`}
            style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
          >
            {index + 1}
          </span>
        ))}
      </div>
    </section>
  )
}

function getIngestStatusLabel(ingestResult: EventIngestResult | null, isIngestingEvents: boolean) {
  if (isIngestingEvents) {
    return 'Sending'
  }

  if (!ingestResult) {
    return 'Pending'
  }

  if (ingestResult.ok) {
    return 'Accepted'
  }

  return ingestResult.backendAvailable ? 'Rejected' : 'Unavailable'
}

function getIngestStatusClass(ingestResult: EventIngestResult | null, isIngestingEvents: boolean) {
  if (isIngestingEvents || !ingestResult) {
    return 'pending'
  }

  return ingestResult.ok ? 'ok' : 'error'
}

function buildCaptureSnippet(captureConfigResult: CaptureConfigResult | null) {
  const config = captureConfigResult?.config
  const apiBaseUrl = captureConfigResult?.apiBaseUrl ?? initialHealth.apiBaseUrl
  if (!config) {
    return null
  }

  return `<script>
  window.GazeTrackConfig = {
    apiBaseUrl: "${apiBaseUrl}",
    studyId: "${config.study_id}",
    captureToken: "${config.capture_token}"
  }
</script>
<script src="${apiBaseUrl}/gazetrack-capture.js" async></script>`
}

function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('setup')
  const [backendHealth, setBackendHealth] = useState<BackendHealth>(initialHealth)
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('preview')
  const [qualityMode, setQualityMode] = useState<SyntheticTelemetryMode>('healthy')
  const [demoSessionId, setDemoSessionId] = useState(DEMO_SESSION_ID)
  const [visibleEventCount, setVisibleEventCount] = useState(0)
  const [isIngestingEvents, setIsIngestingEvents] = useState(false)
  const [ingestResult, setIngestResult] = useState<EventIngestResult | null>(null)
  const [isFetchingBackendReport, setIsFetchingBackendReport] = useState(false)
  const [backendReportResult, setBackendReportResult] = useState<BackendReportResult | null>(null)
  const [studySetupResult, setStudySetupResult] = useState<StudySetupResult | null>(null)
  const [studySaveResult, setStudySaveResult] = useState<StudySetupResult | null>(null)
  const [captureConfigResult, setCaptureConfigResult] = useState<CaptureConfigResult | null>(null)
  const [isFetchingStudySetup, setIsFetchingStudySetup] = useState(true)
  const [studyBuilderConfig, setStudyBuilderConfig] = useState<StudyBuilderConfig>(defaultStudyBuilderConfig)
  const [isSavingStudy, setIsSavingStudy] = useState(false)
  const [trackerId, setTrackerId] = useState<TrackerId>('synthetic')
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('idle')
  const [trackerAvailability, setTrackerAvailability] = useState('Synthetic tracker available')
  const [webGazerConsentGranted, setWebGazerConsentGranted] = useState(false)
  const [webGazerCalibrationNotice, setWebGazerCalibrationNotice] = useState<string | null>(null)
  const [webGazerCalibrationSummary, setWebGazerCalibrationSummary] = useState<CalibrationSummary | null>(null)
  const [webGazerEvents, setWebGazerEvents] = useState<MockStudyEvent[]>([])
  const [webGazerTrackingStatus, setWebGazerTrackingStatus] = useState<BrowserGazeStatusSnapshot | null>(null)
  const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(true)
  const webGazerTrackerRef = useRef<WebGazerTracker | null>(null)
  const demoTaskSurfaceRef = useRef<HTMLDivElement | null>(null)
  const cameraReadiness = useCameraReadiness({
    enabled:
      trackerId === 'webgazer' &&
      webGazerConsentGranted &&
      (sessionPhase === 'camera_readiness' || sessionPhase === 'calibration' || sessionPhase === 'active'),
    trackingStatus: webGazerTrackingStatus,
  })
  const trackerOptions = useMemo(() => getTrackerOptions(), [])
  const configuredDemoStudy = useMemo(() => toDemoStudy(studyBuilderConfig), [studyBuilderConfig])
  const syntheticStudyConfig = useMemo(() => toSyntheticStudyConfig(studyBuilderConfig), [studyBuilderConfig])
  const syntheticTracker = useMemo(
    () => createTrackerProvider('synthetic', { syntheticMode: qualityMode, syntheticStudyConfig }),
    [qualityMode, syntheticStudyConfig],
  )
  const syntheticEvents = useMemo(() => syntheticTracker.getEvents(), [syntheticTracker])
  const trackerEvents = trackerId === 'synthetic' ? syntheticEvents : webGazerEvents
  const calibrationEventCount = useMemo(() => countCalibrationEvents(trackerEvents), [trackerEvents])
  const visibleEvents = trackerEvents.slice(0, visibleEventCount)
  const demoReport = useMemo(() => generateDemoReport(trackerEvents), [trackerEvents])
  const selectedTrackerOption = trackerOptions.find((option) => option.id === trackerId) ?? trackerOptions[0]
  const canStartSession =
    trackerId === 'synthetic' ||
    (webGazerConsentGranted && (trackerStatus === 'ready' || trackerStatus === 'stopped'))
  const displayedTotalEventCount =
    trackerId === 'synthetic' ? trackerEvents.length : Math.max(trackerEvents.length, visibleEventCount)
  const calibrationComplete =
    (sessionPhase === 'active' || sessionPhase === 'completed') && calibrationEventCount > 0
  const elapsedSeconds =
    trackerId === 'webgazer'
      ? (webGazerTrackingStatus?.elapsedMs ?? 0) / 1000
      : visibleEvents.length > 1
        ? (Date.parse(visibleEvents[visibleEvents.length - 1].timestamp) - Date.parse(visibleEvents[0].timestamp)) /
          1000
        : 0
  const isFullscreenRun =
    activeSection === 'run' && (sessionPhase === 'active' || (trackerId === 'webgazer' && sessionPhase === 'calibration'))
  const captureSnippet = buildCaptureSnippet(captureConfigResult)

  useEffect(() => {
    let isMounted = true

    async function loadBackendState() {
      const [healthResult, studySetup] = await Promise.all([fetchBackendHealth(), fetchStudySetup()])
      if (isMounted) {
        setBackendHealth(healthResult)
        setStudySetupResult(studySetup)
        if (studySetup.ok && studySetup.study) {
          setStudyBuilderConfig(backendSetupToBuilderConfig(studySetup.study, studySetup.tasks, studySetup.aois))
          const captureConfig = await fetchCaptureConfig(studySetup.study.study_id)
          if (isMounted) {
            setCaptureConfigResult(captureConfig)
          }
        }
        setIsCheckingHealth(false)
        setIsFetchingStudySetup(false)
      }
    }

    void loadBackendState()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (sessionPhase !== 'active' || trackerId !== 'synthetic' || visibleEventCount >= trackerEvents.length) {
      return
    }

    const intervalId = window.setInterval(() => {
      setVisibleEventCount((currentCount) => Math.min(currentCount + 1, trackerEvents.length))
    }, 120)

    return () => window.clearInterval(intervalId)
  }, [trackerEvents.length, sessionPhase, trackerId, visibleEventCount])

  useEffect(() => {
    if (trackerId !== 'webgazer' || sessionPhase === 'preview') {
      return
    }

    const intervalId = window.setInterval(() => {
      const tracker = webGazerTrackerRef.current
      const events = tracker?.getEvents() ?? []
      const status = tracker?.getTrackingStatus() ?? null
      setWebGazerEvents(events)
      setVisibleEventCount(events.length)
      if (status) {
        setWebGazerTrackingStatus(status)
        setTrackerStatus(status.trackerState)
      }
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [sessionPhase, trackerId])

  useEffect(() => {
    if (trackerId !== 'webgazer') {
      return
    }

    const drift = webGazerTrackerRef.current?.updateCameraQualityObservation(cameraReadiness.observation) ?? null
    if (drift?.trackingQuality === 'low') {
      setWebGazerCalibrationNotice('Tracking quality changed. Treat subsequent gaze samples as lower quality.')
    }
  }, [cameraReadiness.observation, trackerId])

  useEffect(() => {
    return () => {
      webGazerTrackerRef.current?.dispose()
    }
  }, [])

  function openDemoStudy() {
    setActiveSection('run')
    setSessionPhase('detail')
    setVisibleEventCount(0)
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)
    setTrackerStatus(trackerId === 'webgazer' && !webGazerConsentGranted ? 'permission_needed' : 'idle')
  }

  function startMockSession() {
    setDemoSessionId(createDemoSessionId())
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)

    if (trackerId === 'webgazer') {
      if (!webGazerConsentGranted || !webGazerTrackerRef.current) {
        setTrackerStatus('permission_needed')
        setWebGazerTrackingStatus(createBrowserGazeStatusSnapshot('permission_needed'))
        return
      }

      void webGazerTrackerRef.current
        .startSession({ taskPrompt: configuredDemoStudy.taskPrompt, studyConfig: syntheticStudyConfig })
        .then(() => {
          const tracker = webGazerTrackerRef.current
          const events = tracker?.getEvents() ?? []
          const status = tracker?.getTrackingStatus()
          setWebGazerEvents(events)
          setVisibleEventCount(events.length)
          setWebGazerTrackingStatus(
            status ? { ...status, trackerState: 'ready' } : createBrowserGazeStatusSnapshot('ready'),
          )
          setTrackerStatus('ready')
          setSessionPhase('camera_readiness')
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Browser gaze could not start.'
          setTrackerStatus('error')
          setTrackerAvailability(message)
          setWebGazerTrackingStatus(createBrowserGazeStatusSnapshot('error', message))
        })
      return
    }

    void syntheticTracker.startSession({ mode: qualityMode, studyConfig: syntheticStudyConfig })
    setTrackerStatus('ready')
    setSessionPhase('calibration')
    setVisibleEventCount(1)
  }

  function runSyntheticCalibration() {
    if (trackerId === 'webgazer') {
      void webGazerTrackerRef.current
        ?.runCalibration({
          calibrationPasses: WEBGAZER_CALIBRATION_PASSES,
          targets: browserCalibrationTargets,
        })
        .then(() => {
          const events = webGazerTrackerRef.current?.getEvents() ?? []
          const summary = webGazerTrackerRef.current?.getCalibrationSummary()
          setWebGazerEvents(events)
          setVisibleEventCount(events.length)
          setWebGazerCalibrationNotice(summary?.warning ?? null)
          setWebGazerCalibrationSummary(summary ?? null)
          setWebGazerTrackingStatus(webGazerTrackerRef.current?.getTrackingStatus() ?? null)
          setTrackerStatus('active')
          setSessionPhase('active')
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Browser calibration failed.'
          setTrackerStatus('error')
          setTrackerAvailability(message)
          setWebGazerTrackingStatus(createBrowserGazeStatusSnapshot('error', message))
        })
      return
    }

    setSessionPhase('active')
    setTrackerStatus('active')
    setVisibleEventCount(Math.min(1 + calibrationEventCount, trackerEvents.length))
  }

  function continueFromCameraReadiness() {
    const baseline = cameraReadiness.captureBaseline()
    webGazerTrackerRef.current?.setCameraQualityBaseline(baseline)
    setWebGazerCalibrationNotice(null)
    setTrackerStatus('calibrating')
    setWebGazerTrackingStatus(
      webGazerTrackerRef.current?.getTrackingStatus() ?? createBrowserGazeStatusSnapshot('calibrating'),
    )
    setSessionPhase('calibration')
  }

  function updateQualityMode(mode: SyntheticTelemetryMode) {
    setQualityMode(mode)
    setSessionPhase('detail')
    setVisibleEventCount(0)
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)
    setTrackerStatus('idle')
  }

  function handleStudyBuilderChange(nextConfig: StudyBuilderConfig) {
    setStudyBuilderConfig(nextConfig)
    setSessionPhase((currentPhase) => (currentPhase === 'preview' ? currentPhase : 'detail'))
    setVisibleEventCount(0)
    setIngestResult(null)
    setBackendReportResult(null)
    setTrackerStatus(trackerId === 'webgazer' && !webGazerConsentGranted ? 'permission_needed' : 'idle')
    setWebGazerCalibrationNotice(null)
    setWebGazerCalibrationSummary(null)
  }

  function handleAoiChange(index: number, nextAoi: StudyBuilderAoi) {
    handleStudyBuilderChange({
      ...studyBuilderConfig,
      aois: studyBuilderConfig.aois.map((aoi, aoiIndex) => (aoiIndex === index ? nextAoi : aoi)),
    })
  }

  function saveConfiguredStudy(mode: 'update' | 'create') {
    setIsSavingStudy(true)
    void saveStudyConfiguration(
      toStudyConfigurationPayload(studyBuilderConfig),
      mode === 'update' ? studySetupResult?.study?.study_id : null,
    )
      .then((result) => {
        setStudySaveResult(result)
        if (result.ok && result.study) {
          setStudySetupResult(result)
          setStudyBuilderConfig(backendSetupToBuilderConfig(result.study, result.tasks, result.aois))
          void fetchCaptureConfig(result.study.study_id).then(setCaptureConfigResult)
        }
      })
      .finally(() => {
        setIsSavingStudy(false)
      })
  }

  function completeMockSession() {
    if (trackerId === 'webgazer') {
      void webGazerTrackerRef.current?.stopSession().then((events) => {
        setWebGazerEvents(events)
        setTrackerStatus('stopped')
        setWebGazerTrackingStatus(
          webGazerTrackerRef.current?.getTrackingStatus() ?? createBrowserGazeStatusSnapshot('stopped'),
        )
        completeSessionWithEvents(events)
      })
      return
    }

    completeSessionWithEvents(trackerEvents)
  }

  function completeSessionWithEvents(events: MockStudyEvent[]) {
    if (trackerId === 'synthetic') {
      setTrackerStatus('stopped')
    }
    setVisibleEventCount(events.length)
    setSessionPhase('completed')
    setActiveSection('report')
    setIngestResult(null)
    setBackendReportResult(null)
    setIsFetchingBackendReport(false)
    setIsIngestingEvents(true)

    void (async () => {
      const persistedStudyId = studySetupResult?.ok ? studySetupResult.study?.study_id : null
      const sessionResult = persistedStudyId ? await createStudySession(persistedStudyId) : null
      const sessionId = sessionResult?.sessionId ?? demoSessionId
      setDemoSessionId(sessionId)

      const result = await ingestSessionEvents(sessionId, events)
      setIngestResult(result)
      setIsIngestingEvents(false)

      if (result.ok) {
        setIsFetchingBackendReport(true)
        try {
          const reportResult = await fetchSessionReport(sessionId)
          setBackendReportResult(reportResult)
        } finally {
          setIsFetchingBackendReport(false)
        }
      }
    })().catch(() => {
      setIngestResult({
        ok: false,
        backendAvailable: false,
        apiBaseUrl: initialHealth.apiBaseUrl,
        response: {
          session_id: demoSessionId,
          accepted_count: 0,
          rejected_count: 0,
          stored_count_for_session: 0,
          note: 'Backend unavailable - showing local demo report only.',
          rejected_reasons: [],
        },
      })
      setIsIngestingEvents(false)
      setIsFetchingBackendReport(false)
    })
  }

  function handleTrackerChange(nextTrackerId: TrackerId) {
    if (nextTrackerId === trackerId) {
      return
    }

    webGazerTrackerRef.current?.dispose()
    webGazerTrackerRef.current = null
    setTrackerId(nextTrackerId)
    setSessionPhase('detail')
    setActiveSection('run')
    setVisibleEventCount(0)
    setIngestResult(null)
    setBackendReportResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setWebGazerCalibrationNotice(null)
    setWebGazerCalibrationSummary(null)

    if (nextTrackerId === 'webgazer') {
      setWebGazerConsentGranted(false)
      setTrackerStatus('permission_needed')
      setTrackerAvailability('Waiting for consent before checking WebGazer')
      setWebGazerTrackingStatus(createBrowserGazeStatusSnapshot('permission_needed'))
    } else {
      setTrackerStatus('idle')
      setTrackerAvailability('Synthetic tracker available')
      setWebGazerEvents([])
      setWebGazerCalibrationNotice(null)
      setWebGazerCalibrationSummary(null)
      setWebGazerTrackingStatus(null)
    }
  }

  function cancelToSyntheticTracker() {
    handleTrackerChange('synthetic')
  }

  function turnOffWebGazer() {
    const events = webGazerTrackerRef.current?.getEvents() ?? webGazerEvents

    webGazerTrackerRef.current?.dispose()
    webGazerTrackerRef.current = null
    setWebGazerConsentGranted(false)
    setTrackerStatus('idle')
    setTrackerAvailability('Browser gaze is off. Consent again to restart WebGazer.')
    setWebGazerTrackingStatus(createBrowserGazeStatusSnapshot('idle'))
    setDebugOverlayEnabled(false)
    setWebGazerEvents(events)
    setVisibleEventCount(events.length)

    if (sessionPhase === 'camera_readiness' || sessionPhase === 'calibration' || sessionPhase === 'active') {
      setSessionPhase('detail')
      setIngestResult(null)
      setBackendReportResult(null)
      setIsIngestingEvents(false)
      setIsFetchingBackendReport(false)
    }
  }

  function grantWebGazerConsent() {
    webGazerTrackerRef.current?.dispose()
    const tracker = new WebGazerTracker()
    webGazerTrackerRef.current = tracker
    setWebGazerConsentGranted(true)
    setTrackerStatus('loading')
    setTrackerAvailability('Checking browser tracker')
    setWebGazerCalibrationNotice(null)
    setWebGazerCalibrationSummary(null)
    setWebGazerTrackingStatus(createBrowserGazeStatusSnapshot('loading'))
    setDebugOverlayEnabled(true)

    void tracker
      .initialize()
      .then(() => {
        setTrackerStatus('ready')
        setTrackerAvailability('WebGazer global available')
        setWebGazerTrackingStatus(tracker.getTrackingStatus())
      })
      .catch((error: unknown) => {
        const status = tracker.getTrackingStatus()
        setTrackerStatus(status.trackerState)
        setTrackerAvailability(error instanceof Error ? error.message : 'WebGazer is unavailable')
        setWebGazerTrackingStatus(status)
      })
  }

  return (
    <main className={`app-shell ${isFullscreenRun ? 'app-shell-fullscreen' : ''}`}>
      {trackerId === 'webgazer' ? (
        <GazeDebugOverlay enabled={debugOverlayEnabled} status={webGazerTrackingStatus} />
      ) : null}

      {!isFullscreenRun ? <aside className="sidebar" aria-label="GazeTrack workflow">
        <div className="brand-block">
          <p className="eyebrow">Privacy-first UX telemetry</p>
          <h1>GazeTrack</h1>
          <p>Synthetic mode is the recommended demo path. GazeTrack stores privacy-safe telemetry only, not webcam video.</p>
        </div>

        <nav className="section-nav" aria-label="Workflow sections">
          {(['setup', 'run', 'report'] as const).map((section) => (
            <button
              className={activeSection === section ? 'active' : ''}
              key={section}
              onClick={() => setActiveSection(section)}
              type="button"
            >
              <span>{section === 'setup' ? 'Setup' : section === 'run' ? 'Run' : 'Report'}</span>
              <small>
                {section === 'setup'
                  ? `${studyBuilderConfig.aois.length} regions`
                  : section === 'run'
                    ? getRunStatusLabel(sessionPhase)
                    : backendReportResult?.ok
                      ? 'Generated'
                      : sessionPhase === 'completed'
                        ? 'Processing'
                        : 'Waiting'}
              </small>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className={`status-pill ${backendStatusClass(isCheckingHealth, backendHealth)}`}>
            Backend {backendStatusLabel(isCheckingHealth, backendHealth)}
          </span>
          <span className="status-pill pending">{selectedTrackerOption.label}</span>
          <span className={`status-pill ${getIngestStatusClass(ingestResult, isIngestingEvents)}`}>
            Ingest {getIngestStatusLabel(ingestResult, isIngestingEvents)}
          </span>
        </div>
      </aside> : null}

      <section className="workspace-panel" aria-live="polite">
        {activeSection === 'setup' ? (
          <>
            <div className="workspace-heading">
              <p className="eyebrow">Setup</p>
              <h2>Define the task and key regions</h2>
              <p className="muted">Use plain task context first. Advanced telemetry details stay collapsed.</p>
            </div>

            <section className="compact-guide" aria-label="Demo Guide">
              <span>Demo Guide</span>
              <ol>
                <li>Review the page goal.</li>
                <li>Confirm the task.</li>
                <li>Run the synthetic session.</li>
                <li>Read the visual report.</li>
              </ol>
            </section>

            <DisclosureCard
              defaultOpen
              eyebrow="Study summary"
              id="study-summary"
              status={<span className="status-pill pending">Synthetic demo data</span>}
              title={configuredDemoStudy.name}
            >
              <div className="summary-grid">
                <dl className="summary-list">
                  <div>
                    <dt>Goal</dt>
                    <dd>{studyBuilderConfig.objective}</dd>
                  </div>
                  <div>
                    <dt>Page</dt>
                    <dd>{configuredDemoStudy.pageLabel}</dd>
                  </div>
                  <div>
                    <dt>Task</dt>
                    <dd>{configuredDemoStudy.taskPrompt}</dd>
                  </div>
                </dl>
                <section className="region-summary" aria-label="Key regions">
                  <h3>Key regions</h3>
                  <ul className="aoi-list">
                    {configuredDemoStudy.aois.map((aoi) => (
                      <li key={aoi.name}>
                        <strong>{aoi.name}</strong>
                        <span>{aoi.role}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <button type="button" className="primary-button" onClick={openDemoStudy}>
                Open run
              </button>
            </DisclosureCard>

            <DisclosureCard
              eyebrow="Edit"
              id="setup-wizard"
              status={<span className={`status-pill ${studySaveResult?.ok || studySetupResult?.ok ? 'ok' : 'pending'}`}>Setup</span>}
              title="Setup wizard"
            >
              <StudySetupWizard
                value={studyBuilderConfig}
                persistedStudyId={studySetupResult?.study?.study_id}
                saveResult={studySaveResult ?? studySetupResult}
                isSaving={isSavingStudy}
                onChange={handleStudyBuilderChange}
                onSave={saveConfiguredStudy}
              />
            </DisclosureCard>

            <DisclosureCard
              eyebrow="Real website"
              id="real-site-capture"
              status={<span className={`status-pill ${captureConfigResult?.ok ? 'ok' : 'pending'}`}>Snippet</span>}
              title="Install on a controlled page"
            >
              <p className="privacy-note compact">
                Add this snippet to a page you control. It resolves the five fixed AOIs from
                <code>data-gazetrack-aoi</code> attributes or the saved CSS selectors, then stores telemetry JSON only.
              </p>
              {captureSnippet ? (
                <pre className="snippet-block">
                  <code>{captureSnippet}</code>
                </pre>
              ) : (
                <p className="backend-unavailable compact">
                  {captureConfigResult?.message ?? 'Save the study while the backend is online to generate a capture snippet.'}
                </p>
              )}
              <div className="study-builder-grid">
                <section>
                  <h4>Allowed origin</h4>
                  <p className="muted compact-text">
                    Add the tested page origin to <code>GAZETRACK_CORS_ALLOWED_ORIGINS</code> before running outside localhost.
                  </p>
                </section>
                <section>
                  <h4>Fixed AOI attributes</h4>
                  <ul className="setup-list">
                    {(captureConfigResult?.config?.aois ?? studyBuilderConfig.aois).map((aoi) => {
                      const roleKey = 'role_key' in aoi ? aoi.role_key : (aoi.roleKey ?? '')
                      const selector = 'selector' in aoi ? aoi.selector : aoi.selector
                      return (
                        <li key={roleKey || aoi.label}>
                          <strong>{aoi.label}</strong>
                          <span>
                            <code>data-gazetrack-aoi=&quot;{roleKey}&quot;</code>
                            {selector ? ` or ${selector}` : ''}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </div>
            </DisclosureCard>

            <DisclosureCard
              eyebrow="Advanced"
              id="setup-diagnostics"
              status={<span className={`status-pill ${studySetupResult?.ok ? 'ok' : 'pending'}`}>{isFetchingStudySetup ? 'Loading' : studySetupResult?.ok ? 'SQLite' : 'Local'}</span>}
              title="Saved setup details"
            >
              <p className="privacy-note compact">
                Tasks and key regions are stored as text and normalized rectangles only. No screenshots or raw media are
                accepted by this flow.
              </p>
              <div className="study-builder-grid">
                <section>
                  <h4>{studySetupResult?.study?.name ?? configuredDemoStudy.name}</h4>
                  <p className="muted">{studySetupResult?.study?.objective ?? configuredDemoStudy.taskPrompt}</p>
                  {!studySetupResult?.ok && !isFetchingStudySetup ? (
                    <p className="backend-unavailable compact">{studySetupResult?.message ?? 'Using local demo setup.'}</p>
                  ) : null}
                </section>
                <section>
                  <h4>Tasks</h4>
                  {studySetupResult?.tasks.length ? (
                    <ul className="setup-list">
                      {studySetupResult.tasks.map((task) => (
                        <li key={task.task_id}>
                          <strong>{task.title}</strong>
                          <span>{task.prompt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Backend task setup is not loaded yet.</p>
                  )}
                </section>
                <section>
                  <h4>Persisted key regions</h4>
                  {studySetupResult?.aois.length ? (
                    <ul className="setup-list">
                      {studySetupResult.aois.map((aoi) => (
                        <li key={aoi.aoi_id}>
                          <strong>{aoi.label}</strong>
                          <span>
                            x {aoi.x.toFixed(2)}, y {aoi.y.toFixed(2)}, w {aoi.width.toFixed(2)}, h{' '}
                            {aoi.height.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Backend key regions are not loaded yet.</p>
                  )}
                </section>
              </div>
            </DisclosureCard>

            <DisclosureCard
              eyebrow="Advanced"
              id="backend-diagnostics"
              status={<span className={`status-pill ${backendStatusClass(isCheckingHealth, backendHealth)}`}>{backendStatusLabel(isCheckingHealth, backendHealth)}</span>}
              title="Backend diagnostics"
            >
              <dl className="summary-list">
                <div>
                  <dt>Health</dt>
                  <dd>{isCheckingHealth ? 'Checking backend health endpoint.' : backendHealth.message}</dd>
                </div>
                <div>
                  <dt>Endpoint</dt>
                  <dd className="mono-value">GET {backendHealth.apiBaseUrl}/health</dd>
                </div>
              </dl>
            </DisclosureCard>
          </>
        ) : null}

        {activeSection === 'run' ? (
          <>
            {trackerId === 'webgazer' && sessionPhase === 'camera_readiness' ? (
              <CameraReadinessGate
                videoRef={cameraReadiness.videoRef}
                observation={cameraReadiness.observation}
                readiness={cameraReadiness.readiness}
                baseline={cameraReadiness.baseline}
                error={cameraReadiness.error}
                warning={cameraReadiness.warning}
                onContinue={continueFromCameraReadiness}
                onUseSyntheticDemo={cancelToSyntheticTracker}
              />
            ) : trackerId === 'webgazer' && sessionPhase === 'calibration' ? (
              <WebGazerCalibrationScreen eventCount={visibleEventCount} onRunCalibration={runSyntheticCalibration} />
            ) : sessionPhase === 'active' ? (
              <DemoTaskSurface
                ref={demoTaskSurfaceRef}
                aois={studyBuilderConfig.aois}
                fullscreen
                phase={sessionPhase}
                taskPrompt={configuredDemoStudy.taskPrompt}
                canStartSession={canStartSession}
                onAoiChange={handleAoiChange}
                onStartSession={startMockSession}
                onCompleteSession={completeMockSession}
              />
            ) : (
              <>
                <div className="workspace-heading">
                  <p className="eyebrow">Run</p>
                  <h2>Run the task session</h2>
                  <p className="muted">The default path uses deterministic synthetic telemetry and requests no camera access.</p>
                </div>

                <DisclosureCard
                  defaultOpen
                  eyebrow="Current run"
                  id="run-controls"
                  status={<span className="status-pill pending">{getRunStatusLabel(sessionPhase)}</span>}
                  title="Demo session"
                >
                  <DemoTaskSurface
                    ref={demoTaskSurfaceRef}
                    aois={studyBuilderConfig.aois}
                    phase={sessionPhase}
                    taskPrompt={configuredDemoStudy.taskPrompt}
                    canStartSession={canStartSession}
                    onAoiChange={handleAoiChange}
                    onStartSession={startMockSession}
                    onCompleteSession={completeMockSession}
                  />
                  <SessionControls
                    phase={sessionPhase}
                    trackerId={trackerId}
                    trackerLabel={selectedTrackerOption.label}
                    canStartSession={canStartSession}
                    eventCount={visibleEventCount}
                    totalEventCount={displayedTotalEventCount}
                    elapsedSeconds={elapsedSeconds}
                    taskPrompt={configuredDemoStudy.taskPrompt}
                    qualityMode={qualityMode}
                    calibrationEventCount={calibrationEventCount}
                    calibrationSummary={webGazerCalibrationSummary}
                    trackerNotice={webGazerCalibrationNotice}
                    onQualityModeChange={updateQualityMode}
                    onOpenStudy={openDemoStudy}
                    onStartSession={startMockSession}
                    onRunCalibration={runSyntheticCalibration}
                    onCompleteSession={completeMockSession}
                  />
                </DisclosureCard>

                <DisclosureCard
                  eyebrow="Advanced"
                  id="tracker-details"
                  status={<span className="status-pill pending">{selectedTrackerOption.label}</span>}
                  title="Tracker and calibration details"
                >
                  <TrackerModePanel
                    options={trackerOptions}
                    selectedTrackerId={trackerId}
                    availabilityLabel={trackerAvailability}
                    consentGranted={webGazerConsentGranted}
                    calibrationComplete={calibrationComplete}
                    status={trackerStatus}
                    onTrackerChange={handleTrackerChange}
                    onGrantConsent={grantWebGazerConsent}
                    onCancelToSynthetic={cancelToSyntheticTracker}
                  />
                  {trackerId === 'webgazer' ? (
                    <BrowserGazeStatusPanel
                      status={webGazerTrackingStatus}
                      canTurnOff={webGazerConsentGranted}
                      debugOverlayEnabled={debugOverlayEnabled}
                      onDebugOverlayChange={setDebugOverlayEnabled}
                      onUseSyntheticDemo={cancelToSyntheticTracker}
                      onTurnOff={turnOffWebGazer}
                    />
                  ) : null}
                </DisclosureCard>

                <DisclosureCard
                  eyebrow="Advanced"
                  id="event-log"
                  status={<span className="status-pill pending">{visibleEventCount} events</span>}
                  title="Local event log"
                >
                  <EventLog events={visibleEvents} sourceLabel={selectedTrackerOption.label} />
                </DisclosureCard>
              </>
            )}
          </>
        ) : null}

        {activeSection === 'report' ? (
          <>
            <div className="workspace-heading">
              <p className="eyebrow">Report</p>
              <h2>Results</h2>
              <p className="muted">Visual previews are schematic telemetry views, not video or screenshots.</p>
            </div>

            {sessionPhase === 'completed' ? (
              <>
                <section className="report-overview" aria-labelledby="visual-report-heading">
                  <div className="card-header">
                    <div>
                      <p className="eyebrow">Visual report overview</p>
                      <h3 id="visual-report-heading">What changed attention?</h3>
                    </div>
                    <span className={`status-pill ${getIngestStatusClass(ingestResult, isIngestingEvents)}`}>
                      {getIngestStatusLabel(ingestResult, isIngestingEvents)}
                    </span>
                  </div>
                  <div className="synthetic-visual-grid">
                    <SyntheticHeatmapPreview
                      events={trackerEvents}
                      aois={configuredDemoStudy.aois}
                      telemetrySourceLabel={selectedTrackerOption.label}
                      telemetrySourceIsExperimental={trackerId === 'webgazer'}
                    />
                    <GazePathPreview
                      events={trackerEvents}
                      aois={configuredDemoStudy.aois}
                      telemetrySourceLabel={selectedTrackerOption.label}
                      telemetrySourceIsExperimental={trackerId === 'webgazer'}
                    />
                    <AoiBreakdown
                      events={trackerEvents}
                      aois={configuredDemoStudy.aois}
                      telemetrySourceLabel={selectedTrackerOption.label}
                    />
                  </div>
                  <p className="privacy-note compact">
                    Reports are generated from telemetry only. GazeTrack does not store webcam video, frames, screenshots,
                    image blobs, or base64 media.
                  </p>
                </section>

                <DisclosureCard
                  eyebrow="Advanced"
                  id="local-report-details"
                  status={<span className={`status-pill ${getIngestStatusClass(ingestResult, isIngestingEvents)}`}>Ingest</span>}
                  title="Local metrics and ingest"
                >
                  <DemoReport
                    report={demoReport}
                    events={trackerEvents}
                    aois={configuredDemoStudy.aois}
                    telemetrySourceLabel={selectedTrackerOption.label}
                    telemetrySourceIsExperimental={trackerId === 'webgazer'}
                    ingestResult={ingestResult}
                    isIngestingEvents={isIngestingEvents}
                    showVisuals={false}
                  />
                </DisclosureCard>

                <DisclosureCard
                  eyebrow="Advanced"
                  id="backend-report-details"
                  status={<span className={`status-pill ${backendReportResult?.ok ? 'ok' : 'pending'}`}>{isFetchingBackendReport ? 'Loading' : backendReportResult?.ok ? 'Generated' : 'Pending'}</span>}
                  title="Persisted telemetry report"
                >
                  <BackendReport
                    ingestResult={ingestResult}
                    isFetchingReport={isFetchingBackendReport}
                    reportResult={backendReportResult}
                  />
                </DisclosureCard>
              </>
            ) : (
              <section className="empty-state">
                <h3>Report waiting for a completed run</h3>
                <p>Run the default synthetic session to generate visual results and advanced telemetry details.</p>
                <button type="button" className="primary-button" onClick={openDemoStudy}>
                  Go to run
                </button>
              </section>
            )}
          </>
        ) : null}
      </section>
    </main>
  )
}

export default App
