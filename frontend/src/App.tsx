import { useEffect, useMemo, useRef, useState } from 'react'
import { ingestSessionEvents, type EventIngestResult } from './api/events'
import { fetchBackendHealth, type BackendHealth } from './api/health'
import { fetchSessionReport, type BackendReportResult } from './api/reports'
import {
  createStudySession,
  fetchStudySetup,
  saveStudyConfiguration,
  type StudySetupResult,
} from './api/studies'
import { BackendReport } from './components/BackendReport'
import { BrowserGazeStatusPanel } from './components/BrowserGazeStatusPanel'
import { DemoGuide } from './components/DemoGuide'
import { DemoReport } from './components/DemoReport'
import { EventLog } from './components/EventLog'
import { FlowCard } from './components/FlowCard'
import { GazeDebugOverlay } from './components/GazeDebugOverlay'
import { PlaceholderPanel } from './components/PlaceholderPanel'
import { SessionControls, type SessionPhase } from './components/SessionControls'
import { StatusCard } from './components/StatusCard'
import { StudyBuilder } from './components/StudyBuilder'
import { TrackerModePanel } from './components/TrackerModePanel'
import { defaultStudyBuilderConfig, flowSteps, type StudyBuilderConfig } from './data/demoStudy'
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
  createTrackerProvider,
  getTrackerOptions,
  type BrowserGazeStatusSnapshot,
  type CalibrationSummary,
  type TrackerId,
  type TrackerStatus,
} from './tracking'

const initialHealth: BackendHealth = {
  ok: false,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  message: 'Backend health check has not run yet.',
}

const DEMO_SESSION_ID = '11111111-1111-4111-8111-111111111111'

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

function App() {
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

  useEffect(() => {
    let isMounted = true

    async function loadBackendState() {
      const [healthResult, studySetup] = await Promise.all([fetchBackendHealth(), fetchStudySetup()])
      if (isMounted) {
        setBackendHealth(healthResult)
        setStudySetupResult(studySetup)
        if (studySetup.ok && studySetup.study) {
          setStudyBuilderConfig(backendSetupToBuilderConfig(studySetup.study, studySetup.tasks, studySetup.aois))
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
    return () => {
      webGazerTrackerRef.current?.dispose()
    }
  }, [])

  function openDemoStudy() {
    setSessionPhase('detail')
    setVisibleEventCount(0)
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)
    setTrackerStatus(trackerId === 'webgazer' && !webGazerConsentGranted ? 'permission_needed' : 'idle')
    window.setTimeout(() => {
      document.getElementById('mock-session-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
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
            status ? { ...status, trackerState: 'calibrating' } : createBrowserGazeStatusSnapshot('calibrating'),
          )
          setTrackerStatus('calibrating')
          setSessionPhase('calibration')
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
        ?.runCalibration()
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
          note: 'Backend unavailable — showing local demo report only.',
          rejected_reasons: [],
        },
      })
      setIsIngestingEvents(false)
      setIsFetchingBackendReport(false)
    })

    window.setTimeout(() => {
      document.getElementById('demo-report-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  function handleTrackerChange(nextTrackerId: TrackerId) {
    if (nextTrackerId === trackerId) {
      return
    }

    webGazerTrackerRef.current?.dispose()
    webGazerTrackerRef.current = null
    setTrackerId(nextTrackerId)
    setSessionPhase('detail')
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

    if (sessionPhase === 'calibration' || sessionPhase === 'active') {
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
    <main className="app-shell">
      {trackerId === 'webgazer' ? (
        <GazeDebugOverlay enabled={debugOverlayEnabled} status={webGazerTrackingStatus} />
      ) : null}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Privacy-first UX telemetry demo</p>
          <h1>GazeTrack</h1>
          <p className="subtitle">
            Task-based gaze analytics pipeline with deterministic synthetic telemetry by default and an opt-in
            experimental browser gaze mode for local research.
          </p>
          <p className="privacy-note">
            Synthetic mode is the recommended demo path. GazeTrack stores privacy-safe telemetry only, not webcam video,
            frames, screenshots, image blobs, or base64 media.
          </p>
          <button type="button" className="primary-button" onClick={openDemoStudy}>
            Open demo study
          </button>
        </div>
        <StatusCard health={backendHealth} isLoading={isCheckingHealth} />
      </section>

      <DemoGuide />

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">MVP flow</p>
          <h2>From study setup to report review</h2>
        </div>
        <div className="flow-grid">
          {flowSteps.map((step, index) => (
            <FlowCard key={step} step={index + 1} label={step} />
          ))}
        </div>
      </section>

      <section id="demo-study-preview" className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Synthetic demo data</p>
          <h2>Demo Study Preview</h2>
        </div>

        <div className="study-grid">
          <article className="card study-summary">
            <div className="card-header">
              <h3>{configuredDemoStudy.name}</h3>
              <span className="status-pill pending">Demo</span>
            </div>
            <dl>
              <div>
                <dt>Page</dt>
                <dd>{configuredDemoStudy.pageLabel}</dd>
              </div>
              <div>
                <dt>Task prompt</dt>
                <dd>{configuredDemoStudy.taskPrompt}</dd>
              </div>
              <div>
                <dt>Mock session quality</dt>
                <dd>{configuredDemoStudy.sessionQuality}</dd>
              </div>
            </dl>
            <button type="button" className="primary-button" onClick={openDemoStudy}>
              Open demo study
            </button>
          </article>

          <article className="card">
            <div className="card-header">
              <h3>AOIs / regions</h3>
              <span className="status-pill pending">Demo</span>
            </div>
            <ul className="aoi-list">
              {configuredDemoStudy.aois.map((aoi) => (
                <li key={aoi.name}>
                  <strong>{aoi.name}</strong>
                  <span>{aoi.role}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <StudyBuilder
          value={studyBuilderConfig}
          persistedStudyId={studySetupResult?.study?.study_id}
          saveResult={studySaveResult ?? studySetupResult}
          isSaving={isSavingStudy}
          onChange={handleStudyBuilderChange}
          onSave={saveConfiguredStudy}
        />

        <article className="card study-builder-panel">
          <div className="card-header">
            <div>
              <p className="eyebrow">Study Builder</p>
              <h3>Persisted task and AOI setup</h3>
            </div>
            <span className={`status-pill ${studySetupResult?.ok ? 'ok' : 'pending'}`}>
              {isFetchingStudySetup ? 'Loading' : studySetupResult?.ok ? 'SQLite' : 'Local demo'}
            </span>
          </div>
          <p className="privacy-note compact">
            Tasks and AOIs are persisted as normalized rectangles. These are demo placeholders for synthetic telemetry,
            not screenshot uploads or DOM-derived regions.
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
              <h4>Persisted AOIs</h4>
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
                <p className="muted">Backend AOI setup is not loaded yet.</p>
              )}
            </section>
          </div>
        </article>

        <div className="insight-grid">
          {configuredDemoStudy.insights.map((insight) => (
            <article className="card insight-card" key={insight}>
              <p>{insight}</p>
              <span>Synthetic demo data</span>
            </article>
          ))}
        </div>
      </section>

      {sessionPhase !== 'preview' ? (
        <section id="mock-session-panel" className="section-block">
          <div className="section-heading">
            <p className="eyebrow">Local React state only</p>
            <h2>Mock test session</h2>
          </div>
          <div className="session-grid">
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
            <EventLog events={visibleEvents} sourceLabel={selectedTrackerOption.label} />
          </div>
        </section>
      ) : null}

      {sessionPhase === 'completed' ? (
        <section id="demo-report-panel" className="section-block">
          <DemoReport
            report={demoReport}
            events={trackerEvents}
            aois={configuredDemoStudy.aois}
            telemetrySourceLabel={selectedTrackerOption.label}
            telemetrySourceIsExperimental={trackerId === 'webgazer'}
            ingestResult={ingestResult}
            isIngestingEvents={isIngestingEvents}
          />
          <BackendReport
            ingestResult={ingestResult}
            isFetchingReport={isFetchingBackendReport}
            reportResult={backendReportResult}
          />
        </section>
      ) : null}

      {sessionPhase !== 'completed' ? (
        <section className="section-block">
          <div className="section-heading">
            <p className="eyebrow">Synthetic demo data</p>
            <h2>Visualization placeholders</h2>
          </div>
          <div className="placeholder-grid">
            <PlaceholderPanel
              title="Heatmap preview"
              description="Demo placeholder only. No real heatmap rendering is implemented yet."
            />
            <PlaceholderPanel
              title="Gaze replay preview"
              description="Demo placeholder only. No timeline playback or gaze rendering is implemented yet."
            />
            <PlaceholderPanel
              title="AOI attention breakdown"
              description="Demo placeholder only. No production charting or multi-session AOI analytics are implemented yet."
            />
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
