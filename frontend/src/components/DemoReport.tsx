import { MetricCard } from './MetricCard'
import type { EventIngestResult } from '../api/events'
import type { AreaOfInterest } from '../data/demoStudy'
import { AoiBreakdown } from './AoiBreakdown'
import { GazePathPreview } from './GazePathPreview'
import { SyntheticHeatmapPreview } from './SyntheticHeatmapPreview'
import type { DemoReportData } from '../lib/mockReport'
import type { MockStudyEvent } from '../lib/mockEvents'

type DemoReportProps = {
  report: DemoReportData
  events: MockStudyEvent[]
  aois: AreaOfInterest[]
  ingestResult: EventIngestResult | null
  isIngestingEvents: boolean
}

function getIngestStatusLabel(ingestResult: EventIngestResult | null, isIngestingEvents: boolean) {
  if (isIngestingEvents) {
    return 'Sending'
  }

  if (!ingestResult) {
    return 'Pending'
  }

  if (ingestResult.ok) {
    return 'Accepted'
  }

  return ingestResult.backendAvailable ? 'Rejected' : 'Unavailable'
}

function getIngestStatusClass(ingestResult: EventIngestResult | null, isIngestingEvents: boolean) {
  if (isIngestingEvents || !ingestResult) {
    return 'pending'
  }

  return ingestResult.ok ? 'ok' : 'error'
}

export function DemoReport({ report, events, aois, ingestResult, isIngestingEvents }: DemoReportProps) {
  const response = ingestResult?.response

  return (
    <article className="report-panel">
      <div className="section-heading">
        <p className="eyebrow">Generated from local state</p>
        <h2>Demo report</h2>
      </div>

      <section className="card ingest-status-panel" aria-live="polite">
        <div className="card-header">
          <div>
            <p className="eyebrow">Backend telemetry ingest</p>
            <h3>Ingest status</h3>
          </div>
          <span className={`status-pill ${getIngestStatusClass(ingestResult, isIngestingEvents)}`}>
            {getIngestStatusLabel(ingestResult, isIngestingEvents)}
          </span>
        </div>

        <dl className="ingest-stats">
          <div>
            <dt>Accepted</dt>
            <dd>{response?.accepted_count ?? 0}</dd>
          </div>
          <div>
            <dt>Rejected</dt>
            <dd>{response?.rejected_count ?? 0}</dd>
          </div>
          <div>
            <dt>Stored</dt>
            <dd>{response?.stored_count_for_session ?? 0}</dd>
          </div>
        </dl>

        <p>
          {isIngestingEvents
            ? 'Sending synthetic events to the backend telemetry ingest endpoint.'
            : response?.note ?? 'Synthetic events have not been sent yet.'}
        </p>
        {ingestResult ? <p className="muted">POST {ingestResult.apiBaseUrl}/api/v1/sessions/:session_id/events</p> : null}
        {response && response.rejected_reasons.length > 0 ? (
          <ul className="ingest-rejections">
            {response.rejected_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="metric-grid report-metrics">
        {report.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} />
        ))}
      </div>

      <div className="synthetic-visual-grid">
        <SyntheticHeatmapPreview events={events} aois={aois} />
        <GazePathPreview events={events} aois={aois} />
        <AoiBreakdown events={events} aois={aois} />
      </div>

      <div className="insight-grid">
        {report.insights.map((insight) => (
          <article className="card insight-card" key={insight}>
            <p>{insight}</p>
            <span>Synthetic demo insight</span>
          </article>
        ))}
      </div>

      <p className="privacy-note report-note">
        Demo sessions use synthetic gaze/event telemetry. GazeTrack is designed to store telemetry only,
        not webcam video.
      </p>
    </article>
  )
}
