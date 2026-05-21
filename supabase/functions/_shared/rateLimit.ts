interface ApiUsageRow {
  allowed: boolean
  used: number
  limit_count: number
}

interface RpcClient {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: ApiUsageRow[] | null; error: Error | null }>
}

export interface ApiUsageResult {
  allowed: boolean
  used: number
  limit: number
}

export async function consumeApiUsage(
  supabase: RpcClient,
  userId: string,
  apiType: string,
  dailyLimit: number,
): Promise<ApiUsageResult> {
  const { data, error } = await supabase.rpc('consume_api_usage', {
    p_user_id: userId,
    p_api_type: apiType,
    p_daily_limit: dailyLimit,
  })

  if (error) throw error

  const usage = data?.[0]
  if (!usage) throw new Error('API usage limit check returned no result')

  return {
    allowed: usage.allowed,
    used: usage.used,
    limit: usage.limit_count,
  }
}

export function dailyLimitPayload(usage: ApiUsageResult): Record<string, unknown> {
  return {
    error: 'DAILY_LIMIT_EXCEEDED',
    message: '일일 API 호출 한도를 초과했습니다. 내일 다시 시도해주세요.',
    limit: usage.limit,
    used: usage.used,
  }
}
