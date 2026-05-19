import { Camera, Sparkles, Activity, HeartPulse, ClipboardList, User } from 'lucide-react'

export function FeatureReasonSection() {
  const items = [
    ['성분표 사진 업로드', '영양제 라벨을 찍으면 AI가 글자를 인식해 성분 정보를 추출합니다.', Camera],
    ['AI 성분 자동 분석', '복잡한 성분명을 표준화하고 함량, 단위까지 정리합니다.', Sparkles],
    ['섭취 상태 분석', '중복 섭취, 과다, 부족을 판단해 영양소별 섭취 상태를 보여줍니다.', Activity],
    ['맞춤 추천 가이드', '지금 내게 필요한 영양소와 복용 팁을 개인 맞춤형으로 추천합니다.', HeartPulse],
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
    ['사진 업로드', '영양제 성분표가 보이게 선명하게 촬영해 업로드합니다.', Camera],
    ['성분 자동 인식', 'AI가 성분명과 함량을 인식해 데이터로 변환합니다.', ClipboardList],
    ['사용자 확인', '인식된 성분과 복용 주기를 확인하고 저장합니다.', User],
    ['분석 결과 확인', '내 섭취 상태와 추천 가이드를 한눈에 확인합니다.', Activity],
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
