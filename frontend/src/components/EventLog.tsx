import type { MockStudyEvent } from '../lib/mockEvents'

type EventLogProps = {
  events: MockStudyEvent[]
  sourceLabel: string
}

const MAX_RENDERED_EVENTS = 80

function formatEventType(eventType: string) {
  return eventType.replace(/_/g, ' ')
}

function formatTime(timestamp: string) {
  const eventDate = new Date(timestamp)
  const minutes = String(eventDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(eventDate.getUTCSeconds()).padStart(2, '0')
  const tenths = Math.floor(eventDate.getUTCMilliseconds() / 100)

  return `${minutes}:${seconds}.${tenths}`
}

function summarizePayload(event: MockStudyEvent) {
  const parts = [event.payload.label]

  if (event.payload.aoi) {
    parts.push(`AOI: ${event.payload.aoi}`)
  }

  if (typeof event.payload.confidence === 'number') {
    parts.push(`confidence ${event.payload.confidence.toFixed(2)}`)
  }

  if (typeof event.payload.scroll_depth_percent === 'number') {
    parts.push(`scroll ${event.payload.scroll_depth_percent}%`)
  }

  return parts.join(' | ')
}

export function EventLog({ events, sourceLabel }: EventLogProps) {
  const renderedEvents = events.slice(-MAX_RENDERED_EVENTS)
  const hiddenEventCount = Math.max(0, events.length - renderedEvents.length)

  return (
    <article className="card event-log">
      <div className="card-header">
        <div>
          <p className="eyebrow">{sourceLabel} events</p>
          <h3>Local event log</h3>
        </div>
        <span className="status-pill pending">Telemetry only</span>
      </div>

      {events.length === 0 ? (
        <p className="muted">Start the mock session to generate deterministic demo telemetry.</p>
      ) : (
        <>
          {hiddenEventCount > 0 ? (
            <p className="muted compact-text">
              Showing latest {renderedEvents.length} of {events.length} events.
            </p>
          ) : null}
          <ol className="event-list" aria-label={`Latest ${sourceLabel} telemetry events`}>
            {renderedEvents.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{formatEventType(event.event_type)}</strong>
                  <span>{formatTime(event.timestamp)}</span>
                </div>
                <p>{summarizePayload(event)}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}
