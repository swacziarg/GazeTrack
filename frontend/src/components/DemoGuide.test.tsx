import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DemoGuide } from './DemoGuide'

describe('DemoGuide', () => {
  it('renders the guided reviewer path and privacy-safe report checks', () => {
    const html = renderToStaticMarkup(<DemoGuide />)

    expect(html).toContain('Demo Guide')
    expect(html).toContain('1. Configure study/tasks/AOIs')
    expect(html).toContain('2. Run synthetic session')
    expect(html).toContain('3. Inspect backend report')
    expect(html).toContain('4. Optional browser gaze')
    expect(html).toContain('Synthetic telemetry remains the default')
    expect(html).toContain('not raw webcam video')
    expect(html).toContain('frames, screenshots, or image blobs')
  })
})
