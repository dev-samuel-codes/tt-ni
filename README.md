# tt-ni — AI 기반 맞춤형 영양제 분석 및 복용 관리 서비스

> 성분표 사진 한 장으로 모든 영양제의 중복·부족 성분을 분석하고, 약물 상호작용까지 검사합니다.

---

## 소개

현대인은 건강 관리를 위해 여러 영양제를 동시에 복용하지만, 영양제 간 상호작용, 약물과의 충돌 여부, 하루 총 섭취량의 과다·부족 여부를 정확히 파악하기는 어렵습니다.

**tt-ni**는 이 문제를 AI로 해결하는 서비스입니다. 영양제 라벨 사진을 찍거나 제품명을 검색하면, Vision AI가 성분표를 인식하고 검증된 영양소 데이터베이스와 매칭하여 구조화된 데이터를 생성합니다. 수집된 모든 영양제 성분은 한국인 영양소 섭취기준(KDRI 2025)과 비교되어 과다·부족·적정 상태가 분석되고, 등록된 처방약 및 기저질환과의 상호작용(DNI)까지 검사합니다.

핵심 차별점은 **크로노파마콜로지(chronopharmacology) 기반의 맞춤형 복용 스케줄링**입니다. 영양제별 흡수율, 반감기, 상호 길항 작용을 고려하여 아침·점심·저녁·취침 전 최적의 복용 타임라인을 자동으로 설계합니다.

---

## 핵심 기능

### 영양제 등록 및 관리

| 기능 | 설명 |
|------|------|
| **AI 성분표 인식** | 영양제 라벨 사진을 업로드하면 Vision AI가 성분을 자동 추출합니다. iPhone HEIC 포맷도 자동 변환됩니다. |
| **제품명 검색** | Exa.ai 웹 검색을 통해 제품명만으로 성분 정보를 자동 수집합니다. |
| **수동 입력** | 사진이나 검색이 불필요한 경우 성분을 직접 입력할 수 있습니다. |
| **등록 영양제 목록** | 지금까지 등록한 모든 영양제를 한눈에 확인할 수 있습니다. |
| **부분 수정** | 제품명, 브랜드, 복용 횟수, 복용 시간, 개별 성분의 함량·단위를 수정할 수 있습니다. |
| **삭제** | 더 이상 복용하지 않는 영양제를 목록에서 제거할 수 있습니다. |

### 건강 분석

| 기능 | 설명 |
|------|------|
| **KDRIs 기반 분석** | 사용자 프로필(성별·연령·건강 상태)에 맞춘 한국인 영양소 섭취기준으로 과다·부족·적정 상태를 분석합니다. |
| **약물 상호작용 검사** | 복용 중인 처방약과 영양제 성분 간의 알려진 상호작용을 감지하여 경고합니다. |
| **중복 성분 탐지** | 여러 영양제에 중복 포함된 성분의 총 섭취량을 합산하여 과다 여부를 판단합니다. |
| **시너지 추천** | 함께 복용하면 효과가 높아지는 영양소 조합을 추천합니다. |

### 복용 관리

| 기능 | 설명 |
|------|------|
| **복용 스케줄** | 시간약리학(Chronopharmacology) 원리에 기반하여 영양제별 최적 복용 시간대를 설계합니다. |
| **AI 채팅 상담** | 사용자의 프로필, 건강 상태, 복용 중인 약물, 분석 결과를 반영한 개인화된 AI 상담을 제공합니다. |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Vite |
| 백엔드 | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| AI | OpenAI GPT-5-mini (Vision, Chat), text-embedding-3-small |
| 검색 | Exa.ai API |
| 배포 | Vercel, Supabase Cloud |
| 테스트 | Vitest, @testing-library/react |

---

## 빠른 시작

### 사전 요구사항

- Node.js 18 이상
- Supabase 프로젝트 (URL, Anon Key)
- OpenAI API Key (Vision, Chat 기능용)
- Exa.ai API Key (제품 검색 기능용)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repo-url>
cd tt-ni

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 Supabase URL과 Anon Key를 입력하세요

# 4. Supabase 연결 및 배포
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy

# 5. 개발 서버 실행
npm run dev
```

### 환경 변수

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Edge Function에서 사용하는 키는 Supabase Vault secrets로 관리합니다:

```bash
supabase secrets set EXA_API_KEY=xxx OPENAI_API_KEY=xxx
```

---

## 프로젝트 구조

```
tt-ni/
├── src/
│   ├── app/                    # 라우팅 및 전역 상태 관리
│   │   ├── App.tsx             # 메인 애플리케이션 컴포넌트
│   │   └── routes.ts           # 라우트 정의 및 네비게이션
│   ├── components/
│   │   ├── auth/               # 인증 관련 UI 컴포넌트
│   │   ├── landing/            # 랜딩 페이지 컴포넌트
│   │   ├── layout/             # 레이아웃 (사이드바 등)
│   │   └── workspace/          # 워크스페이스 컴포넌트
│   │       ├── Dashboard.tsx           # 대시보드 (요약 현황)
│   │       ├── SupplementWorkspace.tsx # 영양제 등록/관리
│   │       ├── AnalysisResult.tsx      # 분석 결과 표시
│   │       └── ProfileAndMedication.tsx # 프로필 및 약물 관리
│   ├── features/
│   │   ├── analysis/           # 영양소 분석 엔진
│   │   ├── auth/               # 인증 로직
│   │   ├── nutrition/          # 영양소 데이터 및 기준값
│   │   ├── profile/            # 프로필 관리 서비스
│   │   ├── schedule/           # 복용 스케줄 엔진
│   │   └── supplements/        # 영양제 서비스 (등록/수정/삭제)
│   ├── lib/                    # 유틸리티 및 Supabase 클라이언트
│   ├── pages/                  # 페이지 컴포넌트
│   │   ├── LandingPage.tsx     # 랜딩 페이지
│   │   ├── LoginPage.tsx       # 로그인 페이지
│   │   ├── SchedulePage.tsx    # 복용 스케줄 페이지
│   │   └── ChatPage.tsx        # AI 채팅 페이지
│   ├── styles/                 # CSS 스타일
│   └── types/                  # TypeScript 타입 정의
├── supabase/
│   └── functions/              # Supabase Edge Functions
│       ├── parse-label/        # AI 성분표 이미지 파싱
│       ├── run-analysis/       # 영양소 분석 실행
│       ├── generate-schedule/  # 복용 스케줄 생성
│       ├── exa-search/         # Exa.ai 제품 검색
│       └── chat-completion/    # AI 채팅 응답 생성
├── docs/                       # 기술 문서
├── design/                     # 디자인 리소스
├── public/                     # 정적 에셋
└── scripts/                    # 빌드/배포 스크립트
```

---

## 사용 방법

### 1. 회원가입 및 로그인

Google 또는 GitHub 소셜 로그인으로 간편하게 가입할 수 있습니다.

### 2. 프로필 설정

성별, 출생연도, 건강 상태, 복용 중인 약물 등을 입력하면 개인 맞춤형 분석 기준이 적용됩니다.

### 3. 영양제 등록

세 가지 방법으로 영양제를 등록할 수 있습니다:

- **사진 촬영/업로드**: 영양제 라벨 사진을 찍으면 AI가 성분을 자동 인식합니다.
- **제품명 검색**: 제품명을 입력하면 웹 검색으로 성분 정보를 가져옵니다.
- **수동 입력**: 성분명, 함량, 단위를 직접 입력합니다.

### 4. 영양제 관리

등록된 영양제 목록에서 제품명, 브랜드, 복용 횟수, 복용 시간, 개별 성분의 함량과 단위를 수정하거나 삭제할 수 있습니다.

### 5. 분석 실행

"분석 실행" 버튼을 누르면 등록된 모든 영양제의 성분을 종합 분석합니다:

- 각 영양소별 1일 총 섭취량 계산
- KDRIs 기준 대비 과다/부족/적정 상태 판정
- 약물-영양소 상호작용 경고
- 중복 성분 탐지
- 시너지 영양소 조합 추천

### 6. 복용 스케줄 확인

시간약리학 기반으로 영양제별 최적 복용 시간대를 제안합니다.

### 7. AI 상담

궁금한 점이 있으면 AI 챗봇에게 질문할 수 있습니다. 사용자의 프로필과 분석 결과를 반영한 맞춤형 답변을 제공합니다.

---

## 문서

| 문서 | 설명 |
|------|------|
| [아키텍처 및 기술 문서](./docs/ARCHITECTURE.md) | 시스템 아키텍처 설계 문서 |
| [백엔드 구현 가이드](./docs/BACKEND_GUIDE.md) | Supabase DB 스키마 및 Edge Functions 구현 가이드 |
| [영양제 상호작용 보고서](./docs/영양제%20상호작용%20보고서.md) | 영양제 간 상호작용 분석 보고서 |
| [배포 가이드](./docs/DEPLOYMENT.md) | Vercel + Supabase 배포 절차 |
| [OAuth 설정](./docs/OAUTH_SETUP.md) | 소셜 로그인 설정 가이드 |
| [프로젝트 개요](./docs/PROJECT_OVERVIEW.md) | 프로젝트 전체 개요 |

---

## 테스트

```bash
# 단위 테스트 실행
npm test

# 린트 검사
npm run lint

# 프로덕션 빌드 확인
npm run build

# 전체 검증 (린트 + 테스트 + 빌드 + 배포 사전 점검)
npm run verify
```

---

## 기여자

| 역할 | 이름 | 이메일 |
|------|------|--------|
| 팀장 | 최사무엘 | |
| 조원 | 김현민 | mini0227kim@gmail.com |
| 조원 | 조성아 | |

---

## 참고 사항

- UI 전반의 디자인 일관성 및 사용자 경험 개선이 필요합니다. 현재 기능별로 스타일이 다소 산발적으로 적용되어 있으며, 반응형 레이아웃과 접근성 측면에서 보완할 부분이 있습니다.
- 에러 상태와 로딩 상태에 대한 통일된 처리 방식이 아직 정립되지 않았습니다.
- 모바일 환경에서의 레이아웃 최적화가 추가로 필요합니다.

---

## 라이선스

MIT
