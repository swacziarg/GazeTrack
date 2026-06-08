import { useState, type ReactNode } from 'react'

type DisclosureCardProps = {
  id: string
  title: string
  eyebrow?: string
  status?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function DisclosureCard({ id, title, eyebrow, status, defaultOpen = false, children }: DisclosureCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section className="disclosure-card">
      <button
        aria-controls={id}
        aria-expanded={isOpen}
        className="disclosure-summary"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <span className="disclosure-title">{title}</span>
        </span>
        <span className="disclosure-meta">
          {status}
          <span className="disclosure-action">{isOpen ? 'Close' : 'Open'}</span>
        </span>
      </button>
      <div className="disclosure-body" hidden={!isOpen} id={id}>
        {children}
      </div>
    </section>
  )
}
