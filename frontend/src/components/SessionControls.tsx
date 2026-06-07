export type SessionPhase = 'preview' | 'detail' | 'active' | 'completed'

type SessionControlsProps = {
  phase: SessionPhase
  eventCount: number
  totalEventCount: number
  elapsedSeconds: number
  taskPrompt: string
  onOpenStudy: () => void
  onStartSession: () => void
  onCompleteSession: () => void
}

function getStatusLabel(phase: SessionPhase) {
  if (phase === 'active') {
    return 'Active demo session'
  }

  if (phase === 'completed') {
    return 'Completed demo session'
  }

  if (phase === 'detail') {
    return 'Demo study ready'
  }

  return 'Preview only'
}

export function SessionControls({
  phase,
  eventCount,
  totalEventCount,
  elapsedSeconds,
  taskPrompt,
  onOpenStudy,
  onStartSession,
  onCompleteSession,
}: SessionControlsProps) {
  const canComplete = phase === 'active' && eventCount === totalEventCount

  return (
    <article className="card session-controls">
      <div className="card-header">
        <div>
          <p className="eyebrow">Mock study flow</p>
          <h3>Demo session</h3>
        </div>
        <span className={`status-pill ${phase === 'active' ? 'ok' : 'pending'}`}>{getStatusLabel(phase)}</span>
      </div>

      <p className="task-prompt">{taskPrompt}</p>

      <dl className="session-stats">
        <div>
          <dt>Synthetic events</dt>
          <dd>
            {eventCount} / {totalEventCount}
          </dd>
        </div>
        <div>
          <dt>Demo timer</dt>
          <dd>{elapsedSeconds.toFixed(1)}s</dd>
        </div>
      </dl>

      <div className="button-row">
        {phase === 'preview' ? (
          <button type="button" className="primary-button" onClick={onOpenStudy}>
            Open demo study
          </button>
        ) : (
          <button type="button" className="secondary-button" onClick={onStartSession}>
            {phase === 'completed' ? 'Restart mock session' : 'Start mock session'}
          </button>
        )}
        {phase === 'active' ? (
          <button type="button" className="primary-button" onClick={onCompleteSession} disabled={!canComplete}>
            Complete mock session
          </button>
        ) : null}
      </div>

      <p className="privacy-note compact">
        Demo sessions use synthetic gaze/event telemetry. GazeTrack is designed to store telemetry only,
        not webcam video.
      </p>
    </article>
  )
}
