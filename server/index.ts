import './env.js'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Request, Response, NextFunction } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool, ensureUser, id } from './db.js'
import { firebaseAuth } from './firebaseAdmin.js'
import { openaiChat } from './openai.js'
import { consumeExternalApiQuota, DAILY_EXTERNAL_API_LIMIT_MESSAGE } from './rateLimit.js'
import { mapExaSearchResults, refineProductNamesWithComet } from './exaSearch.js'
import { nutrients } from '../src/features/nutrition/nutritionData.js'
import { runAnalysis } from '../src/features/analysis/analysisEngine.js'
import { generateSchedule } from '../src/features/schedule/scheduleEngine.js'
import { INGREDIENT_UNITS } from '../src/types/index.js'
import type { AnalysisReport, Medication, ParsedIngredient, Profile, SupplementProduct, Unit } from '../src/types/index.js'

/** 인증 미들웨어를 통과한 요청. `req.user`에 Firebase 사용자 정보가 포함됩니다. */
type AuthedRequest = Request & {
  user: {
    uid: string
    email?: string
    name?: string
  }
}

/** 채팅 메시지 형식 */
type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// CORS는 모든 오리진 허용 (프론트엔드는 별도 도메인에 배포될 수 있음)
app.use(cors({ origin: true }))
app.use(express.json({ limit: '2mb' }))

/** req가 AuthedRequest 타입인지 확인하는 타입 가드 */
function isAuthed(req: Request): req is AuthedRequest {
  return 'user' in req
}

/**
 * Firebase ID 토큰을 검증하는 인증 미들웨어.
 * Authorization 헤더에서 Bearer 토큰을 추출하고, Firebase Admin SDK로 검증합니다.
 * 검증 성공 시 req.user에 사용자 정보를 설정하고 app_users 테이블에 upsert 합니다.
 */
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

/**
 * 인증이 필요한 비동기 라우트 핸들러를 래핑합니다.
 * 인증 미들웨어 다음에 사용되어 req가 항상 AuthedRequest로 들어오도록 보장합니다.
 * 핸들러에서 발생한 비동기 예외는 next(error)로 전파되어 Express 오류 핸들러로 전달됩니다.
 */
function asyncRoute(handler: (req: AuthedRequest, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthed(req)) {
      res.status(401).json({ error: '인증이 필요합니다.' })
      return
    }
    handler(req, res).catch(next)
  }
}

/**
 * 외부 API(OpenAI, Exa) 호출에 대한 일일 사용량 한도를 확인합니다.
 * 한도 초과 시 429 응답을 전송하고 false를 반환합니다.
 * 정상이면 호출량을 증가시키고 true를 반환합니다.
 */
async function enforceExternalApiQuota(req: AuthedRequest, res: Response): Promise<boolean> {
  if (await consumeExternalApiQuota(req.user.uid)) return true
  res.status(429).json({ error: DAILY_EXTERNAL_API_LIMIT_MESSAGE })
  return false
}

/**
 * JSON 컬럼에서 가져온 데이터를 안전하게 파싱합니다.
 * null/undefined이면 fallback을 반환하고,
 * 문자열이면 JSON.parse, 그 외에는 그대로 캐스팅합니다.
 */
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

/** MySQL boolean 값을 JavaScript boolean으로 변환 */
function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

/**
 * 원재료명을 표준 영양소명으로 정규화 매칭합니다.
 * nutrients 데이터베이스에서 표준명 정확 일치 또는 별칭 포함 여부로 검색합니다.
 * 매칭 실패 시에도 임시 NutrientId를 생성하여 반환합니다.
 */
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

/**
 * DB 조회 결과 행을 AnalysisReport 타입으로 변환합니다.
 * JSON 컬럼들은 parseJson으로 안전하게 파싱합니다.
 */
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

/**
 * 사용자의 등록된 영양제와 성분 정보를 조인하여 조회합니다.
 * app_user_supplements + app_supplement_products + app_supplement_ingredients 3-way join.
 * 활성(active=true) 영양제만 조회하며, 성분은 제품별로 그룹화됩니다.
 */
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
  // 제품별로 성분 그룹화
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

/**
 * 사용자 데이터를 일괄 조회합니다.
 * 프로필, 건강상태, 약물, 최신 분석 리포트, 영양제를 병렬 조회합니다.
 */
async function loadUserData(userId: string) {
  const [[profileRow], [conditionRows], [medicationRows], [reportRows], supplements] = await Promise.all([
    pool.query<RowDataPacket[]>('select * from app_user_profiles where user_id = ? limit 1', [userId]),
    pool.query<RowDataPacket[]>('select * from app_user_conditions where user_id = ? order by created_at asc', [userId]),
    pool.query<RowDataPacket[]>('select * from app_user_medications where user_id = ? order by created_at asc', [userId]),
    pool.query<RowDataPacket[]>('select * from app_analysis_reports where user_id = ? order by created_at desc limit 1', [userId]),
    loadSupplements(userId),
  ])

  const conditions = conditionRows as RowDataPacket[]
  // 건강상태, 알레르기, 식이제한은 condition_code 접두사로 구분
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

// 서버 상태 확인 (인증 불필요)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// /api 하위 모든 경로에 인증 미들웨어 적용
app.use('/api', authenticate)

// 사용자 데이터 일괄 조회
app.get('/api/user-data', asyncRoute(async (req, res) => {
  res.json(await loadUserData(req.user.uid))
}))

/**
 * 프로필 및 약물 저장.
 * 프로필 upsert → 기존 conditions/medications 삭제 후 재삽입을 단일 트랜잭션으로 처리합니다.
 */
app.post('/api/profile', asyncRoute(async (req, res) => {
  const { profile, medications } = req.body as { profile: Profile; medications: Medication[] }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    // 프로필 upsert
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

    // 기존 건강상태 삭제 후 재삽입
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

    // 기존 약물 삭제 후 재삽입
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

/**
 * 영양제 제품 + 성분 + 사용자 연결 저장.
 * 트랜잭션 내에서 supplement_products → supplement_ingredients → user_supplements 순으로 삽입합니다.
 */
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
          // 1일 총 섭취량 = 성분 함량 × 1일 복용 횟수
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

/**
 * 영양제 제품 정보 수정.
 * 제품명/브랜드는 supplement_products에서, 복용횟수/시간은 user_supplements에서 각각 수정합니다.
 */
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

/**
 * 영양제 성분 정보 배치 업데이트.
 * 여러 성분의 standardName/amount/unit을 한 번의 요청으로 수정합니다.
 */
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
        // amount 변경 시 1일 섭취량도 재계산
        ingredient.amount !== undefined ? (ingredient.amount ?? 0) * (dailyServings || 1) : null,
        ingredient.unit ?? null,
        ingredient.id,
        req.user.uid,
      ],
    )
  }
  res.json({ message: '성분 정보를 수정했습니다.' })
}))

/**
 * 영양제 제품 삭제.
 * CASCADE 제약조건으로 연관 성분 및 user_supplements도 자동 삭제됩니다.
 */
app.delete('/api/supplements/:id', asyncRoute(async (req, res) => {
  const [result] = await pool.execute<ResultSetHeader>(
    'delete from app_supplement_products where id = ? and owner_user_id = ?',
    [req.params.id, req.user.uid],
  )
  if (result.affectedRows === 0) throw new Error('제품 삭제에 실패했습니다.')
  res.json({ message: '제품을 삭제했습니다.' })
}))

/**
 * 분석 리포트 저장.
 * 클라이언트에서 계산된 분석 결과를 app_analysis_reports 테이블에 JSON 형식으로 저장합니다.
 */
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

/**
 * 복용 스케줄 생성.
 * 사용자의 영양제, 약물, 건강상태, 선호 시간을 기반으로 시간약리학적 복용 타임라인을 계산합니다.
 */
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

/**
 * 성분명 정제 API.
 * 서버 메모리 내 nutrients 데이터베이스로 표준명 매칭 후,
 * 각 성분의 효능, 권장량, 주의사항 정보를 기본값으로 채워 반환합니다.
 */
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
      // DB 매칭 성공 시 높은 신뢰도, 실패 시 낮은 신뢰도
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

/**
 * 영양제 라벨 이미지 업로드 및 Vision AI 파싱.
 * multipart/form-data로 이미지를 받아 base64로 변환 후 OpenAI Vision API로 성분표 데이터를 추출합니다.
 * 추출된 성분은 표준명 매칭(normalizeNutrientName)을 거쳐 응답됩니다.
 */
app.post('/api/parse-label', upload.single('image'), asyncRoute(async (req, res) => {
  if (!req.file) throw new Error('성분표 이미지 파일을 선택해야 AI 파싱을 실행할 수 있습니다.')
  if (!await enforceExternalApiQuota(req, res)) return
  const mimeType = req.file.mimetype || 'image/jpeg'
  const base64 = req.file.buffer.toString('base64')
  // OpenAI Structured Outputs JSON Schema 정의
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
            unit: { type: 'string', enum: INGREDIENT_UNITS },
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
      { role: 'system', content: 'Extract supplement label data into JSON only. Standardize ingredient names by removing extra compound details in parentheses where applicable (e.g. convert "Vitamin C (as Ascorbic Acid)" to "Vitamin C", "Calcium (as Calcium Carbonate)" to "Calcium") and normalize synonyms to commonly known clean names. This is not medical advice.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this supplement facts label and extract product name, daily serving recommendation, ingredient names, amounts, units, confidence, and raw text. Standardize the ingredient names into clean, common names (e.g. "Vitamin C" instead of "Vitamin C (Ascorbic Acid)") to ensure maximum match efficiency.' },
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
        // 매칭 실패, 낮은 신뢰도, unknown 단위면 검수 필요
        reviewRequired: !nutrient.matched || ingredient.confidence < 0.8 || ingredient.unit === 'unknown',
      }
    }),
    warnings: parsed.warnings ?? [],
  })
}))

/**
 * Exa.ai 웹 검색 API.
 * 제품명을 쿼리로 Exa.ai 검색을 실행하고, 결과에서 성분 정보를 추출합니다.
 * Comet API를 통해 제품명을 추가로 정제합니다 (실패 시 원본 이름 유지).
 */
app.post('/api/exa-search', asyncRoute(async (req, res) => {
  const { query } = req.body as { query: string }
  if (!query?.trim()) {
    res.status(400).json({ error: '검색어를 입력해주세요.' })
    return
  }
  const exaApiKey = process.env.EXA_API_KEY
  if (!exaApiKey) throw new Error('EXA_API_KEY가 설정되지 않았습니다.')
  if (!await enforceExternalApiQuota(req, res)) return
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': exaApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, type: 'auto', numResults: 5, contents: { text: true } }),
  })
  if (!response.ok) throw new Error(`Exa API 요청에 실패했습니다: ${await response.text()}`)
  const payload = await response.json() as { results?: Array<{ title?: string; url?: string; text?: string | string[] }> }
  const products = mapExaSearchResults(payload.results)
  try {
    res.json({ products: await refineProductNamesWithComet(query, products) })
  } catch (error) {
    console.warn('Comet product name cleanup failed:', error)
    res.json({ products })
  }
}))

/**
 * AI 채팅 시스템 프롬프트 빌더.
 * 사용자 컨텍스트(프로필, 약물, 영양제, 분석 결과)를 JSON으로 포함하고,
 * 한국어 응답, 의학 면책, 전문가 상담 권장 등의 응답 지침을 포함합니다.
 */
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

// 채팅 세션 목록 조회
app.get('/api/chat/sessions', asyncRoute(async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select
       cs.id,
       cs.title,
       count(cm.id) as message_count,
       max(cm.created_at) as last_message_at
     from app_chat_sessions cs
     left join app_chat_messages cm on cm.session_id = cs.id
     where cs.user_id = ?
     group by cs.id, cs.title, cs.created_at, cs.updated_at
     order by coalesce(max(cm.created_at), cs.updated_at, cs.created_at) desc`,
    [req.user.uid],
  )
  res.json(rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    messageCount: Number(row.message_count ?? 0),
    lastMessageAt: row.last_message_at ? new Date(String(row.last_message_at)).toISOString() : null,
    active: false,
  })))
}))

// 새 채팅 세션 생성
app.post('/api/chat/sessions', asyncRoute(async (req, res) => {
  const title = String((req.body as { title?: string }).title ?? '새 대화').slice(0, 100)
  const sessionId = id('chat')
  await pool.execute('insert into app_chat_sessions (id, user_id, title) values (?, ?, ?)', [sessionId, req.user.uid, title])
  res.json({ id: sessionId, title })
}))

// 채팅 세션 제목 수정
app.patch('/api/chat/sessions/:id', asyncRoute(async (req, res) => {
  const title = String((req.body as { title?: string }).title ?? '새 대화').slice(0, 100)
  await pool.execute('update app_chat_sessions set title = ? where id = ? and user_id = ?', [title, req.params.id, req.user.uid])
  res.json({ message: 'updated' })
}))

// 세션별 채팅 메시지 내역 조회
app.get('/api/chat/sessions/:id/messages', asyncRoute(async (req, res) => {
  const [sessionRows] = await pool.query<RowDataPacket[]>(
    'select id from app_chat_sessions where id = ? and user_id = ? limit 1',
    [req.params.id, req.user.uid],
  )
  if (sessionRows.length === 0) {
    res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다.' })
    return
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `select role, content
     from app_chat_messages
     where session_id = ? and role in ('user', 'assistant')
     order by created_at asc, id asc`,
    [req.params.id],
  )
  res.json(rows.map((row) => ({ role: String(row.role), content: String(row.content) })))
}))

/**
 * AI 채팅 완성 (SSE 스트리밍).
 * OpenAI Chat Completion API를 스트리밍 모드로 호출하고
 * 응답을 SSE(text/event-stream)로 클라이언트에 실시간 전달합니다.
 * 전체 응답이 완료되면 assistant 메시지를 DB에 저장합니다.
 */
app.post('/api/chat/completion', asyncRoute(async (req, res) => {
  const { sessionId, message, context } = req.body as { sessionId?: string; message: string; context: Record<string, unknown> }
  if (!message?.trim()) {
    res.status(400).json({ error: '메시지를 입력해주세요.' })
    return
  }
  if (!await enforceExternalApiQuota(req, res)) {
    return
  }

  // 세션이 없으면 자동 생성
  let sessionIdToUse = sessionId
  if (!sessionIdToUse) {
    sessionIdToUse = id('chat')
    await pool.execute('insert into app_chat_sessions (id, user_id, title) values (?, ?, ?)', [sessionIdToUse, req.user.uid, message.slice(0, 100)])
  } else {
    // 기존 세션 존재 여부 확인
    const [sessionRows] = await pool.query<RowDataPacket[]>('select id from app_chat_sessions where id = ? and user_id = ? limit 1', [sessionIdToUse, req.user.uid])
    if (sessionRows.length === 0) {
      res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다.' })
      return
    }
  }

  // 사용자 메시지 저장
  await pool.execute('insert into app_chat_messages (id, session_id, role, content) values (?, ?, ?, ?)', [id('message'), sessionIdToUse, 'user', message])
  await pool.execute('update app_chat_sessions set updated_at = current_timestamp where id = ? and user_id = ?', [sessionIdToUse, req.user.uid])
  // 최근 40개 메시지를 컨텍스트로 로드
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

  // SSE 응답 헤더 설정
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
    // 스트리밍 청크 읽기
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      res.write(text) // 원본 SSE 청크를 클라이언트에 그대로 전달
      buffer += text
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      // SSE 청크에서 content delta 추출하여 전체 응답 누적
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
    // 응답 완료 후 assistant 메시지 저장
    if (assistantContent) {
      await pool.execute('insert into app_chat_messages (id, session_id, role, content) values (?, ?, ?, ?)', [id('message'), sessionIdToUse, 'assistant', assistantContent])
      await pool.execute('update app_chat_sessions set updated_at = current_timestamp where id = ? and user_id = ?', [sessionIdToUse, req.user.uid])
    }
    res.end()
  }
}))

// 404 - 등록되지 않은 API 경로
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API 경로를 찾을 수 없습니다.' })
})

// Express 전역 오류 핸들러 - 모든 미처리 예외를 500으로 변환
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' })
})

// Vercel이 아닌 경우(로컬 개발/운영)에만 정적 파일 서빙 및 서버 리스닝
if (process.env.VERCEL !== '1') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distDir = path.resolve(__dirname, '../dist')
  // 빌드된 React SPA 정적 파일 서빙
  app.use(express.static(distDir))
  // SPA 폴백 - 모든 GET 요청을 index.html로 리다이렉트
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  const port = Number(process.env.PORT ?? 8787)
  app.listen(port, () => {
    console.log(`tt-ni API server listening on http://localhost:${port}`)
  })
}

export default app
