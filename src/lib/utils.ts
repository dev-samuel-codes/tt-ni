export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function getStatusTone(status: string): string {
  if (status === 'excess' || status === 'high') return 'danger'
  if (status === 'caution' || status === 'deficient' || status === 'review') return 'warning'
  if (status === 'normal') return 'success'
  return 'neutral'
}
