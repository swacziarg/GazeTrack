import type { AreaOfInterest } from '../data/demoStudy'
import type { MockStudyEvent } from '../lib/mockEvents'
import { computeGazePathAnchors, extractGazeSamples } from '../lib/visualization'

type GazePathPreviewProps = {
  events: MockStudyEvent[]
  aois: AreaOfInterest[]
  telemetrySourceLabel?: string
  telemetrySourceIsExperimental?: boolean
}

function toPolylinePoints(samples: ReturnType<typeof computeGazePathAnchors>) {
  return samples.map((sample) => `${sample.xPercent},${sample.yPercent * 0.64}`).join(' ')
}

export function GazePathPreview({
  events,
  aois,
  telemetrySourceLabel = 'Synthetic telemetry',
  telemetrySourceIsExperimental = false,
}: GazePathPreviewProps) {
  const gazeSamples = extractGazeSamples(events)
  const pathAnchors = computeGazePathAnchors(gazeSamples)
  const firstSample = pathAnchors[0]
  const lastSample = pathAnchors[pathAnchors.length - 1]
  const hasGazeSamples = gazeSamples.length > 0
  const title = telemetrySourceIsExperimental ? 'Browser gaze path' : 'Synthetic demo gaze path'

  return (
    <article className="card synthetic-visual-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>Telemetry replay trace</h3>
        </div>
        <span className="status-pill pending">{telemetrySourceLabel}</span>
      </div>

      <svg className="mock-page-surface" viewBox="0 0 100 64" role="img" aria-label={title}>
        <rect className="mock-page-background" x="0" y="0" width="100" height="64" rx="2" />
        <rect className="mock-page-nav" x="6" y="5" width="88" height="7" rx="1.5" />
        <rect className="mock-page-hero" x="8" y="17" width="84" height="24" rx="2" />
        <rect className="mock-page-table" x="14" y="47" width="72" height="10" rx="1.5" />
        {aois.map((aoi) => (
          <rect
            key={aoi.name}
            className="aoi-box"
            x={aoi.x}
            y={aoi.y * 0.64}
            width={aoi.width}
            height={aoi.height * 0.64}
            rx="1.5"
          />
        ))}
        {hasGazeSamples ? (
          <polyline className="gaze-path-line" points={toPolylinePoints(pathAnchors)} />
        ) : (
          <text className="mock-page-empty-label" x="50" y="34">
            No gaze samples
          </text>
        )}
        {pathAnchors.map((sample) => (
          <g key={sample.id} transform={`translate(${sample.xPercent} ${sample.yPercent * 0.64})`}>
            <circle className="gaze-path-point" r={Math.min(4.4, 2.4 + sample.sampleCount * 0.08)} />
            <text className="gaze-path-index" x="4.4" y="-3.4">
              {sample.sequenceLabel}
            </text>
          </g>
        ))}
        {firstSample ? (
          <circle className="gaze-path-start" cx={firstSample.xPercent} cy={firstSample.yPercent * 0.64} r="4" />
        ) : null}
        {lastSample ? (
          <rect
            className="gaze-path-end"
            x={lastSample.xPercent - 3}
            y={lastSample.yPercent * 0.64 - 3}
            width="6"
            height="6"
            rx="1"
          />
        ) : null}
      </svg>

      <p className="visual-note">
        Generated from telemetry events. First gaze point is circled; last point is squared.
      </p>
    </article>
  )
}
