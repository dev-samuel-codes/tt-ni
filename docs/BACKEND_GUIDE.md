# Backend Guide

현재 백엔드는 `server/index.ts`의 Node.js API 서버입니다.

## 구성

- 인증: Firebase Admin SDK로 `Authorization: Bearer <Firebase ID token>` 검증
- 데이터베이스: `mysql2/promise`로 TiDB 연결
- 스키마: `server/schema.sql`
- AI 이미지 파싱/채팅/성분 정제: 서버에서 OpenAI-compatible API 호출
- 제품 검색: 서버에서 Exa.ai API 호출

## 주요 명령

```bash
npm run db:schema
npm run dev
npm run verify
```

`TIDB_PASSWORD`, `FIREBASE_PRIVATE_KEY`, `OPENAI_API_KEY`, `EXA_API_KEY`는 서버 전용 환경변수로만 둡니다.
