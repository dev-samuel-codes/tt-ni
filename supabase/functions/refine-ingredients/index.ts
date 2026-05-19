import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

interface RawIngredient {
  name: string
  amount?: number | null
  unit?: string
}

interface RefineRequest {
  productName: string
  brandName?: string
  ingredients: RawIngredient[]
}

interface RefinedIngredient {
  id: string
  rawName: string
  standardName: string
  nutrientId: string
  amount: number | null
  unit: string
  confidence: number
  rawText: string
  reviewRequired: boolean
  benefit: string
  recommendedDaily: string
  caution: string
}

interface RefineResponse {
  productName: string
  brandName: string
  ingredients: RefinedIngredient[]
  summary: string
}

/**
 * 내장 영양소 데이터베이스
 * DB에서 직접 매칭 가능한 영양소들의 표준 정보(별칭, 단위, 권장량, 효능)를 정의합니다.
 * 매칭되지 않은 성분은 LLM을 통해 보강 분석됩니다.
 */
const nutrientDatabase = [
  { id: 'vitamin_a', name: '비타민 A', aliases: ['vitamin a', 'retinol', '레티놀', '베타카로틴', 'beta carotene', '비타민a'], unit: 'mcg', rda: '700-900mcg', benefit: '시력 유지, 면역 기능, 피부 건강' },
  { id: 'vitamin_b1', name: '비타민 B1', aliases: ['b1', 'thiamine', '티아민', '비타민b1'], unit: 'mg', rda: '1.1-1.2mg', benefit: '에너지 대사, 신경 기능 유지' },
  { id: 'vitamin_b2', name: '비타민 B2', aliases: ['b2', 'riboflavin', '리보플라avin', '비타민b2'], unit: 'mg', rda: '1.1-1.3mg', benefit: '에너지 대사, 피부·점막 건강' },
  { id: 'vitamin_b6', name: '비타민 B6', aliases: ['b6', 'pyridoxine', '피리독신', '비타민b6'], unit: 'mg', rda: '1.3-1.7mg', benefit: '단백질 대사, 신경 기능, 면역 기능' },
  { id: 'vitamin_b12', name: '비타민 B12', aliases: ['b12', 'cobalamin', '코발라민', '비타민b12'], unit: 'mcg', rda: '2.4mcg', benefit: '혈액 생성, 신경 기능, DNA 합성' },
  { id: 'vitamin_c', name: '비타민 C', aliases: ['vitamin c', 'ascorbic acid', '아스코르브산', '비타민c'], unit: 'mg', rda: '75-90mg', benefit: '항산화, 콜라겐 합성, 철분 흡수 촉진, 면역 기능' },
  { id: 'vitamin_d', name: '비타민 D', aliases: ['vitamin d', 'd3', 'cholecalciferol', '콜레칼시페롤', '비타민d'], unit: 'mcg', rda: '15-20mcg', benefit: '칼슘 흡수, 뼈 건강, 면역 기능' },
  { id: 'vitamin_e', name: '비타민 E', aliases: ['vitamin e', 'tocopherol', '토코페롤', '비타민e'], unit: 'mg', rda: '15mg', benefit: '항산화, 세포막 보호, 피부 건강' },
  { id: 'vitamin_k', name: '비타민 K', aliases: ['vitamin k', 'k1', 'k2', 'phylloquinone', 'menaquinone', '비타민k'], unit: 'mcg', rda: '90-120mcg', benefit: '혈액 응고, 뼈 건강' },
  { id: 'calcium', name: '칼슘', aliases: ['calcium', 'ca', '칼슘'], unit: 'mg', rda: '1000-1200mg', benefit: '뼈·치아 형성, 근육 수축, 신경 전달' },
  { id: 'magnesium', name: '마그네슘', aliases: ['magnesium', '마그네슘'], unit: 'mg', rda: '320-420mg', benefit: '근육·신경 기능, 에너지 대사, 뼈 건강' },
  { id: 'zinc', name: '아연', aliases: ['zinc', 'zn', '아연'], unit: 'mg', rda: '8-11mg', benefit: '면역 기능, 상처 치유, 미각·후각 유지' },
  { id: 'iron', name: '철분', aliases: ['iron', 'fe', '철', '철분'], unit: 'mg', rda: '8-18mg', benefit: '산소 운반, 에너지 대사, 혈액 생성' },
  { id: 'omega3', name: '오메가3', aliases: ['omega 3', 'omega-3', 'epa', 'dha', '오메가', '오메가3'], unit: 'mg', rda: '1100mg', benefit: '심혈관 건강, 뇌 기능, 항염' },
  { id: 'choline', name: '콜린', aliases: ['choline', '콜린'], unit: 'mg', rda: '425-550mg', benefit: '간 기능, 뇌 기능, 세포막 구성' },
  { id: 'ginseng', name: '홍삼', aliases: ['ginseng', 'red ginseng', '홍삼', '인삼', '진세노사이드', 'ginsenoside'], unit: 'mg', rda: '상품별 상이', benefit: '면역력 증진, 피로 개선, 혈행 개선' },
  { id: 'coq10', name: '코엔자임 Q10', aliases: ['coq10', '코엔자임', '코엔자임큐텐', 'ubiquinone', '유비퀴논'], unit: 'mg', rda: '100-200mg', benefit: '에너지 생산, 항산화, 심장 건강' },
  { id: 'probiotics', name: '유산균', aliases: ['probiotics', '프로바이오틱스', '유산균', 'lactobacillus'], unit: 'CFU', rda: '10억-100억 CFU', benefit: '장 건강, 면역 기능, 소화 개선' },
  { id: 'catechin', name: '카테킨', aliases: ['catechin', 'catechins', '카테킨', 'egcg', '녹차추출물', 'green tea extract'], unit: 'mg', rda: '250-500mg', benefit: '항산화, 체지방 감소, 혈중 콜레스테롤 개선' },
  { id: 'corosolic_acid', name: '코로솔산', aliases: ['corosolic acid', '코로솔산', '바나바잎', 'banaba', 'banaba leaf'], unit: 'mg', rda: '10-50mg', benefit: '혈당 조절, 인슐린 감수성 개선' },
  { id: 'lutein', name: '루테인', aliases: ['lutein', '루테인', '지아잔틴', 'zeaxanthin'], unit: 'mg', rda: '10-20mg', benefit: '눈 건강, 황반 보호, 항산화' },
  { id: 'collagen', name: '콜라겐', aliases: ['collagen', '콜라겐', 'hydrolyzed collagen', '가수분해콜라겐'], unit: 'mg', rda: '2.5-10g', benefit: '피부 탄력, 관절 건강, 뼈 건강' },
  { id: 'glucosamine', name: '글루코사민', aliases: ['glucosamine', '글루코사민'], unit: 'mg', rda: '1500mg', benefit: '관절 건강, 연골 보호' },
  { id: 'selenium', name: '셀레늄', aliases: ['selenium', '셀레늄', 'se'], unit: 'mcg', rda: '55mcg', benefit: '항산화, 갑상선 기능, 면역 기능' },
  { id: 'iodine', name: '요오드', aliases: ['iodine', '요오드', 'iodine'], unit: 'mcg', rda: '150mcg', benefit: '갑상선 호르몬 합성, 대사 조절' },
  { id: 'folate', name: '엽산', aliases: ['folate', 'folic acid', '엽산', '폴산'], unit: 'mcg', rda: '400mcg', benefit: 'DNA 합성, 태아 발달, 혈액 생성' },
  { id: 'niacin', name: '나이아신', aliases: ['niacin', 'b3', '나이아신', 'nicotinic acid'], unit: 'mg', rda: '14-16mg', benefit: '에너지 대사, 피부 건강, 신경 기능' },
  { id: 'biotin', name: '비오틴', aliases: ['biotin', 'b7', '비오틴', '비타민h'], unit: 'mcg', rda: '30mcg', benefit: '모발·피부·손톱 건강, 에너지 대사' },
  { id: 'pantothenic_acid', name: '판토텐산', aliases: ['pantothenic acid', 'b5', '판토텐산'], unit: 'mg', rda: '5mg', benefit: '에너지 대사, 호르몬 합성' },
  { id: 'chromium', name: '크롬', aliases: ['chromium', '크롬', 'cr'], unit: 'mcg', rda: '25-35mcg', benefit: '혈당 조절, 인슐린 기능' },
  { id: 'manganese', name: '망간', aliases: ['manganese', '망간', 'mn'], unit: 'mg', rda: '1.8-2.3mg', benefit: '뼈 형성, 대사, 항산화' },
  { id: 'copper', name: '구리', aliases: ['copper', '구리', 'cu'], unit: 'mg', rda: '0.9mg', benefit: '철분 대사, 결합 조직 형성, 면역' },
  { id: 'phosphorus', name: '인', aliases: ['phosphorus', '인', 'p'], unit: 'mg', rda: '700mg', benefit: '뼈·치아 형성, 에너지 대사' },
  { id: 'potassium', name: '칼륨', aliases: ['potassium', '칼륨', 'k'], unit: 'mg', rda: '2600-3400mg', benefit: '혈압 조절, 근육·신경 기능' },
  { id: 'sodium', name: '나트륨', aliases: ['sodium', '나트륨', 'na'], unit: 'mg', rda: '1500mg 이하', benefit: '수분 균형, 신경 전달' },
  { id: 'ashwagandha', name: '아슈와간다', aliases: ['ashwagandha', '아슈와간다', '위타니아'], unit: 'mg', rda: '300-600mg', benefit: '스트레스 감소, 활력 증진, 수면 개선' },
  { id: 'turmeric', name: '강황/커큐민', aliases: ['turmeric', 'curcumin', '강황', '커큐민'], unit: 'mg', rda: '500-2000mg', benefit: '항염, 항산화, 관절 건강' },
  { id: 'milk_thistle', name: '밀크씨슬', aliases: ['milk thistle', 'silymarin', '밀크씨슬', '실리마린'], unit: 'mg', rda: '200-420mg', benefit: '간 건강, 간 해독, 항산화' },
  { id: 'berberine', name: '베르베린', aliases: ['berberine', '베르베린'], unit: 'mg', rda: '500-1500mg', benefit: '혈당 조절, 콜레스테롤 개선, 장 건강' },
  { id: 'spirulina', name: '스피루리나', aliases: ['spirulina', '스피루리나'], unit: 'mg', rda: '1-8g', benefit: '단백질 공급, 항산화, 면역 기능' },
  { id: 'l_arginine', name: 'L-아르기닌', aliases: ['l-arginine', '아르기닌', 'arginine'], unit: 'mg', rda: '3-6g', benefit: '혈관 확장, 혈액 순환, 운동 수행' },
  { id: 'l_theanine', name: 'L-테아닌', aliases: ['l-theanine', '테아닌', 'theanine'], unit: 'mg', rda: '100-400mg', benefit: '이완, 집중력 향상, 수면 질 개선' },
  { id: 'melatonin', name: '멜라토닌', aliases: ['melatonin', '멜라토닌'], unit: 'mg', rda: '0.5-5mg', benefit: '수면 리듬 조절, 시차 적응' },
  { id: 'glutathione', name: '글루타치온', aliases: ['glutathione', '글루타치온', 'gsh'], unit: 'mg', rda: '250-500mg', benefit: '강력한 항산화, 해독, 면역 기능' },
  { id: 'resveratrol', name: '레스베라트롤', aliases: ['resveratrol', '레스베라트롤'], unit: 'mg', rda: '150-500mg', benefit: '항산화, 심혈관 건강, 노화 방지' },
  { id: 'quercetin', name: '케르세틴', aliases: ['quercetin', '케르세틴'], unit: 'mg', rda: '500-1000mg', benefit: '항염, 항히스타민, 항산화' },
]

/**
 * 성분명을 정규화하여 내장 DB에서 매칭합니다.
 * 정확 일치 또는 별칭 포함 여부로 검색하며, 매칭 실패 시 원본명을 snake_case ID로 반환합니다.
 */
function normalizeNutrient(name: string): { id: string; standardName: string; matched: boolean; benefit: string; recommendedDaily: string } {
  const normalized = name.trim().toLowerCase()
  const nutrient = nutrientDatabase.find((item) =>
    item.name.toLowerCase() === normalized || item.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
  )
  if (!nutrient) {
    return { id: normalized.replaceAll(/\s+/g, '_'), standardName: name, matched: false, benefit: '', recommendedDaily: '' }
  }
  return { id: nutrient.id, standardName: nutrient.name, matched: true, benefit: nutrient.benefit, recommendedDaily: nutrient.rda }
}

function getServiceKey(): string {
  const projectKey = Deno.env.get('TT_NI_SERVICE_ROLE_KEY')
  if (projectKey) return projectKey
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const secrets = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secrets) throw new Error('TT_NI_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SECRET_KEYS is required')
  const parsed = JSON.parse(secrets) as Record<string, string>
  const first = Object.values(parsed)[0]
  if (!first) throw new Error('No Supabase secret key was found')
  return first
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Authorization header is required' }, 401)

    const { productName, brandName, ingredients } = await req.json() as RefineRequest
    if (!productName) return jsonResponse({ error: 'productName is required' }, 400)
    if (!ingredients || ingredients.length === 0) return jsonResponse({ error: 'ingredients array is required' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonResponse({ error: 'Invalid user session' }, 401)

    const usageDate = new Date().toISOString().split('T')[0]
    const { data: usageData } = await supabase
      .from('api_usage')
      .select('call_count')
      .eq('user_id', userData.user.id)
      .eq('usage_date', usageDate)
      .eq('api_type', 'refine')
      .single()

    const dailyLimit = 50
    if (usageData && usageData.call_count >= dailyLimit) {
      return jsonResponse({
        error: 'DAILY_LIMIT_EXCEEDED',
        message: '일일 API 호출 한도를 초과했습니다. 내일 다시 시도해주세요.',
        limit: dailyLimit,
        used: usageData.call_count,
      }, 429)
    }

    // --- 1차: 내장 DB에서 매칭되는 성분은 바로 정제 ---
    const refinedFromDb: RefinedIngredient[] = []
    const needsLlmRefine: RawIngredient[] = []

    for (const ing of ingredients) {
      const nutrient = normalizeNutrient(ing.name)
      if (nutrient.matched) {
        refinedFromDb.push({
          id: crypto.randomUUID(),
          rawName: ing.name,
          standardName: nutrient.standardName,
          nutrientId: nutrient.id,
          amount: ing.amount ?? null,
          unit: ing.unit || nutrientDatabase.find((n) => n.id === nutrient.id)?.unit || 'mg',
          confidence: 0.95,
          rawText: ing.name,
          reviewRequired: false,
          benefit: nutrient.benefit,
          recommendedDaily: nutrient.recommendedDaily,
          caution: '',
        })
      } else {
        needsLlmRefine.push(ing)
      }
    }

    // --- 2차: 내장 DB에 없는 성분은 OpenAI LLM으로 분석 ---
    let llmRefined: RefinedIngredient[] = []
    if (openaiKey && needsLlmRefine.length > 0) {
      const llmInput = needsLlmRefine.map((ing) => `- ${ing.name}${ing.amount ? `: ${ing.amount}${ing.unit || ''}` : ''}`).join('\n')

      const systemPrompt = `You are a nutritionist and supplement expert. Given a list of supplement ingredients, provide detailed information for each.

For each ingredient, return:
1. standardName: Standard Korean name for the nutrient
2. nutrientId: A snake_case ID (e.g., "catechin", "corosolic_acid")
3. amount: The typical recommended daily amount in mg if not provided, or the provided amount
4. unit: The standard unit (mg, mcg, IU, g, CFU)
5. confidence: 0.0-1.0 confidence score
6. benefit: Health benefits in Korean (1-2 sentences)
7. recommendedDaily: Recommended daily intake string
8. caution: Any important cautions in Korean (empty string if none)

Known nutrients in database: ${nutrientDatabase.map((n) => n.name).join(', ')}

Return JSON array only. Be precise with amounts and units.`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `다음 영양성분들을 분석해주세요:\n${llmInput}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      })

      if (response.ok) {
        const llmData = await response.json()
        const content = llmData.choices?.[0]?.message?.content
        if (content) {
          try {
            const parsed = JSON.parse(content)
            const items = parsed.ingredients || parsed.items || parsed
            if (Array.isArray(items)) {
              llmRefined = items.map((item: Record<string, unknown>, index: number) => ({
                id: crypto.randomUUID(),
                rawName: needsLlmRefine[index]?.name || (item.standardName as string),
                standardName: (item.standardName as string) || needsLlmRefine[index]?.name || '',
                nutrientId: (item.nutrientId as string) || (item.standardName as string || '').toLowerCase().replaceAll(/\s+/g, '_'),
                amount: (item.amount as number) ?? needsLlmRefine[index]?.amount ?? null,
                unit: (item.unit as string) || 'mg',
                confidence: (item.confidence as number) ?? 0.7,
                rawText: needsLlmRefine[index]?.name || '',
                reviewRequired: true,
                benefit: (item.benefit as string) || '',
                recommendedDaily: (item.recommendedDaily as string) || '',
                caution: (item.caution as string) || '',
              }))
            }
          } catch {
            // JSON parsing failed, use raw data
          }
        }
      }
    }

    // --- 3차: LLM 분석 실패 시 원본 데이터로 폴백 ---
    if (needsLlmRefine.length > 0 && llmRefined.length === 0) {
      for (const ing of needsLlmRefine) {
        llmRefined.push({
          id: crypto.randomUUID(),
          rawName: ing.name,
          standardName: ing.name,
          nutrientId: ing.name.toLowerCase().replaceAll(/\s+/g, '_'),
          amount: ing.amount ?? null,
          unit: ing.unit || 'mg',
          confidence: 0.5,
          rawText: ing.name,
          reviewRequired: true,
          benefit: '',
          recommendedDaily: '',
          caution: '',
        })
      }
    }

    const allIngredients = [...refinedFromDb, ...llmRefined]

    await supabase.from('api_usage').upsert({
      user_id: userData.user.id,
      usage_date: usageDate,
      api_type: 'refine',
      call_count: (usageData?.call_count ?? 0) + 1,
    }, { onConflict: 'user_id,usage_date,api_type' })

    const response: RefineResponse = {
      productName,
      brandName: brandName || '',
      ingredients: allIngredients,
      summary: allIngredients.length > 0
        ? `${productName}에서 ${allIngredients.length}개의 영양성분을 분석했습니다.`
        : '영양성분을 찾을 수 없습니다.',
    }

    return jsonResponse(response)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
