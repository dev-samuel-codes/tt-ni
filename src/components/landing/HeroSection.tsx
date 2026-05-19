import { Camera, ChevronRight, ShieldCheck, User, HeartPulse } from 'lucide-react'
import { BrandMark, MiniFeature } from '../workspace/Shared'

export function LandingHeader({ sessionEmail, onLogin, onDashboard }: { sessionEmail: string | null; onLogin: () => void; onDashboard: () => void }) {
  return (
    <header className="landing-header">
      <a className="logo-lockup" href="#top" aria-label="tt-ni 홈">
        <img src="/tt-ni-logo.svg" alt="+-ni" />
      </a>
      <nav className="landing-nav" aria-label="서비스 소개">
        <a href="#features">서비스 소개</a>
        <a href="#preview">성분 분석</a>
        <a href="#steps">복용 관리</a>
        <a href="#cta">추천</a>
      </nav>
      <div className="landing-actions">
        {sessionEmail ? (
          <button type="button" className="button primary mint" onClick={onDashboard}>대시보드로 가기</button>
        ) : (
          <button type="button" className="button primary mint" onClick={onLogin}>로그인 / 회원가입</button>
        )}
      </div>
    </header>
  )
}

export function HeroMockup({
  confirmedCount,
  needsReview,
  riskCount,
}: {
  confirmedCount: number
  needsReview: number
  riskCount: number
}) {
  const totalCount = Math.max(confirmedCount + needsReview + riskCount, 27)
  return (
    <div className="hero-visual" aria-label="tt-ni 분석 대시보드 미리보기">
      <div className="soft-orbit" />
      <div className="mockup-float-layer">
        <div className="dashboard-float-layer">
          <div className="dashboard-frame">
            <aside className="mock-sidebar">
              <BrandMark />
              {['대시보드', '성분 분석', '복용 관리', '추천', '내 정보'].map((item, index) => (
                <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
              ))}
            </aside>
            <div className="mock-content">
              <div className="mock-top">
                <div>
                  <h2>안녕하세요, 홍길동님</h2>
                  <p>오늘의 영양제 섭취 상태를 확인해보세요.</p>
                </div>
                <span className="avatar-dot" />
              </div>
              <div className="mock-cards">
                <article>
                  <strong>오늘의 성분 요약</strong>
                  <div className="score-row">
                    <span>
                      <b>{totalCount}</b>종
                    </span>
                    <span className="ring">92%</span>
                  </div>
                </article>
                <article>
                  <strong>주의가 필요한 항목</strong>
                  <ul>
                    <li><i className="danger-dot" />과다 <b>{Math.max(riskCount, 2)}종</b></li>
                    <li><i className="warn-dot" />부족 <b>{Math.max(needsReview, 3)}종</b></li>
                    <li><i className="info-dot" />중복 <b>4종</b></li>
                  </ul>
                </article>
              </div>
              <article className="mock-chart">
                <strong>주요 영양소 섭취 현황</strong>
                <div className="bar-chart">
                  {[64, 38, 54, 77, 48, 90, 60, 82].map((height, index) => (
                    <span style={{ '--bar': `${height}%` } as React.CSSProperties} key={index} />
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
        <div className="score-float-layer">
          <article className="floating-score">
            <span>비타민 D</span>
            <strong>65%</strong>
            <p>권장 섭취량 대비</p>
            <i />
          </article>
        </div>
      </div>
    </div>
  )
}

export function HeroSection({
  sessionEmail,
  confirmedCount,
  needsReview,
  riskCount,
  onLogin,
  onDashboard,
}: {
  sessionEmail: string | null
  confirmedCount: number
  needsReview: number
  riskCount: number
  onLogin: () => void
  onDashboard: () => void
}) {
  return (
    <section id="top" className="hero-section">
      <div className="hero-copy">
        <span className="hero-pill">AI 영양제 분석 & 복용 관리 서비스</span>
        <h1>
          성분표를 찍으면,
          <br />
          내 영양제 상태를 <em>한눈에</em>
        </h1>
        <p>사진 한 장으로 성분을 AI가 인식하고, 중복 섭취와 부족·과다 영양소를 분석해 더 건강한 복용 관리를 도와드려요.</p>
        <div className="hero-buttons">
          <button type="button" className="button primary large" onClick={sessionEmail ? onDashboard : onLogin}>
            시작하기
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="hero-benefits" aria-label="핵심 기능">
          <MiniFeature icon={<Camera size={19} />} title="AI 성분 인식" detail="정확한 성분 추출" />
          <MiniFeature icon={<ShieldCheck size={19} />} title="중복 섭취 체크" detail="같은 성분 자동 탐지" />
          <MiniFeature icon={<User size={19} />} title="부족/과다 분석" detail="섭취 상태 한눈에" />
          <MiniFeature icon={<HeartPulse size={19} />} title="복용 가이드" detail="맞춤 관리 추천" />
        </div>
      </div>
      <HeroMockup confirmedCount={confirmedCount} needsReview={needsReview} riskCount={riskCount} />
    </section>
  )
}
