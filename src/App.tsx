import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Database,
  FileImage,
  HeartPulse,
  Loader2,
  Lock,
  LogOut,
  Pill,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import './App.css'
import { runAnalysis, statusLabel } from './lib/analysisEngine'
import { findNutrientByName, nutrients } from './lib/nutritionData'
import { createAnalysisReportFromServer } from './lib/serverAnalysis'
import { supabase } from './lib/supabaseClient'
import type { AnalysisReport, Medication, ParsedIngredient, Profile, SupplementProduct, Unit } from './lib/types'
import type { Provider } from '@supabase/supabase-js'

const defaultProfile: Profile = {
  gender: 'female',
  birthYear: 1998,
  heightCm: 165,
  weightKg: 55,
  pregnancyStatus: 'none',
  lactationStatus: false,
  conditions: [],
  allergies: [],
  dietaryRestrictions: [],
  consentAccepted: true,
}

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const knownNutrientIds = new Set(nutrients.map((nutrient) => nutrient.id))
const allowedLabelMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
type SocialProvider = Extract<Provider, 'google' | 'kakao'>
type SocialProviderStatus = Record<SocialProvider, boolean | null>
type AuthNoticeState = {
  tone: 'success' | 'warning'
  message: string
} | null
type WorkspaceTab = 'overview' | 'profile' | 'supplements' | 'analysis'
const socialProviderLabels: Record<SocialProvider, string> = {
  google: '구글',
  kakao: '카카오',
}

function parseAuthCallbackNotice(): AuthNoticeState {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  const error = hashParams.get('error') ?? searchParams.get('error')
  const errorDescription = hashParams.get('error_description') ?? searchParams.get('error_description')
  const errorCode = hashParams.get('error_code') ?? searchParams.get('error_code')

  if (error || errorDescription || errorCode) {
    return {
      tone: 'warning',
      message: `소셜 로그인에 실패했습니다. ${errorDescription ?? error ?? errorCode}`,
    }
  }

  if (hashParams.has('access_token') || searchParams.has('code')) {
    return {
      tone: 'success',
      message: '소셜 로그인 인증 응답을 확인하는 중입니다.',
    }
  }

  return null
}

function clearAuthCallbackUrl() {
  if (!window.location.search && !window.location.hash) return
  window.history.replaceState({}, document.title, window.location.pathname)
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getStatusTone(status: string): string {
  if (status === 'excess' || status === 'high') return 'danger'
  if (status === 'caution' || status === 'deficient' || status === 'review') return 'warning'
  if (status === 'normal') return 'success'
  return 'neutral'
}

function App() {
  const initialAuthNotice = useState(parseAuthCallbackNotice)[0]
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>(defaultProfile)
  const [medications, setMedications] = useState<Medication[]>([])
  const [supplements, setSupplements] = useState<SupplementProduct[]>([])
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analysisSyncMessage, setAnalysisSyncMessage] = useState('')
  const [authNotice, setAuthNotice] = useState<AuthNoticeState>(initialAuthNotice)

  async function loadUserData(userId: string) {
    const [profileResult, conditionsResult, medicationsResult, userSupplementsResult] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_conditions').select('*').eq('user_id', userId),
      supabase.from('user_medications').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase
        .from('user_supplements')
        .select('id, daily_servings, intake_time, active, memo, supplement_products(id, product_name, brand_name, source_type, label_image_path, supplement_ingredients(*))')
        .eq('user_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: true }),
    ])

    if (profileResult.data) {
      const conditions = conditionsResult.data ?? []
      setProfile({
        gender: profileResult.data.gender,
        birthYear: profileResult.data.birth_year,
        heightCm: profileResult.data.height_cm ?? undefined,
        weightKg: profileResult.data.weight_kg ?? undefined,
        pregnancyStatus: profileResult.data.pregnancy_status ?? 'none',
        lactationStatus: Boolean(profileResult.data.lactation_status),
        consentAccepted: Boolean(profileResult.data.consent_accepted),
        conditions: conditions.filter((item) => !item.condition_code.startsWith('allergy:') && !item.condition_code.startsWith('diet:')).map((item) => item.condition_name),
        allergies: conditions.filter((item) => item.condition_code.startsWith('allergy:')).map((item) => item.condition_name),
        dietaryRestrictions: conditions.filter((item) => item.condition_code.startsWith('diet:')).map((item) => item.condition_name),
      })
    }

    setMedications(
      (medicationsResult.data ?? []).map((medication) => ({
        id: medication.id,
        name: medication.medication_name,
        purpose: medication.dosage_text ?? '',
        frequency: medication.frequency ?? '',
        memo: medication.memo ?? '',
      })),
    )

    setSupplements(
      (userSupplementsResult.data ?? []).flatMap((row) => {
        const product = Array.isArray(row.supplement_products) ? row.supplement_products[0] : row.supplement_products
        if (!product) return []
        return [{
          id: product.id,
          productName: product.product_name,
          brandName: product.brand_name ?? '',
          sourceType: product.source_type,
          dailyServings: Number(row.daily_servings),
          intakeTime: row.intake_time ?? '',
          imageName: product.label_image_path ?? undefined,
          confirmed: true,
          ingredients: (product.supplement_ingredients ?? []).map((ingredient) => ({
            id: ingredient.id,
            rawName: ingredient.raw_name,
            standardName: ingredient.standard_name,
            nutrientId: ingredient.nutrient_id,
            amount: ingredient.amount === null ? null : Number(ingredient.amount),
            unit: ingredient.unit,
            confidence: Number(ingredient.confidence),
            rawText: ingredient.raw_name,
            reviewRequired: Boolean(ingredient.review_required),
          })),
        }]
      }),
    )
  }

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        if (initialAuthNotice) {
          setAuthNotice({
            tone: 'warning',
            message: `소셜 로그인 세션 생성에 실패했습니다. ${error.message}`,
          })
          clearAuthCallbackUrl()
        }
        return
      }

      setSessionEmail(data.session?.user.email ?? null)
      if (data.session?.user) {
        if (initialAuthNotice) {
          setAuthNotice({
            tone: 'success',
            message: '로그인되었습니다. 저장된 복용 정보를 불러오는 중입니다.',
          })
          setActiveTab('profile')
          clearAuthCallbackUrl()
        }
        void loadUserData(data.session.user.id)
      } else if (initialAuthNotice) {
        setAuthNotice({
          tone: 'warning',
          message: '소셜 로그인 응답을 받았지만 세션을 만들지 못했습니다. 다시 시도해 주세요.',
        })
        clearAuthCallbackUrl()
      }
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      setSessionEmail(session?.user.email ?? null)
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          setAuthNotice({
            tone: 'success',
            message: '로그인되었습니다. 저장된 복용 정보를 불러오는 중입니다.',
          })
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
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [initialAuthNotice])

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

  function openWorkspace(tab: WorkspaceTab) {
    setActiveTab(tab)
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
            <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">
              닫기
            </button>
          </section>
        )}
        <WorkspacePage
          sessionEmail={sessionEmail}
          onSessionEmail={setSessionEmail}
          onBackHome={() => navigateTo('/')}
          activeTab={activeTab}
          onTabChange={openWorkspace}
          confirmedCount={confirmedCount}
          needsReview={needsReview}
          previewReport={previewReport}
          profile={profile}
          medications={medications}
          supplements={supplements}
          report={report}
          analysisSyncMessage={analysisSyncMessage}
          onProfile={setProfile}
          onMedications={setMedications}
          onSupplements={setSupplements}
          onAnalyze={handleRunAnalysis}
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
            <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">
              닫기
            </button>
          </section>
        )}
        <LoginPage
          sessionEmail={sessionEmail}
          onSessionEmail={setSessionEmail}
          onBackHome={() => navigateTo('/')}
          onOpenWorkspace={() => {
            setActiveTab('profile')
            navigateTo('/workspace')
          }}
        />
      </main>
    )
  }

  return (
    <main className="landing-shell">
      <LandingHeader
        onLogin={() => navigateTo('/login')}
        onStart={() => goToWorkspace('supplements')}
      />
      {authNotice && (
        <section className={`auth-callback-notice ${authNotice.tone}`} role="status">
          <span>{authNotice.message}</span>
          <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">
            닫기
          </button>
        </section>
      )}
      <HeroSection
        confirmedCount={confirmedCount}
        needsReview={needsReview}
        riskCount={previewReport.statusSummary.caution + previewReport.statusSummary.excess}
        onUpload={() => goToWorkspace('supplements')}
        onDemo={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <FeatureReasonSection />
      <HowItWorksSection />
      <PreviewSection
        report={previewReport}
        onOpenResults={() => goToWorkspace('analysis')}
      />
      <CtaBand onStart={() => goToWorkspace('supplements')} />
      <TrustStrip />

      <MarketingFooter />
    </main>
  )
}

function WorkspacePage({
  sessionEmail,
  onSessionEmail,
  onBackHome,
  activeTab,
  onTabChange,
  confirmedCount,
  needsReview,
  previewReport,
  profile,
  medications,
  supplements,
  report,
  analysisSyncMessage,
  onProfile,
  onMedications,
  onSupplements,
  onAnalyze,
}: {
  sessionEmail: string | null
  onSessionEmail: (email: string | null) => void
  onBackHome: () => void
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  confirmedCount: number
  needsReview: number
  previewReport: AnalysisReport
  profile: Profile
  medications: Medication[]
  supplements: SupplementProduct[]
  report: AnalysisReport | null
  analysisSyncMessage: string
  onProfile: (profile: Profile) => void
  onMedications: (medications: Medication[]) => void
  onSupplements: (supplements: SupplementProduct[]) => void
  onAnalyze: () => void
}) {
  const tabs = [
    ['overview', '대시보드', Activity],
    ['profile', '내 정보', User],
    ['supplements', '성분 분석', Pill],
    ['analysis', '복용 관리', ClipboardList],
  ] as const

  return (
    <section className="workspace-page" aria-label="tt-ni 작업공간">
      <header className="workspace-page-header">
        <button type="button" className="login-back-button" onClick={onBackHome}>
          <ArrowLeft size={18} />
          홈으로
        </button>
        <a className="logo-lockup" href="/" onClick={(event) => {
          event.preventDefault()
          onBackHome()
        }} aria-label="tt-ni 홈">
          <img src="/tt-ni-logo.svg" alt="+-ni" />
        </a>
      </header>

      <section id="analysis-workspace" className="workspace-dock workspace-page-dock open" aria-label="분석 작업공간">
        <div className="workspace-dock-header">
          <div>
            <span>tt-ni 작업공간</span>
            <h2>사진 업로드부터 분석 결과까지 바로 이어서 진행하세요.</h2>
          </div>
          <AuthPanel sessionEmail={sessionEmail} onSessionEmail={onSessionEmail} />
        </div>

        <nav className="dock-tabs" aria-label="분석 기능">
          {tabs.map(([id, label, Icon]) => (
            <button
              className={activeTab === id ? 'dock-tab active' : 'dock-tab'}
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="status-grid" aria-label="요약 상태">
          <MetricCard label="확정 영양제" value={`${confirmedCount}개`} tone="success" icon={<Pill size={20} />} />
          <MetricCard label="확인 필요 성분" value={`${needsReview}개`} tone={needsReview ? 'warning' : 'success'} icon={<AlertTriangle size={20} />} />
          <MetricCard label="과다/초과" value={`${previewReport.statusSummary.caution + previewReport.statusSummary.excess}개`} tone="danger" icon={<Activity size={20} />} />
          <MetricCard label="약물/질환 주의" value={`${previewReport.interactionWarnings.length}개`} tone="warning" icon={<ShieldCheck size={20} />} />
        </section>

        {activeTab === 'overview' && (
          <Dashboard
            report={previewReport}
            supplements={supplements}
            onStart={() => onTabChange('supplements')}
            onAnalyze={onAnalyze}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileAndMedication profile={profile} medications={medications} onProfile={onProfile} onMedications={onMedications} />
        )}
        {activeTab === 'supplements' && (
          <SupplementWorkspace supplements={supplements} onSupplements={onSupplements} onAnalyze={onAnalyze} />
        )}
        {activeTab === 'analysis' && <AnalysisResult report={report} syncMessage={analysisSyncMessage} onAnalyze={onAnalyze} />}

        <LegalNotice />
      </section>
    </section>
  )
}

function LoginPage({
  sessionEmail,
  onSessionEmail,
  onBackHome,
  onOpenWorkspace,
}: {
  sessionEmail: string | null
  onSessionEmail: (email: string | null) => void
  onBackHome: () => void
  onOpenWorkspace: () => void
}) {
  return (
    <section className="login-page" aria-label="로그인">
      <header className="login-page-header">
        <button type="button" className="login-back-button" onClick={onBackHome}>
          <ArrowLeft size={18} />
          홈으로
        </button>
        <a className="logo-lockup" href="/" onClick={(event) => {
          event.preventDefault()
          onBackHome()
        }} aria-label="tt-ni 홈">
          <img src="/tt-ni-logo.svg" alt="+-ni" />
        </a>
      </header>

      <div className="login-page-grid">
        <div className="login-copy">
          <span className="login-caption">내 영양제 데이터를 안전하게 보관하세요</span>
          <h1>로그인하고 분석 기록을 이어서 관리하세요.</h1>
          <p>프로필, 복용 약, 영양제 성분표와 분석 리포트를 계정에 저장해 다음 접속에서도 그대로 이어갈 수 있습니다.</p>
          <div className="login-highlights" aria-label="로그인 후 가능한 기능">
            <article>
              <ShieldCheck size={20} />
              <div>
                <strong>개인 데이터 저장</strong>
                <span>프로필과 복용 정보를 계정 단위로 관리</span>
              </div>
            </article>
            <article>
              <Database size={20} />
              <div>
                <strong>분석 결과 동기화</strong>
                <span>Supabase에 리포트와 입력 정보를 보관</span>
              </div>
            </article>
            <article>
              <Sparkles size={20} />
              <div>
                <strong>맞춤 추천 준비</strong>
                <span>누적 기록 기반으로 복용 관리 고도화</span>
              </div>
            </article>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-panel-heading">
            <Lock size={19} />
            <div>
              <h2>{sessionEmail ? '로그인 상태' : 'tt-ni 로그인'}</h2>
              <p>{sessionEmail ? '현재 계정으로 분석 작업공간을 열 수 있습니다.' : '소셜 계정 또는 이메일로 계속하세요.'}</p>
            </div>
          </div>
          <AuthPanel sessionEmail={sessionEmail} onSessionEmail={onSessionEmail} variant="page" />
          {sessionEmail && (
            <button type="button" className="button primary login-workspace-button" onClick={onOpenWorkspace}>
              작업공간 열기
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function LandingHeader({ onLogin, onStart }: { onLogin: () => void; onStart: () => void }) {
  return (
    <header className="landing-header">
      <a className="logo-lockup" href="#top" aria-label="tt-ni 홈">
        <img src="/tt-ni-logo.svg" alt="+-ni" />
      </a>
      <nav className="landing-nav" aria-label="서비스 소개">
        <a href="#features">서비스 소개</a>
        <a href="#preview">성분 분석</a>
        <a href="#steps">복용 관리</a>
        <a href="#cta">추천</a>
      </nav>
      <div className="landing-actions">
        <button type="button" className="login-link" onClick={onLogin}>로그인</button>
        <button type="button" className="button primary mint" onClick={onStart}>분석 시작하기</button>
      </div>
    </header>
  )
}

function BrandMark() {
  return (
    <span className="mini-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  )
}

function HeroSection({
  confirmedCount,
  needsReview,
  riskCount,
  onUpload,
  onDemo,
}: {
  confirmedCount: number
  needsReview: number
  riskCount: number
  onUpload: () => void
  onDemo: () => void
}) {
  return (
    <section id="top" className="hero-section">
      <div className="hero-copy">
        <span className="hero-pill">AI 영양제 분석 & 복용 관리 서비스</span>
        <h1>
          성분표를 찍으면,
          <br />
          내 영양제 상태를 <em>한눈에</em>
        </h1>
        <p>사진 한 장으로 성분을 AI가 인식하고, 중복 섭취와 부족·과다 영양소를 분석해 더 건강한 복용 관리를 도와드려요.</p>
        <div className="hero-buttons">
          <button type="button" className="button primary large" onClick={onUpload}>
            <Camera size={19} />
            사진 업로드
          </button>
          <button type="button" className="button ghost large" onClick={onDemo}>
            <ChevronRight size={18} />
            데모 보기
          </button>
        </div>
        <div className="hero-benefits" aria-label="핵심 기능">
          <MiniFeature icon={<Camera size={19} />} title="AI 성분 인식" detail="정확한 성분 추출" />
          <MiniFeature icon={<ShieldCheck size={19} />} title="중복 섭취 체크" detail="같은 성분 자동 탐지" />
          <MiniFeature icon={<User size={19} />} title="부족/과다 분석" detail="섭취 상태 한눈에" />
          <MiniFeature icon={<HeartPulse size={19} />} title="복용 가이드" detail="맞춤 관리 추천" />
        </div>
      </div>
      <HeroMockup confirmedCount={confirmedCount} needsReview={needsReview} riskCount={riskCount} />
    </section>
  )
}

function MiniFeature({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
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

function HeroMockup({
  confirmedCount,
  needsReview,
  riskCount,
}: {
  confirmedCount: number
  needsReview: number
  riskCount: number
}) {
  const totalCount = Math.max(confirmedCount + needsReview + riskCount, 27)
  return (
    <div className="hero-visual" aria-label="tt-ni 분석 대시보드 미리보기">
      <div className="soft-orbit" />
      <div className="dashboard-frame">
        <aside className="mock-sidebar">
          <BrandMark />
          {['대시보드', '성분 분석', '복용 관리', '추천', '내 정보'].map((item, index) => (
            <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
          ))}
        </aside>
        <div className="mock-content">
          <div className="mock-top">
            <div>
              <h2>안녕하세요, 홍길동님</h2>
              <p>오늘의 영양제 섭취 상태를 확인해보세요.</p>
            </div>
            <span className="avatar-dot" />
          </div>
          <div className="mock-cards">
            <article>
              <strong>오늘의 성분 요약</strong>
              <div className="score-row">
                <span>
                  <b>{totalCount}</b>종
                </span>
                <span className="ring">92%</span>
              </div>
            </article>
            <article>
              <strong>주의가 필요한 항목</strong>
              <ul>
                <li><i className="danger-dot" />과다 <b>{Math.max(riskCount, 2)}종</b></li>
                <li><i className="warn-dot" />부족 <b>{Math.max(needsReview, 3)}종</b></li>
                <li><i className="info-dot" />중복 <b>4종</b></li>
              </ul>
            </article>
          </div>
          <article className="mock-chart">
            <strong>주요 영양소 섭취 현황</strong>
            <div className="bar-chart">
              {[64, 38, 54, 77, 48, 90, 60, 82].map((height, index) => (
                <span style={{ '--bar': `${height}%` } as React.CSSProperties} key={index} />
              ))}
            </div>
          </article>
        </div>
      </div>
      <article className="floating-score">
        <span>비타민 D</span>
        <strong>65%</strong>
        <p>권장 섭취량 대비</p>
        <i />
      </article>
    </div>
  )
}

function FeatureReasonSection() {
  const items = [
    ['성분표 사진 업로드', '영양제 라벨을 찍으면 AI가 글자를 인식해 성분 정보를 추출합니다.', Camera],
    ['AI 성분 자동 분석', '복잡한 성분명을 표준화하고 함량, 단위까지 정리합니다.', Sparkles],
    ['섭취 상태 분석', '중복 섭취, 과다, 부족을 판단해 영양소별 섭취 상태를 보여줍니다.', Activity],
    ['맞춤 추천 가이드', '지금 내게 필요한 영양소와 복용 팁을 개인 맞춤형으로 추천합니다.', HeartPulse],
  ] as const

  return (
    <section id="features" className="feature-section">
      <h2>+-ni가 특별한 이유</h2>
      <div className="reason-grid">
        {items.map(([title, detail, Icon]) => (
          <article className="reason-card" key={title}>
            <span><Icon size={30} /></span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const steps = [
    ['사진 업로드', '영양제 성분표가 보이게 선명하게 촬영해 업로드합니다.', Camera],
    ['성분 자동 인식', 'AI가 성분명과 함량을 인식해 데이터로 변환합니다.', ClipboardList],
    ['사용자 확인', '인식된 성분과 복용 주기를 확인하고 저장합니다.', User],
    ['분석 결과 확인', '내 섭취 상태와 추천 가이드를 한눈에 확인합니다.', Activity],
  ] as const

  return (
    <section id="steps" className="steps-section">
      <h2>이용 방법</h2>
      <div className="steps-row">
        {steps.map(([title, detail, Icon], index) => (
          <article className="step-card" key={title}>
            <b>{index + 1}</b>
            <span><Icon size={26} /></span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PreviewSection({ report, onOpenResults }: { report: AnalysisReport; onOpenResults: () => void }) {
  const excessItems = report.totals.filter((total) => total.status === 'excess' || total.status === 'caution').slice(0, 2)
  const deficientItems = report.totals.filter((total) => total.status === 'deficient').slice(0, 3)
  return (
    <section id="preview" className="preview-section">
      <h2>분석 결과 미리보기</h2>
      <div className="preview-panel">
        <article className="summary-ring">
          <h3>총 섭취 요약</h3>
          <div className="donut"><strong>92%</strong><span>권장 대비 평균</span></div>
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

function CtaBand({ onStart }: { onStart: () => void }) {
  return (
    <section id="cta" className="cta-band">
      <div className="product-visual" aria-hidden="true">
        <span className="paper-card" />
        <span className="bottle-card"><BrandMark /></span>
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

function TrustStrip() {
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

function MarketingFooter() {
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

function AuthPanel({
  sessionEmail,
  onSessionEmail,
  variant = 'dock',
}: {
  sessionEmail: string | null
  onSessionEmail: (email: string | null) => void
  variant?: 'dock' | 'page'
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<SocialProvider | null>(null)
  const [socialProviderStatus, setSocialProviderStatus] = useState<SocialProviderStatus>({
    google: null,
    kakao: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    async function loadProviderStatus() {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('OAuth provider 설정 상태를 불러오지 못했습니다.')
        const settings = await response.json() as { external?: Partial<Record<SocialProvider, boolean>> }
        setSocialProviderStatus({
          google: settings.external?.google ?? false,
          kakao: settings.external?.kakao ?? false,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSocialProviderStatus({ google: null, kakao: null })
      }
    }
    void loadProviderStatus()
    return () => controller.abort()
  }, [])

  async function signIn(mode: 'login' | 'signup') {
    if (!email) return
    setLoading(true)
    setMessage('')
    try {
      const result =
        mode === 'signup'
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      onSessionEmail(result.data.user?.email ?? email)
      setMessage(mode === 'signup' ? '가입 요청이 처리됐습니다.' : '로그인됐습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '인증 중 문제가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function signInWithSocial(provider: SocialProvider) {
    if (socialProviderStatus[provider] === false) {
      setMessage(`${socialProviderLabels[provider]} 로그인은 Supabase Auth Provider 설정이 먼저 필요합니다.`)
      return
    }
    setOauthLoading(provider)
    setMessage('')
    try {
      const redirectPath = variant === 'page' ? '/login' : '/'
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
        },
      })
      if (error) throw error
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${provider} 로그인 시작에 실패했습니다.`)
      setOauthLoading(null)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    onSessionEmail(null)
  }

  if (sessionEmail) {
    return (
      <div className={variant === 'page' ? 'auth-card compact page-auth-card' : 'auth-card compact'}>
        <Lock size={16} />
        <span>{sessionEmail}</span>
        <button type="button" className="icon-button" aria-label="로그아웃" onClick={signOut}>
          <LogOut size={16} />
        </button>
      </div>
    )
  }

  return (
    <form className={variant === 'page' ? 'auth-card page-auth-card' : 'auth-card'} onSubmit={(event) => event.preventDefault()}>
      <div className="auth-state">
        <Lock size={16} />
        <span>Supabase Auth</span>
      </div>
      <div className="social-auth-actions" aria-label="소셜 로그인">
        <button
          type="button"
          className="social-auth-button google"
          onClick={() => signInWithSocial('google')}
          disabled={loading || oauthLoading !== null || socialProviderStatus.google === false}
        >
          {oauthLoading === 'google' ? <Loader2 size={16} className="spin" /> : <span>G</span>}
          구글로 로그인
        </button>
        <button
          type="button"
          className="social-auth-button kakao"
          onClick={() => signInWithSocial('kakao')}
          disabled={loading || oauthLoading !== null || socialProviderStatus.kakao === false}
        >
          {oauthLoading === 'kakao' ? <Loader2 size={16} className="spin" /> : <span>K</span>}
          카카오로 로그인
        </button>
      </div>
      {(socialProviderStatus.google === false || socialProviderStatus.kakao === false) && (
        <small className="auth-provider-warning">Supabase Dashboard에서 Google/Kakao provider를 활성화하면 소셜 로그인이 바로 동작합니다.</small>
      )}
      <div className="auth-divider"><span>또는 이메일로 계속</span></div>
      <input
        aria-label="이메일"
        type="email"
        placeholder="email@example.com"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        aria-label="비밀번호"
        type="password"
        placeholder="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="auth-actions">
        <button type="button" className="button ghost" onClick={() => signIn('signup')} disabled={loading}>
          가입
        </button>
        <button type="button" className="button primary" onClick={() => signIn('login')} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : '로그인'}
        </button>
      </div>
      {message && <small>{message}</small>}
    </form>
  )
}

function MetricCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: ReactNode }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Dashboard({
  report,
  supplements,
  onStart,
  onAnalyze,
}: {
  report: AnalysisReport
  supplements: SupplementProduct[]
  onStart: () => void
  onAnalyze: () => void
}) {
  return (
    <div className="panel-grid two">
      <section className="panel wide">
        <div className="section-heading">
          <div>
            <h2>오늘의 위험 요약</h2>
            <p>확정된 제품만 계산에 포함했습니다.</p>
          </div>
          <button type="button" className="button primary" onClick={onAnalyze}>
            분석 실행
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="risk-board">
          {report.totals.length === 0 ? (
            <EmptyState title="아직 확정된 성분이 없습니다." detail="성분표 사진을 올리거나 수동으로 성분을 입력해 주세요." action={onStart} />
          ) : (
            report.totals.slice(0, 6).map((total) => (
              <article className={`risk-row ${getStatusTone(total.status)}`} key={total.nutrientId}>
                <div>
                  <strong>{total.standardName}</strong>
                  <span>
                    {Math.round(total.totalAmount * 100) / 100}
                    {total.unit}
                  </span>
                </div>
                <span className="status-pill">{statusLabel(total.status)}</span>
                <p>{total.message}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>등록 제품</h2>
            <p>사용자 검수 완료 여부</p>
          </div>
        </div>
        <div className="product-list">
          {supplements.length === 0 && <p className="muted">등록된 영양제가 없습니다.</p>}
          {supplements.map((supplement) => (
            <article className="product-row" key={supplement.id}>
              <div>
                <strong>{supplement.productName}</strong>
                <span>{supplement.ingredients.length}개 성분</span>
              </div>
              <span className={supplement.confirmed ? 'status-pill success' : 'status-pill warning'}>
                {supplement.confirmed ? '확정' : '검수 전'}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action: () => void }) {
  return (
    <div className="empty-state">
      <Sparkles size={26} />
      <h3>{title}</h3>
      <p>{detail}</p>
      <button type="button" className="button primary" onClick={action}>
        영양제 등록
      </button>
    </div>
  )
}

function ProfileAndMedication({
  profile,
  medications,
  onProfile,
  onMedications,
}: {
  profile: Profile
  medications: Medication[]
  onProfile: (profile: Profile) => void
  onMedications: (medications: Medication[]) => void
}) {
  const [draftMedication, setDraftMedication] = useState<Medication>({
    id: '',
    name: '',
    purpose: '',
    frequency: '',
    memo: '',
  })
  const [syncMessage, setSyncMessage] = useState('')

  function addMedication() {
    if (!draftMedication.name.trim()) return
    onMedications([...medications, { ...draftMedication, id: createId('med') }])
    setDraftMedication({ id: '', name: '', purpose: '', frequency: '', memo: '' })
  }

  async function saveProfileToSupabase() {
    setSyncMessage('')
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('로그인 후 Supabase에 저장할 수 있습니다.')
      const userId = authData.user.id
      const profileResult = await supabase.from('user_profiles').upsert({
        user_id: userId,
        gender: profile.gender,
        birth_year: profile.birthYear,
        height_cm: profile.heightCm,
        weight_kg: profile.weightKg,
        pregnancy_status: profile.pregnancyStatus,
        lactation_status: profile.lactationStatus,
        consent_accepted: profile.consentAccepted,
      }, { onConflict: 'user_id' })
      if (profileResult.error) throw profileResult.error

      const conditionRows = [
        ...profile.conditions.map((name) => ({ condition_code: name.toLowerCase(), condition_name: name, severity: 'notice' })),
        ...profile.allergies.map((name) => ({ condition_code: `allergy:${name.toLowerCase()}`, condition_name: name, severity: 'caution' })),
        ...profile.dietaryRestrictions.map((name) => ({ condition_code: `diet:${name.toLowerCase()}`, condition_name: name, severity: 'notice' })),
      ]
      await supabase.from('user_conditions').delete().eq('user_id', userId)
      if (conditionRows.length > 0) {
        const conditionResult = await supabase.from('user_conditions').insert(conditionRows.map((row) => ({ ...row, user_id: userId })))
        if (conditionResult.error) throw conditionResult.error
      }

      await supabase.from('user_medications').delete().eq('user_id', userId)
      if (medications.length > 0) {
        const medicationResult = await supabase.from('user_medications').insert(
          medications.map((medication) => ({
            user_id: userId,
            medication_name: medication.name,
            dosage_text: medication.purpose,
            frequency: medication.frequency,
            memo: medication.memo,
          })),
        )
        if (medicationResult.error) throw medicationResult.error
      }
      setSyncMessage('프로필, 질환/알레르기, 복용 약을 Supabase에 저장했습니다.')
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Supabase 저장에 실패했습니다.')
    }
  }

  return (
    <div className="panel-grid two">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>기본 정보</h2>
            <p>기준 섭취량 비교에 사용됩니다.</p>
          </div>
          <button type="button" className="button primary" onClick={saveProfileToSupabase}>
            저장
          </button>
        </div>
        <div className="form-grid">
          <label>
            성별
            <select value={profile.gender} onChange={(event) => onProfile({ ...profile, gender: event.target.value as Profile['gender'] })}>
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타/미입력</option>
            </select>
          </label>
          <label>
            출생연도
            <input type="number" value={profile.birthYear} onChange={(event) => onProfile({ ...profile, birthYear: Number(event.target.value) })} />
          </label>
          <label>
            키(cm)
            <input type="number" value={profile.heightCm ?? ''} onChange={(event) => onProfile({ ...profile, heightCm: Number(event.target.value) })} />
          </label>
          <label>
            몸무게(kg)
            <input type="number" value={profile.weightKg ?? ''} onChange={(event) => onProfile({ ...profile, weightKg: Number(event.target.value) })} />
          </label>
          <label>
            임신/계획
            <select
              value={profile.pregnancyStatus}
              onChange={(event) => onProfile({ ...profile, pregnancyStatus: event.target.value as Profile['pregnancyStatus'] })}
            >
              <option value="none">해당 없음</option>
              <option value="pregnant">임신 중</option>
              <option value="planning">계획 중</option>
              <option value="unknown">모름</option>
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={profile.lactationStatus}
              onChange={(event) => onProfile({ ...profile, lactationStatus: event.target.checked })}
            />
            수유 중
          </label>
          <label className="full">
            기저질환
            <input
              placeholder="예: kidney, 신장, 당뇨"
              value={profile.conditions.join(', ')}
              onChange={(event) => onProfile({ ...profile, conditions: splitList(event.target.value) })}
            />
          </label>
          <label className="full">
            알레르기
            <input value={profile.allergies.join(', ')} onChange={(event) => onProfile({ ...profile, allergies: splitList(event.target.value) })} />
          </label>
          <label className="full">
            식이 제한
            <input
              placeholder="예: vegan, 저염식"
              value={profile.dietaryRestrictions.join(', ')}
              onChange={(event) => onProfile({ ...profile, dietaryRestrictions: splitList(event.target.value) })}
            />
          </label>
          <label className="check-row full">
            <input
              type="checkbox"
              checked={profile.consentAccepted}
              onChange={(event) => onProfile({ ...profile, consentAccepted: event.target.checked })}
            />
            민감 정보 수집 및 AI 분석 한계 안내를 확인했습니다.
          </label>
        </div>
        {syncMessage && (
          <div className="notice">
            <Check size={16} />
            <span>{syncMessage}</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>복용 약</h2>
            <p>룰 기반 주의 메시지에 사용됩니다.</p>
          </div>
        </div>
        <div className="form-grid medication-form">
          <input placeholder="약명: warfarin, levothyroxine" value={draftMedication.name} onChange={(event) => setDraftMedication({ ...draftMedication, name: event.target.value })} />
          <input placeholder="복용 목적" value={draftMedication.purpose} onChange={(event) => setDraftMedication({ ...draftMedication, purpose: event.target.value })} />
          <input placeholder="복용 빈도" value={draftMedication.frequency} onChange={(event) => setDraftMedication({ ...draftMedication, frequency: event.target.value })} />
          <input placeholder="메모" value={draftMedication.memo} onChange={(event) => setDraftMedication({ ...draftMedication, memo: event.target.value })} />
          <button type="button" className="button primary full" onClick={addMedication}>
            <Plus size={16} />
            약 추가
          </button>
        </div>
        <div className="product-list">
          {medications.length === 0 && <p className="muted">나중에 입력해도 됩니다.</p>}
          {medications.map((medication) => (
            <article className="product-row" key={medication.id}>
              <div>
                <strong>{medication.name}</strong>
                <span>{[medication.purpose, medication.frequency].filter(Boolean).join(' · ') || '메모 없음'}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`${medication.name} 삭제`}
                onClick={() => onMedications(medications.filter((item) => item.id !== medication.id))}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function SupplementWorkspace({
  supplements,
  onSupplements,
  onAnalyze,
}: {
  supplements: SupplementProduct[]
  onSupplements: (supplements: SupplementProduct[]) => void
  onAnalyze: () => void
}) {
  const [productName, setProductName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [dailyServings, setDailyServings] = useState(1)
  const [intakeTime, setIntakeTime] = useState('아침 식후')
  const [imageName, setImageName] = useState('')
  const [labelImagePath, setLabelImagePath] = useState('')
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [syncMessage, setSyncMessage] = useState('')
  const [parsing, setParsing] = useState(false)
  const [draftIngredients, setDraftIngredients] = useState<ParsedIngredient[]>([])
  const canConfirm =
    productName.trim().length > 0 &&
    Number.isFinite(dailyServings) &&
    dailyServings > 0 &&
    draftIngredients.length > 0 &&
    draftIngredients.every((ingredient) =>
      ingredient.standardName.trim().length > 0 &&
      knownNutrientIds.has(ingredient.nutrientId) &&
      ingredient.amount !== null &&
      Number.isFinite(ingredient.amount) &&
      ingredient.amount >= 0 &&
      ingredient.unit !== 'unknown',
    )

  async function parseLabel(file?: File) {
    setParsing(true)
    setParseWarnings([])
    let uploadedPath = ''
    try {
      if (!file) throw new Error('성분표 이미지 파일을 선택해야 AI 파싱을 실행할 수 있습니다.')
      if (!allowedLabelMimeTypes.has(file.type)) throw new Error('JPG, PNG, WEBP 형식의 성분표 이미지만 업로드할 수 있습니다.')

      setImageName(file.name)
      setLabelImagePath('')
      setDraftIngredients([])
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('로그인 후 성분표 이미지를 업로드할 수 있습니다.')
      const path = `${authData.user.id}/${crypto.randomUUID()}-${file.name}`
      const upload = await supabase.storage.from('label-images').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (upload.error) throw upload.error
      uploadedPath = upload.data.path
      setLabelImagePath(upload.data.path)
      const { data, error } = await supabase.functions.invoke('parse-label', {
        body: { image_path: upload.data.path },
      })
      if (error) throw error
      if (data.productName) setProductName(data.productName)
      if (data.dailyServingsRecommended) setDailyServings(data.dailyServingsRecommended)
      setDraftIngredients(data.ingredients)
      setParseWarnings(data.warnings ?? [])
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from('label-images').remove([uploadedPath])
      }
      setLabelImagePath('')
      setDraftIngredients([])
      setParseWarnings([error instanceof Error ? error.message : '이미지 파싱 실패'])
    } finally {
      setParsing(false)
    }
  }

  function updateIngredient(id: string, patch: Partial<ParsedIngredient>) {
    setDraftIngredients((items) =>
      items.map((item) => {
        if (item.id !== id) return item
        const standardName = patch.standardName ?? item.standardName
        const nutrient = findNutrientByName(standardName)
        return {
          ...item,
          ...patch,
          nutrientId: nutrient?.id ?? '',
          standardName: nutrient?.standardName ?? standardName,
          reviewRequired: !nutrient || (patch.confidence ?? item.confidence) < 0.8 || (patch.unit ?? item.unit) === 'unknown',
        }
      }),
    )
  }

  function addManualIngredient() {
    setDraftIngredients([
      ...draftIngredients,
      {
        id: createId('ingredient'),
        rawName: '',
        standardName: '',
        nutrientId: '',
        amount: 0,
        unit: 'mg',
        confidence: 1,
        rawText: 'manual',
        reviewRequired: false,
      },
    ])
  }

  async function confirmSupplement() {
    setSyncMessage('')
    if (!canConfirm) {
      setSyncMessage('제품명, 1일 복용 횟수, 등록 가능한 표준 성분명, 함량, 단위를 모두 확인해야 저장할 수 있습니다.')
      return
    }
    const supplement: SupplementProduct = {
      id: createId('supplement'),
      productName,
      brandName,
      sourceType: labelImagePath ? 'photo' : 'manual',
      dailyServings,
      intakeTime,
      imageName,
      ingredients: draftIngredients,
      confirmed: true,
    }
    let productId = ''
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('Supabase 저장은 로그인 후 사용할 수 있습니다.')
      const productInsert = await supabase
        .from('supplement_products')
        .insert({
          owner_user_id: authData.user.id,
          product_name: productName,
          brand_name: brandName,
          source_type: labelImagePath ? 'photo' : 'manual',
          label_image_path: labelImagePath || null,
        })
        .select('id')
        .single()
      if (productInsert.error) throw productInsert.error

      productId = productInsert.data.id as string
      const ingredientsInsert = await supabase.from('supplement_ingredients').insert(
        draftIngredients.map((ingredient) => ({
          product_id: productId,
          nutrient_id: ingredient.nutrientId,
          raw_name: ingredient.rawName || ingredient.standardName,
          standard_name: ingredient.standardName,
          amount: ingredient.amount,
          unit: ingredient.unit,
          amount_per_daily_serving: ingredient.amount,
          confidence: ingredient.confidence,
          review_required: ingredient.reviewRequired,
        })),
      )
      if (ingredientsInsert.error) throw ingredientsInsert.error

      const userSupplementInsert = await supabase.from('user_supplements').insert({
        user_id: authData.user.id,
        product_id: productId,
        daily_servings: dailyServings,
        intake_time: intakeTime,
        active: true,
      })
      if (userSupplementInsert.error) throw userSupplementInsert.error
      supplement.id = productId
      setSyncMessage('Supabase에 제품, 성분, 복용량을 저장했습니다.')
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Supabase 저장에 실패했습니다.'
      if (productId) {
        const cleanup = await supabase.from('supplement_products').delete().eq('id', productId)
        if (cleanup.error) message = `${message} 제품 임시 데이터 정리도 실패했습니다: ${cleanup.error.message}`
      }
      setSyncMessage(message)
      return
    }
    onSupplements([...supplements, supplement])
    setProductName('')
    setBrandName('')
    setImageName('')
    setLabelImagePath('')
    setDailyServings(1)
    setDraftIngredients([])
  }

  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>영양제 등록</h2>
            <p>사진 업로드 후 추출값을 수정하고 확정하세요.</p>
          </div>
        </div>
        <div className="supplement-layout">
          <div className="upload-zone">
            <FileImage size={28} />
            <strong>{imageName || '성분표 사진 업로드'}</strong>
            <span>{parsing ? 'AI가 성분표를 분석하는 중입니다.' : 'JPG, PNG, WEBP 파일을 선택하면 parse-label 흐름을 실행합니다.'}</span>
            <label className="button ghost">
              <Camera size={16} />
              파일 선택
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) parseLabel(file)
                }}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              제품명
              <input placeholder="제품명을 입력하거나 성분표를 업로드하세요" value={productName} onChange={(event) => setProductName(event.target.value)} />
            </label>
            <label>
              브랜드
              <input placeholder="브랜드명" value={brandName} onChange={(event) => setBrandName(event.target.value)} />
            </label>
            <label>
              1일 복용 횟수
              <input type="number" min="0.25" step="0.25" value={dailyServings} onChange={(event) => setDailyServings(Number(event.target.value))} />
            </label>
            <label>
              복용 시간
              <input value={intakeTime} onChange={(event) => setIntakeTime(event.target.value)} />
            </label>
          </div>
        </div>
        {parseWarnings.length > 0 && (
          <div className="notice warning">
            <AlertTriangle size={16} />
            <span>{parseWarnings.join(' ')}</span>
          </div>
        )}
        {syncMessage && (
          <div className="notice">
            <Check size={16} />
            <span>{syncMessage}</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>성분 검수</h2>
            <p>신뢰도 낮음 또는 단위 불명은 노란색으로 표시됩니다.</p>
          </div>
          <button type="button" className="button ghost" onClick={addManualIngredient}>
            <Plus size={16} />
            수동 성분
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>성분명</th>
                <th>함량</th>
                <th>단위</th>
                <th>신뢰도</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draftIngredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td>
                    <input value={ingredient.standardName} onChange={(event) => updateIngredient(ingredient.id, { standardName: event.target.value })} />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={ingredient.amount ?? ''}
                      onChange={(event) => updateIngredient(ingredient.id, { amount: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    <select value={ingredient.unit} onChange={(event) => updateIngredient(ingredient.id, { unit: event.target.value as Unit })}>
                      {['mg', 'mcg', 'IU', 'g', 'CFU', 'unknown'].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{Math.round(ingredient.confidence * 100)}%</td>
                  <td>
                    <span className={ingredient.reviewRequired ? 'status-pill warning' : 'status-pill success'}>
                      {ingredient.reviewRequired ? '확인 필요' : '확인됨'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="성분 삭제"
                      onClick={() => setDraftIngredients(draftIngredients.filter((item) => item.id !== ingredient.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="action-row">
          <button type="button" className="button primary" onClick={confirmSupplement} disabled={!canConfirm}>
            <Check size={16} />
            검수 완료 및 저장
          </button>
          <button type="button" className="button secondary" onClick={onAnalyze}>
            분석 결과 보기
          </button>
        </div>
      </section>
    </div>
  )
}

function AnalysisResult({ report, syncMessage, onAnalyze }: { report: AnalysisReport | null; syncMessage: string; onAnalyze: () => void }) {
  const [filter, setFilter] = useState<'all' | 'excess' | 'deficient' | 'duplicates' | 'medication'>('all')
  if (!report) {
    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>분석 결과</h2>
            <p>Supabase에 저장된 분석 리포트만 결과로 표시합니다.</p>
          </div>
          <button type="button" className="button primary" onClick={onAnalyze}>
            분석 실행
          </button>
        </div>
        {syncMessage ? (
          <div className="notice warning">
            <AlertTriangle size={16} />
            <span>{syncMessage}</span>
          </div>
        ) : (
          <p className="muted">분석을 실행하면 원격 Edge Function 저장이 성공한 뒤 결과가 표시됩니다.</p>
        )}
      </section>
    )
  }

  const filteredTotals = report.totals.filter((total) => {
    if (filter === 'all') return true
    if (filter === 'duplicates') return total.sourceProducts.length >= 2
    if (filter === 'medication') return false
    return total.status === filter || (filter === 'excess' && total.status === 'caution')
  })

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>분석 결과</h2>
          <p>{new Date(report.createdAt).toLocaleString()} 기준 스냅샷</p>
        </div>
        <button type="button" className="button primary" onClick={onAnalyze}>
          재분석
        </button>
      </div>
      {syncMessage && (
        <div className="notice">
          <Check size={16} />
          <span>{syncMessage}</span>
        </div>
      )}
      <div className="tabs">
        {[
          ['all', '전체'],
          ['excess', '과다/초과'],
          ['deficient', '부족 가능'],
          ['duplicates', '중복'],
          ['medication', '약물 주의'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id as typeof filter)}>
            {label}
          </button>
        ))}
      </div>
      {filter === 'medication' ? (
        <div className="risk-board">
          {report.interactionWarnings.length === 0 && <p className="muted">등록된 약/질환 기준 주의 메시지가 없습니다.</p>}
          {report.interactionWarnings.map((warning) => (
            <article className={`risk-row ${getStatusTone(warning.severity)}`} key={`${warning.nutrientName}-${warning.message}`}>
              <div>
                <strong>{warning.nutrientName}</strong>
                <span>{warning.severity}</span>
              </div>
              <p>{warning.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="analysis-list">
          {filteredTotals.length === 0 && <p className="muted">해당하는 성분이 없습니다.</p>}
          {filteredTotals.map((total) => (
            <article className={`analysis-item ${getStatusTone(total.status)}`} key={total.nutrientId}>
              <div className="analysis-main">
                <strong>{total.standardName}</strong>
                <span>
                  {Math.round(total.totalAmount * 100) / 100}
                  {total.unit}
                </span>
                <span className="status-pill">{statusLabel(total.status)}</span>
              </div>
              <p>{total.message}</p>
              <div className="breakdown">
                {total.sourceProducts.map((source) => (
                  <span key={`${total.nutrientId}-${source.productId}`}>
                    {source.productName}: {Math.round(source.amount * 100) / 100}
                    {source.unit}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="recommendation-panel">
        <h3>복용량 조정 후보</h3>
        {report.recommendations.length === 0 && <p className="muted">현재 등록 정보에서는 별도 조정 후보가 없습니다.</p>}
        {report.recommendations.map((recommendation) => (
          <article key={`${recommendation.title}-${recommendation.detail}`}>
            <strong>{recommendation.title}</strong>
            <p>{recommendation.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function LegalNotice() {
  return (
    <section className="legal-strip">
      <Database size={16} />
      <span>
        개인정보와 성분표 이미지는 최소 수집 원칙, RLS, 비공개 Storage 정책을 전제로 설계했습니다. 결과는 의료 진단이나 처방이 아니며
        복용 변경 전 전문가 상담이 필요합니다.
      </span>
    </section>
  )
}

export default App
