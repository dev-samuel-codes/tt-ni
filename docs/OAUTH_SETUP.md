# Google/Kakao OAuth Setup

tt-ni 앱의 소셜 로그인은 Supabase Auth의 OAuth provider를 사용합니다. 앱 코드는 `supabase.auth.signInWithOAuth()`로 Google/Kakao 로그인 시작 URL을 만들고, 로그인 후 다시 앱으로 돌아오도록 `redirectTo`를 지정합니다.

## 현재 프로젝트 값

- Supabase project ref: `bgqfnmvxgqrunzzdvlhf`
- Supabase callback URL: `https://bgqfnmvxgqrunzzdvlhf.supabase.co/auth/v1/callback`
- Local app redirect URLs: `http://127.0.0.1:5173/`, `http://localhost:5173/`
- Local alternate redirect URLs: `http://127.0.0.1:5174/`, `http://localhost:5174/`

## Supabase Dashboard

1. Supabase Dashboard에서 `tt-ni` 프로젝트를 엽니다.
2. `Authentication` > `Sign In / Providers`로 이동합니다.
3. Google provider를 켭니다.
4. Google OAuth Client ID와 Client Secret을 입력합니다.
5. Kakao provider를 켭니다.
6. Kakao REST API key를 Client ID로, Kakao Login Client Secret code를 Client Secret으로 입력합니다.
7. `Authentication` > `URL Configuration`에서 local/dev/production redirect URL을 허용 목록에 추가합니다.

현재 로컬 확인에 필요한 URL Configuration 값:

- Site URL: `http://127.0.0.1:5173`
- Redirect URLs:
  - `http://127.0.0.1:5173/`
  - `http://localhost:5173/`
  - `http://127.0.0.1:5174/`
  - `http://localhost:5174/`

Dashboard 대신 Supabase Management API로 설정할 수도 있습니다. 비밀값은 파일에 저장하지 말고 실행할 때만 환경변수로 넘깁니다.

```bash
SUPABASE_ACCESS_TOKEN=... \
TT_NI_GOOGLE_CLIENT_ID=... \
TT_NI_GOOGLE_CLIENT_SECRET=... \
TT_NI_KAKAO_CLIENT_ID=... \
TT_NI_KAKAO_CLIENT_SECRET=... \
npm run auth:configure
```

## Google Console

Google Cloud Console에서 Web application OAuth client를 만들고 Authorized redirect URI에 아래 값을 추가합니다.

```text
https://bgqfnmvxgqrunzzdvlhf.supabase.co/auth/v1/callback
```

앱에서 직접 Google callback을 받는 구조가 아니라 Supabase Auth가 provider callback을 받기 때문에 Google 쪽 redirect URI는 Supabase callback URL입니다.

## Kakao Developers

Kakao Developers에서 앱을 만들고 다음을 설정합니다.

1. `App Settings` > `App` > `Platform Key`에서 REST API key를 확인합니다.
2. Kakao Login Client Secret code를 발급하고 활성화합니다.
3. Kakao Login Redirect URI에 아래 값을 추가합니다.

```text
https://bgqfnmvxgqrunzzdvlhf.supabase.co/auth/v1/callback
```

4. `Product Settings` > `Kakao Login` > `General`에서 Kakao Login을 ON으로 설정합니다.
5. 필요한 동의 항목을 설정합니다. 이메일이 필요하면 Kakao Biz App 전환이 필요할 수 있습니다.

## 검증

Provider 설정 후 아래 명령으로 Supabase 설정과 OAuth URL 생성을 확인합니다.

```bash
npm run auth:check
```

특정 배포 URL만 확인할 때는 redirect URL을 명시합니다.

```bash
TT_NI_AUTH_REDIRECT_URL=https://your-production-domain.example/ npm run auth:check
```

여러 URL을 한 번에 확인할 때는 쉼표로 구분합니다.

```bash
TT_NI_AUTH_REDIRECT_URLS=http://127.0.0.1:5173/,https://your-production-domain.example/ npm run auth:check
```

성공 조건:

- `google.enabled`가 `true`
- `kakao.enabled`가 `true`
- Google/Kakao 모두 authorize URL이 생성됨
- `redirect_to`가 앱 URL과 일치함
- Supabase authorize endpoint가 Google은 `accounts.google.com`, Kakao는 `kauth.kakao.com`으로 redirect함

## 앱 동작

Provider가 꺼져 있으면 앱 로그인 패널에서 Google/Kakao 버튼이 비활성화되고 설정 안내가 표시됩니다. Provider가 켜지면 버튼이 활성화되고 Supabase OAuth 로그인 화면으로 이동합니다.
