import { describe, expect, it } from 'vitest'
import { createTrackerProvider, getTrackerOptions } from './trackerFactory'
import { SyntheticTracker, countCalibrationEvents, generateMockStudyEvents, generateSyntheticStudyEvents } from './syntheticTracker'

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

  it('uses custom task prompts and AOI labels in deterministic synthetic events', () => {
    const events = generateSyntheticStudyEvents(
      {
        name: 'Checkout study',
        targetUrl: 'https://example.test/checkout',
        taskPrompt: 'Find the checkout button.',
        aois: [
          { label: 'Top navigation', semanticType: 'nav', x: 0.1, y: 0.02, width: 0.8, height: 0.1 },
          { label: 'Checkout CTA', semanticType: 'CTA', x: 0.5, y: 0.4, width: 0.2, height: 0.12 },
          { label: 'Plan comparison', semanticType: 'pricing', x: 0.2, y: 0.6, width: 0.5, height: 0.2 },
        ],
      },
      'healthy',
    )

    expect(events).toHaveLength(58)
    expect(events[0].payload.task_prompt).toBe('Find the checkout button.')
    expect(events.some((event) => event.payload.aoi === 'Checkout CTA')).toBe(true)
    expect(events.find((event) => event.event_type === 'click_recorded')?.payload.aoi).toBe('Checkout CTA')
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
