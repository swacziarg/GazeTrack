import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BrowserGazeStatusPanel } from './BrowserGazeStatusPanel'

describe('BrowserGazeStatusPanel', () => {
  it('renders live tracking counts and weak-signal fallback guidance', () => {
    const html = renderToStaticMarkup(
      <BrowserGazeStatusPanel
        status={{
          trackerState: 'weak_signal',
          sampleCount: 8,
          validSampleCount: 3,
          missingPredictionCount: 4,
          lowConfidenceCount: 1,
          elapsedMs: 4250,
          latestPoint: { x: 0.4, y: 0.3 },
          message: 'No browser gaze predictions received yet. Check camera permission, lighting, and tab focus.',
        }}
        debugOverlayEnabled
        onDebugOverlayChange={vi.fn()}
        onUseSyntheticDemo={vi.fn()}
      />,
    )

    expect(html).toContain('Live tracking status')
    expect(html).toContain('Weak signal')
    expect(html).toContain('8')
    expect(html).toContain('3')
    expect(html).toContain('1 / 4')
    expect(html).toContain('4.3s')
    expect(html).toContain('camera permission')
    expect(html).toContain('Use synthetic demo')
  })
})
