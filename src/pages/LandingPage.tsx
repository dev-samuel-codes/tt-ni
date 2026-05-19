import { LandingHeader, HeroSection } from '../components/landing/HeroSection'
import { FeatureReasonSection, HowItWorksSection } from '../components/landing/FeatureSection'
import { PreviewSection, CtaBand, TrustStrip, MarketingFooter } from '../components/landing/MarketingSections'
import type { AnalysisReport } from '../types'

export function LandingPage({
  sessionEmail,
  confirmedCount,
  needsReview,
  previewReport,
  onLogin,
  onOpenResults,
  onDashboard,
}: {
  sessionEmail: string | null
  confirmedCount: number
  needsReview: number
  previewReport: AnalysisReport
  onLogin: () => void
  onOpenResults: () => void
  onDashboard: () => void
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
      <MarketingFooter />
    </>
  )
}
