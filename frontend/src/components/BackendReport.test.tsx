import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BackendReportResult, BackendSessionReport } from '../api/reports'
import { BackendReport } from './BackendReport'

const report: BackendSessionReport = {
  session_id: '11111111-1111-4111-8111-111111111111',
  study_id: '00000000-0000-4000-8000-000000000001',
  study_name: 'Checkout study',
  study_objective: 'Measure checkout discovery',
  target_url: 'https://example.test/checkout',
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
  task_prompts: ['Find checkout.'],
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

  it('renders SessionReplay when backend replay data exists', () => {
    const reportWithReplay: BackendSessionReport = {
      ...report,
      replay_summary: {
        event_count: 3,
        gaze_event_count: 1,
        fixation_count: 1,
        click_count: 1,
        scroll_count: 0,
        task_event_count: 0,
        duration_ms: 2000,
        coordinate_space: 'normalized',
      },
      replay_aoi_overlay: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          label: 'Primary CTA',
          x: 0.52,
          y: 0.38,
          width: 0.2,
          height: 0.12,
          coordinate_space: 'normalized',
        },
      ],
      replay_events: [
        {
          id: 'event-0001',
          type: 'gaze',
          timestamp: '2026-01-15T17:30:01.000Z',
          relative_ms: 1000,
          x: 0.61,
          y: 0.43,
          confidence: 0.9,
          aoi_ids: ['33333333-3333-4333-8333-333333333333'],
        },
        {
          id: 'event-0002',
          type: 'click',
          timestamp: '2026-01-15T17:30:02.000Z',
          relative_ms: 2000,
          x: 0.62,
          y: 0.44,
          confidence: 0.9,
          aoi_ids: ['33333333-3333-4333-8333-333333333333'],
        },
      ],
      replay_fixations: [
        {
          id: 'fixation-001',
          type: 'fixation',
          start_timestamp: '2026-01-15T17:30:01.000Z',
          end_timestamp: '2026-01-15T17:30:01.160Z',
          start_relative_ms: 1000,
          end_relative_ms: 1160,
          duration_ms: 160,
          x: 0.615,
          y: 0.435,
          sample_count: 3,
          average_confidence: 0.86,
          aoi_ids: ['33333333-3333-4333-8333-333333333333'],
        },
      ],
    }

    const html = renderToStaticMarkup(
      <BackendReport
        ingestResult={null}
        isFetchingReport={false}
        reportResult={{ ...reportResult, report: reportWithReplay }}
      />,
    )

    expect(html).toContain('Session replay')
    expect(html).toContain('Normalized-coordinate session replay')
    expect(html).toContain('Primary CTA')
    expect(html).toContain('replay-click-marker')
  })

  it('does not crash when backend replay data is missing', () => {
    const html = renderToStaticMarkup(
      <BackendReport ingestResult={null} isFetchingReport={false} reportResult={reportResult} />,
    )

    expect(html).toContain('Replay unavailable for this report.')
  })
})
