import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateMockStudyEvents } from '../lib/mockEvents'
import { ingestSessionEvents } from './events'

const sessionId = '11111111-1111-4111-8111-111111111111'

describe('ingestSessionEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts synthetic calibration and gaze telemetry to the backend event endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: sessionId,
        accepted_count: 58,
        rejected_count: 0,
        duplicate_count: 0,
        skipped_count: 0,
        stored_count_for_session: 58,
        note: 'Accepted privacy-safe telemetry is stored in local SQLite persistence.',
        rejected_reasons: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await ingestSessionEvents(sessionId, generateMockStudyEvents())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      events: Array<{ event_type: string; payload: Record<string, unknown> }>
    }

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/sessions/${sessionId}/events`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(body.events.some((event) => event.event_type === 'calibration')).toBe(true)
    expect(body.events.filter((event) => event.event_type === 'gaze').length).toBeGreaterThanOrEqual(30)
    expect(body.events.find((event) => event.event_type === 'calibration')?.payload).toEqual(
      expect.objectContaining({
        target_point: expect.any(Object),
        observed_point: expect.any(Object),
        error_px: expect.any(Number),
      }),
    )
  })
})
