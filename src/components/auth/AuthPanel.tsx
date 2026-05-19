import { useState, useEffect } from 'react'
import { Loader2, Lock, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { SocialProvider, SocialProviderStatus } from '../../features/auth/authTypes'
import { socialProviderLabels } from '../../features/auth/authTypes'
import { loadSocialProviderStatus } from '../../features/auth/providerStatus'

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
  const [socialProviderStatus, setSocialProviderStatus] = useState<SocialProviderStatus>({
    google: null,
    kakao: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    async function loadProviderStatus() {
      try {
        setSocialProviderStatus(await loadSocialProviderStatus(controller.signal))
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
      setMessage(`${socialProviderLabels[provider]} 로그인은 관리자 설정이 먼저 필요합니다.`)
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
        <span>계정</span>
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
        <small className="auth-provider-warning">관리자 설정에서 Google/Kakao 로그인을 활성화하면 소셜 로그인이 바로 동작합니다.</small>
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
