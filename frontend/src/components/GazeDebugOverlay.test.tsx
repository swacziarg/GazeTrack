import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GazeDebugOverlay } from './GazeDebugOverlay'

const status = {
  trackerState: 'active' as const,
  sampleCount: 3,
  validSampleCount: 3,
  missingPredictionCount: 0,
  lowConfidenceCount: 0,
  elapsedMs: 1200,
  latestPoint: { x: 0.25, y: 0.75 },
  message: null,
}

describe('GazeDebugOverlay', () => {
  it('renders an approximate gaze dot at the latest mocked prediction', () => {
    const html = renderToStaticMarkup(<GazeDebugOverlay enabled status={status} />)

    expect(html).toContain('Approximate browser gaze debug overlay')
    expect(html).toContain('left:25vw')
    expect(html).toContain('top:75vh')
    expect(html).toContain('Approximate gaze')
  })

  it('does not render when toggled off', () => {
    expect(renderToStaticMarkup(<GazeDebugOverlay enabled={false} status={status} />)).toBe('')
  })
})
