import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BackendReportResult, BackendSessionReport } from '../api/reports'
import { BackendReport } from './BackendReport'

const report: BackendSessionReport = {
  session_id: '11111111-1111-4111-8111-111111111111',
  study_id: '00000000-0000-4000-8000-000000000001',
  analytics_version: 'fixation_demo_v1',
  report_status: 'persisted',
  generated_at: '2026-01-15T17:31:00.000Z',
  event_count: 8,
  event_type_counts: { gaze: 3, click: 1 },
  first_event_timestamp: '2026-01-15T17:30:00.000Z',
  last_event_timestamp: '2026-01-15T17:30:22.800Z',
  contains_gaze_events: true,
  low_confidence_sample_rate: 0.333,
  session_quality_score: 76.4,
  task_count: 1,
  aoi_count: 1,
  has_aoi_metrics: true,
  aoi_metrics: [
    {
      aoi_id: '33333333-3333-4333-8333-333333333333',
      label: 'Primary CTA',
      page_url: null,
      coordinate_space: 'normalized',
      gaze_sample_count: 3,
      first_gaze_timestamp: '2026-01-15T17:30:09.400Z',
      approximate_dwell_ms: 300,
      click_count_inside_aoi: 1,
      fixation_count: 1,
      fixation_dwell_ms: 160,
      first_fixation_timestamp: '2026-01-15T17:30:09.400Z',
      time_to_first_fixation_ms: 9400,
      average_fixation_confidence: 0.86,
    },
  ],
  completed: false,
  insights: ['Backend demo report generated from persisted SQLite telemetry.'],
  metrics: {},
  privacy_summary: { raw_media_stored: false },
  fixation_summary: {
    fixation_count: 1,
    total_fixation_dwell_ms: 160,
    average_fixation_duration_ms: 160,
    average_fixation_confidence: 0.86,
    fixation_algorithm: 'simple_dispersion_v1',
    fixation_algorithm_notes: 'Demo-grade normalized-coordinate clustering.',
  },
  quality_summary: {
    score: 76.4,
    low_confidence_threshold: 0.5,
    low_confidence_sample_rate: 0.333,
    gaze_sample_count: 3,
    average_gaze_confidence: 0.72,
    calibration_event_count: 1,
    calibration_points_completed: null,
    average_calibration_error_px: 42,
    average_calibration_error_normalized: null,
    quality_event_count: 0,
    sample_integrity_basis_event_count: 8,
    sample_completeness_score: 1,
    quality_verdict: 'warn',
    quality_reasons: ['Low-confidence gaze sample rate is above 35%.'],
  },
  notes: ['Backend report is computed from persisted local SQLite telemetry.'],
}

const reportResult: BackendReportResult = {
  ok: true,
  backendAvailable: true,
  apiBaseUrl: 'http://localhost:8000',
  statusCode: 200,
  report,
  message: 'Backend demo report generated from persisted telemetry.',
}

describe('BackendReport', () => {
  it('renders fixation summary, quality verdict, reasons, and AOI fixation fields', () => {
    const html = renderToStaticMarkup(
      <BackendReport ingestResult={null} isFetchingReport={false} reportResult={reportResult} />,
    )

    expect(html).toContain('Fixation summary')
    expect(html).toContain('simple_dispersion_v1')
    expect(html).toContain('Quality verdict')
    expect(html).toContain('Calibration events')
    expect(html).toContain('warn')
    expect(html).toContain('Low-confidence gaze sample rate is above 35%.')
    expect(html).toContain('Fixation dwell')
    expect(html).toContain('160ms')
  })
})
