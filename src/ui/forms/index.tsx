/**
 * One widget per interaction (`collection/model` `Part`). The dispatch is
 * here so the read panel does not have to know them all.
 */
import type { Answer, Graded, Part } from '../../collection/model'
import type { Truth } from '../../collection/grade'
import { BlockForm } from './BlockForm'
import { ChoiceForm } from './ChoiceForm'
import { DiagramForm } from './DiagramForm'
import { LabelsForm } from './LabelsForm'
import { LineForm } from './LineForm'
import { NumberForm } from './NumberForm'
import { OrderForm } from './OrderForm'
import { OutputForm } from './OutputForm'
import { RuleForm } from './RuleForm'
import { TableForm } from './TableForm'

type Props = {
  part: Part
  answer: Answer | null
  onAnswer: (a: Answer) => void
  locked: boolean
  graded: Graded | null
  truth: Truth | null
  index: number
  picking: boolean
  onPicking: (on: boolean) => void
  onMark: (m: 'right' | 'word' | 'missed') => void
}

/** Parts answered by clicking lines of the code. */
export const PICKS_LINES = new Set<Part['kind']>(['line', 'order', 'block'])

export function PartForm(props: Props) {
  const { part, answer } = props
  // Each form narrows its own part and answer; the casts restate what the
  // switch has already established.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = props as any
  switch (part.kind) {
    case 'output':
      return <OutputForm {...p} />
    case 'choice':
      return <ChoiceForm {...p} />
    case 'number':
      return <NumberForm {...p} />
    case 'line':
      return <LineForm {...p} />
    case 'order':
      return <OrderForm {...p} />
    case 'table':
      return <TableForm {...p} />
    case 'block':
      return <BlockForm {...p} />
    case 'diagram':
      return <DiagramForm {...p} />
    case 'labels':
      return <LabelsForm {...p} />
    case 'rule':
      return <RuleForm {...p} onMark={props.onMark} />
    default:
      void answer
      return null
  }
}
