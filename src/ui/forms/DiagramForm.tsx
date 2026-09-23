import { useHandles } from '../../memory/handles'
import type { MemorySnapshot } from '../../memory/model'
import { MemoryGraph } from '../../panels/MemoryGraph'
import { TRANSFORM_SAYS } from '../../collection/distractors'
import type { Transform } from '../../collection/model'
import type { FormProps } from './shared'
import { Verdict } from './shared'

const LETTERS = 'ABCDEFG'

/**
 * Draw names and objects, as a choice between pictures.
 *
 * Every picture is drawn by the real memory grid — the same cards, the
 * same arrows — so the one that is right is exactly what the memory panel
 * will show once the run is revealed. The wrong ones are the truth with a
 * named wrong idea applied (`collection/distractors`), and after the
 * commit each says which idea it stands for.
 */
export function DiagramForm({ part, answer, onAnswer, locked, graded, truth, index }: FormProps<'diagram'>) {
  const choice = truth?.diagrams?.get(index)
  const moment =
    part.at === 'end' ? 'after the last line' : 'before' in part.at ? `just before line ${part.at.before} runs` : `just after line ${part.at.after} runs`
  return (
    <fieldset className="form diagram-form">
      <legend className="form-label">{part.prompt ?? `Which picture is memory ${moment}?`}</legend>
      {!choice && <p className="quiet">Drawing the pictures…</p>}
      <div className="diagram-options">
        {choice?.options.map((o, i) => (
          <DiagramOption
            key={i}
            letter={LETTERS[i]!}
            snapshot={o.snapshot}
            transform={o.transform}
            picked={answer?.picked === i}
            revealed={graded !== null}
            onPick={() => !locked && onAnswer({ kind: 'diagram', picked: i })}
            disabled={locked}
            id={`${index}-${i}`}
          />
        ))}
      </div>
      <Verdict graded={graded} expected={choice ? <span>Picture {LETTERS[choice.answer]}</span> : undefined} />
    </fieldset>
  )
}

function DiagramOption({
  letter,
  snapshot,
  transform,
  picked,
  revealed,
  onPick,
  disabled,
  id,
}: {
  letter: string
  snapshot: MemorySnapshot
  transform: Transform | null
  picked: boolean
  revealed: boolean
  onPick: () => void
  disabled: boolean
  id: string
}) {
  const handles = useHandles(snapshot, `diagram:${id}`)
  return (
    <div
      className={`diagram-option ${picked ? 'picked' : ''} ${revealed ? (transform === null ? 'key' : picked ? 'miss' : '') : ''}`}
      data-testid={`diagram-option-${letter}`}
    >
      <button type="button" className="diagram-pick" onClick={onPick} disabled={disabled} aria-pressed={picked}>
        Picture {letter}
      </button>
      <div className="diagram-graph" aria-hidden="true">
        <MemoryGraph snapshot={snapshot} handles={handles} runKey={`diagram:${id}`} picked={null} onPick={() => {}} fit />
      </div>
      {revealed && <p className="diagram-says">{transform === null ? 'What Python built.' : `This is ${TRANSFORM_SAYS[transform]}.`}</p>}
    </div>
  )
}
