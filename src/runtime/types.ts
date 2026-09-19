/**
 * Types for the PyTrace wire format (`trace-engine/1`).
 *
 * These mirror the engine's own schema, which the vendored browser facade
 * validates before any record reaches us. Only the parts BotGineer consumes
 * are modelled; unknown fields survive untouched because nothing here is
 * re-serialized back to the engine.
 */

/** Tagged value encoding (guide §26). The vocabulary is closed, but we treat
 *  unknown kinds as forward-compatible rather than an error. */
export type TraceValue =
  | { kind: 'none' }
  | { kind: 'bool'; value: boolean }
  | { kind: 'int'; decimal: string }
  | { kind: 'float'; decimal?: string; special?: 'Infinity' | '-Infinity' | 'NaN' }
  | { kind: 'str'; value: string }
  | { kind: 'bytes'; base64: string; length: number }
  | { kind: 'complex'; real: TraceValue; imag: TraceValue }
  | { kind: 'range' | 'slice'; start: TraceValue; stop: TraceValue; step: TraceValue }
  | { kind: 'ellipsis' }
  | { kind: 'not_implemented' }
  | { kind: 'ref'; uid: string }
  | { kind: 'elided'; reason: string; omitted_count?: number }
  | { kind: string; [k: string]: unknown }

/** Flat per-step heap (guide §27). Every reachable object appears once per
 *  step; aliases and cycles come back as `ref` values. */
export type HeapNode = {
  uid: string
  kind: string
  type_name: string
  items?: TraceValue[]
  entries?: { key: TraceValue; value: TraceValue }[]
  attributes?: { name: string; value: TraceValue }[]
  ordering?: 'insertion' | 'canonical' | 'unordered'
  elided_count?: number
  reason?: string
  [k: string]: unknown
}

export type Binding = { name: string; value: TraceValue }

export type Frame = {
  frame_id: string
  function: string
  module: string
  location: SourceLocation
  locals: Binding[]
}

export type SourceLocation = {
  filename: string
  module: string
  function: string
  line: number
}

export type StepEvent =
  | 'call'
  | 'resume'
  | 'line'
  | 'yield'
  | 'return'
  | 'exception'
  | 'unwind'
  | 'input'

export type HeaderRecord = {
  kind: 'header'
  seq: 0
  format: 'trace-engine/1'
  run_id: string
  engine_version: string
  python_version: string
  source: string
  options: Record<string, unknown>
  host: {
    kind: string
    runtime: string
    input_mode: 'live' | 'pre_supplied'
    capabilities: {
      live_input: boolean
      cooperative_interrupt: boolean
      hard_interrupt: boolean
      cross_origin_isolated: boolean
      [k: string]: boolean
    }
  }
}

export type StepRecord = {
  kind: 'step'
  seq: number
  step: number
  event: StepEvent
  location: SourceLocation
  stack: Frame[]
  globals: { module: string; bindings: Binding[] }[]
  heap: HeapNode[]
  output: {
    stdout_delta: string
    stderr_delta: string
    stdout_bytes: number
    stderr_bytes: number
  }
  flags?: Record<string, unknown>
  event_data?: { kind: string; [k: string]: unknown }
}

export type DiagnosticRecord = {
  kind: 'diagnostic'
  seq: number
  severity: 'warning' | 'error'
  code: string
  message: string
  at_step?: number
}

export type TerminalReason =
  | 'completed'
  | 'uncaught_exception'
  | 'step_limit'
  | 'trace_limit'
  | 'needs_input'
  | 'interrupted'
  | 'killed'
  | 'engine_error'

export type TerminalRecord = {
  kind: 'terminal'
  seq: number
  reason: TerminalReason
  synthetic: boolean
  trace_complete: boolean
  summary: {
    step_count: number
    diagnostic_count: number
    stdout_bytes: number
    stderr_bytes: number
    trace_bytes: number
  }
  /** Present only for `uncaught_exception` (schema: ExceptionSummary).
   *  `safe_message` is optional: the engine never calls a user __repr__. */
  exception?: { type_name: string; safe_message?: string; location?: SourceLocation }
}

/** The stream is exactly four kinds (`trace-engine/1`), `seq` contiguous
 *  from 0. There is no separate console record: program output arrives as
 *  `stdout_delta` / `stderr_delta` on each step. */
export type TraceRecord = HeaderRecord | StepRecord | DiagnosticRecord | TerminalRecord

export type RunSummary = {
  run_id: string
  terminal_reason: TerminalReason
  trace_complete: boolean
  step_count: number
  stdout_bytes: number
  stderr_bytes: number
}

/** Subset of the engine's 14 options that BotGineer sets. Unknown keys are a
 *  TypeError at the engine boundary, so this stays deliberately narrow. */
export type TraceOptions = {
  max_steps?: number
  max_heap_nodes?: number
  max_output_bytes?: number
  wall_clock_s?: number
  echo_stdin?: boolean
}
