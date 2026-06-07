export type MockEventType =
  | 'task_started'
  | 'calibration_completed'
  | 'gaze_sample_recorded'
  | 'click_recorded'
  | 'scroll_recorded'
  | 'task_completed'

export type MockEventPayload = {
  label: string
  synthetic: true
  aoi?: string
  x?: number
  y?: number
  viewport_width?: number
  viewport_height?: number
  confidence?: number
  calibration_error_px?: number
  dwell_ms?: number
  scroll_depth_percent?: number
  target?: string
  completed?: boolean
}

export type MockStudyEvent = {
  id: string
  event_type: MockEventType
  timestamp: string
  payload: MockEventPayload
}

const DEMO_SESSION_START_MS = Date.UTC(2026, 0, 15, 17, 30, 0)

function createTimestamp(offsetMs: number) {
  return new Date(DEMO_SESSION_START_MS + offsetMs).toISOString()
}

export function generateMockStudyEvents(): MockStudyEvent[] {
  return [
    {
      id: 'demo-event-001',
      event_type: 'task_started',
      timestamp: createTimestamp(0),
      payload: {
        label: 'Synthetic demo task started',
        synthetic: true,
        target: 'Find the team plan and start checkout',
      },
    },
    {
      id: 'demo-event-002',
      event_type: 'calibration_completed',
      timestamp: createTimestamp(2400),
      payload: {
        label: 'Synthetic demo calibration completed',
        synthetic: true,
        calibration_error_px: 42,
        confidence: 0.86,
      },
    },
    {
      id: 'demo-event-003',
      event_type: 'gaze_sample_recorded',
      timestamp: createTimestamp(4100),
      payload: {
        label: 'Synthetic demo gaze sample on pricing navigation',
        synthetic: true,
        aoi: 'Pricing navigation link',
        x: 672,
        y: 96,
        viewport_width: 1440,
        viewport_height: 900,
        confidence: 0.82,
      },
    },
    {
      id: 'demo-event-004',
      event_type: 'scroll_recorded',
      timestamp: createTimestamp(7300),
      payload: {
        label: 'Synthetic demo scroll toward plans',
        synthetic: true,
        scroll_depth_percent: 48,
        confidence: 0.8,
      },
    },
    {
      id: 'demo-event-005',
      event_type: 'gaze_sample_recorded',
      timestamp: createTimestamp(9400),
      payload: {
        label: 'Synthetic demo gaze sample on hero CTA',
        synthetic: true,
        aoi: 'Hero CTA',
        x: 846,
        y: 392,
        viewport_width: 1440,
        viewport_height: 900,
        confidence: 0.88,
        dwell_ms: 3100,
      },
    },
    {
      id: 'demo-event-006',
      event_type: 'gaze_sample_recorded',
      timestamp: createTimestamp(13200),
      payload: {
        label: 'Synthetic demo low-confidence sample',
        synthetic: true,
        aoi: 'Plan comparison table',
        x: 768,
        y: 612,
        viewport_width: 1440,
        viewport_height: 900,
        confidence: 0.48,
      },
    },
    {
      id: 'demo-event-007',
      event_type: 'click_recorded',
      timestamp: createTimestamp(17800),
      payload: {
        label: 'Synthetic demo click on checkout CTA',
        synthetic: true,
        aoi: 'Hero CTA',
        x: 862,
        y: 404,
        viewport_width: 1440,
        viewport_height: 900,
        confidence: 0.84,
      },
    },
    {
      id: 'demo-event-008',
      event_type: 'task_completed',
      timestamp: createTimestamp(22800),
      payload: {
        label: 'Synthetic demo task completed',
        synthetic: true,
        completed: true,
      },
    },
  ]
}
