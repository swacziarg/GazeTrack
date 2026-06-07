import type { BrowserGazeStatusSnapshot } from '../tracking'

type GazeDebugOverlayProps = {
  enabled: boolean
  status: BrowserGazeStatusSnapshot | null
}

export function GazeDebugOverlay({ enabled, status }: GazeDebugOverlayProps) {
  if (!enabled || !status?.latestPoint) {
    return null
  }

  return (
    <div className="gaze-debug-overlay" aria-label="Approximate browser gaze debug overlay">
      <span
        className="gaze-debug-dot"
        style={{
          left: `${status.latestPoint.x * 100}vw`,
          top: `${status.latestPoint.y * 100}vh`,
        }}
      />
      <span className="gaze-debug-label">Approximate gaze</span>
    </div>
  )
}
