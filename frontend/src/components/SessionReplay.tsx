import { useEffect, useMemo, useState } from 'react'
import type {
  BackendReplayAoiOverlay,
  BackendReplayEvent,
  BackendReplayFixation,
  BackendReplaySummary,
} from '../api/reports'

type SessionReplayProps = {
  summary?: BackendReplaySummary
  events?: BackendReplayEvent[]
  fixations?: BackendReplayFixation[]
  aoiOverlay?: BackendReplayAoiOverlay[]
  initialTimeMs?: number
}

type VisibleReplayData = {
  gazeEvents: BackendReplayEvent[]
  clickEvents: BackendReplayEvent[]
  markerEvents: BackendReplayEvent[]
  fixations: BackendReplayFixation[]
}

const TIMELINE_EVENT_TYPES = new Set(['task_start', 'task_complete', 'scroll', 'calibration', 'quality', 'page_view'])

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isPointEvent(event: BackendReplayEvent) {
  return typeof event.x === 'number' && typeof event.y === 'number'
}

function isVisibleAt(relativeMs: number | null, currentTimeMs: number, durationMs: number) {
  if (relativeMs === null) {
    return currentTimeMs >= durationMs
  }

  return relativeMs <= currentTimeMs
}

function toSvgCoordinate(value: number) {
  return clamp(value, 0, 1) * 100
}

function formatTime(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

export function getVisibleReplayData(
  events: BackendReplayEvent[],
  fixations: BackendReplayFixation[],
  currentTimeMs: number,
  durationMs: number,
): VisibleReplayData {
  const visibleEvents = events.filter((event) => isVisibleAt(event.relative_ms, currentTimeMs, durationMs))
  const visibleFixations = fixations.filter((fixation) =>
    isVisibleAt(fixation.start_relative_ms, currentTimeMs, durationMs),
  )

  return {
    gazeEvents: visibleEvents.filter((event) => event.type === 'gaze' && isPointEvent(event)),
    clickEvents: visibleEvents.filter((event) => event.type === 'click' && isPointEvent(event)),
    markerEvents: visibleEvents.filter((event) => TIMELINE_EVENT_TYPES.has(event.type)),
    fixations: visibleFixations,
  }
}

export function SessionReplay({
  summary,
  events = [],
  fixations = [],
  aoiOverlay = [],
  initialTimeMs,
}: SessionReplayProps) {
  const durationMs = Math.max(0, summary?.duration_ms ?? 0)
  const [currentTimeMs, setCurrentTimeMs] = useState(() => clamp(initialTimeMs ?? durationMs, 0, durationMs))
  const [isPlaying, setIsPlaying] = useState(false)
  const visibleData = useMemo(
    () => getVisibleReplayData(events, fixations, currentTimeMs, durationMs),
    [currentTimeMs, durationMs, events, fixations],
  )

  useEffect(() => {
    if (!isPlaying || durationMs <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCurrentTimeMs((value) => {
        const nextValue = value + Math.max(100, Math.round(durationMs / 40))
        if (nextValue >= durationMs) {
          setIsPlaying(false)
          return durationMs
        }
        return nextValue
      })
    }, 120)

    return () => window.clearInterval(intervalId)
  }, [durationMs, isPlaying])

  if (!summary || (events.length === 0 && fixations.length === 0 && aoiOverlay.length === 0)) {
    return <p className="muted">Replay unavailable for this report.</p>
  }

  return (
    <div className="session-replay">
      <div className="session-replay-toolbar">
        <button
          className="secondary-button replay-toggle"
          type="button"
          onClick={() => {
            if (currentTimeMs >= durationMs) {
              setCurrentTimeMs(0)
            }
            setIsPlaying((value) => !value)
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <label className="replay-scrubber-label">
          <span>{formatTime(currentTimeMs)}</span>
          <input
            aria-label="Replay timeline position"
            max={durationMs}
            min={0}
            onChange={(event) => {
              setIsPlaying(false)
              setCurrentTimeMs(clamp(Number(event.currentTarget.value), 0, durationMs))
            }}
            step={100}
            type="range"
            value={currentTimeMs}
          />
          <span>{formatTime(durationMs)}</span>
        </label>
      </div>

      <div className="session-replay-canvas" aria-label="Session replay normalized AOI overlay">
        <svg role="img" viewBox="0 0 100 100">
          <title>Normalized-coordinate session replay</title>
          <rect className="replay-page-bg" height="100" width="100" x="0" y="0" />

          {aoiOverlay.map((aoi) => (
            <g key={aoi.id}>
              <rect
                className="replay-aoi-box"
                height={toSvgCoordinate(aoi.height)}
                width={toSvgCoordinate(aoi.width)}
                x={toSvgCoordinate(aoi.x)}
                y={toSvgCoordinate(aoi.y)}
              />
              <text className="replay-aoi-label" x={toSvgCoordinate(aoi.x) + 1} y={toSvgCoordinate(aoi.y) + 4}>
                {aoi.label}
              </text>
            </g>
          ))}

          {visibleData.gazeEvents.map((event) => (
            <circle
              className="replay-gaze-point"
              cx={toSvgCoordinate(event.x ?? 0)}
              cy={toSvgCoordinate(event.y ?? 0)}
              key={event.id}
              r="0.9"
            />
          ))}

          {visibleData.fixations.map((fixation) => (
            <circle
              className="replay-fixation-point"
              cx={toSvgCoordinate(fixation.x)}
              cy={toSvgCoordinate(fixation.y)}
              key={fixation.id}
              r={clamp(1.8 + fixation.sample_count * 0.12, 2, 5)}
            />
          ))}

          {visibleData.clickEvents.map((event) => {
            const x = toSvgCoordinate(event.x ?? 0)
            const y = toSvgCoordinate(event.y ?? 0)
            return (
              <g className="replay-click-marker" key={event.id}>
                <circle cx={x} cy={y} r="2.3" />
                <line x1={x - 3} x2={x + 3} y1={y} y2={y} />
                <line x1={x} x2={x} y1={y - 3} y2={y + 3} />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="session-replay-meta">
        <dl className="backend-report-stats compact-grid">
          <div>
            <dt>Replay events</dt>
            <dd>{summary.event_count}</dd>
          </div>
          <div>
            <dt>Gaze points</dt>
            <dd>{visibleData.gazeEvents.length} visible</dd>
          </div>
          <div>
            <dt>Fixations</dt>
            <dd>{visibleData.fixations.length} visible</dd>
          </div>
          <div>
            <dt>Clicks</dt>
            <dd>{visibleData.clickEvents.length} visible</dd>
          </div>
        </dl>

        {visibleData.markerEvents.length > 0 ? (
          <ol className="replay-marker-list">
            {visibleData.markerEvents.map((event) => (
              <li key={event.id}>
                <span>{formatTime(event.relative_ms ?? durationMs)}</span>
                <strong>{event.message ?? event.label ?? event.type}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted compact-text">No task, scroll, calibration, or page markers are visible yet.</p>
        )}
      </div>
    </div>
  )
}
