import { useCallback, useEffect, useState } from 'react'

/** SPA 라우트 경로 상수. window.history.pushState 기반의 자체 라우팅에 사용됩니다. */
export const routes = {
  home: '/',
  login: '/login',
  workspace: '/workspace',
  supplements: '/workspace/supplements',
  analysis: '/workspace/analysis',
  schedule: '/workspace/schedule',
  chat: '/workspace/chat',
  profile: '/workspace/profile',
  privacy: '/privacy',
  terms: '/terms',
} as const

export type AppRoute = typeof routes[keyof typeof routes]

/** 현재 브라우저 URL 경로를 반환합니다. */
function getCurrentPath(): string {
  return window.location.pathname
}

/**
 * 브라우저 히스토리에 새 엔트리를 추가하고 페이지 상단으로 스크롤합니다.
 * React Router 없이 pushState로 SPA 라우팅을 구현합니다.
 */
function pushRoute(path: AppRoute | string): void {
  window.history.pushState({}, '', path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/**
 * 현재 경로 상태와 navigate 함수를 제공하는 커스텀 훅.
 * popstate 이벤트(브라우저 뒤로가기/앞으로가기)를 감지하여 경로를 동기화합니다.
 */
export function useCurrentPath() {
  const [currentPath, setCurrentPath] = useState(getCurrentPath)

  useEffect(() => {
    const syncPath = () => setCurrentPath(getCurrentPath())
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  const navigateTo = useCallback((path: AppRoute | string) => {
    pushRoute(path)
    setCurrentPath(path)
  }, [])

  return { currentPath, navigateTo }
}
