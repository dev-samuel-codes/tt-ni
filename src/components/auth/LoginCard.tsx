import { ChevronRight, Lock } from 'lucide-react'
import { AuthPanel } from './AuthPanel'
import { socialAuthEnabled } from '../../lib/firebase'

export function LoginCard({
  sessionEmail,
  onSessionEmail,
  onOpenWorkspace,
}: {
  sessionEmail: string | null
  onSessionEmail: (email: string | null) => void
  onOpenWorkspace: () => void
}) {
  const loginMethodLabel = socialAuthEnabled.google || socialAuthEnabled.kakao
    ? '소셜 계정 또는 이메일로 계속하세요.'
    : '이메일로 계속하세요.'

  return (
    <div className="login-panel">
      <div className="login-panel-heading">
        <Lock size={19} />
        <div>
          <h2>{sessionEmail ? '로그인 상태' : 'tt-ni 로그인'}</h2>
          <p>{sessionEmail ? '현재 계정으로 분석 작업공간을 열 수 있습니다.' : loginMethodLabel}</p>
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
  )
}
