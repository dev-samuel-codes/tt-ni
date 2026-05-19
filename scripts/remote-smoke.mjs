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

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const env = readEnv('.env.local')
const qaFile = process.env.TT_NI_QA_FILE
const qa = qaFile ? JSON.parse(readFileSync(qaFile, 'utf8')) : {}
const supabaseUrl = requireValue(env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL')
const publishableKey = requireValue(env.VITE_SUPABASE_PUBLISHABLE_KEY, 'VITE_SUPABASE_PUBLISHABLE_KEY')
const email = requireValue(process.env.TT_NI_QA_EMAIL ?? qa.email, 'TT_NI_QA_EMAIL')
const password = requireValue(process.env.TT_NI_QA_PASSWORD ?? qa.password, 'TT_NI_QA_PASSWORD')
const labelImage = requireValue(process.env.TT_NI_LABEL_IMAGE ?? qa.labelImage, 'TT_NI_LABEL_IMAGE')
const expectAnalysisInteractions = process.env.TT_NI_EXPECT_ANALYSIS_INTERACTIONS === '1'

if (!existsSync(labelImage)) throw new Error(`TT_NI_LABEL_IMAGE does not exist: ${labelImage}`)

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false },
})

const login = await supabase.auth.signInWithPassword({ email, password })
if (login.error) throw login.error
const user = login.data.user
if (!user) throw new Error('QA sign-in did not return a user.')

const imageBytes = readFileSync(labelImage)
const imagePath = `${user.id}/smoke-${Date.now()}-${labelImage.split('/').pop()}`
let smokeProductId = ''
const upload = await supabase.storage.from('label-images').upload(imagePath, imageBytes, {
  contentType: 'image/png',
  upsert: false,
})
if (upload.error) throw upload.error
if (!upload.data.path.startsWith(`${user.id}/`)) throw new Error('Uploaded image path is not owner-scoped.')

try {
  const parsed = await supabase.functions.invoke('parse-label', {
    body: { image_path: upload.data.path },
  })
  if (parsed.error) throw parsed.error
  if (!parsed.data?.ingredients?.length) throw new Error('parse-label returned no ingredients.')
  const parseJob = await supabase
    .from('label_parse_jobs')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('image_path', upload.data.path)
    .maybeSingle()
  if (parseJob.error) throw parseJob.error
  if (!parseJob.data) throw new Error('parse-label did not persist a label_parse_jobs row.')
  if (parseJob.data.status !== 'review') throw new Error(`Unexpected parse job status: ${parseJob.data.status}`)

  const analysis = await supabase.functions.invoke('run-analysis', {
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
          id: 'smoke-product',
          productName: parsed.data.productName ?? 'Smoke product',
          dailyServings: 1,
          confirmed: true,
          ingredients: parsed.data.ingredients,
        },
      ],
    },
  })
  if (analysis.error) throw analysis.error
  if (!analysis.data?.analysis_report_id) throw new Error('run-analysis did not return analysis_report_id.')
  let interactionWarningCount = 0
  let persistedMedicationRecommendation = false
  if (expectAnalysisInteractions) {
    const interactionAnalysis = await supabase.functions.invoke('run-analysis', {
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
        medications: [{ id: 'smoke-med', name: 'warfarin', purpose: '항응고', frequency: '매일', memo: '' }],
        supplements: [
          {
            id: 'smoke-vitamin-k',
            productName: 'Smoke Vitamin K',
            dailyServings: 1,
            confirmed: true,
            ingredients: [
              {
                id: 'smoke-vitamin-k-ingredient',
                rawName: '비타민 K',
                standardName: '비타민 K',
                nutrientId: 'vitamin_k',
                amount: 90,
                unit: 'mcg',
                confidence: 1,
                rawText: 'manual',
                reviewRequired: false,
              },
            ],
          },
        ],
      },
    })
    if (interactionAnalysis.error) throw interactionAnalysis.error
    if (!interactionAnalysis.data?.analysis_report_id) throw new Error('interaction run-analysis did not return analysis_report_id.')
    interactionWarningCount = interactionAnalysis.data?.interactionWarnings?.length ?? 0
    const interactionReport = await supabase
      .from('analysis_reports')
      .select('id, recommendations_json')
      .eq('user_id', user.id)
      .eq('id', interactionAnalysis.data.analysis_report_id)
      .maybeSingle()
    if (interactionReport.error) throw interactionReport.error
    if (!interactionReport.data) throw new Error('interaction run-analysis did not persist an analysis_reports row.')
    const persistedRecommendations = interactionReport.data.recommendations_json
    persistedMedicationRecommendation = Array.isArray(persistedRecommendations) &&
      persistedRecommendations.some((recommendation) => recommendation?.status === 'medication')
    if (interactionWarningCount === 0) {
      throw new Error('run-analysis did not return medication interaction warnings.')
    }
    if (!persistedMedicationRecommendation) {
      throw new Error('run-analysis did not persist medication recommendations.')
    }
  }
  const report = await supabase
    .from('analysis_reports')
    .select('id, total_nutrients_json')
    .eq('user_id', user.id)
    .eq('id', analysis.data.analysis_report_id)
    .maybeSingle()
  if (report.error) throw report.error
  if (!report.data) throw new Error('run-analysis did not persist an analysis_reports row.')
  if (!Array.isArray(report.data.total_nutrients_json)) throw new Error('analysis report total_nutrients_json is not an array.')

  const productInsert = await supabase
    .from('supplement_products')
    .insert({
      owner_user_id: user.id,
      product_name: `Remote Smoke Product ${Date.now()}`,
      brand_name: 'tt-ni smoke',
      source_type: 'manual',
      label_image_path: null,
    })
    .select('id')
    .single()
  if (productInsert.error) throw productInsert.error
  smokeProductId = productInsert.data.id

  const ingredientInsert = await supabase.from('supplement_ingredients').insert({
    product_id: smokeProductId,
    nutrient_id: 'vitamin_d',
    raw_name: '비타민 D',
    standard_name: '비타민 D',
    amount: 25,
    unit: 'mcg',
    amount_per_daily_serving: 25,
    confidence: 1,
    review_required: false,
  })
  if (ingredientInsert.error) throw ingredientInsert.error

  const userSupplementInsert = await supabase.from('user_supplements').insert({
    user_id: user.id,
    product_id: smokeProductId,
    daily_servings: 1,
    intake_time: 'remote smoke',
    active: true,
  })
  if (userSupplementInsert.error) throw userSupplementInsert.error

  const savedProduct = await supabase
    .from('supplement_products')
    .select('id, supplement_ingredients(id), user_supplements(id)')
    .eq('id', smokeProductId)
    .maybeSingle()
  if (savedProduct.error) throw savedProduct.error
  if (!savedProduct.data) throw new Error('direct product Data API insert was not readable through RLS.')
  if ((savedProduct.data.supplement_ingredients ?? []).length !== 1) throw new Error('direct ingredient Data API insert was not persisted.')
  if ((savedProduct.data.user_supplements ?? []).length !== 1) throw new Error('direct user_supplement Data API insert was not persisted.')

  const result = {
    ok: true,
    uploadedPathPrefixMatchesUser: true,
    parseJobId: parseJob.data.id,
    parsedProduct: parsed.data.productName,
    parsedIngredientCount: parsed.data.ingredients.length,
    analysisReportId: analysis.data.analysis_report_id,
    analysisTotalCount: analysis.data.totalNutrients?.length ?? 0,
    directDataApiProductSaved: true,
  }
  if (expectAnalysisInteractions) {
    Object.assign(result, {
      analysisInteractionWarningCount: interactionWarningCount,
      persistedMedicationRecommendation,
    })
  }
  console.log(JSON.stringify(result, null, 2))
} finally {
  const cleanup = await supabase.storage.from('label-images').remove([upload.data.path])
  if (cleanup.error) throw cleanup.error
  const verifyCleanup = await supabase.storage.from('label-images').list(user.id, { limit: 1000 })
  if (verifyCleanup.error) throw verifyCleanup.error
  const remainingSmokeObject = verifyCleanup.data.some((file) => file.name === upload.data.path.split('/').at(-1))
  if (remainingSmokeObject) throw new Error(`remote smoke image cleanup failed: ${upload.data.path}`)
  if (smokeProductId) {
    const productCleanup = await supabase.from('supplement_products').delete().eq('id', smokeProductId)
    if (productCleanup.error) throw productCleanup.error
    const verifyProductCleanup = await supabase.from('supplement_products').select('id').eq('id', smokeProductId).maybeSingle()
    if (verifyProductCleanup.error) throw verifyProductCleanup.error
    if (verifyProductCleanup.data) throw new Error(`remote smoke product cleanup failed: ${smokeProductId}`)
  }
}
