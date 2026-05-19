/** 접두사-임의 UUID 형식의 고유 ID를 생성합니다. */
export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** 쉼표로 구분된 문자열을 공백 제거 및 빈 항목 필터링 후 배열로 변환합니다. */
export function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

/** 상태값(excess, caution 등)을 UI 톤(danger, warning, success)으로 매핑합니다. */
export function getStatusTone(status: string): string {
  if (status === 'excess' || status === 'high') return 'danger'
  if (status === 'caution' || status === 'deficient' || status === 'review') return 'warning'
  if (status === 'normal') return 'success'
  return 'neutral'
}
