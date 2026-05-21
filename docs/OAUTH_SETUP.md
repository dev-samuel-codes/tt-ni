# Firebase Auth Setup

tt-ni의 인증은 Firebase Auth를 사용합니다.

## 필수 설정

1. Firebase Console에서 Web App을 생성합니다.
2. Email/Password와 Google provider를 활성화합니다.
3. Kakao는 Firebase OIDC provider로 등록하고 provider id를 `.env.local`의 `VITE_FIREBASE_KAKAO_PROVIDER_ID`에 넣습니다. 기본값은 `oidc.kakao`입니다.
4. 서버에는 Firebase Admin SDK용 서비스 계정 값을 등록합니다.

## 프론트 환경변수

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_KAKAO_PROVIDER_ID=oidc.kakao
```

## 서버 환경변수

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```
