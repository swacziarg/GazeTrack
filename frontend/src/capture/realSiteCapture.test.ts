import { describe, expect, it, vi } from 'vitest'
import {
  createClickEvent,
  createCalibrationCompleteEvent,
  createPageViewEvent,
  documentSizeFromDom,
  expandCalibrationTargets,
  normalizeDocumentPoint,
  resolveAoiSnapshot,
  selectorForAoi,
} from './realSiteCapture'

describe('real-site capture helpers', () => {
  it('prefers configured selectors and falls back to data attributes', () => {
    expect(selectorForAoi({ aoi_id: '1', label: 'CTA', role_key: 'primary_cta', selector: '.buy-now' })).toBe(
      '.buy-now',
    )
    expect(selectorForAoi({ aoi_id: '1', label: 'CTA', role_key: 'primary_cta' })).toBe(
      '[data-gazetrack-aoi="primary_cta"]',
    )
  })

  it('normalizes click points against document dimensions with scroll offset', () => {
    expect(normalizeDocumentPoint(100, 150, 20, 50, { width: 1000, height: 2000 })).toEqual({
      x: 0.12,
      y: 0.1,
    })
  })

  it('resolves document-normalized AOI snapshots', () => {
    const element = {
      getBoundingClientRect: () =>
        ({
          x: 100,
          y: 200,
          left: 100,
          top: 200,
          right: 300,
          bottom: 260,
          width: 200,
          height: 60,
          toJSON: () => ({}),
        }) as DOMRect,
    }
    const root = {
      querySelector: vi.fn(() => element),
    } as unknown as ParentNode
    vi.stubGlobal('window', { scrollX: 50, scrollY: 100 })

    const snapshot = resolveAoiSnapshot(
      { aoi_id: 'aoi-1', label: 'Primary CTA', role_key: 'primary_cta', semantic_type: 'CTA' },
      root,
      'https://example.com/pricing',
      { width: 1000, height: 2000 },
    )

    expect(snapshot).toMatchObject({
      source_aoi_id: 'aoi-1',
      label: 'Primary CTA',
      role_key: 'primary_cta',
      x: 0.15,
      y: 0.15,
      width: 0.2,
      height: 0.03,
      coordinate_space: 'document_normalized',
      detected: true,
    })
    vi.unstubAllGlobals()
  })

  it('marks AOIs with invalid selectors as undetected instead of throwing', () => {
    const root = {
      querySelector: vi.fn(() => {
        throw new DOMException('Invalid selector', 'SyntaxError')
      }),
    } as unknown as ParentNode

    expect(() =>
      resolveAoiSnapshot(
        { aoi_id: 'aoi-1', label: 'Primary CTA', role_key: 'primary_cta', selector: '[' },
        root,
        'https://example.com/pricing',
        { width: 1000, height: 2000 },
      ),
    ).not.toThrow()
    expect(
      resolveAoiSnapshot(
        { aoi_id: 'aoi-1', label: 'Primary CTA', role_key: 'primary_cta', selector: '[' },
        root,
        'https://example.com/pricing',
        { width: 1000, height: 2000 },
      ),
    ).toMatchObject({
      selector: '[',
      detected: false,
      coordinate_space: 'document_normalized',
    })
  })

  it('keeps edge AOI snapshots within backend normalized bounds', () => {
    const element = {
      getBoundingClientRect: () =>
        ({
          x: 999.98,
          y: 1999.98,
          left: 999.98,
          top: 1999.98,
          right: 1000.98,
          bottom: 2000.98,
          width: 1,
          height: 1,
          toJSON: () => ({}),
        }) as DOMRect,
    }
    const root = {
      querySelector: vi.fn(() => element),
    } as unknown as ParentNode
    vi.stubGlobal('window', { scrollX: 0, scrollY: 0 })

    const snapshot = resolveAoiSnapshot(
      { aoi_id: 'aoi-1', label: 'Edge CTA', role_key: 'edge_cta' },
      root,
      'https://example.com/pricing',
      { width: 1000, height: 2000 },
    )

    expect(snapshot.x + snapshot.width).toBeLessThanOrEqual(1)
    expect(snapshot.y + snapshot.height).toBeLessThanOrEqual(1)
    expect(snapshot.width).toBeGreaterThan(0)
    expect(snapshot.height).toBeGreaterThan(0)
    vi.unstubAllGlobals()
  })

  it('creates privacy-safe capture event payloads', () => {
    const pageView = createPageViewEvent('https://example.com/pricing', { width: 1200, height: 2400 })
    const click = createClickEvent(
      { clientX: 120, clientY: 240 },
      'https://example.com/pricing',
      0,
      120,
      { width: 1200, height: 2400 },
    )

    expect(pageView.payload).toMatchObject({
      source: 'real_site_capture',
      tracker_type: 'real_site_capture',
      page_path: '/pricing',
      coordinate_space: 'document_normalized',
    })
    expect(click.payload).toMatchObject({
      source: 'real_site_capture',
      x: 0.1,
      y: 0.15,
      document_width: 1200,
      document_height: 2400,
    })
    expect(JSON.stringify(click)).not.toMatch(/video|screenshot|frame|blob|base64/i)
  })

  it('derives document size from DOM dimensions', () => {
    const root = {
      scrollWidth: 1200,
      clientWidth: 800,
      scrollHeight: 3000,
      clientHeight: 900,
    } as HTMLElement
    const body = {
      scrollWidth: 1000,
      clientWidth: 800,
      scrollHeight: 2400,
      clientHeight: 900,
    } as HTMLElement

    expect(documentSizeFromDom(root, body)).toEqual({ width: 1200, height: 3000 })
  })

  it('expands browser calibration targets by bounded pass count', () => {
    expect(expandCalibrationTargets(2)).toHaveLength(18)
    expect(expandCalibrationTargets(0)).toHaveLength(9)
    expect(expandCalibrationTargets(99)).toHaveLength(45)
  })

  it('creates real-site calibration completion telemetry without media-like payloads', () => {
    const event = createCalibrationCompleteEvent('https://example.com/pricing', { width: 1200, height: 2400 }, 9, 1, 3500)

    expect(event).toMatchObject({
      event_type: 'calibration',
      payload: {
        label: 'calibration_complete',
        mode: 'calibration_complete',
        source: 'real_site_capture',
        tracker_type: 'real_site_capture',
        calibration_points_completed: 9,
        calibration_point_count: 9,
        calibration_passes: 1,
      },
    })
    expect(JSON.stringify(event)).not.toMatch(/video|screenshot|frame|blob|base64|landmark|embedding/i)
  })
})
