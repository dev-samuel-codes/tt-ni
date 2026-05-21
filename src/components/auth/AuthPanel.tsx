import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { firebaseConfigError, signInWithEmail, signInWithGoogle, signInWithKakao, signOutCurrentUser, signUpWithEmail, socialAuthEnabled } from '../../lib/firebase'
import type { SocialProvider } from '../../features/auth/authTypes'
import { socialProviderLabels } from '../../features/auth/authTypes'

/**
 * 인증 패널 컴포넌트.
 * 로그인 상태에 따라 로그인 폼 또는 로그아웃 버튼을 표시합니다.
 * variant="page" → 페이지 중앙 로그인, variant="dock" → 사이드바/헤더 내 로그인
 */
export function AuthPanel({
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
  const authDisabled = firebaseConfigError !== null
  const enabledSocialProviders = (['google', 'kakao'] as SocialProvider[]).filter((provider) => socialAuthEnabled[provider])
  const hasSocialAuth = enabledSocialProviders.length > 0

  /** 이메일 로그인 또는 회원가입 처리 */
  async function signIn(mode: 'login' | 'signup') {
    if (authDisabled) {
      setMessage(firebaseConfigError ?? 'Firebase 인증 설정을 확인할 수 없습니다.')
      return
    }
    if (!email) return
    setLoading(true)
    setMessage('')
    try {
      const result = mode === 'signup'
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password)
      onSessionEmail(result.user.email ?? email)
      setMessage(mode === 'signup' ? '가입 요청이 처리됐습니다.' : '로그인됐습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '인증 중 문제가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /** 소셜 로그인 (Google / Kakao) */
  async function signInWithSocial(provider: SocialProvider) {
    if (authDisabled) {
      setMessage(firebaseConfigError ?? 'Firebase 인증 설정을 확인할 수 없습니다.')
      return
    }
    setOauthLoading(provider)
    setMessage('')
    try {
      const result = provider === 'google'
        ? await signInWithGoogle()
        : await signInWithKakao()
      if (result) {
        onSessionEmail(result.user.email ?? null)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${socialProviderLabels[provider]} 로그인 시작에 실패했습니다.`)
      setOauthLoading(null)
    }
  }

  async function signOut() {
    try {
      await signOutCurrentUser()
      onSessionEmail(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그아웃 중 문제가 발생했습니다.')
    }
  }

  // 로그인 상태 → 로그아웃 버튼만 표시
  if (sessionEmail) {
    return (
      <div className={variant === 'page' ? 'auth-card compact auth-card-session page-auth-card' : 'auth-card compact auth-card-session'}>
        <button type="button" className="auth-signout-button" aria-label="로그아웃하기" onClick={signOut}>
          로그아웃하기
        </button>
      </div>
    )
  }

  // 비로그인 상태 → 로그인 폼 표시
  return (
    <form className={variant === 'page' ? 'auth-card page-auth-card' : 'auth-card'} onSubmit={(event) => event.preventDefault()}>
      <div className="auth-state">
        <Lock size={16} />
        <span>계정</span>
      </div>
      {hasSocialAuth && (
        <>
          <div className="social-auth-actions" aria-label="소셜 로그인">
            {socialAuthEnabled.google && (
              <button
                type="button"
                className="social-auth-button google"
                onClick={() => signInWithSocial('google')}
                disabled={authDisabled || loading || oauthLoading !== null}
              >
                {oauthLoading === 'google' ? <Loader2 size={16} className="spin" /> : <span>G</span>}
                구글로 로그인
              </button>
            )}
            {socialAuthEnabled.kakao && (
              <button
                type="button"
                className="social-auth-button kakao"
                onClick={() => signInWithSocial('kakao')}
                disabled={authDisabled || loading || oauthLoading !== null}
              >
                {oauthLoading === 'kakao' ? <Loader2 size={16} className="spin" /> : <span>K</span>}
                카카오로 로그인
              </button>
            )}
          </div>
          <div className="auth-divider"><span>또는 이메일로 계속</span></div>
        </>
      )}
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
        <button type="button" className="button ghost" onClick={() => signIn('signup')} disabled={authDisabled || loading}>
          가입
        </button>
        <button type="button" className="button primary" onClick={() => signIn('login')} disabled={authDisabled || loading}>
          {loading ? <Loader2 size={16} className="spin" /> : '로그인'}
        </button>
      </div>
      {authDisabled && <small>{firebaseConfigError}</small>}
      {message && <small>{message}</small>}
    </form>
  )
}
