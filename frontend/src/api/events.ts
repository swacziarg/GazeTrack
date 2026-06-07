import { toBackendEventBatchPayload } from '../lib/eventContract'
import type { MockStudyEvent } from '../lib/mockEvents'

export type EventIngestResponse = {
  session_id: string
  accepted_count: number
  rejected_count: number
  note: string
  rejected_reasons: string[]
}

export type EventIngestResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  response: EventIngestResponse
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000'

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  return (configuredUrl?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

function createFallbackResponse(sessionId: string, note: string): EventIngestResponse {
  return {
    session_id: sessionId,
    accepted_count: 0,
    rejected_count: 0,
    note,
    rejected_reasons: [],
  }
}

export async function ingestSessionEvents(sessionId: string, events: MockStudyEvent[]): Promise<EventIngestResult> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toBackendEventBatchPayload(events)),
    })

    if (!response.ok) {
      return {
        ok: false,
        backendAvailable: true,
        apiBaseUrl,
        statusCode: response.status,
        response: createFallbackResponse(sessionId, `Backend responded with HTTP ${response.status}.`),
      }
    }

    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      response: (await response.json()) as EventIngestResponse,
    }
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      response: createFallbackResponse(sessionId, 'Backend unavailable — showing local demo report only.'),
    }
  }
}
