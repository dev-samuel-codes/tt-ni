# Firebase Auth 설정 가이드

tt-ni의 인증은 Firebase Auth를 사용합니다.

## 필수 설정

1. **Firebase Console에서 Web App 생성**
   - [Firebase Console](https://console.firebase.google.com/) → 프로젝트 선택 → '웹 앱 추가'
   - 생성된 Firebase SDK 구성값을 `.env.local`의 `VITE_FIREBASE_*` 변수에 입력

2. **Email/Password 인증 활성화**
   - Firebase Console → Authentication → Sign-in method → 이메일/비밀번호 '사용 설정'

3. **Google 로그인 활성화**
   - Firebase Console → Authentication → Sign-in method → Google '사용 설정'
   - `.env.local`에 `VITE_FIREBASE_GOOGLE_ENABLED=true` 설정
   - 프로젝트 공개 이름과 지원 이메일 설정

4. **Kakao 로그인 설정**
   - [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션 생성
   - '카카오 로그인' → '활성화 설정' → Redirect URI 등록
     - **개발**: `https://<project-id>.firebaseapp.com/__/auth/handler`
     - **배포**: `https://your-domain.com/__/auth/handler`
   - '동의항목'에서 닉네임, 프로필 사진, 이메일을 필수 수집으로 설정
   - Firebase Console에서 'OpenID Connect 제공업체'로 Kakao 등록:
     - Client ID: Kakao 앱의 REST API 키
     - Client Secret: Kakao 앱의 Client Secret
     - Issuer URL: `https://kauth.kakao.com`
   - `.env.local`에 `VITE_FIREBASE_KAKAO_ENABLED=true` 설정
   - 제공업체 ID는 기본값 `oidc.kakao`를 사용 (변경 시 `VITE_FIREBASE_KAKAO_PROVIDER_ID`로 지정)

5. **서버 Firebase Admin SDK 설정**
   - Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
   - 방법 A (권장): 다운로드한 JSON 파일의 내용을 `FIREBASE_SERVICE_ACCOUNT_JSON` 환경변수에 한 줄로 입력
   - 방법 B: `project_id`, `client_email`, `private_key`를 각각 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`에 입력

## 프론트 환경변수

```env
VITE_FIREBASE_API_KEY=               # Firebase Web API Key
VITE_FIREBASE_AUTH_DOMAIN=           # Firebase Auth Domain
VITE_FIREBASE_PROJECT_ID=            # Firebase Project ID
VITE_FIREBASE_APP_ID=                # Firebase App ID
VITE_FIREBASE_GOOGLE_ENABLED=true    # Google 로그인 활성화
VITE_FIREBASE_KAKAO_ENABLED=true     # Kakao 로그인 활성화
VITE_FIREBASE_KAKAO_PROVIDER_ID=oidc.kakao  # Kakao OIDC 제공업체 ID
```

## 서버 환경변수

```env
FIREBASE_PROJECT_ID=                 # Firebase Project ID (Admin SDK용)
FIREBASE_CLIENT_EMAIL=               # Firebase 서비스 계정 이메일
FIREBASE_PRIVATE_KEY=                # Firebase 서비스 계정 개인키 (줄바꿈: \n)
# 또는
FIREBASE_SERVICE_ACCOUNT_JSON=       # 서비스 계정 JSON 파일 내용 (한 줄)
```

## 트러블슈팅

- **팝업 차단**: 브라우저가 소셜 로그인 팝업을 차단한 경우 `signInWithRedirect`로 폴백
- **OAuth redirect URI 불일치**: Firebase Console과 Kakao Developers에 등록된 Redirect URI가 일치하는지 확인
- **Firebase Admin SDK 초기화 실패**: 서버 로그에서 `FIREBASE_PRIVATE_KEY`의 줄바꿈 문자가 `\\n`으로 제대로 이스케이프되었는지 확인
