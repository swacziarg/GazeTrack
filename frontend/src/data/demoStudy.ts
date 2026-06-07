export type AreaOfInterest = {
  name: string
  role: string
}

export type DemoMetric = {
  label: string
  value: string
  note: string
}

export type DemoStudy = {
  name: string
  pageLabel: string
  taskPrompt: string
  sessionQuality: string
  aois: AreaOfInterest[]
  insights: string[]
  metrics: DemoMetric[]
}

export const flowSteps = [
  'Create study',
  'Define task and AOIs',
  'Calibrate webcam',
  'Record telemetry',
  'Review report',
] as const

export const demoStudy: DemoStudy = {
  name: 'Demo Homepage CTA Study',
  pageLabel: 'Demo page: example pricing landing page',
  taskPrompt: 'Static demo task: find the team plan and start checkout.',
  sessionQuality: 'Demo quality status: medium confidence, 78 / 100.',
  aois: [
    { name: 'Hero CTA', role: 'Primary conversion region' },
    { name: 'Pricing navigation link', role: 'Task discovery path' },
    { name: 'Plan comparison table', role: 'Decision-support region' },
  ],
  insights: [
    'Demo: CTA noticed quickly',
    'Demo: CTA ignored',
    'Demo: Poor calibration',
  ],
  metrics: [
    { label: 'Time to first fixation', value: '1.4s', note: 'Static demo data' },
    { label: 'Dwell time on primary CTA', value: '3.1s', note: 'Static demo data' },
    { label: 'Task completion time', value: '22.8s', note: 'Static demo data' },
    { label: 'Session quality score', value: '78 / 100', note: 'Static demo data' },
    { label: 'Low-confidence sample rate', value: '12%', note: 'Static demo data' },
  ],
}
