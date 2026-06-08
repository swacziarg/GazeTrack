export const REAL_SITE_CAPTURE_SOURCE = 'real_site_capture'
const MIN_AOI_SIZE = 0.0001

export type CaptureAoiConfig = {
  aoi_id: string
  label: string
  semantic_type?: string | null
  role_key: string
  selector?: string | null
  required?: boolean
}

export type DocumentSize = {
  width: number
  height: number
}

export type ResolvedAoiSnapshot = {
  source_aoi_id: string
  label: string
  semantic_type?: string | null
  role_key: string
  selector?: string | null
  page_url: string
  x: number
  y: number
  width: number
  height: number
  coordinate_space: 'document_normalized'
  detected: boolean
}

export type SafeLayoutLandmark = {
  id: string
  label: string
  semantic_type: string
  tag?: string
  text?: string
  background_color?: string
  text_color?: string
  border_color?: string
  font_size?: string
  font_weight?: string
  x: number
  y: number
  width: number
  height: number
  is_aoi?: boolean
}

export type SafeLayoutSnapshot = {
  snapshot_type: 'safe_dom_layout_v1'
  page_url: string
  page_path: string
  viewport_width: number
  viewport_height: number
  document_width: number
  document_height: number
  scroll_x: number
  scroll_y: number
  coordinate_space: 'document_normalized'
  landmarks: SafeLayoutLandmark[]
}

export type CaptureEvent = {
  event_type: 'task_start' | 'task_complete' | 'gaze' | 'click' | 'scroll' | 'page_view' | 'quality' | 'calibration'
  timestamp: string
  payload: Record<string, unknown>
}

export type CalibrationTarget = {
  x: number
  y: number
}

export const browserCalibrationTargets: CalibrationTarget[] = [
  { x: 0.12, y: 0.12 },
  { x: 0.5, y: 0.12 },
  { x: 0.88, y: 0.12 },
  { x: 0.12, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.88, y: 0.5 },
  { x: 0.12, y: 0.88 },
  { x: 0.5, y: 0.88 },
  { x: 0.88, y: 0.88 },
]

function clampNormalized(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function roundCoordinate(value: number) {
  return Number(clampNormalized(value).toFixed(4))
}

function roundRectStart(value: number) {
  return Number(Math.max(0, Math.min(1 - MIN_AOI_SIZE, roundCoordinate(value))).toFixed(4))
}

function roundRectSize(start: number, value: number) {
  const roundedSize = Math.max(MIN_AOI_SIZE, roundCoordinate(value))
  return Number(Math.min(1 - start, roundedSize).toFixed(4))
}

function getWindowScroll() {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }
  return { x: window.scrollX, y: window.scrollY }
}

export function documentSizeFromDom(documentElement: HTMLElement, body: HTMLElement | null): DocumentSize {
  return {
    width: Math.max(
      documentElement.scrollWidth,
      documentElement.clientWidth,
      body?.scrollWidth ?? 0,
      body?.clientWidth ?? 0,
      1,
    ),
    height: Math.max(
      documentElement.scrollHeight,
      documentElement.clientHeight,
      body?.scrollHeight ?? 0,
      body?.clientHeight ?? 0,
      1,
    ),
  }
}

export function normalizeDocumentPoint(
  clientX: number,
  clientY: number,
  scrollX: number,
  scrollY: number,
  documentSize: DocumentSize,
) {
  return {
    x: roundCoordinate((clientX + scrollX) / documentSize.width),
    y: roundCoordinate((clientY + scrollY) / documentSize.height),
  }
}

export function selectorForAoi(aoi: CaptureAoiConfig) {
  return aoi.selector?.trim() || `[data-gazetrack-aoi="${aoi.role_key}"]`
}

function querySelectorSafely(root: ParentNode, selector: string) {
  try {
    return root.querySelector(selector)
  } catch {
    return null
  }
}

export function resolveAoiSnapshot(
  aoi: CaptureAoiConfig,
  root: ParentNode,
  pageUrl: string,
  documentSize: DocumentSize,
): ResolvedAoiSnapshot {
  const selector = selectorForAoi(aoi)
  const element = querySelectorSafely(root, selector)

  if (!element || typeof (element as Element).getBoundingClientRect !== 'function') {
    return {
      source_aoi_id: aoi.aoi_id,
      label: aoi.label,
      semantic_type: aoi.semantic_type ?? null,
      role_key: aoi.role_key,
      selector,
      page_url: pageUrl,
      x: 0,
      y: 0,
      width: 0.01,
      height: 0.01,
      coordinate_space: 'document_normalized',
      detected: false,
    }
  }

  const rect = element.getBoundingClientRect()
  const scroll = getWindowScroll()
  const absoluteLeft = rect.left + scroll.x
  const absoluteTop = rect.top + scroll.y
  const x = roundRectStart(absoluteLeft / documentSize.width)
  const y = roundRectStart(absoluteTop / documentSize.height)
  const width = roundRectSize(x, rect.width / documentSize.width)
  const height = roundRectSize(y, rect.height / documentSize.height)

  return {
    source_aoi_id: aoi.aoi_id,
    label: aoi.label,
    semantic_type: aoi.semantic_type ?? null,
    role_key: aoi.role_key,
    selector,
    page_url: pageUrl,
    x,
    y,
    width,
    height,
    coordinate_space: 'document_normalized',
    detected: rect.width > 0 && rect.height > 0,
  }
}

export function createPageViewEvent(pageUrl: string, documentSize: DocumentSize): CaptureEvent {
  const url = new URL(pageUrl)
  return {
    event_type: 'page_view',
    timestamp: new Date().toISOString(),
    payload: {
      label: 'Real-site page viewed',
      source: REAL_SITE_CAPTURE_SOURCE,
      tracker_type: REAL_SITE_CAPTURE_SOURCE,
      page_url: pageUrl,
      page_path: url.pathname,
      document_width: documentSize.width,
      document_height: documentSize.height,
      coordinate_space: 'document_normalized',
      layout_snapshot: createSafeLayoutSnapshot(pageUrl, documentSize, [], 0, 0, documentSize.width, documentSize.height),
    },
  }
}

export function createSafeLayoutSnapshot(
  pageUrl: string,
  documentSize: DocumentSize,
  landmarks: SafeLayoutLandmark[],
  scrollX = 0,
  scrollY = 0,
  viewportWidth = documentSize.width,
  viewportHeight = documentSize.height,
): SafeLayoutSnapshot {
  const url = new URL(pageUrl)
  return {
    snapshot_type: 'safe_dom_layout_v1',
    page_url: pageUrl,
    page_path: url.pathname,
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    document_width: documentSize.width,
    document_height: documentSize.height,
    scroll_x: scrollX,
    scroll_y: scrollY,
    coordinate_space: 'document_normalized',
    landmarks: landmarks.slice(0, 96),
  }
}

export function createClickEvent(
  event: Pick<MouseEvent, 'clientX' | 'clientY'>,
  pageUrl: string,
  scrollX: number,
  scrollY: number,
  documentSize: DocumentSize,
): CaptureEvent {
  const point = normalizeDocumentPoint(event.clientX, event.clientY, scrollX, scrollY, documentSize)
  return {
    event_type: 'click',
    timestamp: new Date().toISOString(),
    payload: {
      label: 'Real-site click',
      source: REAL_SITE_CAPTURE_SOURCE,
      tracker_type: REAL_SITE_CAPTURE_SOURCE,
      page_url: pageUrl,
      page_path: new URL(pageUrl).pathname,
      x: point.x,
      y: point.y,
      scroll_x: scrollX,
      scroll_y: scrollY,
      document_width: documentSize.width,
      document_height: documentSize.height,
      coordinate_space: 'document_normalized',
    },
  }
}

export function expandCalibrationTargets(passes: number, targets: CalibrationTarget[] = browserCalibrationTargets) {
  const safePasses = Math.max(1, Math.min(5, Math.floor(passes) || 1))
  return Array.from({ length: safePasses }).flatMap(() => targets)
}

export function createCalibrationCompleteEvent(
  pageUrl: string,
  documentSize: DocumentSize,
  pointsCompleted: number,
  passes: number,
  durationMs: number,
): CaptureEvent {
  return {
    event_type: 'calibration',
    timestamp: new Date().toISOString(),
    payload: {
      label: 'calibration_complete',
      mode: 'calibration_complete',
      source: REAL_SITE_CAPTURE_SOURCE,
      tracker_type: REAL_SITE_CAPTURE_SOURCE,
      page_url: pageUrl,
      page_path: new URL(pageUrl).pathname,
      document_width: documentSize.width,
      document_height: documentSize.height,
      coordinate_space: 'document_normalized',
      calibration_points_completed: pointsCompleted,
      calibration_point_count: pointsCompleted,
      calibration_passes: passes,
      calibration_duration_ms: durationMs,
      calibration_quality: 'usable',
    },
  }
}
