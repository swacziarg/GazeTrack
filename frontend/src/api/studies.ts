export type BackendStudy = {
  study_id: string
  name: string
  objective: string | null
  target_url: string | null
  status: 'placeholder' | 'active'
  persistence: 'not_implemented' | 'sqlite'
  created_at: string
}

export type StudyTask = {
  task_id: string
  study_id: string
  title: string
  prompt: string
  success_criteria: string | null
  target_url: string | null
  created_at: string
}

export type StudyAoi = {
  aoi_id: string
  study_id: string
  label: string
  page_url: string | null
  x: number
  y: number
  width: number
  height: number
  coordinate_space: 'normalized'
  created_at: string
}

export type StudySetupResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  study: BackendStudy | null
  tasks: StudyTask[]
  aois: StudyAoi[]
  message: string
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000'
const DEMO_STUDY_ID = '00000000-0000-4000-8000-000000000001'

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  return (configuredUrl?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

async function fetchJson<T>(url: string): Promise<{ ok: true; status: number; body: T } | { ok: false; status: number }> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    return { ok: false, status: response.status }
  }

  return { ok: true, status: response.status, body: (await response.json()) as T }
}

export async function fetchStudySetup(): Promise<StudySetupResult> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const studiesResult = await fetchJson<BackendStudy[]>(`${apiBaseUrl}/api/v1/studies`)
    if (!studiesResult.ok) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: studiesResult.status,
        study: null,
        tasks: [],
        aois: [],
        message: `Backend responded with HTTP ${studiesResult.status}.`,
      }
    }

    const study = studiesResult.body.find((item) => item.study_id === DEMO_STUDY_ID) ?? studiesResult.body[0] ?? null
    if (!study) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: studiesResult.status,
        study: null,
        tasks: [],
        aois: [],
        message: 'Backend returned no persisted studies.',
      }
    }

    const [tasksResult, aoisResult] = await Promise.all([
      fetchJson<StudyTask[]>(`${apiBaseUrl}/api/v1/studies/${encodeURIComponent(study.study_id)}/tasks`),
      fetchJson<StudyAoi[]>(`${apiBaseUrl}/api/v1/studies/${encodeURIComponent(study.study_id)}/aois`),
    ])

    if (!tasksResult.ok || !aoisResult.ok) {
      const statusCode = !tasksResult.ok ? tasksResult.status : aoisResult.status
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode,
        study,
        tasks: [],
        aois: [],
        message: `Backend responded with HTTP ${statusCode}.`,
      }
    }

    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: studiesResult.status,
      study,
      tasks: tasksResult.body,
      aois: aoisResult.body,
      message: 'Persisted study setup loaded from the backend.',
    }
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      study: null,
      tasks: [],
      aois: [],
      message: 'Backend unavailable — showing local demo study setup only.',
    }
  }
}
