import type { AreaOfInterest } from '../data/demoStudy'
import type { MockStudyEvent } from '../lib/mockEvents'
import { computeAoiAttentionSummary, extractGazeSamples } from '../lib/visualization'

type AoiBreakdownProps = {
  events: MockStudyEvent[]
  aois: AreaOfInterest[]
}

function formatDwellMs(value: number) {
  return `${(value / 1000).toFixed(1)}s`
}

export function AoiBreakdown({ events, aois }: AoiBreakdownProps) {
  const summary = computeAoiAttentionSummary(extractGazeSamples(events), aois)

  return (
    <article className="card synthetic-visual-card aoi-breakdown-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Demo-derived AOI attention</p>
          <h3>Region breakdown</h3>
        </div>
        <span className="status-pill pending">Synthetic only</span>
      </div>

      <div className="aoi-breakdown-list">
        {summary.map((aoi) => (
          <div className="aoi-breakdown-row" key={aoi.name}>
            <div className="aoi-breakdown-label">
              <strong>{aoi.name}</strong>
              <span>{aoi.role}</span>
            </div>
            <div className="aoi-breakdown-meter" aria-label={`${aoi.name}: ${aoi.sharePercent}% demo attention share`}>
              <span style={{ width: `${aoi.sharePercent}%` }} />
            </div>
            <dl className="aoi-breakdown-stats">
              <div>
                <dt>Samples</dt>
                <dd>{aoi.count}</dd>
              </div>
              <div>
                <dt>Demo dwell</dt>
                <dd>{formatDwellMs(aoi.dwellMs)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <p className="visual-note">Counts and dwell-like values come from synthetic gaze points inside AOI boxes.</p>
    </article>
  )
}
