import { useCallback, useState } from 'react'
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
import { WorkspacePage } from '../pages/WorkspacePage'

type WorkspaceTab = 'overview' | 'profile' | 'supplements' | 'analysis'

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analysisSyncMessage, setAnalysisSyncMessage] = useState('')

  const openProfileAfterSignIn = useCallback(() => setActiveTab('profile'), [])
  const { sessionEmail, setSessionEmail, authNotice, setAuthNotice } = useAuth({
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

  function goToWorkspace(tab: WorkspaceTab) {
    setActiveTab(tab)
    navigateTo(routes.workspace)
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

  if (currentPath === routes.workspace) {
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
          onBackHome={() => navigateTo(routes.home)} activeTab={activeTab} onTabChange={setActiveTab}
          confirmedCount={confirmedCount} needsReview={needsReview} previewReport={previewReport}
          profile={profile} medications={medications} supplements={supplements}
          report={report} analysisSyncMessage={analysisSyncMessage}
          onProfile={setProfile} onMedications={setMedications}
          onSupplements={setSupplements} onAnalyze={handleRunAnalysis}
        />
      </main>
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
          onOpenWorkspace={() => { setActiveTab('profile'); navigateTo(routes.workspace) }}
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
        confirmedCount={confirmedCount}
        needsReview={needsReview}
        previewReport={previewReport}
        onLogin={() => navigateTo(routes.login)}
        onStart={() => goToWorkspace('supplements')}
        onUpload={() => goToWorkspace('supplements')}
        onOpenResults={() => goToWorkspace('analysis')}
      />
    </main>
  )
}

export default App
