import { useEffect, useState } from 'react'
import { fetchBackendHealth, type BackendHealth } from './api/health'
import { FlowCard } from './components/FlowCard'
import { MetricCard } from './components/MetricCard'
import { PlaceholderPanel } from './components/PlaceholderPanel'
import { StatusCard } from './components/StatusCard'
import { demoStudy, flowSteps } from './data/demoStudy'

const initialHealth: BackendHealth = {
  ok: false,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  message: 'Backend health check has not run yet.',
}

function App() {
  const [backendHealth, setBackendHealth] = useState<BackendHealth>(initialHealth)
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)

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

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Static demo frontend shell</p>
          <h1>GazeTrack</h1>
          <p className="subtitle">Task-based webcam gaze analytics for website UX testing.</p>
          <p className="privacy-note">
            GazeTrack is designed to store gaze/event telemetry, not webcam video.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              document.getElementById('demo-study-preview')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
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
          <p className="eyebrow">Static demo data</p>
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
              <span>Static demo data</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Static demo data</p>
          <h2>Placeholder report metrics</h2>
        </div>
        <div className="metric-grid">
          {demoStudy.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Static demo data</p>
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
