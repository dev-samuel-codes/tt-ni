import { apiRequest } from '../../lib/apiClient'
import { createId } from '../../lib/utils'
import type { ParsedIngredient, SupplementProduct } from '../../types'
import { heicTo, isHeic } from 'heic-to'

/** LLM 정제 후 확장된 성분 정보 (효능, 권장량, 주의사항 포함) */
interface RefinedIngredient extends ParsedIngredient {
  benefit: string
  recommendedDaily: string
  caution: string
}

/** refine-ingredients API의 응답 타입 */
interface RefineResponse {
  productName: string
  brandName: string
  ingredients: RefinedIngredient[]
  summary: string
}

/** 라벨 이미지 업로드 시 허용되는 MIME 타입 */
const allowedLabelMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** 최대 업로드 파일 크기 (10MB) */
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

/** 파일명에서 경로 탐색 문자를 제거하여 안전하게 만듭니다. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9ㄱ-ㅎ가-힣._-]/g, '_')
    .slice(0, 200)
}

/**
 * 성분명 정제를 위해 Firebase 인증이 붙은 TiDB API(refine-ingredients)를 호출합니다.
 * DB 매칭 + LLM 분석을 통해 원재료명을 표준 영양소로 변환하고 효능 정보를 추가합니다.
 */
export async function refineIngredients(
  productName: string,
  brandName: string,
  ingredients: Array<{ name: string; amount?: number | null; unit?: string }>,
): Promise<RefineResponse> {
  return apiRequest<RefineResponse>('/api/refine-ingredients', {
    method: 'POST',
    body: { productName, brandName, ingredients },
  })
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
 * 3. Firebase 인증이 붙은 TiDB API에 이미지를 전송하여 성분 추출
 */
export async function parseLabelImage(
  file?: File,
  onStepChange?: (step: 'converting' | 'uploading' | 'parsing') => void,
) {
  if (!file) throw new Error('성분표 이미지 파일을 선택해야 AI 파싱을 실행할 수 있습니다.')

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`파일 크기는 최대 10MB까지 업로드할 수 있습니다. 현재 파일 크기: ${(file.size / (1024 * 1024)).toFixed(1)}MB`)
  }

  if (file.size === 0) {
    throw new Error('빈 파일은 업로드할 수 없습니다.')
  }

  if (await isHeic(file)) {
    onStepChange?.('converting')
    const converted = await convertHeicToJpeg(file)
    if (!converted) throw new Error('HEIC 이미지 변환에 실패했습니다. JPG, PNG, WEBP 형식으로 다시 시도해주세요.')
    file = converted
  }

  if (!allowedLabelMimeTypes.has(file.type)) {
    throw new Error('JPG, PNG, WEBP 형식의 성분표 이미지를 업로드해주세요.')
  }

  const safeName = sanitizeFileName(file.name)
  onStepChange?.('uploading')
  const form = new FormData()
  form.append('image', file, safeName)
  onStepChange?.('parsing')
  const data = await apiRequest<{
    productName?: string
    dailyServingsRecommended?: number
    ingredients: ParsedIngredient[]
    warnings?: string[]
    labelImagePath?: string
  }>('/api/parse-label', {
    method: 'POST',
    body: form,
  })

  return {
    imageName: file.name,
    labelImagePath: data.labelImagePath ?? file.name,
    productName: data.productName as string | undefined,
    dailyServingsRecommended: data.dailyServingsRecommended as number | undefined,
    ingredients: data.ingredients as ParsedIngredient[],
    warnings: (data.warnings ?? []) as string[],
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
 * 인증 확인 후 user_id 필터를 추가하여 RLS와 무관하게 정확한 행만 갱신합니다.
 */
export async function updateSupplementProduct(
  productId: string,
  patch: Partial<Pick<SupplementProduct, 'productName' | 'brandName' | 'dailyServings' | 'intakeTime'>>,
): Promise<string> {
  const result = await apiRequest<{ message: string }>(`/api/supplements/${productId}`, {
    method: 'PATCH',
    body: patch,
  })
  return result.message
}

/** 여러 성분을 한 번에 업데이트합니다 (개별 업데이트 대신 배치 upsert 사용). */
export async function batchUpdateSupplementIngredients(
  ingredients: Array<{ id: string; standardName?: string; amount?: number | null; unit?: string }>,
  dailyServings?: number,
): Promise<string> {
  const rows = ingredients.map((ing) => {
    const row: Record<string, unknown> = { id: ing.id }
    if (ing.standardName !== undefined) row.standard_name = ing.standardName
    if (ing.amount !== undefined) {
      row.amount = ing.amount ?? 0
      row.amount_per_daily_serving = (dailyServings && dailyServings > 0) ? (ing.amount ?? 0) * dailyServings : (ing.amount ?? 0)
    }
    if (ing.unit !== undefined) row.unit = ing.unit
    return row
  })

  const result = await apiRequest<{ message: string }>('/api/supplements/ingredients', {
    method: 'POST',
    body: { ingredients: rows.map((row) => ({
      id: row.id,
      standardName: row.standard_name,
      amount: row.amount,
      unit: row.unit,
    })), dailyServings },
  })
  return result.message
}

/** 영양제 제품을 삭제합니다 (CASCADE로 연관 성분, user_supplements도 삭제됨). */
export async function deleteSupplementProduct(productId: string): Promise<string> {
  const result = await apiRequest<{ message: string }>(`/api/supplements/${productId}`, {
    method: 'DELETE',
  })
  return result.message
}

/**
 * 영양제 제품과 성분, 사용자 연결 정보를 한 트랜잭션처럼 저장합니다.
 * supplement_products → supplement_ingredients → user_supplements 순으로 삽입합니다.
 * 중간에 실패하면 이미 삽입된 제품을 정리(cleanup)합니다.
 */
export async function saveSupplementProduct(supplement: SupplementProduct, labelImagePath: string): Promise<{ productId: string; message: string }> {
  try {
    if (!supplement.productName?.trim()) throw new Error('제품명이 없습니다.')
    if (!supplement.ingredients || supplement.ingredients.length === 0) throw new Error('저장할 성분이 없습니다.')

    return apiRequest<{ productId: string; message: string }>('/api/supplements', {
      method: 'POST',
      body: { supplement, labelImagePath },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '저장에 실패했습니다.'
    console.error('[saveSupplementProduct] 저장 실패:', error)
    throw new Error(message, { cause: error })
  }
}
