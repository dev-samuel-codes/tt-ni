import { useCallback, useEffect, useState } from 'react'

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

function getCurrentPath(): string {
  return window.location.pathname
}

function pushRoute(path: AppRoute | string): void {
  window.history.pushState({}, '', path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

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
