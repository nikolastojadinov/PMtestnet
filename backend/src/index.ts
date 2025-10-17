import dotenv from 'dotenv'
import { startScheduler } from './cron/scheduler.js'
import { log } from './utils/logger.js'
import { YouTubeClient } from './youtube/client.js'
import { startHttpServer } from './server/http.js'
import { pingSupabase } from './supabase/client.js'

dotenv.config()

async function main() {
  // Start HTTP server first so Render detects open port
  startHttpServer()

  // Core init messages
  console.log('Render backend structure initialized successfully.')

  // Supabase ping is performed inside supabase client upon creation/import
  // Init YouTube client to log key rotation state
  await pingSupabase()
  new YouTubeClient()

  // Start cron scheduler
  startScheduler()

  // Persistent mode enforced: do not exit after init
}

main().catch((e) => {
  log('error', 'Backend failed to start', { error: (e as Error).message })
  process.exit(1)
})
