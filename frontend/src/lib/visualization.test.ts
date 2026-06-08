import { describe, expect, it } from 'vitest'
import type { AreaOfInterest } from '../data/demoStudy'
import { generateMockStudyEvents, type MockStudyEvent } from './mockEvents'
import {
  computeAoiAttentionSummary,
  computeGazePathAnchors,
  computeHeatmapClusters,
  extractClickEvents,
  extractGazeSamples,
} from './visualization'

const forbiddenMediaKeys = ['video', 'frame', 'image', 'base64', 'blob', 'webcam_frame']

describe('synthetic visualization helpers', () => {
  it('extracts gaze samples and normalizes coordinates to percentages', () => {
    const samples = extractGazeSamples(generateMockStudyEvents())

    expect(samples.length).toBeGreaterThanOrEqual(30)
    expect(samples[0]).toEqual(
      expect.objectContaining({
        id: 'demo-event-008',
        xPercent: expect.closeTo(48.8, 2),
        yPercent: expect.closeTo(9.7, 2),
        confidence: expect.any(Number),
      }),
    )
  })

  it('extracts click events from synthetic telemetry', () => {
    const clicks = extractClickEvents(generateMockStudyEvents())

    expect(clicks).toHaveLength(1)
    expect(clicks[0]).toEqual(
      expect.objectContaining({
        xPercent: expect.closeTo(62, 2),
        yPercent: expect.closeTo(44, 2),
      }),
    )
  })

  it('keeps WebGazer normalized coordinates as percentages when viewport metadata is present', () => {
    const events: MockStudyEvent[] = [
      {
        id: 'webgazer-sample-1',
        event_type: 'gaze_sample_recorded',
        timestamp: '2026-01-15T17:30:00.000Z',
        payload: {
          label: 'Browser gaze sample',
          source: 'webgazer_experimental',
          tracker_type: 'webgazer_experimental',
          x: 0.52,
          y: 0.41,
          viewport_width: 1440,
          viewport_height: 900,
          confidence: null,
        },
      },
      {
        id: 'pixel-sample-1',
        event_type: 'gaze_sample_recorded',
        timestamp: '2026-01-15T17:30:01.000Z',
        payload: {
          label: 'Pixel-space gaze sample',
          x: 720,
          y: 450,
          viewport_width: 1440,
          viewport_height: 900,
          confidence: 0.8,
        },
      },
    ]

    const samples = extractGazeSamples(events)

    expect(samples[0]).toEqual(expect.objectContaining({ xPercent: 52, yPercent: 41 }))
    expect(samples[1]).toEqual(expect.objectContaining({ xPercent: 50, yPercent: 50 }))
  })

  it('collapses synthetic gaze samples into readable heatmap clusters', () => {
    const clusters = computeHeatmapClusters(extractGazeSamples(generateMockStudyEvents()))

    expect(clusters).toHaveLength(4)
    expect(clusters.map((cluster) => cluster.aoi)).toEqual([
      'Navigation',
      'Hero headline',
      'Pricing preview',
      'Primary CTA',
    ])
    expect(clusters[0]).toEqual(
      expect.objectContaining({
        sampleCount: 10,
        xPercent: expect.closeTo(50, 1),
        yPercent: expect.closeTo(10.5, 1),
      }),
    )
  })

  it('collapses consecutive gaze samples into sequential path anchors', () => {
    const anchors = computeGazePathAnchors(extractGazeSamples(generateMockStudyEvents()))

    expect(anchors.map((anchor) => `${anchor.sequenceLabel}:${anchor.aoi}`)).toEqual([
      '1:Navigation',
      '2:Hero headline',
      '3:Pricing preview',
      '4:Primary CTA',
      '5:Pricing preview',
    ])
    expect(anchors[4]).toEqual(expect.objectContaining({ sampleCount: 8 }))
  })

  it('computes AOI counts and dwell-like totals for simple inputs', () => {
    const aois: AreaOfInterest[] = [
      { name: 'Primary CTA', role: 'Conversion', x: 40, y: 35, width: 25, height: 20 },
      { name: 'Footer', role: 'Low priority', x: 0, y: 80, width: 100, height: 20 },
    ]
    const events: MockStudyEvent[] = [
      {
        id: 'sample-1',
        event_type: 'gaze_sample_recorded',
        timestamp: '2026-01-15T17:30:00.000Z',
        payload: {
          label: 'Synthetic gaze sample',
          synthetic: true,
          x: 50,
          y: 45,
          dwell_ms: 1200,
        },
      },
      {
        id: 'sample-2',
        event_type: 'gaze_sample_recorded',
        timestamp: '2026-01-15T17:30:01.000Z',
        payload: {
          label: 'Synthetic gaze sample',
          synthetic: true,
          x: 10,
          y: 90,
        },
      },
    ]

    const summary = computeAoiAttentionSummary(extractGazeSamples(events), aois)

    expect(summary).toEqual([
      expect.objectContaining({ name: 'Primary CTA', count: 1, dwellMs: 1200, sharePercent: 62 }),
      expect.objectContaining({ name: 'Footer', count: 1, dwellMs: 750, sharePercent: 38 }),
    ])
  })

  it('does not introduce forbidden media-like fields', () => {
    const serialized = JSON.stringify({
      gazeSamples: extractGazeSamples(generateMockStudyEvents()),
      clickEvents: extractClickEvents(generateMockStudyEvents()),
    })

    for (const forbiddenKey of forbiddenMediaKeys) {
      expect(serialized).not.toContain(forbiddenKey)
    }
  })
})
