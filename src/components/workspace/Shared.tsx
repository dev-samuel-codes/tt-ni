import type { ReactNode } from 'react'

/** tt-ni 브랜드 마크 (작은 장식 요소) */
export function BrandMark() {
  return (
    <span className="mini-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  )
}

/** 랜딩 페이지 등에서 사용하는 작은 기능 소개 카드 */
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

/** 대시보드 상태 요약 카드. label/값/톤/아이콘을 표시합니다. */
export function MetricCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: ReactNode }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
