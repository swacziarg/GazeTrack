import { SyntheticTracker } from './syntheticTracker'
import type { SyntheticTelemetryMode, TrackerId, TrackerProvider } from './types'
import { WebGazerTracker } from './webgazerTracker'

export type TrackerOption = {
  id: TrackerId
  label: string
  description: string
}

type EnvLike = Record<string, string | boolean | undefined>

export function isWebGazerFeatureEnabled(env: EnvLike = import.meta.env) {
  return env.VITE_ENABLE_WEBGAZER === true || String(env.VITE_ENABLE_WEBGAZER).toLowerCase() === 'true'
}

export function getTrackerOptions(env: EnvLike = import.meta.env): TrackerOption[] {
  const options: TrackerOption[] = [
    {
      id: 'synthetic',
      label: 'Synthetic demo',
      description: 'Deterministic task telemetry with no camera permission.',
    },
  ]

  if (isWebGazerFeatureEnabled(env)) {
    options.push({
      id: 'webgazer',
      label: 'Browser gaze experiment',
      description: 'Experimental browser-based gaze estimation behind explicit consent.',
    })
  }

  return options
}

export function createTrackerProvider(
  trackerId: TrackerId = 'synthetic',
  options: { syntheticMode?: SyntheticTelemetryMode } = {},
): TrackerProvider {
  if (trackerId === 'webgazer') {
    return new WebGazerTracker()
  }

  return new SyntheticTracker({ mode: options.syntheticMode })
}
