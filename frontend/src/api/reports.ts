export type BackendSessionReport = {
  session_id: string
  study_id: string | null
  report_status: 'placeholder'
  generated_at: string
  event_count: number
  event_type_counts: Record<string, number>
  first_event_timestamp: string | null
  last_event_timestamp: string | null
  contains_gaze_events: boolean
  low_confidence_sample_rate: number | null
  session_quality_score: number | null
  completed: boolean
  insights: string[]
  metrics: Record<string, unknown>
  notes: string[]
}

export type BackendReportResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  report: BackendSessionReport | null
  message: string
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000'

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  return (configuredUrl?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

export async function fetchSessionReport(sessionId: string): Promise<BackendReportResult> {
  const apiBaseUrl = getApiBaseUrl()
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/report`, {
      headers: {
        Accept: 'application/json',
      },
    })
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      report: null,
      message: 'Backend unavailable — showing local demo report only.',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      report: null,
      message: `Backend responded with HTTP ${response.status}.`,
    }
  }

  try {
    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      report: (await response.json()) as BackendSessionReport,
      message: 'Backend demo report generated from process-local telemetry.',
    }
  } catch {
    return {
      ok: false,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      report: null,
      message: 'Backend returned an unreadable demo report payload.',
    }
  }
}
