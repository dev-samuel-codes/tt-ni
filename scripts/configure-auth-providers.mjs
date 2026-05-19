import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function readEnv(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, '')]
      }),
  )
}

const env = {
  ...readEnv(join(root, '.env')),
  ...readEnv(join(root, '.env.local')),
  ...process.env,
}

const supabaseUrl = env.VITE_SUPABASE_URL
const accessToken = env.SUPABASE_ACCESS_TOKEN
const googleClientId = env.TT_NI_GOOGLE_CLIENT_ID
const googleClientSecret = env.TT_NI_GOOGLE_CLIENT_SECRET
const kakaoClientId = env.TT_NI_KAKAO_CLIENT_ID
const kakaoClientSecret = env.TT_NI_KAKAO_CLIENT_SECRET
const errors = []

if (!supabaseUrl) errors.push('VITE_SUPABASE_URL is missing.')
if (!accessToken) errors.push('SUPABASE_ACCESS_TOKEN is missing.')

const payload = {}

if (googleClientId && googleClientSecret) {
  payload.external_google_enabled = true
  payload.external_google_client_id = googleClientId
  payload.external_google_secret = googleClientSecret
}

if (kakaoClientId && kakaoClientSecret) {
  payload.external_kakao_enabled = true
  payload.external_kakao_client_id = kakaoClientId
  payload.external_kakao_secret = kakaoClientSecret
}

if (!payload.external_google_enabled && !payload.external_kakao_enabled) {
  errors.push('No complete provider credentials found. Set Google and/or Kakao client id and secret environment variables.')
}

if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`)
  process.exit(1)
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})

if (!response.ok) {
  const body = await response.text()
  console.error(`error: failed to update Supabase Auth provider config (${response.status})`)
  console.error(body.replace(/\s+/g, ' ').slice(0, 500))
  process.exit(1)
}

const enabledProviders = [
  payload.external_google_enabled ? 'google' : null,
  payload.external_kakao_enabled ? 'kakao' : null,
].filter(Boolean)

console.log(`Updated Supabase Auth providers for ${projectRef}: ${enabledProviders.join(', ')}`)
console.log('Run `npm run auth:check` to verify provider readiness.')
