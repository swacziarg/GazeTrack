type PlaceholderPanelProps = {
  title: string
  description: string
}

export function PlaceholderPanel({ title, description }: PlaceholderPanelProps) {
  return (
    <article className="card placeholder-panel">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="status-pill pending">Demo preview</span>
      </div>
      <p>{description}</p>
    </article>
  )
}
