import type { RefObject } from 'react'
import {
  cameraQualityThresholds,
  type CameraQualityBaseline,
  type CameraQualityObservation,
  type CameraReadinessResult,
} from '../tracking/cameraQuality'

type CameraReadinessGateProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  observation: CameraQualityObservation | null
  readiness: CameraReadinessResult | null
  baseline: CameraQualityBaseline | null
  error: string | null
  warning: string | null
  onContinue: () => void
  onUseSyntheticDemo: () => void
}

function formatMetric(value: number | null | undefined, suffix = '') {
  return typeof value === 'number' ? `${value.toFixed(2)}${suffix}` : 'Unavailable'
}

export function CameraReadinessGate({
  videoRef,
  observation,
  readiness,
  baseline,
  error,
  warning,
  onContinue,
  onUseSyntheticDemo,
}: CameraReadinessGateProps) {
  const ready = readiness?.ready ?? false

  return (
    <section className="camera-readiness-gate" aria-label="Camera readiness">
      <div className="camera-readiness-preview">
        <video ref={videoRef as RefObject<HTMLVideoElement>} aria-label="Local camera preview" autoPlay muted playsInline />
        <div className="camera-face-guide" aria-hidden="true">
          <div className="camera-face-guide-oval" />
          <span>Center face here</span>
        </div>
      </div>
      <div className="camera-readiness-copy">
        <div className="card-header">
          <div>
            <p className="eyebrow">Camera setup</p>
            <h2>Check setup quality</h2>
          </div>
          <span className={`status-pill ${ready ? 'ok' : error ? 'error' : 'pending'}`}>
            {readiness?.prompt ?? (error ? 'Camera unavailable' : 'Checking')}
          </span>
        </div>

        {error ? <p className="backend-unavailable compact">{error}</p> : null}
        {warning && !error ? <p className="privacy-note compact">{warning}</p> : null}

        <dl className="tracker-status-grid compact-grid">
          <div>
            <dt>Readiness score</dt>
            <dd>{readiness ? readiness.score : 0}</dd>
          </div>
          <div>
            <dt>Quality</dt>
            <dd>{readiness?.quality ?? 'pending'}</dd>
          </div>
          <div>
            <dt>Face signal</dt>
            <dd>{observation?.faceDetected ? 'Detected' : 'Waiting'}</dd>
          </div>
          <div>
            <dt>Lighting</dt>
            <dd>
              {formatMetric(observation?.brightness)} / {formatMetric(observation?.contrast)}
            </dd>
          </div>
          <div>
            <dt>Sample rate</dt>
            <dd>{formatMetric(observation?.observedFps, ' fps')}</dd>
          </div>
          <div>
            <dt>Hold window</dt>
            <dd>{cameraQualityThresholds.stableWindowMs / 1000}s</dd>
          </div>
        </dl>

        {readiness?.flags.length ? (
          <ul className="quality-flag-list" aria-label="Camera quality flags">
            {readiness.flags.map((flag) => (
              <li key={flag}>{flag.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        ) : (
          <p className="privacy-note compact">
            Camera preview and setup checks run locally. Calibration starts only after setup quality passes.
          </p>
        )}

        {baseline ? (
          <p className="privacy-note compact">
            Baseline captured with readiness score {baseline.readiness_score}.
          </p>
        ) : null}

        <div className="button-row">
          <button type="button" className="primary-button" disabled={!ready} onClick={onContinue}>
            Continue to calibration
          </button>
          <button type="button" className="secondary-button" onClick={onUseSyntheticDemo}>
            Use synthetic demo
          </button>
        </div>
      </div>
    </section>
  )
}
