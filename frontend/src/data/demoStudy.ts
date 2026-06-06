export type DemoStudy = {
  studyName: string
  pageLabel: string
  taskPrompt: string
  aois: string[]
  sessionQuality: string
  insights: string[]
}

export const productFlow = [
  'Create study',
  'Define task and AOIs',
  'Calibrate webcam',
  'Record telemetry',
  'Review report',
]

export const demoStudy: DemoStudy = {
  studyName: 'Homepage CTA Validation (Demo)',
  pageLabel: 'https://demo-shop.example/home',
  taskPrompt: 'Find the pricing plan that includes team collaboration and start checkout.',
  aois: ['Hero CTA button', 'Top navigation pricing link', 'Feature comparison section'],
  sessionQuality: 'Demo quality status: Medium confidence (mock).',
  insights: [
    'CTA noticed quickly (demo insight)',
    'CTA ignored (demo insight)',
    'Poor calibration (demo insight)',
  ],
}

export const demoMetrics = [
  { label: 'Time to first fixation', value: '1.4s', note: 'Demo data' },
  { label: 'Dwell time on primary CTA', value: '3.1s', note: 'Demo data' },
  { label: 'Task completion time', value: '22.8s', note: 'Demo data' },
  { label: 'Session quality score', value: '78 / 100', note: 'Demo data' },
  { label: 'Low-confidence sample rate', value: '12%', note: 'Demo data' },
]
