export type AreaOfInterest = {
  name: string
  role: string
  semanticType?: string
  x: number
  y: number
  width: number
  height: number
}

export type StudyBuilderAoi = {
  label: string
  semanticType?: string
  x: number
  y: number
  width: number
  height: number
}

export type StudyBuilderTask = {
  prompt: string
}

export type StudyBuilderConfig = {
  name: string
  objective: string
  targetUrl: string
  pageLabel: string
  tasks: StudyBuilderTask[]
  aois: StudyBuilderAoi[]
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
  sessionQuality: 'Demo quality status: selectable synthetic quality mode.',
  aois: [
    {
      name: 'Hero headline',
      role: 'Initial message comprehension',
      semanticType: 'hero',
      x: 12,
      y: 18,
      width: 48,
      height: 14,
    },
    {
      name: 'Primary CTA',
      role: 'Primary conversion region',
      semanticType: 'CTA',
      x: 52,
      y: 38,
      width: 20,
      height: 12,
    },
    { name: 'Navigation', role: 'Task discovery path', semanticType: 'nav', x: 38, y: 5, width: 24, height: 11 },
    {
      name: 'Pricing preview',
      role: 'Decision-support region',
      semanticType: 'pricing',
      x: 36,
      y: 62,
      width: 34,
      height: 20,
    },
  ],
  insights: [
    'Demo study preview: CTA fixation and click sequence',
    'Demo study preview: confidence-aware session quality',
    'Demo study preview: telemetry-only reporting',
  ],
}

export const defaultStudyBuilderConfig: StudyBuilderConfig = {
  name: demoStudy.name,
  objective: 'Understand whether visitors find the team plan CTA on the pricing landing page.',
  targetUrl: 'https://example.test/pricing',
  pageLabel: demoStudy.pageLabel,
  tasks: [{ prompt: 'Find the team plan and start checkout.' }],
  aois: demoStudy.aois.map((aoi) => ({
    label: aoi.name,
    semanticType: aoi.semanticType,
    x: aoi.x / 100,
    y: aoi.y / 100,
    width: aoi.width / 100,
    height: aoi.height / 100,
  })),
}
