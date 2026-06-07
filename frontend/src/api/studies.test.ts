import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchStudySetup } from './studies'

const studyId = '00000000-0000-4000-8000-000000000001'

describe('fetchStudySetup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the demo study with persisted tasks and AOIs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            study_id: studyId,
            name: 'Synthetic demo study',
            objective: 'Default local study',
            target_url: null,
            status: 'active',
            persistence: 'sqlite',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            task_id: '22222222-2222-4222-8222-222222222222',
            study_id: studyId,
            title: 'Find the main call to action',
            prompt: 'Explore the page.',
            success_criteria: 'CTA clicked.',
            target_url: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            aoi_id: '33333333-3333-4333-8333-333333333333',
            study_id: studyId,
            label: 'Primary CTA',
            page_url: null,
            x: 0.52,
            y: 0.38,
            width: 0.2,
            height: 0.12,
            coordinate_space: 'normalized',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchStudySetup()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/studies',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/studies/${studyId}/tasks`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/studies/${studyId}/aois`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        study: expect.objectContaining({ study_id: studyId }),
        tasks: [expect.objectContaining({ title: 'Find the main call to action' })],
        aois: [expect.objectContaining({ label: 'Primary CTA' })],
      }),
    )
  })

  it('returns an unavailable result when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(fetchStudySetup()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        backendAvailable: false,
        study: null,
        tasks: [],
        aois: [],
      }),
    )
  })
})
