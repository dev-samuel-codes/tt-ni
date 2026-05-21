import type { ResultSetHeader } from 'mysql2'
import { pool } from './db.js'

export const EXTERNAL_API_USAGE_BUCKET = 'external_api'
export const DEFAULT_DAILY_EXTERNAL_API_LIMIT = 50
export const DAILY_EXTERNAL_API_LIMIT_MESSAGE = '일일 AI/API 호출 한도를 초과했습니다. 내일 다시 이용해주세요.'

export function dailyExternalApiLimit(): number {
  const configuredLimit = Number(process.env.DAILY_EXTERNAL_API_LIMIT ?? DEFAULT_DAILY_EXTERNAL_API_LIMIT)
  if (!Number.isFinite(configuredLimit) || configuredLimit < 1) return DEFAULT_DAILY_EXTERNAL_API_LIMIT
  return Math.floor(configuredLimit)
}

export async function consumeExternalApiQuota(userId: string, limit = dailyExternalApiLimit()): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `insert into app_api_usage (user_id, usage_date, usage_bucket, call_count)
     values (?, current_date(), ?, 1)
     on duplicate key update
       call_count = if(call_count < ?, call_count + 1, call_count),
       updated_at = current_timestamp`,
    [userId, EXTERNAL_API_USAGE_BUCKET, limit],
  )
  return result.affectedRows > 0
}
