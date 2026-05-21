type ExaResult = {
  title?: string
  url?: string
  text?: string | string[]
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
