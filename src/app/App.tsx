import { useCallback, useEffect, useState } from 'react'
import '../styles/App.css'
import '../styles/auth.css'
import '../styles/landing.css'
import '../styles/workspace.css'
import { runAnalysis } from '../features/analysis/analysisEngine'
import { createAnalysisReportFromServer } from '../features/analysis/serverAnalysis'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../lib/supabaseClient'
import type { AnalysisReport, Medication, Profile, SupplementProduct } from '../types'
import { routes, useCurrentPath } from './routes'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { SidebarLayout } from '../components/layout/SidebarLayout'
import { Dashboard, ProfileAndMedication, SupplementWorkspace, AnalysisResult } from '../components/workspace/WorkspacePage'
import { SchedulePage } from '../pages/SchedulePage'
import { ChatPage } from '../pages/ChatPage'

const defaultProfile: Profile = {
  gender: 'female', birthYear: 1998, heightCm: 165, weightKg: 55,
  pregnancyStatus: 'none', lactationStatus: false,
  conditions: [], allergies: [], dietaryRestrictions: [],
  consentAccepted: true,
}

function App() {
  const { currentPath, navigateTo } = useCurrentPath()
  const [profile, setProfile] = useState<Profile>(defaultProfile)
  const [medications, setMedications] = useState<Medication[]>([])
  const [supplements, setSupplements] = useState<SupplementProduct[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analysisSyncMessage, setAnalysisSyncMessage] = useState('')

  const openProfileAfterSignIn = useCallback(() => navigateTo(routes.profile), [navigateTo])
  const { sessionEmail, setSessionEmail, authNotice, setAuthNotice, isAuthInitialized, profileIsSetup } = useAuth({
    defaultProfile,
    onProfile: setProfile,
    onMedications: setMedications,
    onSupplements: setSupplements,
    onReport: setReport,
    onSignedIn: openProfileAfterSignIn,
  })

  const previewReport = runAnalysis(profile, medications, supplements)
  const confirmedCount = supplements.filter((supplement) => supplement.confirmed).length
  const needsReview = supplements.flatMap((supplement) => supplement.ingredients).filter((ingredient) => ingredient.reviewRequired).length

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
      if (error) throw error
      const serverReport = createAnalysisReportFromServer(data)
      setReport(serverReport)
      setAnalysisSyncMessage(`분석 결과 저장 완료: ${serverReport.id}`)
    } catch (error) {
      setAnalysisSyncMessage(error instanceof Error ? error.message : '서버 분석 저장에 실패했습니다.')
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
          />
        )}
        {currentPath === routes.profile && (
          <ProfileAndMedication profile={profile} medications={medications} onProfile={setProfile} onMedications={setMedications} />
        )}
        {currentPath === routes.supplements && (
          <SupplementWorkspace supplements={supplements} onSupplements={setSupplements} onAnalyze={handleRunAnalysis} />
        )}
        {currentPath === routes.analysis && (
          <AnalysisResult report={report} syncMessage={analysisSyncMessage} onAnalyze={handleRunAnalysis} />
        )}
        {currentPath === routes.schedule && (
          <SchedulePage supplements={supplements} />
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
      />
    </main>
  )
}

export default App

