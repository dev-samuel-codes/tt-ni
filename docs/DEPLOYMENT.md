# Deployment

## 1. 환경 변수

`.env.example`의 Firebase, TiDB, AI/Search 값을 배포 환경에 등록합니다.

`VITE_*` 변수만 브라우저에 노출됩니다. TiDB, Firebase Admin, AI/Search 비밀키에는 `VITE_` 접두사를 붙이지 않습니다.

## 2. TiDB 스키마

```bash
npm run db:schema
```

## 3. 실행

```bash
npm run build
npm run start
```

개발 환경에서는 다음 명령으로 Vite와 API 서버를 함께 실행합니다.

```bash
npm run dev
```
