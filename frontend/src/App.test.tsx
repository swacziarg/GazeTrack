import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App reviewer copy', () => {
  it('renders demo guide and makes synthetic mode/privacy boundaries visible by default', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Demo Guide')
    expect(html).toContain('Synthetic mode is the recommended demo path')
    expect(html).toContain('privacy-safe telemetry only')
    expect(html).toContain('not webcam video')
    expect(html).toContain('Synthetic demo data')
  })
})
