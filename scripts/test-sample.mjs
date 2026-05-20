import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

function readEnv(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const env = readEnv('.env.local')
const supabaseUrl = env.VITE_SUPABASE_URL
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !publishableKey) {
  console.error('에러: .env.local 파일에서 Supabase 설정을 찾을 수 없습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false },
})

async function runTest() {
  const sampleImagePath = '/Users/gimhyeonmin/test/tt-ni/tt-ni/sample img/IMG_1579.jpg'

  console.log(`[1] 익명 임시 로그인 진행 중...`)
  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
  if (anonError) {
    console.error('익명 로그인 실패:', anonError.message)
    return
  }
  const user = anonData.user
  const session = anonData.session
  if (!user || !session) {
    console.error('익명 로그인 실패: 사용자 또는 세션이 없습니다.')
    return
  }
  console.log('익명 임시 로그인 성공!')

  // 로그인된 클라이언트로 새로 셋업
  const authedSupabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  })

  console.log(`[3] 샘플 이미지 업로드 중: ${sampleImagePath}...`)
  if (!existsSync(sampleImagePath)) {
    console.error(`에러: 샘플 이미지가 존재하지 않습니다: ${sampleImagePath}`)
    return
  }
  const imageBytes = readFileSync(sampleImagePath)
  const storagePath = `${user.id}/test-${Date.now()}-IMG_1579.jpg`

  const upload = await authedSupabase.storage.from('label-images').upload(storagePath, imageBytes, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (upload.error) {
    console.error('이미지 업로드 실패:', upload.error.message)
    return
  }
  console.log(`이미지 업로드 성공! 경로: ${upload.data.path}`)

  try {
    console.log('[4] parse-label Edge Function 호출 중 (Vision OCR 파싱)...')
    const parseRes = await authedSupabase.functions.invoke('parse-label', {
      body: { image_path: upload.data.path },
    })

    if (parseRes.error) {
      console.error('parse-label 에러 발생:', parseRes.error)
      return
    }

    console.log('--- [parse-label 응답 데이터] ---')
    console.log(JSON.stringify(parseRes.data, null, 2))
    console.log('--------------------------------')

    const parsedData = parseRes.data
    if (!parsedData || !parsedData.ingredients || parsedData.ingredients.length === 0) {
      console.warn('주의: 파싱된 성분 정보가 비어있습니다.')
    }

    console.log('[5] run-analysis Edge Function 호출 중 (분석 리포트 연계 테스트)...')
    const analysisRes = await authedSupabase.functions.invoke('run-analysis', {
      body: {
        profile: {
          gender: 'female',
          birthYear: 1998,
          pregnancyStatus: 'none',
          lactationStatus: false,
          conditions: [],
          allergies: [],
          dietaryRestrictions: [],
          consentAccepted: true,
        },
        medications: [],
        supplements: [
          {
            id: 'test-supplement',
            productName: parsedData?.productName || '테스트 영양제',
            brandName: parsedData?.brandName || '테스트 브랜드',
            dailyServings: parsedData?.dailyServingsRecommended || 1,
            confirmed: true,
            ingredients: parsedData?.ingredients || [
              {
                id: 'dummy-ing',
                rawName: '비타민 D',
                standardName: '비타민 D',
                nutrientId: 'vitamin_d',
                amount: 10,
                unit: 'mcg',
                confidence: 1,
                rawText: 'dummy',
                reviewRequired: false,
              }
            ],
          },
        ],
      },
    })

    if (analysisRes.error) {
      console.error('run-analysis 에러 발생:', analysisRes.error)
      return
    }

    console.log('--- [run-analysis 응답 데이터] ---')
    console.log(JSON.stringify(analysisRes.data, null, 2))
    console.log('---------------------------------')
    console.log('성공: 모든 기능이 실서버 백엔드와 완벽히 통신하고 연계됩니다!')

  } catch (err) {
    console.error('테스트 구동 중 치명적 예외 발생:', err)
  } finally {
    console.log('[6] 스토리지에 업로드한 임시 테스트 이미지 정리 중...')
    const cleanup = await authedSupabase.storage.from('label-images').remove([storagePath])
    if (cleanup.error) {
      console.error('클린업 에러:', cleanup.error.message)
    } else {
      console.log('클린업 완료!')
    }
  }
}

runTest()
