import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BackendReplayAoiOverlay, BackendReplayEvent, BackendReplayFixation, BackendReplaySummary } from '../api/reports'
import { getVisibleReplayData, SessionReplay } from './SessionReplay'

const summary: BackendReplaySummary = {
  event_count: 4,
  gaze_event_count: 2,
  fixation_count: 1,
  click_count: 1,
  scroll_count: 1,
  task_event_count: 1,
  duration_ms: 3000,
  coordinate_space: 'normalized',
}

const aoiOverlay: BackendReplayAoiOverlay[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    label: 'Primary CTA',
    x: 0.52,
    y: 0.38,
    width: 0.2,
    height: 0.12,
    coordinate_space: 'normalized',
  },
]

const events: BackendReplayEvent[] = [
  {
    id: 'event-0001',
    type: 'task_start',
    timestamp: '2026-01-15T17:30:00.000Z',
    relative_ms: 0,
    aoi_ids: [],
    message: 'Task started',
  },
  {
    id: 'event-0002',
    type: 'gaze',
    timestamp: '2026-01-15T17:30:01.000Z',
    relative_ms: 1000,
    x: 0.61,
    y: 0.43,
    confidence: 0.91,
    aoi_ids: ['33333333-3333-4333-8333-333333333333'],
  },
  {
    id: 'event-0003',
    type: 'click',
    timestamp: '2026-01-15T17:30:02.000Z',
    relative_ms: 2000,
    x: 0.62,
    y: 0.44,
    confidence: 0.9,
    aoi_ids: ['33333333-3333-4333-8333-333333333333'],
  },
  {
    id: 'event-0004',
    type: 'scroll',
    timestamp: '2026-01-15T17:30:03.000Z',
    relative_ms: 3000,
    aoi_ids: [],
    message: 'Scrolled to 48%',
  },
]

const fixations: BackendReplayFixation[] = [
  {
    id: 'fixation-001',
    type: 'fixation',
    start_timestamp: '2026-01-15T17:30:01.000Z',
    end_timestamp: '2026-01-15T17:30:01.240Z',
    start_relative_ms: 1000,
    end_relative_ms: 1240,
    duration_ms: 240,
    x: 0.615,
    y: 0.435,
    sample_count: 4,
    average_confidence: 0.9,
    aoi_ids: ['33333333-3333-4333-8333-333333333333'],
  },
]

describe('SessionReplay', () => {
  it('renders AOI labels, gaze points, fixation markers, click markers, and scrubber controls', () => {
    const html = renderToStaticMarkup(
      <SessionReplay aoiOverlay={aoiOverlay} events={events} fixations={fixations} summary={summary} />,
    )

    expect(html).toContain('Primary CTA')
    expect(html).toContain('replay-gaze-point')
    expect(html).toContain('replay-fixation-point')
    expect(html).toContain('replay-click-marker')
    expect(html).toContain('Replay timeline position')
    expect(html).toContain('Scrolled to 48%')
  })

  it('filters future replay events at the current scrubber time', () => {
    const visibleData = getVisibleReplayData(events, fixations, 1000, summary.duration_ms)

    expect(visibleData.gazeEvents).toHaveLength(1)
    expect(visibleData.fixations).toHaveLength(1)
    expect(visibleData.clickEvents).toHaveLength(0)
    expect(visibleData.markerEvents.map((event) => event.message)).toEqual(['Task started'])
  })
})
