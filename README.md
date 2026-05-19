# tt-ni

영양제 성분표를 입력 또는 사진 업로드로 등록하고, 사용자 조건 기준으로 중복 섭취와 과다/부족 가능성을 계산하는 웹 MVP입니다.

## 구현 범위

- React + TypeScript + Vite 기반 대시보드
- Supabase Auth 이메일 로그인
- Supabase Auth Google/Kakao OAuth 로그인 UI 및 provider readiness check
- 사용자 프로필, 민감 정보 동의, 기저질환/알레르기/식이 제한 입력
- 복용 약 등록 및 약물/질환 주의 룰 매칭
- 성분표 사진 업로드 UI, Supabase Storage 업로드, `parse-label` Edge Function 호출
- AI 추출 결과 editable table 검수 후 저장
- 성분별 1일 총량 계산, 단위 변환, RDA/AI/UL 비교, 중복 성분 표시
- 부족/과다/초과/확인 필요/약물 주의 탭형 분석 리포트
- Supabase Postgres schema, seed data, RLS, private Storage 정책
- OpenAI Responses API 기반 이미지 성분표 구조화 Edge Function

## 실행

```bash
npm install
npm run dev
```

Supabase 연결이 필수입니다. `.env.local`에 프로젝트 URL과 publishable key가 없으면 앱은 실행되지 않습니다.

## 환경 변수

프론트엔드는 브라우저 노출이 가능한 publishable key만 사용합니다.

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

OpenAI 키와 서버 권한 키는 프론트 `.env.local`에 넣지 않습니다. Edge Function secret은 Supabase 프로젝트에만 설정합니다.

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
supabase secrets set TT_NI_SERVICE_ROLE_KEY=...
```

## Supabase

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy parse-label
supabase functions deploy run-analysis
```

Edge Function 로컬 테스트가 필요하면 프론트 `.env.local`이 아니라 Git에 넣지 않는 별도 함수용 env 파일을 사용합니다.

```bash
supabase functions serve parse-label --env-file /tmp/tt-ni-functions.env
supabase functions serve run-analysis --env-file /tmp/tt-ni-functions.env
```

## 검증

```bash
npm run verify
```

Google/Kakao OAuth provider 설정 상태, 로그인 시작 URL, Supabase authorize redirect는 아래 명령으로 확인합니다. 기본값은 로컬 Vite 포트 `5173`과 대체 포트 `5174`를 함께 검사합니다.

```bash
npm run auth:check
```

OAuth credential을 환경변수로 가지고 있으면 Management API로 provider를 켤 수 있습니다.

```bash
SUPABASE_ACCESS_TOKEN=... \
TT_NI_GOOGLE_CLIENT_ID=... \
TT_NI_GOOGLE_CLIENT_SECRET=... \
TT_NI_KAKAO_CLIENT_ID=... \
TT_NI_KAKAO_CLIENT_SECRET=... \
npm run auth:configure
```

OAuth provider 설정 절차는 [docs/OAUTH_SETUP.md](/Users/samuel/Desktop/Project/tt-ni/docs/OAUTH_SETUP.md)에 정리되어 있습니다.

핵심 분석 로직은 `src/lib/analysisEngine.test.ts`에서 단위 변환, 상한 초과, 중복 성분, 약물 상호작용을 검증합니다. `npm run verify`는 Supabase RLS, Data API grant, Storage bucket/policy, migration 적용 상태도 함께 확인합니다.

원격 Supabase, Storage, OpenAI 이미지 파싱, 분석 리포트 생성을 한 번에 확인하려면 QA 계정과 테스트 PNG를 지정해 실행합니다.

```bash
TT_NI_QA_EMAIL=qa@example.com \
TT_NI_QA_PASSWORD='password' \
TT_NI_LABEL_IMAGE=/path/to/label.png \
npm run smoke:remote
```

QA 계정 정보는 `TT_NI_QA_FILE=/path/to/qa.json`으로도 지정할 수 있습니다. JSON에는 `email`, `password`, 선택적으로 `labelImage`를 넣습니다.

`smoke:remote`는 Storage/Edge Function 경로와 제품/성분/복용량 직접 저장 경로를 함께 확인합니다. 테스트 이미지와 테스트 제품 row는 cleanup하고 삭제 여부까지 검증하지만, 원격 함수 동작 증거로 `label_parse_jobs`와 `analysis_reports` row는 남깁니다.
`smoke:remote:strict`는 Edge Function 재배포 후 약물/질환 경고 응답과 DB 저장까지 추가로 검증합니다.

배포 절차는 [docs/DEPLOYMENT.md](/Users/samuel/Desktop/Project/tt-ni/docs/DEPLOYMENT.md)에 정리되어 있습니다.

## 배포 전 체크

- 배포 플랫폼에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`만 등록합니다.
- `OPENAI_API_KEY`, `TT_NI_SERVICE_ROLE_KEY`는 Supabase Edge Function secret으로만 유지합니다.
- Edge Function 소스가 바뀐 경우 `parse-label`, `run-analysis`를 모두 재배포합니다. 승인 후에는 `TT_NI_APPROVE_EDGE_DEPLOY=1 TT_NI_QA_FILE=/path/to/qa.json TT_NI_LABEL_IMAGE=/path/to/label.png npm run deploy:functions`로 함수 배포와 strict 검증을 한 번에 실행할 수 있습니다.
- 배포 전 `npm run verify`를 다시 실행합니다.
- 배포 전 실제 AI 경로까지 확인하려면 `npm run verify:remote`도 실행합니다.
- Edge Function 재배포 후에는 `npm run verify:remote:strict`로 약물/질환 경고 응답까지 확인합니다.
- 최종 릴리즈 직전에는 `npm run verify:release`를 실행합니다. 이 검사는 Edge Function drift 같은 경고도 실패로 처리합니다.
- 배포 후에는 Supabase Auth redirect URL에 배포 도메인을 추가하고 `TT_NI_PRODUCTION_URL=<배포 URL> npm run postdeploy:check` 또는 `npm run postdeploy:check -- --url <배포 URL>`를 실행합니다.
