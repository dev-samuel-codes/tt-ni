# 배포 가이드 (Deployment Guide)

## 1. 환경 변수 설정

`.env.example` 파일을 참고하여 배포 환경에 아래 환경변수를 등록합니다.

### 브라우저 노출 변수 (`VITE_` 접두사)

```env
VITE_FIREBASE_API_KEY=       # Firebase Web App API Key
VITE_FIREBASE_AUTH_DOMAIN=   # Firebase Auth Domain
VITE_FIREBASE_PROJECT_ID=    # Firebase Project ID
VITE_FIREBASE_APP_ID=        # Firebase App ID
VITE_API_BASE_URL=           # (선택) API 서버 URL (기본: 동일 오리진)
```

### 서버 전용 비밀키 (`VITE_` 접두사 없음)

```env
FIREBASE_PROJECT_ID=         # Firebase Project ID (Admin SDK용)
FIREBASE_CLIENT_EMAIL=       # Firebase 서비스 계정 이메일
FIREBASE_PRIVATE_KEY=        # Firebase 서비스 계정 개인키 (줄바꿈 포함)

TIDB_HOST=                   # TiDB 호스트 주소
TIDB_PORT=4000               # TiDB 포트 (기본: 4000)
TIDB_USER=                   # TiDB 사용자명
TIDB_PASSWORD=               # TiDB 비밀번호
TIDB_DATABASE=               # TiDB 데이터베이스명
TIDB_SSL_CA=                 # (선택) TiDB SSL CA 인증서 경로

OPENAI_API_KEY=              # OpenAI API Key (또는 COMETAPI_KEY)
EXA_API_KEY=                 # Exa.ai API Key

DAILY_EXTERNAL_API_LIMIT=    # (선택) 1일 외부 API 호출 한도 (기본: 50)
```

> **중요**: `VITE_` 접두사가 붙은 변수만 브라우저에 노출됩니다. TiDB 비밀번호, Firebase Admin 키, AI/Search API 키에는 절대 `VITE_` 접두사를 붙이지 마세요.

## 2. TiDB 스키마 적용

```bash
npm run db:schema
```

이 명령은 `server/schema.sql` 파일을 읽어 TiDB에 `CREATE TABLE IF NOT EXISTS` 문을 실행합니다.

## 3. 배포 방법

### Vercel 배포

```bash
npm run build          # TypeScript 컴파일 + Vite 빌드
npm run start          # Node.js 서버 실행 (Vercel은 serverless function 사용)
```

- Vercel은 `vercel.json` 설정에 따라 자동으로 빌드/배포됩니다.
- `api/` 디렉토리의 파일들이 Vercel Serverless Functions로 변환됩니다.
- `api/[...path].ts`는 Express 앱을 래핑하는 catch-all 핸들러입니다.
- Vercel 환경에서는 `VERCEL=1`이 자동 설정되어 정적 파일 서빙 분기를 건너뜁니다.

### Standalone Node.js 배포

```bash
npm run build
npm run start
```

- `server/index.ts`가 `dist/` 디렉토리의 정적 파일을 서빙합니다.
- 포트는 `PORT` 환경변수로 지정 가능 (기본: 8787).

### Docker 배포 (권장 사항)

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ dist/
COPY server/ server/
EXPOSE 8787
CMD ["node", "--import", "tsx", "server/index.ts"]
```

## 4. 개발 환경 실행

```bash
npm run dev
```

Vite Dev Server (기본 port 5173) + API Server (기본 port 8787)를 `concurrently`로 동시 실행합니다. Vite의 프록시 설정이 `/api` 요청을 API 서버로 전달합니다.

## 5. 전체 검증

```bash
npm run verify    # lint + test + build 실행
```
