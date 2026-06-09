export type BackendStudy = {
  study_id: string
  name: string
  objective: string | null
  target_url: string | null
  allowed_origins: string[]
  status: 'placeholder' | 'active'
  persistence: 'not_implemented' | 'sqlite'
  created_at: string
  updated_at?: string | null
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
  semantic_type: string | null
  role_key?: string | null
  selector?: string | null
  required?: boolean
  page_url: string | null
  x: number
  y: number
  width: number
  height: number
  coordinate_space: 'normalized'
  created_at: string
}

export type StudyConfigurationPayload = {
  name: string
  objective: string | null
  target_url: string | null
  allowed_origins?: string[]
  tasks: Array<{
    title: string
    prompt: string
    success_criteria?: string | null
    target_url: string | null
  }>
  aois: Array<{
    label: string
    semantic_type: string | null
    role_key?: string | null
    selector?: string | null
    required?: boolean
    page_url: string | null
    x: number
    y: number
    width: number
    height: number
    coordinate_space: 'normalized'
  }>
}

export type StudyConfigurationResponse = {
  study: BackendStudy
  tasks: StudyTask[]
  aois: StudyAoi[]
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

export type StudySaveResult = StudySetupResult

export type CaptureConfigAoi = {
  aoi_id: string
  label: string
  semantic_type: string | null
  role_key: string
  selector: string | null
  required: boolean
}

export type CaptureConfig = {
  study_id: string
  name: string
  objective: string | null
  target_url: string | null
  task_prompt: string
  aois: CaptureConfigAoi[]
}

export type CaptureSnippetConfig = CaptureConfig & {
  capture_token: string
}

export type InstallVerification = {
  study_id: string
  expected_script_path: string
  expected_script_url: string
  capture_token_exists: boolean
  target_url: string | null
  allowed_origins: string[]
  aois: CaptureConfigAoi[]
  recommended_snippet: string
}

export type CaptureConfigResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  config: CaptureSnippetConfig | null
  message: string
}

export type InstallVerificationResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  verification: InstallVerification | null
  message: string
}

export type StudySessionCreateResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  sessionId: string | null
  studyId: string | null
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

async function sendJson<T>(
  url: string,
  method: 'POST' | 'PUT',
  body: unknown,
): Promise<{ ok: true; status: number; body: T } | { ok: false; status: number; message: string }> {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return { ok: false, status: response.status, message: `Backend responded with HTTP ${response.status}.` }
  }

  return { ok: true, status: response.status, body: (await response.json()) as T }
}

function setupResultFromConfiguration(
  apiBaseUrl: string,
  statusCode: number,
  configuration: StudyConfigurationResponse,
): StudySetupResult {
  return {
    ok: true,
    backendAvailable: true,
    apiBaseUrl,
    statusCode,
    study: configuration.study,
    tasks: configuration.tasks,
    aois: configuration.aois,
    message: 'Persisted study setup saved to the backend.',
  }
}

export async function saveStudyConfiguration(
  payload: StudyConfigurationPayload,
  existingStudyId?: string | null,
): Promise<StudySaveResult> {
  const apiBaseUrl = getApiBaseUrl()
  const url = existingStudyId
    ? `${apiBaseUrl}/api/v1/studies/${encodeURIComponent(existingStudyId)}/configuration`
    : `${apiBaseUrl}/api/v1/studies/configurations`
  const method = existingStudyId ? 'PUT' : 'POST'

  try {
    const result = await sendJson<StudyConfigurationResponse>(url, method, payload)
    if (!result.ok) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: result.status,
        study: null,
        tasks: [],
        aois: [],
        message: result.message,
      }
    }

    return setupResultFromConfiguration(apiBaseUrl, result.status, result.body)
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      study: null,
      tasks: [],
      aois: [],
      message: 'Backend unavailable — study setup is only local until it can be saved.',
    }
  }
}

export async function createStudySession(studyId: string): Promise<StudySessionCreateResult> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const result = await sendJson<{ session_id: string; study_id: string }>(
      `${apiBaseUrl}/api/v1/studies/${encodeURIComponent(studyId)}/sessions`,
      'POST',
      {},
    )

    if (!result.ok) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: result.status,
        sessionId: null,
        studyId: null,
        message: result.message,
      }
    }

    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: result.status,
      sessionId: result.body.session_id,
      studyId: result.body.study_id,
      message: 'Backend session created for the configured study.',
    }
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      sessionId: null,
      studyId: null,
      message: 'Backend unavailable — using a local fallback session ID.',
    }
  }
}

export async function fetchCaptureConfig(studyId: string): Promise<CaptureConfigResult> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const result = await fetchJson<CaptureSnippetConfig>(
      `${apiBaseUrl}/api/v1/studies/${encodeURIComponent(studyId)}/capture-snippet-config`,
    )
    if (!result.ok) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: result.status,
        config: null,
        message: `Backend responded with HTTP ${result.status}.`,
      }
    }

    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: result.status,
      config: result.body,
      message: 'Capture snippet configuration loaded.',
    }
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      config: null,
      message: 'Backend unavailable - capture snippet cannot be generated yet.',
    }
  }
}

export async function fetchInstallVerification(studyId: string): Promise<InstallVerificationResult> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const result = await fetchJson<InstallVerification>(
      `${apiBaseUrl}/api/v1/studies/${encodeURIComponent(studyId)}/install-verification`,
    )
    if (!result.ok) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: result.status,
        verification: null,
        message: `Backend responded with HTTP ${result.status}.`,
      }
    }

    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: result.status,
      verification: result.body,
      message: 'Install verification loaded.',
    }
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      verification: null,
      message: 'Backend unavailable - install verification cannot be loaded yet.',
    }
  }
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
