# tt-ni 배포 가이드

> Vercel + Supabase Cloud 기반 배포 절차를 안내합니다.

---

## 1. 사전 요구사항

| 항목 | 요구사항 |
|------|----------|
| **Node.js** | 18 이상 |
| **Supabase 프로젝트** | URL, Anon Key, Service Role Key |
| **Vercel 계정** | GitHub 연동 권장 |
| **API 키** | OpenAI API Key, Exa.ai API Key |

---

## 2. 환경 변수 설정

### 2.1 프론트엔드 (.env.local)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> ⚠️ `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 등 서버용 키는 절대 프론트엔드 환경 변수에 포함하지 마세요.

### 2.2 Supabase Edge Functions Secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set EXA_API_KEY=xxx
supabase secrets set TT_NI_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 3. Supabase 배포

### 3.1 데이터베이스 마이그레이션

```bash
# Supabase CLI 로그인
npx supabase login

# 프로젝트 연결
npx supabase link --project-ref <your-project-ref>

# 마이그레이션 적용
npx supabase db push
```

### 3.2 Edge Functions 배포

```bash
# 모든 함수 배포
npx supabase functions deploy

# 또는 개별 함수 배포
npx supabase functions deploy parse-label
npx supabase functions deploy run-analysis
npx supabase functions deploy exa-search
npx supabase functions deploy refine-ingredients
npx supabase functions deploy generate-schedule
npx supabase functions deploy chat-completion
```

### 3.3 Storage 버킷 설정

Supabase Dashboard > Storage에서 다음 버킷을 생성합니다:

| 버킷 이름 | Public | 용도 |
|-----------|--------|------|
| `label-images` | 비공개 | 영양제 라벨 이미지 저장 |

---

## 4. Vercel 배포

### 4.1 프로젝트 연결

1. [Vercel](https://vercel.com)에 로그인합니다.
2. "New Project"를 클릭합니다.
3. GitHub 저장소(`tt-ni`)를 선택합니다.
4. 프레임워크가 자동으로 "Vite"로 감지됩니다.

### 4.2 환경 변수 설정

Vercel 프로젝트 Settings > Environment Variables에서 다음 변수를 추가합니다:

| 변수 이름 | 값 | Environment |
|-----------|-----|-------------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key | Production, Preview, Development |

### 4.3 배포

```bash
# Vercel CLI 사용 시
vercel --prod

# 또는 GitHub push 시 자동 배포 (main 브랜치)
git push origin main
```

### 4.4 Supabase Auth Redirect URL 설정

배포 후 Supabase Dashboard > Authentication > URL Configuration에서:

1. **Site URL**: `https://your-production-url.vercel.app`
2. **Redirect URLs**: `https://your-production-url.vercel.app/**` 추가

---

## 5. 배포 전 검증

```bash
# 전체 검증 (린트 + 테스트 + 빌드 + 배포 사전 점검)
npm run verify

# 릴리스 모드 (경고를 에러로 처리)
npm run verify:release
```

검증 항목:
- ✅ ESLint 통과
- ✅ 단위 테스트 통과
- ✅ 프로덕션 빌드 성공
- ✅ 프론트엔드 환경 변수 검증
- ✅ Supabase Secrets 확인
- ✅ Edge Functions 상태 확인
- ✅ RLS 정책 확인
- ✅ Storage 버킷 정책 확인

---

## 6. 배포 후 확인

```bash
# 배포된 에셋 확인
TT_NI_PRODUCTION_URL=https://your-production-url.vercel.app npm run postdeploy:check
```

수동 확인 체크리스트:
1. 프로덕션 URL 접속 확인
2. 소셜 로그인 (Google, GitHub) 동작 확인
3. 프로필 입력 및 저장 확인
4. 영양제 등록 (사진, 검색, 수동) 확인
5. 영양제 목록 표시, 부분수정, 삭제 확인
6. 분석 실행 및 결과 확인
7. 복용 스케줄 확인
8. AI 채팅 확인
9. API 호출 한도 초과 시 메시지 확인

---

## 7. 문제 해결

### 빌드 경고: Chunk size 초과

```
Some chunks are larger than 500 kB after minification
```

이 경고는 빌드에는 영향을 주지 않지만, 코드 스플리팅을 고려할 수 있습니다:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
```

### Edge Function 배포 실패

```bash
# 함수 상태 확인
npx supabase functions list

# 로그 확인
npx supabase functions logs parse-label
```

### Supabase 연결 오류

1. `.env.local`의 URL과 Key가 정확한지 확인
2. Supabase 프로젝트가 활성 상태인지 확인
3. RLS 정책이 올바르게 설정되어 있는지 확인

---

## 8. Supabase Secrets 관리

```bash
# 현재 설정된 secrets 확인
npx supabase secrets list

# secrets 설정
npx supabase secrets set KEY_NAME=value

# secrets 삭제
npx supabase secrets unset KEY_NAME
```

### 필수 Secrets

| 이름 | 용도 |
|------|------|
| `OPENAI_API_KEY` | AI 이미지 분석, 성분 정제, 채팅 응답 |
| `EXA_API_KEY` | 영양제 제품 웹 검색 |
| `TT_NI_SERVICE_ROLE_KEY` | 서버 측 Supabase 접근 |

---

## 9. 모니터링

### Supabase Dashboard

- **Database**: 쿼리 성능, 연결 수 모니터링
- **Auth**: 로그인/로그아웃 이벤트 확인
- **Storage**: 사용량 및 업로드/다운로드 이벤트
- **Edge Functions**: 호출 횟수, 에러율, 응답 시간

### Vercel Dashboard

- **Deployments**: 배포 이력 및 상태
- **Analytics**: 페이지뷰, 방문자 수
- **Speed Insights**: Core Web Vitals
- **Logs**: 런타임 에러 확인

---

## 10. 업데이트 절차

### 코드 업데이트

```bash
# 1. 변경 사항 커밋
git add .
git commit -m "feat: 새로운 기능"

# 2. 푸시 (자동 배포)
git push origin main
```

### Edge Function 업데이트

```bash
# 변경된 함수만 배포
npx supabase functions deploy refine-ingredients
```

### 데이터베이스 마이그레이션

```bash
# 새 마이그레이션 생성
npx supabase migration new add_new_feature

# 마이그레이션 적용
npx supabase db push
```

---

**최종 업데이트: 2026년 5월 20일**
