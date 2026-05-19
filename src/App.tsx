import { useEffect, useState } from 'react'
import './App.css'
import { runAnalysis } from './lib/analysisEngine'
import { createAnalysisReportFromServer } from './lib/serverAnalysis'
import { supabase } from './lib/supabaseClient'
import type { AnalysisReport, Medication, Profile, SupplementProduct } from './lib/types'
import { LandingHeader, HeroSection } from './components/LandingComponents'
import { FeatureReasonSection, HowItWorksSection } from './components/MarketingSections'
import { PreviewSection, CtaBand, TrustStrip, MarketingFooter } from './components/MarketingSections2'
import { LoginPage, WorkspacePage } from './components/Pages'

type WorkspaceTab = 'overview' | 'profile' | 'supplements' | 'analysis'

const defaultProfile: Profile = {
  gender: 'female', birthYear: 1998, heightCm: 165, weightKg: 55,
  pregnancyStatus: 'none', lactationStatus: false,
  conditions: [], allergies: [], dietaryRestrictions: [],
  consentAccepted: true,
}

function App() {
  const hasAuthCallback = useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const searchParams = new URLSearchParams(window.location.search)
    return hashParams.has('access_token') || searchParams.has('code')
  })[0]

  const initialAuthNotice = useState<{ tone: 'success' | 'warning'; message: string } | null>(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const searchParams = new URLSearchParams(window.location.search)
    const error = hashParams.get('error') ?? searchParams.get('error')
    const errorDescription = hashParams.get('error_description') ?? searchParams.get('error_description')
    const errorCode = hashParams.get('error_code') ?? searchParams.get('error_code')
    if (error || errorDescription || errorCode) {
      return { tone: 'warning', message: `소셜 로그인에 실패했습니다. ${errorDescription ?? error ?? errorCode}` }
    }
    return null
  })[0]

  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>(defaultProfile)
  const [medications, setMedications] = useState<Medication[]>([])
  const [supplements, setSupplements] = useState<SupplementProduct[]>([])
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analysisSyncMessage, setAnalysisSyncMessage] = useState('')
  const [authNotice, setAuthNotice] = useState<{ tone: 'success' | 'warning'; message: string } | null>(initialAuthNotice)

  function clearAuthCallbackUrl() {
    if (!window.location.search && !window.location.hash) return
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  async function loadUserData(userId: string) {
    const [profileResult, conditionsResult, medicationsResult, userSupplementsResult] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_conditions').select('*').eq('user_id', userId),
      supabase.from('user_medications').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase
        .from('user_supplements')
        .select('id, daily_servings, intake_time, active, memo, supplement_products(id, product_name, brand_name, source_type, label_image_path, supplement_ingredients(*))')
        .eq('user_id', userId).eq('active', true).order('created_at', { ascending: true }),
    ])

    if (profileResult.data) {
      const conditions = conditionsResult.data ?? []
      setProfile({
        gender: profileResult.data.gender, birthYear: profileResult.data.birth_year,
        heightCm: profileResult.data.height_cm ?? undefined, weightKg: profileResult.data.weight_kg ?? undefined,
        pregnancyStatus: profileResult.data.pregnancy_status ?? 'none',
        lactationStatus: Boolean(profileResult.data.lactation_status),
        consentAccepted: Boolean(profileResult.data.consent_accepted),
        conditions: conditions.filter((item) => !item.condition_code.startsWith('allergy:') && !item.condition_code.startsWith('diet:')).map((item) => item.condition_name),
        allergies: conditions.filter((item) => item.condition_code.startsWith('allergy:')).map((item) => item.condition_name),
        dietaryRestrictions: conditions.filter((item) => item.condition_code.startsWith('diet:')).map((item) => item.condition_name),
      })
    }

    setMedications((medicationsResult.data ?? []).map((medication) => ({
      id: medication.id, name: medication.medication_name, purpose: medication.dosage_text ?? '',
      frequency: medication.frequency ?? '', memo: medication.memo ?? '',
    })))

    setSupplements((userSupplementsResult.data ?? []).flatMap((row) => {
      const product = Array.isArray(row.supplement_products) ? row.supplement_products[0] : row.supplement_products
      if (!product) return []
      return [{
        id: product.id, productName: product.product_name, brandName: product.brand_name ?? '',
        sourceType: product.source_type, dailyServings: Number(row.daily_servings),
        intakeTime: row.intake_time ?? '', imageName: product.label_image_path ?? undefined,
        confirmed: true,
        ingredients: (product.supplement_ingredients ?? []).map((ingredient) => ({
          id: ingredient.id, rawName: ingredient.raw_name, standardName: ingredient.standard_name,
          nutrientId: ingredient.nutrient_id, amount: ingredient.amount === null ? null : Number(ingredient.amount),
          unit: ingredient.unit, confidence: Number(ingredient.confidence),
          rawText: ingredient.raw_name, reviewRequired: Boolean(ingredient.review_required),
        })),
      }]
    }))
  }

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        if (initialAuthNotice) {
          setAuthNotice({ tone: 'warning', message: `소셜 로그인 세션 생성에 실패했습니다. ${error.message}` })
          clearAuthCallbackUrl()
        }
        return
      }
      setSessionEmail(data.session?.user.email ?? null)
      if (data.session?.user) {
        if (hasAuthCallback) {
          setActiveTab('profile')
          clearAuthCallbackUrl()
        }
        void loadUserData(data.session.user.id)
      } else if (initialAuthNotice) {
        setAuthNotice({ tone: 'warning', message: '소셜 로그인 응답을 받았지만 세션을 만들지 못했습니다. 다시 시도해 주세요.' })
        clearAuthCallbackUrl()
      }
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      setSessionEmail(session?.user.email ?? null)
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          setActiveTab('profile')
        }
        void loadUserData(session.user.id)
      } else {
        setProfile(defaultProfile)
        setMedications([])
        setSupplements([])
        setReport(null)
      }
    })
    return () => { cancelled = true; data.subscription.unsubscribe() }
  }, [hasAuthCallback, initialAuthNotice])

  const previewReport = runAnalysis(profile, medications, supplements)
  const confirmedCount = supplements.filter((supplement) => supplement.confirmed).length
  const needsReview = supplements.flatMap((supplement) => supplement.ingredients).filter((ingredient) => ingredient.reviewRequired).length

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  function navigateTo(path: string) {
    window.history.pushState({}, '', path)
    setCurrentPath(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToWorkspace(tab: WorkspaceTab) {
    setActiveTab(tab)
    navigateTo('/workspace')
  }

  async function handleRunAnalysis() {
    setAnalysisSyncMessage('')
    setReport(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('로그인 후 분석 리포트를 서버에 저장할 수 있습니다.')
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { profile, medications, supplements },
      })
      if (error) throw error
      const serverReport = createAnalysisReportFromServer(data)
      setReport(serverReport)
      setAnalysisSyncMessage(`Supabase 분석 리포트 저장 완료: ${serverReport.id}`)
    } catch (error) {
      setAnalysisSyncMessage(error instanceof Error ? error.message : '서버 분석 저장에 실패했습니다.')
    }
    setActiveTab('analysis')
  }

  if (currentPath === '/workspace') {
    return (
      <main className="landing-shell workspace-page-shell">
        {authNotice && (
          <section className={`auth-callback-notice ${authNotice.tone}`} role="status">
            <span>{authNotice.message}</span>
            <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">닫기</button>
          </section>
        )}
        <WorkspacePage
          sessionEmail={sessionEmail} onSessionEmail={setSessionEmail}
          onBackHome={() => navigateTo('/')} activeTab={activeTab} onTabChange={setActiveTab}
          confirmedCount={confirmedCount} needsReview={needsReview} previewReport={previewReport}
          profile={profile} medications={medications} supplements={supplements}
          report={report} analysisSyncMessage={analysisSyncMessage}
          onProfile={setProfile} onMedications={setMedications}
          onSupplements={setSupplements} onAnalyze={handleRunAnalysis}
        />
      </main>
    )
  }

  if (currentPath === '/login') {
    return (
      <main className="landing-shell auth-page-shell">
        {authNotice && (
          <section className={`auth-callback-notice ${authNotice.tone}`} role="status">
            <span>{authNotice.message}</span>
            <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">닫기</button>
          </section>
        )}
        <LoginPage
          sessionEmail={sessionEmail} onSessionEmail={setSessionEmail}
          onBackHome={() => navigateTo('/')}
          onOpenWorkspace={() => { setActiveTab('profile'); navigateTo('/workspace') }}
        />
      </main>
    )
  }

  return (
    <main className="landing-shell">
      <LandingHeader onLogin={() => navigateTo('/login')} onStart={() => goToWorkspace('supplements')} />
      {authNotice && (
        <section className={`auth-callback-notice ${authNotice.tone}`} role="status">
          <span>{authNotice.message}</span>
          <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">닫기</button>
        </section>
      )}
      <HeroSection
        confirmedCount={confirmedCount} needsReview={needsReview}
        riskCount={previewReport.statusSummary.caution + previewReport.statusSummary.excess}
        onUpload={() => goToWorkspace('supplements')}
        onDemo={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <FeatureReasonSection />
      <HowItWorksSection />
      <PreviewSection report={previewReport} onOpenResults={() => goToWorkspace('analysis')} />
      <CtaBand onStart={() => goToWorkspace('supplements')} />
      <TrustStrip />
      <MarketingFooter />
    </main>
  )
}

export default App
