import { cometChat } from './openai.js'

type ExaResult = {
  title?: string
  url?: string
  text?: string | string[]
}

export type ExaSearchProduct = {
  name: string
  brand: string
  ingredients: Array<{ name: string; amount: number; unit: string }>
  sourceUrl: string
}

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>
}

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

function normalizeUnit(unit: string) {
  const lower = unit.toLowerCase()
  if (lower === 'μg') return 'mcg'
  if (lower === 'iu') return 'IU'
  if (lower === 'cfu') return 'CFU'
  return lower
}

function cleanProductName(title: string) {
  return title
    .replace(/\s*[-–|]\s*(Amazon\.com|Walmart|iHerb|Target|eBay).*/i, '')
    .replace(/\s*\|.*$/, '')
    .trim()
}

function resultText(text: ExaResult['text']) {
  if (Array.isArray(text)) return text.join('\n')
  return text ?? ''
}

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
