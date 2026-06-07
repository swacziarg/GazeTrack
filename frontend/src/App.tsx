import { useEffect, useMemo, useState } from 'react'
import { ingestSessionEvents, type EventIngestResult } from './api/events'
import { fetchBackendHealth, type BackendHealth } from './api/health'
import { DemoReport } from './components/DemoReport'
import { EventLog } from './components/EventLog'
import { FlowCard } from './components/FlowCard'
import { PlaceholderPanel } from './components/PlaceholderPanel'
import { SessionControls, type SessionPhase } from './components/SessionControls'
import { StatusCard } from './components/StatusCard'
import { demoStudy, flowSteps } from './data/demoStudy'
import { generateMockStudyEvents } from './lib/mockEvents'
import { generateDemoReport } from './lib/mockReport'

const initialHealth: BackendHealth = {
  ok: false,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  message: 'Backend health check has not run yet.',
}

const DEMO_SESSION_ID = '11111111-1111-4111-8111-111111111111'

function App() {
  const [backendHealth, setBackendHealth] = useState<BackendHealth>(initialHealth)
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('preview')
  const [visibleEventCount, setVisibleEventCount] = useState(0)
  const [isIngestingEvents, setIsIngestingEvents] = useState(false)
  const [ingestResult, setIngestResult] = useState<EventIngestResult | null>(null)
  const mockEvents = useMemo(() => generateMockStudyEvents(), [])
  const visibleEvents = mockEvents.slice(0, visibleEventCount)
  const demoReport = useMemo(() => generateDemoReport(mockEvents), [mockEvents])
  const elapsedSeconds =
    visibleEvents.length > 1
      ? (Date.parse(visibleEvents[visibleEvents.length - 1].timestamp) - Date.parse(visibleEvents[0].timestamp)) /
        1000
      : 0

  useEffect(() => {
    let isMounted = true

    async function loadHealth() {
      const result = await fetchBackendHealth()
      if (isMounted) {
        setBackendHealth(result)
        setIsCheckingHealth(false)
      }
    }

    void loadHealth()

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
    }, 900)

    return () => window.clearInterval(intervalId)
  }, [mockEvents.length, sessionPhase, visibleEventCount])

  function openDemoStudy() {
    setSessionPhase('detail')
    setVisibleEventCount(0)
    setIngestResult(null)
    setIsIngestingEvents(false)
    window.setTimeout(() => {
      document.getElementById('mock-session-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  function startMockSession() {
    setSessionPhase('active')
    setVisibleEventCount(1)
    setIngestResult(null)
    setIsIngestingEvents(false)
  }

  function completeMockSession() {
    setVisibleEventCount(mockEvents.length)
    setSessionPhase('completed')
    setIngestResult(null)
    setIsIngestingEvents(true)

    void ingestSessionEvents(DEMO_SESSION_ID, mockEvents)
      .then((result) => {
        setIngestResult(result)
      })
      .finally(() => {
        setIsIngestingEvents(false)
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
              onOpenStudy={openDemoStudy}
              onStartSession={startMockSession}
              onCompleteSession={completeMockSession}
            />
            <EventLog events={visibleEvents} />
          </div>
        </section>
      ) : null}

      {sessionPhase === 'completed' ? (
        <section id="demo-report-panel" className="section-block">
          <DemoReport report={demoReport} ingestResult={ingestResult} isIngestingEvents={isIngestingEvents} />
        </section>
      ) : null}

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
    </main>
  )
}

export default App
