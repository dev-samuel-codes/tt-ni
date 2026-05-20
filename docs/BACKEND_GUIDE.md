# tt-ni 백엔드/DB 구현 가이드 — 로컬 전용 문서

> ⚠️ 이 문서는 git으로 추적하지 않습니다 (.gitignore에 추가됨)

---

## 개요

현재 UI 뼈대(Phase 1~3)가 완성된 상태이며, 각 컴포넌트 코드 내에 `// TODO: 사용자님 작업 영역` 주석으로
실제 로직 연동 포인트가 표시되어 있습니다. 이 문서는 UI를 실제로 동작시키기 위해 구현해야 할
백엔드/DB/API 작업을 체계적으로 정리합니다.

---

## 1단계: Supabase DB 스키마 확장

### 1.1 사용자 프로필 테이블 (`user_profiles`)
```sql
-- 기저질환 칩 UI에 맞춰 conditions를 text[] 배열로 저장
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS conditions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_restrictions text[] DEFAULT '{}';
```

### 1.2 영양제 제품 테이블 (`supplement_products`)
- `source_type` 컬럼에 `'search'` 값 추가 (Exa.ai 검색 등록용)
- `exa_search_url` 컬럼 추가 (출처 URL 보존)

### 1.3 분석 리포트 테이블 (`analysis_reports`)
- `synergy_recommendations` JSONB 컬럼 추가 (시너지 조합 데이터 저장)
- `interaction_warnings` JSONB 컬럼에 severity 필드 정규화

### 1.4 복용 스케줄 테이블 (`dosage_schedules`) — 신규
```sql
CREATE TABLE dosage_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  schedule_date date NOT NULL,
  slots jsonb NOT NULL,  -- [{time, label, items[], tip?, warning?}]
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, schedule_date)
);
```

### 1.5 AI 채팅 테이블 (`chat_sessions`, `chat_messages`) — 신규
```sql
CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text DEFAULT '새 대화',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions NOT NULL,
  role text CHECK (role IN ('user', 'assistant')) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

## 2단계: Supabase Edge Functions

### 2.1 `run-analysis` (기존 개선)
**파일**: `supabase/functions/run-analysis/index.ts`

추가 작업:
- `interactionRules` 배열 확장본(`nutritionData.ts`)을 서버 측에도 동기화
- 시너지 추천 로직 추가: 보고서 2.1절 기반으로 사용자 보유 성분 조합 매칭
- 응답에 `synergyRecommendations[]` 필드 추가

### 2.2 `generate-schedule` — 신규
**파일**: `supabase/functions/generate-schedule/index.ts`

입력: `{ profile, supplements, medications, preferences: { wakeTime, mealTimes } }`
출력: `{ slots: TimeSlot[] }`

핵심 로직 (보고서 제4~5장 기반):
1. **슬롯 분류**: 각 영양소를 공복/식후/저녁 식후 슬롯으로 배치
   - 공복: 유산균, 비타민 B군, 철분(위장 장애 없을 시), 아미노산, 홍삼
   - 식후: 지용성 비타민(A/D/E/K), 오메가3, 코엔자임Q10
   - 저녁 식후: 칼슘, 마그네슘, 밀크씨슬, 감마리놀렌산
2. **충돌 검사**: DNI 규칙 + 길항 규칙으로 같은 슬롯에 배치 불가한 조합 분리
   - `|T_A - T_B| >= 2 hours` 제약 조건 적용
3. **경고 생성**: 각 슬롯별 주의사항 메시지 첨부

### 2.3 `chat-completion` — 신규
**파일**: `supabase/functions/chat-completion/index.ts`

입력: `{ sessionId, message, context: { profile, supplements, report } }`
출력: SSE 스트리밍 응답

구현 포인트:
- OpenAI/Anthropic API 호출 (system prompt에 사용자 컨텍스트 주입)
- 대화가 20턴 이상이면 자동 요약 후 컨텍스트 압축
- Rate limiting: 사용자당 일일 50회 제한

### 2.4 `exa-search` — 신규
**파일**: `supabase/functions/exa-search/index.ts`

입력: `{ query: string }` (영양제 제품명)
출력: `{ products: [{ name, brand, ingredients[], sourceUrl }] }`

구현 포인트:
- Exa.ai API 호출 (`EXA_API_KEY` 환경변수)
- 검색 결과에서 성분 정보 추출 (AI 파싱)
- `ParsedIngredient[]` 형태로 정규화하여 반환

---

## 3단계: 프론트엔드 연동 포인트 (TODO 위치별)

### `src/components/workspace/WorkspacePage.tsx`
| TODO 위치 | 작업 내용 |
|-----------|-----------|
| Dashboard — `userName` | `supabase.auth.getUser()`에서 이름 가져오기 |
| Dashboard — `mockTodaySchedule` | `generate-schedule` Edge Function 호출 결과로 교체 |
| Dashboard — `mockSynergies` | `run-analysis` 응답의 `synergyRecommendations`로 교체 |
| SupplementWorkspace — `handleSearch()` | `exa-search` Edge Function 호출로 교체 |

### `src/pages/SchedulePage.tsx`
| TODO 위치 | 작업 내용 |
|-----------|-----------|
| `mockTimeline` | `generate-schedule` 호출 → `selectedDate` 기준 스케줄 로드 |
| `dosageTips` | (선택) 사용자 약물 정보 기반으로 동적 생성 |

### `src/pages/ChatPage.tsx`
| TODO 위치 | 작업 내용 |
|-----------|-----------|
| `sessions` | `chat_sessions` 테이블에서 로드 + 생성/삭제 CRUD |
| `handleSend()` | `chat-completion` Edge Function SSE 스트리밍 호출 |
| `contextBadges` | 실제 프로필/영양제/리포트 존재 여부 반영 |
| FAQ 질문 | (선택) 사용자 데이터 기반 동적 생성 |

---

## 4단계: 환경 변수 (.env.local)

```env
# 기존
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# 추가 필요
EXA_API_KEY=...                    # Exa.ai 웹 검색 API
OPENAI_API_KEY=...                 # AI 채팅용 (또는 Anthropic)
```

> Edge Function 내부에서 사용하는 키는 Supabase Vault secrets로 관리:
> `supabase secrets set EXA_API_KEY=xxx OPENAI_API_KEY=xxx`
> 
> **현재 상태 (2026-05-20):** `OPENAI_API_KEY`는 설정 완료. `EXA_API_KEY`는 아직 미설정 상태.
> 권한 이슈로 CLI에서 설정 불가 → [Supabase Dashboard > Project Settings > Secrets](https://supabase.com/dashboard/project/bgqfnmvxgqrunzzdvlhf/settings/secrets) 에서 직접 추가 필요.
> 
> ```
> Name: EXA_API_KEY
> Value: your_exa_api_key_here
> ```

---

## 5단계: 분석 엔진 고도화 (`src/features/analysis/analysisEngine.ts`)

### 5.1 시너지 판별 로직 추가
보고서 2.1절 기반 시너지 그룹 정의:
```typescript
const SYNERGY_GROUPS = [
  { nutrients: ['coq10', 'omega3'], label: 'CoQ10 + 오메가3', benefit: '심혈관 건강 시너지' },
  { nutrients: ['vitamin_c', 'iron'], label: '비타민 C + 철분', benefit: '철분 흡수율 극대화' },
  { nutrients: ['vitamin_e', 'omega3'], label: '비타민 E + 오메가3', benefit: '지질 과산화 억제' },
  { nutrients: ['vitamin_c', 'collagen'], label: '비타민 C + 콜라겐', benefit: '콜라겐 재합성 촉진' },
]
```

### 5.2 길항 작용 판별 로직 추가
보고서 2.2절 기반 길항 그룹 정의:
```typescript
const ANTAGONISM_GROUPS = [
  { nutrients: ['calcium', 'iron'], minIntervalHours: 2, reason: 'DMT1 수송체 경쟁' },
  { nutrients: ['calcium', 'magnesium', 'zinc'], minIntervalHours: 2, reason: '다가 양이온 경쟁' },
]
```

### 5.3 노인/소아 외삽법 적용
보고서 1.2절의 수식을 `analysisEngine.ts`에 구현:
- 소아: `UL_child = UL_adult × (weight_child / weight_adult)`
- 노인: `EAR_elderly = EAR_adult × (weight_elderly / weight_adult)^0.75`

---

## 6단계: 스케줄 엔진 신규 구현

**파일**: `src/features/schedule/scheduleEngine.ts`

```typescript
// 골격 예시
interface TimeSlot {
  time: string
  label: string
  items: string[]
  tip?: string
  warning?: string
}

export function generateSchedule(
  supplements: SupplementProduct[],
  medications: Medication[],
  profile: Profile,
  preferences: { wakeTime: string; mealTimes: string[] }
): TimeSlot[] {
  // 1. 각 영양소를 카테고리별로 분류 (공복/식후/저녁)
  // 2. DNI 충돌 검사
  // 3. 길항 작용 그룹 시간 분리
  // 4. 최종 타임라인 생성
  return []
}
```

---

## 7단계: 테스트 및 검증

### 7.1 유닛 테스트
- `analysisEngine.ts` — 시너지/길항 판별 정확도
- `scheduleEngine.ts` — 충돌 분리 로직 검증
- `nutritionData.ts` — interactionRules 매칭 테스트

### 7.2 통합 테스트
- Edge Function 배포 후 실제 데이터로 E2E 테스트
- 다양한 프로필(임산부, 노인, 당뇨 환자 등)로 분석 결과 검증

### 7.3 보안 점검
- RLS(Row Level Security) 정책 모든 신규 테이블에 적용
- API Rate Limiting 동작 확인
- 민감 건강 정보 암호화 저장 여부 확인

---

## 우선순위 추천

| 순위 | 작업 | 이유 |
|------|------|------|
| 🥇 1 | Exa.ai 검색 연동 | 영양제 등록 UX 핵심 기능 |
| 🥈 2 | 분석 엔진 시너지/길항 로직 | 대시보드 추천 조합의 실질적 동작 |
| 🥉 3 | 스케줄 엔진 구현 | 복용 스케줄 페이지의 실질적 동작 |
| 4 | AI 채팅 연동 | SSE 스트리밍 + 컨텍스트 주입 |
| 5 | DB 스키마 마이그레이션 | 위 기능들의 데이터 영속성 |
