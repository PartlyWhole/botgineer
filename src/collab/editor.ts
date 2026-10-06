/**
 * What the editor wears in a shared room (`CodeEditor`'s `shared` slot):
 * the text kept in step with the room, the others' carets, and this
 * peer's own caret sent to them.
 *
 * Presence is one calm caret per peer, PLP's rule after its first version
 * was found distracting (PLP `design/collab-presence.md`): a 2px caret in the
 * peer's colour, a light tint over what they have selected, and their
 * name, which shows when they arrive or move after a pause and then fades.
 * It stays under the caret at no opacity, so hovering the caret still says
 * whose it is. Text another peer typed is never highlighted.
 */
import { EditorState, StateEffect, StateField, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view'
import type { Peer, Room } from './room'

export const setPeers = StateEffect.define<readonly Peer[]>()

/** How long a name shows before it has faded (`.cm-peer-name`). */
const NAME_MS = 1600

class Caret extends WidgetType {
  constructor(
    readonly name: string,
    readonly color: string,
    readonly announcedAt: number,
  ) {
    super()
  }
  eq(other: Caret) {
    return other.name === this.name && other.color === this.color && other.announcedAt === this.announcedAt
  }
  toDOM() {
    const caret = document.createElement('span')
    caret.className = 'cm-peer-caret'
    caret.style.setProperty('--peer', this.color)
    caret.setAttribute('aria-hidden', 'true')
    const label = document.createElement('span')
    label.className = 'cm-peer-name'
    label.textContent = this.name
    // A caret that moves is redrawn, and a fresh element would start its
    // fade again on every keystroke: the flicker PLP took out. So the fade
    // carries on from when the name was announced.
    const since = Date.now() - this.announcedAt
    if (since < NAME_MS) label.style.animationDelay = `-${since}ms`
    else label.classList.add('quiet')
    caret.appendChild(label)
    return caret
  }
  ignoreEvent() {
    return true
  }
}

function decorate(doc: { length: number }, peers: readonly Peer[]): DecorationSet {
  const out: Range<Decoration>[] = []
  for (const p of peers) {
    if (!p.cursor) continue
    const clamp = (n: number) => Math.max(0, Math.min(doc.length, n))
    const anchor = clamp(p.cursor.anchor)
    const head = clamp(p.cursor.head)
    if (anchor !== head) {
      out.push(
        Decoration.mark({
          class: 'cm-peer-selection',
          attributes: { style: `--peer: ${p.color}` },
        }).range(Math.min(anchor, head), Math.max(anchor, head)),
      )
    }
    // `side: -1`: text typed exactly at a peer's caret goes after it, the
    // caret staying put, as it does on the peer's own screen (`keepCaret`).
    out.push(Decoration.widget({ widget: new Caret(p.name, p.color, p.announcedAt), side: -1 }).range(head))
  }
  return Decoration.set(out, true)
}

const peersField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    for (const e of tr.effects) if (e.is(setPeers)) return decorate(tr.state.doc, e.value)
    // Remote text arriving before the caret that goes with it: the carets
    // ride along with the edit until the next presence message.
    return tr.docChanged ? set.map(tr.changes) : set
  },
  provide: (f) => EditorView.decorations.from(f),
})

/**
 * Someone else's typing never moves your caret. The sync plugin applies a
 * peer's edit and then sets the caret itself, mapped so that text inserted
 * exactly at it pushes it along: type where your partner's caret is and
 * theirs was carried with your text. Without that last step, CodeMirror's
 * own mapping (with the edit) leaves a caret before text inserted at it,
 * and every other edit moves it just the same.
 */
function keepCaret(room: Room): Extension {
  const ours = room.lib.reconcileAnnotationType
  return EditorState.transactionFilter.of((tr) => (tr.annotation(ours) !== undefined && !tr.docChanged && tr.selection ? [] : tr))
}

/** Everything the editor needs for `room`. Build it once per room. */
export function sharedEditor(room: Room): Extension {
  return [
    room.lib.automergeSyncPlugin({ handle: room.handle, path: ['code'] }),
    keepCaret(room),
    // Where this caret is from the start, before it is ever moved: everyone
    // in the room has one, at the top of the text until they click.
    ViewPlugin.define((view) => {
      room.shareCursor(() => {
        const { anchor, head } = view.state.selection.main
        return { anchor, head }
      })
      return {}
    }),
    peersField,
    EditorView.updateListener.of((u) => {
      // Only when this caret moves. Edits (anyone's) move the text around it,
      // not its place: it is sent as a place in the text (`Room.place`).
      if (!u.selectionSet && !u.focusChanged) return
      const view = u.view
      room.shareCursor(() => {
        const { anchor, head } = view.state.selection.main
        return { anchor, head }
      })
    }),
  ]
}
