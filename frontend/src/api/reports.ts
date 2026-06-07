export type BackendAoiMetric = {
  aoi_id: string
  label: string
  page_url: string | null
  coordinate_space: string
  gaze_sample_count: number
  first_gaze_timestamp: string | null
  approximate_dwell_ms: number
  dwell_time_ms: number
  click_count_inside_aoi: number
  click_count: number
  fixation_count: number
  fixation_dwell_ms: number
  first_fixation_timestamp: string | null
  time_to_first_fixation_ms: number | null
  click_after_fixation_ms: number | null
  attention_share_pct: number
  average_fixation_confidence: number | null
}

export type BackendAoiInsight = {
  aoi_id: string
  label: string
  dwell_time_ms: number
  fixation_count: number
  time_to_first_fixation_ms: number | null
  click_count: number
  click_after_fixation_ms: number | null
  attention_share_pct: number
}

export type BackendAoiAttentionRankingItem = BackendAoiInsight & {
  rank: number
  attention_score: number
}

export type BackendQualityInterpretation = {
  label: 'Usable' | 'Use with caution' | 'Limited'
  explanation: string
}

export type BackendFixationSummary = {
  fixation_count: number
  total_fixation_dwell_ms: number
  average_fixation_duration_ms: number | null
  average_fixation_confidence?: number
  fixation_algorithm: string
  fixation_algorithm_notes: string
}

export type BackendQualitySummary = {
  score: number | null
  low_confidence_threshold: number
  low_confidence_sample_rate: number | null
  gaze_sample_count: number
  average_gaze_confidence: number | null
  calibration_event_count: number
  calibration_points_completed: number | null
  average_calibration_error_px: number | null
  average_calibration_error_normalized: number | null
  quality_event_count: number
  sample_integrity_basis_event_count: number
  sample_completeness_score: number | null
  quality_verdict: 'pass' | 'warn' | 'fail'
  quality_reasons: string[]
}

export type BackendReplaySummary = {
  event_count: number
  gaze_event_count: number
  fixation_count: number
  click_count: number
  scroll_count: number
  task_event_count: number
  duration_ms: number
  coordinate_space: 'normalized'
}

export type BackendReplayEvent = {
  id: string
  type: string
  timestamp: string
  relative_ms: number | null
  x?: number | null
  y?: number | null
  confidence?: number | null
  aoi_ids: string[]
  label?: string | null
  message?: string | null
  source?: string | null
}

export type BackendReplayFixation = {
  id: string
  type: 'fixation'
  start_timestamp: string
  end_timestamp: string
  start_relative_ms: number | null
  end_relative_ms: number | null
  duration_ms: number
  x: number
  y: number
  sample_count: number
  average_confidence?: number | null
  aoi_ids: string[]
}

export type BackendReplayAoiOverlay = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  coordinate_space: 'normalized'
}

export type BackendSessionReport = {
  session_id: string
  study_id: string | null
  study_name: string | null
  study_objective: string | null
  target_url: string | null
  analytics_version: string
  report_status: 'placeholder' | 'persisted'
  generated_at: string
  event_count: number
  event_type_counts: Record<string, number>
  first_event_timestamp: string | null
  last_event_timestamp: string | null
  contains_gaze_events: boolean
  low_confidence_sample_rate: number | null
  session_quality_score: number | null
  tracker_type: string
  tracker_mode_label: string
  tracker_experimental: boolean
  tracker_notice: string | null
  task_count: number
  task_prompts: string[]
  aoi_count: number
  has_aoi_metrics: boolean
  aoi_metrics: BackendAoiMetric[]
  report_summary: string[]
  quality_interpretation: BackendQualityInterpretation
  aoi_attention_ranking: BackendAoiAttentionRankingItem[]
  first_noticed_aoi: BackendAoiInsight | null
  most_attended_aoi: BackendAoiInsight | null
  weak_or_ignored_aois: BackendAoiInsight[]
  recommended_next_actions: string[]
  completed: boolean
  insights: string[]
  metrics: Record<string, unknown>
  privacy_summary: Record<string, unknown>
  fixation_summary: BackendFixationSummary
  quality_summary: BackendQualitySummary
  replay_summary?: BackendReplaySummary
  replay_events?: BackendReplayEvent[]
  replay_fixations?: BackendReplayFixation[]
  replay_aoi_overlay?: BackendReplayAoiOverlay[]
  notes: string[]
}

export type BackendReportResult = {
  ok: boolean
  backendAvailable: boolean
  apiBaseUrl: string
  statusCode?: number
  report: BackendSessionReport | null
  message: string
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000'

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  return (configuredUrl?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

export async function fetchSessionReport(sessionId: string): Promise<BackendReportResult> {
  const apiBaseUrl = getApiBaseUrl()
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/report`, {
      headers: {
        Accept: 'application/json',
      },
    })
  } catch {
    return {
      ok: false,
      backendAvailable: false,
      apiBaseUrl,
      report: null,
      message: 'Backend unavailable — showing local demo report only.',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      report: null,
      message: `Backend responded with HTTP ${response.status}.`,
    }
  }

  try {
    return {
      ok: true,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      report: (await response.json()) as BackendSessionReport,
      message: 'Backend demo report generated from persisted telemetry.',
    }
  } catch {
    return {
      ok: false,
      backendAvailable: true,
      apiBaseUrl,
      statusCode: response.status,
      report: null,
      message: 'Backend returned an unreadable demo report payload.',
    }
  }
}
