export type AreaOfInterest = {
  name: string
  role: string
  x: number
  y: number
  width: number
  height: number
}

export type DemoStudy = {
  name: string
  pageLabel: string
  taskPrompt: string
  sessionQuality: string
  aois: AreaOfInterest[]
  insights: string[]
}

export const flowSteps = [
  'Create study',
  'Define task and AOIs',
  'Calibrate quality',
  'Record telemetry',
  'Review report',
] as const

export const demoStudy: DemoStudy = {
  name: 'Demo Homepage CTA Study',
  pageLabel: 'Demo page: example pricing landing page',
  taskPrompt: 'Static demo task: find the team plan and start checkout.',
  sessionQuality: 'Demo quality status: medium confidence, 78 / 100.',
  aois: [
    { name: 'Hero CTA', role: 'Primary conversion region', x: 52, y: 38, width: 20, height: 12 },
    { name: 'Pricing navigation link', role: 'Task discovery path', x: 40, y: 7, width: 18, height: 8 },
    { name: 'Plan comparison table', role: 'Decision-support region', x: 38, y: 62, width: 30, height: 18 },
  ],
  insights: [
    'Demo study preview: CTA fixation and click sequence',
    'Demo study preview: confidence-aware session quality',
    'Demo study preview: telemetry-only reporting',
  ],
}
