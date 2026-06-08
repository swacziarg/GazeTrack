import type { AreaOfInterest } from '../data/demoStudy'
import type { MockStudyEvent } from '../lib/mockEvents'
import { computeHeatmapClusters, extractClickEvents, extractGazeSamples } from '../lib/visualization'

type SyntheticHeatmapPreviewProps = {
  events: MockStudyEvent[]
  aois: AreaOfInterest[]
  telemetrySourceLabel?: string
  telemetrySourceIsExperimental?: boolean
}

export function SyntheticHeatmapPreview({
  events,
  aois,
  telemetrySourceLabel = 'Synthetic telemetry',
  telemetrySourceIsExperimental = false,
}: SyntheticHeatmapPreviewProps) {
  const gazeSamples = extractGazeSamples(events)
  const clickEvents = extractClickEvents(events)
  const heatmapClusters = computeHeatmapClusters(gazeSamples)
  const hasGazeSamples = gazeSamples.length > 0
  const title = telemetrySourceIsExperimental ? 'Browser gaze heatmap preview' : 'Synthetic demo heatmap preview'

  return (
    <article className="card synthetic-visual-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>Attention density</h3>
        </div>
        <span className="status-pill pending">{telemetrySourceLabel}</span>
      </div>

      <svg className="mock-page-surface" viewBox="0 0 100 64" role="img" aria-label={title}>
        <defs>
          <radialGradient id="heatmap-cluster-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d84f3f" stopOpacity="0.78" />
            <stop offset="45%" stopColor="#e8b24c" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#e8b24c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect className="mock-page-background" x="0" y="0" width="100" height="64" rx="2" />
        <rect className="mock-page-nav" x="6" y="5" width="88" height="7" rx="1.5" />
        <rect className="mock-page-hero" x="8" y="17" width="84" height="24" rx="2" />
        <rect className="mock-page-table" x="14" y="47" width="72" height="10" rx="1.5" />
        {hasGazeSamples ? (
          <g className="heatmap-layer">
            {heatmapClusters.map((cluster) => (
              <circle
                key={cluster.id}
                className="heatmap-spot"
                cx={cluster.xPercent}
                cy={cluster.yPercent * 0.64}
                r={Math.min(18, 5 + cluster.sampleCount * 1.2)}
                opacity={cluster.averageConfidence ? 0.34 + cluster.averageConfidence * 0.22 : 0.44}
              />
            ))}
          </g>
        ) : (
          <text className="mock-page-empty-label" x="50" y="34">
            No gaze samples
          </text>
        )}
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
        {clickEvents.map((click) => (
          <g key={click.id} className="click-marker" transform={`translate(${click.xPercent} ${click.yPercent * 0.64})`}>
            <circle r="3.2" />
            <path d="M -5 0 L 5 0 M 0 -5 L 0 5" />
          </g>
        ))}
      </svg>

      <p className="visual-note">
        {telemetrySourceIsExperimental
          ? 'Approximate gaze estimates are plotted from browser telemetry; no video or screenshots are stored.'
          : 'Spots are plotted from synthetic gaze and click events.'}
      </p>
    </article>
  )
}
