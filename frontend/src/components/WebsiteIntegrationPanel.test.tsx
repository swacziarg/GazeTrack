import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CaptureConfigResult, InstallVerificationResult } from '../api/studies'
import { WebsiteIntegrationPanel } from './WebsiteIntegrationPanel'

const captureConfigResult: CaptureConfigResult = {
  ok: true,
  backendAvailable: true,
  apiBaseUrl: 'http://localhost:8000',
  statusCode: 200,
  message: 'Capture snippet configuration loaded.',
  config: {
    study_id: '00000000-0000-4000-8000-000000000001',
    name: 'Checkout study',
    objective: 'Measure checkout discovery',
    target_url: 'https://example.com/pricing',
    task_prompt: 'Find checkout.',
    capture_token: 'capture-token-123',
    aois: [
      {
        aoi_id: '33333333-3333-4333-8333-333333333333',
        label: 'Primary CTA',
        semantic_type: 'CTA',
        role_key: 'primary_cta',
        selector: "[data-gazetrack-aoi='primary_cta']",
        required: true,
      },
    ],
  },
}

const installVerificationResult: InstallVerificationResult = {
  ok: true,
  backendAvailable: true,
  apiBaseUrl: 'http://localhost:8000',
  statusCode: 200,
  message: 'Install verification loaded.',
  verification: {
    study_id: '00000000-0000-4000-8000-000000000001',
    expected_script_path: '/sdk/v0.2/gazetrack-capture.js',
    expected_script_url: 'http://localhost:8000/sdk/v0.2/gazetrack-capture.js',
    capture_token_exists: true,
    target_url: 'https://example.com/pricing',
    allowed_origins: ['https://example.com'],
    recommended_snippet: '<script src="http://localhost:8000/sdk/v0.2/gazetrack-capture.js" async></script>',
    aois: captureConfigResult.config?.aois ?? [],
  },
}

describe('WebsiteIntegrationPanel', () => {
  it('renders a versioned copyable snippet and install readiness details', () => {
    const html = renderToStaticMarkup(
      <WebsiteIntegrationPanel
        captureConfigResult={captureConfigResult}
        installVerificationResult={installVerificationResult}
        fallbackAoIs={[]}
      />,
    )

    expect(html).toContain('/sdk/v0.2/gazetrack-capture.js')
    expect(html).toContain('capture-token-123')
    expect(html).toContain('https://example.com/pricing')
    expect(html).toContain('https://example.com')
    expect(html).toContain('Primary CTA')
    expect(html).toContain('primary_cta')
    expect(html).toContain("[data-gazetrack-aoi=&#x27;primary_cta&#x27;]")
    expect(html).toContain('Copy snippet')
    expect(html).toContain('does not crawl')
  })
})
