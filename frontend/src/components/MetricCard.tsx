type MetricCardProps = {
  label: string
  value: string
  note: string
}

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <article className="card metric-card">
      <p className="eyebrow">{note}</p>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  )
}
