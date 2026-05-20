import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type Unit = 'mg' | 'mcg' | 'IU' | 'g' | 'CFU' | 'unknown'

interface IngredientOutput {
  name: string
  amount: number | null
  unit: Unit
  confidence: number
  raw_text: string
}

interface ParseOutput {
  product_name: string | null
  serving_size: { amount: number | null; unit: string | null }
  daily_servings_recommended: number | null
  ingredients: IngredientOutput[]
  warnings: string[]
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product_name: { type: ['string', 'null'] },
    serving_size: {
      type: 'object',
      additionalProperties: false,
      properties: {
        amount: { type: ['number', 'null'] },
        unit: { type: ['string', 'null'] },
      },
      required: ['amount', 'unit'],
    },
    daily_servings_recommended: { type: ['number', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          amount: { type: ['number', 'null'] },
          unit: { type: 'string', enum: ['mg', 'mcg', 'IU', 'g', 'CFU', 'unknown'] },
          confidence: { type: 'number' },
          raw_text: { type: 'string' },
        },
        required: ['name', 'amount', 'unit', 'confidence', 'raw_text'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['product_name', 'serving_size', 'daily_servings_recommended', 'ingredients', 'warnings'],
}

/** 정규화된 영양소 별칭 매칭을 위한 내부 DB (프론트엔드 nutritionData.ts와 동기화 필요) */
const nutrientAliases = [
  { id: 'vitamin_a', name: '비타민 A', aliases: ['vitamin a', 'retinol', '레티놀', '베타카로틴'] },
  { id: 'vitamin_b1', name: '비타민 B1', aliases: ['b1', 'thiamine', '티아민'] },
  { id: 'vitamin_b6', name: '비타민 B6', aliases: ['b6', 'pyridoxine', '피리독신'] },
  { id: 'vitamin_b12', name: '비타민 B12', aliases: ['b12', 'cobalamin', '코발라민'] },
  { id: 'vitamin_c', name: '비타민 C', aliases: ['vitamin c', 'ascorbic acid', '아스코르브산'] },
  { id: 'vitamin_d', name: '비타민 D', aliases: ['vitamin d', 'd3', 'cholecalciferol', '콜레칼시페롤'] },
  { id: 'vitamin_e', name: '비타민 E', aliases: ['vitamin e', 'tocopherol', '토코페롤'] },
  { id: 'vitamin_k', name: '비타민 K', aliases: ['vitamin k', 'k1', 'k2', 'phylloquinone', 'menaquinone'] },
  { id: 'calcium', name: '칼슘', aliases: ['calcium', 'ca', '칼슘'] },
  { id: 'magnesium', name: '마그네슘', aliases: ['magnesium', '마그네슘'] },
  { id: 'zinc', name: '아연', aliases: ['zinc', 'zn', '아연'] },
  { id: 'iron', name: '철분', aliases: ['iron', 'fe', '철'] },
  { id: 'omega3', name: '오메가3', aliases: ['omega 3', 'omega-3', 'epa', 'dha', '오메가'] },
]

/**
 * 성분명을 정규화하여 표준 영양소 ID와 이름으로 매핑합니다.
 * 미매칭 시 원본명을 snake_case ID로 변환하여 반환합니다.
 */
function normalizeNutrient(name: string): { id: string; name: string; matched: boolean } {
  const normalized = name.toLowerCase()
  const nutrient = nutrientAliases.find((item) =>
    item.name.toLowerCase() === normalized || item.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
  )
  if (!nutrient) return { id: normalized.replaceAll(/\s+/g, '_'), name, matched: false }
  return { id: nutrient.id, name: nutrient.name, matched: true }
}

/**
 * Supabase Service Role Key를 환경변수에서 가져옵니다.
 * 우선순위: TT_NI_SERVICE_ROLE_KEY > SUPABASE_SERVICE_ROLE_KEY > SUPABASE_SECRET_KEYS
 */
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

/** OpenAI Responses API 출력에서 구조화된 텍스트를 추출합니다. */
function getOutputText(payload: { choices?: Array<{ message?: { content?: string } }> }): string {
  const text = payload.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI response did not include structured output text')
  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    // --- 인증 및 요청 검증 ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Authorization header is required' }, 401)

    const { image_path } = await req.json() as { image_path?: string }
    if (!image_path) return jsonResponse({ error: 'image_path is required' }, 400)

    // --- Supabase & OpenAI 클라이언트 초기화 ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')
    if (!openaiKey) throw new Error('OPENAI_API_KEY is required')

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })

    // --- 사용자 인증 및 이미지 소유권 확인 ---
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonResponse({ error: 'Invalid user session' }, 401)
    if (!image_path.startsWith(`${userData.user.id}/`)) return jsonResponse({ error: 'Image path does not belong to this user' }, 403)

    // --- Storage에서 이미지 다운로드 및 Base64 인코딩 ---
    const { data: imageBlob, error: downloadError } = await supabase.storage.from('label-images').download(image_path)
    if (downloadError) throw downloadError

    const bytes = new Uint8Array(await imageBlob.arrayBuffer())
    const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
    const base64 = btoa(binary)
    const mimeType = imageBlob.type || 'image/jpeg'

    // --- OpenAI Vision API 호출 (JSON Schema 기반 구조화 출력) ---
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_VISION_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract supplement label data into JSON only. Return low confidence for unclear, cropped, or ambiguous rows. This is not medical advice.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Read this supplement facts or nutrition label. Extract product name, serving size, daily serving recommendation, ingredient names, amounts, units, confidence, and raw text.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'supplement_label_parse',
            strict: true,
            schema,
          },
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`OpenAI request failed: ${detail}`)
    }

    const payload = await response.json()
    const parsed = JSON.parse(getOutputText(payload)) as ParseOutput

    // --- 성분명 정규화 및 표준 영양소 ID 매핑 ---
    const normalized = {
      productName: parsed.product_name,
      servingSize: parsed.serving_size,
      dailyServingsRecommended: parsed.daily_servings_recommended,
      ingredients: parsed.ingredients.map((ingredient) => {
        const nutrient = normalizeNutrient(ingredient.name)
        return {
          id: crypto.randomUUID(),
          rawName: ingredient.name,
          standardName: nutrient.name,
          nutrientId: nutrient.id,
          amount: ingredient.amount,
          unit: ingredient.unit,
          confidence: ingredient.confidence,
          rawText: ingredient.raw_text,
          reviewRequired: !nutrient.matched || ingredient.confidence < 0.8 || ingredient.unit === 'unknown',
        }
      }),
      warnings: parsed.warnings,
    }

    await supabase.from('label_parse_jobs').insert({
      user_id: userData.user.id,
      image_path,
      status: 'review',
      raw_gpt_json: parsed,
    })

    return jsonResponse(normalized)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected parse error' }, 500)
  }
})
