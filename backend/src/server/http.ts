import http from 'node:http'
import { log } from '../utils/logger.js'

let serverInstance: http.Server | null = null
let started = false

export function startHttpServer() {
  if (started && serverInstance) return serverInstance
  const port = Number(process.env.PORT || 8080)
  const server = http.createServer((req, res) => {
    const url = req.url || '/'
    if (url === '/health') {
      const body = JSON.stringify({ status: 'ok', mode: process.env.CRON_MODE || 'FETCH', time: new Date().toISOString() })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(body)
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('Purple Music backend running')
  })
  server.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      log('warn', `HTTP port :${port} already in use; skipping additional listener`)
    } else {
      log('error', 'HTTP server error', { error: err?.message || String(err) })
    }
  })
  server.listen(port, () => {
    log('info', `Render heartbeat listening on :${port}`)
  })
  serverInstance = server
  started = true
  return server
}
