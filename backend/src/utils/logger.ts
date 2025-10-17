import { supabase } from '../supabase/client.js'

type LogLevel = 'info' | 'warn' | 'error'

export async function logJob(
  data: {
    target: string
    status: 'started' | 'success' | 'error'
    key_used?: string | null
    quota_used?: number | null
    error?: string | null
  }
) {
  const now = new Date().toISOString()
  const row: any = {
    target: data.target,
    status: data.status,
    started_at: data.status === 'started' ? now : null,
    finished_at: data.status !== 'started' ? now : null,
    key_used: data.key_used ?? null,
    quota_used: data.quota_used ?? null,
    error: data.error ?? null,
  }

  console.log(`[job] ${data.status} target=${data.target}`)
  if (data.error) console.error(data.error)

  if (!supabase) return
  try {
    await supabase.from('fetch_jobs').insert(row)
  } catch (e: any) {
    console.warn('Supabase logging failed:', e?.message)
  }
}

export function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const line = `[${level.toUpperCase()}] ${msg}`
  if (level === 'error') console.error(line, meta ?? '')
  else if (level === 'warn') console.warn(line, meta ?? '')
  else console.log(line, meta ?? '')
}
