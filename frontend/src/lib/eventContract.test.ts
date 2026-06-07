import { describe, expect, it } from 'vitest'
import { toBackendEventBatchPayload, toBackendEventEnvelope } from './eventContract'
import { generateMockStudyEvents, type MockStudyEvent } from './mockEvents'

const forbiddenMediaKeys = ['video', 'frame', 'image', 'base64', 'blob', 'webcam_frame']

describe('event contract adapter', () => {
  it('maps frontend synthetic event types to backend placeholder event types', () => {
    const events = generateMockStudyEvents()
    const payload = toBackendEventBatchPayload(events)
    const backendEventTypes = payload.events.map((event) => event.event_type)

    expect(backendEventTypes[0]).toBe('task_start')
    expect(backendEventTypes).toEqual(expect.arrayContaining(['calibration', 'gaze', 'scroll', 'click', 'task_complete']))
    expect(backendEventTypes.filter((eventType) => eventType === 'calibration').length).toBeGreaterThanOrEqual(5)
    expect(backendEventTypes.filter((eventType) => eventType === 'gaze').length).toBeGreaterThanOrEqual(30)
  })

  it('preserves timestamp and payload for synthetic events', () => {
    const event = generateMockStudyEvents()[2]
    const adapted = toBackendEventEnvelope(event)

    expect(adapted.timestamp).toBe(event.timestamp)
    expect(adapted.payload).toEqual(event.payload)
  })

  it('does not include forbidden media-like fields in adapted payloads', () => {
    const eventWithMediaLikeFields: MockStudyEvent = {
      ...generateMockStudyEvents()[0],
      payload: {
        ...generateMockStudyEvents()[0].payload,
        video: 'not-sent',
        nested: {
          webcam_frame: 'not-sent',
          safe_value: 'sent',
        },
      } as MockStudyEvent['payload'],
    }

    const adapted = toBackendEventEnvelope(eventWithMediaLikeFields)
    const serializedPayload = JSON.stringify(adapted.payload)

    for (const forbiddenKey of forbiddenMediaKeys) {
      expect(serializedPayload).not.toContain(forbiddenKey)
    }

    expect(adapted.payload).toEqual(
      expect.objectContaining({
        synthetic: true,
        nested: { safe_value: 'sent' },
      }),
    )
  })
})
