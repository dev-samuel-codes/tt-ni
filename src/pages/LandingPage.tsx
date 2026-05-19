import { LandingHeader, HeroSection } from '../components/landing/HeroSection'
import { FeatureReasonSection, HowItWorksSection } from '../components/landing/FeatureSection'
import { PreviewSection, CtaBand, TrustStrip, MarketingFooter } from '../components/landing/MarketingSections'
import type { AnalysisReport } from '../types'

export function LandingPage({
  confirmedCount,
  needsReview,
  previewReport,
  onLogin,
  onStart,
  onUpload,
  onOpenResults,
}: {
  confirmedCount: number
  needsReview: number
  previewReport: AnalysisReport
  onLogin: () => void
  onStart: () => void
  onUpload: () => void
  onOpenResults: () => void
}) {
  return (
    <>
      <LandingHeader onLogin={onLogin} onStart={onStart} />
      <HeroSection
        confirmedCount={confirmedCount}
        needsReview={needsReview}
        riskCount={previewReport.statusSummary.caution + previewReport.statusSummary.excess}
        onUpload={onUpload}
        onDemo={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <FeatureReasonSection />
      <HowItWorksSection />
      <PreviewSection report={previewReport} onOpenResults={onOpenResults} />
      <CtaBand onStart={onStart} />
      <TrustStrip />
      <MarketingFooter />
    </>
  )
}
