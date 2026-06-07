export type BackendHealth = {
  ok: boolean
  statusCode?: number
  apiBaseUrl: string
  message: string
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000'

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  return (configuredUrl?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

export async function fetchBackendHealth(): Promise<BackendHealth> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        apiBaseUrl,
        message: `Backend responded with HTTP ${response.status}.`,
      }
    }

    return {
      ok: true,
      statusCode: response.status,
      apiBaseUrl,
      message: 'Backend health endpoint is reachable.',
    }
  } catch {
    return {
      ok: false,
      apiBaseUrl,
      message: 'Backend is offline or unreachable. Static demo data is still shown.',
    }
  }
}
