import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  },
})
