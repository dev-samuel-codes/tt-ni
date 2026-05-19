import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const providers = ['google', 'kakao']
const redirectUrls = (process.env.TT_NI_AUTH_REDIRECT_URLS || process.env.TT_NI_AUTH_REDIRECT_URL || 'http://127.0.0.1:5173/,http://localhost:5173/,http://127.0.0.1:5174/,http://localhost:5174/')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)
const providerRedirectHosts = {
  google: 'accounts.google.com',
  kakao: 'kauth.kakao.com',
}

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
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
const errors = []

if (!supabaseUrl) errors.push('VITE_SUPABASE_URL is missing.')
if (!publishableKey) errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing.')

if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`)
  process.exit(1)
}

const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
  headers: {
    apikey: publishableKey,
  },
})

if (!settingsResponse.ok) {
  console.error(`error: failed to read Supabase Auth settings (${settingsResponse.status})`)
  process.exit(1)
}

const settings = await settingsResponse.json()
const external = settings.external ?? {}
const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

console.log(`Supabase project: ${new URL(supabaseUrl).host}`)
console.log(`App redirect URLs: ${redirectUrls.join(', ')}`)
console.log(`Provider callback URL: ${supabaseUrl}/auth/v1/callback`)

let ready = true

for (const redirectTo of redirectUrls) {
  console.log('')
  console.log(`redirect: ${redirectTo}`)

  for (const provider of providers) {
    const enabled = external[provider] === true
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })
    const authorizeUrl = data?.url ? new URL(data.url) : null
    const generated = Boolean(authorizeUrl)
    const providerParam = authorizeUrl?.searchParams.get('provider')
    const redirectParam = authorizeUrl?.searchParams.get('redirect_to')
    let authorizeStatus = null
    let authorizeRedirectHost = null
    let authorizeError = null

    if (authorizeUrl) {
      try {
        const authorizeResponse = await fetch(authorizeUrl, { redirect: 'manual' })
        authorizeStatus = authorizeResponse.status
        const location = authorizeResponse.headers.get('location')
        authorizeRedirectHost = location ? new URL(location).host : null
        if (!authorizeRedirectHost) {
          authorizeError = (await authorizeResponse.text()).replace(/\s+/g, ' ').slice(0, 180)
        }
      } catch (fetchError) {
        authorizeError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      }
    }

    console.log(`\n${provider}:`)
    console.log(`  enabled: ${enabled}`)
    console.log(`  authorize URL generated: ${generated}`)
    console.log(`  provider param: ${providerParam ?? '(missing)'}`)
    console.log(`  redirect_to: ${redirectParam ?? '(missing)'}`)
    console.log(`  authorize endpoint status: ${authorizeStatus ?? '(not checked)'}`)
    console.log(`  provider redirect host: ${authorizeRedirectHost ?? '(none)'}`)
    if (authorizeError) console.log(`  authorize endpoint response: ${authorizeError}`)

    if (error) {
      ready = false
      console.log(`  error: ${error.message}`)
    }
    if (!enabled) {
      ready = false
      console.log('  action: enable this provider in Supabase Dashboard > Authentication > Sign In / Providers.')
    }
    if (!generated || providerParam !== provider || redirectParam !== redirectTo) {
      ready = false
      console.log('  action: OAuth authorize URL did not match the expected provider/redirect.')
    }
    if (enabled && authorizeRedirectHost !== providerRedirectHosts[provider]) {
      ready = false
      console.log(`  action: Supabase Auth did not redirect to ${providerRedirectHosts[provider]}; verify provider credentials and redirect allow-list.`)
    }
  }
}

if (!ready) {
  console.error('\nauth provider check failed')
  process.exit(1)
}

console.log('\nauth provider check passed')
