import type { AreaOfInterest } from '../data/demoStudy'
import type { MockStudyEvent } from '../lib/mockEvents'
import { extractGazeSamples } from '../lib/visualization'

type GazePathPreviewProps = {
  events: MockStudyEvent[]
  aois: AreaOfInterest[]
}

function toPolylinePoints(samples: ReturnType<typeof extractGazeSamples>) {
  return samples.map((sample) => `${sample.xPercent},${sample.yPercent * 0.64}`).join(' ')
}

export function GazePathPreview({ events, aois }: GazePathPreviewProps) {
  const gazeSamples = extractGazeSamples(events)
  const firstSample = gazeSamples[0]
  const lastSample = gazeSamples[gazeSamples.length - 1]

  return (
    <article className="card synthetic-visual-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Synthetic demo gaze path</p>
          <h3>Mock replay trace</h3>
        </div>
        <span className="status-pill pending">Generated from mock events</span>
      </div>

      <svg className="mock-page-surface" viewBox="0 0 100 64" role="img" aria-label="Synthetic demo gaze path">
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
        {gazeSamples.length > 1 ? <polyline className="gaze-path-line" points={toPolylinePoints(gazeSamples)} /> : null}
        {gazeSamples.map((sample, index) => (
          <g key={sample.id} transform={`translate(${sample.xPercent} ${sample.yPercent * 0.64})`}>
            <circle className="gaze-path-point" r="2.4" />
            <text className="gaze-path-index" x="3.8" y="-3">
              {index + 1}
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

      <p className="visual-note">Generated from mock events. First gaze point is circled; last point is squared.</p>
    </article>
  )
}
