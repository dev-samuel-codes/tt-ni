import './env.ts'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Request, Response, NextFunction } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool, ensureUser, id } from './db.ts'
import { firebaseAuth } from './firebaseAdmin.ts'
import { openaiChat } from './openai.ts'
import { nutrients } from '../src/features/nutrition/nutritionData.ts'
import { runAnalysis } from '../src/features/analysis/analysisEngine.ts'
import { generateSchedule } from '../src/features/schedule/scheduleEngine.ts'
import type { AnalysisReport, Medication, ParsedIngredient, Profile, SupplementProduct, Unit } from '../src/types/index.ts'

type AuthedRequest = Request & {
  user: {
    uid: string
    email?: string
    name?: string
  }
}

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

app.use(cors({ origin: true }))
app.use(express.json({ limit: '2mb' }))

function isAuthed(req: Request): req is AuthedRequest {
  return 'user' in req
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      res.status(401).json({ error: '인증 토큰이 필요합니다.' })
      return
    }
    const decoded = await firebaseAuth.verifyIdToken(token)
    const user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    }
    ;(req as AuthedRequest).user = user
    await ensureUser(user)
    next()
  } catch {
    res.status(401).json({ error: 'Firebase 인증 세션을 확인할 수 없습니다.' })
  }
}

function asyncRoute(handler: (req: AuthedRequest, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthed(req)) {
      res.status(401).json({ error: '인증이 필요합니다.' })
      return
    }
    handler(req, res).catch(next)
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

function normalizeNutrientName(name: string) {
  const normalized = name.trim().toLowerCase()
  const nutrient = nutrients.find((item) =>
    item.standardName.toLowerCase() === normalized ||
    item.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  )
  if (!nutrient) {
    return {
      id: normalized.replaceAll(/\s+/g, '_'),
      standardName: name,
      matched: false,
      unit: 'mg' as Unit,
    }
  }
  return {
    id: nutrient.id,
    standardName: nutrient.standardName,
    matched: true,
    unit: nutrient.defaultUnit,
  }
}

function mapReport(row: RowDataPacket | undefined): AnalysisReport | null {
  if (!row) return null
  return {
    id: String(row.id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    statusSummary: parseJson(row.status_summary_json, { normal: 0, deficient: 0, caution: 0, excess: 0, review: 0 }),
    totals: parseJson(row.total_nutrients_json, []),
    duplicateItems: parseJson(row.duplicate_items_json, []),
    interactionWarnings: parseJson(row.interaction_warnings_json, []),
    recommendations: parseJson(row.recommendations_json, []),
    synergyRecommendations: parseJson(row.synergy_recommendations_json, []),
    antagonismWarnings: parseJson(row.antagonism_warnings_json, []),
  }
}

async function loadSupplements(userId: string): Promise<SupplementProduct[]> {
  const [productRows] = await pool.query<RowDataPacket[]>(
    `select
       p.id, p.product_name, p.brand_name, p.source_type, p.label_image_path,
       us.daily_servings, us.intake_time
     from app_user_supplements us
     join app_supplement_products p on p.id = us.product_id
     where us.user_id = ? and us.active = true
     order by us.created_at asc`,
    [userId],
  )
  if (productRows.length === 0) return []

  const productIds = productRows.map((row) => String(row.id))
  const placeholders = productIds.map(() => '?').join(',')
  const [ingredientRows] = await pool.query<RowDataPacket[]>(
    `select * from app_supplement_ingredients where product_id in (${placeholders}) order by created_at asc`,
    productIds,
  )
  const ingredientsByProduct = new Map<string, ParsedIngredient[]>()
  for (const row of ingredientRows) {
    const productId = String(row.product_id)
    const items = ingredientsByProduct.get(productId) ?? []
    items.push({
      id: String(row.id),
      rawName: String(row.raw_name ?? ''),
      standardName: String(row.standard_name ?? ''),
      nutrientId: String(row.nutrient_id ?? ''),
      amount: row.amount === null ? null : Number(row.amount),
      unit: String(row.unit ?? 'mg') as Unit,
      confidence: Number(row.confidence ?? 1),
      rawText: String(row.raw_name ?? ''),
      reviewRequired: toBool(row.review_required),
    })
    ingredientsByProduct.set(productId, items)
  }

  return productRows.map((row) => ({
    id: String(row.id),
    productName: String(row.product_name),
    brandName: String(row.brand_name ?? ''),
    sourceType: String(row.source_type ?? 'manual') as SupplementProduct['sourceType'],
    dailyServings: Number(row.daily_servings ?? 1),
    intakeTime: String(row.intake_time ?? ''),
    imageName: row.label_image_path ? String(row.label_image_path) : undefined,
    ingredients: ingredientsByProduct.get(String(row.id)) ?? [],
    confirmed: true,
  }))
}

async function loadUserData(userId: string) {
  const [[profileRow], [conditionRows], [medicationRows], [reportRows], supplements] = await Promise.all([
    pool.query<RowDataPacket[]>('select * from app_user_profiles where user_id = ? limit 1', [userId]),
    pool.query<RowDataPacket[]>('select * from app_user_conditions where user_id = ? order by created_at asc', [userId]),
    pool.query<RowDataPacket[]>('select * from app_user_medications where user_id = ? order by created_at asc', [userId]),
    pool.query<RowDataPacket[]>('select * from app_analysis_reports where user_id = ? order by created_at desc limit 1', [userId]),
    loadSupplements(userId),
  ])

  const conditions = conditionRows as RowDataPacket[]
  const profile = profileRow[0] ? {
    gender: String(profileRow[0].gender) as Profile['gender'],
    birthYear: Number(profileRow[0].birth_year),
    heightCm: profileRow[0].height_cm === null ? undefined : Number(profileRow[0].height_cm),
    weightKg: profileRow[0].weight_kg === null ? undefined : Number(profileRow[0].weight_kg),
    pregnancyStatus: String(profileRow[0].pregnancy_status ?? 'none') as Profile['pregnancyStatus'],
    lactationStatus: toBool(profileRow[0].lactation_status),
    consentAccepted: toBool(profileRow[0].consent_accepted),
    conditions: conditions.filter((item) => !String(item.condition_code).startsWith('allergy:') && !String(item.condition_code).startsWith('diet:')).map((item) => String(item.condition_name)),
    allergies: conditions.filter((item) => String(item.condition_code).startsWith('allergy:')).map((item) => String(item.condition_name)),
    dietaryRestrictions: conditions.filter((item) => String(item.condition_code).startsWith('diet:')).map((item) => String(item.condition_name)),
  } satisfies Profile : null

  const medications = (medicationRows as RowDataPacket[]).map((row) => ({
    id: String(row.id),
    name: String(row.medication_name),
    purpose: String(row.dosage_text ?? ''),
    frequency: String(row.frequency ?? ''),
    memo: String(row.memo ?? ''),
  } satisfies Medication))

  return {
    profile,
    medications,
    supplements,
    report: mapReport((reportRows as RowDataPacket[])[0]),
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', authenticate)

app.get('/api/user-data', asyncRoute(async (req, res) => {
  res.json(await loadUserData(req.user.uid))
}))

app.post('/api/profile', asyncRoute(async (req, res) => {
  const { profile, medications } = req.body as { profile: Profile; medications: Medication[] }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      `insert into app_user_profiles
        (user_id, gender, birth_year, height_cm, weight_kg, pregnancy_status, lactation_status, consent_accepted)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on duplicate key update
        gender = values(gender),
        birth_year = values(birth_year),
        height_cm = values(height_cm),
        weight_kg = values(weight_kg),
        pregnancy_status = values(pregnancy_status),
        lactation_status = values(lactation_status),
        consent_accepted = values(consent_accepted)`,
      [
        req.user.uid,
        profile.gender,
        profile.birthYear,
        profile.heightCm ?? null,
        profile.weightKg ?? null,
        profile.pregnancyStatus,
        profile.lactationStatus,
        profile.consentAccepted,
      ],
    )

    await connection.execute('delete from app_user_conditions where user_id = ?', [req.user.uid])
    const conditionRows = [
      ...profile.conditions.map((name) => ({ code: name.toLowerCase(), name, severity: 'notice' })),
      ...profile.allergies.map((name) => ({ code: `allergy:${name.toLowerCase()}`, name, severity: 'caution' })),
      ...profile.dietaryRestrictions.map((name) => ({ code: `diet:${name.toLowerCase()}`, name, severity: 'notice' })),
    ]
    for (const row of conditionRows) {
      await connection.execute(
        'insert into app_user_conditions (id, user_id, condition_code, condition_name, severity) values (?, ?, ?, ?, ?)',
        [id('condition'), req.user.uid, row.code, row.name, row.severity],
      )
    }

    await connection.execute('delete from app_user_medications where user_id = ?', [req.user.uid])
    for (const medication of medications) {
      if (!medication.name.trim()) continue
      await connection.execute(
        'insert into app_user_medications (id, user_id, medication_name, dosage_text, frequency, memo) values (?, ?, ?, ?, ?, ?)',
        [id('med'), req.user.uid, medication.name, medication.purpose, medication.frequency, medication.memo],
      )
    }
    await connection.commit()
    res.json({ message: '프로필과 복용 정보를 저장했습니다.' })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}))

app.post('/api/supplements', asyncRoute(async (req, res) => {
  const { supplement, labelImagePath } = req.body as { supplement: SupplementProduct; labelImagePath?: string }
  if (!supplement.productName?.trim()) throw new Error('제품명이 없습니다.')
  if (!supplement.ingredients?.length) throw new Error('저장할 성분이 없습니다.')

  const productId = id('product')
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      `insert into app_supplement_products
       (id, owner_user_id, product_name, brand_name, source_type, label_image_path)
       values (?, ?, ?, ?, ?, ?)`,
      [productId, req.user.uid, supplement.productName, supplement.brandName || null, labelImagePath ? 'photo' : 'manual', labelImagePath || null],
    )
    for (const ingredient of supplement.ingredients) {
      await connection.execute(
        `insert into app_supplement_ingredients
         (id, product_id, nutrient_id, raw_name, standard_name, amount, unit, amount_per_daily_serving, confidence, review_required)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id('ingredient'),
          productId,
          ingredient.nutrientId || null,
          ingredient.rawName || ingredient.standardName || '',
          ingredient.standardName || '',
          ingredient.amount,
          ingredient.unit || 'mg',
          ingredient.amount !== null ? ingredient.amount * (supplement.dailyServings || 1) : null,
          ingredient.confidence ?? 1,
          ingredient.reviewRequired ?? false,
        ],
      )
    }
    await connection.execute(
      `insert into app_user_supplements (id, user_id, product_id, daily_servings, intake_time, active)
       values (?, ?, ?, ?, ?, true)`,
      [id('user_supplement'), req.user.uid, productId, supplement.dailyServings || 1, supplement.intakeTime || null],
    )
    await connection.commit()
    res.json({ productId, message: '제품과 성분 정보를 저장했습니다.' })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}))

app.patch('/api/supplements/:id', asyncRoute(async (req, res) => {
  const productId = req.params.id
  const patch = req.body as Partial<Pick<SupplementProduct, 'productName' | 'brandName' | 'dailyServings' | 'intakeTime'>>
  const [productUpdate] = await pool.execute<ResultSetHeader>(
    `update app_supplement_products
     set product_name = coalesce(?, product_name), brand_name = coalesce(?, brand_name)
     where id = ? and owner_user_id = ?`,
    [patch.productName ?? null, patch.brandName ?? null, productId, req.user.uid],
  )
  if (productUpdate.affectedRows === 0) throw new Error('제품 정보 수정에 실패했습니다.')

  if (patch.dailyServings !== undefined || patch.intakeTime !== undefined) {
    await pool.execute(
      `update app_user_supplements
       set daily_servings = coalesce(?, daily_servings), intake_time = coalesce(?, intake_time)
       where product_id = ? and user_id = ?`,
      [patch.dailyServings ?? null, patch.intakeTime ?? null, productId, req.user.uid],
    )
  }
  res.json({ message: '제품 정보를 수정했습니다.' })
}))

app.post('/api/supplements/ingredients', asyncRoute(async (req, res) => {
  const { ingredients, dailyServings } = req.body as {
    ingredients: Array<{ id: string; standardName?: string; amount?: number | null; unit?: string }>
    dailyServings?: number
  }
  for (const ingredient of ingredients) {
    await pool.execute(
      `update app_supplement_ingredients si
       join app_supplement_products sp on sp.id = si.product_id
       set
         si.standard_name = coalesce(?, si.standard_name),
         si.amount = ?,
         si.amount_per_daily_serving = ?,
         si.unit = coalesce(?, si.unit)
       where si.id = ? and sp.owner_user_id = ?`,
      [
        ingredient.standardName ?? null,
        ingredient.amount ?? null,
        ingredient.amount !== undefined ? (ingredient.amount ?? 0) * (dailyServings || 1) : null,
        ingredient.unit ?? null,
        ingredient.id,
        req.user.uid,
      ],
    )
  }
  res.json({ message: '성분 정보를 수정했습니다.' })
}))

app.delete('/api/supplements/:id', asyncRoute(async (req, res) => {
  const [result] = await pool.execute<ResultSetHeader>(
    'delete from app_supplement_products where id = ? and owner_user_id = ?',
    [req.params.id, req.user.uid],
  )
  if (result.affectedRows === 0) throw new Error('제품 삭제에 실패했습니다.')
  res.json({ message: '제품을 삭제했습니다.' })
}))

app.post('/api/analysis', asyncRoute(async (req, res) => {
  const body = req.body as { profile?: Profile; medications?: Medication[]; supplements?: SupplementProduct[]; report?: AnalysisReport }
  const report = body.report ?? runAnalysis(body.profile!, body.medications ?? [], body.supplements ?? [])
  const reportId = id('report')
  await pool.execute(
    `insert into app_analysis_reports
     (id, user_id, status_summary_json, total_nutrients_json, duplicate_items_json, interaction_warnings_json, recommendations_json, synergy_recommendations_json, antagonism_warnings_json)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reportId,
      req.user.uid,
      JSON.stringify(report.statusSummary),
      JSON.stringify(report.totals),
      JSON.stringify(report.duplicateItems),
      JSON.stringify(report.interactionWarnings),
      JSON.stringify(report.recommendations),
      JSON.stringify(report.synergyRecommendations),
      JSON.stringify(report.antagonismWarnings),
    ],
  )
  res.json({ ...report, id: reportId, createdAt: new Date().toISOString() })
}))

app.post('/api/generate-schedule', asyncRoute(async (req, res) => {
  const body = req.body as {
    profile: Profile
    supplements: SupplementProduct[]
    medications: Medication[]
    preferences?: { wakeTime?: string; mealTimes?: string[] }
  }
  const timeline = generateSchedule({
    supplements: body.supplements.map((supplement) => ({
      id: supplement.id,
      productName: supplement.productName,
      dailyServings: supplement.dailyServings,
      ingredients: supplement.ingredients.map((ingredient) => ({
        nutrientId: ingredient.nutrientId,
        standardName: ingredient.standardName,
        amount: ingredient.amount ?? 0,
        unit: ingredient.unit,
      })),
    })),
    medications: body.medications.map((medication) => ({ name: medication.name, memo: medication.memo })),
    conditions: body.profile.conditions,
    preferences: body.preferences ?? {},
  })
  res.json({ timeline })
}))

app.post('/api/refine-ingredients', asyncRoute(async (req, res) => {
  const { productName, brandName, ingredients } = req.body as {
    productName: string
    brandName?: string
    ingredients: Array<{ name: string; amount?: number | null; unit?: string }>
  }
  const refined: ParsedIngredient[] = ingredients.map((ingredient) => {
    const nutrient = normalizeNutrientName(ingredient.name)
    return {
      id: id('ingredient'),
      rawName: ingredient.name,
      standardName: nutrient.standardName,
      nutrientId: nutrient.id,
      amount: ingredient.amount ?? null,
      unit: (ingredient.unit || nutrient.unit) as Unit,
      confidence: nutrient.matched ? 0.95 : 0.5,
      rawText: ingredient.name,
      reviewRequired: !nutrient.matched,
      benefit: nutrient.matched ? `${nutrient.standardName} 관련 일반 영양 기능을 지원합니다.` : '',
      recommendedDaily: '',
      caution: '',
    }
  })
  res.json({
    productName,
    brandName: brandName || '',
    ingredients: refined,
    summary: `${productName}에서 ${refined.length}개의 영양성분을 분석했습니다.`,
  })
}))

app.post('/api/parse-label', upload.single('image'), asyncRoute(async (req, res) => {
  if (!req.file) throw new Error('성분표 이미지 파일을 선택해야 AI 파싱을 실행할 수 있습니다.')
  const mimeType = req.file.mimetype || 'image/jpeg'
  const base64 = req.file.buffer.toString('base64')
  const schema = {
    type: 'object',
    properties: {
      product_name: { type: ['string', 'null'] },
      daily_servings_recommended: { type: ['number', 'null'] },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: ['number', 'null'] },
            unit: { type: 'string', enum: ['mg', 'mcg', 'IU', 'g', 'CFU', 'unknown'] },
            confidence: { type: 'number' },
            raw_text: { type: 'string' },
          },
          required: ['name', 'amount', 'unit', 'confidence', 'raw_text'],
          additionalProperties: false,
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['product_name', 'daily_servings_recommended', 'ingredients', 'warnings'],
    additionalProperties: false,
  }
  const response = await openaiChat({
    model: process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5-mini',
    messages: [
      { role: 'system', content: 'Extract supplement label data into JSON only. This is not medical advice.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this supplement facts label and extract product name, daily serving recommendation, ingredient names, amounts, units, confidence, and raw text.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'supplement_label_parse', strict: true, schema } },
  })
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as {
    product_name?: string | null
    daily_servings_recommended?: number | null
    ingredients?: Array<{ name: string; amount: number | null; unit: Unit; confidence: number; raw_text: string }>
    warnings?: string[]
  }
  res.json({
    imageName: req.file.originalname,
    labelImagePath: req.file.originalname,
    productName: parsed.product_name ?? undefined,
    dailyServingsRecommended: parsed.daily_servings_recommended ?? undefined,
    ingredients: (parsed.ingredients ?? []).map((ingredient) => {
      const nutrient = normalizeNutrientName(ingredient.name)
      return {
        id: id('ingredient'),
        rawName: ingredient.name,
        standardName: nutrient.standardName,
        nutrientId: nutrient.id,
        amount: ingredient.amount,
        unit: ingredient.unit,
        confidence: ingredient.confidence,
        rawText: ingredient.raw_text,
        reviewRequired: !nutrient.matched || ingredient.confidence < 0.8 || ingredient.unit === 'unknown',
      }
    }),
    warnings: parsed.warnings ?? [],
  })
}))

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

function extractIngredients(text: string) {
  const ingredients: Array<{ name: string; amount: number; unit: string }> = []
  const seen = new Set<string>()
  for (const line of text.split(/[.\n]+/)) {
    const unitMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(mcg|mg|g|IU|CFU|μg)/i)
    if (!unitMatch) continue
    const amount = parseFloat(unitMatch[1].replace(/,/g, ''))
    const unit = unitMatch[2].toLowerCase() === 'μg' ? 'mcg' : unitMatch[2]
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

app.post('/api/exa-search', asyncRoute(async (req, res) => {
  const { query } = req.body as { query: string }
  const exaApiKey = process.env.EXA_API_KEY
  if (!exaApiKey) throw new Error('EXA_API_KEY가 설정되지 않았습니다.')
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': exaApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, type: 'auto', numResults: 5, contents: { text: true } }),
  })
  if (!response.ok) throw new Error(`Exa API 요청에 실패했습니다: ${await response.text()}`)
  const payload = await response.json() as { results?: Array<{ title: string; url: string; text?: string }> }
  res.json({
    products: (payload.results ?? []).map((result) => ({
      name: result.title.replace(/\s*[-–|]\s*(Amazon\.com|Walmart|iHerb|Target|eBay).*/i, '').replace(/\s*\|.*$/, '').trim(),
      brand: '',
      ingredients: extractIngredients(result.text ?? ''),
      sourceUrl: result.url,
    })),
  })
}))

function buildSystemPrompt(context: Record<string, unknown>): string {
  return `당신은 영양제 및 건강 보조제에 관한 정보를 제공하는 AI 어시스턴트입니다.

[의료 면책 조항]
모든 정보는 일반적인 건강 정보이며 의학적 조언, 진단 또는 치료를 대체할 수 없습니다. 복용 변경 전 의사 또는 약사와 상담하도록 안내하세요.

[사용자 컨텍스트]
${JSON.stringify(context)}

[응답 지침]
- 한국어로 답변하세요.
- 사용자의 프로필, 복용 약물, 등록 영양제, 최신 분석 결과를 고려하세요.
- 과잉, 결핍, 약물 상호작용 가능성이 있으면 먼저 경고하세요.
- 단정적인 표현은 피하고 전문가 상담이 필요한 경우 명확히 안내하세요.`
}

async function chatRateLimit(userId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select count(*) as count
     from app_chat_messages cm
     join app_chat_sessions cs on cs.id = cm.session_id
     where cs.user_id = ? and cm.role = 'user' and cm.created_at >= current_date()`,
    [userId],
  )
  return Number(rows[0]?.count ?? 0) < 50
}

app.get('/api/chat/sessions', asyncRoute(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'select id, title from app_chat_sessions where user_id = ? order by updated_at desc',
    [req.user.uid],
  )
  res.json(rows.map((row) => ({ id: String(row.id), title: String(row.title), active: false })))
}))

app.post('/api/chat/sessions', asyncRoute(async (req, res) => {
  const title = String((req.body as { title?: string }).title ?? '새 대화').slice(0, 100)
  const sessionId = id('chat')
  await pool.execute('insert into app_chat_sessions (id, user_id, title) values (?, ?, ?)', [sessionId, req.user.uid, title])
  res.json({ id: sessionId, title })
}))

app.patch('/api/chat/sessions/:id', asyncRoute(async (req, res) => {
  const title = String((req.body as { title?: string }).title ?? '새 대화').slice(0, 100)
  await pool.execute('update app_chat_sessions set title = ? where id = ? and user_id = ?', [title, req.params.id, req.user.uid])
  res.json({ message: 'updated' })
}))

app.get('/api/chat/sessions/:id/messages', asyncRoute(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select cm.role, cm.content
     from app_chat_messages cm
     join app_chat_sessions cs on cs.id = cm.session_id
     where cm.session_id = ? and cs.user_id = ?
     order by cm.created_at asc`,
    [req.params.id, req.user.uid],
  )
  res.json(rows.map((row) => ({ role: row.role, content: row.content })))
}))

app.post('/api/chat/completion', asyncRoute(async (req, res) => {
  const { sessionId, message, context } = req.body as { sessionId?: string; message: string; context: Record<string, unknown> }
  if (!message?.trim()) {
    res.status(400).json({ error: '메시지를 입력해주세요.' })
    return
  }
  if (!await chatRateLimit(req.user.uid)) {
    res.status(429).json({ error: '일일 메시지 한도를 초과했습니다. 내일 다시 이용해주세요.' })
    return
  }

  let sessionIdToUse = sessionId
  if (!sessionIdToUse) {
    sessionIdToUse = id('chat')
    await pool.execute('insert into app_chat_sessions (id, user_id, title) values (?, ?, ?)', [sessionIdToUse, req.user.uid, message.slice(0, 100)])
  } else {
    const [sessionRows] = await pool.query<RowDataPacket[]>('select id from app_chat_sessions where id = ? and user_id = ? limit 1', [sessionIdToUse, req.user.uid])
    if (sessionRows.length === 0) {
      res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다.' })
      return
    }
  }

  await pool.execute('insert into app_chat_messages (id, session_id, role, content) values (?, ?, ?, ?)', [id('message'), sessionIdToUse, 'user', message])
  const [historyRows] = await pool.query<RowDataPacket[]>('select role, content from app_chat_messages where session_id = ? order by created_at asc limit 40', [sessionIdToUse])
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...historyRows.map((row) => ({ role: String(row.role) as ChatMessage['role'], content: String(row.content) })),
  ]
  const aiResponse = await openaiChat({
    model: process.env.OPENAI_CHAT_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5-mini',
    messages,
    stream: true,
  })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Chat-Session-Id', sessionIdToUse)

  const reader = aiResponse.body?.getReader()
  if (!reader) throw new Error('AI 응답 스트림을 열 수 없습니다.')
  const decoder = new TextDecoder()
  let assistantContent = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      res.write(text)
      buffer += text
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ') || line.startsWith('data: [DONE]')) continue
        try {
          const parsed = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: string } }> }
          assistantContent += parsed.choices?.[0]?.delta?.content ?? ''
        } catch {
          // Ignore malformed stream fragments.
        }
      }
    }
  } finally {
    if (assistantContent) {
      await pool.execute('insert into app_chat_messages (id, session_id, role, content) values (?, ?, ?, ?)', [id('message'), sessionIdToUse, 'assistant', assistantContent])
    }
    res.end()
  }
}))

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' })
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
app.use(express.static(distDir))
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => {
  console.log(`tt-ni API server listening on http://localhost:${port}`)
})
