import { ChevronLeft } from 'lucide-react'

export function PrivacyPolicyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <button type="button" className="button ghost" onClick={onBack}>
          <ChevronLeft size={16} />뒤로 가기
        </button>
        <h1>개인정보 처리방침</h1>
        <p className="legal-date">최종 업데이트: 2026년 5월 20일</p>
      </header>

      <main className="legal-content">
        <p>tt-ni(이하 '서비스')는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하고 있습니다. 본 개인정보 처리방침은 서비스가 수집하는 개인정보의 항목, 수집 목적, 보유 기간 등을 안내합니다.</p>

        <section>
          <h2>제1조 (개인정보의 수집 항목 및 방법)</h2>
          <h3>1. 수집 항목</h3>
          <table>
            <thead>
              <tr><th>구분</th><th>수집 항목</th><th>수집 시점</th></tr>
            </thead>
            <tbody>
              <tr><td>필수</td><td>이메일 주소, 이름(닉네임), 프로필 이미지</td><td>회원가입 (소셜 로그인)</td></tr>
              <tr><td>선택</td><td>성별, 출생연도, 키, 몸무게</td><td>프로필 설정</td></tr>
              <tr><td>선택</td><td>건강 정보 (기저질환, 알레르기, 식이제한, 임신/수유 상태)</td><td>프로필 설정</td></tr>
              <tr><td>선택</td><td>복용 약물 정보 (약명, 복용 목적, 복용 빈도)</td><td>프로필 설정</td></tr>
              <tr><td>선택</td><td>영양제 라벨 이미지</td><td>영양제 등록 (사진 촬영/업로드)</td></tr>
              <tr><td>자동 수집</td><td>서비스 이용 기록, API 호출 기록, 기기 정보</td><td>서비스 이용 과정</td></tr>
            </tbody>
          </table>

          <h3>2. 수집 방법</h3>
          <ul>
            <li>소셜 로그인 (Google, GitHub)을 통한 회원가입 시 자동 수집</li>
            <li>프로필 설정 화면에서 이용자가 직접 입력</li>
            <li>영양제 등록 시 이미지 업로드를 통한 수집</li>
            <li>서비스 이용 과정에서 자동 생성·수집</li>
          </ul>
        </section>

        <section>
          <h2>제2조 (개인정보의 수집 및 이용 목적)</h2>
          <p>수집된 개인정보는 다음의 목적에 활용됩니다.</p>
          <table>
            <thead>
              <tr><th>목적</th><th>상세 내용</th></tr>
            </thead>
            <tbody>
              <tr><td>회원 관리</td><td>본인 확인, 회원 식별, 서비스 이용 기록 관리</td></tr>
              <tr><td>영양 분석 서비스</td><td>개인 맞춤형 영양소 분석, KDRIs 기준 비교, 과다/부족 분석</td></tr>
              <tr><td>약물 상호작용 검사</td><td>복용 약물과 영양제 간 상호작용 분석</td></tr>
              <tr><td>복용 스케줄링</td><td>시간약리학 기반 최적 복용 시간 설계</td></tr>
              <tr><td>AI 채팅 상담</td><td>프로필·영양제·분석 결과를 반영한 개인화된 상담</td></tr>
              <tr><td>API 사용량 관리</td><td>일일 API 호출 한도 관리 및 서비스 품질 유지</td></tr>
              <tr><td>서비스 개선</td><td>이용 패턴 분석을 통한 서비스 품질 개선</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>제3조 (개인정보의 보유 및 이용 기간)</h2>
          <table>
            <thead>
              <tr><th>보유 정보</th><th>보유 기간</th><th>근거</th></tr>
            </thead>
            <tbody>
              <tr><td>회원 정보 (이메일, 이름)</td><td>회원 탈퇴 시까지</td><td>서비스 이용계약</td></tr>
              <tr><td>프로필 정보</td><td>회원 탈퇴 시까지</td><td>서비스 이용계약</td></tr>
              <tr><td>영양제 등록 데이터</td><td>회원 탈퇴 시까지 또는 삭제 요청 시</td><td>서비스 이용계약</td></tr>
              <tr><td>분석 리포트</td><td>회원 탈퇴 시까지</td><td>서비스 이용계약</td></tr>
              <tr><td>API 사용량 기록</td><td>수집일로부터 90일</td><td>서비스 운영</td></tr>
              <tr><td>서비스 이용 로그</td><td>3개월</td><td>통신비밀보호법</td></tr>
            </tbody>
          </table>
          <p>단, 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 아래와 같이 일정 기간 보관합니다.</p>
          <table>
            <thead>
              <tr><th>보존 항목</th><th>보존 기간</th><th>근거 법령</th></tr>
            </thead>
            <tbody>
              <tr><td>계약 또는 청약철회 등에 관한 기록</td><td>5년</td><td>전자상거래법</td></tr>
              <tr><td>소비자의 불만 또는 분쟁처리에 관한 기록</td><td>3년</td><td>전자상거래법</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>제4조 (개인정보의 처리 위탁)</h2>
          <p>서비스는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
          <table>
            <thead>
              <tr><th>수탁자</th><th>위탁 업무</th></tr>
            </thead>
            <tbody>
              <tr><td>Firebase / TiDB Cloud</td><td>인증 서비스 및 데이터베이스 호스팅</td></tr>
              <tr><td>Vercel, Inc.</td><td>프론트엔드 호스팅, CDN</td></tr>
              <tr><td>OpenAI, LLM</td><td>AI 이미지 분석, 영양성분 정제, 채팅 응답 생성</td></tr>
              <tr><td>Exa, Inc.</td><td>영양제 제품 웹 검색</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>제5조 (개인정보의 국외 이전)</h2>
          <p>서비스는 다음과 같이 국외의 제3자에게 개인정보를 이전하고 있습니다.</p>
          <table>
            <thead>
              <tr><th>이전받는 자</th><th>이전 국가</th><th>이전 항목</th><th>이전 목적</th><th>보유 기간</th></tr>
            </thead>
            <tbody>
              <tr><td>Firebase / TiDB Cloud</td><td>서비스 제공 지역</td><td>서비스 이용 시 수집되는 개인정보</td><td>인증, 데이터 저장 및 서비스 운영</td><td>회원 탈퇴 시까지</td></tr>
              <tr><td>Vercel, Inc.</td><td>미국</td><td>서비스 이용 기록</td><td>프론트엔드 호스팅</td><td>회원 탈퇴 시까지</td></tr>
              <tr><td>OpenAI, LLM</td><td>미국</td><td>영양제 라벨 이미지, 성분 정보</td><td>AI 분석 처리</td><td>처리 후 즉시 삭제</td></tr>
              <tr><td>Exa, Inc.</td><td>미국</td><td>영양제 검색 쿼리</td><td>제품 검색</td><td>처리 후 즉시 삭제</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>제6조 (이용자의 권리와 의무)</h2>
          <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
          <ol>
            <li><strong>개인정보 열람 요구</strong>: 자신이 제공한 개인정보의 처리 현황을 열람할 수 있습니다.</li>
            <li><strong>오류 등이 있을 경우 정정·삭제 요구</strong>: 개인정보에 오류가 있거나 불필요한 경우 정정·삭제를 요구할 수 있습니다.</li>
            <li><strong>처리정지 요구</strong>: 개인정보의 처리를 정지하도록 요구할 수 있습니다.</li>
            <li><strong>회원 탈퇴</strong>: 서비스 내 설정 화면에서 언제든지 탈퇴할 수 있으며, 탈퇴 시 개인정보는 지체없이 파기됩니다.</li>
          </ol>
        </section>

        <section>
          <h2>제7조 (민감 정보 처리에 대한 안내)</h2>
          <p>본 서비스는 건강 관련 민감 정보를 처리합니다.</p>
          <ol>
            <li><strong>수집하는 민감 정보</strong>: 기저질환, 알레르기, 임신/수유 상태, 복용 약물</li>
            <li><strong>수집 목적</strong>: 개인 맞춤형 영양 분석 및 약물 상호작용 검사</li>
            <li><strong>동의 거부 권리</strong>: 민감 정보 제공을 거부할 수 있으며, 이 경우 맞춤형 분석 기능이 제한될 수 있습니다.</li>
            <li><strong>중요 안내</strong>: 본 서비스의 분석 결과는 참고용이며, 의학적 진단이나 처방을 대체하지 않습니다. 건강 관련 결정은 반드시 전문의와 상의하시기 바랍니다.</li>
          </ol>
        </section>

        <section>
          <h2>제8조 (개인정보 보호책임자)</h2>
          <p>개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
          <table>
            <thead>
              <tr><th>구분</th><th>내용</th></tr>
            </thead>
            <tbody>
              <tr><td>직책</td><td>개인정보 보호책임자</td></tr>
              <tr><td>이메일</td><td>(추후 기입)</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>제9조 (개인정보 처리방침의 변경)</h2>
          <p>본 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우 변경 사항의 시행 7일 전부터 서비스 내 공지사항을 통하여 고지할 것입니다.</p>
        </section>

        <div className="legal-footer">
          <p><strong>공고일자:</strong> 2026년 5월 20일</p>
          <p><strong>시행일자:</strong> 2026년 5월 20일</p>
        </div>
      </main>
    </div>
  )
}
