import { calibrationTargets, type SyntheticTelemetryMode } from '../lib/mockEvents'

export type SessionPhase = 'preview' | 'detail' | 'calibration' | 'active' | 'completed'

type SessionControlsProps = {
  phase: SessionPhase
  eventCount: number
  totalEventCount: number
  elapsedSeconds: number
  taskPrompt: string
  qualityMode: SyntheticTelemetryMode
  calibrationEventCount: number
  onQualityModeChange: (mode: SyntheticTelemetryMode) => void
  onOpenStudy: () => void
  onStartSession: () => void
  onRunCalibration: () => void
  onCompleteSession: () => void
}

function getStatusLabel(phase: SessionPhase) {
  if (phase === 'calibration') {
    return 'Synthetic calibration'
  }

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
  qualityMode,
  calibrationEventCount,
  onQualityModeChange,
  onOpenStudy,
  onStartSession,
  onRunCalibration,
  onCompleteSession,
}: SessionControlsProps) {
  const canComplete = phase === 'active' && eventCount === totalEventCount
  const calibrationVisible = phase === 'calibration' || phase === 'active' || phase === 'completed'

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

      <label className="field-control">
        <span>Demo quality mode</span>
        <select
          value={qualityMode}
          onChange={(event) => onQualityModeChange(event.target.value as SyntheticTelemetryMode)}
          disabled={phase === 'calibration' || phase === 'active'}
        >
          <option value="healthy">Healthy</option>
          <option value="low_confidence">Low confidence</option>
          <option value="bad_calibration">Bad calibration</option>
          <option value="no_gaze">No gaze</option>
        </select>
      </label>

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

      {calibrationVisible ? (
        <section className="calibration-panel" aria-label="Synthetic demo calibration">
          <div className="calibration-copy">
            <h4>Synthetic calibration</h4>
            <p className="muted">
              Five target points generate calibration telemetry only. No camera permission is requested.
            </p>
          </div>
          <div className="calibration-target-map" aria-label="Five synthetic calibration targets">
            {calibrationTargets.map((target, index) => (
              <span
                key={`${target.x}-${target.y}`}
                className="calibration-target"
                style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
                title={`Calibration target ${index + 1}`}
              >
                {index + 1}
              </span>
            ))}
          </div>
          <dl className="session-stats compact-stats">
            <div>
              <dt>Targets</dt>
              <dd>{calibrationTargets.length}</dd>
            </div>
            <div>
              <dt>Calibration events</dt>
              <dd>{calibrationEventCount}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="button-row">
        {phase === 'preview' ? (
          <button type="button" className="primary-button" onClick={onOpenStudy}>
            Open demo study
          </button>
        ) : phase === 'detail' || phase === 'completed' ? (
          <button type="button" className="secondary-button" onClick={onStartSession}>
            {phase === 'completed' ? 'Restart demo session' : 'Start demo session'}
          </button>
        ) : null}
        {phase === 'calibration' ? (
          <button type="button" className="primary-button" onClick={onRunCalibration}>
            Run synthetic calibration
          </button>
        ) : null}
        {phase === 'active' ? (
          <button type="button" className="primary-button" onClick={onCompleteSession} disabled={!canComplete}>
            Complete demo session
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
