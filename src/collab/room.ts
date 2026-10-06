/**
 * A shared room: one Automerge document that several browsers hold, plus
 * who is here. Ported from PLP's `app/collab.mjs`, whose COLLAB.md is the
 * long version of why it is shaped this way.
 *
 *   doc      { code, run }: the editor's text, merged a character at a
 *            time, and the last run, replaced wholesale by each new one
 *   presence who is here and where: name, colour, role, caret, and the
 *            step each is looking at. Ephemeral messages, never in the doc,
 *            so a slider drag is not history
 *
 * **One peer runs Python.** Whoever presses Run is the driver for that run;
 * the others are shown the driver's trace (`trace.ts`). While a run is
 * going, nobody else may start one, unless the driver has gone quiet: a
 * closed tab must not lock the room.
 *
 * **Roles.** The one who shares is the learner; whoever joins is a helper.
 * Today the roles only label people; both can type, run and step. A lesson
 * in a room will use them for whose answer counts.
 *
 * **Transports.** The relay (`RELAY`, the same one PLP uses), which also
 * keeps the room while nobody is in it, and BroadcastChannel between tabs of
 * one browser, which is also what the tests use, with no network at all.
 * Both at once; Automerge sync does not mind hearing a change twice.
 *
 * The link is the key: anyone holding it can read and edit the room, and
 * there is no taking it back. Rooms nobody visits for 90 days are deleted
 * from the relay.
 */
import type { AutomergeUrl, DocHandle, PeerId, Presence, Repo } from './lib'
import type { PackedRun } from './trace'
import { TRACE_CAP, pack, unpack } from './trace'

export type Role = 'learner' | 'helper'
export type Transport = 'ws' | 'tabs'
export const TRANSPORTS: readonly Transport[] = ['ws', 'tabs']
export const RELAY = 'wss://sync.partlywhole.org'

/** The last run, as the room holds it. */
export type SharedRun = {
  runId: string
  /** The peer that ran it. */
  driver: string
  status: 'running' | 'done'
  /** The program that ran, so an edit can tell the run no longer fits. */
  source: string
  /** The packed trace (`trace.ts`), once done; null while running, or when
   *  it was too big to share (`tooBig`). */
  trace: Uint8Array | null
  tooBig: boolean
}

/**
 * One thing a player did in a shared lesson. A lesson's progress is
 * derived from its evidence (CLAUDE.md invariant 11), and the evidence is
 * a function of these, in order, so every peer that applies the same log
 * derives the same step. Each peer runs Python for them itself: a lesson's
 * programs are the lesson's, and replaying the console is how the console
 * works anyway (invariant 7).
 */
export type LessonEvent =
  | { id: string; by: string; kind: 'say'; source: string }
  | { id: string; by: string; kind: 'run'; source: string }
  | { id: string; by: string; kind: 'pick'; ask: string; choice: string }
  | { id: string; by: string; kind: 'undo' }
  /** `key` names a wipe the lesson makes itself (a beat's, a step's), so
   *  it is made once however many peers reach it. */
  | { id: string; by: string; kind: 'wipe'; key: string }

/** What a lesson room adds to the document. */
export type LessonRoom = { level: string; seed: number; events: LessonEvent[] }

type RoomDoc = { code: string; run: SharedRun | null; level?: string; seed?: number; events?: LessonEvent[] }

export type Me = { id: string; name: string; color: string; role: Role }
export type Peer = Me & {
  cursor: { anchor: number; head: number } | null
  /** When the peer's name was last shown: on arrival, and when they move
   *  after a pause. */
  announcedAt: number
}

type PresenceState = {
  user: { name: string; color: string; role: Role }
  cursor: { anchor: number; head: number; n: number } | null
  step: { runId: string; index: number; n: number } | null
  beat: { key: string; at: number; n: number } | null
  /** The memory card picked (`MemoryPanel`), in which view of memory. */
  pick: { view: string; pick: unknown; n: number } | null
}

const NAME_ADJ = ['Plucky', 'Zesty', 'Nimble', 'Cheery', 'Snazzy', 'Bouncy', 'Dapper', 'Breezy', 'Sunny', 'Funky']
const NAME_ANIMAL = ['Otter', 'Panda', 'Fox', 'Heron', 'Lynx', 'Gecko', 'Wombat', 'Axolotl', 'Puffin', 'Quokka']
export const PEER_COLORS = ['#56b6c2', '#c678dd', '#e5c07b', '#98c379', '#61afef', '#e06c75', '#d19a66', '#7fbbb3']
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!
export function colorFor(id: string): string {
  let h = 0
  for (const ch of id) h = ((h << 5) - h + ch.charCodeAt(0)) | 0
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length]!
}

/** A peer heard from within this long is here. Checked when read, because
 *  the library's own pruning runs on a timer a background tab throttles to
 *  once a minute, which left closed tabs in the room (PLP COLLAB.md §5). */
const FRESH_MS = 20_000
/** A name is shown again when its peer moves after this long still. */
const ANNOUNCE_IDLE_MS = 2500
const CURSOR_MS = 40

/** `?transports=tabs` (tests, debugging) > the link's `via` > all. */
export function transportsFrom(search: string, via: string | null): Set<Transport> {
  const parse = (raw: string | null) => {
    if (!raw) return null
    const got = new Set(raw.split(',').filter((t): t is Transport => (TRANSPORTS as readonly string[]).includes(t)))
    return got.size ? got : null
  }
  return parse(new URLSearchParams(search).get('transports')) ?? parse(via) ?? new Set(TRANSPORTS)
}

type Lib = typeof import('./lib')
let libPromise: Promise<Lib> | null = null
const loadLib = () => (libPromise ??= import('./lib'))

export class Room {
  readonly me: Me
  readonly url: AutomergeUrl
  readonly via: Set<Transport>
  readonly lib: Lib
  readonly handle: DocHandle<RoomDoc>
  private readonly repo: Repo
  private presence: Presence<PresenceState, RoomDoc> | null = null
  private listeners = new Set<() => void>()
  private stepListeners = new Set<(runId: string, index: number) => void>()
  private beatListeners = new Set<(key: string, at: number) => void>()
  private pickListeners = new Set<(view: string, pick: unknown) => void>()
  private seenPick = new Map<string, number>()
  private pickN = 0
  private seenBeat = new Map<string, number>()
  private beatN = 0
  private eventN = 0
  /** The last beat a peer moved to: a peer still catching up to that step
   *  takes it up when they get there. */
  lastBeat: { key: string; at: number } | null = null
  private seenStep = new Map<string, number>()
  private seenCursor = new Map<string, { n: number; at: number; announcedAt: number }>()
  private cursorN = 0
  private stepN = 0
  private cursorTimer: ReturnType<typeof setTimeout> | null = null
  private pendingCursor: { anchor: number; head: number } | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  /** The run this peer is driving, if any. */
  myRun: string | null = null

  private constructor(lib: Lib, repo: Repo, handle: DocHandle<RoomDoc>, me: Me, via: Set<Transport>) {
    this.lib = lib
    this.repo = repo
    this.handle = handle
    this.me = me
    this.url = handle.url
    this.via = via
    handle.on('change', this.emit)
  }

  /** Shares `code` in a new room, as its learner; a lesson, with what has
   *  happened in it so far. */
  static async create(code: string, via: Set<Transport>, lesson?: LessonRoom): Promise<Room> {
    const lib = await loadLib()
    const id = `bg-${Math.random().toString(36).slice(2, 10)}`
    const repo = new lib.Repo({ network: network(lib, via), peerId: id as PeerId })
    const handle = repo.create<RoomDoc>(lesson ? { code, run: null, level: lesson.level, seed: lesson.seed, events: lesson.events.map(plain) } : { code, run: null })
    await handle.whenReady()
    const room = new Room(lib, repo, handle, me(id, 'learner'), via)
    room.start()
    return room
  }

  /** Joins the room at `url` as a helper, or null if it cannot be reached
   *  in time. Patient: any transport may deliver the document late. */
  static async join(url: string, via: Set<Transport>, deadlineMs = 45_000): Promise<Room | null> {
    const lib = await loadLib()
    if (!lib.isValidAutomergeUrl(url)) return null
    const id = `bg-${Math.random().toString(36).slice(2, 10)}`
    const repo = new lib.Repo({ network: network(lib, via), peerId: id as PeerId })
    try {
      // Take the handle in any state and wait for it to be ready: the relay
      // can say "unavailable" before another tab has answered, and that is
      // not the last word (PLP COLLAB.md §7).
      const found = await repo.find<RoomDoc>(url, { allowableStates: ['ready', 'unavailable', 'requesting', 'loading'] })
      const handle = found.isReady()
        ? found
        : await Promise.race([
            found.whenReady().then(() => found),
            new Promise<null>((done) => setTimeout(() => done(null), deadlineMs)),
          ])
      if (!handle || typeof handle.doc()?.code !== 'string') throw new Error('unreachable')
      const room = new Room(lib, repo, handle, me(id, 'helper'), via)
      room.start()
      return room
    } catch {
      try {
        void repo.shutdown()
      } catch {
        /* best effort */
      }
      return null
    }
  }

  /** The link that joins this room. */
  link(base: string): string {
    const via = this.via.size === TRANSPORTS.length ? '' : `&via=${[...this.via].join(',')}`
    return `${base}&room=${this.url}${via}`
  }

  private start() {
    const presence = new this.lib.Presence<PresenceState, RoomDoc>({ handle: this.handle })
    presence.start({
      initialState: { user: { name: this.me.name, color: this.me.color, role: this.me.role }, cursor: null, step: null, beat: null, pick: null },
      heartbeatMs: 5000,
      peerTtlMs: 15_000,
    })
    this.presence = presence
    for (const ev of ['update', 'snapshot', 'goodbye', 'heartbeat', 'pruning'] as const) presence.on(ev, this.onPresence)
    // A peer that closed without a goodbye sends nothing: repaint on our
    // own beat so they leave the roster anyway.
    this.ticker = setInterval(this.emit, 5000)
  }

  /* ------------------------------ reading ------------------------------ */

  doc(): RoomDoc | undefined {
    return this.handle.doc()
  }

  run(): SharedRun | null {
    return this.doc()?.run ?? null
  }

  /** The lesson this room is for, and the seed its questions were drawn
   *  with; null for a sandbox room. */
  lesson(): { level: string; seed: number } | null {
    const d = this.doc()
    return d && typeof d.level === 'string' && typeof d.seed === 'number' ? { level: d.level, seed: d.seed } : null
  }

  /** The lesson's log, in the order every peer applies it. */
  events(): readonly LessonEvent[] {
    return this.doc()?.events ?? []
  }

  /** Whether this peer leads the room for things only one may do (putting
   *  a step's program in the shared editor): the learner while here, else
   *  the first of those here by id. Everyone works it out the same way. */
  leads(): boolean {
    const here = [this.me, ...this.peers()]
    const learner = here.find((p) => p.role === 'learner')
    if (learner) return learner.id === this.me.id
    return here.map((p) => p.id).sort()[0] === this.me.id
  }

  /** Everyone else here now, oldest message first. */
  peers(): Peer[] {
    if (!this.presence) return []
    const now = Date.now()
    return Object.values(this.presence.getPeerStates().value)
      .filter((p) => now - p.lastSeenAt < FRESH_MS && p.value?.user)
      .map((p) => {
        const u = p.value.user
        const c = p.value.cursor
        const color = typeof u.color === 'string' && PEER_COLORS.includes(u.color) ? u.color : colorFor(p.peerId)
        return {
          id: p.peerId,
          name: typeof u.name === 'string' ? u.name.slice(0, 40) : 'Someone',
          color,
          role: u.role === 'learner' ? 'learner' : 'helper',
          cursor: c && Number.isInteger(c.anchor) && Number.isInteger(c.head) ? { anchor: c.anchor, head: c.head } : null,
          announcedAt: this.seenCursor.get(p.peerId)?.announcedAt ?? 0,
        } satisfies Peer
      })
  }

  /** Who is driving a run in progress, if anyone is here doing so. */
  runningBy(): Peer | Me | null {
    const run = this.run()
    if (!run || run.status !== 'running') return null
    if (run.driver === this.me.id) return this.myRun === run.runId ? this.me : null
    return this.peers().find((p) => p.id === run.driver) ?? null
  }

  /** Whether this peer may start a run: not while another's is going. */
  canRun(): boolean {
    return this.runningBy() === null
  }

  /* ------------------------------ writing ------------------------------ */

  startRun(runId: string, source: string): void {
    this.myRun = runId
    this.handle.change((d) => {
      d.run = { runId, driver: this.me.id, status: 'running', source, trace: null, tooBig: false }
    })
  }

  /** Publishes the finished run, unless another peer's started meanwhile
   *  won the room (two Runs within one sync: the document picks one). */
  async finishRun(runId: string, run: PackedRun): Promise<boolean> {
    const bytes = await pack(run)
    if (this.run()?.runId !== runId) {
      this.myRun = null
      return false
    }
    const tooBig = bytes.length > TRACE_CAP
    this.handle.change((d) => {
      if (d.run?.runId !== runId) return
      d.run.status = 'done'
      d.run.trace = tooBig ? null : bytes
      d.run.tooBig = tooBig
    })
    return true
  }

  /** A peer's run, unpacked; null if it is not there or not a run. */
  async trace(run: SharedRun): Promise<PackedRun | null> {
    return run.trace ? unpack(run.trace) : null
  }

  /** Adds to the lesson's log. Applied by every peer, this one included,
   *  in the document's order (`Workbench`). */
  push(event: LessonInput): string {
    const e = plain({ ...event, id: `${this.me.id}-${++this.eventN}`, by: this.me.id } as LessonEvent)
    this.handle.change((d) => {
      if (!d.events) d.events = []
      d.events.push(e)
    })
    return e.id
  }

  /** Tells the others which line of the lesson this peer is on. */
  shareBeat(key: string, at: number): void {
    this.presence?.broadcast('beat', { key, at, n: ++this.beatN })
  }

  /** Called when another peer moves to a line of the lesson. */
  onBeat(fn: (key: string, at: number) => void): () => void {
    this.beatListeners.add(fn)
    return () => this.beatListeners.delete(fn)
  }

  /** Tells the others which memory card this peer picked in `view` (null:
   *  none). Shape-checked by whoever receives it (`MemoryPanel`). */
  sharePick(view: string, pick: unknown): void {
    this.presence?.broadcast('pick', { view, pick: pick ?? null, n: ++this.pickN })
  }

  /** Called when another peer picks a memory card, or lets one go. */
  onPick(fn: (view: string, pick: unknown) => void): () => void {
    this.pickListeners.add(fn)
    return () => this.pickListeners.delete(fn)
  }

  /** Tells the others which step of `runId` this peer is looking at. */
  shareStep(runId: string, index: number): void {
    this.presence?.broadcast('step', { runId, index, n: ++this.stepN })
  }

  /** Tells the others where this peer's caret is, at most every 40 ms. */
  shareCursor(anchor: number, head: number): void {
    this.pendingCursor = { anchor, head }
    if (this.cursorTimer !== null) return
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null
      const c = this.pendingCursor
      this.pendingCursor = null
      if (c && this.presence?.running) this.presence.broadcast('cursor', { ...c, n: ++this.cursorN })
    }, CURSOR_MS)
  }

  /* ------------------------------ listening ---------------------------- */

  /** Called on any change to the document or to who is here. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Called when another peer moves to a step. */
  onStep(fn: (runId: string, index: number) => void): () => void {
    this.stepListeners.add(fn)
    return () => this.stepListeners.delete(fn)
  }

  private emit = () => {
    for (const fn of this.listeners) fn()
  }

  private onPresence = () => {
    if (!this.presence) return
    const now = Date.now()
    for (const p of Object.values(this.presence.getPeerStates().value)) {
      const s = p.value?.step
      if (s && typeof s.n === 'number' && typeof s.runId === 'string' && Number.isInteger(s.index)) {
        if ((this.seenStep.get(p.peerId) ?? -1) < s.n) {
          this.seenStep.set(p.peerId, s.n)
          for (const fn of this.stepListeners) fn(s.runId, s.index)
        }
      }
      const b = p.value?.beat
      if (b && typeof b.n === 'number' && typeof b.key === 'string' && Number.isInteger(b.at)) {
        if ((this.seenBeat.get(p.peerId) ?? -1) < b.n) {
          this.seenBeat.set(p.peerId, b.n)
          this.lastBeat = { key: b.key, at: b.at }
          for (const fn of this.beatListeners) fn(b.key, b.at)
        }
      }
      const k = p.value?.pick
      if (k && typeof k.n === 'number' && typeof k.view === 'string') {
        if ((this.seenPick.get(p.peerId) ?? -1) < k.n) {
          this.seenPick.set(p.peerId, k.n)
          for (const fn of this.pickListeners) fn(k.view, k.pick)
        }
      }
      const c = p.value?.cursor
      if (c && typeof c.n === 'number') {
        const seen = this.seenCursor.get(p.peerId)
        if (!seen || seen.n < c.n) {
          const idle = !seen || now - seen.at > ANNOUNCE_IDLE_MS
          this.seenCursor.set(p.peerId, { n: c.n, at: now, announcedAt: idle ? now : seen!.announcedAt })
        }
      }
    }
    this.emit()
  }

  /* ------------------------------ leaving ------------------------------ */

  /** Says goodbye, lets it reach the others, and shuts the transports. */
  async leave(): Promise<void> {
    try {
      this.presence?.stop()
    } catch {
      /* best effort */
    }
    await new Promise((done) => setTimeout(done, 200))
    this.close()
  }

  /** On tab close: the goodbye only. `pagehide` cannot wait, and shutting
   *  the transports in the same tick raced the goodbye to the page's end. */
  goodbye(): void {
    try {
      this.presence?.stop()
    } catch {
      /* best effort */
    }
  }

  private close() {
    if (this.ticker) clearInterval(this.ticker)
    if (this.cursorTimer) clearTimeout(this.cursorTimer)
    this.handle.off('change', this.emit)
    this.listeners.clear()
    this.stepListeners.clear()
    this.beatListeners.clear()
    this.pickListeners.clear()
    try {
      void this.repo.shutdown()
    } catch {
      /* best effort */
    }
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
/** An event as a player makes it, before it is given an id and an author. */
export type LessonInput = DistributiveOmit<LessonEvent, 'id' | 'by'>

/** Automerge refuses `undefined`, and a doc's own objects are proxies: a
 *  plain copy with no undefined fields goes in. */
function plain<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T
}

function me(id: string, role: Role): Me {
  return { id, name: `${pick(NAME_ADJ)} ${pick(NAME_ANIMAL)}`, color: colorFor(id), role }
}

function network(lib: Lib, via: Set<Transport>) {
  const adapters = []
  // `__botgineerRelay` points the relay at a local one (tests only).
  const relay = (window as unknown as { __botgineerRelay?: string }).__botgineerRelay ?? RELAY
  if (via.has('ws')) adapters.push(new lib.WebSocketClientAdapter(relay))
  if (via.has('tabs')) adapters.push(new lib.BroadcastChannelNetworkAdapter())
  return adapters
}
