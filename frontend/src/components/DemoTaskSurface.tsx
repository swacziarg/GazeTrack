import { forwardRef } from 'react'
import type { StudyBuilderAoi } from '../data/demoStudy'
import type { SessionPhase } from './SessionControls'
import { DraggableAoiPreview } from './DraggableAoiPreview'

type DemoTaskSurfaceProps = {
  aois: StudyBuilderAoi[]
  fullscreen?: boolean
  phase: SessionPhase
  taskPrompt: string
  canStartSession: boolean
  onAoiChange: (index: number, nextAoi: StudyBuilderAoi) => void
  onStartSession: () => void
  onCompleteSession: () => void
}

function getSurfaceStatus(phase: SessionPhase) {
  if (phase === 'calibration') {
    return 'Calibration in progress'
  }

  if (phase === 'active') {
    return 'Task running'
  }

  if (phase === 'completed') {
    return 'Task complete'
  }

  return 'Ready to test'
}

export const DemoTaskSurface = forwardRef<HTMLDivElement, DemoTaskSurfaceProps>(function DemoTaskSurface(
  {
    aois,
    fullscreen = false,
    phase,
    taskPrompt,
    canStartSession,
    onAoiChange,
    onStartSession,
    onCompleteSession,
  },
  ref,
) {
  const canCompleteFromSurface = phase === 'active'
  const canEditRegions = phase === 'detail' || phase === 'preview' || phase === 'completed'

  return (
    <article className={`card demo-task-card ${fullscreen ? 'demo-task-card-fullscreen' : ''}`}>
      <div className="card-header">
        <div>
          <p className="eyebrow">Demo test page</p>
          <h3>Pricing landing page task</h3>
        </div>
        <div className="demo-task-actions">
          <span className={`status-pill ${phase === 'active' ? 'ok' : 'pending'}`}>{getSurfaceStatus(phase)}</span>
          {phase === 'active' ? (
            <button type="button" className="secondary-button" onClick={onCompleteSession}>
              End demo
            </button>
          ) : null}
        </div>
      </div>

      <p className="task-prompt">{taskPrompt}</p>

      <div className="demo-browser-frame" ref={ref}>
        <div className="demo-browser-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>example.test/pricing</strong>
        </div>
        <div className="demo-page">
          <header className="demo-site-nav">
            <strong>Northstar</strong>
            <nav aria-label="Demo page navigation">
              <a>Product</a>
              <a>Pricing</a>
              <a>Docs</a>
            </nav>
          </header>
          <section className="demo-site-hero">
            <div>
              <p className="eyebrow">Team analytics</p>
              <h4>Find the plan that keeps your launch moving</h4>
              <p>Compare starter and team packages, then start checkout for the team plan.</p>
            </div>
            <button
              type="button"
              className="primary-button demo-cta"
              disabled={!canCompleteFromSurface}
              onClick={onCompleteSession}
            >
              Start team checkout
            </button>
          </section>
          <section className="demo-pricing-row" aria-label="Demo pricing preview">
            <div>
              <span>Starter</span>
              <strong>$19</strong>
            </div>
            <div className="featured">
              <span>Team</span>
              <strong>$49</strong>
            </div>
            <div>
              <span>Scale</span>
              <strong>Custom</strong>
            </div>
          </section>
        </div>

        <DraggableAoiPreview
          aois={aois}
          className="demo-task-aoi-layer"
          disabled={!canEditRegions}
          onAoiChange={onAoiChange}
        />
      </div>

      <div className="button-row">
        {phase === 'detail' || phase === 'preview' || phase === 'completed' ? (
          <button type="button" className="primary-button" disabled={!canStartSession} onClick={onStartSession}>
            {phase === 'completed' ? 'Run again' : 'Start task'}
          </button>
        ) : null}
        {phase === 'active' ? (
          <button type="button" className="secondary-button" onClick={onCompleteSession}>
            Finish task
          </button>
        ) : null}
      </div>

      <p className="privacy-note compact">
        Drag the highlighted key regions before the run. The demo stores normalized rectangles and telemetry events only.
      </p>
    </article>
  )
})
