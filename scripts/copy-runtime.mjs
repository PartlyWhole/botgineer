/**
 * Copies the pinned Pyodide distribution into public/runtime/pyodide/ so the
 * deployed site self-hosts its own runtime. Nothing is fetched from a CDN at
 * play time — COEP `require-corp` would block it anyway, and a self-hosted
 * build keeps working when someone else's CDN does not.
 *
 * The layout matters: PyTrace's vendored worker resolves Pyodide relative to
 * itself as `../../pyodide/`, i.e. public/runtime/pytrace/browser/worker.mjs
 * -> public/runtime/pyodide/. Do not move either tree independently.
 */
import { createRequire } from 'node:module'
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pkgPath = require.resolve('pyodide/package.json')
const pyodideDir = dirname(pkgPath)
const version = JSON.parse(await readFile(pkgPath, 'utf8')).version

// Only what the app actually loads. The optional package collection would
// multiply the artifact for packages nothing imports.
const FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
]

const outDir = join(process.cwd(), 'public', 'runtime', 'pyodide')
await mkdir(outDir, { recursive: true })

let total = 0
for (const file of FILES) {
  await copyFile(join(pyodideDir, file), join(outDir, file))
  total += (await stat(join(outDir, file))).size
}

await writeFile(
  join(process.cwd(), 'public', 'runtime', 'runtime-version.json'),
  JSON.stringify({ pyodideVersion: version, files: FILES, bytes: total }, null, 2) + '\n',
)

console.log(
  `runtime: pyodide ${version}, ${FILES.length} files, ` +
    `${(total / 1024 / 1024).toFixed(1)} MB -> public/runtime/pyodide/`,
)
