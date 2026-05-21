import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { firebaseConfigError, signInWithEmail, signInWithGoogle, signInWithKakao, signOutCurrentUser, signUpWithEmail } from '../../lib/firebase'
import type { SocialProvider } from '../../features/auth/authTypes'
import { socialProviderLabels } from '../../features/auth/authTypes'

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
      onSessionEmail(result.user.email ?? null)
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

  if (sessionEmail) {
    return (
      <div className={variant === 'page' ? 'auth-card compact auth-card-session page-auth-card' : 'auth-card compact auth-card-session'}>
        <button type="button" className="auth-signout-button" aria-label="로그아웃하기" onClick={signOut}>
          로그아웃하기
        </button>
      </div>
    )
  }

  return (
    <form className={variant === 'page' ? 'auth-card page-auth-card' : 'auth-card'} onSubmit={(event) => event.preventDefault()}>
      <div className="auth-state">
        <Lock size={16} />
        <span>계정</span>
      </div>
      <div className="social-auth-actions" aria-label="소셜 로그인">
        <button
          type="button"
          className="social-auth-button google"
          onClick={() => signInWithSocial('google')}
          disabled={authDisabled || loading || oauthLoading !== null}
        >
          {oauthLoading === 'google' ? <Loader2 size={16} className="spin" /> : <span>G</span>}
          구글로 로그인
        </button>
        <button
          type="button"
          className="social-auth-button kakao"
          onClick={() => signInWithSocial('kakao')}
          disabled={authDisabled || loading || oauthLoading !== null}
        >
          {oauthLoading === 'kakao' ? <Loader2 size={16} className="spin" /> : <span>K</span>}
          카카오로 로그인
        </button>
      </div>
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
