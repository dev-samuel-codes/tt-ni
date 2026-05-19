import { supabase } from '../../lib/supabaseClient'
import { createId } from '../../lib/utils'
import type { ParsedIngredient, SupplementProduct } from '../../types'
import { heicTo, isHeic } from 'heic-to'

export const allowedLabelMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

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

export async function parseLabelImage(file?: File) {
  let uploadedPath = ''
  try {
    if (!file) throw new Error('성분표 이미지 파일을 선택해야 AI 파싱을 실행할 수 있습니다.')

    if (await isHeic(file)) {
      const converted = await convertHeicToJpeg(file)
      if (!converted) throw new Error('HEIC 이미지 변환에 실패했습니다. JPG, PNG, WEBP 형식으로 다시 시도해주세요.')
      file = converted
    }

    if (!allowedLabelMimeTypes.has(file.type)) {
      throw new Error('JPG, PNG, WEBP 형식의 성분표 이미지를 업로드해주세요.')
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('로그인 후 성분표 이미지를 업로드할 수 있습니다.')

    const path = `${authData.user.id}/${crypto.randomUUID()}-${file.name}`
    const upload = await supabase.storage.from('label-images').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (upload.error) throw upload.error

    uploadedPath = upload.data.path
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

export async function deleteSupplementProduct(productId: string): Promise<string> {
  const { error } = await supabase
    .from('supplement_products')
    .delete()
    .eq('id', productId)
  if (error) throw new Error('제품 삭제에 실패했습니다: ' + error.message)
  return '제품을 삭제했습니다.'
}

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
