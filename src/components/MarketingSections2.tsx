import { useEffect, useRef, useState } from 'react'
import type { AnalysisReport } from '../lib/types'
import { Camera, ChevronRight, ShieldCheck, User, Sparkles, Check } from 'lucide-react'

const summaryTargetPercent = 92

export function PreviewSection({ report, onOpenResults }: { report: AnalysisReport; onOpenResults: () => void }) {
  const excessItems = report.totals.filter((total) => total.status === 'excess' || total.status === 'caution').slice(0, 2)
  const deficientItems = report.totals.filter((total) => total.status === 'deficient').slice(0, 3)
  const sectionRef = useRef<HTMLElement | null>(null)
  const [summaryPercent, setSummaryPercent] = useState(() => {
    if (typeof window === 'undefined') return 0
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return prefersReducedMotion || !('IntersectionObserver' in window) ? summaryTargetPercent : 0
  })

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return

    let frameId = 0
    const duration = 1300
    const startAnimation = () => {
      cancelAnimationFrame(frameId)
      setSummaryPercent(0)
      const startedAt = performance.now()
      const animate = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const easedProgress = 1 - Math.pow(1 - progress, 3)
        setSummaryPercent(Math.round(summaryTargetPercent * easedProgress))
        if (progress < 1) frameId = requestAnimationFrame(animate)
      }
      frameId = requestAnimationFrame(animate)
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        cancelAnimationFrame(frameId)
        setSummaryPercent(0)
        return
      }
      startAnimation()
    }, { threshold: 0.35 })

    observer.observe(section)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <section id="preview" className="preview-section" ref={sectionRef}>
      <h2>분석 결과 미리보기</h2>
      <div className="preview-panel">
        <article className="summary-ring">
          <h3>총 섭취 요약</h3>
          <div className="donut" style={{ '--donut-progress': `${summaryPercent}%` } as React.CSSProperties}>
            <strong>{summaryPercent}%</strong>
            <span>권장 대비 평균</span>
          </div>
          <ul>
            <li>총 섭취 성분 <b>27종</b></li>
            <li>적정 <b>{Math.max(report.statusSummary.normal, 22)}종</b></li>
            <li>과다 <b>{Math.max(report.statusSummary.excess, 2)}종</b></li>
            <li>부족 <b>{Math.max(report.statusSummary.deficient, 3)}종</b></li>
            <li>중복 <b>{Math.max(report.duplicateItems.length, 4)}종</b></li>
          </ul>
        </article>
        <article className="risk-preview warm">
          <h3>과다 섭취 주의</h3>
          {(excessItems.length ? excessItems : [
            { standardName: '비타민 A', percentOfTarget: 230 },
            { standardName: '나이아신', percentOfTarget: 180 },
          ]).map((item) => (
            <p key={item.standardName}><span>{item.standardName}</span><b>{item.percentOfTarget ?? 180}%</b></p>
          ))}
        </article>
        <article className="risk-preview cool">
          <h3>부족할 수 있어요</h3>
          {(deficientItems.length ? deficientItems : [
            { standardName: '비타민 D', percentOfTarget: 65 },
            { standardName: '마그네슘', percentOfTarget: 70 },
            { standardName: '오메가-3 (EPA+DHA)', percentOfTarget: 55 },
          ]).map((item) => (
            <p key={item.standardName}><span>{item.standardName}</span><b>{item.percentOfTarget ?? 65}%</b></p>
          ))}
        </article>
        <article className="guide-preview">
          <h3>복용 주의 / 정보</h3>
          <p>철분과 아연은 동시 섭취 시 흡수에 영향을 줄 수 있어요.</p>
          <p>유산균은 항생제 복용 시 2시간 간격을 권장해요.</p>
          <p>오메가-3는 식사와 함께 섭취하면 흡수율이 높아져요.</p>
        </article>
        <button type="button" className="button ghost result-button" onClick={onOpenResults}>
          전체 결과 보기
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

export function CtaBand({ onStart }: { onStart: () => void }) {
  return (
    <section id="cta" className="cta-band">
      <div className="product-visual" aria-hidden="true">
        <span className="paper-card" />
        <span className="bottle-card" />
        <span className="phone-card" />
      </div>
      <div>
        <h2>지금 바로, 나에게 딱 맞는<br />영양제 복용 관리를 시작하세요</h2>
        <p>사진 한 장으로 더 스마트한 건강 습관을 만들어보세요.</p>
        <button type="button" className="button light large" onClick={onStart}>
          <Camera size={19} />
          분석 시작하기
        </button>
      </div>
    </section>
  )
}

export function TrustStrip() {
  const items = [
    ['데이터 보안', '안전한 암호화 보관', ShieldCheck],
    ['개인 맞춤 분석', '나의 생활습관 기반', User],
    ['지속적 업데이트', '최신 영양 정보 반영', Sparkles],
    ['광고 없는 서비스', '편안한 사용 경험', Check],
  ] as const
  return (
    <section className="trust-strip" aria-label="서비스 신뢰 요소">
      {items.map(([title, detail, Icon]) => (
        <article key={title}>
          <Icon size={22} />
          <div>
            <strong>{title}</strong>
            <span>{detail}</span>
          </div>
        </article>
      ))}
    </section>
  )
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <a className="logo-lockup small" href="#top">
        <img src="/tt-ni-logo.svg" alt="+-ni" />
      </a>
      <nav aria-label="하단 링크">
        <a href="#features">회사 소개</a>
        <a href="#steps">이용약관</a>
        <a href="#preview">개인정보처리방침</a>
        <a href="/workspace">문의하기</a>
      </nav>
      <span>© 2024 +-ni. All rights reserved.</span>
    </footer>
  )
}
