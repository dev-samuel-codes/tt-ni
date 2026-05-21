import { useEffect, useMemo, useState } from 'react'
import '../styles/App.css'
import '../styles/auth.css'
import '../styles/landing.css'
import '../styles/workspace.css'
import '../styles/legal.css'
import { runAnalysis } from '../features/analysis/analysisEngine'
import { createAnalysisReportFromServer } from '../features/analysis/serverAnalysis'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../lib/supabaseClient'
import type { AnalysisReport, Medication, Profile, SupplementProduct } from '../types'
import { routes, useCurrentPath } from './routes'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage'
import { TermsOfServicePage } from '../pages/TermsOfServicePage'
import { SidebarLayout } from '../components/layout/SidebarLayout'
import { Dashboard, ProfileAndMedication, SupplementWorkspace, AnalysisResult } from '../components/workspace/WorkspacePage'
import { SchedulePage } from '../pages/SchedulePage'
import { ChatPage } from '../pages/ChatPage'

const DEFAULT_PROFILE: Profile = {
  gender: 'female', birthYear: 1998, heightCm: 165, weightKg: 55,
  pregnancyStatus: 'none', lactationStatus: false,
  conditions: [], allergies: [], dietaryRestrictions: [],
  consentAccepted: false,
}

/**
 * 앱 루트 컴포넌트
 *
 * 라우팅 구조:
 * - /workspace/* → SidebarLayout 내에서 Dashboard, Profile, Supplements, Analysis, Schedule, Chat
 * - /login → LoginPage
 * - /privacy, /terms → 각각 PrivacyPolicyPage, TermsOfServicePage
 * - / (기본) → LandingPage
 */
function App() {
  const { currentPath, navigateTo } = useCurrentPath()
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [medications, setMedications] = useState<Medication[]>([])
  const [supplements, setSupplements] = useState<SupplementProduct[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analysisSyncMessage, setAnalysisSyncMessage] = useState('')

  const { sessionEmail, setSessionEmail, authNotice, setAuthNotice, isAuthInitialized, profileIsSetup } = useAuth({
    defaultProfile: DEFAULT_PROFILE,
    onProfile: setProfile,
    onMedications: setMedications,
    onSupplements: setSupplements,
    onReport: setReport,
  })

  const previewReport = useMemo(() => runAnalysis(profile, medications, supplements), [profile, medications, supplements])
  const confirmedCount = useMemo(() => supplements.filter((s) => s.confirmed).length, [supplements])
  const needsReview = useMemo(() => supplements.flatMap((s) => s.ingredients).filter((i) => i.reviewRequired).length, [supplements])

  /** 비로그인 상태에서 워크스페이스 접근 시 로그인 페이지로 리다이렉트 */
  useEffect(() => {
    if (!isAuthInitialized) return
    if (currentPath.startsWith(routes.workspace)) {
      if (!sessionEmail) {
        navigateTo(routes.login)
      }
    }
  }, [currentPath, sessionEmail, isAuthInitialized, navigateTo])

  async function handleRunAnalysis() {
    setAnalysisSyncMessage('')
    setReport(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('로그인 후 분석 리포트를 서버에 저장할 수 있습니다.')
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { profile, medications, supplements },
      })
      if (error) {
        const errMsg = typeof error === 'string' ? error : (error as Error).message || '서버 분석 중 오류가 발생했습니다.'
        throw new Error(errMsg)
      }
      const serverReport = createAnalysisReportFromServer(data)
      setReport(serverReport)
      if (serverReport.totals.length > 0) {
        setAnalysisSyncMessage('분석 결과가 저장되었습니다.')
      } else {
        setAnalysisSyncMessage('분석 결과가 저장되었지만 분석할 성분이 없습니다. 영양제의 성분 정보를 확인해주세요.')
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '서버 분석 저장에 실패했습니다.'
      setAnalysisSyncMessage(errMsg)
      if (previewReport.totals.length > 0) {
        if (report) return
        setReport(previewReport)
        if (errMsg.includes('분석할 성분이 없습니다')) {
          setAnalysisSyncMessage('분석할 영양제가 없습니다. 영양제를 먼저 등록해주세요.')
        } else {
          setAnalysisSyncMessage(errMsg + ' (로컬 분석 결과를 표시합니다.)')
        }
      } else {
        setReport(null)
        setAnalysisSyncMessage(errMsg + ' 분석할 영양제가 없습니다. 영양제를 먼저 등록해주세요.')
      }
    }
    navigateTo(routes.analysis)
  }

  // Workspace routing
  if (currentPath.startsWith(routes.workspace)) {
    return (
      <SidebarLayout
        currentPath={currentPath}
        navigateTo={navigateTo}
        sessionEmail={sessionEmail}
        onSessionEmail={setSessionEmail}
        onBackHome={() => navigateTo(routes.home)}
      >
        {authNotice && (
          <section className={`auth-callback-notice ${authNotice.tone}`} role="status" style={{ marginBottom: '24px' }}>
            <span>{authNotice.message}</span>
            <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">닫기</button>
          </section>
        )}

        {currentPath === routes.workspace && (
          <Dashboard
            report={previewReport}
            supplements={supplements}
            onSupplements={setSupplements}
            confirmedCount={confirmedCount}
            needsReview={needsReview}
            onStart={() => navigateTo(routes.supplements)}
            onAnalyze={handleRunAnalysis}
            onSchedule={() => navigateTo(routes.schedule)}
            onChat={() => navigateTo(routes.chat)}
            onProfile={() => navigateTo(routes.profile)}
            profileIsSetup={profileIsSetup}
            profile={profile}
            medications={medications}
          />
        )}
        {currentPath === routes.profile && (
          <ProfileAndMedication profile={profile} medications={medications} onProfile={setProfile} onMedications={setMedications} />
        )}
        {currentPath === routes.supplements && (
          <SupplementWorkspace supplements={supplements} onSupplements={setSupplements} onAnalyze={handleRunAnalysis} sessionEmail={sessionEmail ?? ''} />
        )}
        {currentPath === routes.analysis && (
          <AnalysisResult
            report={report || previewReport}
            syncMessage={analysisSyncMessage}
            onAnalyze={handleRunAnalysis}
            isLocalFallback={!report && previewReport.totals.length > 0}
            sessionEmail={sessionEmail ?? undefined}
            onLogin={() => navigateTo(routes.login)}
          />
        )}
        {currentPath === routes.schedule && (
          <SchedulePage supplements={supplements} profile={profile} medications={medications} />
        )}
        {currentPath === routes.chat && (
          <ChatPage />
        )}
      </SidebarLayout>
    )
  }

  if (currentPath === routes.login) {
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
          onBackHome={() => navigateTo(routes.home)}
          onOpenWorkspace={() => navigateTo(routes.profile)}
        />
      </main>
    )
  }

  if (currentPath === routes.privacy) {
    return (
      <main className="landing-shell">
        <PrivacyPolicyPage onBack={() => navigateTo(routes.home)} />
      </main>
    )
  }

  if (currentPath === routes.terms) {
    return (
      <main className="landing-shell">
        <TermsOfServicePage onBack={() => navigateTo(routes.home)} />
      </main>
    )
  }

  return (
    <main className="landing-shell">
      {authNotice && (
        <section className={`auth-callback-notice ${authNotice.tone}`} role="status">
          <span>{authNotice.message}</span>
          <button type="button" onClick={() => setAuthNotice(null)} aria-label="로그인 알림 닫기">닫기</button>
        </section>
      )}
      <LandingPage
        sessionEmail={sessionEmail}
        confirmedCount={confirmedCount}
        needsReview={needsReview}
        previewReport={previewReport}
        onLogin={() => navigateTo(routes.login)}
        onOpenResults={() => navigateTo(routes.analysis)}
        onDashboard={() => navigateTo(routes.workspace)}
        onNavigate={navigateTo}
      />
    </main>
  )
}

export default App
