import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudySession, fetchInstallVerification, fetchStudySetup, saveStudyConfiguration } from './studies'

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
            allowed_origins: [],
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
            semantic_type: 'CTA',
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

  it('saves a study configuration with normalized AOIs', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        study: {
          study_id: studyId,
          name: 'Checkout study',
          objective: 'Measure checkout discovery',
          target_url: 'https://example.test/checkout',
          allowed_origins: ['https://example.test'],
          status: 'active',
          persistence: 'sqlite',
          created_at: '2026-01-01T00:00:00Z',
        },
        tasks: [],
        aois: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveStudyConfiguration({
      name: 'Checkout study',
      objective: 'Measure checkout discovery',
      target_url: 'https://example.test/checkout',
      tasks: [{ title: 'Task 1', prompt: 'Find checkout.', target_url: 'https://example.test/checkout' }],
      aois: [
        {
          label: 'Checkout CTA',
          semantic_type: 'CTA',
          page_url: 'https://example.test/checkout',
          x: 0.5,
          y: 0.4,
          width: 0.2,
          height: 0.1,
          coordinate_space: 'normalized',
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/studies/configurations',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"label":"Checkout CTA"'),
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.study?.name).toBe('Checkout study')
  })

  it('creates a backend session for a configured study', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: '44444444-4444-4444-8444-444444444444',
        study_id: studyId,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createStudySession(studyId)

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/studies/${studyId}/sessions`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.sessionId).toBe('44444444-4444-4444-8444-444444444444')
  })

  it('loads install verification for the saved study', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        study_id: studyId,
        expected_script_path: '/sdk/v0.2/gazetrack-capture.js',
        expected_script_url: 'http://localhost:8000/sdk/v0.2/gazetrack-capture.js',
        capture_token_exists: true,
        target_url: 'https://example.test/checkout',
        allowed_origins: ['https://example.test'],
        recommended_snippet: '<script src="http://localhost:8000/sdk/v0.2/gazetrack-capture.js" async></script>',
        aois: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchInstallVerification(studyId)

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/studies/${studyId}/install-verification`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(result.ok).toBe(true)
    expect(result.verification?.expected_script_path).toBe('/sdk/v0.2/gazetrack-capture.js')
  })
})
