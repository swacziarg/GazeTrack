import type { BackendHealth } from '../api/health'

type StatusCardProps = {
  health: BackendHealth
  isLoading: boolean
}

export function StatusCard({ health, isLoading }: StatusCardProps) {
  const statusClass = isLoading ? 'pending' : health.ok ? 'ok' : 'error'
  const statusLabel = isLoading ? 'Checking' : health.ok ? 'Online' : 'Offline'

  return (
    <article className="card status-card" aria-live="polite">
      <div className="card-header">
        <div>
          <p className="eyebrow">Backend status</p>
          <h2>Health endpoint</h2>
        </div>
        <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
      </div>
      <p>{isLoading ? 'Checking backend health endpoint.' : health.message}</p>
      <p className="muted">GET {health.apiBaseUrl}/health</p>
    </article>
  )
}
