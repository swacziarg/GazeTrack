export type HealthStatus = {
  ok: boolean
  statusCode?: number
  message: string
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000'

export async function getHealthStatus(): Promise<HealthStatus> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL

  try {
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        message: `Backend responded with HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      statusCode: response.status,
      message: 'Backend is reachable.',
    }
  } catch {
    return {
      ok: false,
      message: 'Backend is unreachable. Start the API server and verify VITE_API_BASE_URL.',
    }
  }
}
