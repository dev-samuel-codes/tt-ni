import { Camera, Sparkles, Activity, HeartPulse, Search, Calendar, MessageCircle, ClipboardList, User } from 'lucide-react'

export function FeatureReasonSection() {
  const items = [
    ['영양제 라벨 AI 인식', '영양제 라벨을 찍으면 Vision AI가 성분명·함량·단위를 자동으로 추출합니다.', Camera],
    ['웹 검색 기반 조회', '제품명만 입력하면 웹 검색으로 성분 정보를 수집하고 구조화합니다.', Search],
    ['KDRIs 기반 분석', '성별·연령·임신 여부에 맞춘 개인 맞춤형 섭취 상태를 분석합니다.', Activity],
    ['약물 상호작용 감지', '처방약과 영양제 성분 간의 알려진 상호작용을 자동으로 경고합니다.', Sparkles],
    ['시간약리학 스케줄러', '공복/식후/저녁 등 최적의 복용 시간대를 과학적으로 배치합니다.', Calendar],
    ['맞춤형 AI 상담', '내 프로필과 영양제 데이터를 바탕으로 개인화된 상담을 받을 수 있어요.', MessageCircle],
  ] as const

  return (
    <section id="features" className="feature-section">
      <h2>++-ni가 특별한 이유</h2>
      <div className="reason-grid">
        {items.map(([title, detail, Icon]) => (
          <article className="reason-card" key={title}>
            <span><Icon size={30} /></span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function HowItWorksSection() {
  const steps = [
    ['프로필 등록', '성별, 연령, 건강 상태, 복용 약 정보를 입력합니다.', User],
    ['영양제 등록', '사진 촬영, 제품 검색, 수동 입력 중 편한 방법을 선택합니다.', Camera],
    ['성분 분석 확인', 'KDRIs 기반으로 과다·부족·중복 상태를 한눈에 확인합니다.', ClipboardList],
    ['최적 스케줄 제안', '시간약리학 원리에 따라 복용 타임라인이 자동 생성됩니다.', Calendar],
    ['AI 상담 활용', '궁금한 점을 AI에게 물어보고 맞춤 답변을 받으세요.', HeartPulse],
  ] as const

  return (
    <section id="steps" className="steps-section">
      <h2>이용 방법</h2>
      <div className="steps-row">
        {steps.map(([title, detail, Icon], index) => (
          <article className="step-card" key={title}>
            <b>{index + 1}</b>
            <span><Icon size={26} /></span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
