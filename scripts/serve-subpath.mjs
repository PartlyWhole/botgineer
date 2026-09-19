/**
 * Serves dist/ under a repository sub-path, exactly as GitHub Pages does, and
 * with NO isolation headers — so the coi-serviceworker path is what gets
 * exercised locally. Both differences have produced real bugs before.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const base = (process.env.BASE_PATH ?? '/botgineer/').replace(/\/?$/, '/')
const port = Number(process.env.PORT ?? 8619)
const root = join(process.cwd(), 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.whl': 'application/zip',
  '.zip': 'application/zip',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith(base)) {
    res.writeHead(302, { location: base }).end()
    return
  }
  let rel = url.pathname.slice(base.length) || 'index.html'
  if (rel.endsWith('/')) rel += 'index.html'
  const file = join(root, normalize('/' + rel))
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // Deliberately NOT `no-store`: Chrome refuses to register a service
      // worker whose script came back no-store, and the COI shim is a
      // service worker. GitHub Pages sends ETag + max-age, so this is also
      // the more faithful simulation.
      'cache-control': 'no-cache',
    })
    res.end(await readFile(file))
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  }
}).listen(port, () => {
  console.log(`serving dist/ at http://127.0.0.1:${port}${base} (no COOP/COEP headers)`)
})
