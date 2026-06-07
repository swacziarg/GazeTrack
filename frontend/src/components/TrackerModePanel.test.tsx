import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getTrackerOptions } from '../tracking'
import { TrackerModePanel } from './TrackerModePanel'

describe('TrackerModePanel', () => {
  it('does not render the browser gaze option when the feature flag is false', () => {
    const html = renderToStaticMarkup(
      <TrackerModePanel
        options={getTrackerOptions({ VITE_ENABLE_WEBGAZER: 'false' })}
        selectedTrackerId="synthetic"
        availabilityLabel="Synthetic tracker available"
        consentGranted={false}
        calibrationComplete={false}
        status="idle"
        onTrackerChange={vi.fn()}
        onGrantConsent={vi.fn()}
        onCancelToSynthetic={vi.fn()}
      />,
    )

    expect(html).toContain('Synthetic demo')
    expect(html).toContain('deterministic demo mode is camera-free')
    expect(html).not.toContain('Browser gaze experiment')
  })

  it('renders consent copy before WebGazer initialization when selected', () => {
    const html = renderToStaticMarkup(
      <TrackerModePanel
        options={getTrackerOptions({ VITE_ENABLE_WEBGAZER: 'true' })}
        selectedTrackerId="webgazer"
        availabilityLabel="Waiting for consent"
        consentGranted={false}
        calibrationComplete={false}
        status="permission_needed"
        onTrackerChange={vi.fn()}
        onGrantConsent={vi.fn()}
        onCancelToSynthetic={vi.fn()}
      />,
    )

    expect(html).toContain('Browser-based gaze estimation may request camera access')
    expect(html).toContain('not medical-grade eye tracking')
    expect(html).toContain('Raw video is not sent to the backend')
    expect(html).toContain('Use synthetic demo')
  })
})
