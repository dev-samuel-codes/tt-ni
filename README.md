# tt-ni

> **당신의 영양제 조합, AI가 안전하게 설계합니다**

---

## 이런 고민, 해보신 적 없나요?

건강을 위해 여러 영양제를 챙겨 먹고 있지만, 정작 아래와 같은 불안감은 늘 따라다닙니다.

- "비타민 C랑 철분을 같이 먹어도 될까? 어떤 성분끼리 충돌하는지 도통 모르겠다."
- "지금 복용 중인 혈압약이랑 이 영양제를 함께 먹어도 괜찮을까? 확인할 길이 마땅치 않다."
- "제품마다 성분표에 적힌 용량이 제각각이라, 도대체 하루에 얼마나 먹고 있는 건지 비교조차 어렵다."

**tt-ni**는 이런 문제를 기술로 해결합니다. 영양제 라벨 사진 한 장이면 충분합니다. AI가 성분을 읽어내고, 한국인 영양소 섭취기준과 비교하여 과잉·부족·충돌 여부를 분석해 드립니다. 마치 **주머니 속 AI 약사**처럼요.

---

## 주요 기능

| | 기능 | 설명 |
|---|------|------|
| [사진등록] | **성분표 사진 촬영으로 간편 등록** | 영양제 라벨 사진을 찍으면 Vision AI가 성분명·함량·단위를 자동으로 추출합니다. iPhone HEIC 포맷도 자동으로 JPEG 변환됩니다. |
| [제품검색] | **영양제 제품명 검색** | 사진이 없어도 제품명만 입력하면 Exa.ai 웹 검색으로 제품 정보를 찾아 성분 데이터를 구조화합니다. |
| [상호작용] | **영양제-약물 상호작용 알림** | 복용 중인 처방약과 영양제 성분 간 알려진 상호작용(DNI)을 감지하여 경고합니다. 와파린·스타틴·항생제 등 주요 약물군을 지원합니다. |
| [성분분석] | **과다/부족 섭취 분석** | 등록된 모든 영양제의 성분을 합산하여, 한국인 영양소 섭취기준(KDRI)의 RDA·AI·UL과 비교합니다. 과잉·주의·부족·적정·미확인 5단계로 상태를 진단합니다. |
| [시너지] | **시너지 영양제 추천** | 함께 먹으면 좋은 조합을 자동으로 찾아 추천합니다. 예: 비타민 C + 철분(흡수율 극대화), CoQ10 + 오메가3(심혈관 시너지). |
| [스케줄] | **맞춤형 복용 스케줄링** | 크로노파마콜로지 원리에 기반해 공복·식후·저녁 시간대로 최적의 복용 타임라인을 설계합니다. DNI 충돌과 길항 작용까지 고려합니다. |
| [AI상담] | **AI 영양제 상담 챗봇** | 내 프로필, 건강 상태, 복용 중인 약물과 영양제, 최신 분석 리포트를 맥락으로 반영해 개인화된 답변을 SSE 실시간 스트리밍으로 제공합니다. |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 19, TypeScript, Vite |
| **Backend** | Supabase (Auth, Database, Storage, Edge Functions) |
| **AI** | OpenAI GPT-5-mini (Vision + Chat), text-embedding-3-small |
| **검색** | Exa.ai Web Search API |
| **인프라** | Vercel, Supabase Cloud |

---

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
```

`.env.local` 파일을 열어 아래 값을 입력하세요:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

> `OPENAI_API_KEY`, `TT_NI_SERVICE_ROLE_KEY` 등 서버 측 비밀 키는 Supabase Edge Function secret으로만 관리하며, 절대 프론트엔드 환경 변수에 넣지 않습니다.

```bash
# 3. Supabase Edge Function secret 설정
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TT_NI_SERVICE_ROLE_KEY=...
supabase secrets set EXA_API_KEY=...

# 4. 개발 서버 실행
npm run dev
```

---

## 추가 정보

- [아키텍처 및 기술 문서](./docs/ARCHITECTURE.md)
- [[백엔드] 백엔드 구현 가이드](./docs/BACKEND_GUIDE.md)
- [[보고서] 영양제 상호작용 보고서](./docs/영양제%20상호작용%20보고서.md)
- [[배포] 배포 가이드](./docs/DEPLOYMENT.md)
- [OAuth 설정](./docs/OAUTH_SETUP.md)

---

## 참고 사항

- UI 전반의 디자인 일관성 및 사용자 경험 개선이 필요합니다. 현재 기능별로 스타일이 다소 산발적으로 적용되어 있으며, 반응형 레이아웃과 접근성 측면에서 보완할 부분이 있습니다.
- 에러 상태와 로딩 상태에 대한 통일된 처리 방식이 아직 정립되지 않았습니다.
- 모바일 환경에서의 레이아웃 최적화가 추가로 필요합니다.
