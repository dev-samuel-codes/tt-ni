/**
 * Supabase Service Role Key를 환경변수에서 안전하게 가져옵니다.
 * 모든 Edge Function에서 공통으로 사용합니다.
 *
 * 우선순위:
 * 1. TT_NI_SERVICE_ROLE_KEY
 * 2. SUPABASE_SERVICE_ROLE_KEY
 * 3. SUPABASE_SECRET_KEYS (JSON 객체에서 첫 번째 값)
 */
export function getServiceKey(): string {
  const projectKey = Deno.env.get('TT_NI_SERVICE_ROLE_KEY')
  if (projectKey) return projectKey

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const secrets = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secrets) {
    throw new Error('TT_NI_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SECRET_KEYS is required')
  }

  try {
    const parsed = JSON.parse(secrets) as Record<string, string>
    const first = Object.values(parsed)[0]
    if (!first) {
      throw new Error('No Supabase secret key was found in SUPABASE_SECRET_KEYS')
    }
    return first
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('SUPABASE_SECRET_KEYS is not valid JSON')
    }
    throw error
  }
}
