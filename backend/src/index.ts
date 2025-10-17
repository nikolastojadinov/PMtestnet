import dotenv from 'dotenv'
import { startScheduler } from './cron/scheduler.js'
import { log } from './utils/logger.js'
import { YouTubeClient } from './youtube/client.js'
import { pingSupabase } from './supabase/client.js'

dotenv.config()

async function main() {
  // Mode switching može biti unapređen čitanjem iz konfiguracione tabele kasnije
  console.log('Render backend structure initialized successfully.')
  await pingSupabase()
  // inicijalizuj YT klijent da prikažemo status rotacije ključeva
  new YouTubeClient()
  startScheduler()
  if (process.env.EXIT_ON_START === '1') {
    return
  }
}

main().catch((e) => {
  log('error', 'Backend failed to start', { error: (e as Error).message })
  process.exit(1)
})
