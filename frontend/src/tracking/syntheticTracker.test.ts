import { describe, expect, it } from 'vitest'
import { createTrackerProvider, getTrackerOptions } from './trackerFactory'
import { SyntheticTracker, countCalibrationEvents, generateMockStudyEvents } from './syntheticTracker'

describe('SyntheticTracker', () => {
  it('produces the existing deterministic synthetic event stream', () => {
    const tracker = new SyntheticTracker({ mode: 'healthy' })

    expect(tracker.getEvents()).toEqual(generateMockStudyEvents('healthy'))
    expect(countCalibrationEvents(tracker.getEvents())).toBeGreaterThanOrEqual(5)
  })

  it('preserves synthetic quality modes', () => {
    const lowConfidenceTracker = new SyntheticTracker({ mode: 'low_confidence' })
    const noGazeTracker = new SyntheticTracker({ mode: 'no_gaze' })

    expect(
      lowConfidenceTracker
        .getEvents()
        .filter((event) => event.event_type === 'gaze_sample_recorded')
        .every((event) => (event.payload.confidence ?? 1) < 0.5),
    ).toBe(true)
    expect(noGazeTracker.getEvents().some((event) => event.event_type === 'gaze_sample_recorded')).toBe(false)
  })
})

describe('trackerFactory', () => {
  it('defaults to synthetic tracking', () => {
    const tracker = createTrackerProvider()

    expect(tracker.id).toBe('synthetic')
  })

  it('hides the WebGazer option unless the feature flag is true', () => {
    expect(getTrackerOptions({ VITE_ENABLE_WEBGAZER: 'false' }).map((option) => option.id)).toEqual(['synthetic'])
    expect(getTrackerOptions({ VITE_ENABLE_WEBGAZER: 'true' }).map((option) => option.id)).toEqual([
      'synthetic',
      'webgazer',
    ])
  })
})
