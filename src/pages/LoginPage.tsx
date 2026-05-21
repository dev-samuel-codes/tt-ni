import { ArrowLeft, Database, ShieldCheck, Sparkles } from 'lucide-react'
import { LoginCard } from '../components/auth/LoginCard'

/**
 * 로그인 페이지.
 * 왼쪽에는 로그인 후 가능한 기능 소개, 오른쪽에는 LoginCard(실제 로그인 폼)를 표시합니다.
 */
export function LoginPage({
  sessionEmail, onSessionEmail, onBackHome, onOpenWorkspace,
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
                <span>리포트와 입력 정보를 안전하게 보관</span>
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

        <LoginCard sessionEmail={sessionEmail} onSessionEmail={onSessionEmail} onOpenWorkspace={onOpenWorkspace} />
      </div>
    </section>
  )
}
