import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uadhfwfzifvnkfhhmgeo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZGhmd2Z6aWZ2bmtmaGhtZ2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNDg1ODksImV4cCI6MjA3NjYyNDU4OX0.V0y7YmkbGGms-nDONmEGNhHypC6i2Vz8qfm3nOizSfg'

if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    throw new Error('URL do Supabase inválida. Deve começar com https://')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

