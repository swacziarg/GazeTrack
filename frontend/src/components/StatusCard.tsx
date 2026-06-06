type StatusCardProps = {
  title: string
  isLoading: boolean
  ok: boolean
  message: string
}

export function StatusCard({ title, isLoading, ok, message }: StatusCardProps) {
  const statusLabel = isLoading ? 'Checking…' : ok ? 'Online' : 'Offline'

  return (
    <article className="card status-card" aria-live="polite">
      <div className="card-header">
        <h2>{title}</h2>
        <span className={`status-pill ${isLoading ? 'pending' : ok ? 'ok' : 'error'}`}>
          {statusLabel}
        </span>
      </div>
      <p>{message}</p>
    </article>
  )
}
