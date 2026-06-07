import type { AreaOfInterest } from '../data/demoStudy'
import type { MockStudyEvent } from '../lib/mockEvents'
import { extractClickEvents, extractGazeSamples } from '../lib/visualization'

type SyntheticHeatmapPreviewProps = {
  events: MockStudyEvent[]
  aois: AreaOfInterest[]
}

export function SyntheticHeatmapPreview({ events, aois }: SyntheticHeatmapPreviewProps) {
  const gazeSamples = extractGazeSamples(events)
  const clickEvents = extractClickEvents(events)

  return (
    <article className="card synthetic-visual-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Synthetic demo heatmap preview</p>
          <h3>Attention density</h3>
        </div>
        <span className="status-pill pending">Not real webcam tracking</span>
      </div>

      <svg className="mock-page-surface" viewBox="0 0 100 64" role="img" aria-label="Synthetic demo heatmap preview">
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
        {gazeSamples.map((sample, index) => (
          <circle
            key={sample.id}
            className="heatmap-spot"
            cx={sample.xPercent}
            cy={sample.yPercent * 0.64}
            r={7 + index * 1.8}
            opacity={sample.confidence ? 0.2 + sample.confidence * 0.28 : 0.36}
          />
        ))}
        {clickEvents.map((click) => (
          <g key={click.id} className="click-marker" transform={`translate(${click.xPercent} ${click.yPercent * 0.64})`}>
            <circle r="3.2" />
            <path d="M -5 0 L 5 0 M 0 -5 L 0 5" />
          </g>
        ))}
      </svg>

      <p className="visual-note">Not real webcam tracking. Spots are plotted from mock gaze and click events.</p>
    </article>
  )
}
