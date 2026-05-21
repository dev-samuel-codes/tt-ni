import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts'
import { consumeApiUsage, dailyLimitPayload } from '../_shared/rateLimit.ts'

/** Exa.ai 검색 요청 */
interface ExaSearchRequest {
  query: string
}

interface ExaSearchResult {
  title: string
  url: string
  text: string
  author?: string
}

interface ExaSearchResponse {
  results: ExaSearchResult[]
}

interface Ingredient {
  name: string
  amount: number
  unit: string
}

interface Product {
  name: string
  brand: string
  ingredients: Ingredient[]
  sourceUrl: string
}

const DAILY_EXA_SEARCH_LIMIT = 30

/** 영양소명 패턴 매칭을 위한 정규식 (웹 페이지 텍스트에서 함량 정보 추출) */
const nutrientPatterns = [
  { name: 'Vitamin A', patterns: [/vitamin\s*a/i, /retinol/i, /beta[-\s]?carotene/i] },
  { name: 'Vitamin B1', patterns: [/vitamin\s*b1/i, /thiamine/i] },
  { name: 'Vitamin B6', patterns: [/vitamin\s*b6/i, /pyridoxine/i] },
  { name: 'Vitamin B12', patterns: [/vitamin\s*b12/i, /cobalamin/i] },
  { name: 'Vitamin C', patterns: [/vitamin\s*c/i, /ascorbic\s*acid/i] },
  { name: 'Vitamin D', patterns: [/vitamin\s*d/i, /d3/i, /cholecalciferol/i] },
  { name: 'Vitamin E', patterns: [/vitamin\s*e/i, /tocopherol/i] },
  { name: 'Vitamin K', patterns: [/vitamin\s*k/i, /phylloquinone/i, /menaquinone/i] },
  { name: 'Calcium', patterns: [/calcium/i, /\bca\b/i] },
  { name: 'Magnesium', patterns: [/magnesium/i] },
  { name: 'Zinc', patterns: [/zinc/i, /\bzn\b/i] },
  { name: 'Iron', patterns: [/iron/i, /\bfe\b/i] },
  { name: 'Omega-3', patterns: [/omega[\s-]*3/i, /epa/i, /dha/i] },
]

/** 알려진 영양제 브랜드명 (검색 결과에서 브랜드명 추출용) */
const brandPatterns = [
  'Nature Made', "Nature's Bounty", 'NOW Foods', 'Garden of Life',
  'Thorne', 'Pure Encapsulations', 'Solgar', 'Jarrow Formulas',
  "Doctor's Best", 'Life Extension', 'Kirkland Signature', 'Centrum',
  'One A Day', 'Optimum Nutrition', 'MegaFood', 'New Chapter',
  'Source Naturals', 'Solaray', 'Swanson', 'Carlson Labs',
  '종근당', '녹십자', '대웅제약', '유한양행', '한미약품',
  '일동제약', '동아제약', '광동제약', '한독', '일양약품',
  '안국건강', '뉴트리원', '내츄럴플러스', '에스더포뮬러',
  '비타민하우스', 'GNM 자연의품격', '닥터스베스트', '뉴트리코어',
  '고려은단', 'JW중외제약', '셀트리온', '삼성제약',
  '솔가', '네이처메이드', '센트룸', '센트럼',
  '스완슨', '닥터스 초이스', '라이프익스텐션', '뉴트라라이프',
  '닥터에스더', '닥터린', '뉴트리코스트', '캘리포니아골드뉴트리션',
]

/**
 * 웹 페이지 텍스트에서 영양성분 정보를 추출합니다.
 * "수치 + 단위(mcg/mg/g/IU/CFU)" 패턴을 찾고, 단위 앞의 텍스트가 알려진 영양소명과 매칭되면 추출합니다.
 * 중복 추출을 방지하기 위해 Set으로 관리합니다.
 */
function extractIngredients(text: string): Ingredient[] {
  const ingredients: Ingredient[] = []
  const seen = new Set<string>()

  const lines = text.split(/[.\n]+/)

  for (const line of lines) {
    const unitMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(mcg|mg|g|IU|CFU|μg)/i)
    if (!unitMatch) continue

    const amount = parseFloat(unitMatch[1].replace(/,/g, ''))
    const unit = unitMatch[2].toLowerCase() === 'μg' ? 'mcg' : unitMatch[2].toLowerCase()

    const beforeAmount = line.substring(0, unitMatch.index).toLowerCase()

    for (const nutrient of nutrientPatterns) {
      if (nutrient.patterns.some((p) => p.test(beforeAmount))) {
        const key = `${nutrient.name}:${amount}:${unit}`
        if (!seen.has(key)) {
          seen.add(key)
          ingredients.push({ name: nutrient.name, amount, unit })
        }
        break
      }
    }
  }

  return ingredients
}

/** 검색 결과 텍스트와 제목에서 브랜드명을 추출합니다. 미발견 시 빈 문자열 반환. */
function extractBrand(text: string, title: string): string {
  const combined = `${title} ${text}`
  for (const brand of brandPatterns) {
    if (combined.toLowerCase().includes(brand.toLowerCase())) {
      return brand
    }
  }
  return ''
}

/** 검색 결과 제목에서 이커머스 접미사(Amazon.com, Walmart 등)를 제거하여 제품명을 정제합니다. */
function extractProductName(result: ExaSearchResult): string {
  let name = result.title
    .replace(/\s*[-–|]\s*(Amazon\.com|Walmart|iHerb|Target|eBay).*/i, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s*[-–]\s*$/, '')
    .trim()

  if (name.length < 3 && result.text) {
    const firstLine = result.text.split(/[.\n]/)[0]
    if (firstLine) name = firstLine.trim().substring(0, 100)
  }

  return name || result.title
}

function mapResult(result: ExaSearchResult): Product {
  const name = extractProductName(result)
  const brand = extractBrand(result.text, result.title)
  const ingredients = extractIngredients(result.text)
  return { name, brand, ingredients, sourceUrl: result.url }
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse(req, { error: 'Authorization header is required' }, 401)

    const { query } = await req.json() as ExaSearchRequest
    if (!query || typeof query !== 'string') return jsonResponse(req, { error: 'query is required' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const exaApiKey = Deno.env.get('EXA_API_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')
    if (!exaApiKey) throw new Error('EXA_API_KEY is required')

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonResponse(req, { error: 'Invalid user session' }, 401)

    const usage = await consumeApiUsage(supabase, userData.user.id, 'exa_search', DAILY_EXA_SEARCH_LIMIT)
    if (!usage.allowed) return jsonResponse(req, dailyLimitPayload(usage), 429)

    const searchResponse = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': exaApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: 5,
        contents: { text: true },
      }),
    })

    if (!searchResponse.ok) {
      const detail = await searchResponse.text()
      throw new Error(`Exa API request failed: ${detail}`)
    }

    const searchData = await searchResponse.json() as ExaSearchResponse
    const products = (searchData.results ?? []).map(mapResult)

    return jsonResponse(req, { products })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected search error' }, 500)
  }
})
