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
  telemetrySourceLabel: string
  telemetrySourceIsExperimental: boolean
  ingestResult: EventIngestResult | null
  isIngestingEvents: boolean
  showVisuals?: boolean
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

export function DemoReport({
  report,
  events,
  aois,
  telemetrySourceLabel,
  telemetrySourceIsExperimental,
  ingestResult,
  isIngestingEvents,
  showVisuals = true,
}: DemoReportProps) {
  const response = ingestResult?.response
  const sourceDescription = telemetrySourceIsExperimental
    ? 'experimental browser gaze telemetry'
    : 'deterministic synthetic telemetry'

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
            ? `Sending ${sourceDescription} to the backend telemetry ingest endpoint.`
            : response?.note ?? `${telemetrySourceLabel} events have not been sent yet.`}
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

      {showVisuals ? (
        <div className="synthetic-visual-grid">
          <SyntheticHeatmapPreview
            events={events}
            aois={aois}
            telemetrySourceLabel={telemetrySourceLabel}
            telemetrySourceIsExperimental={telemetrySourceIsExperimental}
          />
          <GazePathPreview
            events={events}
            aois={aois}
            telemetrySourceLabel={telemetrySourceLabel}
            telemetrySourceIsExperimental={telemetrySourceIsExperimental}
          />
          <AoiBreakdown events={events} aois={aois} telemetrySourceLabel={telemetrySourceLabel} />
        </div>
      ) : null}

      <div className="insight-grid">
        {report.insights.map((insight) => (
          <article className="card insight-card" key={insight}>
            <p>{insight}</p>
            <span>{telemetrySourceLabel} insight</span>
          </article>
        ))}
      </div>

      <p className="privacy-note report-note">
        {telemetrySourceIsExperimental
          ? 'Experimental browser gaze sessions are approximate, opt-in, and not medical-grade. '
          : 'Synthetic demo sessions use deterministic gaze/event telemetry and do not request camera permission. '}
        GazeTrack is designed to store telemetry only, not webcam video, frames, screenshots, image blobs, or base64
        media.
      </p>
    </article>
  )
}
