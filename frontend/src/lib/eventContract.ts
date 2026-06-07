import type { MockStudyEvent } from './mockEvents'

export type BackendEventType =
  | 'gaze'
  | 'click'
  | 'scroll'
  | 'task_start'
  | 'task_complete'
  | 'calibration'
  | 'quality'
  | 'page_view'

export type BackendEventEnvelope = {
  event_type: BackendEventType
  timestamp: string
  payload: Record<string, unknown>
}

export type BackendEventBatchPayload = {
  events: BackendEventEnvelope[]
}

const MEDIA_LIKE_KEY_TOKENS = ['video', 'frame', 'image', 'base64', 'blob', 'webcam_frame']

const EVENT_TYPE_MAP: Record<MockStudyEvent['event_type'], BackendEventType> = {
  task_started: 'task_start',
  calibration_completed: 'calibration',
  gaze_sample_recorded: 'gaze',
  click_recorded: 'click',
  scroll_recorded: 'scroll',
  task_completed: 'task_complete',
}

function isMediaLikeKey(key: string) {
  const normalizedKey = key.toLowerCase()
  return MEDIA_LIKE_KEY_TOKENS.some((token) => normalizedKey.includes(token))
}

function removeMediaLikeFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeMediaLikeFields)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isMediaLikeKey(key))
        .map(([key, nestedValue]) => [key, removeMediaLikeFields(nestedValue)]),
    )
  }

  return value
}

export function toBackendEventEnvelope(event: MockStudyEvent): BackendEventEnvelope {
  return {
    event_type: EVENT_TYPE_MAP[event.event_type],
    timestamp: event.timestamp,
    payload: removeMediaLikeFields(event.payload) as Record<string, unknown>,
  }
}

export function toBackendEventBatchPayload(events: MockStudyEvent[]): BackendEventBatchPayload {
  return {
    events: events.map(toBackendEventEnvelope),
  }
}
