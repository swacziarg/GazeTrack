import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MockStudyEvent } from '../lib/mockEvents'
import { EventLog } from './EventLog'

function createEvent(index: number): MockStudyEvent {
  return {
    id: `event-${index}`,
    event_type: 'gaze_sample_recorded',
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    payload: {
      label: `Browser gaze sample ${index}`,
      confidence: 0.8,
    },
  }
}

describe('EventLog', () => {
  it('renders a bounded tail of live telemetry events', () => {
    const events = Array.from({ length: 85 }, (_, index) => createEvent(index + 1))

    const html = renderToStaticMarkup(<EventLog events={events} sourceLabel="Browser gaze experiment" />)

    expect(html).toContain('Browser gaze experiment events')
    expect(html).toContain('Showing latest 80 of 85 events')
    expect(html).not.toContain('Browser gaze sample 5 | confidence')
    expect(html).toContain('Browser gaze sample 6')
    expect(html).toContain('Browser gaze sample 85')
  })
})
