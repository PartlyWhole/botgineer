/**
 * Thin typed wrapper over PyTrace's vendored browser facade.
 *
 * The facade is plain ESM served from public/, not bundled, because its
 * worker resolves the Pyodide distribution relative to its own URL. Loading
 * it through a runtime URL keeps that relationship intact under a GitHub
 * Pages project sub-path.
 */
import type {
  HeaderRecord,
  RunSummary,
  TerminalRecord,
  TraceOptions,
  TraceRecord,
} from './types'

/** Resolves a path inside public/ against the deployment base. Never
 *  root-absolute: that breaks the moment the site is served from /botgineer/. */
export function assetUrl(path: string): string {
  return new URL(import.meta.env.BASE_URL + path, window.location.href).href
}

type FacadeSession = {
  run(args: {
    runId?: string
    source: string
    options?: TraceOptions
    stdinLines?: string[]
    onRecord: (r: TraceRecord) => void | Promise<void>
  }): Promise<Record<string, unknown>>
  provideInput(line: string): void
  interrupt(): void
  dispose(): Promise<void>
}

type Facade = {
  createTraceWorker(config: { wheelUrl: string; schemaUrl?: string; workerUrl?: string }): FacadeSession
}

let facadePromise: Promise<Facade> | null = null

function loadFacade(): Promise<Facade> {
  facadePromise ??= import(/* @vite-ignore */ assetUrl('runtime/pytrace/browser/host.mjs')) as Promise<Facade>
  return facadePromise
}

export type RunOutcome = {
  summary: RunSummary
  header: HeaderRecord | null
  terminal: TerminalRecord | null
}

export type RunRequest = {
  source: string
  stdinLines?: string[]
  options?: TraceOptions
  onRecord: (r: TraceRecord) => void
}

export class PythonSession {
  #session: FacadeSession | null = null
  #busy = false

  /** True while a run is in flight. The UI disables Run on this, and every
   *  run path must clear it — a run that never ends wedges every control. */
  get busy(): boolean {
    return this.#busy
  }

  async #ensure(): Promise<FacadeSession> {
    if (this.#session) return this.#session
    const { createTraceWorker } = await loadFacade()
    this.#session = createTraceWorker({
      wheelUrl: assetUrl('runtime/pytrace/dist/pytrace_engine-0.1.0-py3-none-any.whl'),
      schemaUrl: assetUrl('runtime/pytrace/schema/trace-engine-1.schema.json'),
      workerUrl: assetUrl('runtime/pytrace/browser/worker.mjs'),
    })
    return this.#session
  }

  async run(request: RunRequest): Promise<RunOutcome> {
    // Reject a concurrent run BEFORE touching any per-run state, or the
    // rejection path clobbers the live run's records.
    if (this.#busy) throw new Error('A run is already in progress.')
    this.#busy = true

    let header: HeaderRecord | null = null
    let terminal: TerminalRecord | null = null

    try {
      const session = await this.#ensure()
      const raw = await session.run({
        source: request.source,
        stdinLines: request.stdinLines ?? [],
        options: request.options ?? {},
        onRecord: (r) => {
          if (r.kind === 'header') header = r
          if (r.kind === 'terminal') terminal = r
          request.onRecord(r)
        },
      })
      return { summary: raw as unknown as RunSummary, header, terminal }
    } finally {
      // Every path — success, throw, interrupt — ends the run.
      this.#busy = false
    }
  }

  provideInput(line: string): void {
    this.#session?.provideInput(line)
  }

  interrupt(): void {
    this.#session?.interrupt()
  }

  async dispose(): Promise<void> {
    await this.#session?.dispose()
    this.#session = null
    this.#busy = false
  }
}
