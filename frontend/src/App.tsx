import { useEffect, useMemo, useState } from 'react'
import { ingestSessionEvents, type EventIngestResult } from './api/events'
import { fetchBackendHealth, type BackendHealth } from './api/health'
import { fetchSessionReport, type BackendReportResult } from './api/reports'
import { fetchStudySetup, type StudySetupResult } from './api/studies'
import { BackendReport } from './components/BackendReport'
import { DemoReport } from './components/DemoReport'
import { EventLog } from './components/EventLog'
import { FlowCard } from './components/FlowCard'
import { PlaceholderPanel } from './components/PlaceholderPanel'
import { SessionControls, type SessionPhase } from './components/SessionControls'
import { StatusCard } from './components/StatusCard'
import { demoStudy, flowSteps } from './data/demoStudy'
import { countCalibrationEvents, generateMockStudyEvents, type SyntheticTelemetryMode } from './lib/mockEvents'
import { generateDemoReport } from './lib/mockReport'

const initialHealth: BackendHealth = {
  ok: false,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  message: 'Backend health check has not run yet.',
}

const DEMO_SESSION_ID = '11111111-1111-4111-8111-111111111111'

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
  const [isFetchingStudySetup, setIsFetchingStudySetup] = useState(true)
  const mockEvents = useMemo(() => generateMockStudyEvents(qualityMode), [qualityMode])
  const calibrationEventCount = useMemo(() => countCalibrationEvents(mockEvents), [mockEvents])
  const visibleEvents = mockEvents.slice(0, visibleEventCount)
  const demoReport = useMemo(() => generateDemoReport(mockEvents), [mockEvents])
  const elapsedSeconds =
    visibleEvents.length > 1
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
    if (sessionPhase !== 'active' || visibleEventCount >= mockEvents.length) {
      return
    }

    const intervalId = window.setInterval(() => {
      setVisibleEventCount((currentCount) => Math.min(currentCount + 1, mockEvents.length))
    }, 120)

    return () => window.clearInterval(intervalId)
  }, [mockEvents.length, sessionPhase, visibleEventCount])

  function openDemoStudy() {
    setSessionPhase('detail')
    setVisibleEventCount(0)
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)
    window.setTimeout(() => {
      document.getElementById('mock-session-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  function startMockSession() {
    setDemoSessionId(createDemoSessionId())
    setSessionPhase('calibration')
    setVisibleEventCount(1)
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)
  }

  function runSyntheticCalibration() {
    setSessionPhase('active')
    setVisibleEventCount(Math.min(1 + calibrationEventCount, mockEvents.length))
  }

  function updateQualityMode(mode: SyntheticTelemetryMode) {
    setQualityMode(mode)
    setSessionPhase('detail')
    setVisibleEventCount(0)
    setIngestResult(null)
    setIsIngestingEvents(false)
    setIsFetchingBackendReport(false)
    setBackendReportResult(null)
  }

  function completeMockSession() {
    setVisibleEventCount(mockEvents.length)
    setSessionPhase('completed')
    setIngestResult(null)
    setBackendReportResult(null)
    setIsFetchingBackendReport(false)
    setIsIngestingEvents(true)

    void (async () => {
      const result = await ingestSessionEvents(demoSessionId, mockEvents)
      setIngestResult(result)
      setIsIngestingEvents(false)

      if (result.ok) {
        setIsFetchingBackendReport(true)
        try {
          const reportResult = await fetchSessionReport(demoSessionId)
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Synthetic demo frontend shell</p>
          <h1>GazeTrack</h1>
          <p className="subtitle">Task-based webcam gaze analytics for website UX testing.</p>
          <p className="privacy-note">
            GazeTrack is designed to store gaze/event telemetry, not webcam video.
          </p>
          <button type="button" className="primary-button" onClick={openDemoStudy}>
            Open demo study
          </button>
        </div>
        <StatusCard health={backendHealth} isLoading={isCheckingHealth} />
      </section>

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
              <h3>{demoStudy.name}</h3>
              <span className="status-pill pending">Demo</span>
            </div>
            <dl>
              <div>
                <dt>Page</dt>
                <dd>{demoStudy.pageLabel}</dd>
              </div>
              <div>
                <dt>Task prompt</dt>
                <dd>{demoStudy.taskPrompt}</dd>
              </div>
              <div>
                <dt>Mock session quality</dt>
                <dd>{demoStudy.sessionQuality}</dd>
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
              {demoStudy.aois.map((aoi) => (
                <li key={aoi.name}>
                  <strong>{aoi.name}</strong>
                  <span>{aoi.role}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

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
              <h4>{studySetupResult?.study?.name ?? demoStudy.name}</h4>
              <p className="muted">{studySetupResult?.study?.objective ?? demoStudy.taskPrompt}</p>
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
          {demoStudy.insights.map((insight) => (
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
            <SessionControls
              phase={sessionPhase}
              eventCount={visibleEventCount}
              totalEventCount={mockEvents.length}
              elapsedSeconds={elapsedSeconds}
              taskPrompt={demoStudy.taskPrompt}
              qualityMode={qualityMode}
              calibrationEventCount={calibrationEventCount}
              onQualityModeChange={updateQualityMode}
              onOpenStudy={openDemoStudy}
              onStartSession={startMockSession}
              onRunCalibration={runSyntheticCalibration}
              onCompleteSession={completeMockSession}
            />
            <EventLog events={visibleEvents} />
          </div>
        </section>
      ) : null}

      {sessionPhase === 'completed' ? (
        <section id="demo-report-panel" className="section-block">
          <DemoReport
            report={demoReport}
            events={mockEvents}
            aois={demoStudy.aois}
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
              description="Demo placeholder only. No chart library or computed AOI analytics are implemented yet."
            />
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
