import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SessionControls } from './SessionControls'

const defaultProps = {
  trackerId: 'synthetic' as const,
  trackerLabel: 'Synthetic demo',
  canStartSession: true,
  eventCount: 1,
  totalEventCount: 58,
  elapsedSeconds: 0,
  taskPrompt: 'Find the team plan and start checkout.',
  qualityMode: 'healthy' as const,
  calibrationEventCount: 6,
  onQualityModeChange: vi.fn(),
  onOpenStudy: vi.fn(),
  onStartSession: vi.fn(),
  onRunCalibration: vi.fn(),
  onCompleteSession: vi.fn(),
}

describe('SessionControls', () => {
  it('shows the normalized calibration stage during calibration', () => {
    const html = renderToStaticMarkup(<SessionControls {...defaultProps} phase="calibration" />)

    expect(html).toContain('Normalized calibration target map')
    expect(html).toContain('Viewport calibration surface')
    expect(html.match(/Calibration target/g)).toHaveLength(5)
    expect(html).toContain('Run synthetic calibration')
  })
})
