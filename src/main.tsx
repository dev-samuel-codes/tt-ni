import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

/**
 * React 앱 진입점.
 * StrictMode로 감싸 개발 중 잠재적 문제를 조기에 발견하고,
 * ErrorBoundary로 렌더링 오류를 포착하여 앱 크래시를 방지합니다.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
