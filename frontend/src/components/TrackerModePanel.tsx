import type { TrackerId, TrackerStatus } from '../tracking'
import type { TrackerOption } from '../tracking/trackerFactory'

type TrackerModePanelProps = {
  options: TrackerOption[]
  selectedTrackerId: TrackerId
  availabilityLabel: string
  consentGranted: boolean
  calibrationComplete: boolean
  status: TrackerStatus
  onTrackerChange: (trackerId: TrackerId) => void
  onGrantConsent: () => void
  onCancelToSynthetic: () => void
}

function statusLabel(status: TrackerStatus) {
  const labels: Record<TrackerStatus, string> = {
    idle: 'Idle',
    consent_required: 'Consent required',
    initializing: 'Initializing',
    ready: 'Ready',
    tracking: 'Tracking active',
    stopped: 'Stopped',
    unavailable: 'Unavailable',
  }
  return labels[status]
}

export function TrackerModePanel({
  options,
  selectedTrackerId,
  availabilityLabel,
  consentGranted,
  calibrationComplete,
  status,
  onTrackerChange,
  onGrantConsent,
  onCancelToSynthetic,
}: TrackerModePanelProps) {
  const selectedOption = options.find((option) => option.id === selectedTrackerId) ?? options[0]
  const isWebGazerSelected = selectedTrackerId === 'webgazer'

  return (
    <article className="card tracker-mode-panel">
      <div className="card-header">
        <div>
          <p className="eyebrow">Tracker mode</p>
          <h3>{selectedOption.label}</h3>
        </div>
        <span className={`status-pill ${status === 'tracking' || status === 'ready' ? 'ok' : 'pending'}`}>
          {statusLabel(status)}
        </span>
      </div>

      <label className="field-control">
        <span>Telemetry source</span>
        <select value={selectedTrackerId} onChange={(event) => onTrackerChange(event.target.value as TrackerId)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <dl className="tracker-status-grid">
        <div>
          <dt>Mode</dt>
          <dd>{selectedOption.label}</dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd>{availabilityLabel}</dd>
        </div>
        <div>
          <dt>Consent</dt>
          <dd>{isWebGazerSelected ? (consentGranted ? 'Granted' : 'Required') : 'Not needed'}</dd>
        </div>
        <div>
          <dt>Calibration</dt>
          <dd>{calibrationComplete ? 'Complete' : 'Pending'}</dd>
        </div>
        <div>
          <dt>Tracking</dt>
          <dd>{status === 'tracking' ? 'Active' : 'Inactive'}</dd>
        </div>
      </dl>

      {isWebGazerSelected && !consentGranted ? (
        <section className="consent-panel" aria-label="Browser gaze experiment consent">
          <h4>Browser gaze experiment consent</h4>
          <p>
            Browser-based gaze estimation may request camera access. Gaze estimation is approximate and not
            medical-grade eye tracking.
          </p>
          <p>
            Raw video is not sent to the backend. Backend ingest receives only telemetry events such as normalized gaze
            points, confidence or quality metadata, timestamps, clicks, scrolls, calibration events, and task events.
          </p>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={onGrantConsent}>
              Consent and initialize
            </button>
            <button type="button" className="secondary-button" onClick={onCancelToSynthetic}>
              Use synthetic demo
            </button>
          </div>
        </section>
      ) : null}

      <p className="privacy-note compact">
        Synthetic telemetry remains the default. Browser gaze is an experimental opt-in mode and does not upload raw
        webcam media.
      </p>
    </article>
  )
}
