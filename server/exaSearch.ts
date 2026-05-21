import { cometChat } from './openai.js'

/** Exa.ai 검색 결과 항목 */
type ExaResult = {
  title?: string
  url?: string
  text?: string | string[]
}

/** 검색 결과에서 추출한 영양제 제품 정보 */
export type ExaSearchProduct = {
  name: string
  brand: string
  ingredients: Array<{ name: string; amount: number; unit: string }>
  sourceUrl: string
}

/** Comet API 채팅 완성 응답 타입 */
type ChatCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>
}

/**
 * 웹 검색 텍스트에서 추출할 영양소 패턴 정의.
 * 각 영양소별로 정규식 패턴 배열을 갖고, 검색 결과 텍스트의 각 줄에서 매칭 시도.
 */
const nutrientPatterns = [
  { name: 'Vitamin A', patterns: [/vitamin\s*a/i, /retinol/i, /beta[-\s]?carotene/i] },
  { name: 'Vitamin B1', patterns: [/vitamin\s*b1/i, /thiamine/i] },
  { name: 'Vitamin B6', patterns: [/vitamin\s*b6/i, /pyridoxine/i] },
  { name: 'Vitamin B12', patterns: [/vitamin\s*b12/i, /cobalamin/i] },
  { name: 'Vitamin C', patterns: [/vitamin\s*c/i, /ascorbic\s*acid/i] },
  { name: 'Vitamin D', patterns: [/vitamin\s*d/i, /d3/i, /cholecalciferol/i] },
  { name: 'Calcium', patterns: [/calcium/i, /\bca\b/i] },
  { name: 'Magnesium', patterns: [/magnesium/i] },
  { name: 'Zinc', patterns: [/zinc/i, /\bzn\b/i] },
  { name: 'Iron', patterns: [/iron/i, /\bfe\b/i] },
  { name: 'Omega-3', patterns: [/omega[\s-]*3/i, /epa/i, /dha/i] },
]

/** 단위 문자열을 표준 단위 코드로 정규화 (μg → mcg 등) */
function normalizeUnit(unit: string) {
  const lower = unit.toLowerCase()
  if (lower === 'μg') return 'mcg'
  if (lower === 'iu') return 'IU'
  if (lower === 'cfu') return 'CFU'
  return lower
}

/** 제품명에서 마켓플레이스 이름(Amazon, iHerb 등) 및 불필요한 접미사 제거 */
function cleanProductName(title: string) {
  return title
    .replace(/\s*[-–|]\s*(Amazon\.com|Walmart|iHerb|Target|eBay).*/i, '')
    .replace(/\s*\|.*$/, '')
    .trim()
}

/** 검색 결과의 text 필드를 문자열로 변환 (배열인 경우 줄바꿈으로 결합) */
function resultText(text: ExaResult['text']) {
  if (Array.isArray(text)) return text.join('\n')
  return text ?? ''
}

/**
 * 검색 결과 텍스트에서 영양소 성분을 추출합니다.
 * 각 줄에서 "{숫자} {단위}" 패턴을 찾고,
 * 줄의 앞부분에서 영양소 패턴과 매칭되는 성분을 추출합니다.
 * 중복 성분(동일 영양소+함량+단위)은 제거됩니다.
 */
export function extractIngredients(text: string) {
  const ingredients: Array<{ name: string; amount: number; unit: string }> = []
  const seen = new Set<string>()
  for (const line of text.split(/[.\n]+/)) {
    const unitMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(mcg|mg|g|IU|CFU|μg)/i)
    if (!unitMatch) continue
    const amount = parseFloat(unitMatch[1].replace(/,/g, ''))
    const unit = normalizeUnit(unitMatch[2])
    const beforeAmount = line.substring(0, unitMatch.index).toLowerCase()
    for (const nutrient of nutrientPatterns) {
      if (!nutrient.patterns.some((pattern) => pattern.test(beforeAmount))) continue
      const key = `${nutrient.name}:${amount}:${unit}`
      if (!seen.has(key)) {
        seen.add(key)
        ingredients.push({ name: nutrient.name, amount, unit })
      }
      break
    }
  }
  return ingredients
}

/**
 * Exa.ai 검색 결과를 영양제 제품 목록으로 변환합니다.
 * 각 결과에서 제품명 정리, 성분 추출을 수행하고,
 * 성분이 1개 이상 감지된 제품만 필터링합니다.
 */
export function mapExaSearchResults(results: ExaResult[] = []) {
  return results
    .map((result) => ({
      name: cleanProductName(result.title ?? ''),
      brand: '',
      ingredients: extractIngredients(resultText(result.text)),
      sourceUrl: result.url ?? '',
    }))
    .filter((product) => product.name && product.ingredients.length > 0)
}

/** Comet API 응답에서 JSON 객체를 안전하게 파싱합니다. 정규 파싱 실패 시 중괄호 범위로 재시도. */
function parseJsonObject(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return undefined
    try {
      return JSON.parse(match[0])
    } catch {
      return undefined
    }
  }
}

/**
 * Comet API 응답에서 제품명 정제 결과 맵을 추출합니다.
 * 응답 형식: {"products": [{"index": 0, "name": "정제된 제품명"}, ...]}
 * index → name 매핑을 반환합니다.
 */
export function refinedNameMap(content: string): Map<number, string> {
  const parsed = parseJsonObject(content) as { products?: Array<{ index?: unknown; name?: unknown }> } | undefined
  const names = new Map<number, string>()
  for (const product of parsed?.products ?? []) {
    const index = Number(product.index)
    const name = typeof product.name === 'string' ? product.name.trim() : ''
    if (Number.isInteger(index) && name) names.set(index, name)
  }
  return names
}

/**
 * Comet API로 검색 결과 제품명을 정제합니다.
 * 마켓플레이스 이름 제거, SEO 접미사 제거, 중복 단어 정리 등을 LLM이 수행합니다.
 * @returns 정제된 제품명이 반영된 제품 목록 (LLM 실패 시 원본 그대로 반환)
 */
export async function refineProductNamesWithComet(
  query: string,
  products: ExaSearchProduct[],
  chatCompletion: typeof cometChat = cometChat,
): Promise<ExaSearchProduct[]> {
  if (products.length === 0) return products
  const response = await chatCompletion({
    model: process.env.COMETAPI_MODEL ?? process.env.OPENAI_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-5-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You clean dietary supplement product names for a Korean supplement tracking app.',
          'Return JSON only with shape {"products":[{"index":0,"name":"clean product name"}]}.',
          'Preserve the actual product identity. Remove marketplace names, page labels, SEO suffixes, duplicated words, and irrelevant dosage facts.',
          'Do not invent brand names or ingredients. If uncertain, return the original product name cleaned only lightly.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          query,
          products: products.map((product, index) => ({
            index,
            name: product.name,
            sourceUrl: product.sourceUrl,
            ingredients: product.ingredients.map((ingredient) => ingredient.name),
          })),
        }),
      },
    ],
  })
  const payload = await response.json() as ChatCompletion
  const names = refinedNameMap(payload.choices?.[0]?.message?.content ?? '')
  return products.map((product, index) => ({
    ...product,
    name: names.get(index) ?? product.name,
  }))
}
