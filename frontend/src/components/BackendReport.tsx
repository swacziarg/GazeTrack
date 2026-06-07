import type { BackendReportResult, BackendSessionReport } from '../api/reports'
import type { EventIngestResult } from '../api/events'
import { SessionReplay } from './SessionReplay'

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

function formatOptionalNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'Not available'
  }

  return String(value)
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

function formatDwell(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`
  }

  return `${value}ms`
}

function formatAttentionShare(value: number) {
  return `${value.toFixed(1)}%`
}

function getQualityPillClass(verdict: BackendSessionReport['quality_summary']['quality_verdict']) {
  if (verdict === 'pass') {
    return 'ok'
  }

  if (verdict === 'fail') {
    return 'error'
  }

  return 'pending'
}

function getQualityInterpretationClass(label: BackendSessionReport['quality_interpretation']['label']) {
  if (label === 'Usable') {
    return 'ok'
  }

  if (label === 'Limited') {
    return 'error'
  }

  return 'pending'
}

function renderAoiCallout(title: string, aoi: BackendSessionReport['first_noticed_aoi']) {
  if (!aoi) {
    return (
      <article className="backend-aoi-callout">
        <span>{title}</span>
        <strong>Not determinable</strong>
        <p>No fixation-backed AOI signal was available.</p>
      </article>
    )
  }

  return (
    <article className="backend-aoi-callout">
      <span>{title}</span>
      <strong>{aoi.label}</strong>
      <p>
        {formatDwell(aoi.dwell_time_ms)} dwell, {aoi.fixation_count} fixation
        {aoi.fixation_count === 1 ? '' : 's'}, {formatAttentionShare(aoi.attention_share_pct)} AOI share.
      </p>
    </article>
  )
}

function renderWeakAoiCallout(aois: BackendSessionReport['weak_or_ignored_aois']) {
  if (aois.length === 0) {
    return (
      <article className="backend-aoi-callout">
        <span>Weak attention</span>
        <strong>None flagged</strong>
        <p>No configured AOI fell below the weak-attention heuristic.</p>
      </article>
    )
  }

  return (
    <article className="backend-aoi-callout">
      <span>Weak attention</span>
      <strong>{aois.map((aoi) => aoi.label).join(', ')}</strong>
      <p>These AOIs were ignored or received less than 10.0% of AOI dwell in this demo session.</p>
    </article>
  )
}

function renderAttentionRanking(report: BackendSessionReport) {
  if (report.aoi_attention_ranking.length === 0) {
    return <p className="muted">No AOI attention ranking is available for this session.</p>
  }

  return (
    <div className="backend-ranking-table" role="table" aria-label="AOI attention ranking">
      <div className="backend-ranking-row heading" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">AOI</span>
        <span role="columnheader">Dwell</span>
        <span role="columnheader">Fixations</span>
        <span role="columnheader">TTFF</span>
        <span role="columnheader">Clicks</span>
        <span role="columnheader">Share</span>
      </div>
      {report.aoi_attention_ranking.map((item) => (
        <div className="backend-ranking-row" key={item.aoi_id} role="row">
          <span role="cell">#{item.rank}</span>
          <strong role="cell">{item.label}</strong>
          <span role="cell">{formatDwell(item.dwell_time_ms)}</span>
          <span role="cell">{item.fixation_count}</span>
          <span role="cell">
            {item.time_to_first_fixation_ms === null ? 'N/A' : formatDwell(item.time_to_first_fixation_ms)}
          </span>
          <span role="cell">{item.click_count}</span>
          <span role="cell">{formatAttentionShare(item.attention_share_pct)}</span>
        </div>
      ))}
    </div>
  )
}

function renderAoiMetrics(report: BackendSessionReport) {
  if (!report.has_aoi_metrics || report.aoi_metrics.length === 0) {
    return <p className="muted">No persisted AOIs are available for this session&apos;s study.</p>
  }

  return (
    <div className="backend-aoi-metric-list">
      {report.aoi_metrics.map((metric) => (
        <article className="backend-aoi-metric" key={metric.aoi_id}>
          <div className="backend-aoi-metric-heading">
            <strong>{metric.label}</strong>
            <span>{metric.coordinate_space}</span>
          </div>
          <dl>
            <div>
              <dt>Gaze samples</dt>
              <dd>{metric.gaze_sample_count}</dd>
            </div>
            <div>
              <dt>Dwell estimate</dt>
              <dd>{formatDwell(metric.approximate_dwell_ms)}</dd>
            </div>
            <div>
              <dt>Attention dwell</dt>
              <dd>{formatDwell(metric.dwell_time_ms)}</dd>
            </div>
            <div>
              <dt>Clicks inside</dt>
              <dd>{metric.click_count_inside_aoi}</dd>
            </div>
            <div>
              <dt>Fixations</dt>
              <dd>{metric.fixation_count}</dd>
            </div>
            <div>
              <dt>Fixation dwell</dt>
              <dd>{formatDwell(metric.fixation_dwell_ms)}</dd>
            </div>
            <div>
              <dt>First fixation</dt>
              <dd>{metric.first_fixation_timestamp ?? 'None'}</dd>
            </div>
            <div>
              <dt>TTFF</dt>
              <dd>
                {metric.time_to_first_fixation_ms === null
                  ? 'Not available'
                  : formatDwell(metric.time_to_first_fixation_ms)}
              </dd>
            </div>
            <div>
              <dt>CAF delay</dt>
              <dd>
                {metric.click_after_fixation_ms === null ? 'Not available' : formatDwell(metric.click_after_fixation_ms)}
              </dd>
            </div>
            <div>
              <dt>Attention share</dt>
              <dd>{formatAttentionShare(metric.attention_share_pct)}</dd>
            </div>
            <div>
              <dt>First gaze</dt>
              <dd>{metric.first_gaze_timestamp ?? 'None'}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
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
  const taskPrompts = report?.task_prompts ?? []

  return (
    <article className="card backend-report-panel" aria-live="polite">
      <div className="card-header">
        <div>
          <p className="eyebrow">Backend demo report</p>
          <h3>Persisted telemetry report</h3>
        </div>
        <span className={`status-pill ${reportResult?.ok ? 'ok' : 'pending'}`}>
          {isFetchingReport ? 'Loading' : reportResult?.ok ? 'Generated' : 'Demo only'}
        </span>
      </div>

      <p className="privacy-note compact">
        Backend report generated from SQLite-backed telemetry. Browser gaze sessions are experimental,
        approximate, and not medical-grade eye tracking.
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
              <dt>Analytics version</dt>
              <dd>{report.analytics_version}</dd>
            </div>
            <div>
              <dt>Study</dt>
              <dd>{report.study_name ?? 'Not available'}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{report.target_url ?? 'Not available'}</dd>
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
              <dt>Tracker mode</dt>
              <dd>{report.tracker_mode_label}</dd>
            </div>
            <div>
              <dt>Tracker type</dt>
              <dd>{report.tracker_type}</dd>
            </div>
            <div>
              <dt>Low-confidence sample rate</dt>
              <dd>{formatPercent(report.low_confidence_sample_rate)}</dd>
            </div>
            <div>
              <dt>Session quality score</dt>
              <dd>{formatQualityScore(report.session_quality_score)}</dd>
            </div>
            <div>
              <dt>Quality verdict</dt>
              <dd>
                <span className={`status-pill ${getQualityPillClass(report.quality_summary.quality_verdict)}`}>
                  {report.quality_summary.quality_verdict}
                </span>
              </dd>
            </div>
            <div>
              <dt>Tasks</dt>
              <dd>{report.task_count}</dd>
            </div>
            <div>
              <dt>AOIs</dt>
              <dd>{report.aoi_count}</dd>
            </div>
          </dl>

          {report.tracker_experimental && report.tracker_notice ? (
            <p className="backend-unavailable compact">{report.tracker_notice}</p>
          ) : null}

          <section className="backend-report-section">
            <h4>Executive summary</h4>
            <ul className="backend-insight-list">
              {report.report_summary.map((summary) => (
                <li key={summary}>{summary}</li>
              ))}
            </ul>
          </section>

          <section className="backend-report-section">
            <h4>Quality interpretation</h4>
            <div className={`backend-quality-banner ${getQualityInterpretationClass(report.quality_interpretation.label)}`}>
              <span className={`status-pill ${getQualityInterpretationClass(report.quality_interpretation.label)}`}>
                {report.quality_interpretation.label}
              </span>
              <p>{report.quality_interpretation.explanation}</p>
            </div>
          </section>

          <section className="backend-report-section">
            <h4>Attention callouts</h4>
            <div className="backend-aoi-callout-grid">
              {renderAoiCallout('First noticed', report.first_noticed_aoi)}
              {renderAoiCallout('Most attended', report.most_attended_aoi)}
              {renderWeakAoiCallout(report.weak_or_ignored_aois)}
            </div>
          </section>

          <section className="backend-report-section">
            <h4>AOI attention ranking</h4>
            {renderAttentionRanking(report)}
          </section>

          <section className="backend-report-section">
            <h4>Recommended next actions</h4>
            <ul className="backend-insight-list">
              {report.recommended_next_actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </section>

          {taskPrompts.length > 0 ? (
            <section className="backend-report-section">
              <h4>Task prompts</h4>
              <ul className="backend-insight-list">
                {taskPrompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="backend-report-section">
            <h4>Event type counts</h4>
            {renderEventTypeCounts(report)}
          </section>

          <section className="backend-report-section">
            <h4>Quality summary</h4>
            <dl className="backend-report-stats compact-grid">
              <div>
                <dt>Calibration events</dt>
                <dd>{report.quality_summary.calibration_event_count}</dd>
              </div>
              <div>
                <dt>Calibration targets</dt>
                <dd>{formatOptionalNumber(report.quality_summary.calibration_points_completed)}</dd>
              </div>
              <div>
                <dt>Calibration error</dt>
                <dd>
                  {report.quality_summary.average_calibration_error_px === null
                    ? 'Not available'
                    : `${report.quality_summary.average_calibration_error_px}px`}
                </dd>
              </div>
              <div>
                <dt>Gaze samples</dt>
                <dd>{report.quality_summary.gaze_sample_count}</dd>
              </div>
              <div>
                <dt>Avg gaze confidence</dt>
                <dd>{formatOptionalNumber(report.quality_summary.average_gaze_confidence)}</dd>
              </div>
            </dl>
            <ul className="backend-insight-list">
              {report.quality_summary.quality_reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <section className="backend-report-section">
            <h4>Fixation summary</h4>
            <dl className="backend-report-stats compact-grid">
              <div>
                <dt>Fixations</dt>
                <dd>{report.fixation_summary.fixation_count}</dd>
              </div>
              <div>
                <dt>Total fixation dwell</dt>
                <dd>{formatDwell(report.fixation_summary.total_fixation_dwell_ms)}</dd>
              </div>
              <div>
                <dt>Average duration</dt>
                <dd>
                  {report.fixation_summary.average_fixation_duration_ms === null
                    ? 'Not available'
                    : formatDwell(report.fixation_summary.average_fixation_duration_ms)}
                </dd>
              </div>
              <div>
                <dt>Average confidence</dt>
                <dd>{formatOptionalNumber(report.fixation_summary.average_fixation_confidence)}</dd>
              </div>
              <div>
                <dt>Algorithm</dt>
                <dd>{report.fixation_summary.fixation_algorithm}</dd>
              </div>
            </dl>
            <p className="muted compact-text">{report.fixation_summary.fixation_algorithm_notes}</p>
          </section>

          <section className="backend-report-section">
            <h4>AOI metrics</h4>
            {renderAoiMetrics(report)}
            <p className="muted compact-text">
              Fixation dwell uses demo-grade normalized-coordinate clustering and remains approximate.
            </p>
          </section>

          <section className="backend-report-section">
            <h4>Session replay</h4>
            <SessionReplay
              aoiOverlay={report.replay_aoi_overlay}
              events={report.replay_events}
              fixations={report.replay_fixations}
              summary={report.replay_summary}
            />
            <p className="muted compact-text">
              Replay is a schematic normalized-coordinate overlay generated from persisted telemetry, not video or
              screenshots.
            </p>
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
