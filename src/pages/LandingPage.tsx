import { LandingHeader, HeroSection } from '../components/landing/HeroSection'
import { FeatureReasonSection, HowItWorksSection } from '../components/landing/FeatureSection'
import { PreviewSection, CtaBand, TrustStrip, MarketingFooter } from '../components/landing/MarketingSections'
import type { AnalysisReport } from '../types'

/**
 * 랜딩 페이지.
 * 히어로 섹션 → 기능 소개 → 작동 방식 → 미리보기 → CTA → 신뢰 스트립 → 푸터 순서로 구성됩니다.
 * 세션 상태에 따라 로그인/대시보드 링크가 동적으로 표시됩니다.
 */
export function LandingPage({
  sessionEmail,
  confirmedCount,
  needsReview,
  previewReport,
  onLogin,
  onOpenResults,
  onDashboard,
  onNavigate,
}: {
  sessionEmail: string | null
  confirmedCount: number
  needsReview: number
  previewReport: AnalysisReport
  onLogin: () => void
  onOpenResults: () => void
  onDashboard: () => void
  onNavigate?: (path: string) => void
}) {
  return (
    <>
      <LandingHeader sessionEmail={sessionEmail} onLogin={onLogin} onDashboard={onDashboard} />
      <HeroSection
        sessionEmail={sessionEmail}
        confirmedCount={confirmedCount}
        needsReview={needsReview}
        riskCount={previewReport.statusSummary.caution + previewReport.statusSummary.excess}
        onLogin={onLogin}
        onDashboard={onDashboard}
      />
      <FeatureReasonSection />
      <HowItWorksSection />
      <PreviewSection report={previewReport} onOpenResults={onOpenResults} />
      <CtaBand sessionEmail={sessionEmail} onLogin={onLogin} onDashboard={onDashboard} />
      <TrustStrip />
      <MarketingFooter onNavigate={onNavigate} />
    </>
  )
}
