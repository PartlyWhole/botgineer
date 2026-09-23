/**
 * The real engine, in Node: the vendored PyTrace wheel inside the same
 * pinned Pyodide the site ships.
 *
 * The browser suite remains the proof that the *site* works. This is for
 * everything that only needs the *interpreter* to be the answer key — the
 * collection's snippet audit and its self-consistency sweep, a couple of
 * hundred programs — which would take many minutes through a page and
 * takes seconds here. Same CPython build, same engine, same wire format:
 * the host dictionary mirrors `browser/worker.mjs`, so the records are the
 * ones the page receives, minus the live-input capability.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPyodide, type PyodideInterface } from 'pyodide'
import type { StepRecord, TerminalRecord, TraceOptions, TraceRecord } from '../../src/runtime/types'
import { runEvidence, type RunEvidence } from '../../src/memory/extract'

const WHEEL = fileURLToPath(
  new URL('../../public/runtime/pytrace/dist/pytrace_engine-0.1.0-py3-none-any.whl', import.meta.url),
)

const BOOTSTRAP = String.raw`
import json as _j, sys as _sys
from trace_engine.api import ListTraceSink as _Sink, QueueInputProvider as _Input
from trace_engine.engine import _run_with_host as _run
from trace_engine.options import TraceOptions as _Options
from trace_engine.serialization import canonical_record_bytes as _bytes

def _bg_run(source, options_json, stdin_json):
    opts = _Options(**_j.loads(options_json))
    sink = _Sink()
    before = dict(_sys.modules)
    try:
        _run(
            source,
            run_id="node",
            options=opts,
            sink=sink,
            input_provider=_Input(tuple(_j.loads(stdin_json))),
            host_info={
                "kind": "browser_worker",
                "runtime": "pyodide",
                "platform": "browser",
                "input_mode": "pre_supplied",
                "python_hash_seed": "not_applicable",
                "capabilities": {
                    "live_input": False,
                    "cooperative_interrupt": False,
                    "hard_interrupt": True,
                    "process_group": False,
                    "cpu_limit": False,
                    "address_space_limit": False,
                    "cross_origin_isolated": False,
                },
            },
        )
    finally:
        # The worker does this too: a program's imports do not leak into
        # the next program.
        for name in set(_sys.modules) - set(before):
            _sys.modules.pop(name, None)
    return "\n".join(_bytes(r).decode("ascii") for r in sink.records)
`

let booting: Promise<PyodideInterface> | null = null

function boot(): Promise<PyodideInterface> {
  booting ??= (async () => {
    const py = await loadPyodide()
    py.unpackArchive(new Uint8Array(readFileSync(WHEEL)), 'wheel')
    py.runPython(BOOTSTRAP)
    return py
  })()
  return booting
}

/** Runs one program and returns every record, as the page would get them. */
export async function trace(source: string, options: TraceOptions = {}, stdin: string[] = []): Promise<TraceRecord[]> {
  const py = await boot()
  const run = py.globals.get('_bg_run') as (s: string, o: string, i: string) => string
  const text = run(source, JSON.stringify({ max_steps: 5000, ...options }), JSON.stringify(stdin))
  return text.split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as TraceRecord)
}

/** The engine as the collection's runner wants it: source in, evidence out. */
export const evaluate = async (source: string, options: TraceOptions = {}): Promise<RunEvidence> => {
  const records = await trace(source, options)
  const steps = records.filter((r): r is StepRecord => r.kind === 'step')
  const terminal = (records.find((r) => r.kind === 'terminal') as TerminalRecord | undefined) ?? null
  return runEvidence(steps, terminal)
}
