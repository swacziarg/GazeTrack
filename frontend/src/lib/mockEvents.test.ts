import { describe, expect, it } from 'vitest'
import { generateMockStudyEvents, type MockEventType } from './mockEvents'

const requiredEventTypes: MockEventType[] = [
  'task_started',
  'calibration_completed',
  'gaze_sample_recorded',
  'click_recorded',
  'scroll_recorded',
  'task_completed',
]

const forbiddenMediaKeys = ['video', 'frame', 'image', 'base64', 'blob', 'webcam_frame']

describe('generateMockStudyEvents', () => {
  it('returns deterministic synthetic events for the demo session', () => {
    const events = generateMockStudyEvents()

    expect(events.length).toBeGreaterThan(0)
    expect(events.map((event) => event.id)).toEqual([
      'demo-event-001',
      'demo-event-002',
      'demo-event-003',
      'demo-event-004',
      'demo-event-005',
      'demo-event-006',
      'demo-event-007',
      'demo-event-008',
    ])
  })

  it('includes the required event types', () => {
    const eventTypes = new Set(generateMockStudyEvents().map((event) => event.event_type))

    for (const eventType of requiredEventTypes) {
      expect(eventTypes.has(eventType)).toBe(true)
    }
  })

  it('includes the required top-level event fields', () => {
    const events = generateMockStudyEvents()

    for (const event of events) {
      expect(event.id).toBeTruthy()
      expect(event.event_type).toBeTruthy()
      expect(event.timestamp).toBeTruthy()
      expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false)
      expect(event.payload).toEqual(expect.objectContaining({ synthetic: true }))
    }
  })

  it('includes coordinate, viewport, and confidence metadata for gaze samples', () => {
    const gazeEvents = generateMockStudyEvents().filter((event) => event.event_type === 'gaze_sample_recorded')

    expect(gazeEvents.length).toBeGreaterThan(0)

    for (const event of gazeEvents) {
      expect(typeof event.payload.x).toBe('number')
      expect(typeof event.payload.y).toBe('number')
      expect(typeof event.payload.viewport_width).toBe('number')
      expect(typeof event.payload.viewport_height).toBe('number')
      expect(typeof event.payload.confidence).toBe('number')
    }
  })

  it('does not include raw media-like fields in event payloads', () => {
    const events = generateMockStudyEvents()

    for (const event of events) {
      expect(Object.keys(event.payload)).not.toEqual(expect.arrayContaining(forbiddenMediaKeys))
    }
  })
})
