import React, { useState } from 'react'
import { Activity, ClipboardList, Pill, User, MessageCircle, Calendar, Menu, X, ArrowLeft } from 'lucide-react'
import { AuthPanel } from '../auth/AuthPanel'
import { routes } from '../../app/routes'
import type { AppRoute } from '../../app/routes'

/** 사이드바 네비게이션 항목 정의 */
interface SidebarItem {
  id: string
  label: string
  path: AppRoute | string
  icon: React.ComponentType<{ size?: number }>
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'overview', label: '대시보드', path: routes.workspace, icon: Activity },
  { id: 'supplements', label: '내 영양제', path: routes.supplements, icon: Pill },
  { id: 'analysis', label: '분석 리포트', path: routes.analysis, icon: ClipboardList },
  { id: 'schedule', label: '복용 스케줄', path: routes.schedule, icon: Calendar },
  { id: 'chat', label: 'AI 상담', path: routes.chat, icon: MessageCircle },
  { id: 'profile', label: '내 정보', path: routes.profile, icon: User },
]

/**
 * 워크스페이스 레이아웃: 사이드바 + 메인 콘텐츠 + 모바일 햄버거 메뉴
 * 데스크탑에서는 고정 사이드바, 모바일에서는 오버레이 방식으로 전환됩니다.
 */
export function SidebarLayout({
  currentPath,
  navigateTo,
  sessionEmail,
  onSessionEmail,
  onBackHome,
  children,
}: {
  currentPath: string
  navigateTo: (path: AppRoute | string) => void
  sessionEmail: string | null
  onSessionEmail: (email: string | null) => void
  onBackHome: () => void
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleNavClick = (path: AppRoute | string) => {
    navigateTo(path)
    setMobileMenuOpen(false)
  }

  return (
    <div className="workspace-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button type="button" className="icon-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <a className="logo-lockup" href="/" onClick={(e) => { e.preventDefault(); onBackHome() }}>
          <img src="/tt-ni-logo.svg" alt="tt-ni" />
        </a>
        <div className="mobile-header-right">
          {sessionEmail ? (
            <AuthPanel sessionEmail={sessionEmail} onSessionEmail={onSessionEmail} variant="dock" />
          ) : (
            <button type="button" className="button primary mint small" onClick={() => handleNavClick(routes.profile)}>
              로그인
            </button>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a className="logo-lockup" href="/" onClick={(e) => { e.preventDefault(); onBackHome() }}>
            <img src="/tt-ni-logo.svg" alt="tt-ni" />
          </a>
        </div>
        
        <nav className="sidebar-nav">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentPath === item.path
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.path)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <AuthPanel sessionEmail={sessionEmail} onSessionEmail={onSessionEmail} variant="dock" />
          <button type="button" className="sidebar-nav-item mt-auto" onClick={onBackHome}>
            <ArrowLeft size={20} />
            <span>홈으로</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="main-content-inner">
          {children}
        </div>
        <footer className="workspace-footer">
          <p>
            tt-ni의 분석은 2025년 KDRIs를 기준으로 계산되며, <strong>의학적 진단이나 처방을 대신하지 않습니다.</strong> 
            개인차가 있으므로 의심 증상 발생 시 즉시 복용을 중단하고 전문의와 상담하세요.
          </p>
        </footer>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}
