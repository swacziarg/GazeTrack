import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTrackerProvider } from './trackerFactory'
import { WebGazerTracker, predictionToGazeEvent, summarizeCalibration } from './webgazerTracker'

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
        source: 'webgazer_experimental',
        tracker_type: 'webgazer_experimental',
        x: 0.5,
        y: 0.5,
        viewport_width: 1280,
        viewport_height: 720,
        confidence: 0.876,
      }),
    )
    expect(event.payload.source).toBe('webgazer_experimental')
  })

  it('summarizes calibration quality from mocked predictions', () => {
    const summary = summarizeCalibration([
      {
        target: { x: 0.5, y: 0.5 },
        prediction: { x: 650, y: 365, confidence: 0.81 },
        viewportWidth: 1280,
        viewportHeight: 720,
      },
      {
        target: { x: 0.2, y: 0.2 },
        prediction: { x: 260, y: 145, confidence: 0.78 },
        viewportWidth: 1280,
        viewportHeight: 720,
      },
    ])

    expect(summary.completedPoints).toBe(2)
    expect(summary.averageErrorPx).toBeLessThan(20)
    expect(summary.averageErrorNormalized).toBeLessThan(0.03)
    expect(summary.averageConfidence).toBe(0.795)
    expect(summary.quality).toBe('good')
    expect(summary.recommendation).toBe('continue')
    expect(summary.warning).toBeNull()
  })

  it('tracks live status counts from mocked WebGazer predictions', async () => {
    let listener: (prediction: { x: number; y: number; confidence?: number } | null) => void = () => {}
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
    const tracker = new WebGazerTracker({ sampleIntervalMs: 0 })

    await tracker.initialize()
    await tracker.startSession({ viewportWidth: 1000, viewportHeight: 500 })
    await tracker.runCalibration({ targets: [] })
    listener({ x: 250, y: 125, confidence: 0.9 })
    listener(null)
    listener({ x: 300, y: 200, confidence: 0.2 })

    const status = tracker.getTrackingStatus(Date.now() + 1000)
    expect(status).toEqual(
      expect.objectContaining({
        trackerState: 'active',
        sampleCount: 3,
        validSampleCount: 2,
        missingPredictionCount: 1,
        lowConfidenceCount: 1,
        latestPoint: { x: 0.3, y: 0.4 },
      }),
    )
    expect(tracker.getEvents().filter((event) => event.event_type === 'gaze_sample_recorded')).toHaveLength(2)
  })

  it('reports permission-needed fallback when WebGazer begin is denied', async () => {
    vi.stubGlobal('window', {
      innerWidth: 1000,
      innerHeight: 500,
      webgazer: {
        setGazeListener: vi.fn().mockReturnThis(),
        begin: vi.fn().mockRejectedValue(new Error('Permission denied')),
        showVideoPreview: vi.fn().mockReturnThis(),
        showPredictionPoints: vi.fn().mockReturnThis(),
      },
    })
    const tracker = new WebGazerTracker()

    await expect(tracker.initialize()).rejects.toThrow('Camera permission')
    expect(tracker.getTrackingStatus()).toEqual(
      expect.objectContaining({
        trackerState: 'permission_needed',
        message: expect.stringContaining('Camera permission'),
      }),
    )
  })

  it('marks no-prediction capture as weak signal after the timeout', async () => {
    vi.stubGlobal('window', {
      innerWidth: 1000,
      innerHeight: 500,
      webgazer: {
        setGazeListener: vi.fn().mockReturnThis(),
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
    await tracker.runCalibration({ targets: [] })

    expect(tracker.getTrackingStatus(Date.now() + 3200)).toEqual(
      expect.objectContaining({
        trackerState: 'weak_signal',
        message: expect.stringContaining('No browser gaze predictions'),
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
