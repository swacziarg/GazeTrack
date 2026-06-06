type FlowCardProps = {
  step: number
  label: string
}

export function FlowCard({ step, label }: FlowCardProps) {
  return (
    <article className="card flow-card">
      <p className="eyebrow">Step {step}</p>
      <h3>{label}</h3>
    </article>
  )
}
