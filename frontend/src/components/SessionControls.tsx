import { calibrationTargets, type SyntheticTelemetryMode } from '../lib/mockEvents'
import type { TrackerId } from '../tracking'

export type SessionPhase = 'preview' | 'detail' | 'calibration' | 'active' | 'completed'

type SessionControlsProps = {
  phase: SessionPhase
  trackerId: TrackerId
  trackerLabel: string
  canStartSession: boolean
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

function getStatusLabel(phase: SessionPhase, trackerLabel: string) {
  if (phase === 'calibration') {
    return `${trackerLabel} calibration`
  }

  if (phase === 'active') {
    return 'Active test session'
  }

  if (phase === 'completed') {
    return 'Completed test session'
  }

  if (phase === 'detail') {
    return 'Demo study ready'
  }

  return 'Preview only'
}

export function SessionControls({
  phase,
  trackerId,
  trackerLabel,
  canStartSession,
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
  const isSynthetic = trackerId === 'synthetic'

  return (
    <article className="card session-controls">
      <div className="card-header">
        <div>
          <p className="eyebrow">{isSynthetic ? 'Mock study flow' : 'Browser experiment flow'}</p>
          <h3>Demo session</h3>
        </div>
        <span className={`status-pill ${phase === 'active' ? 'ok' : 'pending'}`}>
          {getStatusLabel(phase, trackerLabel)}
        </span>
      </div>

      <p className="task-prompt">{taskPrompt}</p>

      <label className="field-control">
        <span>Demo quality mode</span>
        <select
          value={qualityMode}
          onChange={(event) => onQualityModeChange(event.target.value as SyntheticTelemetryMode)}
          disabled={!isSynthetic || phase === 'calibration' || phase === 'active'}
        >
          <option value="healthy">Healthy</option>
          <option value="low_confidence">Low confidence</option>
          <option value="bad_calibration">Bad calibration</option>
          <option value="no_gaze">No gaze</option>
        </select>
      </label>

      <dl className="session-stats">
        <div>
          <dt>{isSynthetic ? 'Synthetic events' : 'Tracker events'}</dt>
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
        <section className="calibration-panel" aria-label={`${trackerLabel} calibration`}>
          <div className="calibration-copy">
            <h4>{trackerLabel} calibration</h4>
            <p className="muted">
              {isSynthetic
                ? 'Five target points generate calibration telemetry only. No camera permission is requested.'
                : 'Five target points generate calibration telemetry after consent. Raw camera media is not sent to ingest.'}
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
          <button type="button" className="secondary-button" onClick={onStartSession} disabled={!canStartSession}>
            {phase === 'completed' ? 'Restart demo session' : 'Start demo session'}
          </button>
        ) : null}
        {phase === 'calibration' ? (
          <button type="button" className="primary-button" onClick={onRunCalibration}>
            Run {isSynthetic ? 'synthetic' : 'browser'} calibration
          </button>
        ) : null}
        {phase === 'active' ? (
          <button type="button" className="primary-button" onClick={onCompleteSession} disabled={!canComplete}>
            Complete demo session
          </button>
        ) : null}
      </div>

      <p className="privacy-note compact">
        {isSynthetic
          ? 'Demo sessions use synthetic gaze/event telemetry. GazeTrack is designed to store telemetry only, not webcam video.'
          : 'Browser gaze experiment sessions store telemetry only. GazeTrack does not send webcam video to the backend.'}
      </p>
    </article>
  )
}
