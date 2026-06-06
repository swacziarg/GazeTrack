import { useEffect, useState } from 'react'
import { getHealthStatus, type HealthStatus } from './api/health'
import { FlowCard } from './components/FlowCard'
import { MetricCard } from './components/MetricCard'
import { PlaceholderPanel } from './components/PlaceholderPanel'
import { StatusCard } from './components/StatusCard'
import { demoMetrics, demoStudy, productFlow } from './data/demoStudy'

const initialHealthState: HealthStatus = {
  ok: false,
  message: 'Checking backend health…',
}

function App() {
  const [health, setHealth] = useState<HealthStatus>(initialHealthState)
  const [isLoadingHealth, setIsLoadingHealth] = useState(true)

  useEffect(() => {
    async function loadHealth() {
      const response = await getHealthStatus()
      setHealth(response)
      setIsLoadingHealth(false)
    }

    void loadHealth()
  }, [])

  return (
    <main className="app-shell">
      <header className="hero-section card">
        <p className="eyebrow">Privacy-first demo shell</p>
        <h1>GazeOps</h1>
        <p className="lead">Task-based webcam gaze analytics for website UX testing.</p>
        <p className="privacy-note">
          GazeOps is designed to store gaze/event telemetry, not webcam video.
        </p>
        <button
          type="button"
          className="cta-button"
          onClick={() =>
            document.getElementById('demo-study-preview')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Open demo study
        </button>
      </header>

      <StatusCard
        title="Backend API status"
        isLoading={isLoadingHealth}
        ok={health.ok}
        message={health.message}
      />

      <section className="section-block">
        <h2>Product Flow</h2>
        <div className="flow-grid">
          {productFlow.map((step, index) => (
            <FlowCard key={step} step={index + 1} label={step} />
          ))}
        </div>
      </section>

      <section id="demo-study-preview" className="section-block card">
        <div className="card-header">
          <h2>Demo Study Preview</h2>
          <span className="status-pill pending">Static mock data</span>
        </div>
        <div className="demo-study-grid">
          <article>
            <p className="eyebrow">Study name</p>
            <p>{demoStudy.studyName}</p>
          </article>
          <article>
            <p className="eyebrow">Page URL</p>
            <p>{demoStudy.pageLabel}</p>
          </article>
          <article>
            <p className="eyebrow">Task prompt</p>
            <p>{demoStudy.taskPrompt}</p>
          </article>
          <article>
            <p className="eyebrow">Session quality</p>
            <p>{demoStudy.sessionQuality}</p>
          </article>
        </div>

        <div className="subsection">
          <h3>AOIs / regions</h3>
          <ul>
            {demoStudy.aois.map((aoi) => (
              <li key={aoi}>{aoi}</li>
            ))}
          </ul>
        </div>

        <div className="subsection">
          <h3>Mock insight cards</h3>
          <div className="insight-grid">
            {demoStudy.insights.map((insight) => (
              <article className="card insight-card" key={insight}>
                <p>{insight}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <h2>Placeholder report cards</h2>
        <div className="metric-grid">
          {demoMetrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} />
          ))}
        </div>
      </section>

      <section className="section-block">
        <h2>Visualization placeholders</h2>
        <div className="placeholder-grid">
          <PlaceholderPanel
            title="Heatmap placeholder panel"
            description="Placeholder only — demo preview for future gaze heatmap output."
          />
          <PlaceholderPanel
            title="Gaze replay placeholder panel"
            description="Placeholder only — demo preview for future timeline replay."
          />
          <PlaceholderPanel
            title="AOI attention breakdown placeholder panel"
            description="Placeholder only — demo preview for future AOI attention breakdown."
          />
        </div>
      </section>
    </main>
  )
}

export default App
