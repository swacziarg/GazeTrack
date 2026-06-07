import type { MockStudyEvent } from './mockEvents'

export type DemoReportMetric = {
  label: string
  value: string
  note: string
}

export type DemoReportData = {
  eventCount: number
  timeToFirstFixationSeconds: number
  ctaDwellTimeSeconds: number
  taskCompletionTimeSeconds: number
  lowConfidenceSampleRate: number
  sessionQualityScore: number
  metrics: DemoReportMetric[]
  insights: string[]
}

function secondsBetween(start: string, end: string) {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000)
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`
}

export function generateDemoReport(events: MockStudyEvent[]): DemoReportData {
  const firstEvent = events[0]
  const firstFixation = events.find(
    (event) => event.event_type === 'gaze_sample_recorded' && event.payload.aoi === 'Hero CTA',
  )
  const taskCompleted = events.find((event) => event.event_type === 'task_completed')
  const qualitySignals = events.filter((event) => typeof event.payload.confidence === 'number')
  const lowConfidenceSamples = qualitySignals.filter((event) => (event.payload.confidence ?? 1) < 0.6)
  const ctaDwellMs = firstFixation?.payload.dwell_ms ?? 0
  const lowConfidenceSampleRate =
    qualitySignals.length === 0 ? 0 : Math.round((lowConfidenceSamples.length / qualitySignals.length) * 100)
  const timeToFirstFixationSeconds =
    firstEvent && firstFixation ? secondsBetween(firstEvent.timestamp, firstFixation.timestamp) : 0
  const taskCompletionTimeSeconds =
    firstEvent && taskCompleted ? secondsBetween(firstEvent.timestamp, taskCompleted.timestamp) : 0
  const sessionQualityScore = Math.max(0, Math.min(100, 95 - lowConfidenceSampleRate))
  const ctaDwellTimeSeconds = ctaDwellMs / 1000

  return {
    eventCount: events.length,
    timeToFirstFixationSeconds,
    ctaDwellTimeSeconds,
    taskCompletionTimeSeconds,
    lowConfidenceSampleRate,
    sessionQualityScore,
    metrics: [
      {
        label: 'Event count',
        value: String(events.length),
        note: 'Synthetic demo report',
      },
      {
        label: 'Time to first CTA fixation',
        value: formatSeconds(timeToFirstFixationSeconds),
        note: 'Synthetic demo report',
      },
      {
        label: 'CTA dwell time',
        value: formatSeconds(ctaDwellTimeSeconds),
        note: 'Synthetic demo report',
      },
      {
        label: 'Task completion time',
        value: formatSeconds(taskCompletionTimeSeconds),
        note: 'Synthetic demo report',
      },
      {
        label: 'Low-confidence sample rate',
        value: `${lowConfidenceSampleRate}%`,
        note: 'Synthetic demo report',
      },
      {
        label: 'Session quality score',
        value: `${sessionQualityScore} / 100`,
        note: 'Synthetic demo report',
      },
    ],
    insights: [
      'Demo: CTA was fixated before click.',
      'Demo: Session quality is acceptable for large AOI analysis.',
      'Demo: No raw webcam media was recorded.',
    ],
  }
}
