import type { BackendReportResult, BackendSessionReport } from '../api/reports'
import type { EventIngestResult } from '../api/events'

type BackendReportProps = {
  ingestResult: EventIngestResult | null
  isFetchingReport: boolean
  reportResult: BackendReportResult | null
}

function formatPercent(value: number | null) {
  if (value === null) {
    return 'Not available'
  }

  return `${Math.round(value * 100)}%`
}

function formatQualityScore(value: number | null) {
  if (value === null) {
    return 'Not available'
  }

  return `${value.toFixed(1)} / 100`
}

function getStatusLabel(report: BackendSessionReport) {
  if (report.completed) {
    return 'Stored / completed'
  }

  return report.event_count > 0 ? 'Stored / not completed' : 'No stored events'
}

function renderEventTypeCounts(report: BackendSessionReport) {
  const entries = Object.entries(report.event_type_counts)

  if (entries.length === 0) {
    return <p className="muted">No event type counts are available for this session.</p>
  }

  return (
    <dl className="backend-count-list">
      {entries.map(([eventType, count]) => (
        <div key={eventType}>
          <dt>{eventType}</dt>
          <dd>{count}</dd>
        </div>
      ))}
    </dl>
  )
}

function getUnavailableMessage(ingestResult: EventIngestResult | null, reportResult: BackendReportResult | null) {
  if (reportResult && !reportResult.ok) {
    return reportResult.message
  }

  if (ingestResult && !ingestResult.ok) {
    return 'Backend unavailable — showing local demo report only.'
  }

  return 'Backend demo report is waiting for successful synthetic event ingest.'
}

export function BackendReport({ ingestResult, isFetchingReport, reportResult }: BackendReportProps) {
  const report = reportResult?.report

  return (
    <article className="card backend-report-panel" aria-live="polite">
      <div className="card-header">
        <div>
          <p className="eyebrow">Backend demo report</p>
          <h3>Process-local telemetry report</h3>
        </div>
        <span className={`status-pill ${reportResult?.ok ? 'ok' : 'pending'}`}>
          {isFetchingReport ? 'Loading' : reportResult?.ok ? 'Generated' : 'Demo only'}
        </span>
      </div>

      <p className="privacy-note compact">
        Backend demo report generated from process-local synthetic telemetry. This is not real gaze tracking or a
        production analytics job.
      </p>

      {isFetchingReport ? <p>Loading backend demo report from the local API.</p> : null}

      {!isFetchingReport && !report ? (
        <p className="backend-unavailable">{getUnavailableMessage(ingestResult, reportResult)}</p>
      ) : null}

      {report ? (
        <>
          <dl className="backend-report-stats">
            <div>
              <dt>Session ID</dt>
              <dd className="mono-value">{report.session_id}</dd>
            </div>
            <div>
              <dt>Event count</dt>
              <dd>{report.event_count}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{getStatusLabel(report)}</dd>
            </div>
            <div>
              <dt>Contains gaze events</dt>
              <dd>{report.contains_gaze_events ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Low-confidence sample rate</dt>
              <dd>{formatPercent(report.low_confidence_sample_rate)}</dd>
            </div>
            <div>
              <dt>Session quality score</dt>
              <dd>{formatQualityScore(report.session_quality_score)}</dd>
            </div>
          </dl>

          <section className="backend-report-section">
            <h4>Event type counts</h4>
            {renderEventTypeCounts(report)}
          </section>

          <section className="backend-report-section">
            <h4>Insights</h4>
            <ul className="backend-insight-list">
              {report.insights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </article>
  )
}
