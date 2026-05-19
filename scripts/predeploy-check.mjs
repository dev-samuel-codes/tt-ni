import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const failOnWarnings = process.env.TT_NI_FAIL_ON_WARNINGS === '1'
const errors = []
const notes = []
const warnings = []

function fail(message) {
  errors.push(message)
}

function pass(message) {
  notes.push(`ok: ${message}`)
}

function warn(message) {
  warnings.push(`warn: ${message}`)
}

function readEnv(path) {
  if (!existsSync(path)) return null
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

function walk(dir, out = [], skipGenerated = true) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = relative(root, full)
    if (skipGenerated && ['.git', 'node_modules', 'dist', '.DS_Store'].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue
    if (statSync(full).isDirectory()) walk(full, out, skipGenerated)
    else out.push(full)
  }
  return out
}

function runCli(args) {
  return execFileSync('supabase', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function maxMtime(path) {
  if (!existsSync(path)) return 0
  return Math.max(...walk(path, [], false).map((file) => statSync(file).mtimeMs), 0)
}

function parseFunctionUpdatedAt(functionsList, functionName) {
  const line = functionsList.split('\n').find((row) => new RegExp(`\\|\\s*${functionName}\\s*\\|`).test(row))
  if (!line) return null
  const columns = line.split('|').map((value) => value.trim()).filter(Boolean)
  const updatedAt = columns.at(-1)
  if (!updatedAt) return null
  const timestamp = Date.parse(`${updatedAt.replace(' ', 'T')}Z`)
  return Number.isNaN(timestamp) ? null : timestamp
}

const env = readEnv(join(root, '.env.local'))
if (!env) {
  fail('.env.local is required for pre-deploy verification.')
} else {
  if (!env.VITE_SUPABASE_URL) fail('VITE_SUPABASE_URL is missing from .env.local.')
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY) fail('VITE_SUPABASE_PUBLISHABLE_KEY is missing from .env.local.')
  for (const key of ['OPENAI_API_KEY', 'TT_NI_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS']) {
    if (env[key]) fail(`${key} must not be stored in .env.local.`)
  }
  if (!errors.length) pass('client env contains only publishable Supabase settings')
}

const exampleEnv = readEnv(join(root, '.env.example')) ?? {}
if ('OPENAI_API_KEY' in exampleEnv || 'TT_NI_SERVICE_ROLE_KEY' in exampleEnv) {
  fail('.env.example must not include server-only secret names.')
} else {
  pass('.env.example excludes server-only secrets')
}

const gitignore = existsSync(join(root, '.gitignore')) ? readFileSync(join(root, '.gitignore'), 'utf8') : ''
if (!gitignore.includes('*.local') && !gitignore.includes('.env.local')) fail('.env.local is not ignored by Git.')
else pass('.env.local is ignored')

const forbidden = [
  /localStorage/,
  /Demo Auth/,
  /샘플 파싱/,
  /sampleParsedIngredients/,
  /sk-proj-[A-Za-z0-9_-]+/,
  /OPENAI_API_KEY\s*=\s*sk-/,
  /sb_secret_[A-Za-z0-9_-]+/,
  /service_role_[A-Za-z0-9_-]+/,
]
const forbiddenBundleSecrets = [
  /sk-proj-[A-Za-z0-9_-]+/,
  /OPENAI_API_KEY\s*[:=]/,
  /sb_secret_[A-Za-z0-9_-]+/,
  /SUPABASE_SECRET_KEYS\s*[:=]/,
  /service_role_[A-Za-z0-9_-]+/,
  /TT_NI_SERVICE_ROLE_KEY\s*[:=]/,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/,
]
for (const file of walk(root)) {
  const rel = relative(root, file)
  if (rel === 'scripts/predeploy-check.mjs') continue
  if (!/\.(ts|tsx|js|mjs|json|md|env|toml|sql|css|html)$/.test(rel)) continue
  const text = readFileSync(file, 'utf8')
  const match = forbidden.find((pattern) => pattern.test(text))
  if (match) fail(`forbidden fallback or secret pattern found in ${rel}: ${match}`)
}
if (!errors.some((error) => error.startsWith('forbidden fallback'))) pass('no local fallback or hardcoded secret patterns found')

if (env?.VITE_SUPABASE_URL) {
  const projectRef = existsSync(join(root, 'supabase/.temp/project-ref'))
    ? readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
    : ''
  const urlRef = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
  if (!projectRef) fail('Supabase project is not linked locally.')
  else if (projectRef !== urlRef) fail(`linked Supabase ref ${projectRef} does not match VITE_SUPABASE_URL ref ${urlRef}.`)
  else pass(`linked Supabase project matches env (${projectRef})`)
}

if (env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_PUBLISHABLE_KEY) {
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  const referenceRead = await supabase.from('nutrients').select('id').limit(1)
  if (referenceRead.error || referenceRead.data.length !== 1) fail('anon cannot read reference nutrients.')
  else pass('anon can read public reference nutrients')

  const privateRead = await supabase.from('user_profiles').select('id').limit(1)
  if (!privateRead.error) fail('anon can access user_profiles; private Data API grants are too broad.')
  else pass('anon cannot access user_profiles')
}

try {
  const projectRef = readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
  const secrets = runCli(['secrets', 'list', '--project-ref', projectRef])
  for (const name of ['OPENAI_API_KEY', 'TT_NI_SERVICE_ROLE_KEY']) {
    if (!secrets.includes(name)) fail(`Supabase secret ${name} is missing.`)
  }
  if (!errors.some((error) => error.startsWith('Supabase secret'))) pass('required Supabase Edge Function secrets exist')

  const functions = runCli(['functions', 'list', '--project-ref', projectRef])
  for (const name of ['parse-label', 'run-analysis']) {
    if (!new RegExp(`${name}\\s+\\|\\s+ACTIVE`).test(functions)) fail(`Edge Function ${name} is not ACTIVE.`)
    const deployedAt = parseFunctionUpdatedAt(functions, name)
    const localChangedAt = maxMtime(join(root, 'supabase/functions', name))
    if (deployedAt && localChangedAt > deployedAt + 60_000) {
      warn(`local ${name} Edge Function source is newer than the deployed version; deploy it before production release.`)
    }
  }
  if (!errors.some((error) => error.startsWith('Edge Function'))) pass('required Supabase Edge Functions are ACTIVE')
} catch (error) {
  fail(`Supabase CLI verification failed: ${error instanceof Error ? error.message : String(error)}`)
}

if (!existsSync(join(root, 'dist/index.html'))) {
  fail('dist/index.html is missing; run npm run build before deployment.')
} else {
  pass('production build artifact exists')
  for (const file of walk(join(root, 'dist'), [], false)) {
    const rel = relative(root, file)
    if (!/\.(html|js|css)$/.test(rel)) continue
    const text = readFileSync(file, 'utf8')
    const match = forbiddenBundleSecrets.find((pattern) => pattern.test(text))
    if (match) fail(`server secret pattern found in production bundle ${rel}: ${match}`)
  }
  if (!errors.some((error) => error.startsWith('server secret pattern'))) pass('production bundle does not expose server secret patterns')
}

for (const note of notes) console.log(note)
for (const warning of warnings) console.log(warning)
if (failOnWarnings && warnings.length) {
  console.error('\npredeploy check failed because release mode treats warnings as failures:')
  for (const warning of warnings) console.error(`- ${warning}`)
  process.exit(1)
}
if (errors.length) {
  console.error('\npredeploy check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('\npredeploy check passed')
