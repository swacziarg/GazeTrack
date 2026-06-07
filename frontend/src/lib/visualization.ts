import type { AreaOfInterest } from '../data/demoStudy'
import type { MockStudyEvent } from './mockEvents'

const DEFAULT_SAMPLE_DWELL_MS = 750

export type PercentPoint = {
  id: string
  timestamp: string
  xPercent: number
  yPercent: number
  confidence?: number
  dwellMs?: number
  aoi?: string
}

export type AoiAttentionSummary = {
  name: string
  role: string
  count: number
  dwellMs: number
  sharePercent: number
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function normalizeCoordinate(value: number, viewportValue?: number) {
  if (typeof viewportValue === 'number' && viewportValue > 0) {
    return clampPercent((value / viewportValue) * 100)
  }

  return clampPercent(value)
}

function eventToPercentPoint(event: MockStudyEvent): PercentPoint | null {
  const { x, y, viewport_width: viewportWidth, viewport_height: viewportHeight } = event.payload

  if (typeof x !== 'number' || typeof y !== 'number') {
    return null
  }

  return {
    id: event.id,
    timestamp: event.timestamp,
    xPercent: normalizeCoordinate(x, viewportWidth),
    yPercent: normalizeCoordinate(y, viewportHeight),
    confidence: event.payload.confidence,
    dwellMs: event.payload.dwell_ms,
    aoi: event.payload.aoi,
  }
}

function isPointInsideAoi(point: PercentPoint, aoi: AreaOfInterest) {
  return (
    point.xPercent >= aoi.x &&
    point.xPercent <= aoi.x + aoi.width &&
    point.yPercent >= aoi.y &&
    point.yPercent <= aoi.y + aoi.height
  )
}

export function extractGazeSamples(events: MockStudyEvent[]): PercentPoint[] {
  return events
    .filter((event) => event.event_type === 'gaze_sample_recorded')
    .map(eventToPercentPoint)
    .filter((point): point is PercentPoint => point !== null)
}

export function extractClickEvents(events: MockStudyEvent[]): PercentPoint[] {
  return events
    .filter((event) => event.event_type === 'click_recorded')
    .map(eventToPercentPoint)
    .filter((point): point is PercentPoint => point !== null)
}

export function computeAoiAttentionSummary(
  gazeSamples: PercentPoint[],
  aois: AreaOfInterest[],
): AoiAttentionSummary[] {
  const summaries = aois.map((aoi) => {
    const matchingSamples = gazeSamples.filter((sample) => isPointInsideAoi(sample, aoi))
    const dwellMs = matchingSamples.reduce(
      (total, sample) => total + (sample.dwellMs ?? DEFAULT_SAMPLE_DWELL_MS),
      0,
    )

    return {
      name: aoi.name,
      role: aoi.role,
      count: matchingSamples.length,
      dwellMs,
      sharePercent: 0,
    }
  })

  const totalDwellMs = summaries.reduce((total, summary) => total + summary.dwellMs, 0)

  return summaries.map((summary) => ({
    ...summary,
    sharePercent: totalDwellMs === 0 ? 0 : Math.round((summary.dwellMs / totalDwellMs) * 100),
  }))
}
