import { describe, expect, it } from 'vitest'
import { generateMockStudyEvents } from './mockEvents'
import { generateDemoReport } from './mockReport'

function getMetricLabels(report: ReturnType<typeof generateDemoReport>) {
  return report.metrics.map((metric) => metric.label)
}

describe('generateDemoReport', () => {
  it('returns the expected top-level report fields', () => {
    const report = generateDemoReport(generateMockStudyEvents())

    expect(report).toEqual(
      expect.objectContaining({
        eventCount: expect.any(Number),
        timeToFirstFixationSeconds: expect.any(Number),
        ctaDwellTimeSeconds: expect.any(Number),
        taskCompletionTimeSeconds: expect.any(Number),
        lowConfidenceSampleRate: expect.any(Number),
        sessionQualityScore: expect.any(Number),
        metrics: expect.any(Array),
        insights: expect.any(Array),
      }),
    )
  })

  it('matches event count to the input event list', () => {
    const events = generateMockStudyEvents()
    const report = generateDemoReport(events)

    expect(report.eventCount).toBe(events.length)
    expect(report.metrics).toContainEqual(
      expect.objectContaining({
        label: 'Event count',
        value: String(events.length),
      }),
    )
  })

  it('includes the expected demo report metrics', () => {
    const report = generateDemoReport(generateMockStudyEvents())

    expect(getMetricLabels(report)).toEqual(
      expect.arrayContaining([
        'Time to first CTA fixation',
        'CTA dwell time',
        'Task completion time',
        'Low-confidence sample rate',
        'Session quality score',
      ]),
    )
  })

  it('includes a privacy insight about raw webcam media not being recorded', () => {
    const report = generateDemoReport(generateMockStudyEvents())

    expect(report.insights.some((insight) => insight.toLowerCase().includes('no raw webcam media'))).toBe(true)
  })

  it('handles an empty event list with safe demo defaults', () => {
    const report = generateDemoReport([])

    expect(report.eventCount).toBe(0)
    expect(report.timeToFirstFixationSeconds).toBe(0)
    expect(report.ctaDwellTimeSeconds).toBe(0)
    expect(report.taskCompletionTimeSeconds).toBe(0)
    expect(report.lowConfidenceSampleRate).toBe(0)
    expect(report.sessionQualityScore).toBeGreaterThanOrEqual(0)
    expect(report.sessionQualityScore).toBeLessThanOrEqual(100)
    expect(getMetricLabels(report)).toEqual(expect.arrayContaining(['Event count', 'Session quality score']))
    expect(report.insights.length).toBeGreaterThan(0)
  })
})
