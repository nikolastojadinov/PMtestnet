import http from 'node:http'
import { log } from '../utils/logger.js'

export function startHttpServer() {
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
  server.listen(port, () => {
    log('info', `HTTP server listening on :${port}`)
  })
  return server
}
