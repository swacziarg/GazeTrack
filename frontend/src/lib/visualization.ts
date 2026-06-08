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

export type HeatmapCluster = PercentPoint & {
  sampleCount: number
  averageConfidence?: number
}

export type GazePathAnchor = PercentPoint & {
  sampleCount: number
  sequenceLabel: string
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function normalizeCoordinate(value: number, viewportValue?: number) {
  if (value >= 0 && value <= 1) {
    return clampPercent(value * 100)
  }

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

  const confidence = typeof event.payload.confidence === 'number' ? event.payload.confidence : undefined

  return {
    id: event.id,
    timestamp: event.timestamp,
    xPercent: normalizeCoordinate(x, viewportWidth),
    yPercent: normalizeCoordinate(y, viewportHeight),
    confidence,
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

function bucketKey(point: PercentPoint) {
  if (point.aoi) {
    return `aoi:${point.aoi}`
  }

  return `grid:${Math.round(point.xPercent / 8)}:${Math.round(point.yPercent / 8)}`
}

function summarizePointGroup<T extends PercentPoint>(group: T[], idPrefix: string) {
  const sampleCount = group.length
  const confidenceSamples = group
    .map((sample) => sample.confidence)
    .filter((confidence): confidence is number => typeof confidence === 'number')
  const dwellMs = group.reduce((total, sample) => total + (sample.dwellMs ?? 0), 0)

  return {
    id: `${idPrefix}-${group[0].id}`,
    timestamp: group[0].timestamp,
    xPercent: group.reduce((total, sample) => total + sample.xPercent, 0) / sampleCount,
    yPercent: group.reduce((total, sample) => total + sample.yPercent, 0) / sampleCount,
    confidence:
      confidenceSamples.length === 0
        ? undefined
        : confidenceSamples.reduce((total, confidence) => total + confidence, 0) / confidenceSamples.length,
    averageConfidence:
      confidenceSamples.length === 0
        ? undefined
        : confidenceSamples.reduce((total, confidence) => total + confidence, 0) / confidenceSamples.length,
    dwellMs: dwellMs > 0 ? dwellMs : undefined,
    aoi: group[0].aoi,
  }
}

export function computeHeatmapClusters(gazeSamples: PercentPoint[]): HeatmapCluster[] {
  const groups = new Map<string, PercentPoint[]>()

  for (const sample of gazeSamples) {
    const key = bucketKey(sample)
    groups.set(key, [...(groups.get(key) ?? []), sample])
  }

  return [...groups.values()].map((group) => ({
    ...summarizePointGroup(group, 'heatmap-cluster'),
    sampleCount: group.length,
  }))
}

export function computeGazePathAnchors(gazeSamples: PercentPoint[]): GazePathAnchor[] {
  const groups: PercentPoint[][] = []

  for (const sample of gazeSamples) {
    const previousGroup = groups[groups.length - 1]
    const previousSample = previousGroup?.[0]
    const shouldContinueGroup = sample.aoi
      ? previousSample?.aoi === sample.aoi
      : previousGroup && !previousSample?.aoi && previousGroup.length < 6

    if (shouldContinueGroup && previousGroup) {
      previousGroup.push(sample)
    } else {
      groups.push([sample])
    }
  }

  return groups.map((group, index) => ({
    ...summarizePointGroup(group, 'gaze-anchor'),
    sampleCount: group.length,
    sequenceLabel: String(index + 1),
  }))
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
