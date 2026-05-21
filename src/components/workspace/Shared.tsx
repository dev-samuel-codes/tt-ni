import type { ReactNode } from 'react'

export function BrandMark() {
  return (
    <span className="mini-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  )
}

export function MiniFeature({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <article className="mini-feature">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

export function MetricCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: ReactNode }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
