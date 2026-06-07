import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTrackerProvider } from './trackerFactory'
import { WebGazerTracker, predictionToGazeEvent } from './webgazerTracker'

const forbiddenMediaKeys = ['video', 'frame', 'image', 'base64', 'blob', 'webcam_frame']

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WebGazerTracker', () => {
  it('does not initialize WebGazer when the provider is only created', () => {
    const begin = vi.fn()
    vi.stubGlobal('window', {
      innerWidth: 1000,
      innerHeight: 500,
      webgazer: {
        setGazeListener: vi.fn().mockReturnThis(),
        begin,
      },
    })

    const tracker = createTrackerProvider('webgazer')

    expect(tracker.id).toBe('webgazer')
    expect(begin).not.toHaveBeenCalled()
  })

  it('maps WebGazer prediction pixels into normalized gaze telemetry', () => {
    const event = predictionToGazeEvent({
      x: 640,
      y: 360,
      confidence: 0.8764,
    }, {
      eventIndex: 3,
      viewportWidth: 1280,
      viewportHeight: 720,
    })

    expect(event.event_type).toBe('gaze_sample_recorded')
    expect(event.payload).toEqual(
      expect.objectContaining({
        source: 'webgazer',
        x: 0.5,
        y: 0.5,
        viewport_width: 1280,
        viewport_height: 720,
        confidence: 0.876,
      }),
    )
  })

  it('does not generate forbidden media-like fields', async () => {
    let listener: (prediction: { x: number; y: number; confidence?: number }) => void = () => {}
    vi.stubGlobal('window', {
      innerWidth: 1000,
      innerHeight: 500,
      webgazer: {
        setGazeListener(callback: typeof listener) {
          listener = callback
          return this
        },
        begin: vi.fn(),
        pause: vi.fn().mockReturnThis(),
        clearGazeListener: vi.fn().mockReturnThis(),
        showVideoPreview: vi.fn().mockReturnThis(),
        showPredictionPoints: vi.fn().mockReturnThis(),
      },
    })
    const tracker = new WebGazerTracker()

    await tracker.initialize()
    await tracker.startSession()
    listener({ x: 500, y: 250 })

    const serializedEvents = JSON.stringify(tracker.getEvents())
    for (const forbiddenKey of forbiddenMediaKeys) {
      expect(serializedEvents).not.toContain(forbiddenKey)
    }
  })
})
