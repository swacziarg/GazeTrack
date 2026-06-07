import { describe, expect, it } from 'vitest'
import { calibrationTargets, generateMockStudyEvents, type MockEventType } from './mockEvents'

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
    const repeatedEvents = generateMockStudyEvents()

    expect(events).toEqual(repeatedEvents)
    expect(events.length).toBeGreaterThanOrEqual(30)
    expect(events.length).toBeLessThanOrEqual(80)
    expect(events[0].id).toBe('demo-event-001')
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

    expect(gazeEvents.length).toBeGreaterThanOrEqual(30)

    for (const event of gazeEvents) {
      expect(typeof event.payload.x).toBe('number')
      expect(typeof event.payload.y).toBe('number')
      expect(typeof event.payload.viewport_width).toBe('number')
      expect(typeof event.payload.viewport_height).toBe('number')
      expect(typeof event.payload.confidence).toBe('number')
      expect(event.payload.x).toBeGreaterThanOrEqual(0)
      expect(event.payload.x).toBeLessThanOrEqual(1)
      expect(event.payload.y).toBeGreaterThanOrEqual(0)
      expect(event.payload.y).toBeLessThanOrEqual(1)
    }
  })

  it('includes synthetic calibration target, observed, error, and index fields', () => {
    const calibrationEvents = generateMockStudyEvents().filter(
      (event) => event.event_type === 'calibration_point_recorded',
    )

    expect(calibrationEvents).toHaveLength(calibrationTargets.length)
    expect(calibrationEvents[0].payload).toEqual(
      expect.objectContaining({
        target_point: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        observed_point: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        error_px: expect.any(Number),
        error_normalized: expect.any(Number),
        calibration_step: 1,
        calibration_point_count: calibrationTargets.length,
      }),
    )
  })

  it('supports quality modes for low confidence, bad calibration, and no gaze', () => {
    const lowConfidenceGaze = generateMockStudyEvents('low_confidence').filter(
      (event) => event.event_type === 'gaze_sample_recorded',
    )
    const badCalibrationSummary = generateMockStudyEvents('bad_calibration').find(
      (event) => event.event_type === 'calibration_completed',
    )
    const noGazeEvents = generateMockStudyEvents('no_gaze')

    expect(lowConfidenceGaze.every((event) => (event.payload.confidence ?? 1) < 0.5)).toBe(true)
    expect(badCalibrationSummary?.payload.calibration_error_px).toBeGreaterThan(100)
    expect(noGazeEvents.some((event) => event.event_type === 'gaze_sample_recorded')).toBe(false)
    expect(noGazeEvents.some((event) => event.event_type === 'task_completed')).toBe(true)
  })

  it('does not include raw media-like fields in event payloads', () => {
    const events = generateMockStudyEvents()

    for (const event of events) {
      expect(Object.keys(event.payload)).not.toEqual(expect.arrayContaining(forbiddenMediaKeys))
    }
  })
})
