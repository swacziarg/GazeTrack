import type { BrowserGazeStatusSnapshot } from '../tracking'

type BrowserGazeStatusPanelProps = {
  status: BrowserGazeStatusSnapshot | null
  canTurnOff: boolean
  debugOverlayEnabled: boolean
  onDebugOverlayChange: (enabled: boolean) => void
  onUseSyntheticDemo: () => void
  onTurnOff: () => void
}

function formatTrackerState(status: BrowserGazeStatusSnapshot | null) {
  const state = status?.trackerState ?? 'permission_needed'
  const labels: Record<string, string> = {
    idle: 'Idle',
    permission_needed: 'Permission needed',
    loading: 'Loading',
    ready: 'Ready',
    calibrating: 'Calibrating',
    active: 'Active',
    weak_signal: 'Weak signal',
    stopped: 'Stopped',
    error: 'Error',
  }
  return labels[state] ?? state
}

function formatElapsed(status: BrowserGazeStatusSnapshot | null) {
  return `${((status?.elapsedMs ?? 0) / 1000).toFixed(1)}s`
}

export function BrowserGazeStatusPanel({
  status,
  canTurnOff,
  debugOverlayEnabled,
  onDebugOverlayChange,
  onUseSyntheticDemo,
  onTurnOff,
}: BrowserGazeStatusPanelProps) {
  return (
    <article className="card browser-gaze-status-panel" aria-live="polite">
      <div className="card-header">
        <div>
          <p className="eyebrow">Browser gaze debug</p>
          <h3>Live tracking status</h3>
        </div>
        <span className={`status-pill ${status?.trackerState === 'active' ? 'ok' : 'pending'}`}>
          {formatTrackerState(status)}
        </span>
      </div>

      <dl className="tracker-status-grid live-tracker-grid">
        <div>
          <dt>Tracker state</dt>
          <dd>{formatTrackerState(status)}</dd>
        </div>
        <div>
          <dt>Samples</dt>
          <dd>{status?.sampleCount ?? 0}</dd>
        </div>
        <div>
          <dt>Valid samples</dt>
          <dd>{status?.validSampleCount ?? 0}</dd>
        </div>
        <div>
          <dt>Low / missing</dt>
          <dd>
            {status?.lowConfidenceCount ?? 0} / {status?.missingPredictionCount ?? 0}
          </dd>
        </div>
        <div>
          <dt>Elapsed capture</dt>
          <dd>{formatElapsed(status)}</dd>
        </div>
      </dl>

      <label className="toggle-control">
        <input
          type="checkbox"
          checked={debugOverlayEnabled}
          onChange={(event) => onDebugOverlayChange(event.target.checked)}
        />
        <span>Show approximate gaze dot</span>
      </label>

      {canTurnOff ? (
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onTurnOff}>
            Turn off browser gaze
          </button>
        </div>
      ) : null}

      {status?.message ? (
        <section className="tracker-fallback-panel" aria-label="Browser gaze fallback message">
          <p>{status.message}</p>
          <button type="button" className="secondary-button compact-button" onClick={onUseSyntheticDemo}>
            Use synthetic demo
          </button>
        </section>
      ) : (
        <p className="privacy-note compact">
          The dot is a local approximate prediction only. It is not a medical-grade accuracy indicator.
        </p>
      )}
    </article>
  )
}
