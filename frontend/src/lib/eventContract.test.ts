import { describe, expect, it } from 'vitest'
import { toBackendEventBatchPayload, toBackendEventEnvelope } from './eventContract'
import { generateMockStudyEvents, type MockStudyEvent } from './mockEvents'

const forbiddenMediaKeys = ['video', 'frame', 'image', 'base64', 'blob', 'webcam_frame']

describe('event contract adapter', () => {
  it('maps frontend synthetic event types to backend placeholder event types', () => {
    const events = generateMockStudyEvents()
    const payload = toBackendEventBatchPayload(events)

    expect(payload.events.map((event) => event.event_type)).toEqual([
      'task_start',
      'calibration',
      'gaze',
      'scroll',
      'gaze',
      'gaze',
      'click',
      'task_complete',
    ])
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
