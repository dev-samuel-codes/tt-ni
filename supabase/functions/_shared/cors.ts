/** Edge Function의 호출을 허용할 오리진 목록을 반환합니다. 환경변수 VITE_SITE_URL이 설정되면 해당 값만 허용합니다. */
function getAllowedOrigin(): string {
  const siteUrl = Deno.env.get('VITE_SITE_URL')
  if (siteUrl) return siteUrl
  const deployUrl = Deno.env.get('SUPABASE_URL')
  if (deployUrl) return deployUrl
  return '*'
}

/** 모든 Edge Function에서 공통으로 사용하는 CORS 헤더 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': getAllowedOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/** CORS 헤더가 포함된 JSON 응답을 생성합니다. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
