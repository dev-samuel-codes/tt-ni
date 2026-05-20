/** Edge Function의 호출을 허용할 오리진 목록을 반환합니다. 환경변수 VITE_SITE_URL이 설정되면 해당 값만 허용합니다. */
function getAllowedOrigin(): string {
  const siteUrl = Deno.env.get('VITE_SITE_URL')
  if (siteUrl) return siteUrl
  const deployUrl = Deno.env.get('SUPABASE_URL')
  if (deployUrl) return deployUrl
  return '*'
}

/** 개발 환경(localhost) 요청도 허용하기 위해 오리진을 검증하고 헤더를 확장합니다. */
function resolveAllowedOrigin(reqOrigin: string | null): string {
  const configuredOrigin = getAllowedOrigin()
  if (configuredOrigin === '*') return '*'
  if (!reqOrigin) return configuredOrigin
  if (configuredOrigin === reqOrigin) return configuredOrigin
  if (/^https?:\/\/localhost(:\d+)?$/.test(reqOrigin)) return reqOrigin
  return configuredOrigin
}

/** 모든 Edge Function에서 공통으로 사용하는 기본 CORS 헤더 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': getAllowedOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/** 요청 오리진에 맞게 동적으로 CORS 헤더를 생성합니다 (로컬 개발 환경 대응). */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  }
}

/** CORS 헤더가 포함된 JSON 응답을 생성합니다. (고정 오리진, 하위 호환용) */
export function jsonResponse(body: unknown, status = 200): Response
/** CORS 헤더가 포함된 JSON 응답을 생성합니다. (요청 오리진 기반 동적 처리) */
export function jsonResponse(req: Request, body: unknown, status?: number): Response
export function jsonResponse(reqOrBody: unknown, bodyOrStatus?: unknown, status?: number): Response {
  const isDynamic = reqOrBody instanceof Request
  const request = isDynamic ? (reqOrBody as Request) : null
  const body = isDynamic ? bodyOrStatus : reqOrBody
  const responseStatus = isDynamic ? (typeof status === 'number' ? status : 200) : (typeof bodyOrStatus === 'number' ? bodyOrStatus : 200)

  const headers: Record<string, string> = {
    ...(request ? getCorsHeaders(request) : corsHeaders),
    'Content-Type': 'application/json',
  }
  return new Response(JSON.stringify(body), {
    status: responseStatus,
    headers,
  })
}

