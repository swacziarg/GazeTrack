type MetricCardProps = {
  label: string
  value: string
  note: string
}

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <article className="card metric-card">
      <p className="eyebrow">{note}</p>
      <h3>{value}</h3>
      <p>{label}</p>
    </article>
  )
}
