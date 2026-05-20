import { supabase } from '../../lib/supabaseClient'
import { createId } from '../../lib/utils'
import type { ParsedIngredient, SupplementProduct } from '../../types'
import { heicTo, isHeic } from 'heic-to'

/** LLM 정제 후 확장된 성분 정보 (효능, 권장량, 주의사항 포함) */
export interface RefinedIngredient extends ParsedIngredient {
  benefit: string
  recommendedDaily: string
  caution: string
}

/** refine-ingredients Edge Function의 응답 타입 */
export interface RefineResponse {
  productName: string
  brandName: string
  ingredients: RefinedIngredient[]
  summary: string
}

/** 라벨 이미지 업로드 시 허용되는 MIME 타입 */
export const allowedLabelMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * 성분명 정제를 위해 Supabase Edge Function(refine-ingredients)을 호출합니다.
 * DB 매칭 + LLM 분석을 통해 원재료명을 표준 영양소로 변환하고 효능 정보를 추가합니다.
 */
export async function refineIngredients(
  productName: string,
  brandName: string,
  ingredients: Array<{ name: string; amount?: number | null; unit?: string }>,
): Promise<RefineResponse> {
  const { data, error } = await supabase.functions.invoke('refine-ingredients', {
    body: { productName, brandName, ingredients },
  })
  if (error) {
    if (error.message?.includes('DAILY_LIMIT_EXCEEDED')) {
      throw new Error('일일 API 호출 한도를 초과했습니다. 내일 다시 시도해주세요.')
    }
    throw new Error(error.message || '성분 정제 중 오류가 발생했습니다.')
  }
  return data as RefineResponse
}

/** HEIC 이미지를 JPEG로 변환합니다. 실패 시 null 반환. */
async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const result = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
    return new File([result], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
    })
  } catch {
    return null
  }
}

/**
 * 성분표 이미지를 업로드하고 OpenAI Vision API로 파싱합니다.
 *
 * 처리 흐름:
 * 1. HEIC 형식이면 JPEG로 변환
 * 2. MIME 타입 검증 (JPG, PNG, WEBP만 허용)
 * 3. Supabase Storage에 이미지 업로드
 * 4. parse-label Edge Function 호출하여 성분 추출
 * 5. 실패 시 업로드된 이미지 정리(cleanup)
 */
export async function parseLabelImage(
  file?: File,
  onStepChange?: (step: 'converting' | 'uploading' | 'parsing') => void
) {
  let uploadedPath = ''
  try {
    if (!file) throw new Error('성분표 이미지 파일을 선택해야 AI 파싱을 실행할 수 있습니다.')

    if (await isHeic(file)) {
      onStepChange?.('converting')
      const converted = await convertHeicToJpeg(file)
      if (!converted) throw new Error('HEIC 이미지 변환에 실패했습니다. JPG, PNG, WEBP 형식으로 다시 시도해주세요.')
      file = converted
    }

    if (!allowedLabelMimeTypes.has(file.type)) {
      throw new Error('JPG, PNG, WEBP 형식의 성분표 이미지를 업로드해주세요.')
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('로그인 후 성분표 이미지를 업로드할 수 있습니다.')

    onStepChange?.('uploading')
    const path = `${authData.user.id}/${crypto.randomUUID()}-${file.name}`
    const upload = await supabase.storage.from('label-images').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (upload.error) throw upload.error

    uploadedPath = upload.data.path
    onStepChange?.('parsing')
    const { data, error } = await supabase.functions.invoke('parse-label', {
      body: { image_path: upload.data.path },
    })
    if (error) throw error

    return {
      imageName: file.name,
      labelImagePath: upload.data.path,
      productName: data.productName as string | undefined,
      dailyServingsRecommended: data.dailyServingsRecommended as number | undefined,
      ingredients: data.ingredients as ParsedIngredient[],
      warnings: (data.warnings ?? []) as string[],
    }
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage.from('label-images').remove([uploadedPath])
    }
    throw error
  }
}

/** 수동 입력용 빈 성분 객체를 생성합니다. */
export function createManualIngredient(): ParsedIngredient {
  return {
    id: createId('ingredient'),
    rawName: '',
    standardName: '',
    nutrientId: '',
    amount: 0,
    unit: 'mg',
    confidence: 1,
    rawText: 'manual',
    reviewRequired: false,
  }
}

/**
 * 영양제 제품 정보와 복용 정보를 업데이트합니다.
 * 제품명/브랜드는 supplement_products 테이블에서,
 * 복용 횟수/시간은 user_supplements 테이블에서 각각 업데이트합니다.
 */
export async function updateSupplementProduct(
  productId: string,
  patch: Partial<Pick<SupplementProduct, 'productName' | 'brandName' | 'dailyServings' | 'intakeTime'>>,
): Promise<string> {
  const { error } = await supabase
    .from('supplement_products')
    .update({
      ...(patch.productName !== undefined && { product_name: patch.productName }),
      ...(patch.brandName !== undefined && { brand_name: patch.brandName }),
    })
    .eq('id', productId)
  if (error) throw new Error('제품 정보 수정에 실패했습니다: ' + error.message)

  if (patch.dailyServings !== undefined || patch.intakeTime !== undefined) {
    const { error: usError } = await supabase
      .from('user_supplements')
      .update({
        ...(patch.dailyServings !== undefined && { daily_servings: patch.dailyServings }),
        ...(patch.intakeTime !== undefined && { intake_time: patch.intakeTime }),
      })
      .eq('product_id', productId)
    if (usError) throw new Error('복용 정보 수정에 실패했습니다: ' + usError.message)
  }

  return '제품 정보를 수정했습니다.'
}

/** 개별 성분 정보를 업데이트합니다. amount_per_daily_serving도 함께 갱신합니다. */
export async function updateSupplementIngredient(
  ingredientId: string,
  patch: Partial<Pick<ParsedIngredient, 'standardName' | 'amount' | 'unit'>>,
): Promise<string> {
  const { error } = await supabase
    .from('supplement_ingredients')
    .update({
      ...(patch.standardName !== undefined && { standard_name: patch.standardName }),
      ...(patch.amount !== undefined && { amount: patch.amount, amount_per_daily_serving: patch.amount }),
      ...(patch.unit !== undefined && { unit: patch.unit }),
    })
    .eq('id', ingredientId)
  if (error) throw new Error('성분 수정에 실패했습니다: ' + error.message)
  return '성분 정보를 수정했습니다.'
}

/** 영양제 제품을 삭제합니다 (CASCADE로 연관 성분, user_supplements도 삭제됨). */
export async function deleteSupplementProduct(productId: string): Promise<string> {
  const { error } = await supabase
    .from('supplement_products')
    .delete()
    .eq('id', productId)
  if (error) throw new Error('제품 삭제에 실패했습니다: ' + error.message)
  return '제품을 삭제했습니다.'
}

/**
 * 영양제 제품과 성분, 사용자 연결 정보를 한 트랜잭션처럼 저장합니다.
 * supplement_products → supplement_ingredients → user_supplements 순으로 삽입합니다.
 * 중간에 실패하면 이미 삽입된 제품을 정리(cleanup)합니다.
 */
export async function saveSupplementProduct(supplement: SupplementProduct, labelImagePath: string): Promise<{ productId: string; message: string }> {
  let productId = ''
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
    if (!authData.user) throw new Error('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.')

    const productInsert = await supabase.from('supplement_products').insert({
      owner_user_id: authData.user.id,
      product_name: supplement.productName,
      brand_name: supplement.brandName,
      source_type: labelImagePath ? 'photo' : 'manual',
      label_image_path: labelImagePath || null,
    }).select('id').single()
    if (productInsert.error) throw productInsert.error

    productId = productInsert.data.id as string
    const ingredientsInsert = await supabase.from('supplement_ingredients').insert(
      supplement.ingredients.map((ingredient) => ({
        product_id: productId,
        nutrient_id: ingredient.nutrientId,
        raw_name: ingredient.rawName || ingredient.standardName,
        standard_name: ingredient.standardName,
        amount: ingredient.amount,
        unit: ingredient.unit,
        amount_per_daily_serving: ingredient.amount,
        confidence: ingredient.confidence,
        review_required: ingredient.reviewRequired,
      })),
    )
    if (ingredientsInsert.error) throw ingredientsInsert.error

    const userSupplementInsert = await supabase.from('user_supplements').insert({
      user_id: authData.user.id,
      product_id: productId,
      daily_servings: supplement.dailyServings,
      intake_time: supplement.intakeTime,
      active: true,
    })
    if (userSupplementInsert.error) throw userSupplementInsert.error

    return { productId, message: '제품과 성분 정보를 저장했습니다.' }
  } catch (error) {
    let message = error instanceof Error ? error.message : '저장에 실패했습니다.'
    if (productId) {
      const cleanup = await supabase.from('supplement_products').delete().eq('id', productId)
      if (cleanup.error) message = `${message} 제품 임시 데이터 정리도 실패했습니다: ${cleanup.error.message}`
    }
    throw new Error(message, { cause: error })
  }
}
