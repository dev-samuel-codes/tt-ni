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

export function LegalNotice() {
  return (
    <section className="legal-strip">
      <span>
        개인정보와 성분표 이미지는 최소 수집 원칙, RLS, 비공개 Storage 정책을 전제로 설계했습니다. 결과는 의료 진단이나 처방이 아니며
        복용 변경 전 전문가 상담이 필요합니다.
      </span>
    </section>
  )
}
