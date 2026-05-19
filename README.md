# tt-ni -- AI 기반 맞춤형 영양제 분석 및 복용 관리 서비스

## 개요

현대인은 건강 관리를 위해 여러 영양제를 동시에 복용하지만, 영양제 간 상호작용, 약물과의 충돌 여부, 하루 총 섭취량의 과다·부족 여부를 정확히 파악하기는 어렵습니다. 각 제품의 성분표를 일일이 비교하고, 자신의 건강 상태와 복용 중인 처방약까지 고려하여 안전한 복용 계획을 세우는 것은 사실상 불가능에 가깝습니다.

tt-ni는 이 문제를 AI로 해결하는 서비스입니다. 영양제 라벨 사진을 찍거나 제품명을 검색하면, Vision AI가 성분표를 인식하고 검증된 영양소 데이터베이스와 매칭하여 구조화된 데이터를 생성합니다. 수집된 모든 영양제 성분은 한국인 영양소 섭취기준(KDRI 2025)과 비교되어 과다·부족·적정 상태가 분석되고, 등록된 처방약 및 기저질환과의 상호작용(DNI)까지 검사합니다.

tt-ni의 핵심 차별점은 크로노파마콜로지(chronopharmacology) 기반의 맞춤형 복용 스케줄링입니다. 영양제별 흡수율, 반감기, 상호 길항 작용을 고려하여 아침·점심·저녁·취침 전 최적의 복용 타임라인을 자동으로 설계합니다. 단순히 영양제를 추천하는 것을 넘어, 안전하고 효과적인 복용 생활 전반을 관리합니다.

## 기능

- AI 성분표 인식 (Vision AI + HEIC 자동 변환)
- 제품명 검색 (Exa.ai)
- 영양제-약물 상호작용 분석 (DNI)
- 과다/부족 섭취 분석 (KDRI 2025 기준)
- 시너지 영양제 추천
- 맞춤형 복용 스케줄링 (크로노파마콜로지)
- AI 영양제 상담 챗봇 (SSE 실시간 스트리밍)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| AI | OpenAI GPT-5-mini (Vision, Chat), text-embedding-3-small |
| Search | Exa.ai API |
| Deployment | Vercel, Supabase Cloud |

## 빠른 시작

```bash
git clone <repo-url>
cd tt-ni
npm install
cp .env.example .env.local
# .env.local 파일을 열어 Supabase URL과 키를 입력하세요
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy
npm run dev
```

## 프로젝트 구조

```
tt-ni/
├── src/
│   ├── app/           # 라우팅 및 전역 상태
│   ├── components/    # UI 컴포넌트 (Dashboard, Workspace 등)
│   ├── features/      # 도메인 로직 (분석, 영양소, 프로필)
│   ├── lib/           # 유틸리티 및 Supabase 클라이언트
│   ├── pages/         # 페이지 컴포넌트
│   └── types/         # TypeScript 타입 정의
├── supabase/
│   └── functions/     # Edge Functions (AI 파싱, 검색, 스케줄링, 챗봇)
├── docs/              # 기술 문서
├── design/            # 디자인 리소스
└── public/            # 정적 에셋
```

## 문서

- [아키텍처 및 기술 문서](./docs/ARCHITECTURE.md)
- [백엔드 구현 가이드](./docs/BACKEND_GUIDE.md)
- [영양제 상호작용 보고서](./docs/영양제%20상호작용%20보고서.md)
- [배포 가이드](./docs/DEPLOYMENT.md)
- [OAuth 설정](./docs/OAUTH_SETUP.md)
- [프로젝트 개요](./docs/PROJECT_OVERVIEW.md)

## 기여자

- [@dev-samuel-codes](https://github.com/dev-samuel-codes) -- 프로젝트 설계, 전체 개발 및 운영

## 참고 사항

- UI 전반의 디자인 일관성 및 사용자 경험 개선이 필요합니다. 현재 기능별로 스타일이 다소 산발적으로 적용되어 있으며, 반응형 레이아웃과 접근성 측면에서 보완할 부분이 있습니다.
- 에러 상태와 로딩 상태에 대한 통일된 처리 방식이 아직 정립되지 않았습니다.
- 모바일 환경에서의 레이아웃 최적화가 추가로 필요합니다.

## 라이선스

MIT
