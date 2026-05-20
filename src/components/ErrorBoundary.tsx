import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '40px', background: '#f8faf8', fontFamily: 'sans-serif',
        }}>
          <div style={{ maxWidth: '480px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', color: '#1a2c28', marginBottom: '16px' }}>
              문제가 발생했습니다
            </h1>
            <p style={{ fontSize: '15px', color: '#697771', lineHeight: 1.6, marginBottom: '24px' }}>
              페이지를 표시하는 중 예상치 못한 오류가 발생했습니다.
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null })
                window.location.reload()
              }}
              style={{
                padding: '12px 24px', borderRadius: '8px', border: 'none',
                background: '#18ae90', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              페이지 새로고침
            </button>
            <details style={{ marginTop: '24px', textAlign: 'left' }}>
              <summary style={{ fontSize: '13px', color: '#8a9a95', cursor: 'pointer' }}>
                오류 상세 정보
              </summary>
              <pre style={{
                marginTop: '8px', padding: '12px', background: '#fff', border: '1px solid #e1e8e5',
                borderRadius: '8px', fontSize: '12px', color: '#52605b', overflow: 'auto', maxHeight: '200px',
              }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
