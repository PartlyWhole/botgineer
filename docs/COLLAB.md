# Shared rooms

A learner can share the sandbox (`#/code`) or a v2 lesson with a helper:
a parent, a teacher, a friend who knows more. In the sandbox both see the
same program, the same run and the same step of it. In a lesson both are
told the same line, asked the same question and shown the same robot,
and either can answer. Whoever shares is the learner and whoever joins is
a helper, but nobody is labelled so on screen; the roles only decide who
leads (`Room.leads`).

This is PLP's collaboration (`partlywhole/plp`, `app/COLLAB.md`) ported to
BotGineer's stack. PLP's document is the long version of most of the
reasoning; this one says what is the same, what differs, and why.

## The pieces

| Path | What |
|---|---|
| `src/collab/room.ts` | `Room`: create, join, presence, the run lock, leave. Not React |
| `src/collab/lib.ts` | everything from Automerge, in one lazily imported module |
| `src/collab/trace.ts` | a finished run packed for the room, and unpacked with a shape check |
| `src/collab/editor.ts` | what the editor wears in a room: the sync plugin, the others' carets |
| `src/collab/useRoom.ts` | the room for a React page: share, join from the link, leave |
| `src/collab/RoomBar.tsx` | the strip along the top: Share; then who is here, Copy link, Leave |
| `src/app/Sandbox.tsx` | the sandbox, shared |
| `src/app/Workbench.tsx` | a v2 lesson, shared ("A lesson, shared") |
| `content/lessons/seed.ts`, `lessonFor` | one seed per page, and a lesson drawn with a room's seed |

## The document

One Automerge document per room. Its URL is the room's name and its key.

```
{ code: string,          // the editor's text, merged a character at a time
  level?, seed?,         // a lesson room: which lesson, drawn with which seed
  events?: LessonEvent[],// a lesson room: what the players did, in order
  run: { runId, driver,  // the last run, replaced whole by each new one
         status: 'running' | 'done',
         source,          // the program that ran
         trace: bytes | null,   // gzipped JSON of the steps (trace.ts)
         tooBig: boolean } | null }
```

Presence is not in the document. Who is here (a made-up name like
"Plucky Otter", a colour, learner or helper), each caret, the step each
person is looking at, the line being told, and the memory card picked
travel as ephemeral messages, so dragging the scrubber is not history.

**Resizing a pane resizes it for everyone** (`collab/sizes`): the scene,
memory, the sandbox's code pane and the output. A size goes as a fraction
of the space its gutter divides, since the screens differ, and a joiner
takes up the room's layout.

**Someone else's typing never moves your caret.** The sync plugin applies
a peer's edit and then sets your caret mapped so that text typed exactly
at it pushes it along; `keepCaret` drops that step, so CodeMirror's own
mapping leaves the caret before text typed at it. Peers' carets are drawn
the same way (`side: -1`), and each peer re-sends its caret after any
edit, so a drawn caret never sits where the real one is not.

**Picking a card in memory picks it for everyone** (`MemoryPanel`'s
`sync`): the camera flies to it on every screen, and letting go lets go
everywhere. A pick names the memory it was made in (the sandbox's, a
lesson's robot, or the crow's demonstration), so it never lands on a
different one, and it is shape-checked on arrival. A card not in this
peer's memory yet is let go here only, not for everyone. Escape sends a
let-go only when there was a pick, so Escape in the editor clears nothing.

## Rules

1. **One peer runs Python.** Whoever presses Run is the driver; the
   others are shown the driver's trace. Running again on every machine
   would disagree as soon as a program used `random`, and then step 7
   would be two different memories.
2. **The run is shared once, when it is done.** The sandbox walks a run
   afterwards (it opens on step 0), so there is nothing to stream. PLP
   streams records a frame at a time because its memory model plays live.
   The trace is one gzipped bytes value, not thousands of Automerge maps.
   Over 4 MB packed, it is not shared, and the room says so.
3. **A peer's trace is untrusted.** `trace.ts` drops a run whose steps are
   not shaped like engine output, and the sandbox draws empty memory for
   a step it cannot read rather than crash.
4. **Nobody may run while another's run is going**, unless the driver has
   not been heard from for 20 seconds: a closed tab must not lock the room.
   Two Runs in the same instant: the document keeps one, and the other
   driver's run is quietly not published.
5. **Moving through a run moves everyone.** The last person to step is
   followed. A helper's point is "look, this step".
6. **An edit puts the run away**, for everyone: a run is shown only while
   the editor holds the program that ran (`done.source === program`).
7. **Presence is quiet** (PLP `design/collab-presence.md`): one 2px caret
   per peer, a light tint for a selection, the name on arrival or after a
   pause, then faded. Typed text is never highlighted. A caret that moves
   is redrawn, so the fade carries on from when the name was announced
   rather than starting again.
8. **Solo players pay nothing.** Automerge (about 1.7 MB gzipped, wasm
   inline) is a separate chunk loaded only on Share or on opening a room
   link. `vite.config.ts` points `@automerge/automerge` at its base64 entry,
   which needs no wasm plugin.

## Transports

The relay `wss://sync.partlywhole.org` (PLP's, `deploy/relay/` there),
which also keeps a room while nobody is in it, and BroadcastChannel
between tabs of one browser. Both at once: Automerge does not mind hearing
a change twice. PLP's third route, WebRTC signalled over public Nostr
relays, is left out: it would have a child's browser contact a dozen
third-party servers.

`?transports=tabs` forces a set (tests use it, so they never touch the
network); a link made that way carries `&via=tabs`.

## Links and safety

A room link is the route plus the room: `#/code&room=automerge:…`
(`router.roomInHash`). Anyone holding it can read and edit the room, and
it cannot be taken back; the relay deletes a room nobody has opened for
90 days. There is no chat, and names are made up, so nothing identifies a
child. Share the link the way you would share edit access.

## Testing

`tests/browser/code-sandbox-room.spec.ts`: two pages of one browser on
`tabs` only, asserting no relay socket is opened. A helper joins, edits,
and both walk the learner's run; a late joiner gets the last run; Leave
drops you; Run is locked while another's run goes.
`tests/browser/lesson-room.spec.ts`: a console lesson shared after three
steps, the helper (with no `?seed=`) catching up and the two answering in
turn to the takeaway, in lockstep after every step, wipes included; an
editor lesson with one shared program; two answers at the same moment,
settling on one order. `tests/unit/collab.test.ts` covers packing, the
shape check and links.

## Lessons

A lesson's step is derived from its evidence (CLAUDE.md invariant 11), and
the evidence is a function of what the player did, in order. So a lesson
room shares *that*: a log of events (a line typed, a program run, an option
picked, Undo, a wipe), and every peer applies the log in the document's
order and derives the same step, with no new state.

1. **Everything a player does to a v2 lesson is an event** (`act` in
   `Workbench`), alone too: the log is what Share hands the room, so a
   helper joining mid-lesson replays it and catches up. Alone, an event
   is applied at once; in a room, it is added to the room's log, and every
   peer, the one who made it included, applies the log in order.
2. **Each peer runs Python for a lesson itself.** Unlike the sandbox: a
   lesson's programs are the lesson's, the console is replay anyway
   (invariant 7), and a run's evidence includes the quiet runs on the
   step's cases. A line using `random` could differ between peers; no
   lesson asks for one.
3. **The questions must be the same**, and v2 lessons are drawn from a
   seed. The page draws one seed for every lesson (`pageSeed`), the room
   carries it, and a joiner's lesson is drawn with it (`lessonFor`). So a
   lesson link waits for the room before the lesson is built ("Joining
   the room…").
4. **Crossed events start over.** Two peers adding at once may each have
   applied their own first; the document settles on one order, a peer
   whose log no longer agrees remounts its workbench (`App`'s `gen`) and
   replays. Its old queue stops, and the replay waits for the session's
   last run to end, or the first replayed line would be refused.
5. **The lesson's own wipes are events, made by one peer.** A wipe on a
   beat or at a step's start (`Beat.wipe`, `wipeFirst`) changes the
   evidence, so it is in the log, keyed, and applied once. Only the
   room's leader (`Room.leads`: the learner, else the first by id) makes
   it, or every peer reaching the beat would add one and they would cross.
   The same leader puts a step's given program in the shared editor.
6. **Which line is told is shared** like a run's step: Next or Back on one
   page moves everyone. Sharing announces the learner's line, and a peer
   still catching up takes the last one announced when it reaches that
   step.
7. **Progress:** every peer derives the lesson finished, so every peer's
   map marks it done. Lessons record no mastery; practice, which does, is
   not shared.

Not shared: practice, reading levels, and v1 lessons. Going to another
page (the map, the next level) leaves the room.
