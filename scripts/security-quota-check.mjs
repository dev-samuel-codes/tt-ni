import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`)
  }
}

function assertBefore(content, before, after, label) {
  const beforeIndex = content.indexOf(before)
  const afterIndex = content.indexOf(after)

  if (beforeIndex === -1) throw new Error(`${label} is missing before marker: ${before}`)
  if (afterIndex === -1) throw new Error(`${label} is missing after marker: ${after}`)
  if (beforeIndex > afterIndex) {
    throw new Error(`${label} must run before ${after}`)
  }
}

const migration = read('supabase/migrations/20260521000004_add_atomic_api_usage_limit.sql')
assertIncludes(migration, 'CREATE OR REPLACE FUNCTION consume_api_usage', 'quota migration')
assertIncludes(migration, 'ON CONFLICT (user_id, usage_date, api_type)', 'quota migration')
assertIncludes(migration, 'WHERE api_usage.call_count < p_daily_limit', 'quota migration')
assertIncludes(migration, 'auth.uid() IS DISTINCT FROM p_user_id', 'quota migration')

const helper = read('supabase/functions/_shared/rateLimit.ts')
assertIncludes(helper, "supabase.rpc('consume_api_usage'", 'rate limit helper')
assertIncludes(helper, "error: 'DAILY_LIMIT_EXCEEDED'", 'rate limit helper')

const parseLabel = read('supabase/functions/parse-label/index.ts')
assertIncludes(parseLabel, "consumeApiUsage(supabase, userData.user.id, 'parse_label'", 'parse-label quota')
assertBefore(parseLabel, 'consumeApiUsage(', "fetch('https://api.openai.com/v1/chat/completions'", 'parse-label quota')

const exaSearch = read('supabase/functions/exa-search/index.ts')
assertIncludes(exaSearch, "consumeApiUsage(supabase, userData.user.id, 'exa_search'", 'exa-search quota')
assertBefore(exaSearch, 'consumeApiUsage(', "fetch('https://api.exa.ai/search'", 'exa-search quota')

const refineIngredients = read('supabase/functions/refine-ingredients/index.ts')
assertIncludes(refineIngredients, "consumeApiUsage(supabase, userData.user.id, 'refine'", 'refine quota')
assertBefore(refineIngredients, 'consumeApiUsage(', "fetch('https://api.openai.com/v1/chat/completions'", 'refine quota')

console.log('Security quota checks passed')
