# Backend Guide

현재 백엔드는 `server/index.ts`의 Node.js API 서버입니다.

## 구성

- **인증**: Firebase Admin SDK로 `Authorization: Bearer <Firebase ID token>` 검증
- **데이터베이스**: `mysql2/promise`로 TiDB 연결 (커넥션 풀 사용)
- **스키마**: `server/schema.sql` (10개 테이블)
- **AI 이미지 파싱/채팅/성분 정제**: 서버에서 OpenAI-compatible API 호출
- **제품 검색**: 서버에서 Exa.ai API 호출
- **API 사용량 제한**: `app_api_usage` 테이블 기반 1일 호출 횟수 제한
- **파일 업로드**: multer 메모리 스토리지로 이미지 버퍼 처리 (최대 10MB)

## 미들웨어 체인

```
cors → express.json → /api/health (인증 없음)
                    → authenticate → asyncRoute → handler
                                     → enforceExternalApiQuota (외부 API 호출 시)
```

### authenticate
- `Authorization: Bearer <token>` 헤더에서 Firebase ID token 추출
- `firebaseAdmin.verifyIdToken()` 으로 검증
- 검증 성공 시 `req.user`에 `{ uid, email, name }` 할당
- `ensureUser()`로 `app_users` 테이블 upsert

### asyncRoute
- `req.user` 존재 여부 확인 후 핸들러 실행
- 핸들러에서 발생한 예외를 `next(error)`로 전파

### enforceExternalApiQuota
- `app_api_usage` 테이블의 당일 `call_count` 확인
- 초과 시 429 응답 반환

## API 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/user-data` | 사용자 데이터 일괄 조회 |
| POST | `/api/profile` | 프로필 저장 |
| POST | `/api/supplements` | 영양제 저장 |
| PATCH | `/api/supplements/:id` | 영양제 수정 |
| POST | `/api/supplements/ingredients` | 성분 수정 |
| DELETE | `/api/supplements/:id` | 영양제 삭제 |
| POST | `/api/analysis` | 분석 리포트 저장 |
| POST | `/api/generate-schedule` | 복용 스케줄 생성 |
| POST | `/api/refine-ingredients` | 성분명 정제 |
| POST | `/api/parse-label` | 이미지 파싱 |
| POST | `/api/exa-search` | 제품 검색 |
| GET/POST/PATCH | `/api/chat/*` | 채팅 세션/메시지 CRUD |
| POST | `/api/chat/completion` | AI 채팅 (SSE) |

## 데이터베이스 스키마

`schema.sql` 파일은 10개의 테이블과 2개의 인덱스를 포함합니다:

1. `app_users` - Firebase 사용자 (Firebase UID → DB ID 매핑)
2. `app_user_profiles` - 건강 프로필 (성별, 출생연도, 신체 정보, 임신/수유)
3. `app_user_conditions` - 건강 상태/알레르기/식이 제한
4. `app_user_medications` - 처방약 정보
5. `app_supplement_products` - 등록 영양제 제품
6. `app_supplement_ingredients` - 제품별 성분 (원재료명, 표준명, 함량, 단위, 신뢰도)
7. `app_user_supplements` - 사용자-영양제 조인 (복용 횟수, 복용 시간)
8. `app_analysis_reports` - 분석 리포트 (JSON 컬럼에 저장)
9. `app_chat_sessions` - 채팅 세션
10. `app_chat_messages` - 채팅 메시지
11. `app_api_usage` - API 호출량 추적

## 에러 처리

- Express 전역 에러 핸들러가 모든 예외를 500 응답으로 변환
- `asyncRoute`에서 발생한 예외도 동일 체인으로 처리됨
- TiDB 연결 오류는 `mysql2/promise`가 자동으로 처리 (커넥션 풀 복구)

## 주요 명령

```bash
npm run db:schema    # TiDB 스키마 적용
npm run dev          # 개발 서버 (Vite + API 동시 실행)
npm run dev:api      # API 서버만 실행
npm run verify       # lint + test + build
```

## 비밀키 관리

`TIDB_PASSWORD`, `FIREBASE_PRIVATE_KEY`, `OPENAI_API_KEY`, `EXA_API_KEY`는 서버 전용 환경변수(`.env.local`)로만 둡니다. `VITE_` 접두사가 붙은 변수만 브라우저에 노출됩니다.

## 개발 워크플로우

1. `npm run dev`로 Vite Dev Server (port 5173) + API Server (port 8787) 동시 실행
2. Vite의 프록시 설정(`vite.config.ts`)이 `/api` 요청을 API 서버로 전달
3. `server/index.ts`의 `VERCEL !== '1'` 분기에서 `dist/` 정적 파일 서빙
4. Vercel 배포 시 `api/` 디렉토리의 함수 어댑터가 Express 앱을 래핑
