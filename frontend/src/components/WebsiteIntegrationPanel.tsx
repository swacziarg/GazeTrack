import { useMemo, useState } from 'react'
import type { CaptureConfigResult, InstallVerificationResult } from '../api/studies'

const VERSIONED_CAPTURE_SDK_PATH = '/sdk/v0.2/gazetrack-capture.js'

type FallbackAoi = {
  label: string
  roleKey?: string
  role_key?: string
  selector?: string | null
}

type WebsiteIntegrationPanelProps = {
  captureConfigResult: CaptureConfigResult | null
  installVerificationResult: InstallVerificationResult | null
  fallbackAoIs: FallbackAoi[]
}

function buildFallbackSnippet(captureConfigResult: CaptureConfigResult | null) {
  const config = captureConfigResult?.config
  if (!config) {
    return null
  }

  const apiBaseUrl = captureConfigResult.apiBaseUrl
  return `<script>
  window.GazeTrackConfig = {
    apiBaseUrl: "${apiBaseUrl}",
    studyId: "${config.study_id}",
    captureToken: "${config.capture_token}"
  }
</script>
<script src="${apiBaseUrl}${VERSIONED_CAPTURE_SDK_PATH}" async></script>`
}

export function WebsiteIntegrationPanel({
  captureConfigResult,
  installVerificationResult,
  fallbackAoIs,
}: WebsiteIntegrationPanelProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle')
  const verification = installVerificationResult?.verification ?? null
  const captureConfig = captureConfigResult?.config ?? null
  const snippet = verification?.recommended_snippet ?? buildFallbackSnippet(captureConfigResult)
  const aois = verification?.aois ?? captureConfig?.aois ?? fallbackAoIs
  const targetUrl = verification?.target_url ?? captureConfig?.target_url ?? null
  const allowedOrigins = verification?.allowed_origins ?? []
  const expectedScriptPath = verification?.expected_script_path ?? VERSIONED_CAPTURE_SDK_PATH
  const captureToken = captureConfig?.capture_token ?? null
  const checklist = useMemo(
    () => [
      { label: 'Backend reachable', ready: Boolean(captureConfigResult?.backendAvailable) },
      { label: 'Study saved', ready: Boolean(captureConfig?.study_id || verification?.study_id) },
      { label: 'Capture token available', ready: Boolean(captureToken || verification?.capture_token_exists) },
      { label: 'Target URL configured', ready: Boolean(targetUrl) },
      { label: `SDK path is ${VERSIONED_CAPTURE_SDK_PATH}`, ready: expectedScriptPath === VERSIONED_CAPTURE_SDK_PATH },
      { label: 'AOI selectors or role keys configured', ready: aois.length > 0 },
    ],
    [aois.length, captureConfig?.study_id, captureConfigResult?.backendAvailable, captureToken, expectedScriptPath, targetUrl, verification],
  )

  async function copySnippet() {
    if (!snippet || !navigator.clipboard?.writeText) {
      setCopyStatus('unavailable')
      return
    }

    try {
      await navigator.clipboard.writeText(snippet)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('unavailable')
    }
  }

  return (
    <>
      <p className="privacy-note compact">
        Add this snippet to a page you control. The dashboard helper shows readiness data only; it does not crawl,
        scan, screenshot, or fetch the target site.
      </p>
      {snippet ? (
        <>
          <div className="snippet-actions">
            <button type="button" className="secondary-button" onClick={copySnippet}>
              Copy snippet
            </button>
            {copyStatus !== 'idle' ? (
              <span className={`status-pill ${copyStatus === 'copied' ? 'ok' : 'pending'}`}>
                {copyStatus === 'copied' ? 'Copied' : 'Select snippet'}
              </span>
            ) : null}
          </div>
          <pre className="snippet-block">
            <code>{snippet}</code>
          </pre>
        </>
      ) : (
        <p className="backend-unavailable compact">
          {captureConfigResult?.message ?? 'Save the study while the backend is online to generate a capture snippet.'}
        </p>
      )}
      <div className="study-builder-grid">
        <section>
          <h4>Integration details</h4>
          <dl className="summary-list">
            <div>
              <dt>SDK path</dt>
              <dd>
                <code>{expectedScriptPath}</code>
              </dd>
            </div>
            <div>
              <dt>Capture token</dt>
              <dd className="mono-value">{captureToken ?? 'Not loaded'}</dd>
            </div>
            <div>
              <dt>Target URL</dt>
              <dd>{targetUrl ?? 'Not configured'}</dd>
            </div>
            <div>
              <dt>Allowed origins</dt>
              <dd>{allowedOrigins.length ? allowedOrigins.join(', ') : 'Empty allowlist: local/demo behavior'}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h4>AOI selectors</h4>
          <ul className="setup-list">
            {aois.map((aoi) => {
              const roleKey = 'role_key' in aoi ? aoi.role_key : (aoi.roleKey ?? '')
              return (
                <li key={`${roleKey || aoi.label}-${aoi.selector ?? ''}`}>
                  <strong>{aoi.label}</strong>
                  <span>
                    {roleKey ? <code>data-gazetrack-aoi=&quot;{roleKey}&quot;</code> : 'No role key'}
                    {aoi.selector ? ` or ${aoi.selector}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <h4>Readiness checklist</h4>
          <ul className="setup-list">
            {checklist.map((item) => (
              <li key={item.label}>
                <strong>{item.ready ? 'Ready' : 'Check'}</strong>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
