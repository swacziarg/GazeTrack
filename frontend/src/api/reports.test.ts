import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSessionReport, type BackendSessionReport } from './reports'

const sessionId = '11111111-1111-4111-8111-111111111111'

const reportFixture: BackendSessionReport = {
  session_id: sessionId,
  study_id: null,
  study_name: 'Checkout study',
  study_objective: 'Measure checkout discovery',
  target_url: 'https://example.test/checkout',
  analytics_version: 'fixation_demo_v1',
  report_status: 'persisted',
  generated_at: '2026-01-15T17:31:00.000Z',
  event_count: 8,
  event_type_counts: {
    gaze: 3,
    click: 1,
    task_complete: 1,
  },
  first_event_timestamp: '2026-01-15T17:30:00.000Z',
  last_event_timestamp: '2026-01-15T17:30:22.800Z',
  contains_gaze_events: true,
  low_confidence_sample_rate: 0.333,
  session_quality_score: 76.4,
  tracker_type: 'synthetic',
  tracker_mode_label: 'Synthetic demo telemetry',
  tracker_experimental: false,
  tracker_notice: null,
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
      gaze_sample_count: 2,
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

describe('fetchSessionReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a typed backend report result for a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => reportFixture,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSessionReport(sessionId)

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/sessions/${sessionId}/report`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        backendAvailable: true,
        statusCode: 200,
        report: expect.objectContaining({
          session_id: sessionId,
          event_count: 8,
          contains_gaze_events: true,
        }),
      }),
    )
  })

  it('returns an unavailable result instead of throwing when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(fetchSessionReport(sessionId)).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        backendAvailable: false,
        report: null,
        message: 'Backend unavailable — showing local demo report only.',
      }),
    )
  })
})
