# Shared rooms

A learner can share the sandbox (`#/code`) with a helper: a parent, a
teacher, a friend who knows more. Both see the same program, the same run
and the same step of it, and either can type, run and step. Lessons in a
room are next (see "Lessons, next" below).

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
| `src/app/Sandbox.tsx` | uses all of it |

## The document

One Automerge document per room. Its URL is the room's name and its key.

```
{ code: string,          // the editor's text, merged a character at a time
  run: { runId, driver,  // the last run, replaced whole by each new one
         status: 'running' | 'done',
         source,          // the program that ran
         trace: bytes | null,   // gzipped JSON of the steps (trace.ts)
         tooBig: boolean } | null }
```

Presence is not in the document. Who is here (a made-up name like
"Plucky Otter", a colour, learner or helper), each caret, and the step
each person is looking at travel as ephemeral messages, so dragging the
scrubber is not history.

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
drops you; Run is locked while another's run goes. `tests/unit/collab.test.ts`
covers packing, the shape check and links.

## Lessons, next

A lesson's step is derived from its evidence (CLAUDE.md invariant 11), so a
room that shares the evidence (the lines accepted, the picks, the runs)
has every peer derive the same step with no new state. Console lessons are
deterministic, so each peer can replay the shared lines itself. Which beat
is showing is view state and is shared like the step. Every peer marks a
finished lesson finished; mastery is recorded for whoever answered.
