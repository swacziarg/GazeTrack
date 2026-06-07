import { defaultStudyBuilderConfig, type AreaOfInterest, type DemoStudy, type StudyBuilderConfig } from '../data/demoStudy'
import type { StudyAoi, StudyConfigurationPayload, StudyTask } from '../api/studies'
import type { SyntheticStudyConfig } from '../tracking/types'

function clampNormalized(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function clampAoiDimension(position: number, dimension: number) {
  const safePosition = clampNormalized(position)
  return Math.max(0.01, Math.min(1 - safePosition, Number.isFinite(dimension) ? dimension : 0.01))
}

function formatSemanticRole(semanticType?: string) {
  if (!semanticType) {
    return 'Custom region'
  }

  return `${semanticType} region`
}

export function sanitizeStudyBuilderConfig(config: StudyBuilderConfig): StudyBuilderConfig {
  const tasks = config.tasks
    .map((task) => ({ prompt: task.prompt.trim() }))
    .filter((task) => task.prompt.length > 0)
  const aois = config.aois
    .map((aoi) => {
      const x = clampNormalized(aoi.x)
      const y = clampNormalized(aoi.y)
      return {
        label: aoi.label.trim(),
        semanticType: aoi.semanticType?.trim() || undefined,
        x,
        y,
        width: clampAoiDimension(x, aoi.width),
        height: clampAoiDimension(y, aoi.height),
      }
    })
    .filter((aoi) => aoi.label.length > 0)

  return {
    name: config.name.trim() || defaultStudyBuilderConfig.name,
    objective: config.objective.trim(),
    targetUrl: config.targetUrl.trim(),
    pageLabel: config.pageLabel.trim() || config.targetUrl.trim() || defaultStudyBuilderConfig.pageLabel,
    tasks: tasks.length > 0 ? tasks : defaultStudyBuilderConfig.tasks,
    aois: aois.length > 0 ? aois : defaultStudyBuilderConfig.aois,
  }
}

export function toStudyConfigurationPayload(config: StudyBuilderConfig): StudyConfigurationPayload {
  const sanitized = sanitizeStudyBuilderConfig(config)

  return {
    name: sanitized.name,
    objective: sanitized.objective || null,
    target_url: sanitized.targetUrl || null,
    tasks: sanitized.tasks.map((task, index) => ({
      title: `Task ${index + 1}`,
      prompt: task.prompt,
      target_url: sanitized.targetUrl || null,
    })),
    aois: sanitized.aois.map((aoi) => ({
      label: aoi.label,
      semantic_type: aoi.semanticType || null,
      page_url: sanitized.targetUrl || null,
      x: aoi.x,
      y: aoi.y,
      width: aoi.width,
      height: aoi.height,
      coordinate_space: 'normalized',
    })),
  }
}

export function toVisualAois(config: StudyBuilderConfig): AreaOfInterest[] {
  return sanitizeStudyBuilderConfig(config).aois.map((aoi) => ({
    name: aoi.label,
    role: formatSemanticRole(aoi.semanticType),
    semanticType: aoi.semanticType,
    x: Math.round(aoi.x * 1000) / 10,
    y: Math.round(aoi.y * 1000) / 10,
    width: Math.round(aoi.width * 1000) / 10,
    height: Math.round(aoi.height * 1000) / 10,
  }))
}

export function toDemoStudy(config: StudyBuilderConfig): DemoStudy {
  const sanitized = sanitizeStudyBuilderConfig(config)
  const taskPrompt = sanitized.tasks[0]?.prompt ?? defaultStudyBuilderConfig.tasks[0].prompt

  return {
    name: sanitized.name,
    pageLabel: sanitized.pageLabel || sanitized.targetUrl || 'Custom synthetic demo page',
    taskPrompt,
    sessionQuality: 'Demo quality status: selectable synthetic quality mode.',
    aois: toVisualAois(sanitized),
    insights: [
      `Demo study preview: ${sanitized.aois.length} configured AOIs`,
      'Demo study preview: deterministic synthetic telemetry',
      'Demo study preview: telemetry-only reporting',
    ],
  }
}

export function toSyntheticStudyConfig(config: StudyBuilderConfig): SyntheticStudyConfig {
  const sanitized = sanitizeStudyBuilderConfig(config)

  return {
    name: sanitized.name,
    objective: sanitized.objective,
    targetUrl: sanitized.targetUrl,
    taskPrompt: sanitized.tasks[0]?.prompt ?? defaultStudyBuilderConfig.tasks[0].prompt,
    aois: sanitized.aois.map((aoi) => ({
      label: aoi.label,
      semanticType: aoi.semanticType,
      x: aoi.x,
      y: aoi.y,
      width: aoi.width,
      height: aoi.height,
    })),
  }
}

export function backendSetupToBuilderConfig(
  study: { name: string; objective: string | null; target_url: string | null },
  tasks: StudyTask[],
  aois: StudyAoi[],
): StudyBuilderConfig {
  return sanitizeStudyBuilderConfig({
    name: study.name,
    objective: study.objective ?? '',
    targetUrl: study.target_url ?? '',
    pageLabel: study.target_url ?? defaultStudyBuilderConfig.pageLabel,
    tasks: tasks.map((task) => ({ prompt: task.prompt })),
    aois: aois.map((aoi) => ({
      label: aoi.label,
      semanticType: aoi.semantic_type ?? undefined,
      x: aoi.x,
      y: aoi.y,
      width: aoi.width,
      height: aoi.height,
    })),
  })
}
