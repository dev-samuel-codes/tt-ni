import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

function readEnv(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const env = readEnv('.env.local')
const supabaseUrl = env.VITE_SUPABASE_URL
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false },
})

const email = 'hun1234kim@gmail.com'
const passwords = [
  'hun1234',
  'hun1234kim',
  '12341234',
  '12345678',
  'hun1234!',
  'hun1234kim!',
  'password123',
  'password',
]

async function tryLogin() {
  for (const password of passwords) {
    console.log(`비밀번호 시도 중: ${password}...`)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.session) {
      console.log(`성공! 비밀번호는 [${password}] 입니다.`)
      process.exit(0)
    }
  }
  console.log('실패: 일치하는 비밀번호가 없습니다.')
}

tryLogin()
