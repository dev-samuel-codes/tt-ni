import { useEffect, useState } from 'react'

/** 애플리케이션 라우트 경로 상수 */
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

/** 현재 브라우저 URL의 pathname을 반환합니다. */
export function getCurrentPath(): string {
  return window.location.pathname
}

/** HTML5 History API로 페이지 이동(새로고침 없음)을 수행하고 상단으로 스크롤합니다. */
export function pushRoute(path: AppRoute | string): void {
  window.history.pushState({}, '', path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/**
 * 현재 경로 상태와 navigateTo 함수를 제공하는 훅
 * popstate 이벤트(브라우저 뒤로가기/앞으로가기)를 감지하여 상태를 동기화합니다.
 */
export function useCurrentPath() {
  const [currentPath, setCurrentPath] = useState(getCurrentPath)

  useEffect(() => {
    const syncPath = () => setCurrentPath(getCurrentPath())
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  function navigateTo(path: AppRoute | string) {
    pushRoute(path)
    setCurrentPath(path)
  }

  return { currentPath, navigateTo }
}
