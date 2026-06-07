import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSessionReport, type BackendSessionReport } from './reports'

const sessionId = '11111111-1111-4111-8111-111111111111'

const reportFixture: BackendSessionReport = {
  session_id: sessionId,
  study_id: null,
  report_status: 'placeholder',
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
  completed: false,
  insights: ['Backend demo report generated from in-memory synthetic telemetry.'],
  metrics: {},
  notes: ['Backend report is computed from process-local demo memory only.'],
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
