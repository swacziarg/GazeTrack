type FlowCardProps = {
  step: number
  label: string
}

export function FlowCard({ step, label }: FlowCardProps) {
  return (
    <article className="card flow-card">
      <span className="step-marker">{step}</span>
      <h3>{label}</h3>
      <p className="muted">Planned MVP flow step</p>
    </article>
  )
}
